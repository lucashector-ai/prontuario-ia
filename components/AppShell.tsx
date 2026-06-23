'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Topbar } from './Topbar'
import { Sidebar } from './Sidebar'
import { BottomNav } from './BottomNav'
import { tokens } from '@/lib/design-tokens'

const ROTAS_PUBLICAS = ['/login', '/login-atendente', '/cadastro', '/cadastro-sucesso', '/verificar-email', '/trocar-senha-obrigatoria', '/onboarding', '/forgot-password', '/reset-password', '/whatsapp-app', '/privacidade', '/termos', '/sobre', '/contato']
const PREFIXOS_PUBLICOS = ['/sala/', '/pre-consulta/', '/paciente-publico/', '/agenda/']

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
        background: tokens.bg.page,
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

  // ===== DESKTOP LAYOUT — modelo B (sidebar fundida, topbar ilha) =====
  return (
    <div style={{
      height: '100vh',
      background: tokens.bg.page,
      display: 'flex',
      overflow: 'hidden',
    }}>
      {/* Sidebar — funde no fundo, sem card */}
      <div style={{
        flexShrink: 0,
        background: tokens.bg.page,
      }}>
        <Sidebar />
      </div>

      {/* Coluna direita — Topbar (ilha) + Conteúdo */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        padding: '16px 16px 16px 0',
        gap: 16,
        overflow: 'hidden',
      }}>
        {/* Topbar — ilha branca separada */}
        <div style={{
          background: tokens.bg.card,
          borderRadius: 16,
          flexShrink: 0,
          boxShadow: tokens.shadow.island,
          overflow: 'visible',
        }}>
          <Topbar />
        </div>

        {/* Área de conteúdo — superfície branca (ilha) */}
        <main className="appshell-main" style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          overscrollBehavior: 'contain',
          minHeight: 0,
          borderRadius: 16,
          background: tokens.bg.card,
          boxShadow: tokens.shadow.island,
        }}>
          {children}
        </main>
      </div>
    </div>
  )
}
