import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET(req: NextRequest) {
  const medicoId = req.nextUrl.searchParams.get('medico_id')
  const lido = req.nextUrl.searchParams.get('lido')
  if (!medicoId) return NextResponse.json({ error: 'medico_id obrigatorio' }, { status: 400 })

  let query = supabase
    .from('whatsapp_alertas')
    .select('*, pacientes(nome, telefone), whatsapp_conversas(nome_contato, telefone)')
    .eq('medico_id', medicoId)
    .order('criado_em', { ascending: false })
    .limit(50)

  if (lido !== null) query = query.eq('lido', lido === 'true')

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ alertas: data || [] })
}

export async function PATCH(req: NextRequest) {
  const { id, lido } = await req.json()
  if (!id) return NextResponse.json({ error: 'id obrigatorio' }, { status: 400 })
  const { error } = await supabase.from('whatsapp_alertas').update({ lido }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
