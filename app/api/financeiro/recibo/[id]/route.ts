import { NextRequest, NextResponse } from 'next/server'
import { createElement } from 'react'
import { createClient } from '@supabase/supabase-js'
import { renderToBuffer } from '@react-pdf/renderer'
import ReciboPDF, { type ReciboData } from '@/components/financeiro/ReciboPDF'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

const fmtData = (d: string | null) => {
  if (!d) return new Date().toLocaleDateString('pt-BR')
  return new Date(d).toLocaleDateString('pt-BR')
}

// GET /api/financeiro/recibo/[id] — gera o recibo em PDF de um recebimento pago
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { data: receb, error } = await supabase
      .from('recebimentos')
      .select('*, pacientes:paciente_id(nome, cpf), formas_pagamento:forma_pagamento_id(nome)')
      .eq('id', params.id)
      .single()

    if (error || !receb) {
      return NextResponse.json({ error: 'recebimento não encontrado' }, { status: 404 })
    }
    if (receb.status !== 'pago') {
      return NextResponse.json({ error: 'recibo disponível apenas para recebimentos pagos' }, { status: 400 })
    }

    const { data: clinica } = await supabase
      .from('clinicas').select('nome').eq('id', receb.clinica_id).single()

    // monta as linhas: itens da comanda quando à vista, senão linha descritiva
    let itens: { descricao: string; valor: number }[] = []
    const parcelado = (receb.parcela_total || 1) > 1

    if (receb.comanda_id && !parcelado) {
      const { data: itensComanda } = await supabase
        .from('comanda_itens')
        .select('descricao, valor_total')
        .eq('comanda_id', receb.comanda_id)
        .order('created_at')
      itens = (itensComanda || []).map((i: any) => ({
        descricao: i.descricao,
        valor: Number(i.valor_total || 0),
      }))
    }

    if (itens.length === 0) {
      const desc = receb.comanda_id
        ? parcelado
          ? `Parcela ${receb.parcela_numero}/${receb.parcela_total} — Comanda #${String(receb.comanda_id).substring(0, 8)}`
          : `Atendimento — Comanda #${String(receb.comanda_id).substring(0, 8)}`
        : 'Recebimento avulso'
      itens = [{ descricao: desc, valor: Number(receb.valor_pago || 0) }]
    }

    const dados: ReciboData = {
      clinicaNome: clinica?.nome || 'Clínica',
      reciboNum: `#${String(receb.id).substring(0, 8).toUpperCase()}`,
      pacienteNome: (receb as any).pacientes?.nome || 'Paciente',
      pacienteCpf: (receb as any).pacientes?.cpf || null,
      itens,
      totalRecebido: Number(receb.valor_pago || 0),
      formaPagamento: (receb as any).formas_pagamento?.nome || '—',
      data: fmtData(receb.pago_em),
    }

    const buffer = await renderToBuffer(createElement(ReciboPDF, dados) as any)

    return new NextResponse(buffer as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="recibo-${dados.reciboNum.replace('#', '')}.pdf"`,
      },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'erro ao gerar recibo' }, { status: 500 })
  }
}
