'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { tokens } from '@/lib/design-tokens'

type NavItem = { href: string; label: string; icon: React.ReactNode }

const NAV: NavItem[] = [
  { href: '/portal', label: 'Início',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> },
  { href: '/portal/timeline', label: 'Jornada',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg> },
  { href: '/portal/chat', label: 'Chat',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> },
  { href: '/portal/documentos', label: 'Documentos',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> },
]

export function PortalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 900)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const isActive = (href: string) => pathname === href || (href !== '/portal' && pathname?.startsWith(href))

  if (isMobile) {
    return (
      <div style={{ minHeight: '100dvh', background: tokens.bg.page, display: 'flex', flexDirection: 'column' }}>
        <main style={{ flex: 1, paddingBottom: 'calc(72px + env(safe-area-inset-bottom, 0px))' }}>{children}</main>
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
          {NAV.map((it) => {
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
        </nav>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100dvh', background: tokens.bg.page, display: 'flex' }}>
      <aside
        style={{
          width: 260,
          background: tokens.bg.card,
          borderRight: `1px solid ${tokens.border.subtle}`,
          padding: '28px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          position: 'sticky',
          top: 0,
          height: '100dvh',
        }}
      >
        <div style={{ padding: '0 8px 24px' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: tokens.text.primary, letterSpacing: -0.2 }}>
            Clinical 360
          </div>
          <div style={{ fontSize: 12, color: tokens.text.tertiary, marginTop: 2 }}>Portal do paciente</div>
        </div>
        {NAV.map((it) => {
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
      </aside>
      <main style={{ flex: 1, padding: '32px 40px', maxWidth: 1100 }}>{children}</main>
    </div>
  )
}
