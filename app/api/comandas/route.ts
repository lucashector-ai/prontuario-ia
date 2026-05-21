import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// POST /api/comandas — cria nova comanda
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { paciente_id, medico_id, profissional_id, clinica_id, agendamento_id, observacao, observacoes } = body

    if (!paciente_id) {
      return NextResponse.json({ error: 'paciente_id obrigatorio' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('comandas')
      .insert({
        paciente_id,
        profissional_id: profissional_id || medico_id || null,
        clinica_id: clinica_id || null,
        agendamento_id: agendamento_id || null,
        observacoes: observacoes ?? observacao ?? null,
        origem: agendamento_id ? 'agendamento' : 'avulsa',
        status: 'aberta',
        aberto_em: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ comanda: data })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// GET /api/comandas?paciente_id=X — lista comandas do paciente
export async function GET(req: NextRequest) {
  try {
    const pacienteId = req.nextUrl.searchParams.get('paciente_id')
    const clinicaId = req.nextUrl.searchParams.get('clinica_id')
    const status = req.nextUrl.searchParams.get('status')

    let query = supabase
      .from('comandas')
      .select('*, pacientes:paciente_id(nome), medicos:profissional_id(nome)')
      .order('created_at', { ascending: false })
      .limit(100)

    if (pacienteId) query = query.eq('paciente_id', pacienteId)
    if (clinicaId) query = query.eq('clinica_id', clinicaId)
    if (status) query = query.eq('status', status)

    const { data, error } = await query

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ comandas: data || [] })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
