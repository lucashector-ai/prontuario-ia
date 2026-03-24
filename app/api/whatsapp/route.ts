import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabase } from '@/lib/supabase'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'media_whatsapp_2026'

async function getConfigPorNumero(phoneNumberId: string) {
  const { data } = await supabase.from('whatsapp_config').select('*').eq('phone_number_id', phoneNumberId).eq('ativo', true).single()
  return data
}

async function enviarMensagem(para: string, texto: string, token: string, phoneId: string) {
  await fetch('https://graph.facebook.com/v20.0/' + phoneId + '/messages', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to: para, type: 'text', text: { body: texto } })
  })
}

async function getOuCriarConversa(telefone: string, nome: string, medicoId: string | null, phoneNumberId: string) {
  const { data: existente } = await supabase.from('whatsapp_conversas').select('*').eq('telefone', telefone).eq('medico_id', medicoId).single()
  if (existente) {
    await supabase.from('whatsapp_conversas').update({ ultimo_contato: new Date().toISOString(), nome_contato: nome || existente.nome_contato }).eq('id', existente.id)
    return existente
  }
  const { data: paciente } = await supabase.from('pacientes').select('id').eq('telefone', telefone).eq('medico_id', medicoId).single()
  const { data: nova } = await supabase.from('whatsapp_conversas').insert({
    telefone, nome_contato: nome, paciente_id: paciente?.id, medico_id: medicoId, status: 'ativa'
  }).select().single()
  return nova
}

async function getHistorico(conversaId: string) {
  const { data } = await supabase.from('whatsapp_mensagens').select('tipo, conteudo').eq('conversa_id', conversaId).order('criado_em', { ascending: false }).limit(15)
  return (data || []).reverse()
}

async function getContextoPaciente(pacienteId: string | null) {
  if (!pacienteId) return null
  const [{ data: paciente }, { data: agendamentos }] = await Promise.all([
    supabase.from('pacientes').select('nome, alergias, comorbidades').eq('id', pacienteId).single(),
    supabase.from('agendamentos').select('data_hora, motivo, status').eq('paciente_id', pacienteId).gte('data_hora', new Date().toISOString()).order('data_hora').limit(2),
  ])
  return { paciente, agendamentos: agendamentos || [] }
}

async function getHorariosLivres(medicoId: string) {
  const agora = new Date()
  const em7dias = new Date(agora.getTime() + 7 * 24 * 60 * 60 * 1000)
  const { data: ocupados } = await supabase.from('agendamentos').select('data_hora').eq('medico_id', medicoId).gte('data_hora', agora.toISOString()).lte('data_hora', em7dias.toISOString()).neq('status', 'cancelado')
  const ocupadosSet = new Set((ocupados || []).map((a: any) => a.data_hora.substring(0, 16)))
  const horarios: string[] = []
  for (let d = 1; d <= 7; d++) {
    const dia = new Date(agora); dia.setDate(dia.getDate() + d)
    if (dia.getDay() === 0) continue
    for (const hora of [8, 9, 10, 11, 14, 15, 16, 17]) {
      dia.setHours(hora, 0, 0, 0)
      if (!ocupadosSet.has(dia.toISOString().substring(0, 16))) {
        horarios.push(dia.toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }))
        if (horarios.length >= 6) break
      }
    }
    if (horarios.length >= 6) break
  }
  return horarios
}

async function processarComIA(mensagem: string, historico: any[], contexto: any, horarios: string[], nomeClinica: string) {
  const system = 'Voce e Sofia, assistente da ' + nomeClinica + '. Responda em portugues, seja objetiva (max 3 linhas). NUNCA de orientacoes medicas. Emergencias: ligue 192. Horarios disponiveis: ' + (horarios.join(', ') || 'Nenhum') + '. Paciente: ' + (contexto?.paciente?.nome || 'Nao identificado') + '. Proximo agendamento: ' + (contexto?.agendamentos?.[0] ? new Date(contexto.agendamentos[0].data_hora).toLocaleString('pt-BR') : 'Nenhum') + '. Para confirmar agendamento inclua: [AGENDAR:{"data":"YYYY-MM-DDTHH:mm:00","motivo":"motivo"}]'
  const messages = historico.slice(-8).map((h: any) => ({ role: h.tipo === 'recebida' ? 'user' as const : 'assistant' as const, content: h.conteudo }))
  messages.push({ role: 'user', content: mensagem })
  const r = await anthropic.messages.create({ model: 'claude-opus-4-5', max_tokens: 350, system, messages })
  const txt = r.content[0].type === 'text' ? r.content[0].text : ''
  const match = txt.match(/\[AGENDAR:({[^}]+})\]/)
  return { texto: txt.replace(/\[AGENDAR:[^\]]+\]/g, '').trim(), agendarData: match ? JSON.parse(match[1]) : null }
}

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams
  if (p.get('hub.mode') === 'subscribe' && p.get('hub.verify_token') === VERIFY_TOKEN)
    return new NextResponse(p.get('hub.challenge'), { status: 200 })
  return new NextResponse('Forbidden', { status: 403 })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const value = body.entry?.[0]?.changes?.[0]?.value
    if (value?.statuses) return NextResponse.json({ ok: true })
    const messages = value?.messages
    if (!messages?.length) return NextResponse.json({ ok: true })

    const phoneNumberId = value?.metadata?.phone_number_id
    const config = await getConfigPorNumero(phoneNumberId)

    for (const msg of messages) {
      if (msg.type !== 'text') continue
      const telefone = msg.from
      const texto = msg.text?.body || ''
      const nomeContato = value.contacts?.[0]?.profile?.name || ''
      const medicoId = config?.medico_id || null
      const token = config?.access_token || process.env.WHATSAPP_TOKEN || ''
      const phoneId = phoneNumberId || process.env.WHATSAPP_PHONE_ID || ''
      const nomeClinica = config?.nome_exibicao || 'Clinica MedIA'

      const conversa = await getOuCriarConversa(telefone, nomeContato, medicoId, phoneId)
      if (!conversa) continue

      await supabase.from('whatsapp_mensagens').insert({ conversa_id: conversa.id, tipo: 'recebida', conteudo: texto, metadata: { wamid: msg.id } })

      const [historico, contexto] = await Promise.all([
        getHistorico(conversa.id),
        getContextoPaciente(conversa.paciente_id)
      ])
      const horarios = medicoId ? await getHorariosLivres(medicoId) : []
      const { texto: resposta, agendarData } = await processarComIA(texto, historico, contexto, horarios, nomeClinica)

      if (agendarData && medicoId) {
        await supabase.from('agendamentos').insert({ medico_id: medicoId, paciente_id: conversa.paciente_id, data_hora: agendarData.data, tipo: 'consulta', motivo: agendarData.motivo, status: 'agendado' })
      }

      await supabase.from('whatsapp_mensagens').insert({ conversa_id: conversa.id, tipo: 'enviada', conteudo: resposta, metadata: { ia: true } })
      await supabase.from('whatsapp_conversas').update({ ultimo_contato: new Date().toISOString() }).eq('id', conversa.id)
      await enviarMensagem(telefone, resposta, token, phoneId)
    }
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
