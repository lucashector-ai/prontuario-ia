import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const pacienteId = req.nextUrl.searchParams.get('paciente_id')
  const medicoId = req.nextUrl.searchParams.get('medico_id')
  let query = supabase.from('agendamentos').select('*').order('data_hora', { ascending: true })
  if (pacienteId) query = query.eq('paciente_id', pacienteId)
  if (medicoId) query = query.eq('medico_id', medicoId)
  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ agendamentos: data })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { data, error } = await supabase.from('agendamentos').insert([body]).select().single()
    if (error) throw error
    return NextResponse.json({ agendamento: data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, ...updates } = body
    const { data, error } = await supabase.from('agendamentos').update(updates).eq('id', id).select().single()
    if (error) throw error
    return NextResponse.json({ agendamento: data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  const { error } = await supabase.from('agendamentos').delete().eq('id', id!)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
