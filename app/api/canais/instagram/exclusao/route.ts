import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'node:crypto'
import { supabaseServidor as db } from '@/lib/servidor'
import { lerSignedRequest } from '@/lib/meta/signed-request'

/**
 * Pedido de exclusão de dados (exigência da Meta/LGPD): apaga o acesso à conta do Instagram.
 * Conversas com pacientes ficam com a clínica (prontuário/atendimento), como a política descreve.
 */
export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null)
  const dados = lerSignedRequest(String(form?.get('signed_request') || ''))
  if (!dados?.user_id) return NextResponse.json({ error: 'pedido inválido' }, { status: 400 })
  await db.from('canais_conectados').delete().eq('canal', 'instagram').eq('conta_id', String(dados.user_id))
  const codigo = randomBytes(6).toString('hex')
  return NextResponse.json({ url: `${req.nextUrl.origin}/privacidade?exclusao=${codigo}`, confirmation_code: codigo })
}
