import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

// Usa service role para bypassar RLS no webhook (sem autenticacao de usuario)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

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
- Para opcao 5: avise que um atendente entrara em contato em breve e mude modo para humano
- NUNCA de diagnosticos ou orientacoes medicas
- Para emergencias: "Ligue 192 (SAMU) ou va ao pronto-socorro mais proximo"
- Se nao entender: repita o menu principal
- Para confirmar agendamento inclua: [AGENDAR:{"data":"YYYY-MM-DDTHH:mm:00","motivo":"motivo"}]
- Se paciente pedir atendente humano inclua: [HUMANO]`

async function getConfig(phoneNumberId: string) {
  const { data } = await supabase
    .from('whatsapp_config')
    .select('*')
    .eq('phone_number_id', phoneNumberId)
    .eq('ativo', true)
    .single()
  return data
}

async function enviarWpp(para: string, texto: string, token: string, phoneId: string) {
  console.log('Enviando WPP para:', para, 'phoneId:', phoneId)
  try {
    const r = await fetch('https://graph.facebook.com/v20.0/' + phoneId + '/messages', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to: para, type: 'text', text: { body: texto } })
    })
    const d = await r.json()
    console.log('Resultado WPP:', JSON.stringify(d))
    return d
  } catch (e) {
    console.error('Erro ao enviar WPP:', e)
    throw e
  }
}

async function getOuCriarConversa(telefone: string, nome: string, medicoId: string | null) {
  let query = supabase.from('whatsapp_conversas').select('*').eq('telefone', telefone)
  if (medicoId) query = query.eq('medico_id', medicoId)
  const { data: existente } = await query.maybeSingle()

  if (existente) {
    await supabase.from('whatsapp_conversas').update({ ultimo_contato: new Date().toISOString(), nome_contato: nome || existente.nome_contato }).eq('id', existente.id)
    return existente
  }

  const { data: paciente } = medicoId
    ? await supabase.from('pacientes').select('id').eq('telefone', telefone).eq('medico_id', medicoId).maybeSingle()
    : { data: null }

  const { data: nova } = await supabase.from('whatsapp_conversas').insert({
    telefone, nome_contato: nome || telefone, paciente_id: paciente?.id,
    medico_id: medicoId, status: 'ativa', modo: 'ia'
  }).select().single()
  return nova
}

async function getHistorico(conversaId: string) {
  const { data } = await supabase.from('whatsapp_mensagens').select('tipo, conteudo').eq('conversa_id', conversaId).order('criado_em', { ascending: false }).limit(20)
  return (data || []).reverse()
}

async function getContexto(conversaId: string, pacienteId: string | null, medicoId: string | null) {
  const { data: msgs } = await supabase.from('whatsapp_mensagens').select('id').eq('conversa_id', conversaId).limit(1)
  const isNova = !msgs?.length

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

async function processarIA(mensagem: string, historico: any[], contexto: any, config: any) {
  const prompt = config?.sofia_prompt || PROMPT_PADRAO
  const nomeClinica = config?.nome_exibicao || 'Clinica MedIA'

  const system = prompt + `\n\nCONTEXTO:\n- Clinica: ${nomeClinica}\n- Paciente: ${contexto.paciente?.nome || 'Nao identificado'}\n- Agendamentos: ${contexto.agendamentos?.length ? contexto.agendamentos.map((a: any) => new Date(a.data_hora).toLocaleString('pt-BR') + ' - ' + a.motivo).join(', ') : 'Nenhum'}\n- Horarios disponiveis: ${contexto.horarios?.length ? contexto.horarios.join(', ') : 'Consultar por telefone'}\n- Primeira mensagem: ${contexto.isNova ? 'SIM - envie boas-vindas e menu' : 'NAO'}`

  const msgs = historico.slice(-15).map((h: any) => ({ role: h.tipo === 'recebida' ? 'user' as const : 'assistant' as const, content: h.conteudo }))
  msgs.push({ role: 'user', content: mensagem })

  const res = await anthropic.messages.create({ model: 'claude-opus-4-5', max_tokens: 600, system, messages: msgs })
  const texto = res.content[0].type === 'text' ? res.content[0].text : ''
  const agendarMatch = texto.match(/\[AGENDAR:({[^}]+})\]/)
  const humano = texto.includes('[HUMANO]')
  return {
    texto: texto.replace(/\[AGENDAR:[^\]]+\]/g, '').replace('[HUMANO]', '').trim(),
    agendarData: agendarMatch ? JSON.parse(agendarMatch[1]) : null,
    humano
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

    const token = config?.access_token || process.env.WHATSAPP_TOKEN || ''
    const phoneId = config?.phone_number_id || phoneNumberId || process.env.WHATSAPP_PHONE_ID || ''
    const medicoId = config?.medico_id || null

    console.log('Config encontrada:', config ? 'sim' : 'nao', '| phoneNumberId:', phoneNumberId)

    for (const msg of messages) {
      if (msg.type !== 'text') continue
      const telefone = msg.from
      const texto = msg.text?.body || ''
      const nomeContato = value.contacts?.[0]?.profile?.name || telefone

      const conversa = await getOuCriarConversa(telefone, nomeContato, medicoId)
      if (!conversa) continue

      await supabase.from('whatsapp_mensagens').insert({
        conversa_id: conversa.id, tipo: 'recebida', conteudo: texto,
        metadata: { wamid: msg.id, timestamp: msg.timestamp }
      })

      // Se modo humano, apenas salva - nao responde com IA
      if (conversa.modo === 'humano') {
        console.log('Modo humano - nao respondendo com IA')
        continue
      }

      // Se sofia pausada globalmente
      if (config?.sofia_ativo === false) {
        console.log('Sofia pausada - nao respondendo')
        continue
      }

      const [historico, contexto] = await Promise.all([
        getHistorico(conversa.id),
        getContexto(conversa.id, conversa.paciente_id, medicoId)
      ])

      const { texto: resposta, agendarData, humano } = await processarIA(texto, historico, contexto, config)

      // Cria agendamento se necessario
      if (agendarData && medicoId) {
        await supabase.from('agendamentos').insert({
          medico_id: medicoId, paciente_id: conversa.paciente_id,
          data_hora: agendarData.data, tipo: 'consulta',
          motivo: agendarData.motivo, status: 'agendado'
        })
      }

      // Muda para modo humano se IA solicitou
      if (humano) {
        await supabase.from('whatsapp_conversas').update({ modo: 'humano' }).eq('id', conversa.id)
      }

      // Salva resposta e envia
      await supabase.from('whatsapp_mensagens').insert({
        conversa_id: conversa.id, tipo: 'enviada', conteudo: resposta,
        metadata: { ia: true, agendou: !!agendarData }
      })
      await supabase.from('whatsapp_conversas').update({ ultimo_contato: new Date().toISOString() }).eq('id', conversa.id)

      // ENVIA DE VOLTA para o WhatsApp
      await enviarWpp(telefone, resposta, token, phoneId)
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('Webhook error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
