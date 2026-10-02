import { NextRequest, NextResponse } from 'next/server'
import { supabaseServidor as db } from '@/lib/servidor'
import { log } from '@/lib/logger'
import { GET as cronConfirmacoes } from '@/app/api/cron/confirmacoes/route'
import { GET as cronRetornos } from '@/app/api/cron/retornos/route'
import { GET as cronCanais } from '@/app/api/cron/canais/route'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * "Batimento" das automações. O plano Hobby da Vercel só permite cron diário, então
 * o próprio app (AppShell) chama esta rota a cada 15 min enquanto alguém está usando.
 * Cada automação tem um intervalo mínimo e uma trava no banco (automacoes_estado):
 * com 10 abas abertas, ela roda uma vez só. As rotinas em si já são idempotentes.
 */
const AUTOMACOES: { chave: string; intervaloMin: number; executar: (req: NextRequest) => Promise<Response> }[] = [
  { chave: 'confirmacoes', intervaloMin: 14, executar: cronConfirmacoes },
  { chave: 'retornos', intervaloMin: 180, executar: cronRetornos },
  { chave: 'canais', intervaloMin: 720, executar: cronCanais },
]

// Fallback quando a migration 0015 não foi rodada: trava só por instância do servidor.
const memoria = new Map<string, number>()

/** Tenta "pegar a vez" da automação. true = esta chamada deve executar. */
async function reservar(chave: string, intervaloMin: number): Promise<boolean> {
  const agora = new Date()
  const limite = new Date(agora.getTime() - intervaloMin * 60_000).toISOString()
  const { data, error } = await db.from('automacoes_estado')
    .update({ ultima_execucao: agora.toISOString(), atualizado_em: agora.toISOString() })
    .eq('chave', chave).lt('ultima_execucao', limite)
    .select('chave')
  if (!error) {
    if (data?.length) return true
    // Linha ainda não existe? cria já reservada (se outra chamada criou antes, não executa).
    const { data: existe } = await db.from('automacoes_estado').select('chave').eq('chave', chave).maybeSingle()
    if (existe) return false
    const { error: e2 } = await db.from('automacoes_estado').insert({ chave, ultima_execucao: agora.toISOString() })
    return !e2
  }
  const ultima = memoria.get(chave) || 0
  if (agora.getTime() - ultima < intervaloMin * 60_000) return false
  memoria.set(chave, agora.getTime())
  return true
}

async function tick(req: NextRequest) {
  const resultado: Record<string, any> = {}
  for (const a of AUTOMACOES) {
    try {
      if (!(await reservar(a.chave, a.intervaloMin))) { resultado[a.chave] = 'aguardando'; continue }
      // Reaproveita a rota de cron com autorização interna.
      const url = new URL(`/api/cron/${a.chave}`, req.nextUrl.origin)
      const interno = new NextRequest(url, {
        headers: process.env.CRON_SECRET ? { authorization: `Bearer ${process.env.CRON_SECRET}` } : {},
      })
      const r = await a.executar(interno)
      const json = await r.json().catch(() => ({}))
      resultado[a.chave] = json
      await db.from('automacoes_estado').update({ ultimo_resultado: json }).eq('chave', a.chave)
    } catch (e: any) {
      log.error(`tick ${a.chave}`, e)
      resultado[a.chave] = { ok: false, erro: e?.message || 'falha' }
    }
  }
  return NextResponse.json({ ok: true, ...resultado })
}

export const POST = tick
export const GET = tick
