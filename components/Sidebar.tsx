'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface Props { activeHref: string }

export function Sidebar({ activeHref }: Props) {
  const router = useRouter()
  const [medico, setMedico] = useState<any>(null)
  const [expandido, setExpandido] = useState(false)

  useEffect(() => {
    const m = localStorage.getItem('medico')
    if (m) setMedico(JSON.parse(m))
  }, [])

  const iniciais = medico?.nome?.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase() || '??'

  const navItems = [
    {
      href: '/', label: 'Nova consulta',
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
    },
    {
      href: '/historico', label: 'Histórico',
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
    },
    {
      href: '/pacientes', label: 'Pacientes',
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>
    },
  ]

  const w = expandido ? 200 : 64

  return (
    <aside style={{
      width: w, background: '#0d1f1c',
      display: 'flex', flexDirection: 'column',
      alignItems: expandido ? 'stretch' : 'center',
      padding: expandido ? '16px 0' : '16px 0',
      flexShrink: 0,
      borderRight: '1px solid rgba(255,255,255,0.06)',
      transition: 'width 0.2s ease',
      overflow: 'hidden',
    }}>

      {/* Logo + toggle */}
      <div style={{
        display: 'flex', alignItems: 'center',
        justifyContent: expandido ? 'space-between' : 'center',
        padding: expandido ? '0 16px 20px' : '0 0 20px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        marginBottom: 8,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 9, background: '#16a34a',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
          }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
            </svg>
          </div>
          {expandido && (
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: 'white', margin: 0, lineHeight: 1.2 }}>MedIA</p>
              <p style={{ fontSize: 10, color: 'rgba(163,184,181,0.6)', margin: 0 }}>Prontuário inteligente</p>
            </div>
          )}
        </div>
        {expandido && (
          <button onClick={() => setExpandido(false)} style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'rgba(163,184,181,0.5)', padding: 4, borderRadius: 6,
            display: 'flex', alignItems: 'center',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6"/>
            </svg>
          </button>
        )}
      </div>

      {/* Toggle expand quando colapsado */}
      {!expandido && (
        <button onClick={() => setExpandido(true)} style={{
          width: 36, height: 36, borderRadius: 9, background: 'transparent',
          border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer',
          color: 'rgba(163,184,181,0.5)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', marginBottom: 8,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 18l6-6-6-6"/>
          </svg>
        </button>
      )}

      {/* Nav */}
      <nav style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: expandido ? 'stretch' : 'center',
        padding: expandido ? '0 10px' : '0', gap: 2,
      }}>
        {navItems.map(item => {
          const active = activeHref === item.href
          return (
            <a key={item.href} href={item.href} title={!expandido ? item.label : undefined} style={{
              display: 'flex', alignItems: 'center',
              justifyContent: expandido ? 'flex-start' : 'center',
              gap: expandido ? 10 : 0,
              width: expandido ? '100%' : 40, height: 40,
              borderRadius: 9, textDecoration: 'none',
              padding: expandido ? '0 10px' : '0',
              background: active ? 'rgba(22,163,74,0.18)' : 'transparent',
              color: active ? '#4ade80' : 'rgba(163,184,181,0.6)',
              border: active ? '1px solid rgba(22,163,74,0.25)' : '1px solid transparent',
              fontSize: 13, fontWeight: active ? 600 : 400,
              transition: 'all 0.15s',
            }}>
              <span style={{ flexShrink: 0 }}>{item.icon}</span>
              {expandido && <span>{item.label}</span>}
            </a>
          )
        })}
      </nav>

      {/* Avatar / logout */}
      <div style={{
        padding: expandido ? '12px 10px 0' : '12px 0 0',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', flexDirection: 'column',
        alignItems: expandido ? 'stretch' : 'center', gap: 6,
      }}>
        {expandido && medico && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 10px' }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%', background: 'rgba(22,163,74,0.2)',
              border: '1.5px solid rgba(22,163,74,0.35)', display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#4ade80', flexShrink: 0
            }}>{iniciais}</div>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: 'white', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{medico.nome}</p>
              <p style={{ fontSize: 10, color: 'rgba(163,184,181,0.5)', margin: 0 }}>{medico.especialidade || medico.crm}</p>
            </div>
          </div>
        )}
        <button
          onClick={() => { localStorage.removeItem('medico'); router.push('/login') }}
          title="Sair"
          style={{
            width: expandido ? '100%' : 36, height: 36, borderRadius: expandido ? 9 : '50%',
            background: expandido ? 'transparent' : 'rgba(22,163,74,0.15)',
            border: expandido ? '1px solid rgba(255,255,255,0.08)' : '1.5px solid rgba(22,163,74,0.3)',
            color: expandido ? 'rgba(163,184,181,0.5)' : '#4ade80',
            fontSize: expandido ? 12 : 11, fontWeight: expandido ? 400 : 700,
            cursor: 'pointer', display: 'flex', alignItems: 'center',
            justifyContent: expandido ? 'flex-start' : 'center',
            gap: expandido ? 8 : 0, padding: expandido ? '0 10px' : '0',
          }}>
          {expandido ? (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>
              </svg>
              Sair
            </>
          ) : iniciais}
        </button>
      </div>
    </aside>
  )
}
