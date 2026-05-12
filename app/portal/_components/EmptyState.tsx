import { tokens } from '@/lib/design-tokens'

type Props = {
  title: string
  description?: string
  icon?: React.ReactNode
  action?: React.ReactNode
}

export function EmptyState({ title, description, icon, action }: Props) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        padding: '48px 24px',
        background: tokens.bg.card,
        border: `1px dashed ${tokens.border.default}`,
        borderRadius: tokens.radius['3xl'],
      }}
    >
      <div
        aria-hidden
        style={{
          width: 64,
          height: 64,
          borderRadius: 20,
          background: tokens.brand.primaryLighter,
          color: tokens.brand.primary,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 16,
        }}
      >
        {icon || <DefaultIllustration />}
      </div>
      <h3 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: tokens.text.primary }}>{title}</h3>
      {description && (
        <p style={{ margin: '6px 0 0', fontSize: 14, color: tokens.text.secondary, lineHeight: 1.5, maxWidth: 380 }}>
          {description}
        </p>
      )}
      {action && <div style={{ marginTop: 20 }}>{action}</div>}
    </div>
  )
}

function DefaultIllustration() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="16" rx="3"/>
      <path d="M3 10h18"/>
      <path d="M9 16h6"/>
    </svg>
  )
}
