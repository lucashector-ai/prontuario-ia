import { NextResponse } from 'next/server'
import { DeepgramClient } from '@deepgram/sdk'

export async function POST() {
  try {
    const apiKey = process.env.DEEPGRAM_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'DEEPGRAM_API_KEY não configurada' }, { status: 500 })
    }

    // Cliente autenticado com API key pra gerar token efêmero
    const authClient = new DeepgramClient({ apiKey })
    const tokenResponse = await authClient.auth.v1.tokens.grant()

    if (!tokenResponse?.access_token) {
      console.error('[deepgram-token] token não retornado')
      return NextResponse.json({ error: 'falha ao gerar token' }, { status: 500 })
    }

    return NextResponse.json({
      access_token: tokenResponse.access_token,
      expires_in: (tokenResponse as any).expires_in ?? 30,
    })
  } catch (e: any) {
    console.error('[deepgram-token] exception:', e?.message || e)
    return NextResponse.json({ error: e?.message || 'erro desconhecido' }, { status: 500 })
  }
}
