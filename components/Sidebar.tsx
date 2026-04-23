'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'

const ACCENT = '#6043C1'
const ACCENT_LIGHT = '#ede9fb'
const TEXT_DEFAULT = '#374151'
const TEXT_MUTED = '#9CA3AF'

export function Sidebar() {
  const router = useRouter()
  const pathname = usePathname()
  const [medico, setMedico] = useState<any>(null)
  const [clinicaAdmin, setClinicaAdmin] = useState<any>(null)

  useEffect(() => {
    const ca = localStorage.getItem('clinica_admin')
    if (ca) {
      setClinicaAdmin(JSON.parse(ca))
      return
    }
    const m = localStorage.getItem('medico')
    if (m) setMedico(JSON.parse(m))
  }, [])

  // Clínica admin vê TUDO (incluindo Painel admin + Minha clínica)
  const isClinicaAdmin = !!clinicaAdmin
  const isRecepcionista = medico?.cargo === 'recepcionista'
  const isMedicoAdmin = medico?.cargo === 'admin' // médico com cargo admin (legado)

  // Mostra painel admin e configurações administrativas se for clínica admin OU médico admin
  const temAcessoAdmin = isClinicaAdmin || isMedicoAdmin

  const grupos = [
    {
      label: 'OVERVIEW',
      items: [
        { href: '/dashboard', label: 'Dashboard', icon: (
          <svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
            <rect x='3' y='3' width='7' height='7'/><rect x='14' y='3' width='7' height='7'/>
            <rect x='3' y='14' width='7' height='7'/><rect x='14' y='14' width='7' height='7'/>
          </svg>
        )},
        ...(!isRecepcionista ? [{ href: '/nova-consulta', label: 'Nova consulta', icon: (
          <svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
            <path d='M12 5v14M5 12h14'/>
          </svg>
        )}] : []),
        { href: '/agenda', label: 'Agenda', icon: (
          <svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
            <rect x='3' y='4' width='18' height='18' rx='2'/>
            <line x1='16' y1='2' x2='16' y2='6'/><line x1='8' y1='2' x2='8' y2='6'/>
            <line x1='3' y1='10' x2='21' y2='10'/>
          </svg>
        )},
        ...(!isRecepcionista ? [{ href: '/historico', label: 'Histórico', icon: (
          <svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
            <path d='M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z'/>
          </svg>
        )}] : []),
        { href: '/pacientes', label: 'Pacientes', icon: (
          <svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
            <path d='M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75'/>
          </svg>
        )},
      ],
    },
    {
      label: 'ATENDIMENTO',
      items: [
        { href: '/whatsapp-app', label: 'WhatsApp', icon: (
          <svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
            <path d='M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z'/>
          </svg>
        )},
        ...(!isRecepcionista ? [
          { href: '/teleconsulta', label: 'Teleconsulta', icon: (
            <svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
              <path d='M15 10l4.553-2.169A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14v-4zM3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z'/>
            </svg>
          )},
          { href: '/ditado', label: 'Ditado livre', icon: (
            <svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
              <path d='M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z'/>
              <path d='M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8'/>
            </svg>
          )},
          { href: '/exames', label: 'Analisar exames', icon: (
            <svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
              <path d='M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18'/>
            </svg>
          )},
          { href: '/dicionario', label: 'Dicionário clínico', icon: (
            <svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
              <path d='M4 19.5A2.5 2.5 0 016.5 17H20'/>
              <path d='M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z'/>
            </svg>
          )},
        ] : []),
      ],
    },
    {
      label: 'SETTINGS',
      items: [
        ...(temAcessoAdmin ? [
          { href: '/configuracoes/sofia', label: 'Sofia · IA', icon: (
            <svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
              <path d='M12 8V4H8'/><rect x='4' y='12' width='16' height='8' rx='2'/>
              <path d='M2 14h2M20 14h2M15 13v2M9 13v2'/>
            </svg>
          )},
          { href: '/automacoes', label: 'Automações', icon: (
            <svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
              <path d='M13 2L3 14h9l-1 8 10-12h-9l1-8z'/>
            </svg>
          )},
          { href: '/lgpd', label: 'Privacidade & LGPD', icon: (
            <svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.8'>
              <path d='M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'/>
            </svg>
          )},
          { href: '/minha-clinica', label: 'Minha clínica', icon: (
            <svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
              <path d='M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z'/>
              <polyline points='9 22 9 12 15 12 15 22'/>
            </svg>
          )},
          { href: '/admin', label: 'Painel admin', icon: (
            <svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
              <path d='M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2'/><circle cx='9' cy='7' r='4'/>
              <path d='M23 21v-2a4 4 0 00-3-3.87'/><path d='M16 3.13a4 4 0 010 7.75'/>
            </svg>
          )},
        ] : []),
        { href: '/perfil', label: 'Perfil', icon: (
          <svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
            <path d='M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z'/>
          </svg>
        )},
      ],
    },
  ]

  const sair = () => {
    localStorage.removeItem('medico')
    localStorage.removeItem('clinica_admin')
    localStorage.removeItem('clinica')
    router.push('/login')
  }

  return (
    <aside style={{
      width: 240,
      background: 'white',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
      padding: '20px 14px',
    }}>
      {/* Logo no topo */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '4px 10px', marginBottom: 24,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 9,
          background: ACCENT,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='white' strokeWidth='2.5' strokeLinecap='round' strokeLinejoin='round'>
            <path d='M4 18 L4 6 L10 6 L12 9 L20 9 L20 18 Z'/>
          </svg>
        </div>
        <span style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>MedIA</span>
      </div>

      {/* Grupos de navegação */}
      <nav style={{ flex: 1, overflow: 'auto', overscrollBehavior: 'contain' as const }}>
        {grupos.map((grupo, gi) => {
          if (grupo.items.length === 0) return null
          return (
            <div key={gi} style={{ marginBottom: 22 }}>
              {grupo.label && (
                <p style={{
                  fontSize: 10, fontWeight: 600, color: TEXT_MUTED,
                  letterSpacing: '0.08em', margin: '0 10px 8px',
                  textTransform: 'uppercase',
                }}>
                  {grupo.label}
                </p>
              )}
              {grupo.items.map(item => {
                const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
                return (
                  <button
                    key={item.href}
                    onClick={() => router.push(item.href)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 11,
                      padding: '9px 12px', borderRadius: 9,
                      marginBottom: 2, cursor: 'pointer',
                      width: '100%', textAlign: 'left' as const,
                      background: active ? ACCENT_LIGHT : 'transparent',
                      color: active ? ACCENT : TEXT_DEFAULT,
                      fontSize: 13, fontWeight: active ? 600 : 500,
                      border: 'none',
                      transition: 'background 0.12s',
                    }}
                    onMouseEnter={e => { if (!active) e.currentTarget.style.background = '#F5F5F5' }}
                    onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
                  >
                    <span style={{ flexShrink: 0, opacity: active ? 1 : 0.7 }}>{item.icon}</span>
                    {item.label}
                  </button>
                )
              })}
            </div>
          )
        })}
      </nav>

      {/* Logout separado embaixo */}
      <div style={{ borderTop: '1px solid #F3F4F6', paddingTop: 14 }}>
        <button
          onClick={sair}
          style={{
            display: 'flex', alignItems: 'center', gap: 11,
            padding: '9px 12px', borderRadius: 9,
            cursor: 'pointer', width: '100%', textAlign: 'left' as const,
            background: 'transparent', color: '#DC2626',
            fontSize: 13, fontWeight: 500, border: 'none',
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#FEF2F2'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
            <path d='M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9'/>
          </svg>
          Sair
        </button>
      </div>
    </aside>
  )
}
