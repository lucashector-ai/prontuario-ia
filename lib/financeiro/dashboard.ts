import { supabase } from '@/lib/supabase'
import type { MetricasFinanceiras, Resultado } from './types'

function intervaloMes(offset: number): { inicio: string; fim: string } {
  const base = new Date()
  const inicio = new Date(base.getFullYear(), base.getMonth() + offset, 1)
  const fim = new Date(base.getFullYear(), base.getMonth() + offset + 1, 1)
  return { inicio: inicio.toISOString(), fim: fim.toISOString() }
}

async function faturamentoDoMes(clinicaId: string, offset: number): Promise<{ total: number; count: number }> {
  const { inicio, fim } = intervaloMes(offset)
  const { data } = await supabase
    .from('comandas')
    .select('valor_final')
    .eq('clinica_id', clinicaId)
    .in('status', ['fechada', 'paga'])
    .gte('fechado_em', inicio)
    .lt('fechado_em', fim)
  const linhas = data || []
  const total = linhas.reduce((s, c: any) => s + Number(c.valor_final || 0), 0)
  return { total, count: linhas.length }
}

async function recebidoDoMes(clinicaId: string, offset: number): Promise<number> {
  const { inicio, fim } = intervaloMes(offset)
  const { data } = await supabase
    .from('recebimentos')
    .select('valor_pago')
    .eq('clinica_id', clinicaId)
    .eq('status', 'pago')
    .gte('pago_em', inicio)
    .lt('pago_em', fim)
  return (data || []).reduce((s, r: any) => s + Number(r.valor_pago || 0), 0)
}

export async function obterMetricasFinanceiras(
  clinicaId: string,
): Promise<Resultado<MetricasFinanceiras>> {
  try {
    const [fatMes, fatAnt, recMes, recAnt, aReceberRes] = await Promise.all([
      faturamentoDoMes(clinicaId, 0),
      faturamentoDoMes(clinicaId, -1),
      recebidoDoMes(clinicaId, 0),
      recebidoDoMes(clinicaId, -1),
      supabase
        .from('recebimentos')
        .select('valor')
        .eq('clinica_id', clinicaId)
        .in('status', ['pendente', 'parcial', 'atrasado']),
    ])

    const aReceber = (aReceberRes.data || []).reduce((s, r: any) => s + Number(r.valor || 0), 0)
    const ticketMedio = fatMes.count > 0 ? fatMes.total / fatMes.count : 0

    return {
      data: {
        faturamentoMes: fatMes.total,
        recebidoMes: recMes,
        aReceber,
        ticketMedio,
        comandasFechadasMes: fatMes.count,
        faturamentoMesAnterior: fatAnt.total,
        recebidoMesAnterior: recAnt,
      },
      error: null,
    }
  } catch (e: any) {
    return { data: null, error: e?.message || 'erro ao carregar métricas' }
  }
}
