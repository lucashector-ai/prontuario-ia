import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabase } from '@/lib/supabase'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const PHONE_ID = process.env.WHATSAPP_PHONE_ID
const TOKEN = process.env.WHATSAPP_TOKEN
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN

async function enviarMensagem(para: string, texto: string) {
  await fetch('https://graph.facebook.com/v20.0/' + PHONE_ID + '/messages', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to: para, type: 'text', text: { body: texto } })
  })
}

async function getOuCriarConversa(telefone: string, nome: string) {
  const { data: existente } = await supabase.from('whatsapp_conversas').select('*').eq('telefone', telefone).single()
  if (existente) {
    await supabase.from('whatsapp_conversas').update({ ultimo_contato: new Date().toISOString(), nome_contato: nome || existente.nome_contato }).eq('id', existente.id)
    return existente
  }
  const { data: paciente } = await supabase.from('pacientes').select('id, medico_id').eq('telefone', telefone).single()
  const { data: nova } = await supabase.from('whatsapp_conversas').insert({
    telefone, nome_contato: nome, paciente_id: paciente?.id, medico_id: paciente?.medico_id, status: 'ativa'
  }).select().single()
  return nova
}

async function getHistorico(conversaId: string) {
  const { data } = await supabase.from('whatsapp_mensagens').select('tipo, conteudo, criado_em').eq('conversa_id', conversaId).order('criado_em', { ascending: false }).limit(20)
  return (data || []).reverse()
}

async function getContextoPaciente(pacienteId: string | null) {
  if (!pacienteId) return null
  const [{ data: paciente }, { data: consultas }, { data: agendamentos }] = await Promise.all([
    supabase.from('pacientes').select('*').eq('id', pacienteId).single(),
    supabase.from('consultas').select('subjetivo, avaliacao, plano, cids, criado_em').eq('paciente_id', pacienteId).order('criado_em', { ascending: false }).limit(3),
    supabase.from('agendamentos').select('*').eq('paciente_id', pacienteId).gte('data_hora', new Date().toISOString()).order('data_hora').limit(2),
  ])
  return { paciente, consultas: consultas || [], agendamentos: agendamentos || [] }
}

async function getHorariosLivres(medicoId: string) {
  const agora = new Date()
  const em7dias = new Date(agora.getTime() + 7 * 24 * 60 * 60 * 1000)
  const { data: ocupados } = await supabase.from('agendamentos').select('data_hora').eq('medico_id', medicoId).gte('data_hora', agora.toISOString()).lte('data_hora', em7dias.toISOString()).neq('status', 'cancelado')
  const ocupadosSet = new Set((ocupados || []).map((a: any) => a.data_hora.substring(0, 16)))
  const horarios: string[] = []
  for (let d = 1; d <= 7; d++) {
    const dia = new Date(agora)
    dia.setDate(dia.getDate() + d)
    if (dia.getDay() === 0) continue
    for (const hora of [8, 9, 10, 11, 14, 15, 16, 17]) {
      dia.setHours(hora, 0, 0, 0)
      const key = dia.toISOString().substring(0, 16)
      if (!ocupadosSet.has(key)) {
        horarios.push(dia.toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }))
        if (horarios.length >= 6) break
      }
    }
    if (horarios.length >= 6) break
  }
  return horarios
}

async function processarComIA(mensagem: string, conversa: any, historico: any[], contexto: any, horarios: string[]) {
  const systemPrompt = 'Voce e a assistente virtual da clinica MedIA. Seu nome e Sofia. Responda sempre em portugues. Seja simpatica e objetiva. NUNCA de orientacoes medicas. Para emergencias, oriente ligar 192 (SAMU). Ao confirmar agendamento inclua no final: [AGENDAR:{"data":"YYYY-MM-DDTHH:mm:00","motivo":"motivo"}]. Horarios disponiveis: ' + (horarios.join(', ') || 'Nenhum disponivel') + '. Contexto: ' + (contexto ? JSON.stringify({ nome: contexto.paciente?.nome, proximo: contexto.agendamentos?.[0]?.data_hora }) : 'Paciente nao identificado') + '. Clinica: seg-sex 8h-18h.'
  const messages = historico.slice(-10).map((h: any) => ({ role: h.tipo === 'recebida' ? 'user' as const : 'assistant' as const, content: h.conteudo }))
  messages.push({ role: 'user', content: mensagem })
  const response = await anthropic.messages.create({ model: 'claude-opus-4-5', max_tokens: 400, system: systemPrompt, messages })
  const textoCompleto = response.content[0].type === 'text' ? response.content[0].text : ''
  const agendarMatch = textoCompleto.match(/\[AGENDAR:({[^}]+})\]/)
  const textoLimpo = textoCompleto.replace(/\[AGENDAR:[^\]]+\]/g, '').trim()
  return { texto: textoLimpo, agendarData: agendarMatch ? JSON.parse(agendarMatch[1]) : null }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')
  if (mode === 'subscribe' && token === VERIFY_TOKEN) return new NextResponse(challenge, { status: 200 })
  return new NextResponse('Forbidden', { status: 403 })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const value = body.entry?.[0]?.changes?.[0]?.value
    if (value?.statuses) return NextResponse.json({ ok: true })
    const messages = value?.messages
    if (!messages?.length) return NextResponse.json({ ok: true })
    for (const msg of messages) {
      if (msg.type !== 'text') continue
      const telefone = msg.from
      const texto = msg.text?.body || ''
      const nomeContato = value.contacts?.[0]?.profile?.name || ''
      const conversa = await getOuCriarConversa(telefone, nomeContato)
      if (!conversa) continue
      await supabase.from('whatsapp_mensagens').insert({ conversa_id: conversa.id, tipo: 'recebida', conteudo: texto, metadata: { wamid: msg.id } })
      const [historico, contexto] = await Promise.all([getHistorico(conversa.id), getContextoPaciente(conversa.paciente_id)])
      const medicoId = conversa.medico_id || contexto?.paciente?.medico_id
      const horarios = medicoId ? await getHorariosLivres(medicoId) : []
      const { texto: resposta, agendarData } = await processarComIA(texto, conversa, historico, contexto, horarios)
      if (agendarData && medicoId) {
        await supabase.from('agendamentos').insert({ medico_id: medicoId, paciente_id: conversa.paciente_id, data_hora: agendarData.data, tipo: 'consulta', motivo: agendarData.motivo, status: 'agendado' })
      }
      await supabase.from('whatsapp_mensagens').insert({ conversa_id: conversa.id, tipo: 'enviada', conteudo: resposta, metadata: { ia: true, agendou: !!agendarData } })
      await supabase.from('whatsapp_conversas').update({ ultimo_contato: new Date().toISOString() }).eq('id', conversa.id)
      await enviarMensagem(telefone, resposta)
    }
    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
