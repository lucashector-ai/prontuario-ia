/**
 * Utilitários SÓ de servidor (rotas /api): cliente Supabase com service role e
 * proteção das rotas de cron.
 */
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

/** Cliente Supabase do servidor (service role quando disponível — ignora RLS). */
export const supabaseServidor = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

/**
 * Valida chamada de cron. A Vercel envia `Authorization: Bearer <CRON_SECRET>`.
 * Sem CRON_SECRET configurado, aceita (ambiente de desenvolvimento).
 * Retorna uma resposta 401 se não autorizado, ou null se ok.
 *
 *   const negado = autorizarCron(req); if (negado) return negado
 */
export function autorizarCron(req: NextRequest): NextResponse | null {
  const segredo = process.env.CRON_SECRET
  if (!segredo) return null
  const auth = req.headers.get('authorization')
  if (auth === `Bearer ${segredo}`) return null
  // Permite disparo manual pela própria aplicação com ?segredo=
  if (req.nextUrl.searchParams.get('segredo') === segredo) return null
  return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
}

/** Data/hora "agora" no fuso de São Paulo, em partes (para regras de horário comercial). */
export function agoraSP() {
  const d = new Date()
  const hora = Number(d.toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: 'America/Sao_Paulo' }))
  return { data: d, hora }
}
