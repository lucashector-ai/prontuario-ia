'use client'

import { useEffect } from 'react'
import { tokens } from '@/lib/design-tokens'

type Props = {
  open: boolean
  onClose: () => void
  title?: string
  children?: React.ReactNode
  footer?: React.ReactNode
}

export function Sheet({ open, onClose, title, children, footer }: Props) {
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
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        background: 'rgba(15, 23, 42, 0.5)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        animation: 'sheetBackdropIn 160ms ease',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 560,
          background: tokens.bg.card,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          boxShadow: '0 -8px 32px rgba(15, 23, 42, 0.18)',
          animation: 'sheetPanelIn 240ms cubic-bezier(0.16, 1, 0.3, 1)',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90dvh',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 10 }}>
          <span aria-hidden style={{ width: 40, height: 4, background: tokens.border.strong, borderRadius: 999 }} />
        </div>
        {title && (
          <div style={{ padding: '12px 20px 4px' }}>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: tokens.text.primary }}>{title}</h2>
          </div>
        )}
        <div style={{ padding: '12px 20px 20px', overflowY: 'auto', flex: 1 }}>{children}</div>
        {footer && (
          <div style={{ padding: '12px 16px', borderTop: `1px solid ${tokens.border.subtle}`, display: 'flex', gap: 8 }}>
            {footer}
          </div>
        )}
      </div>
      <style>{`
        @keyframes sheetBackdropIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes sheetPanelIn {
          from { transform: translateY(100%) }
          to   { transform: translateY(0) }
        }
      `}</style>
    </div>
  )
}
