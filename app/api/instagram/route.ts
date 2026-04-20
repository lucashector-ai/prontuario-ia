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

async function getMedicoId(): Promise<string> {
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
  const body = await req.json()
  
  if (body.object !== 'instagram' && body.object !== 'page') {
    return NextResponse.json({ ok: true })
  }

  for (const entry of body.entry || []) {
    for (const event of entry.messaging || []) {
      try {
        if (!event.message || event.message.is_echo) continue

        const senderId = event.sender?.id
        const pageId = event.recipient?.id || entry.id
        const texto = event.message?.text || ''
        if (!texto.trim() || !senderId) continue

        console.log('IG_STEP1', senderId, pageId)

        const MEDICO_ID = await getMedicoId()
        console.log('IG_STEP2 medico:', MEDICO_ID?.substring(0,8))
        if (!MEDICO_ID) continue

        let { data: conversa } = await supabase
          .from('whatsapp_conversas')
          .select('*')
          .eq('telefone', senderId)
          .eq('medico_id', MEDICO_ID)
          .eq('canal', 'instagram')
          .maybeSingle()

        console.log('IG_STEP3 conversa:', conversa?.id?.substring(0,8) || 'nova')

        if (!conversa) {
          const { data: nova, error: errNova } = await supabase
            .from('whatsapp_conversas')
            .insert({
              medico_id: MEDICO_ID, telefone: senderId, nome_contato: senderId,
              modo: 'ia', status: 'ativa', canal: 'instagram',
              ultimo_contato: new Date().toISOString()
            }).select().single()
          if (errNova) { console.error('IG_CONV_ERROR:', errNova.message); continue }
          conversa = nova
        }

        if (!conversa) continue

        await supabase.from('whatsapp_mensagens').insert({
          conversa_id: conversa.id, tipo: 'recebida', conteudo: texto,
          metadata: { canal: 'instagram' }
        })

        if (conversa.modo === 'humano') continue

        console.log('IG_STEP4 chamando Claude')

        const { data: hist } = await supabase
          .from('whatsapp_mensagens')
          .select('tipo, conteudo')
          .eq('conversa_id', conversa.id)
          .order('criado_em', { ascending: true })
          .limit(10)

        const msgs: {role:'user'|'assistant', content:string}[] = (hist||[]).map((h:any) => ({
          role: (h.tipo==='enviada'?'assistant':'user') as 'user'|'assistant',
          content: h.conteudo as string
        }))

        const aiRes = await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 300,
          system: 'Voce e Sofia, assistente da clinica. Responda em portugues. Seja breve. Sem botoes. Para transferir: [HUMANO]',
          messages: [...msgs, { role: 'user', content: texto }]
        })

        let resposta = aiRes.content[0].type==='text' ? aiRes.content[0].text : 'Olá! Como posso ajudar?'
        resposta = resposta.replace('[HUMANO]','').replace(/\[BOTOES:[^\]]+\]/g,'').trim()

        console.log('IG_STEP5 salvando e enviando')

        await supabase.from('whatsapp_mensagens').insert({
          conversa_id: conversa.id, tipo: 'enviada', conteudo: resposta,
          metadata: { ia: true, canal: 'instagram' }
        })
        await supabase.from('whatsapp_conversas').update({ ultimo_contato: new Date().toISOString() }).eq('id', conversa.id)

        if (!IG_TOKEN) { console.error('IG: sem token'); continue }

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
        else console.log('IG_SEND_OK:', igData.message_id)

      } catch(e:any) {
        console.error('IG_EVENT_ERROR:', e.message)
      }
    }
  }

  return NextResponse.json({ ok: true })
}
