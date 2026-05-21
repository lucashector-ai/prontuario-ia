'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/useAuth'
import { tokens } from '@/lib/design-tokens'
import { obterMetricasFinanceiras } from '@/lib/financeiro/dashboard'
import type { MetricasFinanceiras } from '@/lib/financeiro/types'

const brl = (v: number) =>
  'R$ ' + (Number(v) || 0).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')

function delta(atual: number, anterior: number): { texto: string; positivo: boolean } | null {
  if (!anterior) return null
  const pct = ((atual - anterior) / anterior) * 100
  if (!isFinite(pct) || Math.abs(pct) < 0.5) return null
  return { texto: `${pct > 0 ? '+' : ''}${pct.toFixed(0)}% vs mês anterior`, positivo: pct >= 0 }
}

export default function FinanceiroPage() {
  const router = useRouter()
  const { usuario } = useAuth()
  const clinicaId = usuario?.clinica_id || null

  const [m, setM] = useState<MetricasFinanceiras | null>(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    if (!clinicaId) return
    obterMetricasFinanceiras(clinicaId).then(({ data }) => {
      setM(data)
      setCarregando(false)
    })
  }, [clinicaId])

  const cards = [
    { label: 'Faturamento do mês', valor: m?.faturamentoMes ?? 0, delta: m ? delta(m.faturamentoMes, m.faturamentoMesAnterior) : null },
    { label: 'Recebido no mês', valor: m?.recebidoMes ?? 0, delta: m ? delta(m.recebidoMes, m.recebidoMesAnterior) : null },
    { label: 'A receber', valor: m?.aReceber ?? 0, delta: null },
    { label: 'Ticket médio', valor: m?.ticketMedio ?? 0, delta: null },
  ]

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: tokens.text.primary, margin: 0 }}>
        Financeiro
      </h1>
      <p style={{ fontSize: 13, color: tokens.text.secondary, margin: '4px 0 22px' }}>
        Acompanhe receita, recebimentos e saúde financeira da clínica.
      </p>

      {/* Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        {cards.map((c) => (
          <div key={c.label} style={{
            background: tokens.bg.card, border: `1px solid ${tokens.border.subtle}`,
            borderRadius: 14, padding: '18px 20px',
          }}>
            <p style={{ fontSize: 13, color: tokens.text.secondary, margin: 0 }}>{c.label}</p>
            <p style={{
              fontSize: 28, fontWeight: 600, color: tokens.text.primary,
              margin: '8px 0 0', fontVariantNumeric: 'tabular-nums',
            }}>
              {carregando ? '—' : brl(c.valor)}
            </p>
            {c.delta && (
              <p style={{
                fontSize: 11.5, fontWeight: 600, margin: '5px 0 0',
                color: c.delta.positivo ? tokens.status.success : tokens.status.danger,
              }}>
                {c.delta.texto}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Navegação */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 22 }}>
        <button onClick={() => router.push('/financeiro/recebimentos')} style={navCard}>
          <span style={{ fontSize: 14, fontWeight: 600, color: tokens.text.primary }}>Contas a receber</span>
          <span style={{ fontSize: 16, color: tokens.brand.primary }}>→</span>
        </button>
        <div style={{ ...navCard, cursor: 'default', opacity: 0.7 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: tokens.text.primary }}>Contas a pagar</span>
          <span style={{
            fontSize: 10.5, fontWeight: 700, padding: '3px 9px', borderRadius: 100,
            background: tokens.bg.cardSubtle, color: tokens.text.tertiary,
            textTransform: 'uppercase', letterSpacing: '0.03em',
          }}>Em breve</span>
        </div>
      </div>
    </div>
  )
}

const navCard: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
  minWidth: 240, padding: '16px 20px', borderRadius: 14,
  background: tokens.bg.card, border: `1px solid ${tokens.border.subtle}`,
  cursor: 'pointer',
}
