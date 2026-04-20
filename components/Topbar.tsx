'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const ACCENT = '#1F9D5C'
const TEXT_DEFAULT = '#111827'
const TEXT_MUTED = '#6B7280'
const BUSCA_BG = '#EAECEF'

export function Topbar() {
  const router = useRouter()
  const pathname = usePathname()

  const [medico, setMedico] = useState<any>(null)
  const [clinica, setClinica] = useState<any>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifs, setNotifs] = useState<any[]>([])

  const [busca, setBusca] = useState('')
  const [buscaFocus, setBuscaFocus] = useState(false)
  const [buscaHover, setBuscaHover] = useState(false)
  const [resultadosOpen, setResultadosOpen] = useState(false)
  const [resultados, setResultados] = useState<{ pacientes: any[]; agendamentos: any[] }>({ pacientes: [], agendamentos: [] })
  const [buscando, setBuscando] = useState(false)

  const menuRef = useRef<HTMLDivElement>(null)
  const notifRef = useRef<HTMLDivElement>(null)
  const buscaRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

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
      carregarNotificacoes(med.id)
      const intervalId = setInterval(() => carregarNotificacoes(med.id), 60000)
      return () => clearInterval(intervalId)
    }
  }, [])

  const carregarNotificacoes = async (medicoId: string) => {
    try {
      const r = await fetch(`/api/notificacoes-sofia?medico_id=${medicoId}&nao_lidas=true`)
      const d = await r.json()
      if (d.notificacoes) {
        setNotifs(d.notificacoes.map((n: any) => ({
          id: n.id, titulo: n.titulo, descricao: n.descricao,
          tempo: formatarTempo(n.criada_em), lida: n.lida,
          agendamento_id: n.agendamento_id, tipo: n.tipo,
        })))
      }
    } catch {}
  }

  const formatarTempo = (iso: string) => {
    const diff = (Date.now() - new Date(iso).getTime()) / 60000
    if (diff < 1) return 'agora'
    if (diff < 60) return `${Math.round(diff)} min atras`
    if (diff < 1440) return `${Math.round(diff / 60)}h atras`
    return `${Math.round(diff / 1440)}d atras`
  }

  const marcarNotifLida = async (id: string) => {
    try {
      await fetch('/api/notificacoes-sofia', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, lida: true }),
      })
      setNotifs(prev => prev.filter((n: any) => n.id !== id))
    } catch {}
  }

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false)
      if (buscaRef.current && !buscaRef.current.contains(e.target as Node)) setResultadosOpen(false)
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
    setResultadosOpen(true)
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

  const iniciaisUsuario = useMemo(() => {
    if (!medico?.nome) return '??'
    return medico.nome.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()
  }, [medico])

  const primeiroNome = medico?.nome?.split(' ')[0] || ''
  const inicialClinica = clinica?.nome?.[0]?.toUpperCase() || ''

  const sair = () => {
    localStorage.removeItem('medico')
    router.push('/login')
  }

  const notifsNaoLidas = notifs.length

  const iconBtnStyle = (active: boolean) => ({
    width: 40, height: 40, borderRadius: 11,
    background: active ? '#F3F4F6' : 'transparent',
    border: 'none', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    position: 'relative' as const,
    transition: 'background 0.12s',
  })

  // Fundo da busca: normal, hover, ou focus
  const buscaBg = BUSCA_BG

  return (
    <header style={{
      height: 64, background: 'white',
      display: 'flex', alignItems: 'center',
      gap: 8, padding: '0 20px', flexShrink: 0,
    }}>
      {/* ESQUERDA — Busca */}
      <div ref={buscaRef}
        style={{ flex: 1, maxWidth: 440, position: 'relative' }}>
        <svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke={TEXT_MUTED} strokeWidth='2'
          style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
          <circle cx='11' cy='11' r='8'/><line x1='21' y1='21' x2='16.65' y2='16.65'/>
        </svg>
        <input
          ref={inputRef}
          type='text'
          placeholder='Buscar pacientes, agendamentos...'
          value={busca}
          onChange={e => setBusca(e.target.value)}
          onFocus={() => { setBuscaFocus(true); if (busca.length >= 2) setResultadosOpen(true) }}
          onBlur={() => setBuscaFocus(false)}
          style={{
            width: '100%', height: 36,
            padding: '0 14px 0 36px',
            background: BUSCA_BG,
            border: 'none', borderRadius: 10,
            outline: 'none', fontSize: 13, color: TEXT_DEFAULT,
            boxSizing: 'border-box',
            WebkitAppearance: 'none' as const,
            MozAppearance: 'none' as const,
            appearance: 'none' as const,
            boxShadow: 'none',
          }}
        />

        {resultadosOpen && busca.length >= 2 && (
          <div style={{
            position: 'absolute', top: 48, left: 0, right: 0,
            background: 'white', borderRadius: 12,
            maxHeight: 380, overflow: 'auto', zIndex: 100,
            boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
          }}>
            {buscando && <div style={{ padding: 16, fontSize: 12, color: TEXT_MUTED }}>Buscando...</div>}
            {!buscando && resultados.pacientes.length === 0 && resultados.agendamentos.length === 0 && (
              <div style={{ padding: 16, fontSize: 12, color: TEXT_MUTED }}>Nenhum resultado</div>
            )}
            {resultados.pacientes.length > 0 && (
              <div>
                <p style={{ margin: 0, padding: '10px 16px 6px', fontSize: 10, fontWeight: 600, color: TEXT_MUTED, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Pacientes</p>
                {resultados.pacientes.map((p: any) => (
                  <button key={p.id}
                    onClick={() => { router.push(`/pacientes/${p.id}`); setBusca(''); setResultadosOpen(false) }}
                    style={{ display: 'block', width: '100%', textAlign: 'left' as const, padding: '9px 16px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13, color: TEXT_DEFAULT }}
                    onMouseEnter={e => e.currentTarget.style.background = '#F5F5F5'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    {p.nome}
                    {p.telefone && <span style={{ color: TEXT_MUTED, marginLeft: 8, fontSize: 11 }}>{p.telefone}</span>}
                  </button>
                ))}
              </div>
            )}
            {resultados.agendamentos.length > 0 && (
              <div>
                <p style={{ margin: 0, padding: '10px 16px 6px', fontSize: 10, fontWeight: 600, color: TEXT_MUTED, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Agendamentos</p>
                {resultados.agendamentos.map((a: any) => (
                  <button key={a.id}
                    onClick={() => { router.push('/agenda'); setBusca(''); setResultadosOpen(false) }}
                    style={{ display: 'block', width: '100%', textAlign: 'left' as const, padding: '9px 16px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13, color: TEXT_DEFAULT }}
                    onMouseEnter={e => e.currentTarget.style.background = '#F5F5F5'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    {a.motivo || 'Consulta'}
                    <span style={{ color: TEXT_MUTED, marginLeft: 8, fontSize: 11 }}>{new Date(a.data_hora).toLocaleDateString('pt-BR')}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* DIREITA — empurra todo o resto pra direita */}
      <div style={{ flex: 1 }}/>

      {/* 1. Chat */}
      <button
        onClick={() => router.push('/whatsapp-app')}
        title='Chat'
        style={iconBtnStyle(pathname.startsWith('/whatsapp'))}
        onMouseEnter={e => { if (!pathname.startsWith('/whatsapp')) e.currentTarget.style.background = '#F5F5F5' }}
        onMouseLeave={e => { if (!pathname.startsWith('/whatsapp')) e.currentTarget.style.background = 'transparent' }}
      >
        <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke={TEXT_DEFAULT} strokeWidth='2'>
          <path d='M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z'/>
        </svg>
      </button>

      {/* 2. Notificação */}
      <div ref={notifRef} style={{ position: 'relative' }}>
        <button
          onClick={() => setNotifOpen(!notifOpen)}
          style={iconBtnStyle(notifOpen)}
          onMouseEnter={e => { if (!notifOpen) e.currentTarget.style.background = '#F5F5F5' }}
          onMouseLeave={e => { if (!notifOpen) e.currentTarget.style.background = 'transparent' }}
        >
          <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke={TEXT_DEFAULT} strokeWidth='2'>
            <path d='M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9'/>
            <path d='M13.73 21a2 2 0 01-3.46 0'/>
          </svg>
          {notifsNaoLidas > 0 && (
            <span style={{
              position: 'absolute', top: 9, right: 10,
              width: 8, height: 8, borderRadius: '50%', background: '#DC2626',
            }}/>
          )}
        </button>

        {notifOpen && (
          <div style={{
            position: 'absolute', top: 48, right: 0, width: 340,
            background: 'white', borderRadius: 12, zIndex: 100,
            maxHeight: 440, overflow: 'auto',
            boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
          }}>
            <div style={{ padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: TEXT_DEFAULT }}>Notificacoes</p>
              {notifs.length > 0 && (
                <button
                  onClick={async () => {
                    await Promise.all(notifs.map((n: any) => fetch('/api/notificacoes-sofia', {
                      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ id: n.id, lida: true }),
                    })))
                    setNotifs([])
                  }}
                  style={{ fontSize: 11, color: ACCENT, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                >Marcar todas</button>
              )}
            </div>
            {notifs.length === 0 ? (
              <div style={{ padding: '32px 20px', textAlign: 'center', fontSize: 12, color: TEXT_MUTED }}>Tudo em dia</div>
            ) : (
              notifs.map((n: any) => (
                <div key={n.id}
                  onClick={() => {
                    marcarNotifLida(n.id)
                    if (n.agendamento_id) router.push('/agenda')
                    setNotifOpen(false)
                  }}
                  style={{ padding: '12px 16px', cursor: 'pointer', background: n.lida ? 'white' : '#F8FAFC' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#F3F4F6'}
                  onMouseLeave={e => e.currentTarget.style.background = n.lida ? 'white' : '#F8FAFC'}
                >
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: TEXT_DEFAULT }}>{n.titulo}</p>
                  {n.descricao && <p style={{ margin: '2px 0 0', fontSize: 11, color: TEXT_MUTED }}>{n.descricao}</p>}
                  <p style={{ margin: '4px 0 0', fontSize: 10, color: TEXT_MUTED }}>{n.tempo}</p>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* 3. Clínica */}
      {clinica?.nome && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '6px 12px 6px 6px', borderRadius: 22,
          marginLeft: 6,
        }}>
          {clinica.logo_url ? (
            <img src={clinica.logo_url} alt='' style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }}/>
          ) : (
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: '#F3F4F6', color: TEXT_MUTED,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700,
            }}>{inicialClinica}</div>
          )}
          <span style={{ fontSize: 13, fontWeight: 500, color: TEXT_DEFAULT, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{clinica.nome}</span>
        </div>
      )}

      {/* 4. Médico */}
      <div ref={menuRef} style={{ position: 'relative' }}>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '6px 12px 6px 6px', borderRadius: 22,
            background: menuOpen ? '#F3F4F6' : 'transparent',
            border: 'none', cursor: 'pointer',
            transition: 'background 0.12s',
          }}
          onMouseEnter={e => { if (!menuOpen) e.currentTarget.style.background = '#F5F5F5' }}
          onMouseLeave={e => { if (!menuOpen) e.currentTarget.style.background = 'transparent' }}
        >
          {medico?.foto_url ? (
            <img src={medico.foto_url} alt='' style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }}/>
          ) : (
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: ACCENT, color: 'white',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 700,
            }}>{iniciaisUsuario}</div>
          )}
          {primeiroNome && <span style={{ fontSize: 13, fontWeight: 500, color: TEXT_DEFAULT }}>{primeiroNome}</span>}
        </button>

        {menuOpen && (
          <div style={{
            position: 'absolute', top: 52, right: 0, width: 220,
            background: 'white', borderRadius: 12, zIndex: 100,
            padding: 6, boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
          }}>
            <button
              onClick={() => { router.push('/perfil'); setMenuOpen(false) }}
              style={{ display: 'block', width: '100%', textAlign: 'left' as const, padding: '9px 12px', border: 'none', background: 'transparent', borderRadius: 8, cursor: 'pointer', fontSize: 13, color: TEXT_DEFAULT }}
              onMouseEnter={e => e.currentTarget.style.background = '#F5F5F5'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >Meu perfil</button>
            <button
              onClick={sair}
              style={{ display: 'block', width: '100%', textAlign: 'left' as const, padding: '9px 12px', border: 'none', background: 'transparent', borderRadius: 8, cursor: 'pointer', fontSize: 13, color: '#DC2626' }}
              onMouseEnter={e => e.currentTarget.style.background = '#FEF2F2'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >Sair</button>
          </div>
        )}
      </div>
    </header>
  )
}
