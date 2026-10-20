import { NextRequest, NextResponse } from 'next/server'
import { supabaseServidor as db } from '@/lib/servidor'
import { contextoDaRequisicao, naoAutenticado, proibido } from '@/lib/acesso'
import { FILTRO_APOIO } from '@/lib/cargos'

/**
 * Pedidos de horário feitos pela agenda online (link público), no escopo da sessão.
 *   GET                                  → pedidos aguardando confirmação
 *   POST { id, acao: 'confirmar' }       → acha ou cadastra o paciente pelo telefone e cria o agendamento
 *   POST { id, acao: 'rejeitar' }
 */
async function medicosDoEscopo(ctx: NonNullable<Awaited<ReturnType<typeof contextoDaRequisicao>>>) {
  if (ctx.clinica_id) {
    const { data } = await db.from('medicos').select('id').eq('clinica_id', ctx.clinica_id).not('cargo', 'in', FILTRO_APOIO)
    return (data || []).map((m: any) => m.id as string)
  }
  return ctx.medico_id ? [ctx.medico_id] : []
}

const PENDENTE = ['aguardando_confirmacao', 'pendente']

export async function GET(req: NextRequest) {
  const ctx = await contextoDaRequisicao(req)
  if (!ctx) return naoAutenticado()
  if (ctx.tipo === 'atendente') return NextResponse.json({ pedidos: [] })
  const ids = await medicosDoEscopo(ctx)
  if (!ids.length) return NextResponse.json({ pedidos: [] })
  const { data, error } = await db.from('agenda_publica_solicitacoes').select('id, medico_id, nome_paciente, telefone, email, data_hora, motivo, primeira_consulta, criado_em, medico:medicos(nome)')
    .in('medico_id', ids).in('status', PENDENTE).gte('data_hora', new Date(Date.now() - 3600000).toISOString()).order('data_hora')
  if (error) return NextResponse.json({ pedidos: [] })
  return NextResponse.json({ pedidos: data || [] })
}

export async function POST(req: NextRequest) {
  const ctx = await contextoDaRequisicao(req)
  if (!ctx) return naoAutenticado()
  if (ctx.tipo === 'atendente') return proibido()
  const { id, acao } = await req.json().catch(() => ({}))
  const { data: s } = await db.from('agenda_publica_solicitacoes').select('*').eq('id', id || '').maybeSingle()
  const ids = await medicosDoEscopo(ctx)
  if (!s || !ids.includes((s as any).medico_id)) return NextResponse.json({ error: 'Pedido não encontrado.' }, { status: 404 })
  const p: any = s
  if (!PENDENTE.includes(p.status)) return NextResponse.json({ error: 'Este pedido já foi respondido.' }, { status: 409 })

  if (acao === 'rejeitar') {
    await db.from('agenda_publica_solicitacoes').update({ status: 'rejeitado' }).eq('id', p.id)
    return NextResponse.json({ ok: true })
  }
  if (acao !== 'confirmar') return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 })

  // Paciente: o mesmo telefone na clínica, senão cadastra
  const { data: med } = await db.from('medicos').select('clinica_id, agenda_publica_config').eq('id', p.medico_id).maybeSingle()
  const clinicaId = (med as any)?.clinica_id || ctx.clinica_id || null
  const tel = String(p.telefone || '').replace(/\D/g, '')
  let pacienteId: string | null = null
  if (tel.length >= 10) {
    let q = db.from('pacientes').select('id, telefone').ilike('telefone', `%${tel.slice(-8)}%`).limit(20)
    q = clinicaId ? q.or(`clinica_id.eq.${clinicaId},medico_id.in.(${ids.join(',')})`) : q.eq('medico_id', p.medico_id)
    const { data: achados } = await q
    pacienteId = (achados || []).find((x: any) => String(x.telefone || '').replace(/\D/g, '').endsWith(tel.slice(-10)))?.id || null
  }
  if (!pacienteId) {
    const { data: novo, error } = await db.from('pacientes').insert({ nome: p.nome_paciente, telefone: p.telefone, email: p.email || null, medico_id: p.medico_id, clinica_id: clinicaId }).select('id').single()
    if (error) return NextResponse.json({ error: 'Não foi possível cadastrar o paciente.' }, { status: 500 })
    pacienteId = (novo as any).id
  }
  const duracao = String((med as any)?.agenda_publica_config?.duracao_consulta_min || 30)
  const { data: ag, error: eAg } = await db.from('agendamentos').insert({
    medico_id: p.medico_id, paciente_id: pacienteId, data_hora: p.data_hora, tipo: 'consulta', status: 'agendado',
    motivo: p.motivo || null, duracao, observacoes: 'Marcado pela agenda online.',
  }).select('id').single()
  if (eAg) return NextResponse.json({ error: 'Não foi possível criar o agendamento.' }, { status: 500 })
  await db.from('agenda_publica_solicitacoes').update({ status: 'confirmado', agendamento_id: (ag as any).id }).eq('id', p.id)
  return NextResponse.json({ ok: true, agendamento_id: (ag as any).id, paciente_id: pacienteId })
}
