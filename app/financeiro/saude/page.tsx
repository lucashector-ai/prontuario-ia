'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/useAuth'
import { tokens } from '@/lib/design-tokens'
import { obterSaudeFinanceira, type SaudeFinanceira } from '@/lib/financeiro/saude'
import { PageHeader } from '@/components/ui'

const CLASSIF = {
  saudavel: { label: 'Saudável', cor: tokens.status.success },
  atencao: { label: 'Requer atenção', cor: tokens.status.warningAmberStrong },
  risco: { label: 'Em risco', cor: tokens.status.danger },
}

export default function SaudeFinanceiraPage() {
  const router = useRouter()
  const { usuario } = useAuth()
  const clinicaId = usuario?.clinica_id || null

  const [saude, setSaude] = useState<SaudeFinanceira | null>(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    if (!clinicaId) return
    obterSaudeFinanceira(clinicaId).then(({ data }) => {
      setSaude(data)
      setCarregando(false)
    })
  }, [clinicaId])

  const classif = saude ? CLASSIF[saude.classificacao] : CLASSIF.atencao
  const score = saude?.score ?? 0
  const R = 52
  const circ = 2 * Math.PI * R
  const dash = circ * (score / 100)

  return (
    <div style={{ padding: 24 }}>
      <PageHeader
        titulo="Cofre financeiro"
        descricao="Um índice de saúde financeira da clínica, de 0 a 100."
      />

      {carregando ? (
        <p style={{ fontSize: 13, color: tokens.text.tertiary }}>Calculando...</p>
      ) : !saude ? (
        <p style={{ fontSize: 13, color: tokens.text.tertiary }}>Sem dados suficientes.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, alignItems: 'start' }}>
          {/* Score */}
          <div style={{
            background: tokens.bg.card, border: `1px solid ${tokens.border.subtle}`,
            borderRadius: 16, padding: 28, display: 'flex', flexDirection: 'column', alignItems: 'center',
          }}>
            <svg width="140" height="140" viewBox="0 0 140 140">
              <circle cx="70" cy="70" r={R} fill="none" stroke={tokens.border.subtle} strokeWidth="12" />
              <circle
                cx="70" cy="70" r={R} fill="none" stroke={classif.cor} strokeWidth="12" strokeLinecap="round"
                strokeDasharray={`${dash} ${circ}`} transform="rotate(-90 70 70)"
              />
              <text x="70" y="68" textAnchor="middle" fontSize="34" fontWeight="700" fill={tokens.text.primary}>{score}</text>
              <text x="70" y="88" textAnchor="middle" fontSize="11" fill={tokens.text.tertiary}>de 100</text>
            </svg>
            <span style={{
              marginTop: 12, padding: '5px 14px', borderRadius: 100, fontSize: 12.5, fontWeight: 700,
              background: classif.cor + '20', color: classif.cor,
            }}>{classif.label}</span>
          </div>

          {/* Componentes */}
          <div style={{
            background: tokens.bg.card, border: `1px solid ${tokens.border.subtle}`,
            borderRadius: 16, padding: 22, gridColumn: 'span 2', minWidth: 0,
          }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: tokens.text.primary, margin: '0 0 14px' }}>
              O que compõe o índice
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {saude.componentes.map((c) => {
                const ratio = c.max > 0 ? c.score / c.max : 0
                const cor = ratio >= 0.7 ? tokens.status.success
                  : ratio >= 0.4 ? tokens.status.warningAmberStrong : tokens.status.danger
                return (
                  <div key={c.nome}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: tokens.text.primary }}>{c.nome}</span>
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: cor, fontVariantNumeric: 'tabular-nums' }}>
                        {c.score}/{c.max}
                      </span>
                    </div>
                    <div style={{ height: 7, borderRadius: 99, background: tokens.bg.cardSubtle, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${ratio * 100}%`, background: cor, borderRadius: 99 }} />
                    </div>
                    <p style={{ fontSize: 11.5, color: tokens.text.tertiary, margin: '5px 0 0' }}>{c.detalhe}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      <button onClick={() => router.push('/financeiro')} style={{
        marginTop: 16, padding: '6px 11px', borderRadius: 8, border: 'none',
        background: 'transparent', color: tokens.brand.primary, fontSize: 12, fontWeight: 600, cursor: 'pointer',
      }}>← Voltar ao financeiro</button>
    </div>
  )
}
