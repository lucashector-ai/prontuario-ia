import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

/**
 * Rodado diariamente pelo Vercel Cron (vercel.json).
 * Marca como 'atrasado' os recebimentos e despesas vencidos e ainda em aberto,
 * mantendo os status corretos sem depender de cálculo na tela.
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    if (req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
  }

  const hoje = new Date().toISOString().slice(0, 10)

  const { data: receb } = await supabase
    .from('recebimentos')
    .update({ status: 'atrasado' })
    .in('status', ['pendente', 'parcial'])
    .lt('vencimento', hoje)
    .not('vencimento', 'is', null)
    .select('id')

  const { data: desp } = await supabase
    .from('despesas')
    .update({ status: 'atrasado' })
    .eq('status', 'pendente')
    .lt('vencimento', hoje)
    .not('vencimento', 'is', null)
    .select('id')

  return NextResponse.json({
    ok: true,
    recebimentos_atrasados: receb?.length || 0,
    despesas_atrasadas: desp?.length || 0,
  })
}
