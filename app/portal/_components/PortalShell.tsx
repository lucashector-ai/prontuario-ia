'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { tokens } from '@/lib/design-tokens'
import { Sheet } from '@/components/ui/Sheet'
import { Badge } from '@/components/ui/Badge'
import { PortalGate } from './PortalGate'
import { usePortalSession, clearPortalSession } from '@/lib/portal/session'

type NavItem = { href: string; label: string; icon: React.ReactNode }

const NAV_PRIMARY: NavItem[] = [
  { href: '/portal',          label: 'Início',     icon: <HomeIcon /> },
  { href: '/portal/timeline', label: 'Jornada',    icon: <TimelineIcon /> },
  { href: '/portal/chat',     label: 'Chat',       icon: <ChatIcon /> },
]

const NAV_SECONDARY: NavItem[] = [
  { href: '/portal/consultas',  label: 'Consultas',   icon: <StethIcon /> },
  { href: '/portal/exames',     label: 'Exames',      icon: <BeakerIcon /> },
  { href: '/portal/receitas',   label: 'Receitas',    icon: <PillIcon /> },
  { href: '/portal/protocolos', label: 'Protocolos',  icon: <TargetIcon /> },
  { href: '/portal/pagamentos', label: 'Pagamentos',  icon: <CreditIcon /> },
  { href: '/portal/documentos', label: 'Documentos',  icon: <DocIcon /> },
]

const ALL_NAV = [...NAV_PRIMARY, ...NAV_SECONDARY]

export function PortalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { session } = usePortalSession()
  const [isMobile, setIsMobile] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 900)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const isActive = (href: string) => pathname === href || (href !== '/portal' && pathname?.startsWith(href + '/'))

  const isLoginPage = pathname === '/portal/login'

  function handleLogout() {
    clearPortalSession()
    setMenuOpen(false)
    router.replace('/portal/login')
  }

  if (isLoginPage) {
    return (
      <div style={{ minHeight: '100dvh', background: tokens.bg.page }}>
        {children}
      </div>
    )
  }

  if (isMobile) {
    return (
      <PortalGate>
        <div style={{ minHeight: '100dvh', background: tokens.bg.page, display: 'flex', flexDirection: 'column' }}>
          <main style={{ flex: 1, paddingBottom: 'calc(78px + env(safe-area-inset-bottom, 0px))' }}>
            {children}
          </main>

          <nav
            aria-label="Navegação principal"
            style={{
              position: 'fixed', bottom: 0, left: 0, right: 0,
              background: 'rgba(255, 255, 255, 0.92)',
              backdropFilter: 'blur(14px)',
              WebkitBackdropFilter: 'blur(14px)',
              borderTop: `1px solid ${tokens.border.subtle}`,
              display: 'flex',
              justifyContent: 'space-around',
              padding: '10px 8px',
              paddingBottom: 'calc(10px + env(safe-area-inset-bottom, 0px))',
              zIndex: 50,
            }}
          >
            {NAV_PRIMARY.map((it) => {
              const active = isActive(it.href)
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  aria-label={it.label}
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 4,
                    padding: 6,
                    color: active ? tokens.brand.primary : tokens.text.tertiary,
                    textDecoration: 'none',
                    fontSize: 11,
                    fontWeight: active ? 600 : 500,
                    transition: 'color 140ms ease',
                  }}
                >
                  {it.icon}
                  {it.label}
                </Link>
              )
            })}
            <button
              type="button"
              aria-label="Mais opções"
              onClick={() => setMenuOpen(true)}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
                padding: 6,
                background: 'transparent',
                border: 'none',
                color: tokens.text.tertiary,
                fontSize: 11,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              <MoreIcon />
              Mais
            </button>
          </nav>

          <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} title="Menu">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {NAV_SECONDARY.map((it) => (
                <Link
                  key={it.href}
                  href={it.href}
                  onClick={() => setMenuOpen(false)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '14px 12px',
                    borderRadius: tokens.radius.xl,
                    color: tokens.text.primary,
                    background: isActive(it.href) ? tokens.brand.primaryLighter : 'transparent',
                    textDecoration: 'none',
                    fontSize: 15,
                    fontWeight: 500,
                  }}
                >
                  <span style={{ color: tokens.brand.primary }}>{it.icon}</span>
                  {it.label}
                </Link>
              ))}
              <div style={{ height: 1, background: tokens.border.subtle, margin: '8px 0' }} />
              {session && (
                <div style={{ padding: '8px 12px', fontSize: 13, color: tokens.text.tertiary }}>
                  Logado como <strong style={{ color: tokens.text.strong }}>{session.email}</strong>
                </div>
              )}
              <button
                type="button"
                onClick={handleLogout}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '14px 12px',
                  border: 'none',
                  background: 'transparent',
                  color: tokens.status.danger,
                  fontSize: 15,
                  fontWeight: 500,
                  cursor: 'pointer',
                  textAlign: 'left',
                  borderRadius: tokens.radius.xl,
                }}
              >
                <LogoutIcon />
                Sair
              </button>
            </div>
          </Sheet>
        </div>
      </PortalGate>
    )
  }

  return (
    <PortalGate>
      <div style={{ minHeight: '100dvh', background: tokens.bg.page, display: 'flex' }}>
        <aside
          style={{
            width: 260,
            background: tokens.bg.card,
            borderRight: `1px solid ${tokens.border.subtle}`,
            padding: '28px 16px',
            display: 'flex',
            flexDirection: 'column',
            position: 'sticky',
            top: 0,
            height: '100dvh',
          }}
        >
          <div style={{ padding: '0 8px 20px' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: tokens.text.primary, letterSpacing: -0.2 }}>
              Clinical 360
            </div>
            <div style={{ fontSize: 12, color: tokens.text.tertiary, marginTop: 2 }}>Portal do paciente</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, overflowY: 'auto' }}>
            <NavGroup label="Principal" items={NAV_PRIMARY} isActive={isActive} />
            <NavGroup label="Saúde & finanças" items={NAV_SECONDARY} isActive={isActive} />
          </div>

          {session && (
            <div style={{ marginTop: 12, padding: 12, background: tokens.bg.cardSubtle, borderRadius: tokens.radius.xl, fontSize: 12 }}>
              <div style={{ color: tokens.text.tertiary, marginBottom: 4 }}>Conectado como</div>
              <div style={{ color: tokens.text.primary, fontWeight: 500, marginBottom: 8, wordBreak: 'break-all' }}>{session.email}</div>
              <button
                type="button"
                onClick={handleLogout}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: tokens.status.danger,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                Sair
              </button>
            </div>
          )}
        </aside>
        <main style={{ flex: 1, padding: '36px 48px', maxWidth: 1100 }}>{children}</main>
      </div>
    </PortalGate>
  )
}

