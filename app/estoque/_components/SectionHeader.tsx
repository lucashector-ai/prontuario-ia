import { tokens } from '@/lib/design-tokens'

export function SectionHeader({
  eyebrow = 'Estoque',
  title,
  description,
  action,
}: {
  eyebrow?: string
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
      <div>
        <span style={{ fontSize: 12, fontWeight: 600, color: tokens.brand.primary, letterSpacing: 0.6, textTransform: 'uppercase' }}>{eyebrow}</span>
        <h1 style={{ margin: '8px 0 0', fontSize: 28, fontWeight: 700, letterSpacing: -0.5, color: tokens.text.primary, lineHeight: 1.1 }}>
          {title}
        </h1>
        {description && (
          <p style={{ margin: '4px 0 0', fontSize: 14, color: tokens.text.secondary, lineHeight: 1.55 }}>
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  )
}
