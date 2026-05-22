import { supabase } from '@/lib/supabase'
import type { Resultado } from './types'

const num = (v: any) => Number(v) || 0

export interface LinhaDRE { rotulo: string; valor: number }
export interface DRE {
  competencia: string
  receitaBruta: number
  despesas: LinhaDRE[]
  totalDespesas: number
  repasses: number
  resultado: number
}

export interface MesFluxo {
  mes: string          // 'YYYY-MM'
  rotulo: string       // 'mai/26'
  entradas: number
  saidas: number
  saldo: number
}

function intervaloMes(competencia: string) {
  const [a, m] = competencia.split('-').map(Number)
  return {
    inicio: new Date(a, m - 1, 1).toISOString(),
    fim: new Date(a, m, 1).toISOString(),
  }
}

// ─── DRE — Demonstrativo de Resultado do mês ────────────────────────────────
export async function obterDRE(
  clinicaId: string,
  competencia: string,
): Promise<Resultado<DRE>> {
  try {
    const { inicio, fim } = intervaloMes(competencia)

    const [recebR, despR, repR] = await Promise.all([
      supabase.from('recebimentos').select('valor_pago')
        .eq('clinica_id', clinicaId).eq('status', 'pago')
        .gte('pago_em', inicio).lt('pago_em', fim),
      supabase.from('despesas').select('valor, categoria')
        .eq('clinica_id', clinicaId).eq('status', 'pago')
        .gte('pago_em', inicio).lt('pago_em', fim),
      supabase.from('repasses').select('valor')
        .eq('clinica_id', clinicaId).eq('status', 'pago')
        .gte('pago_em', inicio).lt('pago_em', fim),
    ])

    const receitaBruta = (recebR.data || []).reduce((s, r: any) => s + num(r.valor_pago), 0)

    const porCategoria: Record<string, number> = {}
    for (const d of despR.data || []) {
      const cat = (d as any).categoria || 'Sem categoria'
      porCategoria[cat] = (porCategoria[cat] || 0) + num(d.valor)
    }
    const despesas: LinhaDRE[] = Object.entries(porCategoria)
      .map(([rotulo, valor]) => ({ rotulo, valor }))
      .sort((a, b) => b.valor - a.valor)
    const totalDespesas = despesas.reduce((s, l) => s + l.valor, 0)

    const repasses = (repR.data || []).reduce((s, r: any) => s + num(r.valor), 0)
    const resultado = receitaBruta - totalDespesas - repasses

    return {
      data: { competencia, receitaBruta, despesas, totalDespesas, repasses, resultado },
      error: null,
    }
  } catch (e: any) {
    return { data: null, error: e?.message || 'erro ao montar DRE' }
  }
}

// ─── Fluxo de caixa mensal (últimos N meses) ────────────────────────────────
export async function obterFluxoMensal(
  clinicaId: string,
  meses = 12,
): Promise<Resultado<MesFluxo[]>> {
  try {
    const base = new Date()
    const ini = new Date(base.getFullYear(), base.getMonth() - (meses - 1), 1)

    const { data } = await supabase
      .from('movimentacoes_caixa')
      .select('tipo, valor, data_movimentacao')
      .eq('clinica_id', clinicaId)
      .gte('data_movimentacao', ini.toISOString().slice(0, 10))

    const mapa: Record<string, { e: number; s: number }> = {}
    for (const m of data || []) {
      const mes = String(m.data_movimentacao || '').slice(0, 7)
      if (!mes) continue
      if (!mapa[mes]) mapa[mes] = { e: 0, s: 0 }
      if (m.tipo === 'entrada') mapa[mes].e += num(m.valor)
      else mapa[mes].s += num(m.valor)
    }

    const meses12: MesFluxo[] = []
    for (let i = 0; i < meses; i++) {
      const d = new Date(ini.getFullYear(), ini.getMonth() + i, 1)
      const mes = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const v = mapa[mes] || { e: 0, s: 0 }
      meses12.push({
        mes,
        rotulo: d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
        entradas: v.e,
        saidas: v.s,
        saldo: v.e - v.s,
      })
    }
    return { data: meses12, error: null }
  } catch (e: any) {
    return { data: null, error: e?.message || 'erro ao montar fluxo mensal' }
  }
}

// ─── Movimentações para exportação ──────────────────────────────────────────
export async function obterMovimentacoesPeriodo(
  clinicaId: string,
  de: string,
  ate: string,
): Promise<Resultado<any[]>> {
  const { data, error } = await supabase
    .from('movimentacoes_caixa')
    .select('data_movimentacao, tipo, origem, valor, descricao')
    .eq('clinica_id', clinicaId)
    .gte('data_movimentacao', de)
    .lte('data_movimentacao', ate)
    .order('data_movimentacao')
  return { data: data || [], error: error?.message || null }
}