function NavGroup({ label, items, isActive }: { label: string; items: NavItem[]; isActive: (h: string) => boolean }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: tokens.text.tertiary, padding: '8px 12px', textTransform: 'uppercase', letterSpacing: 0.6 }}>
        {label}
      </div>
      {items.map((it) => {
        const active = isActive(it.href)
        return (
          <Link
            key={it.href}
            href={it.href}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '10px 12px',
              borderRadius: tokens.radius.lg,
              color: active ? tokens.brand.primary : tokens.text.strong,
              background: active ? tokens.brand.primaryLighter : 'transparent',
              fontSize: 14,
              fontWeight: active ? 600 : 500,
              textDecoration: 'none',
              transition: 'background 140ms ease, color 140ms ease',
            }}
          >
            {it.icon}
            {it.label}
          </Link>
        )
      })}
    </div>
  )
}

// ── Ícones ────────────────────────────────────────────────────────────────
function HomeIcon()     { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> }
function TimelineIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg> }
function ChatIcon()     { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> }
function StethIcon()    { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2v6a4 4 0 0 0 8 0V2"/><path d="M14 12v2a4 4 0 0 0 8 0v-1"/><circle cx="22" cy="9" r="2"/></svg> }
function BeakerIcon()   { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 3v6l-5 9a3 3 0 0 0 3 5h10a3 3 0 0 0 3-5l-5-9V3"/><path d="M7 3h10"/></svg> }
function PillIcon()     { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="9" width="20" height="6" rx="3" transform="rotate(45 12 12)"/><line x1="9" y1="9" x2="15" y2="15"/></svg> }
function TargetIcon()   { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/></svg> }
function CreditIcon()   { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg> }
function DocIcon()      { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> }
function MoreIcon()     { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg> }
function LogoutIcon()   { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg> }
