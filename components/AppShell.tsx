'use client'

import { usePathname } from 'next/navigation'
import { Topbar } from './Topbar'
import { Sidebar } from './Sidebar'

const ROTAS_PUBLICAS = ['/login', '/cadastro', '/forgot-password', '/reset-password']
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
      minHeight: '100vh',
      background: '#EAECEF',
      padding: 12,
      display: 'flex',
    }}>
      <div style={{
        flex: 1,
        background: 'white',
        borderRadius: 20,
        display: 'flex',
        overflow: 'hidden',
        minHeight: 'calc(100vh - 24px)',
      }}>
        {/* Sidebar dentro do card */}
        <Sidebar />
        
        {/* Área de conteúdo com topbar + children */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}>
          <Topbar />
          <div style={{
            flex: 1,
            overflow: 'auto',
          }}>
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
