'use client'

import { InputHTMLAttributes, forwardRef, useId, useState } from 'react'
import { tokens } from '@/lib/design-tokens'

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label?: string
  hint?: string
  error?: string
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

export const Input = forwardRef<HTMLInputElement, Props>(function Input(
  { label, hint, error, leftIcon, rightIcon, id, style, onFocus, onBlur, ...rest },
  ref,
) {
  const reactId = useId()
  const inputId = id || reactId
  const [focused, setFocused] = useState(false)

  const borderColor = error
    ? tokens.status.danger
    : focused
    ? tokens.brand.primary
    : tokens.border.default

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
      {label && (
        <label htmlFor={inputId} style={{ fontSize: 13, fontWeight: 500, color: tokens.text.strong }}>
          {label}
        </label>
      )}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: tokens.bg.card,
          border: `1px solid ${borderColor}`,
          borderRadius: tokens.radius.lg,
          padding: '0 12px',
          height: 42,
          transition: 'border-color 120ms ease, box-shadow 120ms ease',
          boxShadow: focused ? `0 0 0 3px ${error ? tokens.status.dangerLight : tokens.brand.primaryLighter}` : 'none',
        }}
      >
        {leftIcon && <span style={{ color: tokens.text.tertiary, display: 'inline-flex' }}>{leftIcon}</span>}
        <input
          ref={ref}
          id={inputId}
          onFocus={(e) => { setFocused(true); onFocus?.(e) }}
          onBlur={(e) => { setFocused(false); onBlur?.(e) }}
          style={{
            flex: 1,
            border: 'none',
            outline: 'none',
            background: 'transparent',
            fontSize: 14,
            color: tokens.text.primary,
            height: '100%',
            ...style,
          }}
          {...rest}
        />
        {rightIcon && <span style={{ color: tokens.text.tertiary, display: 'inline-flex' }}>{rightIcon}</span>}
      </div>
      {error ? (
        <span style={{ fontSize: 12, color: tokens.status.danger }}>{error}</span>
      ) : hint ? (
        <span style={{ fontSize: 12, color: tokens.text.tertiary }}>{hint}</span>
      ) : null}
    </div>
  )
})
