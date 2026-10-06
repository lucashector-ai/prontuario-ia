/**
 * Painel da TV — público, aberto pelo link secreto do setor. Devolve só o que a
 * TV mostra: nome do setor/clínica e as últimas chamadas de hoje (nome já
 * reduzido conforme a configuração da clínica).
 */
import { NextRequest, NextResponse } from 'next/server'
import { dadosDoPainel } from '@/lib/atendimento/servidor'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  try {
    const dados = await dadosDoPainel(params.token)
    if (!dados) return NextResponse.json({ error: 'Painel não encontrado' }, { status: 404 })
    return NextResponse.json(dados, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ error: 'indisponivel' }, { status: 503 })
  }
}
