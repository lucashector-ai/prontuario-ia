import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET(req: NextRequest) {
  const medico_id = req.nextUrl.searchParams.get('medico_id')
  if (!medico_id) return NextResponse.json({ error: 'medico_id required' }, { status: 400 })
  const { data, error } = await supabase.from('atendentes').select('id,nome,email,cargo,ativo,criado_em').eq('medico_id', medico_id).order('nome')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ atendentes: data || [] })
}

export async function POST(req: NextRequest) {
  const { medico_id, nome, email, senha, cargo } = await req.json()
  if (!medico_id || !nome || !email || !senha) return NextResponse.json({ error: 'Campos obrigatórios: medico_id, nome, email, senha' }, { status: 400 })
  // Verifica se email já existe
  const { data: existe } = await supabase.from('atendentes').select('id').eq('email', email).maybeSingle()
  if (existe) return NextResponse.json({ error: 'Email já cadastrado' }, { status: 400 })
  const { data, error } = await supabase.from('atendentes').insert({ medico_id, nome, email, senha, cargo: cargo || 'Atendente', ativo: true }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ atendente: data })
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  await supabase.from('atendentes').update({ ativo: false }).eq('id', id)
  return NextResponse.json({ ok: true })
}

export async function PATCH(req: NextRequest) {
  const { id, nome, cargo, ativo } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { data, error } = await supabase.from('atendentes').update({ nome, cargo, ativo }).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ atendente: data })
}
