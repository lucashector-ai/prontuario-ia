import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabase } from '@/lib/supabase'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'media_whatsapp_2026'

const PROMPT_PADRAO = `Voce e Sofia, assistente virtual da clinica. Seja simpatica, objetiva e profissional. Responda SEMPRE em portugues.

FLUXO DE ATENDIMENTO:
1. Na primeira mensagem, envie boas-vindas e o menu principal
2. Guie o paciente pelas opcoes numeradas
3. Nunca fique sem responder - sempre ofeca uma proxima acao

MENU PRINCIPAL (envie quando paciente iniciar ou digitar "menu"):
Ola! Sou a Sofia, assistente virtual da clinica. Como posso ajudar? 😊

*1* - Agendar consulta
*2* - Ver meus agendamentos
*3* - Cancelar/remarcar consulta
*4* - Duvidas sobre a clinica
*5* - Falar com atendente

REGRAS:
- Para opcao 1: pergunte nome completo, depois sugira horarios disponiveis
- Para opcao 2: informe os agendamentos cadastrados do paciente
- Para opcao 3: pergunte qual consulta deseja cancelar/remarcar
- Para opcao 4: responda sobre horarios (seg-sex 8h-18h), endereco e convenios
- Para opcao 5: avise que um atendente entrara em contato em breve
- NUNCA de diagnosticos ou orientacoes medicas
- Para emergencias: "Ligue 192 (SAMU) ou va ao pronto-socorro mais proximo"
- Se nao entender: repita o menu principal
- Para confirmar agendamento inclua no final: [AGENDAR:{"data":"YYYY-MM-DDTHH:mm:00","motivo":"motivo"}]`

async function getConfig(phoneNumberId: string) {
  const { data } = await supabase
    .from('whatsapp_config')
    .select('*')
    .eq('phone_number_id', phoneNumberId)
    .eq('ativo', true)
    .single()
  return data
}

async function enviar(para: string, texto: string, token: string, phoneId: string) {
  const r = await fetch('https://graph.facebook.com/v20.0/' + phoneId + '/messages', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to: para, type: 'text', text: { body: texto } })
  })
  return r.json()
}

async function getOuCriarConversa(telefone: string, nome: string, medicoId: string | null) {
  const query = supabase.from('whatsapp_conversas').select('*').eq('telefone', telefone)
  if (medicoId) query.eq('medico_id', medicoId)
  const { data: existente } = await query.single()

  if (existente) {
    await supabase.from('whatsapp_conversas').update({ ultimo_contato: new Date().toISOString(), nome_contato: nome || existente.nome_contato }).eq('id', existente.id)
    return existente
  }
  const { data: paciente } = medicoId
    ? await supabase.from('pacientes').select('id').eq('telefone', telefone).eq('medico_id', medicoId).single()
    : { data: null }

  const { data: nova } = await supabase.from('whatsapp_conversas').insert({
    telefone, nome_contato: nome, paciente_id: paciente?.id, medico_id: medicoId, status: 'ativa'
  }).select().single()
  return nova
}

async function getHistorico(conversaId: string) {
  const { data } = await supabase.from('whatsapp_mensagens').select('tipo, conteudo').eq('conversa_id', conversaId).order('criado_em', { ascending: false }).limit(20)
  return (data || []).reverse()
}

async function getContexto(conversaId: string, pacienteId: string | null, medicoId: string | null) {
  const isNova = !(await supabase.from('whatsapp_mensagens').select('id').eq('conversa_id', conversaId).limit(1)).data?.length

  let paciente = null, agendamentos: any[] = [], horarios: string[] = []

  if (pacienteId) {
    const [{ data: p }, { data: ag }] = await Promise.all([
      supabase.from('pacientes').select('nome, alergias, comorbidades').eq('id', pacienteId).single(),
      supabase.from('agendamentos').select('data_hora, motivo, status').eq('paciente_id', pacienteId).gte('data_hora', new Date().toISOString()).order('data_hora').limit(3)
    ])
    paciente = p; agendamentos = ag || []
  }

  if (medicoId) {
    const agora = new Date()
    const em7dias = new Date(agora.getTime() + 7 * 24 * 60 * 60 * 1000)
    const { data: ocupados } = await supabase.from('agendamentos').select('data_hora').eq('medico_id', medicoId).gte('data_hora', agora.toISOString()).lte('data_hora', em7dias.toISOString()).neq('status', 'cancelado')
    const ocupadosSet = new Set((ocupados || []).map((a: any) => a.data_hora.substring(0, 16)))
    for (let d = 1; d <= 7; d++) {
      const dia = new Date(agora); dia.setDate(dia.getDate() + d)
      if (dia.getDay() === 0) continue
      for (const hora of [8, 9, 10, 11, 14, 15, 16, 17]) {
        dia.setHours(hora, 0, 0, 0)
        if (!ocupadosSet.has(dia.toISOString().substring(0, 16))) {
          horarios.push(dia.toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }))
          if (horarios.length >= 8) break
        }
      }
      if (horarios.length >= 8) break
    }
  }

  return { isNova, paciente, agendamentos, horarios }
}

