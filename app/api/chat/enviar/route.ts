import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { enviarWhatsApp } from '@/lib/whatsapp/enviar'
import { enviarMensagemSocial, tokenDaConversa } from '@/lib/meta/mensageria'

/**
 * Envio unificado do Chat: decide o canal pela conversa.
 *   whatsapp  → Cloud API  POST /{phone_number_id}/messages (token da whatsapp_config ou env)
 *   instagram/messenger → POST /me/messages com o token da página conectada pela clínica
 * A mensagem já foi gravada no banco pelo cliente; aqui só entregamos ao canal.
 */
export async function POST(req: NextRequest) {
  try {
    const { conversa_id, texto } = await req.json()
    if (!conversa_id || !texto) return NextResponse.json({ error: 'conversa_id e texto são obrigatórios' }, { status: 400 })

    let { data: conversa, error: errConv } = await supabase
      .from('whatsapp_conversas').select('id, telefone, medico_id, canal, canal_conta_id, bloqueada').eq('id', conversa_id).single()
    if (errConv && /canal_conta_id/.test(errConv.message)) {
      // banco sem a migration 0017
      ({ data: conversa } = await supabase.from('whatsapp_conversas').select('id, telefone, medico_id, canal, bloqueada').eq('id', conversa_id).single() as any)
    }
    if (!conversa) return NextResponse.json({ error: 'Conversa não encontrada' }, { status: 404 })
    if (conversa.bloqueada) return NextResponse.json({ error: 'Contato bloqueado' }, { status: 403 })

    const canal = conversa.canal || 'whatsapp'

    if (canal === 'instagram' || canal === 'messenger') {
      const token = await tokenDaConversa(conversa as any)
      const nomeCanal = canal === 'instagram' ? 'Instagram' : 'Messenger'
      if (!token) return NextResponse.json({ error: `${nomeCanal} não conectado. Conecte em Minha clínica → Canais.` }, { status: 400 })
      try {
        const data = await enviarMensagemSocial(token, conversa.telefone, texto)
        return NextResponse.json({ ok: true, canal, data })
      } catch (e: any) {
        const m = String(e?.message || '')
        // Meta só permite responder até 24h depois da última mensagem do contato
        const fora = /outside of allowed window|24 ?hour/i.test(m)
        return NextResponse.json({ error: fora ? 'Passou de 24h desde a última mensagem do contato — a Meta não permite responder por aqui.' : (m || 'Falha ao enviar') }, { status: 502 })
      }
    }

    // WhatsApp (padrão) — helper compartilhado (credenciais da clínica ou env)
    const r = await enviarWhatsApp({ medicoId: conversa.medico_id, telefone: conversa.telefone, texto })
    if (!r.ok) return NextResponse.json({ error: r.erro || 'Falha ao enviar' }, { status: r.erro === 'WhatsApp não configurado' ? 400 : 502 })
    return NextResponse.json({ ok: true, canal: 'whatsapp', wamid: r.wamid })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
