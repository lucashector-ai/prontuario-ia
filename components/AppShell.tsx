'use client'

import { usePathname } from 'next/navigation'
import { Topbar } from './Topbar'
import { Sidebar } from './Sidebar'

const ROTAS_PUBLICAS = ['/login', '/cadastro', '/cadastro-sucesso', '/verificar-email', '/trocar-senha-obrigatoria', '/onboarding', '/forgot-password', '/reset-password', '/whatsapp-app']
const PREFIXOS_PUBLICOS = ['/sala/', '/pre-consulta/', '/paciente-publico/']

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  const ehPublica =
    pathname === '/' ||
    ROTAS_PUBLICAS.includes(pathname) ||
    PREFIXOS_PUBLICOS.some(p => pathname.startsWith(p))

  if (ehPublica) return <>{children}</>

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
        <main style={{
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
