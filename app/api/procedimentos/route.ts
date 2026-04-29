import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// GET ?clinica_id=xxx — lista procedimentos ativos da clínica
export async function GET(req: NextRequest) {
  const clinicaId = req.nextUrl.searchParams.get('clinica_id')
  if (!clinicaId) return NextResponse.json({ error: 'clinica_id required' }, { status: 400 })
  const incluirInativos = req.nextUrl.searchParams.get('incluir_inativos') === '1'

  let q = supabase
    .from('procedimentos')
    .select('*')
    .eq('clinica_id', clinicaId)
    .order('nome', { ascending: true })

  if (!incluirInativos) q = q.eq('ativo', true)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ procedimentos: data || [] })
}

// POST — cria procedimento
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { clinica_id, nome, duracao, valor } = body
    if (!clinica_id || !nome) return NextResponse.json({ error: 'clinica_id e nome obrigatórios' }, { status: 400 })
    const { data, error } = await supabase
      .from('procedimentos')
      .insert({
        clinica_id,
        nome: nome.trim(),
        duracao: parseInt(duracao) || 30,
        valor: valor != null && valor !== '' ? parseFloat(valor) : null,
      })
      .select()
      .single()
    if (error) throw error
    return NextResponse.json({ procedimento: data })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// PATCH — edita procedimento
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, nome, duracao, valor, ativo } = body
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const updates: any = { atualizado_em: new Date().toISOString() }
    if (nome !== undefined) updates.nome = nome.trim()
    if (duracao !== undefined) updates.duracao = parseInt(duracao) || 30
    if (valor !== undefined) updates.valor = valor != null && valor !== '' ? parseFloat(valor) : null
    if (ativo !== undefined) updates.ativo = !!ativo

    const { data, error } = await supabase
      .from('procedimentos')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return NextResponse.json({ procedimento: data })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// DELETE ?id=xxx — soft delete (ativo=false)
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { error } = await supabase
    .from('procedimentos')
    .update({ ativo: false, atualizado_em: new Date().toISOString() })
    .eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
