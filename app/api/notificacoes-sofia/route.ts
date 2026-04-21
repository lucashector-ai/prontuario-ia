import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const medico_id = searchParams.get('medico_id')
  const clinica_id = searchParams.get('clinica_id')
  const apenas_nao_lidas = searchParams.get('nao_lidas') === 'true'

  if (!medico_id && !clinica_id) {
    return NextResponse.json({ error: 'medico_id ou clinica_id obrigatorio' }, { status: 400 })
  }

  let query = supabase
    .from('notificacoes_medico')
    .select('*')
    .order('criada_em', { ascending: false })
    .limit(30)

  if (clinica_id) {
    const { data: meds } = await supabase
      .from('medicos')
      .select('id')
      .eq('clinica_id', clinica_id)
    const medicoIds = (meds || []).map((m: any) => m.id)
    if (medicoIds.length === 0) {
      return NextResponse.json({ notificacoes: [] })
    }
    query = query.in('medico_id', medicoIds)
  } else if (medico_id) {
    query = query.eq('medico_id', medico_id)
  }

  if (apenas_nao_lidas) query = query.eq('lida', false)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ notificacoes: data })
}

export async function PATCH(req: NextRequest) {
  const { id, lida } = await req.json()
  if (!id) return NextResponse.json({ error: 'id obrigatorio' }, { status: 400 })

  const { error } = await supabase
    .from('notificacoes_medico')
    .update({ lida: lida !== false })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
