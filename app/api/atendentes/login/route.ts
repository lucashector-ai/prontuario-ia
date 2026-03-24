import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const { email, senha } = await req.json()
  const { data } = await supabase.from('atendentes').select('*').eq('email', email).eq('senha', senha).eq('ativo', true).single()
  if (!data) return NextResponse.json({ error: 'Email ou senha incorretos' }, { status: 401 })
  return NextResponse.json({ atendente: { id: data.id, nome: data.nome, email: data.email, cargo: data.cargo, medico_id: data.medico_id } })
}
