'use client'

import { useEffect, useMemo, useState } from 'react'
import { tokens } from '@/lib/design-tokens'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { FadeIn } from '@/components/motion/FadeIn'
import { SectionHeader } from '../_components/SectionHeader'
import { useClinicaId } from '@/lib/financeiro/clinica'
import { listarProcedimentosRealizados } from '@/lib/estoque/queries'
import type { ProcedimentoRealizado } from '@/lib/estoque/types'
import { moeda, dataBR } from '@/lib/financeiro/format'

export default function ProcedimentosHistoricoPage() {
  const { clinicaId, loading: loadingClinica } = useClinicaId()
  const [items, setItems] = useState<ProcedimentoRealizado[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (loadingClinica || !clinicaId) return
    let alive = true
    setLoading(true)
    listarProcedimentosRealizados(clinicaId).then((i) => {
      if (alive) {
        setItems(i)
        setLoading(false)
      }
    })
    return () => { alive = false }
  }, [clinicaId, loadingClinica])

  const totais = useMemo(() => {
    let receita = 0
    let custo = 0
    for (const p of items) {
      receita += Number(p.preco_cobrado) || 0
      custo += Number(p.custo_total) || 0
    }
    return {
      receita,
      custo,
      margem: receita - custo,
      margemPct: receita > 0 ? ((receita - custo) / receita) * 100 : 0,
      qtd: items.length,
    }
  }, [items])

  return (
    <FadeIn>
      <SectionHeader
        title="Procedimentos realizados"
        description="Cada procedimento finalizado decrementa estoque e calcula margem real."
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 16 }}>
        <SumCard label="Procedimentos" valor={String(totais.qtd)} />
        <SumCard label="Receita" valor={moeda(totais.receita)} cor={tokens.status.success} />
        <SumCard label="Custo" valor={moeda(totais.custo)} cor={tokens.status.danger} />
        <SumCard label="Margem" valor={`${moeda(totais.margem)} (${totais.margemPct.toFixed(1)}%)`} cor={tokens.brand.primary} />
      </div>

      <Card variant="elevated" padding={0}>
        {loading ? (
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[0, 1, 2].map((i) => <Skeleton key={i} height={56} />)}
          </div>
        ) : items.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: tokens.text.tertiary, fontSize: 14, lineHeight: 1.5 }}>
            Nenhum procedimento finalizado ainda. Cada vez que uma consulta for finalizada com produtos consumidos,<br />
            o registro aparece aqui com custo, receita e margem.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ background: tokens.bg.muted }}>
                  <Th>Data</Th>
                  <Th>Procedimento</Th>
                  <Th>Paciente</Th>
                  <Th>Médico</Th>
                  <Th align="right">Receita</Th>
                  <Th align="right">Custo</Th>
                  <Th align="right">Margem</Th>
                  <Th>%</Th>
                </tr>
              </thead>
              <tbody>
                {items.map((p) => {
                  const pct = p.margem_percentual != null ? p.margem_percentual : 0
                  return (
                    <tr key={p.id} style={{ borderTop: `1px solid ${tokens.border.subtle}` }}>
                      <Td muted>{dataBR(p.realizado_em)}</Td>
                      <Td>{p.nome_procedimento || 'Procedimento'}</Td>
                      <Td muted>{p.paciente?.nome || '—'}</Td>
                      <Td muted>{p.medico?.nome || '—'}</Td>
                      <Td align="right" muted>{moeda(p.preco_cobrado)}</Td>
                      <Td align="right" muted>{moeda(p.custo_total)}</Td>
                      <Td align="right">
                        <strong style={{ color: p.margem_valor >= 0 ? tokens.status.successDark : tokens.status.dangerDark, fontWeight: 600 }}>
                          {moeda(p.margem_valor)}
                        </strong>
                      </Td>
                      <Td>
                        <Badge size="sm" variant={pct >= 50 ? 'success' : pct >= 30 ? 'warning' : pct >= 0 ? 'neutral' : 'danger'}>
                          {pct.toFixed(0)}%
                        </Badge>
                      </Td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card style={{ marginTop: 16, background: tokens.brand.primaryLighter, border: `1px solid ${tokens.brand.primaryAccentSoft}` }}>
        <div style={{ fontSize: 13, color: tokens.brand.primaryDarkText, lineHeight: 1.5 }}>
          <strong style={{ fontWeight: 600 }}>Como isso é populado:</strong> a função <code style={{ background: tokens.bg.card, padding: '1px 6px', borderRadius: 4, fontSize: 12 }}>registrarProcedimentoRealizado()</code> em
          {' '}<code style={{ background: tokens.bg.card, padding: '1px 6px', borderRadius: 4, fontSize: 12 }}>lib/estoque/queries.ts</code> recebe produtos usados, decrementa o estoque e calcula margem. O hook de finalizar consulta no app legado precisa chamar essa função (Sprint 6 — merge).
        </div>
      </Card>
    </FadeIn>
  )
}

function SumCard({ label, valor, cor }: { label: string; valor: string; cor?: string }) {
  return (
    <Card variant="elevated" padding={16}>
      <div style={{ fontSize: 11, fontWeight: 600, color: tokens.text.tertiary, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: cor || tokens.text.primary, lineHeight: 1.2 }}>{valor}</div>
    </Card>
  )
}

function Th({ children, align }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <th style={{
      padding: '12px 16px', fontSize: 11, fontWeight: 600,
      color: tokens.text.tertiary, textTransform: 'uppercase', letterSpacing: 0.6,
      textAlign: align || 'left', whiteSpace: 'nowrap',
    }}>{children}</th>
  )
}

function Td({ children, align, muted }: { children: React.ReactNode; align?: 'left' | 'right'; muted?: boolean }) {
  return (
    <td style={{
      padding: '12px 16px',
      color: muted ? tokens.text.secondary : tokens.text.primary,
      textAlign: align || 'left',
    }}>{children}</td>
  )
}
