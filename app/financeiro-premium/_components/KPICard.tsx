import { tokens } from '@/lib/design-tokens'
import { Card } from '@/components/ui/Card'
import { moeda, percentual } from '@/lib/financeiro/format'

type Props = {
  label: string
  valor: number
  variacao?: number
  hint?: string
  icon?: React.ReactNode
  variant?: 'default' | 'positive' | 'negative' | 'neutral'
}

const VARIANT_COLOR: Record<NonNullable<Props['variant']>, string> = {
  default:  tokens.brand.primary,
  positive: tokens.status.success,
  negative: tokens.status.danger,
  neutral:  tokens.text.tertiary,
}

export function KPICard({ label, valor, variacao, hint, icon, variant = 'default' }: Props) {
  const color = VARIANT_COLOR[variant]
  const variacaoUp = variacao !== undefined && variacao >= 0
  const variacaoColor = variacao === undefined
    ? tokens.text.tertiary
    : (variant === 'negative'
        ? (variacaoUp ? tokens.status.danger : tokens.status.success)
        : (variacaoUp ? tokens.status.success : tokens.status.danger))

  return (
    <Card variant="elevated" padding={20}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        {icon && (
          <div style={{
            width: 32, height: 32, borderRadius: 9,
            background: `${color}1A`,
            color,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {icon}
          </div>
        )}
        <span style={{ fontSize: 12, fontWeight: 600, color: tokens.text.tertiary, textTransform: 'uppercase', letterSpacing: 0.6 }}>
          {label}
        </span>
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, color: tokens.text.primary, letterSpacing: -0.4, lineHeight: 1.1 }}>
        {moeda(valor)}
      </div>
      <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
        {variacao !== undefined && Math.abs(variacao) > 0.01 && (
          <span style={{ color: variacaoColor, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" style={{ transform: variacaoUp ? 'none' : 'rotate(180deg)' }}>
              <polyline points="6 12 12 6 18 12"/>
              <line x1="12" y1="6" x2="12" y2="20"/>
            </svg>
            {percentual(variacao)}
          </span>
        )}
        {hint && <span style={{ color: tokens.text.tertiary }}>{hint}</span>}
      </div>
    </Card>
  )
}
