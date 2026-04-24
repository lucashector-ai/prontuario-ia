import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// GET /api/bloqueios?clinica_id=X  OU  ?medico_id=X
export async function GET(req: NextRequest) {
  try {
    const clinicaId = req.nextUrl.searchParams.get('clinica_id')
    const medicoId = req.nextUrl.searchParams.get('medico_id')

    if (clinicaId) {
      // Busca todos os medicos da clinica e depois bloqueios deles
      const { data: meds } = await supabase
        .from('medicos').select('id').eq('clinica_id', clinicaId)
      const ids = (meds || []).map((m: any) => m.id)
      if (ids.length === 0) return NextResponse.json({ bloqueios: [] })

      const { data, error } = await supabase
        .from('bloqueios_agenda')
        .select('*')
        .in('medico_id', ids)
        .order('data_inicio', { ascending: true })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ bloqueios: data || [] })
    }

    if (medicoId) {
      const { data, error } = await supabase
        .from('bloqueios_agenda')
        .select('*')
        .eq('medico_id', medicoId)
        .order('data_inicio', { ascending: true })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ bloqueios: data || [] })
    }

    return NextResponse.json({ error: 'medico_id ou clinica_id obrigatorio' }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// POST /api/bloqueios
// body: { medico_id, clinica_id, data_inicio, data_fim, motivo?, recorrente?, dias_semana? }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { medico_id, clinica_id, data_inicio, data_fim, motivo, recorrente, dias_semana } = body

    if (!medico_id || !data_inicio || !data_fim) {
      return NextResponse.json({ error: 'medico_id, data_inicio e data_fim sao obrigatorios' }, { status: 400 })
    }

    // Valida: data_fim > data_inicio
    if (new Date(data_fim) <= new Date(data_inicio)) {
      return NextResponse.json({ error: 'Data fim deve ser depois de data inicio' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('bloqueios_agenda')
      .insert({
        medico_id,
        clinica_id: clinica_id || null,
        data_inicio,
        data_fim,
        motivo: motivo || null,
        recorrente: !!recorrente,
        dias_semana: dias_semana || null,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ bloqueio: data })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// DELETE /api/bloqueios?id=X
export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id obrigatorio' }, { status: 400 })

    const { error } = await supabase.from('bloqueios_agenda').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
