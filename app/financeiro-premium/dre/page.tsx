'use client'

import { useEffect, useMemo, useState } from 'react'
import { tokens } from '@/lib/design-tokens'
import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { FadeIn } from '@/components/motion/FadeIn'
import { PeriodoSelect, type PeriodoValor } from '../_components/PeriodoSelect'
import { useClinicaId } from '@/lib/financeiro/clinica'
import { listarMovimentacoes } from '@/lib/financeiro/queries'
import type { Movimentacao } from '@/lib/financeiro/types'
import { moeda } from '@/lib/financeiro/format'

type Bucket = { categoria: string; cor?: string; total: number; pct: number }

export default function DREPage() {
  const { clinicaId, loading: loadingClinica } = useClinicaId()
  const [periodo, setPeriodo] = useState<PeriodoValor>(30)
  const [movs, setMovs] = useState<Movimentacao[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (loadingClinica || !clinicaId) return
    let alive = true
    setLoading(true)
    const fim = new Date()
    const ini = new Date()
    ini.setDate(fim.getDate() - periodo)
    listarMovimentacoes(clinicaId, {
      inicio: ini.toISOString().split('T')[0],
      fim: fim.toISOString().split('T')[0],
      limit: 2000,
    }).then((m) => {
      if (alive) {
        setMovs(m.filter((x) => x.status !== 'cancelado'))
        setLoading(false)
      }
    })
    return () => { alive = false }
  }, [clinicaId, periodo, loadingClinica])

  const { receitas, despesas, totalReceita, totalDespesa, margem } = useMemo(() => {
    const recMap = new Map<string, Bucket>()
    const desMap = new Map<string, Bucket>()
    let totR = 0
    let totD = 0
    for (const m of movs) {
      const cat = m.categoria?.nome || 'Sem categoria'
      const cor = m.categoria?.cor || undefined
      const v = Number(m.valor) || 0
      const map = m.tipo === 'receita' ? recMap : desMap
      if (m.tipo === 'receita') totR += v
      else totD += v
      const cur = map.get(cat) || { categoria: cat, cor, total: 0, pct: 0 }
      cur.total += v
      cur.cor = cor || cur.cor
      map.set(cat, cur)
    }
    const finalize = (m: Map<string, Bucket>, total: number) =>
      Array.from(m.values())
        .map((b) => ({ ...b, pct: total > 0 ? (b.total / total) * 100 : 0 }))
        .sort((a, b) => b.total - a.total)
    return {
      receitas: finalize(recMap, totR),
      despesas: finalize(desMap, totD),
      totalReceita: totR,
      totalDespesa: totD,
      margem: totR > 0 ? ((totR - totD) / totR) * 100 : 0,
    }
  }, [movs])

  return (
    <FadeIn>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
        <div>
          <span style={{ fontSize: 12, fontWeight: 600, color: tokens.brand.primary, letterSpacing: 0.6, textTransform: 'uppercase' }}>Financeiro</span>
          <h1 style={{ margin: '8px 0 0', fontSize: 28, fontWeight: 700, letterSpacing: -0.5, color: tokens.text.primary }}>DRE simplificada</h1>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: tokens.text.secondary }}>
            Receitas e despesas agrupadas por categoria. Ideal pra fechar o mês.
          </p>
        </div>
        <PeriodoSelect value={periodo} onChange={setPeriodo} />
      </div>

      {loading ? (
        <Skeleton height={420} style={{ borderRadius: tokens.radius['3xl'] }} />
      ) : (
        <Card variant="elevated" padding={0}>
          <div style={{ padding: '18px 20px', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, borderBottom: `1px solid ${tokens.border.subtle}` }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: tokens.text.tertiary, textTransform: 'uppercase', letterSpacing: 0.6 }}>Resultado</div>
              <div style={{
                fontSize: 28, fontWeight: 700,
                color: totalReceita - totalDespesa >= 0 ? tokens.status.successDark : tokens.status.dangerDark,
                marginTop: 4,
              }}>
                {moeda(totalReceita - totalDespesa)}
              </div>
              <div style={{ fontSize: 12, color: tokens.text.tertiary, marginTop: 2 }}>
                Margem operacional: <strong style={{ color: tokens.text.strong, fontWeight: 600 }}>{margem.toFixed(1)}%</strong>
              </div>
            </div>
          </div>

          <Secao titulo="Receitas" total={totalReceita} buckets={receitas} cor={tokens.status.success} />
          <Secao titulo="Despesas" total={totalDespesa} buckets={despesas} cor={tokens.status.danger} />
        </Card>
      )}
    </FadeIn>
  )
}

function Secao({ titulo, total, buckets, cor }: { titulo: string; total: number; buckets: Bucket[]; cor: string }) {
  return (
    <div>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '14px 20px',
        background: tokens.bg.muted,
        borderTop: `1px solid ${tokens.border.subtle}`,
      }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: tokens.text.strong }}>{titulo}</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: cor }}>{moeda(total)}</div>
      </div>
      {buckets.length === 0 ? (
        <div style={{ padding: '18px 20px', fontSize: 13, color: tokens.text.tertiary }}>Nada nessa categoria no período.</div>
      ) : (
        buckets.map((b, i) => (
          <div key={i} style={{ padding: '12px 20px', borderTop: `1px solid ${tokens.border.subtle}`, display: 'flex', alignItems: 'center', gap: 12 }}>
            <span aria-hidden style={{ width: 8, height: 8, borderRadius: '50%', background: b.cor || cor, flexShrink: 0 }} />
            <span style={{ fontSize: 14, color: tokens.text.primary, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {b.categoria}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 12, color: tokens.text.tertiary, minWidth: 50, textAlign: 'right' }}>{b.pct.toFixed(1)}%</span>
              <strong style={{ fontSize: 14, color: tokens.text.primary, fontWeight: 600, minWidth: 100, textAlign: 'right' }}>{moeda(b.total)}</strong>
            </div>
          </div>
        ))
      )}
    </div>
  )
}
