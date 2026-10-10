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
 * O escopo vem da sessão (escopoDaSessao): admin e recepção veem as da clínica toda;
 * médico vê as próprias.
 */
import { NextRequest, NextResponse } from 'next/server'
import { supabaseServidor as supabase } from '@/lib/servidor'
import { sessaoDaRequisicao } from '@/lib/sessao-servidor'

const LIMITE_PADRAO = 20
const LIMITE_MAXIMO = 50

/**
 * De quem são os avisos que esta sessão vê:
 *   admin da clínica e recepcionista → todos os médicos da clínica
 *   médico → os próprios, menos os de "saída do consultório" (são para a recepção)
 */
async function escopoDaSessao(req: NextRequest): Promise<{ medicos: string[]; ocultar: string[] } | null> {
  const s = await sessaoDaRequisicao(req)
  if (!s) return null
  const daClinica = async () => {
    if (!s.clinica_id) return s.medico_id ? [s.medico_id] : []
    const { data } = await supabase.from('medicos').select('id').eq('clinica_id', s.clinica_id)
    return (data || []).map((m: any) => m.id)
  }
  if (s.tipo === 'clinica') return { medicos: await daClinica(), ocultar: [] }
  if (!s.medico_id) return { medicos: [], ocultar: [] }
  const { data: eu } = await supabase.from('medicos').select('cargo').eq('id', s.medico_id).maybeSingle()
  if (eu?.cargo === 'recepcionista' || eu?.cargo === 'admin') return { medicos: await daClinica(), ocultar: [] }
  return { medicos: [s.medico_id], ocultar: ['saida_recepcao'] }
}

export async function GET(req: NextRequest) {
  const escopo = await escopoDaSessao(req)
  if (!escopo) return NextResponse.json({ error: 'sessão inválida' }, { status: 401 })
  const { medicos, ocultar } = escopo
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
  if (ocultar.length) query = query.or(`tipo.is.null,tipo.not.in.(${ocultar.join(',')})`)

  const [{ data, error }, { count }] = await Promise.all([
    query,
    (() => {
      let c = supabase.from('notificacoes_medico').select('id', { count: 'exact', head: true }).in('medico_id', medicos).eq('lida', false)
      if (ocultar.length) c = c.or(`tipo.is.null,tipo.not.in.(${ocultar.join(',')})`)
      return c
    })(),
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
  const escopo = await escopoDaSessao(req)
  if (!escopo) return NextResponse.json({ error: 'sessão inválida' }, { status: 401 })
  const { medicos } = escopo
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
