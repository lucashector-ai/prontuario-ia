'use client'

import { useEffect, useRef } from 'react'
import { tokens } from '@/lib/design-tokens'

type Size = 'sm' | 'md' | 'lg'

type Props = {
  open: boolean
  onClose: () => void
  title?: string
  description?: string
  size?: Size
  children?: React.ReactNode
  footer?: React.ReactNode
  closeOnBackdrop?: boolean
}

const MAX_W: Record<Size, number> = { sm: 380, md: 520, lg: 720 }

export function Modal({ open, onClose, title, description, size = 'md', children, footer, closeOnBackdrop = true }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
      onMouseDown={(e) => { if (closeOnBackdrop && e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(15, 23, 42, 0.5)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        animation: 'modalBackdropIn 160ms ease',
        padding: 16,
      }}
    >
      <div
        ref={ref}
        style={{
          width: '100%',
          maxWidth: MAX_W[size],
          background: tokens.bg.card,
          borderRadius: tokens.radius['3xl'],
          boxShadow: '0 24px 80px rgba(15, 23, 42, 0.24), 0 2px 8px rgba(15, 23, 42, 0.08)',
          overflow: 'hidden',
          animation: 'modalPanelIn 200ms cubic-bezier(0.16, 1, 0.3, 1)',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: 'calc(100dvh - 32px)',
        }}
      >
        {(title || description) && (
          <div style={{ padding: '20px 24px 12px', borderBottom: `1px solid ${tokens.border.subtle}` }}>
            {title && <h2 id="modal-title" style={{ margin: 0, fontSize: 18, fontWeight: 600, color: tokens.text.primary }}>{title}</h2>}
            {description && <p style={{ margin: '6px 0 0', fontSize: 14, color: tokens.text.secondary, lineHeight: 1.45 }}>{description}</p>}
          </div>
        )}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>{children}</div>
        {footer && (
          <div style={{ padding: '14px 20px', borderTop: `1px solid ${tokens.border.subtle}`, display: 'flex', justifyContent: 'flex-end', gap: 8, background: tokens.bg.muted }}>
            {footer}
          </div>
        )}
      </div>
      <style>{`
        @keyframes modalBackdropIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes modalPanelIn {
          from { opacity: 0; transform: scale(0.96) translateY(8px) }
          to   { opacity: 1; transform: scale(1) translateY(0) }
        }
      `}</style>
    </div>
  )
}
