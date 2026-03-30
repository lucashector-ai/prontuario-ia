import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const sala_id = req.nextUrl.searchParams.get('sala_id')
  if (!sala_id) return NextResponse.json({ error: 'sala_id obrigatorio' }, { status: 400 })
  const [{ data: sala }, { data: msgs }] = await Promise.all([
    supabase.from('teleconsultas').select('*').eq('sala_id', sala_id).single(),
    supabase.from('sala_mensagens').select('*').eq('sala_id', sala_id).order('criado_em', { ascending: true })
  ])
  return NextResponse.json({ sala, mensagens: msgs || [] })
}
