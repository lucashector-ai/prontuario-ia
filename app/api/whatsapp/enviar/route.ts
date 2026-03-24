import { NextRequest, NextResponse } from 'next/server'
export async function POST(req: NextRequest) {
  const { telefone, texto } = await req.json()
  const r = await fetch('https://graph.facebook.com/v20.0/' + process.env.WHATSAPP_PHONE_ID + '/messages', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + process.env.WHATSAPP_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to: telefone, type: 'text', text: { body: texto } })
  })
  return NextResponse.json(await r.json())
}
