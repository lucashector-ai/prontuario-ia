import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { data, error } = await supabase.from('pacientes').insert([body]).select().single()
    if (error) throw error
    return NextResponse.json({ paciente: data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const medicoId = req.nextUrl.searchParams.get('medico_id')
  const clinicaId = req.nextUrl.searchParams.get('clinica_id')

  // Se clinica_id foi passado, retorna pacientes de todos os médicos da clínica
  if (clinicaId) {
    const { data: medicos } = await supabase
      .from('medicos').select('id').eq('clinica_id', clinicaId)
    const medicoIds = (medicos || []).map(m => m.id)
    if (medicoIds.length === 0) return NextResponse.json({ pacientes: [] })

    const { data, error } = await supabase
      .from('pacientes')
      .select('*, medico:medico_id(id, nome)')
      .in('medico_id', medicoIds)
      .order('nome')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ pacientes: data })
  }

  // Fallback: filtro por médico único (comportamento antigo)
  if (!medicoId) return NextResponse.json({ error: 'medico_id ou clinica_id obrigatório' }, { status: 400 })

  const { data, error } = await supabase
    .from('pacientes').select('*').eq('medico_id', medicoId).order('nome')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ pacientes: data })
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 })

    await supabase.from('consultas').delete().eq('paciente_id', id)
    await supabase.from('agendamentos').delete().eq('paciente_id', id)

    const { error } = await supabase.from('pacientes').delete().eq('id', id)
    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
