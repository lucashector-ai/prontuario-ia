import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const { agendamento_id } = await req.json()
    if (!agendamento_id) return NextResponse.json({ error: 'agendamento_id obrigatorio' }, { status: 400 })
    const { data: ag } = await supabase
      .from('agendamentos')
      .select('*, pacientes(nome, telefone), medicos(nome, especialidade)')
      .eq('id', agendamento_id).single()
    if (!ag) return NextResponse.json({ error: 'Nao encontrado' }, { status: 404 })
    if (!ag.pacientes?.telefone) return NextResponse.json({ enviado: false, motivo: 'sem_telefone' })
    const dt = new Date(ag.data_hora)
    const dataFmt = dt.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })
    const horaFmt = dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    const nome = (ag.pacientes?.nome || 'paciente').split(' ')[0]
    const medico = ag.medicos?.nome || 'seu medico'
    const texto = 'Ola ' + nome + '! Lembrete: consulta amanha com ' + medico + ' as ' + horaFmt + ' (' + dataFmt + '). Responda SIM para confirmar ou NAO para cancelar.'
    const { data: config } = await supabase
      .from('whatsapp_config').select('phone_number_id, access_token')
      .eq('medico_id', ag.medico_id).single()
    if (!config?.access_token) return NextResponse.json({ enviado: false, motivo: 'wpp_nao_configurado' })
    const tel = ag.pacientes.telefone.replace(/\D/g, '')
    const r = await fetch('https://graph.facebook.com/v17.0/' + config.phone_number_id + '/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + config.access_token },
      body: JSON.stringify({ messaging_product: 'whatsapp', to: tel.startsWith('55') ? tel : '55' + tel, type: 'text', text: { body: texto } })
    })
    const d = await r.json()
    if (d.messages?.[0]?.id) return NextResponse.json({ enviado: true })
    return NextResponse.json({ enviado: false, erro: JSON.stringify(d) })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ msg: 'Use POST com agendamento_id' })
}
// deploy seg 30 mar 2026 11:21:13 -03
