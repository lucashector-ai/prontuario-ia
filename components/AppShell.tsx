'use client'

import { usePathname } from 'next/navigation'
import { Topbar } from './Topbar'
import { Sidebar } from './Sidebar'

const ROTAS_PUBLICAS = ['/login', '/cadastro', '/cadastro-sucesso', '/verificar-email', '/forgot-password', '/reset-password']
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
      overflow: 'hidden',
    }}>
      <div style={{
        flex: 1,
        background: 'white',
        borderRadius: 20,
        display: 'flex',
        overflow: 'hidden',
      }}>
        <Sidebar />
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          minWidth: 0,
        }}>
          <Topbar />
          <main style={{
            flex: 1,
            overflow: 'auto',
            minHeight: 0,
          }}>
            {children}
          </main>
        </div>
      </div>
    </div>
  )
}
