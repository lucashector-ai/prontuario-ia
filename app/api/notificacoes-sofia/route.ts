/**
 * Central de notificações (notificacoes_medico).
 *
 * As notificações nunca são apagadas: "lida" só muda o destaque. A lista é paginada
 * por data (cursor `antes`), para a página /notificacoes carregar conforme rola.
 *
 *   GET   ?filtro=todas|nao_lidas&antes=<iso>&limite=20  → { notificacoes, nao_lidas, tem_mais }
 *   PATCH { id, lida }            → marca uma como lida / não lida
 *   PATCH { todas: true }         → marca todas como lidas
 *
 * O escopo vem da sessão: admin da clínica vê as dos médicos da clínica; médico e
 * atendente veem as do próprio médico.
 */
import { NextRequest, NextResponse } from 'next/server'
import { supabaseServidor as supabase } from '@/lib/servidor'
import { sessaoDaRequisicao } from '@/lib/sessao-servidor'

const LIMITE_PADRAO = 20
const LIMITE_MAXIMO = 50

async function medicosDaSessao(req: NextRequest): Promise<string[] | null> {
  const s = await sessaoDaRequisicao(req)
  if (!s) return null
  if (s.tipo === 'clinica') {
    if (!s.clinica_id) return []
    const { data } = await supabase.from('medicos').select('id').eq('clinica_id', s.clinica_id)
    return (data || []).map((m: any) => m.id)
  }
  return s.medico_id ? [s.medico_id] : []
}

export async function GET(req: NextRequest) {
  const medicos = await medicosDaSessao(req)
  if (!medicos) return NextResponse.json({ error: 'sessão inválida' }, { status: 401 })
  if (!medicos.length) return NextResponse.json({ notificacoes: [], nao_lidas: 0, tem_mais: false })

  const { searchParams } = new URL(req.url)
  const soNaoLidas = searchParams.get('filtro') === 'nao_lidas' || searchParams.get('nao_lidas') === 'true'
  const antes = searchParams.get('antes')
  const limite = Math.min(LIMITE_MAXIMO, Math.max(1, Number(searchParams.get('limite')) || LIMITE_PADRAO))

  // Pede um a mais para saber se ainda há página seguinte
  let query = supabase.from('notificacoes_medico').select('*')
    .in('medico_id', medicos)
    .order('criada_em', { ascending: false })
    .order('id', { ascending: false })
    .limit(limite + 1)
  if (soNaoLidas) query = query.eq('lida', false)
  if (antes) query = query.lt('criada_em', antes)

  const [{ data, error }, { count }] = await Promise.all([
    query,
    supabase.from('notificacoes_medico').select('id', { count: 'exact', head: true })
      .in('medico_id', medicos).eq('lida', false),
  ])
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const lista = data || []
  return NextResponse.json({
    notificacoes: lista.slice(0, limite),
    nao_lidas: count || 0,
    tem_mais: lista.length > limite,
  })
}

export async function PATCH(req: NextRequest) {
  const medicos = await medicosDaSessao(req)
  if (!medicos) return NextResponse.json({ error: 'sessão inválida' }, { status: 401 })
  if (!medicos.length) return NextResponse.json({ ok: true })

  const { id, lida, todas } = await req.json().catch(() => ({}))

  if (todas) {
    const { error } = await supabase.from('notificacoes_medico').update({ lida: true })
      .in('medico_id', medicos).eq('lida', false)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (!id) return NextResponse.json({ error: 'id obrigatorio' }, { status: 400 })
  const { error } = await supabase.from('notificacoes_medico').update({ lida: lida !== false })
    .eq('id', id).in('medico_id', medicos)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
