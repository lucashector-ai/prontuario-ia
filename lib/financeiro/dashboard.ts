import { supabase } from '@/lib/supabase'
import type {
  DashboardFinanceiro, SerieFluxoPonto, CategoriaFatia, ItemTipo, Resultado,
} from './types'

const isoDate = (d: Date) => d.toISOString().slice(0, 10)
const num = (v: any) => Number(v) || 0

export async function obterDashboard(clinicaId: string): Promise<Resultado<DashboardFinanceiro>> {
  try {
    const agora = new Date()
    const y = agora.getFullYear()
    const mo = agora.getMonth()
    const mesIni = new Date(y, mo, 1).toISOString()
    const mesFim = new Date(y, mo + 1, 1).toISOString()
    const mesAntIni = new Date(y, mo - 1, 1).toISOString()
    const anoIni = new Date(y, 0, 1).toISOString()
    const hoje = isoDate(agora)
    const janelaIni = new Date(agora); janelaIni.setDate(janelaIni.getDate() - 29)
    const janelaFim = new Date(agora); janelaFim.setDate(janelaFim.getDate() + 15)

    const [comandasR, recebR, despR, movR, itensR] = await Promise.all([
      supabase.from('comandas')
        .select('valor_final, fechado_em, status')
        .eq('clinica_id', clinicaId)
        .in('status', ['fechada', 'paga'])
        .gte('fechado_em', mesAntIni),
      supabase.from('recebimentos')
        .select('valor, valor_pago, status, vencimento, pago_em')
        .eq('clinica_id', clinicaId),
      supabase.from('despesas')
        .select('valor, status, vencimento, pago_em')
        .eq('clinica_id', clinicaId),
      supabase.from('movimentacoes_caixa')
        .select('tipo, valor, data_movimentacao')
        .eq('clinica_id', clinicaId)
        .gte('data_movimentacao', isoDate(janelaIni)),
      supabase.from('comanda_itens')
        .select('tipo, valor_total, comandas!inner(clinica_id, status, fechado_em)')
        .eq('comandas.clinica_id', clinicaId)
        .in('comandas.status', ['fechada', 'paga'])
        .gte('comandas.fechado_em', mesIni),
    ])

    const comandas = comandasR.data || []
    const recebimentos = recebR.data || []
    const despesas = despR.data || []
    const movimentacoes = movR.data || []
    const itens = itensR.data || []

    // ── Faturamento ──────────────────────────────────────────────────────────
    let faturamentoMes = 0, faturamentoMesAnterior = 0, faturamentoHoje = 0, comandasFechadasMes = 0
    for (const c of comandas) {
      const f = c.fechado_em || ''
      const v = num(c.valor_final)
      if (f >= mesIni && f < mesFim) { faturamentoMes += v; comandasFechadasMes++ }
      else if (f >= mesAntIni && f < mesIni) faturamentoMesAnterior += v
      if (f.slice(0, 10) === hoje) faturamentoHoje += v
    }
    const ticketMedio = comandasFechadasMes > 0 ? faturamentoMes / comandasFechadasMes : 0

    // ── Recebimentos ─────────────────────────────────────────────────────────
    const ABERTO = ['pendente', 'parcial', 'atrasado']
    let aReceber = 0, inadimplencia = 0, recebidoMes = 0, recebidoMesAnterior = 0, recebidoAno = 0
    let recParaHoje = 0, recEsteMes = 0, recEsteAno = 0
    const recebPrevDia: Record<string, number> = {}
    for (const r of recebimentos) {
      const aberto = ABERTO.includes(r.status)
      const venc = (r.vencimento || '').slice(0, 10)
      if (aberto) {
        const v = num(r.valor)
        aReceber += v
        if (venc && venc < hoje) inadimplencia += v
        if (venc === hoje) recParaHoje += v
        if (r.vencimento && r.vencimento >= mesIni.slice(0, 10) && r.vencimento < mesFim.slice(0, 10)) recEsteMes += v
        if (r.vencimento && r.vencimento >= anoIni.slice(0, 10)) recEsteAno += v
        if (venc && venc >= hoje) recebPrevDia[venc] = (recebPrevDia[venc] || 0) + v
      }
      if (r.status === 'pago') {
        const p = r.pago_em || ''
        const vp = num(r.valor_pago)
        if (p >= mesIni && p < mesFim) recebidoMes += vp
        else if (p >= mesAntIni && p < mesIni) recebidoMesAnterior += vp
        if (p >= anoIni) recebidoAno += vp
      }
    }

    // ── Despesas ─────────────────────────────────────────────────────────────
    const DESP_ABERTO = ['pendente', 'atrasado']
    let aPagar = 0, despEmAtraso = 0, despParaHoje = 0, despEsteMes = 0, despEsteAno = 0
    let pagoMes = 0, pagoMesAnterior = 0, pagoAno = 0
    const despPrevDia: Record<string, number> = {}
    for (const d of despesas) {
      const aberto = DESP_ABERTO.includes(d.status)
      const venc = (d.vencimento || '').slice(0, 10)
      if (aberto) {
        const v = num(d.valor)
        aPagar += v
        if (venc && venc < hoje) despEmAtraso += v
        if (venc === hoje) despParaHoje += v
        if (d.vencimento && d.vencimento >= mesIni.slice(0, 10) && d.vencimento < mesFim.slice(0, 10)) despEsteMes += v
        if (d.vencimento && d.vencimento >= anoIni.slice(0, 10)) despEsteAno += v
        if (venc && venc >= hoje) despPrevDia[venc] = (despPrevDia[venc] || 0) + v
      }
      if (d.status === 'pago') {
        const p = d.pago_em || ''
        const v = num(d.valor)
        if (p >= mesIni && p < mesFim) pagoMes += v
        else if (p >= mesAntIni && p < mesIni) pagoMesAnterior += v
        if (p >= anoIni) pagoAno += v
      }
    }

    const lucroMes = recebidoMes - pagoMes
    const lucroMesAnterior = recebidoMesAnterior - pagoMesAnterior

    // ── Série de fluxo de caixa ──────────────────────────────────────────────
    const movDia: Record<string, { e: number; s: number }> = {}
    for (const m of movimentacoes) {
      const dia = (m.data_movimentacao || '').slice(0, 10)
      if (!dia) continue
      if (!movDia[dia]) movDia[dia] = { e: 0, s: 0 }
      if (m.tipo === 'entrada') movDia[dia].e += num(m.valor)
      else movDia[dia].s += num(m.valor)
    }
    const serie: SerieFluxoPonto[] = []
    let saldo = 0
    for (let d = new Date(janelaIni); d <= janelaFim; d.setDate(d.getDate() + 1)) {
      const dia = isoDate(d)
      const futuro = dia > hoje
      const entradas = futuro ? 0 : (movDia[dia]?.e || 0)
      const saidas = futuro ? 0 : (movDia[dia]?.s || 0)
      const entradasPrevistas = futuro ? (recebPrevDia[dia] || 0) : 0
      const saidasPrevistas = futuro ? (despPrevDia[dia] || 0) : 0
      saldo += entradas - saidas + entradasPrevistas - saidasPrevistas
      serie.push({
        data: dia, entradas, saidas, entradasPrevistas, saidasPrevistas,
        saldo: Math.round(saldo * 100) / 100, futuro,
      })
    }

    // ── Categorias (receita por tipo de item) ────────────────────────────────
    const catMap: Record<string, number> = {}
    for (const it of itens) {
      const t = it.tipo || 'outro'
      catMap[t] = (catMap[t] || 0) + num(it.valor_total)
    }
    const categorias: CategoriaFatia[] = Object.entries(catMap)
      .filter(([, v]) => v > 0)
      .map(([tipo, valor]) => ({ tipo: tipo as ItemTipo, valor }))
      .sort((a, b) => b.valor - a.valor)

    return {
      data: {
        faturamentoMes, faturamentoMesAnterior, faturamentoHoje,
        recebidoMes, recebidoMesAnterior,
        aReceber, aPagar,
        lucroMes, lucroMesAnterior,
        ticketMedio, comandasFechadasMes, inadimplencia,
        painelReceber: {
          inadimplencia, paraHoje: recParaHoje, esteMes: recEsteMes,
          esteAno: recEsteAno, recebidoMes, recebidoAno,
        },
        painelPagar: {
          emAtraso: despEmAtraso, paraHoje: despParaHoje, esteMes: despEsteMes,
          esteAno: despEsteAno, pagoMes, pagoAno,
        },
        serie, categorias,
      },
      error: null,
    }
  } catch (e: any) {
    return { data: null, error: e?.message || 'erro ao carregar dashboard' }
  }
}
