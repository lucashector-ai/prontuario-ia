import { HTMLAttributes } from 'react'
import { tokens } from '@/lib/design-tokens'

type Variant = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info'
type Size = 'sm' | 'md'

type Props = HTMLAttributes<HTMLSpanElement> & {
  variant?: Variant
  size?: Size
  dot?: boolean
}

const VARIANT: Record<Variant, { bg: string; text: string; dot: string }> = {
  neutral: { bg: tokens.bg.cardSubtle, text: tokens.text.strong, dot: tokens.text.tertiary },
  brand:   { bg: tokens.brand.primaryLighter, text: tokens.brand.primaryDarkText, dot: tokens.brand.primary },
  success: { bg: tokens.status.successBg, text: tokens.status.successDark, dot: tokens.status.success },
  warning: { bg: tokens.status.warningBg, text: tokens.status.warningTextDark, dot: tokens.status.warning },
  danger:  { bg: tokens.status.dangerBg, text: tokens.status.dangerDark, dot: tokens.status.danger },
  info:    { bg: tokens.status.infoSkyBgSoft, text: tokens.status.infoSkyDarker, dot: tokens.status.infoSkyStrong },
}

const SIZE: Record<Size, { fs: number; px: number; py: number; gap: number; dot: number }> = {
  sm: { fs: 11, px: 8,  py: 2, gap: 5, dot: 5 },
  md: { fs: 12, px: 10, py: 4, gap: 6, dot: 6 },
}

export function Badge({ variant = 'neutral', size = 'md', dot, style, children, ...rest }: Props) {
  const v = VARIANT[variant]
  const s = SIZE[size]
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: s.gap,
        background: v.bg,
        color: v.text,
        padding: `${s.py}px ${s.px}px`,
        fontSize: s.fs,
        fontWeight: 600,
        borderRadius: tokens.radius.full,
        lineHeight: 1.2,
        whiteSpace: 'nowrap',
        ...style,
      }}
      {...rest}
    >
      {dot && (
        <span
          aria-hidden
          style={{ width: s.dot, height: s.dot, borderRadius: '50%', background: v.dot }}
        />
      )}
      {children}
    </span>
  )
}
