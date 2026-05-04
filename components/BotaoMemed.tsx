'use client'

type Props = {
  onClick: () => void
  variant?: 'primary' | 'secondary' | 'compact'
  disabled?: boolean
  disabledReason?: string
}

export function BotaoMemed({ onClick, variant = 'primary', disabled, disabledReason }: Props) {
  const styles = {
    primary: { padding: '10px 18px', fontSize: 13, gap: 8, iconSize: 18 },
    secondary: { padding: '8px 14px', fontSize: 12, gap: 6, iconSize: 16 },
    compact: { padding: '6px 11px', fontSize: 11, gap: 5, iconSize: 13 },
  }[variant]

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={disabled ? disabledReason : 'Prescrever com Memed'}
      style={{
        padding: styles.padding,
        fontSize: styles.fontSize,
        gap: styles.gap,
        background: disabled ? '#f3f4f6' : '#FFFFFF',
        color: disabled ? '#9ca3af' : '#0F766E',
        border: `1px solid ${disabled ? '#e5e7eb' : '#14B8A6'}`,
        borderRadius: 8,
        fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        transition: 'all 0.15s',
      }}
    >
      <img src="/memed-logo.svg" alt="" width={styles.iconSize} height={styles.iconSize} style={{ opacity: disabled ? 0.4 : 1 }}/>
      <span>Prescrever com Memed</span>
    </button>
  )
}