async function processarComIA(mensagem: string, historico: any[], contexto: any, config: any) {
  const { isNova, paciente, agendamentos, horarios } = contexto
  const sofiaPrompt = config?.sofia_prompt || PROMPT_PADRAO
  const nomeClinica = config?.nome_exibicao || 'Clinica MedIA'

  const systemPrompt = sofiaPrompt + `

CONTEXTO ATUAL:
- Clinica: ${nomeClinica}
- Paciente identificado: ${paciente?.nome || 'Nao identificado'}
- Agendamentos proximos: ${agendamentos.length > 0 ? agendamentos.map((a: any) => new Date(a.data_hora).toLocaleString('pt-BR') + ' - ' + a.motivo).join(', ') : 'Nenhum'}
- Horarios disponiveis: ${horarios.length > 0 ? horarios.join(', ') : 'Consultar por telefone'}
- E a primeira mensagem desta conversa: ${isNova ? 'SIM - envie boas-vindas e o menu' : 'NAO - continue o contexto'}

INSTRUCAO: Responda de forma natural e continue o fluxo. Se for primeira mensagem, envie o menu completo.`

  const messages = historico.slice(-15).map((h: any) => ({
    role: h.tipo === 'recebida' ? 'user' as const : 'assistant' as const,
    content: h.conteudo
  }))
  messages.push({ role: 'user', content: mensagem })

  const response = await anthropic.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 600,
    system: systemPrompt,
    messages
  })

  const texto = response.content[0].type === 'text' ? response.content[0].text : ''
  const match = texto.match(/\[AGENDAR:({[^}]+})\]/)
  return {
    texto: texto.replace(/\[AGENDAR:[^\]]+\]/g, '').trim(),
    agendarData: match ? JSON.parse(match[1]) : null
  }
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
    const config = await getConfig(phoneNumberId)

    // Se sofia estiver pausada, apenas salva a mensagem sem responder
    if (config?.sofia_ativo === false) {
      for (const msg of messages) {
        if (msg.type !== 'text') continue
        const conversa = await getOuCriarConversa(msg.from, value.contacts?.[0]?.profile?.name || '', config?.medico_id || null)
        if (conversa) await supabase.from('whatsapp_mensagens').insert({ conversa_id: conversa.id, tipo: 'recebida', conteudo: msg.text?.body || '', metadata: { wamid: msg.id } })
      }
      return NextResponse.json({ ok: true })
    }

    for (const msg of messages) {
      if (msg.type !== 'text') continue
      const telefone = msg.from
      const texto = msg.text?.body || ''
      const nomeContato = value.contacts?.[0]?.profile?.name || ''
      const medicoId = config?.medico_id || null
      const token = config?.access_token || process.env.WHATSAPP_TOKEN || ''
      const phoneId = phoneNumberId || process.env.WHATSAPP_PHONE_ID || ''

      const conversa = await getOuCriarConversa(telefone, nomeContato, medicoId)
      if (!conversa) continue

      await supabase.from('whatsapp_mensagens').insert({ conversa_id: conversa.id, tipo: 'recebida', conteudo: texto, metadata: { wamid: msg.id } })

      const [historico, contexto] = await Promise.all([
        getHistorico(conversa.id),
        getContexto(conversa.id, conversa.paciente_id, medicoId)
      ])

      const { texto: resposta, agendarData } = await processarComIA(texto, historico, contexto, config)

      if (agendarData && medicoId) {
        await supabase.from('agendamentos').insert({
          medico_id: medicoId, paciente_id: conversa.paciente_id,
          data_hora: agendarData.data, tipo: 'consulta',
          motivo: agendarData.motivo, status: 'agendado'
        })
      }

      await supabase.from('whatsapp_mensagens').insert({ conversa_id: conversa.id, tipo: 'enviada', conteudo: resposta, metadata: { ia: true, agendou: !!agendarData } })
      await supabase.from('whatsapp_conversas').update({ ultimo_contato: new Date().toISOString() }).eq('id', conversa.id)
      await enviar(telefone, resposta, token, phoneId)
    }
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('Webhook error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
