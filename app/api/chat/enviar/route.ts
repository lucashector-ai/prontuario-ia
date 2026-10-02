import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { enviarWhatsApp } from '@/lib/whatsapp/enviar'

/**
 * Envio unificado do Chat: decide o canal pela conversa.
 *   whatsapp  → Cloud API  POST /{phone_number_id}/messages (token da whatsapp_config ou env)
 *   instagram → Graph      POST /me/messages com token da página (env INSTAGRAM_TOKEN)
 *   messenger → Graph      POST /me/messages com token da página (env MESSENGER_TOKEN)
 * A mensagem já foi gravada no banco pelo cliente; aqui só entregamos ao canal.
 */
export async function POST(req: NextRequest) {
  try {
    const { conversa_id, texto } = await req.json()
    if (!conversa_id || !texto) return NextResponse.json({ error: 'conversa_id e texto são obrigatórios' }, { status: 400 })

    const { data: conversa } = await supabase
      .from('whatsapp_conversas').select('id, telefone, medico_id, canal, bloqueada').eq('id', conversa_id).single()
    if (!conversa) return NextResponse.json({ error: 'Conversa não encontrada' }, { status: 404 })
    if (conversa.bloqueada) return NextResponse.json({ error: 'Contato bloqueado' }, { status: 403 })

    const canal = conversa.canal || 'whatsapp'

    if (canal === 'instagram' || canal === 'messenger') {
      const token = canal === 'instagram'
        ? process.env.INSTAGRAM_TOKEN
        : (process.env.MESSENGER_TOKEN || process.env.WHATSAPP_TOKEN)
      if (!token) return NextResponse.json({ error: `${canal === 'instagram' ? 'Instagram' : 'Messenger'} não configurado` }, { status: 400 })
      const r = await fetch('https://graph.facebook.com/v20.0/me/messages?access_token=' + encodeURIComponent(token), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient: { id: conversa.telefone }, message: { text: texto }, messaging_type: 'RESPONSE' }),
      })
      const data = await r.json()
      if (!r.ok) return NextResponse.json({ error: data?.error?.message || 'Falha ao enviar' }, { status: 502 })
      return NextResponse.json({ ok: true, canal, data })
    }

    // WhatsApp (padrão) — helper compartilhado (credenciais da clínica ou env)
    const r = await enviarWhatsApp({ medicoId: conversa.medico_id, telefone: conversa.telefone, texto })
    if (!r.ok) return NextResponse.json({ error: r.erro || 'Falha ao enviar' }, { status: r.erro === 'WhatsApp não configurado' ? 400 : 502 })
    return NextResponse.json({ ok: true, canal: 'whatsapp', wamid: r.wamid })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
