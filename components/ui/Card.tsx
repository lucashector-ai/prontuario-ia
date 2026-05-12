'use client'

import { HTMLAttributes, forwardRef } from 'react'
import { tokens } from '@/lib/design-tokens'

type Variant = 'default' | 'elevated' | 'ghost'

type Props = HTMLAttributes<HTMLDivElement> & {
  variant?: Variant
  padding?: number | string
  interactive?: boolean
}

const VARIANT: Record<Variant, React.CSSProperties> = {
  default:  { background: tokens.bg.card, border: `1px solid ${tokens.border.default}`, boxShadow: 'none' },
  elevated: { background: tokens.bg.card, border: `1px solid ${tokens.border.subtle}`, boxShadow: tokens.shadow.card },
  ghost:    { background: 'transparent', border: `1px solid transparent`, boxShadow: 'none' },
}

export const Card = forwardRef<HTMLDivElement, Props>(function Card(
  { variant = 'default', padding = 20, interactive, style, onMouseEnter, onMouseLeave, ...rest },
  ref,
) {
  const v = VARIANT[variant]
  return (
    <div
      ref={ref}
      onMouseEnter={(e) => {
        if (interactive) {
          e.currentTarget.style.borderColor = tokens.border.strong
          e.currentTarget.style.transform = 'translateY(-1px)'
        }
        onMouseEnter?.(e)
      }}
      onMouseLeave={(e) => {
        if (interactive) {
          e.currentTarget.style.borderColor = (v.border as string).split(' ')[2] || tokens.border.default
          e.currentTarget.style.transform = 'translateY(0)'
        }
        onMouseLeave?.(e)
      }}
      style={{
        borderRadius: tokens.radius['3xl'],
        padding,
        transition: 'border-color 140ms ease, transform 140ms ease, box-shadow 140ms ease',
        cursor: interactive ? 'pointer' : 'default',
        ...v,
        ...style,
      }}
      {...rest}
    />
  )
})
