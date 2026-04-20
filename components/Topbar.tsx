'use client'

import { useEffect, useState, useRef, useMemo } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export function Topbar() {
  const router = useRouter()
  const pathname = usePathname()

  const [medico, setMedico] = useState<any>(null)
  const [clinica, setClinica] = useState<any>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifs, setNotifs] = useState<any[]>([])

  const [buscaOpen, setBuscaOpen] = useState(false)
  const [busca, setBusca] = useState('')
  const [resultados, setResultados] = useState<{ pacientes: any[]; agendamentos: any[] }>({ pacientes: [], agendamentos: [] })
  const [buscando, setBuscando] = useState(false)

  const menuRef = useRef<HTMLDivElement>(null)
  const notifRef = useRef<HTMLDivElement>(null)
  const buscaRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const m = localStorage.getItem('medico')
    if (m) {
      const med = JSON.parse(m)
      setMedico(med)
      if (med.clinica_id) {
        supabase.from('clinicas').select('id, nome, logo_url').eq('id', med.clinica_id).single().then(({ data }) => {
          if (data) setClinica(data)
          else setClinica({ nome: med.clinica_nome || null, logo_url: med.clinica_logo || null })
        })
      } else {
        setClinica({ nome: med.clinica_nome || null, logo_url: med.clinica_logo || med.foto_url || null })
      }
      // Carrega notificações da Sofia
      carregarNotificacoes(med.id)
      // Poll a cada 60s
      const intervalId = setInterval(() => carregarNotificacoes(med.id), 60000)
      return () => clearInterval(intervalId)
    }
  }, [])

  const carregarNotificacoes = async (medicoId: string) => {
    try {
      const r = await fetch(`/api/notificacoes-sofia?medico_id=${medicoId}&nao_lidas=true`)
      const d = await r.json()
      if (d.notificacoes) {
        const formatadas = d.notificacoes.map((n: any) => ({
          id: n.id,
          titulo: n.titulo,
          descricao: n.descricao,
          tempo: formatarTempo(n.criada_em),
          lida: n.lida,
          agendamento_id: n.agendamento_id,
          tipo: n.tipo,
        }))
        setNotifs(formatadas)
      }
    } catch (e) {
      console.error('erro ao carregar notificacoes:', e)
    }
  }

  const formatarTempo = (iso: string) => {
    const diff = (Date.now() - new Date(iso).getTime()) / 60000
    if (diff < 1) return 'agora'
    if (diff < 60) return `${Math.round(diff)} min atrás`
    if (diff < 1440) return `${Math.round(diff / 60)}h atrás`
    return `${Math.round(diff / 1440)}d atrás`
  }

  const marcarNotifLida = async (id: string) => {
    try {
      await fetch('/api/notificacoes-sofia', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, lida: true }),
      })
      setNotifs(prev => prev.filter((n: any) => n.id !== id))
    } catch {}
  }

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false)
      if (buscaRef.current && !buscaRef.current.contains(e.target as Node)) setBuscaOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (!medico || !busca.trim() || busca.length < 2) {
      setResultados({ pacientes: [], agendamentos: [] })
      return
    }
    setBuscando(true)
    const timer = setTimeout(async () => {
      const termo = busca.trim()
      const [{ data: pacs }, { data: ags }] = await Promise.all([
        supabase.from('pacientes').select('id, nome, telefone').eq('medico_id', medico.id).ilike('nome', `%${termo}%`).limit(6),
        supabase.from('agendamentos').select('id, data_hora, motivo, tipo, pacientes(nome)').eq('medico_id', medico.id).ilike('motivo', `%${termo}%`).order('data_hora', { ascending: false }).limit(4),
      ])
      setResultados({ pacientes: pacs || [], agendamentos: ags || [] })
      setBuscando(false)
    }, 250)
    return () => clearTimeout(timer)
  }, [busca, medico])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setBuscaOpen(true) }
      if (e.key === 'Escape') { setBuscaOpen(false); setMenuOpen(false); setNotifOpen(false) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const inicialClinica = useMemo(() => clinica?.nome?.[0]?.toUpperCase() || '·', [clinica])
  const iniciaisUsuario = useMemo(() => {
    if (!medico?.nome) return '??'
    return medico.nome.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()
  }, [medico])

  const sair = () => {
    localStorage.removeItem('medico')
    router.push('/login')
  }

  const notifsNaoLidas = notifs.filter(n => !n.lida).length

  return (
    <>
      <header style={{
        height: 56, background: 'white', borderBottom: '1px solid #f3f4f6',
        padding: '0 20px 0 0', display: 'flex', alignItems: 'center',
        gap: 8, flexShrink: 0,
      }}>
        {/* LOGO MedIA (esquerda) */}
        <button onClick={() => router.push('/dashboard')}
          style={{
            width: 220, height: '100%', padding: '0 20px',
            display: 'flex', alignItems: 'center', gap: 10,
            border: 'none', background: 'transparent', cursor: 'pointer',
            flexShrink: 0,
          }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8, background: '#6043C1',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
            </svg>
          </div>
          <div style={{ textAlign: 'left' }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: '#111827', margin: 0, lineHeight: 1.2 }}>MedIA</p>
            <p style={{ fontSize: 10, color: '#9ca3af', margin: 0 }}>Prontuário inteligente</p>
          </div>
        </button>

        <div style={{ flex: 1 }}/>

        {/* Ações */}
        <button onClick={() => router.push('/whatsapp-app')} title="WhatsApp"
          style={iconBtnStyle(pathname.startsWith('/whatsapp'))}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/>
          </svg>
        </button>

        <button onClick={() => setBuscaOpen(true)} title="Buscar (Cmd+K)" style={iconBtnStyle(false)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
        </button>

        <div ref={notifRef} style={{ position: 'relative' }}>
          <button onClick={() => setNotifOpen(!notifOpen)} title="Notificações" style={iconBtnStyle(notifOpen)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 01-3.46 0"/>
            </svg>
            {notifsNaoLidas > 0 && (
              <span style={{ position: 'absolute', top: 6, right: 6, width: 8, height: 8, borderRadius: '50%', background: '#dc2626', border: '2px solid white' }}/>
            )}
          </button>
          {notifOpen && (
            <div style={dropdownStyle(320)}>
              <div style={{ padding: '14px 16px', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#111827' }}>Notificações</p>
                {notifs.length > 0 && (
                  <button onClick={async () => {
                    await Promise.all(notifs.map((n: any) => fetch('/api/notificacoes-sofia', {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ id: n.id, lida: true }),
                    })))
                    setNotifs([])
                  }}
                    style={{ fontSize: 11, color: '#6043C1', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                    Marcar como lidas
                  </button>
                )}
              </div>
              {notifs.length === 0 ? (
                <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5" style={{ margin: '0 auto 10px', display: 'block' }}>
                    <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                  </svg>
                  <p style={{ margin: 0, fontSize: 12, color: '#9ca3af' }}>Nenhuma notificação por aqui</p>
                </div>
              ) : (
                notifs.map((n: any) => (
                  <div key={n.id} 
                    onClick={() => {
                      marcarNotifLida(n.id)
                      if (n.agendamento_id) router.push('/agenda')
                      setNotifOpen(false)
                    }}
                    style={{ padding: '12px 16px', borderBottom: '1px solid #f9fafb', background: n.lida ? 'white' : '#faf8ff', cursor: 'pointer' }}>
                    <p style={{ margin: 0, fontSize: 13, color: '#111827', fontWeight: n.lida ? 400 : 600 }}>{n.titulo}</p>
                    {n.descricao && <p style={{ margin: '2px 0 0', fontSize: 11, color: '#6b7280' }}>{n.descricao}</p>}
                    <p style={{ margin: '4px 0 0', fontSize: 11, color: '#9ca3af' }}>{n.tempo}</p>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Divisor antes da área de identidade */}
        <div style={{ width: 1, height: 24, background: '#f3f4f6', margin: '0 4px 0 8px' }}/>

        {/* CLÍNICA (se tiver) */}
        {clinica?.nome && (
          <button onClick={() => router.push('/minha-clinica')} title="Minha clínica"
            style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '4px 10px 4px 4px',
              borderRadius: 22, background: 'white', cursor: 'pointer',
            }}>
            <div style={{
              width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
              background: clinica?.logo_url ? `url(${clinica.logo_url}) center/cover` : '#ede9fb',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#6043C1', fontSize: 12, fontWeight: 700,
            }}>
              {!clinica?.logo_url && inicialClinica}
            </div>
            <span style={{
              fontSize: 12, fontWeight: 600, color: '#374151',
              maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {clinica.nome}
            </span>
          </button>
        )}

        {/* USUÁRIO (mais à direita) */}
        <div ref={menuRef} style={{ position: 'relative' }}>
          <button onClick={() => setMenuOpen(!menuOpen)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '4px 4px 4px 10px',
              borderRadius: 22, background: menuOpen ? '#faf8ff' : 'white',
              cursor: 'pointer', transition: 'background 0.15s',
            }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#374151', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {medico?.nome?.split(' ')[0] || 'Médico'}
            </span>
            <div style={{
              width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
              background: medico?.foto_url ? `url(${medico.foto_url}) center/cover` : '#ede9fb', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700, color: '#6043C1',
            }}>
              {!medico?.foto_url && iniciaisUsuario}
            </div>
          </button>
          {menuOpen && (
            <div style={dropdownStyle(240)}>
              <div style={{ padding: '14px 16px', borderBottom: '1px solid #f3f4f6' }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {medico?.nome || 'Médico'}
                </p>
                <p style={{ margin: '2px 0 0', fontSize: 11, color: '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {medico?.especialidade || medico?.crm || 'Clínica'}
                </p>
              </div>
              <MenuItem onClick={() => { setMenuOpen(false); router.push('/perfil') }} icon={
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z"/>
                </svg>
              }>Perfil</MenuItem>
              <MenuItem onClick={() => { setMenuOpen(false); router.push('/minha-clinica') }} icon={
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
                </svg>
              }>Minha clínica</MenuItem>
              <MenuItem onClick={() => { setMenuOpen(false); window.open('https://media-ajuda.vercel.app', '_blank') }} icon={
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3M12 17h.01"/>
                </svg>
              }>Central de ajuda</MenuItem>
              <div style={{ height: 1, background: '#f3f4f6', margin: '4px 0' }}/>
              <MenuItem onClick={sair} danger icon={
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>
                </svg>
              }>Sair</MenuItem>
            </div>
          )}
        </div>
      </header>

      {buscaOpen && (
        <div onClick={() => setBuscaOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.4)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '10vh', zIndex: 200 }}>
          <div ref={buscaRef} onClick={e => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 560, background: 'white', borderRadius: 12, boxShadow: '0 20px 40px rgba(0,0,0,0.15)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', borderBottom: '1px solid #f3f4f6' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input autoFocus value={busca} onChange={e => setBusca(e.target.value)}
                placeholder="Buscar pacientes ou agendamentos..."
                style={{ flex: 1, border: 'none', outline: 'none', fontSize: 14, color: '#111827' }}/>
              <kbd style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, color: '#9ca3af', fontFamily: 'inherit' }}>ESC</kbd>
            </div>
            <div style={{ maxHeight: '50vh', overflow: 'auto' }}>
              {busca.length < 2 ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>Digite ao menos 2 caracteres para buscar</div>
              ) : buscando ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>Buscando...</div>
              ) : resultados.pacientes.length === 0 && resultados.agendamentos.length === 0 ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>Nenhum resultado para "{busca}"</div>
              ) : (
                <>
                  {resultados.pacientes.length > 0 && (
                    <div>
                      <div style={sectionHeaderStyle}>Pacientes</div>
                      {resultados.pacientes.map(p => (
                        <button key={p.id} onClick={() => { setBuscaOpen(false); setBusca(''); router.push(`/pacientes/${p.id}`) }}
                          style={resultItemStyle}>
                          <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#ede9fb', color: '#6043C1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                            {p.nome.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()}
                          </div>
                          <div style={{ flex: 1, textAlign: 'left', overflow: 'hidden' }}>
                            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nome}</p>
                            {p.telefone && <p style={{ margin: 0, fontSize: 11, color: '#9ca3af' }}>{p.telefone}</p>}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  {resultados.agendamentos.length > 0 && (
                    <div>
                      <div style={sectionHeaderStyle}>Agendamentos</div>
                      {resultados.agendamentos.map(a => (
                        <button key={a.id} onClick={() => { setBuscaOpen(false); setBusca(''); router.push('/agenda') }}
                          style={resultItemStyle}>
                          <div style={{ width: 28, height: 28, borderRadius: 6, background: '#ede9fb', color: '#6043C1', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/></svg>
                          </div>
                          <div style={{ flex: 1, textAlign: 'left', overflow: 'hidden' }}>
                            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.motivo || 'Agendamento'}</p>
                            <p style={{ margin: 0, fontSize: 11, color: '#9ca3af' }}>
                              {(a.pacientes as any)?.nome || 'Paciente'} · {new Date(a.data_hora).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

const iconBtnStyle = (active: boolean): React.CSSProperties => ({
  width: 36, height: 36, borderRadius: 8, border: 'none',
  background: active ? '#ede9fb' : 'transparent',
  color: active ? '#6043C1' : '#6b7280',
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
  position: 'relative', transition: 'background 0.15s',
})

const dropdownStyle = (width: number): React.CSSProperties => ({
  position: 'absolute', top: 'calc(100% + 6px)', right: 0, width,
  background: 'white', borderRadius: 10,
  boxShadow: '0 8px 24px rgba(17,24,39,0.08)', overflow: 'hidden', zIndex: 150,
})

const sectionHeaderStyle: React.CSSProperties = {
  padding: '8px 18px', fontSize: 10, fontWeight: 700, color: '#9ca3af',
  textTransform: 'uppercase', letterSpacing: '0.06em', background: '#fafafa',
}

const resultItemStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 18px',
  width: '100%', border: 'none', background: 'white', cursor: 'pointer',
  textAlign: 'left' as const, borderBottom: '1px solid #f9fafb',
}

function MenuItem({ children, icon, onClick, danger }: { children: React.ReactNode; icon: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px',
        width: '100%', border: 'none', background: 'white', cursor: 'pointer',
        fontSize: 13, color: danger ? '#dc2626' : '#374151', textAlign: 'left' as const,
      }}
      onMouseOver={e => { e.currentTarget.style.background = danger ? '#fef2f2' : '#faf8ff' }}
      onMouseOut={e => { e.currentTarget.style.background = 'white' }}>
      <span style={{ opacity: 0.6, display: 'flex' }}>{icon}</span>
      {children}
    </button>
  )
}
