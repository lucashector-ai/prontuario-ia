'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'

interface Props { activeHref: string }

export function Sidebar({ activeHref }: Props) {
  const router = useRouter()
  const [medico, setMedico] = useState<any>(null)

  useEffect(() => {
    const m = localStorage.getItem('medico')
    if (m) setMedico(JSON.parse(m))
  }, [])

  const iniciais = medico?.nome?.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase() || '??'

  const navItems = [
    {
      href: '/', label: 'Nova consulta',
      icon: (active: boolean) => (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 5v14M5 12h14"/>
        </svg>
      )
    },
    {
      href: '/historico', label: 'Histórico',
      icon: (active: boolean) => (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
      )
    },
    {
      href: '/pacientes', label: 'Pacientes',
      icon: (active: boolean) => (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
        </svg>
      )
    },
  ]

  return (
    <aside style={{
      width: 220, background: 'white',
      borderRight: '1px solid #e5e7eb',
      display: 'flex', flexDirection: 'column',
      flexShrink: 0, height: '100vh',
    }}>
      {/* Logo */}
      <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid #f3f4f6' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8, background: '#16a34a',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
            </svg>
          </div>
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, color: '#111827', margin: 0, lineHeight: 1.2 }}>MedIA</p>
            <p style={{ fontSize: 11, color: '#9ca3af', margin: 0 }}>Prontuário inteligente</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ padding: '12px 12px', flex: 1 }}>
        {/* Seção principal */}
        <p style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 8px 8px', padding: 0 }}>Principal</p>
        {navItems.map(item => {
          const active = activeHref === item.href
          return (
            <a key={item.href} href={item.href} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '7px 10px', borderRadius: 7, marginBottom: 2,
              textDecoration: 'none',
              background: active ? '#f0fdf4' : 'transparent',
              color: active ? '#16a34a' : '#374151',
              fontSize: 13, fontWeight: active ? 600 : 400,
              border: active ? '1px solid #dcfce7' : '1px solid transparent',
              transition: 'all 0.1s',
            }}>
              <span style={{ flexShrink: 0, opacity: active ? 1 : 0.6 }}>{item.icon(active)}</span>
              {item.label}
            </a>
          )
        })}
      </nav>

      {/* User footer */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid #f3f4f6' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 6px', borderRadius: 8 }}>
          <div style={{
            width: 34, height: 34, borderRadius: '50%',
            background: '#f0fdf4', border: '1.5px solid #bbf7d0',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 700, color: '#16a34a', flexShrink: 0,
          }}>{iniciais}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: '#111827', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{medico?.nome || '—'}</p>
            <p style={{ fontSize: 11, color: '#9ca3af', margin: 0 }}>{medico?.especialidade || medico?.crm || '—'}</p>
          </div>
          <button
            onClick={() => { localStorage.removeItem('medico'); router.push('/login') }}
            title="Sair"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 4, borderRadius: 5, flexShrink: 0 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>
            </svg>
          </button>
        </div>
      </div>
    </aside>
  )
}
