'use client'

import { tokens } from '@/lib/design-tokens'

const PERIODOS = [
  { v: 7,   label: '7 dias' },
  { v: 30,  label: '30 dias' },
  { v: 90,  label: '90 dias' },
  { v: 180, label: '6 meses' },
  { v: 365, label: '12 meses' },
] as const

export type PeriodoValor = (typeof PERIODOS)[number]['v']

export function PeriodoSelect({ value, onChange }: { value: PeriodoValor; onChange: (v: PeriodoValor) => void }) {
  return (
    <div style={{ display: 'inline-flex', gap: 2, padding: 3, background: tokens.bg.cardSubtle, borderRadius: tokens.radius.lg }}>
      {PERIODOS.map((p) => {
        const active = p.v === value
        return (
          <button
            key={p.v}
            type="button"
            onClick={() => onChange(p.v)}
            style={{
              padding: '6px 12px',
              fontSize: 13,
              fontWeight: active ? 600 : 500,
              color: active ? tokens.text.primary : tokens.text.secondary,
              background: active ? tokens.bg.card : 'transparent',
              border: 'none',
              borderRadius: tokens.radius.md,
              cursor: 'pointer',
              boxShadow: active ? tokens.shadow.sm : 'none',
              transition: 'all 140ms ease',
            }}
          >
            {p.label}
          </button>
        )
      })}
    </div>
  )
}
