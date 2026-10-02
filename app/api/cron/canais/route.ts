import { NextRequest, NextResponse } from 'next/server'
import { supabaseServidor as db, autorizarCron } from '@/lib/servidor'
import { renovarTokenInstagram } from '@/lib/meta/instagram'
import { log } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Renova os acessos do Instagram (login do Instagram vale 60 dias).
 * Renova quando faltam menos de 20 dias; se falhar, marca o canal como "precisa reconectar".
 */
export async function GET(req: NextRequest) {
  const negado = autorizarCron(req); if (negado) return negado
  const { data, error } = await db.from('canais_conectados').select('id, access_token, detalhe')
    .eq('canal', 'instagram').eq('status', 'ativo')
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

  const limite = Date.now() + 20 * 864e5
  let renovados = 0, falhas = 0
  for (const c of (data || []) as any[]) {
    if (c.detalhe?.api !== 'instagram' || !c.access_token) continue
    const expira = c.detalhe?.expira_em ? new Date(c.detalhe.expira_em).getTime() : 0
    if (expira && expira > limite) continue
    try {
      const novo = await renovarTokenInstagram(c.access_token)
      await db.from('canais_conectados').update({
        access_token: novo.token, detalhe: { ...c.detalhe, expira_em: novo.expiraEm }, atualizado_em: new Date().toISOString(),
      }).eq('id', c.id)
      renovados++
    } catch (e: any) {
      falhas++
      log.warn('[cron/canais] renovar instagram', e?.message)
      if (expira && expira < Date.now()) {
        await db.from('canais_conectados').update({ status: 'erro', erro: 'Acesso do Instagram expirou — reconecte', atualizado_em: new Date().toISOString() }).eq('id', c.id)
      }
    }
  }
  return NextResponse.json({ ok: true, renovados, falhas })
}
