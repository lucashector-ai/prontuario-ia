'use client'

import { ButtonHTMLAttributes, forwardRef } from 'react'
import { tokens } from '@/lib/design-tokens'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  size?: Size
  loading?: boolean
  fullWidth?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

const SIZE: Record<Size, { h: number; px: number; fs: number; gap: number }> = {
  sm: { h: 32, px: 12, fs: 13, gap: 6 },
  md: { h: 40, px: 16, fs: 14, gap: 8 },
  lg: { h: 48, px: 20, fs: 15, gap: 10 },
}

const VARIANT: Record<Variant, React.CSSProperties> = {
  primary:   { background: tokens.brand.primary, color: tokens.text.inverse, border: `1px solid ${tokens.brand.primary}` },
  secondary: { background: tokens.bg.card, color: tokens.text.primary, border: `1px solid ${tokens.border.default}` },
  ghost:     { background: 'transparent', color: tokens.text.primary, border: '1px solid transparent' },
  danger:    { background: tokens.status.danger, color: tokens.text.inverse, border: `1px solid ${tokens.status.danger}` },
}

const HOVER_BG: Record<Variant, string> = {
  primary: tokens.brand.primaryHover,
  secondary: tokens.bg.hover,
  ghost: tokens.bg.hover,
  danger: tokens.status.dangerHover,
}

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = 'primary', size = 'md', loading, fullWidth, leftIcon, rightIcon, disabled, children, style, onMouseEnter, onMouseLeave, ...rest },
  ref,
) {
  const s = SIZE[size]
  const v = VARIANT[variant]
  const isDisabled = disabled || loading

  return (
    <button
      ref={ref}
      disabled={isDisabled}
      onMouseEnter={(e) => {
        if (!isDisabled) (e.currentTarget.style.background = HOVER_BG[variant])
        onMouseEnter?.(e)
      }}
      onMouseLeave={(e) => {
        if (!isDisabled) (e.currentTarget.style.background = (v.background as string) || 'transparent')
        onMouseLeave?.(e)
      }}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: s.gap,
        height: s.h,
        padding: `0 ${s.px}px`,
        fontSize: s.fs,
        fontWeight: 600,
        borderRadius: tokens.radius.lg,
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        opacity: isDisabled ? 0.55 : 1,
        transition: 'background 120ms ease, transform 80ms ease',
        width: fullWidth ? '100%' : undefined,
        ...v,
        ...style,
      }}
      {...rest}
    >
      {loading ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ animation: 'btnSpin 0.7s linear infinite' }}>
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
          <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
      ) : leftIcon}
      {children}
      {!loading && rightIcon}
      <style>{`@keyframes btnSpin { to { transform: rotate(360deg) } }`}</style>
    </button>
  )
})
