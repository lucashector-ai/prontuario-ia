'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Topbar } from './Topbar'
import { Sidebar } from './Sidebar'
import { BottomNav } from './BottomNav'

const ROTAS_PUBLICAS = ['/login', '/cadastro', '/cadastro-sucesso', '/verificar-email', '/trocar-senha-obrigatoria', '/onboarding', '/forgot-password', '/reset-password', '/whatsapp-app']
const PREFIXOS_PUBLICOS = ['/sala/', '/pre-consulta/', '/paciente-publico/']

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const ehPublica =
    pathname === '/' ||
    ROTAS_PUBLICAS.includes(pathname) ||
    PREFIXOS_PUBLICOS.some(p => pathname.startsWith(p))

  if (ehPublica) return <>{children}</>

  // ===== MOBILE LAYOUT =====
  if (isMobile) {
    return (
      <div style={{
        height: '100dvh',
        background: '#FDFDFF',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        <Topbar />
        <main style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          overscrollBehavior: 'contain',
          minHeight: 0,
          paddingBottom: 'calc(64px + env(safe-area-inset-bottom, 0px))',
        }}>
          {children}
        </main>
        <BottomNav />
      </div>
    )
  }

  // ===== DESKTOP LAYOUT (mantido como antes) =====
  return (
    <div style={{
      height: '100vh',
      background: '#EAECEF',
      padding: 12,
      display: 'flex',
      gap: 12,
      overflow: 'hidden',
    }}>
      {/* Ilha 1 — Sidebar */}
      <div style={{
        background: 'white',
        borderRadius: 20,
        overflow: 'hidden',
        flexShrink: 0,
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}>
        <Sidebar />
      </div>

      {/* Ilha 2 — Topbar + Conteúdo */}
      <div style={{
        flex: 1,
        background: 'white',
        borderRadius: 20,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        minWidth: 0,
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}>
        <Topbar />
        <main className="appshell-main" style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          overscrollBehavior: 'contain',
          minHeight: 0,
        }}>
          {children}
        </main>
      </div>
    </div>
  )
}
