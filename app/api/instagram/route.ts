import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'media_whatsapp_2026'
const MEDICO_ID = process.env.WHATSAPP_MEDICO_ID || ''
const IG_TOKEN = process.env.INSTAGRAM_TOKEN || process.env.WHATSAPP_TOKEN || ''
const IG_PAGE_ID = process.env.INSTAGRAM_PAGE_ID || ''

// Envia mensagem pelo Instagram
async function enviarIG(recipientId: string, texto: string) {
  if (!IG_TOKEN || !IG_PAGE_ID) return
  await fetch(`https://graph.facebook.com/v20.0/${IG_PAGE_ID}/messages`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${IG_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: { text: texto },
      messaging_type: 'RESPONSE'
    })
  })
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

    for (const entry of body.entry || []) {
      for (const event of entry.messaging || []) {
        if (!event.message || event.message.is_echo) continue

        const senderId = event.sender.id
        const texto = event.message.text || ''
        if (!texto.trim()) continue

        // Busca nome do usuário no Instagram
        let nomeIG = senderId
        try {
          const profileRes = await fetch(
            `https://graph.facebook.com/v20.0/${senderId}?fields=name&access_token=${IG_TOKEN}`
          )
          const profile = await profileRes.json()
          if (profile.name) nomeIG = profile.name
        } catch {}

        // Cria ou busca conversa
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
              medico_id: MEDICO_ID,
              telefone: senderId,
              nome_contato: nomeIG,
              modo: 'ia',
              status: 'ativa',
              canal: 'instagram',
              ultimo_contato: new Date().toISOString()
            })
            .select().single()
          conversa = nova
        }

        if (!conversa) continue

        // Salva mensagem recebida
        await supabase.from('whatsapp_mensagens').insert({
          conversa_id: conversa.id,
          tipo: 'recebida',
          conteudo: texto,
          metadata: { canal: 'instagram' }
        })

        await supabase.from('whatsapp_conversas')
          .update({ ultimo_contato: new Date().toISOString() })
          .eq('id', conversa.id)

        if (conversa.modo === 'humano') continue

        // Busca histórico e responde com Sofia
        const { data: historico } = await supabase
          .from('whatsapp_mensagens')
          .select('tipo, conteudo')
          .eq('conversa_id', conversa.id)
          .order('criado_em', { ascending: true })
          .limit(20)

        const msgs = (historico || []).map((h: any) => ({
          role: h.tipo === 'enviada' ? 'assistant' : 'user',
          content: h.conteudo
        }))

        const res = await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          system: `Voce e Sofia, assistente virtual da clinica. Seja calorosa e objetiva. Responda em portugues.
          O paciente esta entrando em contato pelo Instagram.
          NUNCA use botoes [BOTOES:...] no Instagram — use texto simples com opcoes numeradas.
          Para transferir para humano: [HUMANO]`,
          messages: [...msgs, { role: 'user', content: texto }]
        })

        let resposta = res.content[0].type === 'text' ? res.content[0].text : ''
        const humano = resposta.includes('[HUMANO]')
        resposta = resposta.replace('[HUMANO]', '').replace(/\[BOTOES:[^\]]+\]/g, '').trim()

        if (humano) {
          await supabase.from('whatsapp_conversas').update({ modo: 'humano' }).eq('id', conversa.id)
        }

        await supabase.from('whatsapp_mensagens').insert({
          conversa_id: conversa.id,
          tipo: 'enviada',
          conteudo: resposta,
          metadata: { ia: true, canal: 'instagram' }
        })

        await enviarIG(senderId, resposta)
        await supabase.from('whatsapp_conversas')
          .update({ ultimo_contato: new Date().toISOString() })
          .eq('id', conversa.id)
      }
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('INSTAGRAM_ERROR:', e.message)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
