'use client'

type Props = {
  onClick: () => void
  variant?: 'primary' | 'compact' | 'floating'
  disabled?: boolean
  disabledReason?: string
}

export function BotaoMemed({ onClick, variant = 'primary', disabled, disabledReason }: Props) {
  const cfg = {
    primary:  { padding: '8px 14px',  fontSize: 12, gap: 8,  logoH: 16, label: 'Prescrever com', shadow: false },
    compact:  { padding: '5px 10px',  fontSize: 11, gap: 6,  logoH: 13, label: 'Prescrever com', shadow: false },
    floating: { padding: '12px 18px', fontSize: 13, gap: 10, logoH: 18, label: 'Prescrever com', shadow: true },
  }[variant]

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={disabled ? disabledReason : 'Prescrever com Memed'}
      style={{
        padding: cfg.padding,
        fontSize: cfg.fontSize,
        gap: cfg.gap,
        background: '#FFFFFF',
        color: '#6b7280',
        border: '1px solid #e5e7eb',
        borderRadius: 9,
        fontWeight: 500,
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        opacity: disabled ? 0.45 : 1,
        boxShadow: cfg.shadow ? '0 4px 14px rgba(97,97,255,0.18), 0 1px 2px rgba(0,0,0,0.06)' : 'none',
        transition: 'all 0.15s',
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={(e) => { if (!disabled) { e.currentTarget.style.borderColor = '#6161FF'; e.currentTarget.style.color = '#1f2937' } }}
      onMouseLeave={(e) => { if (!disabled) { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.color = '#6b7280' } }}
    >
      <span>{cfg.label}</span>
      <img src="/memed-logo.svg" alt="Memed" height={cfg.logoH} style={{ height: cfg.logoH, width: 'auto', display: 'block', opacity: disabled ? 0.5 : 1 }}/>
    </button>
  )
}
