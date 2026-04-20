'use client'

import { usePathname } from 'next/navigation'
import { Topbar } from './Topbar'

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
    <>
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 80 }}>
        <Topbar />
      </div>
      <div style={{ paddingTop: 56 }}>
        {children}
      </div>
    </>
  )
}
