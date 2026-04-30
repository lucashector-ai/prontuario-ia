'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { VisaoGeral } from '@/components/minha-clinica/VisaoGeral'
import { Procedimentos } from '@/components/minha-clinica/Procedimentos'
import { Lgpd } from '@/components/minha-clinica/Lgpd'

const ACCENT = '#6043C1'
const ACCENT_LIGHT = '#ede9fb'
const BG = '#F5F5F5'

type TabKey = 'visao' | 'procedimentos' | 'sofia' | 'automacoes' | 'lgpd'

const TABS: Array<{ key: TabKey; label: string; icon: React.ReactNode }> = [
  { key: 'visao', label: 'Visão geral', icon: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  )},
  { key: 'procedimentos', label: 'Procedimentos', icon: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 11H1l8-8v6h6v6"/><path d="M15 13h8l-8 8v-6H9V9"/>
    </svg>
  )},
  { key: 'sofia', label: 'Sofia · IA', icon: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 8V4H8"/><rect x="4" y="12" width="16" height="8" rx="2"/>
      <path d="M2 14h2M20 14h2M15 13v2M9 13v2"/>
    </svg>
  )},
  { key: 'automacoes', label: 'Automações', icon: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
    </svg>
  )},
  { key: 'lgpd', label: 'Privacidade & LGPD', icon: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  )},
]

export default function MinhaClinicaPage() {
  const router = useRouter()
  const [tab, setTab] = useState<TabKey>('visao')

  useEffect(() => {
    const ca_ = localStorage.getItem('clinica_admin')
    const m = ca_ || localStorage.getItem('medico')
    if (!m) { router.push('/login'); return }
  }, [router])

  return (
    <main style={{ height: '100%', overflow: 'auto', background: BG, padding: 24 }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>Minha Clínica</h1>
        <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>Configurações, equipe, automações e privacidade — tudo no mesmo lugar</p>
      </div>

      {/* Tabs horizontais */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid #e5e7eb', overflowX: 'auto', flexWrap: 'nowrap' as const }}>
        {TABS.map(t => {
          const ativo = tab === t.key
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '10px 16px', border: 'none', background: 'transparent',
                fontSize: 13, fontWeight: ativo ? 700 : 500,
                color: ativo ? ACCENT : '#6b7280',
                borderBottom: ativo ? `2px solid ${ACCENT}` : '2px solid transparent',
                marginBottom: -1, cursor: 'pointer', whiteSpace: 'nowrap' as const,
                transition: 'color 0.15s',
              }}
              onMouseEnter={e => { if (!ativo) e.currentTarget.style.color = '#111827' }}
              onMouseLeave={e => { if (!ativo) e.currentTarget.style.color = '#6b7280' }}>
              {t.icon}
              {t.label}
            </button>
          )
        })}
      </div>

      {/* Conteúdo da tab ativa */}
      {tab === 'visao' && <VisaoGeral />}
      {tab === 'procedimentos' && <Procedimentos />}
      {tab === 'sofia' && <Placeholder titulo="Sofia · IA" descricao="Configure a assistente IA do WhatsApp." />}
      {tab === 'automacoes' && <Placeholder titulo="Automações" descricao="Lembretes, follow-ups e mensagens programadas." />}
      {tab === 'lgpd' && <Lgpd />}
    </main>
  )
}

function Placeholder({ titulo, descricao }: { titulo: string; descricao: string }) {
  return (
    <div style={{ background: 'white', borderRadius: 16, padding: 48, textAlign: 'center' as const }}>
      <div style={{ width: 56, height: 56, borderRadius: 14, background: ACCENT_LIGHT, color: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
      </div>
      <p style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: '0 0 6px' }}>{titulo}</p>
      <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>{descricao}</p>
      <p style={{ fontSize: 11, color: '#9ca3af', margin: '14px 0 0', fontStyle: 'italic' as const }}>Em breve nesta aba</p>
    </div>
  )
}
