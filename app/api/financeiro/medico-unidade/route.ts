import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

// GET ?clinica_id= — lista médicos da clínica com a unidade vinculada
export async function GET(req: NextRequest) {
  const clinicaId = req.nextUrl.searchParams.get('clinica_id')
  if (!clinicaId) return NextResponse.json({ error: 'clinica_id obrigatório' }, { status: 400 })
  const { data, error } = await supabase
    .from('medicos')
    .select('id, nome, unidade_id, cargo, ativo')
    .eq('clinica_id', clinicaId)
    .order('nome')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ medicos: data || [] })
}

// PATCH { medico_id, unidade_id } — vincula um médico a uma unidade
export async function PATCH(req: NextRequest) {
  try {
    const { medico_id, unidade_id } = await req.json()
    if (!medico_id) return NextResponse.json({ error: 'medico_id obrigatório' }, { status: 400 })
    const { data, error } = await supabase
      .from('medicos')
      .update({ unidade_id: unidade_id || null })
      .eq('id', medico_id)
      .select('id, nome, unidade_id')
      .single()
    if (error) throw error
    return NextResponse.json({ medico: data })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
