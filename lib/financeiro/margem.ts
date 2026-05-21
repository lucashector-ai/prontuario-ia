import { supabase } from '@/lib/supabase'
import type { Resultado } from './types'

export interface ProcedimentoMargem {
  id: string
  nome: string
  valor: number
  custoTotal: number
  margem: number
  margemPct: number
  roi: number
  faturadoMes: number
  qtdMes: number
}

// Margem unitária dos procedimentos + volume vendido no mês (best-effort:
// só conta itens de comanda que referenciam o procedimento).
export async function obterMargens(clinicaId: string): Promise<Resultado<ProcedimentoMargem[]>> {
  try {
    const agora = new Date()
    const mesIni = new Date(agora.getFullYear(), agora.getMonth(), 1).toISOString()

    const [procR, itensR] = await Promise.all([
      supabase.from('procedimentos')
        .select('id, nome, valor, custo_insumos, custo_operacional')
        .eq('clinica_id', clinicaId)
        .eq('ativo', true)
        .order('nome'),
      supabase.from('comanda_itens')
        .select('procedimento_id, valor_total, comandas!inner(clinica_id, status, fechado_em)')
        .eq('comandas.clinica_id', clinicaId)
        .in('comandas.status', ['fechada', 'paga'])
        .gte('comandas.fechado_em', mesIni)
        .not('procedimento_id', 'is', null),
    ])

    const vendaPorProc: Record<string, { total: number; qtd: number }> = {}
    for (const it of itensR.data || []) {
      const pid = (it as any).procedimento_id
      if (!pid) continue
      if (!vendaPorProc[pid]) vendaPorProc[pid] = { total: 0, qtd: 0 }
      vendaPorProc[pid].total += Number(it.valor_total || 0)
      vendaPorProc[pid].qtd += 1
    }

    const margens: ProcedimentoMargem[] = (procR.data || []).map((p: any) => {
      const valor = Number(p.valor || 0)
      const custoTotal = Number(p.custo_insumos || 0) + Number(p.custo_operacional || 0)
      const margem = valor - custoTotal
      const margemPct = valor > 0 ? (margem / valor) * 100 : 0
      const roi = custoTotal > 0 ? (margem / custoTotal) * 100 : 0
      const venda = vendaPorProc[p.id] || { total: 0, qtd: 0 }
      return {
        id: p.id, nome: p.nome, valor, custoTotal, margem, margemPct, roi,
        faturadoMes: venda.total, qtdMes: venda.qtd,
      }
    })

    return { data: margens, error: null }
  } catch (e: any) {
    return { data: null, error: e?.message || 'erro ao calcular margens' }
  }
}
