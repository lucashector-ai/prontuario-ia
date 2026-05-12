'use client'

import { useEffect, useState } from 'react'
import { tokens } from '@/lib/design-tokens'
import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { FadeIn } from '@/components/motion/FadeIn'
import { KPICard } from './_components/KPICard'
import { FluxoCaixaChart } from './_components/FluxoCaixaChart'
import { PeriodoSelect, type PeriodoValor } from './_components/PeriodoSelect'
import { useClinicaId } from '@/lib/financeiro/clinica'
import { calcularKPIs, fluxoCaixaDiario, listarMovimentacoes } from '@/lib/financeiro/queries'
import type { FluxoDiario, KPIs, Movimentacao } from '@/lib/financeiro/types'
import { dataBR, moeda } from '@/lib/financeiro/format'

export default function FinanceiroPremiumOverview() {
  const { clinicaId, loading: loadingClinica } = useClinicaId()
  const [periodo, setPeriodo] = useState<PeriodoValor>(30)
  const [kpis, setKpis] = useState<KPIs | null>(null)
  const [serie, setSerie] = useState<FluxoDiario[]>([])
  const [ultimas, setUltimas] = useState<Movimentacao[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (loadingClinica || !clinicaId) return
    let alive = true
    setLoading(true)
    Promise.all([
      calcularKPIs(clinicaId, periodo),
      fluxoCaixaDiario(clinicaId, periodo),
      listarMovimentacoes(clinicaId, { limit: 8 }),
    ]).then(([k, s, m]) => {
      if (!alive) return
      setKpis(k)
      setSerie(s)
      setUltimas(m)
      setLoading(false)
    })
    return () => { alive = false }
  }, [clinicaId, periodo, loadingClinica])

  return (
    <FadeIn>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
        <div>
          <span style={{ fontSize: 12, fontWeight: 600, color: tokens.brand.primary, letterSpacing: 0.6, textTransform: 'uppercase' }}>
            Financeiro
          </span>
          <h1 style={{ margin: '8px 0 0', fontSize: 32, fontWeight: 700, letterSpacing: -0.6, color: tokens.text.primary, lineHeight: 1.1 }}>
            Visão geral
          </h1>
        </div>
        <PeriodoSelect value={periodo} onChange={setPeriodo} />
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 16 }}>
        {loading || !kpis ? (
          <>
            <Skeleton height={120} style={{ borderRadius: tokens.radius['3xl'] }} />
            <Skeleton height={120} style={{ borderRadius: tokens.radius['3xl'] }} />
            <Skeleton height={120} style={{ borderRadius: tokens.radius['3xl'] }} />
            <Skeleton height={120} style={{ borderRadius: tokens.radius['3xl'] }} />
          </>
        ) : (
          <>
            <KPICard label="Receita"     valor={kpis.receita}  variacao={kpis.variacaoReceita} variant="positive" icon={<UpIcon />} />
            <KPICard label="Despesa"     valor={kpis.despesa}  variacao={kpis.variacaoDespesa} variant="negative" icon={<DownIcon />} />
            <KPICard label="Lucro"       valor={kpis.lucro}                                       variant={kpis.lucro >= 0 ? 'positive' : 'negative'} icon={<TrendIcon />} />
            <KPICard label="A receber"   valor={kpis.aReceber} hint="Cobranças em aberto" variant="default" icon={<ClockIcon />} />
          </>
        )}
      </div>

      {/* Gráfico */}
      <Card variant="elevated" padding={20} style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: tokens.text.primary }}>Fluxo de caixa diário</h2>
          <span style={{ fontSize: 12, color: tokens.text.tertiary }}>{serie.length} dias</span>
        </div>
        {loading ? (
          <Skeleton height={220} style={{ borderRadius: tokens.radius.xl }} />
        ) : (
          <FluxoCaixaChart serie={serie} />
        )}
      </Card>

      {/* Últimas movimentações */}
      <Card variant="elevated" padding={0}>
        <div style={{ padding: '18px 20px', borderBottom: `1px solid ${tokens.border.subtle}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: tokens.text.primary }}>Últimas movimentações</h2>
          <a href="/financeiro-premium/movimentacoes" style={{ fontSize: 13, color: tokens.brand.primary, textDecoration: 'none', fontWeight: 500 }}>
            Ver tudo →
          </a>
        </div>
        {loading ? (
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[0, 1, 2].map((i) => <Skeleton key={i} height={44} />)}
          </div>
        ) : ultimas.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: tokens.text.tertiary, fontSize: 14 }}>
            Nenhuma movimentação ainda no período.
          </div>
        ) : (
          <div>
            {ultimas.map((m) => <LinhaMov key={m.id} m={m} />)}
          </div>
        )}
      </Card>
    </FadeIn>
  )
}

function LinhaMov({ m }: { m: Movimentacao }) {
  const receita = m.tipo === 'receita'
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 20px',
        borderBottom: `1px solid ${tokens.border.subtle}`,
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: receita ? tokens.status.successBg : tokens.status.dangerBg,
          color: receita ? tokens.status.success : tokens.status.danger,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          {receita ? <UpIcon /> : <DownIcon />}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: tokens.text.primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {m.descricao || m.categoria?.nome || (receita ? 'Receita' : 'Despesa')}
          </div>
          <div style={{ fontSize: 12, color: tokens.text.tertiary, marginTop: 2 }}>
            {dataBR(m.data_movimentacao)}{m.pacientes?.nome ? ` · ${m.pacientes.nome}` : ''}
          </div>
        </div>
      </div>
      <div style={{
        fontSize: 14, fontWeight: 600,
        color: receita ? tokens.status.successDark : tokens.status.dangerDark,
        whiteSpace: 'nowrap',
      }}>
        {receita ? '+' : '−'} {moeda(m.valor)}
      </div>
    </div>
  )
}

function UpIcon()    { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 14 12 8 18 14"/></svg> }
function DownIcon()  { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 10 12 16 18 10"/></svg> }
function TrendIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 17 9 11 13 15 21 7"/><polyline points="14 7 21 7 21 14"/></svg> }
function ClockIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg> }
