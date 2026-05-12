'use client'

import { useEffect, useState } from 'react'
import { tokens } from '@/lib/design-tokens'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { FadeIn } from '@/components/motion/FadeIn'
import { PeriodoSelect, type PeriodoValor } from '../_components/PeriodoSelect'
import { useClinicaId } from '@/lib/financeiro/clinica'
import { calcularComissoesPeriodo } from '@/lib/financeiro/queries'
import { moeda, percentual } from '@/lib/financeiro/format'

type Row = {
  medicoId: string
  nome: string
  receita: number
  comissao: number
  config?: {
    tipo_calculo: 'percentual_consulta' | 'percentual_procedimento' | 'fixo'
    percentual?: number | null
    valor_fixo?: number | null
  }
}

export default function ComissoesPage() {
  const { clinicaId, loading: loadingClinica } = useClinicaId()
  const [periodo, setPeriodo] = useState<PeriodoValor>(30)
  const [linhas, setLinhas] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (loadingClinica || !clinicaId) return
    let alive = true
    setLoading(true)
    calcularComissoesPeriodo(clinicaId, periodo).then((rows) => {
      if (alive) {
        setLinhas(rows as Row[])
        setLoading(false)
      }
    })
    return () => { alive = false }
  }, [clinicaId, periodo, loadingClinica])

  const totalReceita = linhas.reduce((s, r) => s + r.receita, 0)
  const totalComissao = linhas.reduce((s, r) => s + r.comissao, 0)
  const maxReceita = Math.max(1, ...linhas.map((r) => r.receita))

  return (
    <FadeIn>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
        <div>
          <span style={{ fontSize: 12, fontWeight: 600, color: tokens.brand.primary, letterSpacing: 0.6, textTransform: 'uppercase' }}>Financeiro</span>
          <h1 style={{ margin: '8px 0 0', fontSize: 28, fontWeight: 700, letterSpacing: -0.5, color: tokens.text.primary }}>Comissões</h1>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: tokens.text.secondary }}>
            Receita e comissão por médico no período. Configure em <a href="/financeiro" style={{ color: tokens.brand.primary, textDecoration: 'none', fontWeight: 500 }}>Financeiro → Comissões</a>.
          </p>
        </div>
        <PeriodoSelect value={periodo} onChange={setPeriodo} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12, marginBottom: 16 }}>
        <Card variant="elevated">
          <div style={{ fontSize: 12, fontWeight: 600, color: tokens.text.tertiary, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 }}>Receita total</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: tokens.text.primary }}>{moeda(totalReceita)}</div>
        </Card>
        <Card variant="elevated">
          <div style={{ fontSize: 12, fontWeight: 600, color: tokens.text.tertiary, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 }}>Comissão total</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: tokens.brand.primary }}>{moeda(totalComissao)}</div>
        </Card>
        <Card variant="elevated">
          <div style={{ fontSize: 12, fontWeight: 600, color: tokens.text.tertiary, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 }}>% da receita</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: tokens.text.primary }}>
            {totalReceita > 0 ? `${((totalComissao / totalReceita) * 100).toFixed(1)}%` : '—'}
          </div>
        </Card>
      </div>

      <Card variant="elevated" padding={0}>
        <div style={{ padding: '18px 20px', borderBottom: `1px solid ${tokens.border.subtle}` }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: tokens.text.primary }}>Ranking de médicos</h2>
        </div>
        {loading ? (
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[0, 1, 2].map((i) => <Skeleton key={i} height={56} />)}
          </div>
        ) : linhas.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: tokens.text.tertiary, fontSize: 14 }}>
            Nenhum médico cadastrado nessa clínica.
          </div>
        ) : (
          <div>
            {linhas.map((r, i) => {
              const w = (r.receita / maxReceita) * 100
              return (
                <div key={r.medicoId} style={{ padding: '14px 20px', borderTop: i === 0 ? 'none' : `1px solid ${tokens.border.subtle}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: 8,
                        background: tokens.brand.primaryLighter, color: tokens.brand.primaryDarkText,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 12, fontWeight: 600, flexShrink: 0,
                      }}>{i + 1}</div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: tokens.text.primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.nome}</div>
                        <div style={{ fontSize: 12, color: tokens.text.tertiary, marginTop: 2 }}>
                          {r.config ? (
                            r.config.tipo_calculo === 'fixo'
                              ? `Fixo · ${moeda(Number(r.config.valor_fixo) || 0)}`
                              : `${percentual(Number(r.config.percentual) || 0).replace('+', '')} ${r.config.tipo_calculo === 'percentual_consulta' ? 'por consulta' : 'por procedimento'}`
                          ) : (
                            <Badge size="sm">Sem regra configurada</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: tokens.text.primary }}>{moeda(r.receita)}</div>
                      <div style={{ fontSize: 12, color: tokens.brand.primary, fontWeight: 500 }}>{moeda(r.comissao)}</div>
                    </div>
                  </div>
                  <div style={{ height: 6, background: tokens.bg.cardSubtle, borderRadius: 999, overflow: 'hidden' }}>
                    <div style={{
                      width: `${w}%`,
                      height: '100%',
                      background: `linear-gradient(90deg, ${tokens.brand.primary}, ${tokens.brand.primaryDarker})`,
                      borderRadius: 999,
                      transition: 'width 400ms ease',
                    }} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>
    </FadeIn>
  )
}
