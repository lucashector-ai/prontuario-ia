import { supabase } from '@/lib/supabase'
import { obterDashboard } from './dashboard'
import type { Resultado } from './types'

export interface ComponenteSaude {
  nome: string
  score: number
  max: number
  detalhe: string
}

export interface SaudeFinanceira {
  score: number
  classificacao: 'saudavel' | 'atencao' | 'risco'
  componentes: ComponenteSaude[]
}

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))
const pct = (v: number) => `${Math.round(v * 100)}%`

// Health score 0-100 da clínica, a partir de inadimplência, lucratividade,
// concentração de receita, dependência de profissional e projeção de caixa.
export async function obterSaudeFinanceira(clinicaId: string): Promise<Resultado<SaudeFinanceira>> {
  try {
    const { data: dash, error } = await obterDashboard(clinicaId)
    if (error || !dash) return { data: null, error: error || 'sem dados' }

    const mesIni = (() => {
      const d = new Date()
      return new Date(d.getFullYear(), d.getMonth(), 1).toISOString()
    })()
    const { data: comandasProf } = await supabase
      .from('comandas')
      .select('profissional_id, valor_final')
      .eq('clinica_id', clinicaId)
      .in('status', ['fechada', 'paga'])
      .gte('fechado_em', mesIni)

    // 1. Inadimplência (25) — quanto menor a fatia vencida, melhor
    const baseReceb = dash.recebidoMes + dash.aReceber
    const ratioInad = baseReceb > 0 ? dash.inadimplencia / baseReceb : 0
    const sInad = clamp(1 - ratioInad, 0, 1) * 25

    // 2. Lucratividade (30) — lucro como fatia do recebido, alvo 30%
    const ratioLucro = dash.recebidoMes > 0 ? dash.lucroMes / dash.recebidoMes : 0
    const sLucro = clamp(ratioLucro / 0.3, 0, 1) * 30

    // 3. Concentração de receita por categoria (20) — diversificado é melhor
    const totalCat = dash.categorias.reduce((s, c) => s + c.valor, 0)
    const topCat = dash.categorias.length ? Math.max(...dash.categorias.map((c) => c.valor)) : 0
    const shareCat = totalCat > 0 ? topCat / totalCat : 0
    const sCat = clamp(1 - Math.max(0, shareCat - 0.5) / 0.5, 0, 1) * 20

    // 4. Dependência de profissional (15)
    const porProf: Record<string, number> = {}
    for (const c of comandasProf || []) {
      const id = (c as any).profissional_id || 'sem'
      porProf[id] = (porProf[id] || 0) + Number(c.valor_final || 0)
    }
    const totalProf = Object.values(porProf).reduce((s, v) => s + v, 0)
    const topProf = Object.values(porProf).length ? Math.max(...Object.values(porProf)) : 0
    const shareProf = totalProf > 0 ? topProf / totalProf : 0
    const sProf = clamp(1 - Math.max(0, shareProf - 0.5) / 0.5, 0, 1) * 15

    // 5. Projeção de caixa (10) — saldo projetado não-negativo
    const sCaixa = dash.projecao.saldoFinal >= 0 ? 10 : clamp(1 + dash.projecao.saldoFinal / 10000, 0, 1) * 10

    const componentes: ComponenteSaude[] = [
      {
        nome: 'Inadimplência', score: Math.round(sInad), max: 25,
        detalhe: ratioInad > 0
          ? `${pct(ratioInad)} dos recebíveis estão vencidos`
          : 'Sem inadimplência registrada',
      },
      {
        nome: 'Lucratividade', score: Math.round(sLucro), max: 30,
        detalhe: dash.recebidoMes > 0
          ? `Lucro equivale a ${pct(ratioLucro)} do recebido no mês`
          : 'Sem recebimentos no mês para avaliar',
      },
      {
        nome: 'Diversificação de receita', score: Math.round(sCat), max: 20,
        detalhe: totalCat > 0
          ? `Maior categoria concentra ${pct(shareCat)} da receita`
          : 'Sem receita categorizada no mês',
      },
      {
        nome: 'Dependência de profissional', score: Math.round(sProf), max: 15,
        detalhe: totalProf > 0
          ? `Profissional principal gera ${pct(shareProf)} do faturamento`
          : 'Sem faturamento por profissional no mês',
      },
      {
        nome: 'Projeção de caixa', score: Math.round(sCaixa), max: 10,
        detalhe: dash.projecao.saldoFinal >= 0
          ? 'Saldo projetado do período é positivo'
          : 'Saldo projetado do período é negativo',
      },
    ]

    const score = Math.round(componentes.reduce((s, c) => s + c.score, 0))
    const classificacao = score >= 75 ? 'saudavel' : score >= 50 ? 'atencao' : 'risco'

    return { data: { score, classificacao, componentes }, error: null }
  } catch (e: any) {
    return { data: null, error: e?.message || 'erro ao calcular saúde financeira' }
  }
}
