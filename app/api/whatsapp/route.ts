import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'media_whatsapp_2026'

// Valores fixos das env vars - nao depende do banco
const WPP_TOKEN = process.env.WHATSAPP_TOKEN || ''
const WPP_PHONE_ID = process.env.WHATSAPP_PHONE_ID || '1030374870164992'
const MEDICO_ID_FALLBACK = process.env.WHATSAPP_MEDICO_ID || ''

const PROMPT_SOFIA = `Voce e Sofia, assistente virtual da clinica. Seja calorosa e profissional. Responda SEMPRE em portugues.

Como posso te ajudar hoje?
*1* - Agendar consulta
*2* - Ver meus agendamentos
*3* - Tirar uma duvida
*4* - Falar com atendente

REGRAS:
- Para agendar: use [AGENDAR:{"data":"YYYY-MM-DDTHH:mm:00","motivo":"motivo"}]
- Para transferir: use [HUMANO]
- NUNCA de diagnosticos ou prescreva medicamentos
- Emergencias: ligue 192 (SAMU)`

function normalizarTel(tel: string): string {
  return tel.replace(/[^0-9]/g, '')
}

async function getWppCredentials(medicoId: string): Promise<{token: string, phoneId: string}> {
  try {
    const { data } = await supabase.from('whatsapp_config').select('access_token, phone_number_id').eq('medico_id', medicoId).single()
    const token = (data as any)?.access_token || WPP_TOKEN
    const phoneId = (data as any)?.phone_number_id || WPP_PHONE_ID
    console.log('CREDS_DB:', phoneId, 'token_start:', token?.substring(0, 20), 'len:', token?.length)
    return { token, phoneId }
  } catch (e) {
    console.error('getWppCredentials error:', e)
    return { token: WPP_TOKEN, phoneId: WPP_PHONE_ID }
  }
}

async function enviarWpp(para: string, texto: string, token?: string, phoneId?: string) {
  const t = token || WPP_TOKEN
  const pid = phoneId || WPP_PHONE_ID
  try {
    const r = await fetch('https://graph.facebook.com/v20.0/' + pid + '/messages', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + t, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to: para, type: 'text', text: { body: texto } })
    })
    const d = await r.json()
    console.log('WPP_SEND:', JSON.stringify(d).substring(0, 300))
    return d
  } catch (e) { console.error('WPP_ERR:', e) }
}

async function getOuCriarConversa(telefone: string, nome: string, MEDICO_ID: string) {
  const tel = normalizarTel(telefone)
  const { data: existente } = await supabase
    .from('whatsapp_conversas')
    .select('*')
    .eq('telefone', tel)
    .eq('medico_id', MEDICO_ID)
    .maybeSingle()

  if (existente) {
    await supabase.from('whatsapp_conversas')
      .update({ ultimo_contato: new Date().toISOString(), nome_contato: nome || existente.nome_contato })
      .eq('id', existente.id)
    console.log('CONVERSA_EXISTENTE:', existente.id)
    return existente
  }

  const { data: nova, error } = await supabase.from('whatsapp_conversas').insert({
    telefone: tel, nome_contato: nome || tel,
    medico_id: MEDICO_ID, status: 'ativa', modo: 'ia',
    onboarding_completo: true, onboarding_step: null,
  }).select().single()

  console.log('CONVERSA_NOVA:', nova?.id, 'erro:', error?.message, 'code:', error?.code)
  if (error) {
    // Tenta buscar novamente caso seja conflito de unique
    const { data: retry } = await supabase.from('whatsapp_conversas').select('*').eq('telefone', tel).eq('medico_id', MEDICO_ID).maybeSingle()
    console.log('RETRY_BUSCA:', retry?.id || 'null')
    return retry
  }
  return nova
}

async function getHistorico(conversaId: string) {
  const { data } = await supabase.from('whatsapp_mensagens')
    .select('tipo, conteudo')
    .eq('conversa_id', conversaId)
    .order('criado_em', { ascending: false })
    .limit(15)
  return (data || []).reverse()
}

async function salvarEEnviar(conversaId: string, texto: string, telefone: string) {
  await supabase.from('whatsapp_mensagens').insert({
    conversa_id: conversaId, tipo: 'enviada', conteudo: texto, metadata: { ia: true }
  })
  await supabase.from('whatsapp_conversas')
    .update({ ultimo_contato: new Date().toISOString() })
    .eq('id', conversaId)
  await enviarWpp(telefone, texto)
}

