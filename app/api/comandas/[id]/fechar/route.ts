import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// POST /api/comandas/[id]/fechar — fecha comanda + cria movimento financeiro
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json()
    const { forma_pagamento, fechada_por, conta_id } = body

    if (!forma_pagamento) {
      return NextResponse.json({ error: 'forma_pagamento obrigatoria' }, { status: 400 })
    }

    // Busca comanda
    const { data: comanda, error: e1 } = await supabase
      .from('comandas')
      .select('*, pacientes:paciente_id(nome)')
      .eq('id', params.id)
      .single()

    if (e1 || !comanda) return NextResponse.json({ error: 'comanda nao encontrada' }, { status: 404 })
    if (comanda.status === 'fechada') {
      return NextResponse.json({ error: 'comanda ja fechada' }, { status: 400 })
    }

    // Atualiza status
    const { data: cFechada, error: e2 } = await supabase
      .from('comandas')
      .update({
        status: 'fechada',
        forma_pagamento,
        fechada_em: new Date().toISOString(),
        fechada_por: fechada_por || null,
      })
      .eq('id', params.id)
      .select()
      .single()

    if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })

    // Cria movimentacao financeira (entrada)
    const valorFinal = Number(comanda.total_liquido || comanda.total || 0)
    if (valorFinal > 0 && comanda.clinica_id) {
      const pacienteNome = (comanda as any).pacientes?.nome || 'Paciente'
      await supabase.from('financeiro_movimentacoes').insert({
        clinica_id: comanda.clinica_id,
        tipo: 'entrada',
        descricao: `Comanda - ${pacienteNome}`,
        valor: valorFinal,
        data_competencia: new Date().toISOString().slice(0, 10),
        data_pagamento: new Date().toISOString().slice(0, 10),
        forma_pagamento,
        conta_id: conta_id || null,
        comanda_id: params.id,
        paciente_id: comanda.paciente_id,
        status: 'pago',
      })
    }

    return NextResponse.json({ comanda: cFechada })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
