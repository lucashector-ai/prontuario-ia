'use client'


import { tokens } from '@/lib/design-tokens'
const ACCENT = tokens.brand.primary
const ACCENT_LIGHT = tokens.brand.primaryLighter

type Hipotese = {
  nome: string
  probabilidade?: 'alta' | 'media' | 'baixa' | string
  justificativa?: string
}

const CORES_PROBABILIDADE: Record<string, { bg: string, text: string, label: string }> = {
  alta:  { bg: tokens.status.successBgAlt, text: tokens.status.successDark, label: 'Alta' },
  media: { bg: tokens.status.warningLightSoft, text: tokens.status.warningTextAlt, label: 'Média' },
  baixa: { bg: tokens.bg.hoverStrong, text: tokens.text.secondary, label: 'Baixa' },
}

export function HipotesesCard({ hipoteses }: { hipoteses: any }) {
  const lista: Hipotese[] = Array.isArray(hipoteses) ? hipoteses : []
  if (lista.length === 0) return null

  return (
    <div style={{ background: 'white', borderRadius: 16, overflow: 'hidden', border: `1px solid ${tokens.bg.hoverStrong}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 20px', background: ACCENT_LIGHT }}>
        <div style={{
          width: 26, height: 26, borderRadius: 7,
          background: 'white', color: ACCENT,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 700,
        }}>
          H
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.06em', color: ACCENT }}>
          Hipóteses diagnósticas
        </span>
      </div>
      <div style={{ padding: 20, display: 'flex', flexDirection: 'column' as const, gap: 12 }}>
        {lista.map((h, i) => {
          const prob = (h.probabilidade || '').toLowerCase()
          const corProb = CORES_PROBABILIDADE[prob] || CORES_PROBABILIDADE.baixa
          return (
            <div key={i} style={{ paddingBottom: i < lista.length - 1 ? 12 : 0, borderBottom: i < lista.length - 1 ? `1px solid ${tokens.bg.hoverStrong}` : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' as const }}>
                <span style={{
                  width: 22, height: 22, borderRadius: '50%',
                  background: ACCENT_LIGHT, color: ACCENT,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700, flexShrink: 0,
                }}>{i + 1}</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: tokens.text.primary }}>{h.nome}</span>
                {h.probabilidade && (
                  <span style={{
                    fontSize: 10, fontWeight: 700,
                    color: corProb.text, background: corProb.bg,
                    padding: '3px 10px', borderRadius: 12,
                    textTransform: 'uppercase' as const, letterSpacing: '0.04em',
                  }}>
                    {corProb.label}
                  </span>
                )}
              </div>
              {h.justificativa && (
                <p style={{ fontSize: 12, color: tokens.text.secondary, margin: '0 0 0 32px', lineHeight: 1.6 }}>
                  {h.justificativa}
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
