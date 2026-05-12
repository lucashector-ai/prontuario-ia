import { tokens } from '@/lib/design-tokens'

export function PageHeader({
  eyebrow,
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
    <header style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 28 }}>
      {eyebrow && (
        <span style={{ fontSize: 12, fontWeight: 600, color: tokens.brand.primary, letterSpacing: 0.6, textTransform: 'uppercase' }}>
          {eyebrow}
        </span>
      )}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0, fontSize: 32, fontWeight: 700, letterSpacing: -0.6, color: tokens.text.primary, lineHeight: 1.1 }}>
          {title}
        </h1>
        {action}
      </div>
      {description && (
        <p style={{ margin: 0, fontSize: 15, color: tokens.text.secondary, lineHeight: 1.55, maxWidth: 620 }}>
          {description}
        </p>
      )}
    </header>
  )
}
