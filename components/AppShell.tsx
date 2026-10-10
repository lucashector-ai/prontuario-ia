'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Topbar } from './Topbar'
import { Sidebar } from './Sidebar'
import { BottomNav } from './BottomNav'
import { HeaderProvider } from './shell/header-context'
import { AvisoConexao } from './shell/AvisoConexao'
import { BatimentoAutomacoes } from './shell/BatimentoAutomacoes'
import { AvisosAoVivo } from './shell/AvisosAoVivo'
import { FichaRapidaGlobal } from './paciente/FichaRapida'
import { tokenSessao } from '@/lib/supabase'
import { sairDaConta } from '@/lib/sessao'
import { tokens } from '@/lib/design-tokens'

const ROTAS_PUBLICAS = ['/login', '/login-atendente', '/cadastro', '/cadastro-sucesso', '/verificar-email', '/trocar-senha-obrigatoria', '/onboarding', '/forgot-password', '/reset-password', '/privacidade', '/termos', '/sobre', '/contato', '/dev-login']
const PREFIXOS_PUBLICOS = ['/sala/', '/painel/', '/pre-consulta/', '/paciente-publico/', '/agenda/', '/formulario/']

type Layout = 'desktop' | 'rail' | 'mobile'

/**
 * Casca do app (design v2):
 *   fundo #F7F7F8, padding 16, gap 16
 *   ├─ Sidebar 204px, recolhível para 52px pelo botão do topo (some < 760px → BottomNav)
 *   └─ coluna: cabeçalho (título + busca + atalhos) + painel branco (raio 20) com a página
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [layout, setLayout] = useState<Layout>('desktop')
  // Menu recolhido: escolha do usuário (lembrada no navegador). Telas < 1180px começam recolhidas.
  const [recolhido, setRecolhido] = useState(false)

  useEffect(() => {
    const check = () => {
      const w = window.innerWidth
      setLayout(w < 760 ? 'mobile' : w < 1180 ? 'rail' : 'desktop')
    }
    check()
    try {
      const salvo = localStorage.getItem('c360-menu-recolhido')
      setRecolhido(salvo !== null ? salvo === '1' : window.innerWidth < 1180)
    } catch { setRecolhido(window.innerWidth < 1180) }
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const ehPublica =
    pathname === '/' ||
    ROTAS_PUBLICAS.includes(pathname) ||
    PREFIXOS_PUBLICOS.some(p => pathname.startsWith(p))

  // Sessão sem token (login antigo) ou token vencido: volta ao login uma vez.
  // Modo demonstração (?demo=1) e /dev-login não exigem sessão.
  useEffect(() => {
    if (ehPublica) return
    try {
      if (new URLSearchParams(window.location.search).get('demo') === '1') return
      if (localStorage.getItem('c360_dev') === '1') return
      const logado = localStorage.getItem('medico') || localStorage.getItem('clinica_admin')
      if (!tokenSessao()) {
        const destino = logado ? sairDaConta() : '/login'
        window.location.replace(destino + (logado ? '?expirou=1' : ''))
      }
    } catch {}
  }, [pathname, ehPublica])

  const alternarMenu = () => {
    setRecolhido(r => {
      try { localStorage.setItem('c360-menu-recolhido', r ? '0' : '1') } catch {}
      return !r
    })
  }

  if (ehPublica) return <HeaderProvider>{children}</HeaderProvider>

  const painel: React.CSSProperties = {
    flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', overscrollBehavior: 'contain',
    background: tokens.bg.card, border: `1px solid ${tokens.border.default}`, borderRadius: tokens.radius['3xl'],
  }

  if (layout === 'mobile') {
    return (
      <HeaderProvider>
        <div style={{ height: '100dvh', background: tokens.bg.page, display: 'flex', flexDirection: 'column', gap: 12, padding: 12, paddingBottom: 'calc(76px + env(safe-area-inset-bottom, 0px))', overflow: 'hidden' }}>
          <Topbar compacto />
          <AvisoConexao />
          <BatimentoAutomacoes />
          <AvisosAoVivo />
          <FichaRapidaGlobal />
          <main className="appshell-main" style={painel}>{children}</main>
          <BottomNav />
        </div>
      </HeaderProvider>
    )
  }

  return (
    <HeaderProvider>
      <div style={{ height: '100vh', background: tokens.bg.page, display: 'flex', gap: 12, padding: 12, overflow: 'hidden' }}>
        <Sidebar rail={recolhido} onAlternar={alternarMenu} />
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Topbar />
          <AvisoConexao />
          <BatimentoAutomacoes />
          <AvisosAoVivo />
          <FichaRapidaGlobal />
          <main className="appshell-main" style={painel}>{children}</main>
        </div>
      </div>
    </HeaderProvider>
  )
}
