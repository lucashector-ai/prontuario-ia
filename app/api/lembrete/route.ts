import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// POST { agendamento_id } — lembrete para um agendamento especifico
// GET — lembretes para todos os agendamentos de amanha
export async function POST(req: NextRequest) {
  try {
    const { agendamento_id } = await req.json()
    if (!agendamento_id) return NextResponse.json({ error: 'agendamento_id obrigatorio' }, { status: 400 })
    const { data: ag } = await sb
      .from('agendamentos')
      .select('*, pacientes(nome, telefone), medicos(nome, especialidade)')
      .eq('id', agendamento_id).single()
    if (!ag) return NextResponse.json({ error: 'Nao encontrado' }, { status: 404 })
    if (!ag.pacientes?.telefone) return NextResponse.json({ enviado: false, motivo: 'sem_telefone' })
    const resultado = await enviarLembrete(ag)
    return NextResponse.json(resultado)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function GET() {
  try {
    const amanha = new Date()
    amanha.setDate(amanha.getDate() + 1)
    const inicio = new Date(amanha.setHours(0,0,0,0)).toISOString()
    const fim = new Date(amanha.setHours(23,59,59,999)).toISOString()
    const { data: ags } = await sb
      .from('agendamentos')
      .select('*, pacientes(nome, telefone), medicos(nome, especialidade)')
      .gte('data_hora', inicio).lte('data_hora', fim).eq('status', 'agendado')
    if (!ags?.length) return NextResponse.json({ enviados: 0, msg: 'Nenhum agendamento amanha' })
    let enviados = 0
    const erros: string[] = []
    for (const ag of ags) {
      if (!ag.pacientes?.telefone) { erros.push(ag.id + ': sem telefone'); continue }
      const r = await enviarLembrete(ag)
      if (r.ok) enviados++; else erros.push(ag.id + ': ' + r.error)
    }
    return NextResponse.json({ enviados, total: ags.length, erros })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

async function enviarLembrete(ag: any) {
  try {
    const dt = new Date(ag.data_hora)
    const dataFmt = dt.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })
    const horaFmt = dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    const nome = ag.pacientes?.nome?.split(' ')[0] || 'paciente'
    const medico = ag.medicos?.nome || 'seu medico'
    const motivo = ag.motivo || ag.tipo || 'consulta'
    const texto = `Ola ${nome}! Lembrando que voce tem ${motivo} amanha com ${medico}.\n\nData: ${dataFmt} as ${horaFmt}\n\nPara confirmar responda SIM, para cancelar responda NAO.\n\nMedIA — Sistema de Gestao de Consultas`
    const { data: config } = await sb
      .from('whatsapp_config')
      .select('phone_number_id, access_token')
      .eq('medico_id', ag.medico_id).single()
    if (!config?.access_token) return { ok: false, error: 'WhatsApp nao configurado' }
    const tel = ag.pacientes.telefone.replace(/\\D/g, '')
    const r = await fetch(`https://graph.facebook.com/v17.0/${config.phone_number_id}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + config.access_token },
      body: JSON.stringify({ messaging_product: 'whatsapp', to: tel.startsWith('55') ? tel : '55' + tel, type: 'text', text: { body: texto } })
    })
    const d = await r.json()
    if (d.messages?.[0]?.id) return { ok: true, messageId: d.messages[0].id }
    return { ok: false, error: JSON.stringify(d) }
  } catch (err: any) {
    return { ok: false, error: err.message }
  }
}
