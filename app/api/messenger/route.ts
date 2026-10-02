import { NextRequest, NextResponse } from 'next/server'
import { log } from '@/lib/logger'
import { assinaturaValida } from '@/lib/meta/graph'
import { processarWebhookSocial } from '@/lib/meta/mensageria'

export const maxDuration = 60

/**
 * Webhook da Meta (Instagram e Messenger usam o mesmo processador).
 * A clínica é descoberta pela conta que recebeu a mensagem — ver lib/meta/mensageria.ts.
 */
const VERIFY_TOKEN = process.env.META_VERIFY_TOKEN || process.env.WHATSAPP_VERIFY_TOKEN || ''

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams
  if (VERIFY_TOKEN && p.get('hub.mode') === 'subscribe' && p.get('hub.verify_token') === VERIFY_TOKEN) {
    return new Response(p.get('hub.challenge') || '', { status: 200 })
  }
  return NextResponse.json({ error: 'Invalid token' }, { status: 403 })
}

export async function POST(req: NextRequest) {
  const bruto = await req.text()
  if (!assinaturaValida(bruto, req.headers.get('x-hub-signature-256'))) {
    log.warn('[webhook social] assinatura inválida')
    return NextResponse.json({ error: 'assinatura inválida' }, { status: 401 })
  }
  try {
    await processarWebhookSocial(JSON.parse(bruto))
  } catch (e: any) {
    log.error('[webhook social]', e?.message || e)
  }
  // Sempre 200: a Meta reenvia (e pode desativar o webhook) se recebe erro
  return NextResponse.json({ ok: true })
}
