'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'

export function Sidebar() {
  const router = useRouter()
  const pathname = usePathname()
  const [medico, setMedico] = useState<any>(null)

  useEffect(() => {
    const m = localStorage.getItem('medico')
    if (m) setMedico(JSON.parse(m))
  }, [])

  const iniciais = medico?.nome?.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase() || '??'
  const isRecepcionista = medico?.cargo === 'recepcionista'
  const isAdmin = medico?.cargo === 'admin'

  const grupos = [
    {
      items: [
        { href: '/dashboard', label: 'Dashboard', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg> },
        ...(!isRecepcionista ? [{ href: '/nova-consulta', label: 'Nova consulta', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg> }] : []),
        { href: '/agenda', label: 'Agenda', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> },
        ...(!isRecepcionista ? [{ href: '/historico', label: 'Histórico', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg> }] : []),
        { href: '/pacientes', label: 'Pacientes', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg> },
      ]
    },
    {
      divider: true,
      items: [
        ...(!isRecepcionista ? [
          { href: '/teleconsulta', label: 'Teleconsulta', icon: <svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'><path d='M15 10l4.553-2.169A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14v-4zM3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z'/></svg> },
          { href: '/ditado', label: 'Ditado livre', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8"/></svg> },
          { href: '/exames', label: 'Analisar exames', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18"/></svg> },
          { href: '/dicionario', label: 'Dicionário clínico', icon: <svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'><path d='M4 19.5A2.5 2.5 0 016.5 17H20'/><path d='M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z'/></svg> },
        ] : []),
      ]
    },
    {
      divider: true,
      items: [
        ...(isAdmin ? [
          { href: '/clinica', label: 'Minha clínica', icon: <svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'><path d='M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z'/><polyline points='9 22 9 12 15 12 15 22'/></svg> },
          { href: '/automacoes', label: 'Automações', icon: <svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'><path d='M13 2L3 14h9l-1 8 10-12h-9l1-8z'/></svg> },
          { href: '/admin', label: 'Painel admin', icon: <svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'><path d='M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2'/><circle cx='9' cy='7' r='4'/><path d='M23 21v-2a4 4 0 00-3-3.87'/><path d='M16 3.13a4 4 0 010 7.75'/></svg> },
        ] : []),
        { href: '/perfil', label: 'Perfil', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z"/></svg> },
      ]
    },
  ]

  return (
    <aside style={{
      width: 220, background: 'transparent', borderRight: 'none',
      display: 'flex', flexDirection: 'column', flexShrink: 0, height: '100vh',
    }}>
      {/* Logo */}
      <div style={{ padding: '20px 20px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: '#6043C1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
      <nav style={{ padding: '8px 12px', flex: 1, overflow: 'auto' }}>
        {grupos.map((grupo, gi) => (
          <div key={gi}>
            {grupo.divider && grupo.items.length > 0 && (
              <div style={{ height: 1, background: '#f0f0f0', margin: '6px 4px 8px' }} />
            )}
            {grupo.items.map(item => {
              const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
              return (
                <button key={item.href} onClick={() => router.push(item.href)} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '7px 10px', borderRadius: 7, marginBottom: 1,
                  cursor: 'pointer', width: '100%', textAlign: 'left' as const,
                  background: active ? '#ede9fb' : 'transparent',
                  color: active ? '#6043C1' : '#374151',
                  fontSize: 13, fontWeight: active ? 600 : 400,
                  border: active ? '1px solid #ede9fb' : '1px solid transparent',
                }}>
                  <span style={{ flexShrink: 0, opacity: active ? 1 : 0.5 }}>{item.icon}</span>
                  {item.label}
                </button>
              )
            })}
          </div>
        ))}

        {/* WhatsApp IA — destaque no final */}
        {isAdmin && (
          <>
            <div style={{ height: 1, background: '#f0f0f0', margin: '6px 4px 8px' }} />
            <button
              onClick={() => router.push('/whatsapp')}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 10px', borderRadius: 8, marginBottom: 1,
                cursor: 'pointer', width: '100%', textAlign: 'left' as const,
                background: pathname.startsWith('/whatsapp') ? '#dcfce7' : '#f0fdf4',
                color: '#16a34a',
                fontSize: 13, fontWeight: 600,
                border: `1px solid ${pathname.startsWith('/whatsapp') ? '#86efac' : '#bbf7d0'}`,
              }}>
              <span style={{ flexShrink: 0 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
                </svg>
              </span>
              WhatsApp IA
              <span style={{ marginLeft: 'auto', fontSize: 9, fontWeight: 700, background: '#16a34a', color: 'white', padding: '1px 6px', borderRadius: 10 }}>NEW</span>
            </button>
          </>
        )}
      </nav>

      {/* Footer usuário */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid #f3f4f6' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 6px', borderRadius: 8 }}>
          <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#ede9fb', border: '1.5px solid #d4c9f7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#6043C1', flexShrink: 0 }}>{iniciais}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: '#111827', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{medico?.nome || 'Médico'}</p>
            <p style={{ fontSize: 11, color: '#9ca3af', margin: 0 }}>{medico?.especialidade || medico?.crm || 'Clínica'}</p>
          </div>
          <button onClick={() => { localStorage.removeItem('medico'); router.push('/login') }} title="Sair"
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
