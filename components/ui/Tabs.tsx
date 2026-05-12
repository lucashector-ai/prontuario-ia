'use client'

import { tokens } from '@/lib/design-tokens'

export type TabItem = { value: string; label: string; icon?: React.ReactNode; badge?: string | number }

type Props = {
  items: TabItem[]
  value: string
  onChange: (value: string) => void
  fullWidth?: boolean
}

export function Tabs({ items, value, onChange, fullWidth }: Props) {
  return (
    <div
      role="tablist"
      style={{
        display: 'flex',
        gap: 4,
        borderBottom: `1px solid ${tokens.border.subtle}`,
        width: fullWidth ? '100%' : 'fit-content',
      }}
    >
      {items.map((item) => {
        const active = item.value === value
        return (
          <button
            key={item.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.value)}
            style={{
              position: 'relative',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 14px',
              fontSize: 14,
              fontWeight: active ? 600 : 500,
              color: active ? tokens.text.primary : tokens.text.secondary,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              transition: 'color 120ms ease',
              flex: fullWidth ? 1 : undefined,
              justifyContent: 'center',
            }}
            onMouseEnter={(e) => { if (!active) e.currentTarget.style.color = tokens.text.primary }}
            onMouseLeave={(e) => { if (!active) e.currentTarget.style.color = tokens.text.secondary }}
          >
            {item.icon}
            {item.label}
            {item.badge !== undefined && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  padding: '2px 7px',
                  borderRadius: tokens.radius.full,
                  background: active ? tokens.brand.primaryLighter : tokens.bg.cardSubtle,
                  color: active ? tokens.brand.primaryDarkText : tokens.text.secondary,
                }}
              >
                {item.badge}
              </span>
            )}
            <span
              aria-hidden
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: -1,
                height: 2,
                background: active ? tokens.brand.primary : 'transparent',
                borderRadius: 2,
                transition: 'background 140ms ease',
              }}
            />
          </button>
        )
      })}
    </div>
  )
}
