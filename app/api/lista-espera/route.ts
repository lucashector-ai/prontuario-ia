import { NextRequest, NextResponse } from 'next/server'
import { supabaseServidor as db } from '@/lib/servidor'
import { ehErroDeSchema } from '@/components/confirmacoes/modelos'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Lista de espera da Agenda.
 *   GET    ?medico_id=… | ?medico_ids=a,b  [&status=aguardando,oferecido] → { itens, aviso? }
 *   POST   { medico_id, paciente_id?, nome, telefone?, tipo, preferencia_dias, preferencia_periodo, observacao?, prioridade }
 *   PATCH  { id, ...campos }
 *   DELETE ?id=…  (remoção lógica: status = 'removido')
 */
const AVISO_MIGRATION = 'Lista de espera indisponível: rode a migration 0010.'
const TIPOS = ['consulta', 'retorno', 'exame']
const PERIODOS = ['manha', 'tarde', 'noite', 'qualquer']
const STATUS = ['aguardando', 'oferecido', 'agendado', 'removido']

function limpar(b: any, parcial: boolean) {
  const o: Record<string, any> = {}
  if (b.medico_id !== undefined) o.medico_id = b.medico_id
  if (b.paciente_id !== undefined) o.paciente_id = b.paciente_id || null
  if (b.nome !== undefined) o.nome = String(b.nome || '').trim().slice(0, 200)
  if (b.telefone !== undefined) o.telefone = b.telefone ? String(b.telefone).slice(0, 40) : null
  if (b.tipo !== undefined) o.tipo = TIPOS.includes(b.tipo) ? b.tipo : 'consulta'
  if (b.preferencia_dias !== undefined) {
    o.preferencia_dias = Array.isArray(b.preferencia_dias)
      ? Array.from(new Set(b.preferencia_dias.map(Number).filter((n: number) => Number.isInteger(n) && n >= 0 && n <= 6)))
      : []
  }
  if (b.preferencia_periodo !== undefined) o.preferencia_periodo = PERIODOS.includes(b.preferencia_periodo) ? b.preferencia_periodo : 'qualquer'
  if (b.observacao !== undefined) o.observacao = b.observacao ? String(b.observacao).slice(0, 500) : null
  if (b.prioridade !== undefined) o.prioridade = Math.max(0, Math.min(2, Number(b.prioridade) || 0))
  if (parcial) {
    if (b.status !== undefined && STATUS.includes(b.status)) o.status = b.status
    if (b.agendamento_id !== undefined) o.agendamento_id = b.agendamento_id || null
  }
  return o
}

function erro(e: any) {
  if (ehErroDeSchema(e)) return NextResponse.json({ error: AVISO_MIGRATION, aviso: AVISO_MIGRATION }, { status: 409 })
  return NextResponse.json({ error: e?.message || 'Erro' }, { status: 500 })
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const ids = (sp.get('medico_ids') || sp.get('medico_id') || '').split(',').map(s => s.trim()).filter(Boolean)
  if (!ids.length) return NextResponse.json({ error: 'medico_id obrigatório' }, { status: 400 })
  const status = (sp.get('status') || 'aguardando,oferecido').split(',').filter(s => STATUS.includes(s))
  const { data, error } = await db.from('lista_espera').select('*')
    .in('medico_id', ids).in('status', status)
    .order('prioridade', { ascending: false }).order('criado_em', { ascending: true })
  if (error) {
    if (ehErroDeSchema(error)) return NextResponse.json({ itens: [], aviso: AVISO_MIGRATION })
    return erro(error)
  }
  return NextResponse.json({ itens: data || [] })
}

export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}))
  const item = limpar(b, false)
  if (!item.medico_id) return NextResponse.json({ error: 'medico_id obrigatório' }, { status: 400 })
  // Paciente cadastrado: completa nome/telefone a partir do cadastro
  if (item.paciente_id && (!item.nome || !item.telefone)) {
    const { data: p } = await db.from('pacientes').select('nome, telefone').eq('id', item.paciente_id).maybeSingle()
    if (p) { item.nome = item.nome || p.nome; item.telefone = item.telefone || p.telefone || null }
  }
  if (!item.nome) return NextResponse.json({ error: 'Informe o nome' }, { status: 400 })
  const { data, error } = await db.from('lista_espera').insert({ ...item, status: 'aguardando' }).select('*').single()
  if (error) return erro(error)
  return NextResponse.json({ item: data })
}

export async function PATCH(req: NextRequest) {
  const b = await req.json().catch(() => ({}))
  if (!b.id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })
  const campos = limpar(b, true)
  delete campos.medico_id
  if (!Object.keys(campos).length) return NextResponse.json({ error: 'Nada para atualizar' }, { status: 400 })
  if (campos.status === 'aguardando') campos.oferta_data_hora = null
  const { data, error } = await db.from('lista_espera').update(campos).eq('id', b.id).select('*').single()
  if (error) return erro(error)
  return NextResponse.json({ item: data })
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })
  const { error } = await db.from('lista_espera').update({ status: 'removido' }).eq('id', id)
  if (error) return erro(error)
  return NextResponse.json({ ok: true })
}
