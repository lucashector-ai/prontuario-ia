import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const { telefone, texto, medico_id } = await req.json()

    // Busca token e phone_id do medico no banco
    const { data: config } = await supabase
      .from('whatsapp_config')
      .select('access_token, phone_number_id')
      .eq('medico_id', medico_id)
      .eq('ativo', true)
      .single()

    const token = config?.access_token || process.env.WHATSAPP_TOKEN
    const phoneId = config?.phone_number_id || process.env.WHATSAPP_PHONE_ID

    if (!token || !phoneId) {
      return NextResponse.json({ error: 'WhatsApp nao configurado para este medico' }, { status: 400 })
    }

    const r = await fetch('https://graph.facebook.com/v20.0/' + phoneId + '/messages', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to: telefone, type: 'text', text: { body: texto } })
    })
    const data = await r.json()
    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
