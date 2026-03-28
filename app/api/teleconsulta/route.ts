import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const medicoId = req.nextUrl.searchParams.get('medico_id')
  if (!medicoId) return NextResponse.json({ error: 'medico_id required' }, { status: 400 })
  const { data } = await supabase
    .from('teleconsultas')
    .select('*, pacientes(nome, telefone)')
    .eq('medico_id', medicoId)
    .order('criado_em', { ascending: false })
    .limit(50)
  return NextResponse.json({ teleconsultas: data || [] })
}

export async function POST(req: NextRequest) {
  try {
    const { medico_id, paciente_id, agendamento_id, titulo } = await req.json()
    if (!medico_id) return NextResponse.json({ error: 'medico_id required' }, { status: 400 })
    const { data, error } = await supabase
      .from('teleconsultas')
      .insert({ medico_id, paciente_id, agendamento_id, titulo: titulo || 'Teleconsulta', status: 'aguardando' })
      .select()
      .single()
    if (error) throw error
    return NextResponse.json({ teleconsulta: data })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const { id, status, duracao_segundos } = await req.json()
  const updates: any = { status }
  if (status === 'em_andamento') updates.iniciada_em = new Date().toISOString()
  if (status === 'encerrada') { updates.encerrada_em = new Date().toISOString(); if (duracao_segundos) updates.duracao_segundos = duracao_segundos }
  const { data } = await supabase.from('teleconsultas').update(updates).eq('id', id).select().single()
  return NextResponse.json({ teleconsulta: data })
}
