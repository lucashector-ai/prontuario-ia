import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// POST /api/comandas/[id]/itens — adiciona item
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json()
    const { procedimento_id, descricao, quantidade, valor_unitario } = body

    if (!descricao || valor_unitario === undefined) {
      return NextResponse.json({ error: 'descricao e valor_unitario obrigatorios' }, { status: 400 })
    }

    const qtd = quantidade || 1
    const valor_total = Number(valor_unitario) * qtd

    const { data, error } = await supabase
      .from('comanda_itens')
      .insert({
        comanda_id: params.id,
        procedimento_id: procedimento_id || null,
        descricao,
        quantidade: qtd,
        valor_unitario,
        valor_total,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Recalcula total da comanda
    await recalcularTotal(params.id)

    return NextResponse.json({ item: data })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

async function recalcularTotal(comandaId: string) {
  const { data: itens } = await supabase
    .from('comanda_itens')
    .select('valor_total')
    .eq('comanda_id', comandaId)

  const total = (itens || []).reduce((acc, i: any) => acc + Number(i.valor_total), 0)

  const { data: c } = await supabase
    .from('comandas')
    .select('desconto')
    .eq('id', comandaId)
    .single()

  const desconto = Number(c?.desconto || 0)
  const total_liquido = total - desconto

  await supabase
    .from('comandas')
    .update({ total, total_liquido })
    .eq('id', comandaId)
}

// DELETE /api/comandas/[id]/itens?item_id=X — remove item
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const itemId = req.nextUrl.searchParams.get('item_id')
    if (!itemId) return NextResponse.json({ error: 'item_id obrigatorio' }, { status: 400 })

    const { error } = await supabase
      .from('comanda_itens')
      .delete()
      .eq('id', itemId)
      .eq('comanda_id', params.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await recalcularTotal(params.id)

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