async function processarIA(mensagem: string, historico: any[]) {
  const msgs = historico.slice(-10).map((h: any) => ({
    role: h.tipo === 'recebida' ? 'user' as const : 'assistant' as const,
    content: h.conteudo
  }))
  msgs.push({ role: 'user', content: mensagem })

  const res = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514', max_tokens: 400,
    system: PROMPT_SOFIA, messages: msgs
  })

  const texto = res.content[0].type === 'text' ? res.content[0].text : ''
  const humano = texto.includes('[HUMANO]')
  const agendarMatch = texto.match(/\[AGENDAR:({[^}]+})\]/)

  return {
    texto: texto.replace(/\[AGENDAR:[^\]]+\]/g, '').replace('[HUMANO]', '').trim(),
    humano,
    agendarData: agendarMatch ? JSON.parse(agendarMatch[1]) : null,
  }
}

async function getMedicoId(phoneNumberId: string): Promise<string> {
  if (!phoneNumberId) return MEDICO_ID_FALLBACK
  try {
    const { createClient } = await import('@supabase/supabase-js')
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data } = await admin
      .from('whatsapp_config')
      .select('medico_id')
      .eq('phone_number_id', phoneNumberId)
      .maybeSingle()
    console.log('getMedicoId:', phoneNumberId, '->', (data as any)?.medico_id)
    return (data as any)?.medico_id || MEDICO_ID_FALLBACK
  } catch (e) {
    console.error('getMedicoId error:', e)
    return MEDICO_ID_FALLBACK
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
    if (!value || value.statuses) return NextResponse.json({ ok: true })

    const messages = value?.messages
    if (!messages?.length) return NextResponse.json({ ok: true })

    const phoneNumberId = value.metadata?.phone_number_id
    const MEDICO_ID = await getMedicoId(phoneNumberId)
    if (!MEDICO_ID) { console.log('Nenhum medico para phone_number_id:', phoneNumberId); return NextResponse.json({ ok: true }) }

    console.log('WEBHOOK_OK medico:', MEDICO_ID, 'msgs:', messages.length)

    for (const msg of messages) {
      if (msg.type !== 'text') continue
      const telefone = msg.from
      const texto = msg.text?.body || ''
      const nome = value.contacts?.[0]?.profile?.name || telefone

      console.log('MSG:', telefone, texto.substring(0, 50))

      const conversa = await getOuCriarConversa(telefone, nome, MEDICO_ID)
      if (!conversa) { console.log('ERRO: sem conversa'); continue }

      // Salva mensagem recebida
      await supabase.from('whatsapp_mensagens').insert({
        conversa_id: conversa.id, tipo: 'recebida', conteudo: texto,
        metadata: { wamid: msg.id }
      })

      // Acumula respostas de pre-consulta no proximo agendamento do paciente
      const { data: agPre } = await supabase
        .from('agendamentos')
        .select('id, pre_consulta_contexto')
        .eq('medico_id', MEDICO_ID)
        .eq('pre_consulta_enviada', true)
        .gte('data_hora', new Date().toISOString())
        .order('data_hora')
        .limit(1)
        .maybeSingle()

      if (agPre) {
        const atual = (agPre as any).pre_consulta_contexto || ''
        await supabase.from('agendamentos')
          .update({ pre_consulta_contexto: atual ? atual + '\n' + texto : texto })
          .eq('id', (agPre as any).id)
      }

      // Verifica se tem agendamento com pré-consulta enviada para este paciente
      const { data: agendPreConsulta } = await supabase
        .from('agendamentos')
        .select('id, pre_consulta_contexto')
        .eq('medico_id', MEDICO_ID)
        .eq('pre_consulta_enviada', true)
        .gte('data_hora', new Date().toISOString())
        .order('data_hora')
        .limit(1)
        .maybeSingle()

      if (agendPreConsulta) {
        const contextoAtual = agendPreConsulta.pre_consulta_contexto || ''
        const novoContexto = contextoAtual + (contextoAtual ? '\n' : '') + texto
        await supabase.from('agendamentos')
          .update({ pre_consulta_contexto: novoContexto })
          .eq('id', agendPreConsulta.id)
      }

      console.log('MODO:', conversa.modo)
      if (conversa.modo === 'humano') continue

      const historico = await getHistorico(conversa.id)
      const { texto: resposta, humano, agendarData } = await processarIA(texto, historico)
      console.log('RESPOSTA_IA:', resposta?.substring(0, 80), 'humano:', humano)
      const creds = await getWppCredentials(MEDICO_ID)
      console.log('CREDS:', creds.phoneId, 'token_len:', creds.token?.length || 0)

      if (agendarData) {
        await supabase.from('agendamentos').insert({
          medico_id: MEDICO_ID, paciente_id: conversa.paciente_id,
          data_hora: agendarData.data, tipo: 'consulta',
          motivo: agendarData.motivo, status: 'agendado'
        })
      }

      if (humano) {
        await supabase.from('whatsapp_conversas').update({ modo: 'humano' }).eq('id', conversa.id)
      }

      await salvarEEnviar(conversa.id, resposta, telefone)
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('WEBHOOK_ERROR:', e.message)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
