'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { tokens } from '@/lib/design-tokens'

const ACCENT = tokens.brand.primary

interface Tab {
  href: string
  label: string
  icon: React.ReactNode
  matches?: string[]   // outras rotas que ativam esta tab (sub-páginas agrupadas)
}

const TABS: Tab[] = [
  { href: '/financeiro', label: 'Visão geral', icon: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  )},
  { href: '/financeiro/recebimentos', label: 'A receber', icon: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="12" y1="5" x2="12" y2="19"/>
      <polyline points="19 12 12 19 5 12"/>
    </svg>
  )},
  { href: '/financeiro/despesas', label: 'A pagar', icon: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="12" y1="19" x2="12" y2="5"/>
      <polyline points="5 12 12 5 19 12"/>
    </svg>
  )},
  { href: '/financeiro/repasses', label: 'Repasse médico', icon: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  )},
  { href: '/financeiro/relatorios', label: 'Relatórios', icon: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="20" x2="18" y2="10"/>
      <line x1="12" y1="20" x2="12" y2="4"/>
      <line x1="6" y1="20" x2="6" y2="14"/>
    </svg>
  ), matches: ['/financeiro/margem', '/financeiro/auditoria'] },
]

const MAIS: { href: string; label: string }[] = [
  { href: '/financeiro/contas', label: 'Contas' },
  { href: '/financeiro/conciliacao', label: 'Conciliação bancária' },
  { href: '/financeiro/pacientes', label: 'CRM financeiro' },
  { href: '/financeiro/saude', label: 'Cofre financeiro' },
  { href: '/financeiro/assistente', label: 'Assistente financeiro' },
  { href: '/financeiro/importar', label: 'Importar planilha' },
  { href: '/financeiro/configuracoes', label: 'Configurações' },
]

function tabAtiva(href: string, pathname: string, matches?: string[]): boolean {
  if (href === '/financeiro') return pathname === '/financeiro'
  if (pathname === href || pathname.startsWith(href + '/')) return true
  return matches?.some((m) => pathname === m || pathname.startsWith(m + '/')) ?? false
}

export default function FinanceiroLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || ''
  const [maisAberto, setMaisAberto] = useState(false)
  const maisRef = useRef<HTMLDivElement>(null)

  // Fecha o menu ao clicar fora
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (maisRef.current && !maisRef.current.contains(e.target as Node)) setMaisAberto(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Fecha o menu ao navegar
  useEffect(() => { setMaisAberto(false) }, [pathname])

  const itemMaisAtivo = MAIS.find((m) => pathname === m.href || pathname.startsWith(m.href + '/'))

  return (
    <div style={{ padding: 24 }}>
      {/* Header padrão */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: tokens.text.primary, margin: '0 0 4px' }}>Financeiro</h1>
        <p style={{ fontSize: 13, color: tokens.text.secondary, margin: 0 }}>
          Acompanhe receita, recebimentos e saúde financeira da clínica.
        </p>
      </div>

      {/* Tabs horizontais + Mais */}
      <div style={{
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
        marginBottom: 20, borderBottom: `1px solid ${tokens.border.default}`, gap: 8,
      }}>
        <div style={{ display: 'flex', gap: 4, overflowX: 'auto', flexWrap: 'nowrap', flex: 1, minWidth: 0 }}>
          {TABS.map((t) => {
            const ativo = tabAtiva(t.href, pathname, t.matches)
            return (
              <Link key={t.href} href={t.href} style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '10px 16px', textDecoration: 'none',
                fontSize: 13, fontWeight: ativo ? 700 : 500,
                color: ativo ? ACCENT : tokens.text.secondary,
                borderBottom: ativo ? `2px solid ${ACCENT}` : '2px solid transparent',
                marginBottom: -1, whiteSpace: 'nowrap', transition: 'color 0.15s',
              }}>
                {t.icon}{t.label}
              </Link>
            )
          })}
        </div>

        <div ref={maisRef} style={{ position: 'relative', flexShrink: 0 }}>
          <button
            onClick={() => setMaisAberto((v) => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: itemMaisAtivo ? tokens.brand.primaryLight : 'transparent',
              color: itemMaisAtivo ? ACCENT : tokens.text.secondary,
              fontSize: 13, fontWeight: itemMaisAtivo ? 700 : 500,
              marginBottom: 4, whiteSpace: 'nowrap', transition: 'background 0.15s',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>
            </svg>
            {itemMaisAtivo ? itemMaisAtivo.label : 'Mais'}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"
              style={{ transform: maisAberto ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>

          {maisAberto && (
            <div style={{
              position: 'absolute', right: 0, top: 'calc(100% + 6px)', zIndex: 50,
              minWidth: 220, background: tokens.bg.card,
              border: `1px solid ${tokens.border.default}`, borderRadius: 10,
              boxShadow: '0 8px 24px rgba(0,0,0,0.08)', padding: 4,
            }}>
              {MAIS.map((m) => {
                const ativo = pathname === m.href || pathname.startsWith(m.href + '/')
                return (
                  <Link key={m.href} href={m.href} style={{
                    display: 'block', padding: '9px 12px', borderRadius: 7, textDecoration: 'none',
                    fontSize: 13, fontWeight: ativo ? 700 : 500,
                    color: ativo ? ACCENT : tokens.text.strong,
                    background: ativo ? tokens.brand.primaryLight : 'transparent',
                  }}>{m.label}</Link>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {children}
    </div>
  )
}
