import { NextRequest, NextResponse } from 'next/server'
import { supabaseServidor as db } from '@/lib/servidor'
import { sessaoDaRequisicao } from '@/lib/sessao-servidor'

/**
 * Sala de teleconsulta — rota pública (o paciente entra só com o link, sem login).
 * O paciente recebe apenas o necessário (status da sala e o próprio nome);
 * o médico logado da mesma clínica recebe a ficha completa do paciente.
 */
const STATUS = new Set(['aguardando', 'em_andamento', 'encerrada'])

async function podeVerFicha(req: NextRequest, medicoId: string | null) {
  const s = await sessaoDaRequisicao(req)
  if (!s || !medicoId) return false
  if (s.medico_id === medicoId) return true
  if (!s.clinica_id) return false
  const { data } = await db.from('medicos').select('clinica_id').eq('id', medicoId).maybeSingle()
  return data?.clinica_id === s.clinica_id
}

export async function GET(req: NextRequest, { params }: { params: { sala_id: string } }) {
  const { data: sala } = await db.from('teleconsultas')
    .select('id, sala_id, medico_id, paciente_id, agendamento_id, titulo, status, iniciada_em, encerrada_em, duracao_segundos, criado_em')
    .eq('sala_id', params.sala_id).maybeSingle()
  if (!sala) return NextResponse.json({ error: 'Sala não encontrada ou link expirado.' }, { status: 404 })

  // Reabrir sala encerrada (mesmo comportamento de antes)
  if (sala.status === 'encerrada') {
    await db.from('teleconsultas').update({ status: 'aguardando', encerrada_em: null }).eq('sala_id', params.sala_id)
    sala.status = 'aguardando'
  }

  let paciente: Record<string, any> | null = null
  if (sala.paciente_id) {
    const completo = await podeVerFicha(req, sala.medico_id)
    const { data } = await db.from('pacientes')
      .select(completo ? 'id, nome, cpf, data_nascimento, sexo, email, telefone, endereco' : 'id, nome')
      .eq('id', sala.paciente_id).maybeSingle()
    paciente = data
  }
  return NextResponse.json({ sala, paciente })
}

/** Atualiza só o andamento da sala (status e horários). */
export async function PATCH(req: NextRequest, { params }: { params: { sala_id: string } }) {
  const corpo = await req.json().catch(() => ({}))
  const status = String(corpo.status || '')
  if (!STATUS.has(status)) return NextResponse.json({ error: 'Status inválido' }, { status: 400 })
  const agora = new Date().toISOString()
  const mudanca: Record<string, any> = { status }
  if (status === 'em_andamento') mudanca.iniciada_em = agora
  if (status === 'encerrada') {
    mudanca.encerrada_em = agora
    const d = Number(corpo.duracao_segundos)
    if (Number.isFinite(d) && d >= 0 && d < 24 * 3600) mudanca.duracao_segundos = Math.round(d)
  }
  const { error } = await db.from('teleconsultas').update(mudanca).eq('sala_id', params.sala_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
