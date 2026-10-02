import { NextRequest, NextResponse } from 'next/server'
import { supabaseServidor as db } from '@/lib/servidor'
import { conciliarRetornos, faltaMigration, lembrarRetorno } from './comum'

export const dynamic = 'force-dynamic'

const STATUS = ['pendente', 'lembrado', 'agendado', 'concluido', 'descartado']
const ORIGENS = ['manual', 'ia', 'consulta']
const ehData = (s: any) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)

const erro = (e: any, status = 500) => NextResponse.json(
  { error: faltaMigration(e) ? 'Rode a migration 0011_retornos no Supabase' : (e?.message || String(e)), falta_migration: faltaMigration(e) },
  { status },
)

/**
 * GET /api/retornos?medico_id=…[&status=pendente,lembrado][&de=YYYY-MM-DD][&ate=YYYY-MM-DD][&paciente_id=…]
 * Devolve { retornos: [...com paciente {id,nome,telefone}] }.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const medicoId = sp.get('medico_id')
  if (!medicoId) return NextResponse.json({ error: 'medico_id obrigatório' }, { status: 400 })

  // Mantém os status em dia com a agenda (silencioso)
  if (sp.get('conciliar') !== '0') { try { await conciliarRetornos(medicoId) } catch {} }

  let q = db.from('retornos').select('*').eq('medico_id', medicoId)
  const status = (sp.get('status') || '').split(',').filter(s => STATUS.includes(s))
  if (status.length) q = q.in('status', status)
  if (ehData(sp.get('de'))) q = q.gte('data_prevista', sp.get('de')!)
  if (ehData(sp.get('ate'))) q = q.lte('data_prevista', sp.get('ate')!)
  if (sp.get('paciente_id')) q = q.eq('paciente_id', sp.get('paciente_id')!)
  const { data, error } = await q.order('data_prevista', { ascending: true }).limit(1000)
  if (error) return erro(error)

  const ids = Array.from(new Set((data || []).map(r => r.paciente_id)))
  const pacs: Record<string, any> = {}
  for (let i = 0; i < ids.length; i += 200) {
    const { data: p } = await db.from('pacientes').select('id, nome, telefone').in('id', ids.slice(i, i + 200))
    ;(p || []).forEach(x => { pacs[x.id] = x })
  }
  return NextResponse.json({ retornos: (data || []).map(r => ({ ...r, paciente: pacs[r.paciente_id] || null })) })
}

/** POST { medico_id, paciente_id, data_prevista, motivo?, origem?, consulta_id? } */
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}))
  if (!b.medico_id || !b.paciente_id || !ehData(b.data_prevista)) {
    return NextResponse.json({ error: 'medico_id, paciente_id e data_prevista (YYYY-MM-DD) são obrigatórios' }, { status: 400 })
  }
  const { data, error } = await db.from('retornos').insert({
    medico_id: b.medico_id, paciente_id: b.paciente_id, consulta_id: b.consulta_id || null,
    data_prevista: b.data_prevista, motivo: (b.motivo || '').toString().trim().slice(0, 200) || null,
    origem: ORIGENS.includes(b.origem) ? b.origem : 'manual', status: 'pendente',
  }).select('*').single()
  if (error) return erro(error)
  return NextResponse.json({ retorno: data })
}

/**
 * PATCH { id, status?, data_prevista?, motivo?, agendamento_id? }
 * PATCH { id, acao: 'lembrar' } → envia o lembrete por WhatsApp agora.
 * Ao mudar a data, o lembrete automático volta a valer para a nova data.
 */
export async function PATCH(req: NextRequest) {
  const b = await req.json().catch(() => ({}))
  if (!b.id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })
  const { data: atual, error: e1 } = await db.from('retornos').select('*').eq('id', b.id).maybeSingle()
  if (e1) return erro(e1)
  if (!atual) return NextResponse.json({ error: 'Retorno não encontrado' }, { status: 404 })

  if (b.acao === 'lembrar') {
    const r = await lembrarRetorno(atual, { forcar: true })
    if (!r.ok) return NextResponse.json({ error: r.erro || 'Não foi possível enviar' }, { status: 422 })
    const { data } = await db.from('retornos').select('*').eq('id', b.id).maybeSingle()
    return NextResponse.json({ retorno: data })
  }

  const upd: Record<string, any> = {}
  if (b.status !== undefined) {
    if (!STATUS.includes(b.status)) return NextResponse.json({ error: 'status inválido' }, { status: 400 })
    upd.status = b.status
  }
  if (b.data_prevista !== undefined) {
    if (!ehData(b.data_prevista)) return NextResponse.json({ error: 'data_prevista inválida' }, { status: 400 })
    upd.data_prevista = b.data_prevista
    if (b.data_prevista !== atual.data_prevista) {
      upd.lembrete_enviado_em = null
      if (atual.status === 'lembrado' && b.status === undefined) upd.status = 'pendente'
    }
  }
  if (b.motivo !== undefined) upd.motivo = (b.motivo || '').toString().trim().slice(0, 200) || null
  if (b.agendamento_id !== undefined) upd.agendamento_id = b.agendamento_id || null
  if (!Object.keys(upd).length) return NextResponse.json({ retorno: atual })

  const { data, error } = await db.from('retornos').update(upd).eq('id', b.id).select('*').single()
  if (error) return erro(error)
  return NextResponse.json({ retorno: data })
}

/** DELETE ?id=… */
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })
  const { error } = await db.from('retornos').delete().eq('id', id)
  if (error) return erro(error)
  return NextResponse.json({ ok: true })
}
