'use client'

import { usePathname } from 'next/navigation'
import { Topbar } from './Topbar'

// rotas públicas onde a topbar NÃO aparece
const ROTAS_PUBLICAS = ['/login', '/cadastro', '/forgot-password', '/reset-password']
const PREFIXOS_PUBLICOS = ['/sala/', '/pre-consulta/', '/paciente-publico/']

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  const ehPublica =
    pathname === '/' ||
    ROTAS_PUBLICAS.includes(pathname) ||
    PREFIXOS_PUBLICOS.some(p => pathname.startsWith(p))

  if (ehPublica) return <>{children}</>

  // Em páginas logadas, renderiza Topbar fixa no topo.
  // A Topbar é posicionada absoluta no topo-direito,
  // flutuando sobre o conteúdo sem quebrar os layouts existentes.
  return (
    <>
      <div style={{
        position: 'fixed', top: 0, right: 0, left: 220,
        zIndex: 80, pointerEvents: 'none',
      }}>
        <div style={{ pointerEvents: 'auto' }}>
          <Topbar />
        </div>
      </div>
      <div style={{ paddingTop: 56 }}>
        {children}
      </div>
    </>
  )
}
