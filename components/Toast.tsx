'use client'

import { useEffect, useState, useCallback, createContext, useContext, useRef } from 'react'
import { tokens } from '@/lib/design-tokens'

type ToastType = 'success' | 'error' | 'info'
type Toast = { id: string; msg: string; type: ToastType }
type ToastCtx = { toast: (msg: string, type?: ToastType) => void }

const ToastContext = createContext<ToastCtx>({ toast: () => {} })

export function useToast() {
  return useContext(ToastContext)
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const toast = useCallback((msg: string, type: ToastType = 'success') => {
    const id = Math.random().toString(36).slice(2)
    setToasts(prev => [...prev, { id, msg, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500)
  }, [])

  const colors = {
    success: { bg: tokens.status.successBg, border: tokens.status.successLight, text: tokens.status.successDark, icon: tokens.status.success },
    error:   { bg: tokens.status.dangerBg, border: tokens.status.dangerLight, text: tokens.status.dangerDark, icon: tokens.status.danger },
    info:    { bg: tokens.status.infoSkyBgSoft, border: tokens.status.infoSkyMid, text: tokens.status.infoSkyDarker, icon: tokens.status.infoSkyStrong },
  }

  const icons = {
    success: <path d="M20 6L9 17l-5-5"/>,
    error:   <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>,
    info:    <><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></>,
  }

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div style={{ position: 'fixed', bottom: 24, right: 24, display: 'flex', flexDirection: 'column', gap: 8, zIndex: 9999, pointerEvents: 'none' }}>
        {toasts.map(t => {
          const c = colors[t.type]
          return (
            <div key={t.id} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: c.bg, border: `1px solid ${c.border}`,
              borderRadius: 10, padding: '11px 16px',
              fontSize: 13, color: c.text, fontWeight: 500,
              minWidth: 240, maxWidth: 360,
              animation: 'toastIn 0.2s ease',
            }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={c.icon} strokeWidth="2.5" strokeLinecap="round">
                {icons[t.type]}
              </svg>
              {t.msg}
            </div>
          )
        })}
      </div>
      <style>{`@keyframes toastIn { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: translateY(0) } }`}</style>
    </ToastContext.Provider>
  )
}
