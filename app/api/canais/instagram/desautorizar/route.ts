import { NextRequest, NextResponse } from 'next/server'
import { supabaseServidor as db } from '@/lib/servidor'
import { lerSignedRequest } from '@/lib/meta/signed-request'

/** A pessoa removeu o Clinical 360 do Instagram: desconecta a conta. */
export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null)
  const dados = lerSignedRequest(String(form?.get('signed_request') || ''))
  if (!dados?.user_id) return NextResponse.json({ error: 'pedido inválido' }, { status: 400 })
  await db.from('canais_conectados').update({ status: 'desconectado', access_token: null, atualizado_em: new Date().toISOString() })
    .eq('canal', 'instagram').eq('conta_id', String(dados.user_id))
  return NextResponse.json({ ok: true })
}
