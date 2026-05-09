'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { tokens } from '@/lib/design-tokens'

const ACCENT = tokens.brand.primary
const ACCENT_LIGHT = tokens.brand.primaryLighter

interface MenuItem {
  href: string
  label: string
  icon: React.ReactNode
}

const TABS_PRINCIPAIS: MenuItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
      <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
    </svg>
  )},
  { href: '/agenda', label: 'Agenda', icon: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="18" rx="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  )},
  { href: '/pacientes', label: 'Pacientes', icon: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
    </svg>
  )},
]

const ICON_MENU = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="3" y1="12" x2="21" y2="12"/>
    <line x1="3" y1="6" x2="21" y2="6"/>
    <line x1="3" y1="18" x2="21" y2="18"/>
  </svg>
)

export function BottomNav() {
  const router = useRouter()
  const pathname = usePathname()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [medico, setMedico] = useState<any>(null)
  const [clinicaAdmin, setClinicaAdmin] = useState<any>(null)

  useEffect(() => {
    const ca = localStorage.getItem('clinica_admin')
    if (ca) { setClinicaAdmin(JSON.parse(ca)); return }
    const m = localStorage.getItem('medico')
    if (m) setMedico(JSON.parse(m))
  }, [])

  const isClinicaAdmin = !!clinicaAdmin
  const isRecepcionista = medico?.cargo === 'recepcionista'
  const isMedicoAdmin = medico?.cargo === 'admin'
  const temAcessoAdmin = isClinicaAdmin || isMedicoAdmin

  // Itens do menu (bottom sheet) — todos exceto os 3 principais
  const itensMenu: MenuItem[] = [
    ...(!isRecepcionista ? [{ href: '/historico', label: 'Histórico', icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
      </svg>
    )}] : []),
    ...(!isRecepcionista ? [{ href: '/nova-consulta', label: 'Nova consulta', icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 5v14M5 12h14"/>
      </svg>
    )}] : []),
    ...(!isRecepcionista ? [{ href: '/teleconsulta', label: 'Teleconsulta', icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M15 10l4.553-2.169A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14v-4zM3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"/>
      </svg>
    )}] : []),
    ...(!isRecepcionista ? [{ href: '/exames', label: 'Analisar exames', icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18"/>
      </svg>
    )}] : []),
    { href: '/whatsapp-app', label: 'WhatsApp', icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
      </svg>
    )},
    ...(temAcessoAdmin ? [
      { href: '/minha-clinica', label: 'Minha clínica', icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
          <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
      )},
      { href: '/admin', label: 'Painel admin', icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
        </svg>
      )},
    ] : []),
    { href: '/perfil', label: 'Perfil', icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z"/>
      </svg>
    )},
  ]

  const sair = () => {
    localStorage.removeItem('medico')
    localStorage.removeItem('clinica_admin')
    localStorage.removeItem('clinica')
    router.push('/login')
  }

  const navegar = (href: string) => {
    setSheetOpen(false)
    router.push(href)
  }

  const isActive = (href: string) => pathname === href || (href !== '/' && pathname.startsWith(href))

  return (
    <>
      {/* Bottom Nav fixo */}
      <nav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
        background: 'white', borderTop: `1px solid ${tokens.border.default}`,
        display: 'flex', alignItems: 'stretch',
        height: 64, paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        boxShadow: '0 -2px 12px rgba(0,0,0,0.04)',
      }}>
        {TABS_PRINCIPAIS.map(t => {
          const ativo = isActive(t.href)
          return (
            <button key={t.href} onClick={() => navegar(t.href)}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: 3, background: 'transparent', border: 'none', cursor: 'pointer',
                color: ativo ? ACCENT : tokens.text.tertiary,
              }}>
              {t.icon}
              <span style={{ fontSize: 10, fontWeight: ativo ? 700 : 500 }}>{t.label}</span>
            </button>
          )
        })}
        <button onClick={() => setSheetOpen(true)}
          style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 3, background: 'transparent', border: 'none', cursor: 'pointer',
            color: sheetOpen ? ACCENT : tokens.text.tertiary,
          }}>
          {ICON_MENU}
          <span style={{ fontSize: 10, fontWeight: sheetOpen ? 700 : 500 }}>Menu</span>
        </button>
      </nav>

      {/* Bottom Sheet (overlay + painel deslizante) */}
      {sheetOpen && (
        <>
          <div onClick={() => setSheetOpen(false)} style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 60,
          }}/>
          <div style={{
            position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 61,
            background: 'white', borderTopLeftRadius: 20, borderTopRightRadius: 20,
            maxHeight: '80vh', overflowY: 'auto',
            animation: 'slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)',
          }}>
            {/* Drag handle */}
            <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 6px' }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: tokens.border.default }}/>
            </div>

            {/* Logo + Header */}
            <div style={{ padding: '8px 20px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 9, background: ACCENT,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 18 L4 6 L10 6 L12 9 L20 9 L20 18 Z"/>
                </svg>
              </div>
              <div>
                <p style={{ fontSize: 16, fontWeight: 700, color: tokens.text.primary, margin: 0 }}>Clinical 360</p>
                <p style={{ fontSize: 11, color: tokens.text.tertiary, margin: 0 }}>
                  {clinicaAdmin?.nome || medico?.nome || 'Menu'}
                </p>
              </div>
            </div>

            <div style={{ height: 1, background: tokens.bg.hoverStrong, margin: '0 20px' }}/>

            {/* Lista de itens */}
            <div style={{ padding: '8px 12px' }}>
              {itensMenu.map(item => {
                const ativo = isActive(item.href)
                return (
                  <button key={item.href} onClick={() => navegar(item.href)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 14, width: '100%',
                      padding: '13px 14px', borderRadius: 10, marginBottom: 2,
                      background: ativo ? tokens.bg.hoverStrong : 'transparent', border: 'none',
                      color: ativo ? tokens.text.primary : tokens.text.strong,
                      fontSize: 15, fontWeight: ativo ? 600 : 500,
                      textAlign: 'left', cursor: 'pointer',
                    }}>
                    <span style={{ flexShrink: 0, opacity: ativo ? 1 : 0.7, color: ativo ? ACCENT : tokens.text.secondary }}>{item.icon}</span>
                    {item.label}
                  </button>
                )
              })}
            </div>

            <div style={{ height: 1, background: tokens.bg.hoverStrong, margin: '4px 20px 8px' }}/>

            {/* Sair */}
            <div style={{ padding: '0 12px 8px' }}>
              <button onClick={sair} style={{
                display: 'flex', alignItems: 'center', gap: 14, width: '100%',
                padding: '13px 14px', borderRadius: 10,
                background: 'transparent', border: 'none', color: tokens.status.danger,
                fontSize: 15, fontWeight: 500, textAlign: 'left', cursor: 'pointer',
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>
                </svg>
                Sair
              </button>
            </div>

            <style>{`@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
          </div>
        </>
      )}
    </>
  )
}
