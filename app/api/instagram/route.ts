import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'media_whatsapp_2026'
const MEDICO_ID_ENV = process.env.WHATSAPP_MEDICO_ID || ''
const IG_TOKEN = process.env.INSTAGRAM_TOKEN || ''

async function getMedicoIdFallback(): Promise<string> {
  if (MEDICO_ID_ENV) return MEDICO_ID_ENV
  const { data } = await supabase.from('medicos').select('id').eq('ativo', true).limit(1).maybeSingle()
  return (data as any)?.id || ''
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  if (searchParams.get('hub.verify_token') === VERIFY_TOKEN) {
    return new Response(searchParams.get('hub.challenge') || '', { status: 200 })
  }
  return NextResponse.json({ error: 'Invalid token' }, { status: 403 })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    if (body.object !== 'instagram' && body.object !== 'page') {
      return NextResponse.json({ ok: true })
    }

    // Processa de forma síncrona com max 25s
    await processarInstagram(body)
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('INSTAGRAM_ERROR:', e.message)
    return NextResponse.json({ ok: true })
  }
}

async function processarInstagram(body: any) {
  for (const entry of body.entry || []) {
    for (const event of entry.messaging || []) {
      if (!event.message || event.message.is_echo) continue

      const senderId = event.sender?.id
      const pageId = event.recipient?.id || entry.id
      const texto = event.message?.text || ''

      if (!texto.trim() || !senderId) continue

      console.log('IG_PROCESS:', { senderId, pageId, texto: texto.substring(0, 40) })

      console.log('IG_STEP1')
      const MEDICO_ID = await getMedicoIdFallback()
      console.log('IG_STEP2:', MEDICO_ID?.substring(0,8))
      if (!MEDICO_ID) { console.error('IG: sem medico_id'); continue }

      let { data: conversa } = await supabase
        .from('whatsapp_conversas')
        .select('*')
        .eq('telefone', senderId)
        .eq('medico_id', MEDICO_ID)
        .eq('canal', 'instagram')
        .maybeSingle()

      if (!conversa) {
        const { data: nova } = await supabase
          .from('whatsapp_conversas')
          .insert({
            medico_id: MEDICO_ID, telefone: senderId, nome_contato: senderId,
            modo: 'ia', status: 'ativa', canal: 'instagram',
            ultimo_contato: new Date().toISOString()
          })
          .select().single()
        conversa = nova
      }

      if (!conversa) continue

      if (conversa.status === 'encerrada') {
        await supabase.from('whatsapp_conversas').update({ status: 'ativa', modo: 'ia' }).eq('id', conversa.id)
        conversa.status = 'ativa'; conversa.modo = 'ia'
      }

      await supabase.from('whatsapp_mensagens').insert({
        conversa_id: conversa.id, tipo: 'recebida', conteudo: texto,
        metadata: { canal: 'instagram' }
      })
      await supabase.from('whatsapp_conversas').update({ ultimo_contato: new Date().toISOString() }).eq('id', conversa.id)

      if (conversa.modo === 'humano') continue

      const { data: historico } = await supabase
        .from('whatsapp_mensagens')
        .select('tipo, conteudo')
        .eq('conversa_id', conversa.id)
        .order('criado_em', { ascending: true })
        .limit(15)

      const msgs: {role:'user'|'assistant', content:string}[] = (historico || []).map((h: any) => ({
        role: (h.tipo === 'enviada' ? 'assistant' : 'user') as 'user'|'assistant',
        content: h.conteudo as string
      }))

      console.log('IG_STEP3: chamando Claude')
      const aiRes = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        system: `Voce e Sofia, assistente da clinica. Responda em portugues. Seja breve. Use texto simples sem botoes. Para transferir: [HUMANO]`,
        messages: [...msgs, { role: 'user', content: texto }]
      })

      let resposta = aiRes.content[0].type === 'text' ? aiRes.content[0].text : 'Olá! Como posso ajudar?'
      const humano = resposta.includes('[HUMANO]')
      resposta = resposta.replace('[HUMANO]', '').replace(/\[BOTOES:[^\]]+\]/g, '').trim()

      if (humano) await supabase.from('whatsapp_conversas').update({ modo: 'humano' }).eq('id', conversa.id)

      await supabase.from('whatsapp_mensagens').insert({
        conversa_id: conversa.id, tipo: 'enviada', conteudo: resposta,
        metadata: { ia: true, canal: 'instagram' }
      })

      // Envia pelo Instagram
      console.log('IG_STEP4: enviando IG')
      console.log('IG_SEND:', { senderId, pageId, tokenStart: IG_TOKEN.substring(0, 10) })
      const igRes = await fetch(`https://graph.facebook.com/v20.0/${pageId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: { id: senderId },
          message: { text: resposta },
          messaging_type: 'RESPONSE',
          access_token: IG_TOKEN
        })
      })
      const igData = await igRes.json()
      if (igData.error) console.error('IG_SEND_ERROR:', JSON.stringify(igData.error))
      else console.log('IG_SEND_OK:', igData)

      await supabase.from('whatsapp_conversas').update({ ultimo_contato: new Date().toISOString() }).eq('id', conversa.id)
    }
  }
}
