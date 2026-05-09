import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// GET /api/comandas/[id] — detalhe + itens
export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { data: comanda, error: e1 } = await supabase
      .from('comandas')
      .select('*, pacientes:paciente_id(nome, cpf, telefone), medicos:medico_id(nome)')
      .eq('id', params.id)
      .single()

    if (e1) return NextResponse.json({ error: e1.message }, { status: 404 })

    const { data: itens, error: e2 } = await supabase
      .from('comanda_itens')
      .select('*, procedimentos:procedimento_id(nome)')
      .eq('comanda_id', params.id)
      .order('criado_em')

    if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })

    return NextResponse.json({ comanda, itens: itens || [] })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// PATCH /api/comandas/[id] — atualiza desconto, observacao, etc
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json()
    const fields = ['desconto', 'observacao', 'forma_pagamento']
    const update: any = {}
    for (const f of fields) if (body[f] !== undefined) update[f] = body[f]

    const { data, error } = await supabase
      .from('comandas')
      .update(update)
      .eq('id', params.id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ comanda: data })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
