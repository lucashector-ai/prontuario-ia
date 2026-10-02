'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import type { LucideIcon } from 'lucide-react'
import {
  Search, Sparkles, Bell, MessageCircle, CalendarHeart, ChartColumnBig, ReceiptText, LayoutTemplate, ChevronDown, CornerDownLeft, UserRound, SlidersHorizontal, Hospital, LogOut,
  LayoutDashboard, Calendar, Users, Clock, CirclePlus, Video, ScanSearch, ClipboardList, CalendarCheck, CalendarClock,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { tokens } from '@/lib/design-tokens'
import { Icon, IconButton, Avatar } from '@/components/ui'
import { useHeaderInfo, tituloDaRota } from '@/components/shell/header-context'

import { ehAtendente, sairDaConta } from '@/lib/sessao'
const T = tokens

const PAGINAS: { label: string; href: string; icon: LucideIcon }[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Agenda', href: '/agenda', icon: Calendar },
  { label: 'Pacientes', href: '/pacientes', icon: Users },
  { label: 'Histórico', href: '/historico', icon: Clock },
  { label: 'Retornos e reativação', href: '/retornos', icon: CalendarHeart },
  { label: 'Relatórios', href: '/relatorios', icon: ChartColumnBig },
  { label: 'Faturamento de convênios (TISS)', href: '/faturamento', icon: ReceiptText },
  { label: 'Modelos de prontuário', href: '/modelos-prontuario', icon: LayoutTemplate },
  { label: 'Nova consulta', href: '/nova-consulta', icon: CirclePlus },
  { label: 'Teleconsulta', href: '/teleconsulta', icon: Video },
  { label: 'Analisar exames', href: '/exames', icon: ScanSearch },
  { label: 'Assistente IA', href: '/assistente-ia', icon: Sparkles },
  { label: 'Chat (WhatsApp, Instagram, Messenger)', href: '/chat', icon: MessageCircle },
  { label: 'Minha clínica', href: '/minha-clinica', icon: Hospital },
  { label: 'Painel admin', href: '/admin', icon: SlidersHorizontal },
  { label: 'Formulários', href: '/formularios', icon: ClipboardList },
  { label: 'Agenda pública', href: '/configuracoes/agenda-publica', icon: CalendarCheck },
  { label: 'Perfil', href: '/perfil', icon: UserRound },
]

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

const popover: React.CSSProperties = {
  position: 'absolute', top: 'calc(100% + 8px)', background: '#fff', border: `1px solid ${T.border.default}`,
  borderRadius: 14, boxShadow: T.shadow.lg, padding: 6, zIndex: 60,
}
const itemMenu: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10, width: '100%', boxSizing: 'border-box', textAlign: 'left',
  padding: '9px 10px', borderRadius: 9, fontSize: 13, color: T.text.strong, background: 'transparent',
  border: 'none', cursor: 'pointer', fontFamily: 'inherit',
}
const hoverOn = (e: React.MouseEvent<HTMLElement>) => { e.currentTarget.style.background = T.bg.hover }
const hoverOff = (e: React.MouseEvent<HTMLElement>) => { e.currentTarget.style.background = 'transparent' }

/**
 * Cabeçalho do app: título/subtítulo da página, busca ⌘K, atalhos e chip da clínica.
 * `compacto` (mobile) esconde o subtítulo e põe a busca em linha própria.
 */
export function Topbar({ compacto = false }: { compacto?: boolean }) {
  const router = useRouter()
  const pathname = usePathname()
  const headerPagina = useHeaderInfo()
  const { titulo, descricao } = headerPagina || tituloDaRota(pathname)

  const [medico, setMedico] = useState<any>(null)
  const [clinicaAdmin, setClinicaAdmin] = useState<any>(null)
  const [clinica, setClinica] = useState<any>(null)
  const [aberto, setAberto] = useState<null | 'menu' | 'notif' | 'busca'>(null)
  const [notifs, setNotifs] = useState<any[]>([])

  const [busca, setBusca] = useState('')
  const [buscaFocus, setBuscaFocus] = useState(false)
  const [resultados, setResultados] = useState<{ pacientes: any[]; agendamentos: any[] }>({ pacientes: [], agendamentos: [] })
  const [buscando, setBuscando] = useState(false)

  const rootRef = useRef<HTMLDivElement>(null)
  const [atendente, setAtendente] = useState(false)
  useEffect(() => { setAtendente(ehAtendente()) }, [])
  const inputRef = useRef<HTMLInputElement>(null)

  const modo: 'clinica' | 'medico' | null = clinicaAdmin ? 'clinica' : (medico ? 'medico' : null)

  useEffect(() => {
    const ca = localStorage.getItem('clinica_admin')
    const c = localStorage.getItem('clinica')

    if (ca) {
      const parsedAdmin = JSON.parse(ca)
      setClinicaAdmin(parsedAdmin)
      if (c) {
        setClinica(JSON.parse(c))
      } else if (parsedAdmin.clinica_id) {
        supabase.from('clinicas').select('id, nome, logo_url, tipo').eq('id', parsedAdmin.clinica_id).single().then(({ data }) => {
          if (data) {
            setClinica(data)
            localStorage.setItem('clinica', JSON.stringify(data))
          }
        })
      }
      if (parsedAdmin.clinica_id) {
        carregarNotificacoesClinica(parsedAdmin.clinica_id)
        const intervalId = setInterval(() => carregarNotificacoesClinica(parsedAdmin.clinica_id), 60000)
        return () => clearInterval(intervalId)
      }
      return
    }

    const m = localStorage.getItem('medico')
    if (m) {
      const med = JSON.parse(m)
      setMedico(med)
      if (med.clinica_id) {
        supabase.from('clinicas').select('id, nome, logo_url, tipo').eq('id', med.clinica_id).single().then(({ data }) => {
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
      // Sincroniza notificacoes (gera novas baseadas na agenda do dia)
      try {
        const adm = localStorage.getItem('clinica_admin')
        const med = localStorage.getItem('medico')
        const dadosClinica = adm ? JSON.parse(adm) : (med ? JSON.parse(med) : null)
        const clinicaId = dadosClinica?.clinica_id || dadosClinica?.id
        if (clinicaId) {
          await fetch('/api/notificacoes/sincronizar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clinica_id: clinicaId, medico_id_logado: medicoId })
          })
        }
      } catch {}
      const r = await fetch(`/api/notificacoes-sofia?medico_id=${medicoId}&nao_lidas=true`)
      const d = await r.json()
      if (d.notificacoes) setNotifs(d.notificacoes.map(mapNotif))
    } catch {}
  }

  const carregarNotificacoesClinica = async (clinicaId: string) => {
    try {
      try {
        await fetch('/api/notificacoes/sincronizar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clinica_id: clinicaId })
        })
      } catch {}
      const r = await fetch(`/api/notificacoes-sofia?clinica_id=${clinicaId}&nao_lidas=true`)
      const d = await r.json()
      if (d.notificacoes) setNotifs(d.notificacoes.map(mapNotif))
    } catch {}
  }

  const mapNotif = (n: any) => ({
    id: n.id, titulo: n.titulo, descricao: n.descricao,
    tempo: formatarTempo(n.criada_em), lida: n.lida,
    agendamento_id: n.agendamento_id, paciente_id: n.paciente_id, tipo: n.tipo,
  })

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
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, lida: true }),
      })
      setNotifs(prev => prev.filter((n: any) => n.id !== id))
    } catch {}
  }

  // Fecha popovers com clique fora / Esc; ⌘K foca a busca
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setAberto(null)
    }
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); inputRef.current?.focus() }
      if (e.key === 'Escape') { setAberto(null); inputRef.current?.blur() }
    }
    document.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); window.removeEventListener('keydown', onKey) }
  }, [])

  useEffect(() => { setAberto(null) }, [pathname])

  // Busca de pacientes/agendamentos (só médico — usa medico_id)
  useEffect(() => {
    if (modo !== 'medico' || !medico || busca.trim().length < 2) {
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
  }, [busca, medico, modo])

  const paginasFiltradas = useMemo(() => {
    const q = semAcento(busca.trim())
    const base = atendente ? PAGINAS.filter(p => p.href === '/chat') : PAGINAS
    return (q ? base.filter(p => semAcento(p.label).includes(q)) : base.slice(0, 6))
  }, [busca, atendente])

  const sair = () => router.push(sairDaConta())

  const ir = (href: string) => { router.push(href); setBusca(''); setAberto(null); inputRef.current?.blur() }

  const nomeUsuario = clinicaAdmin?.nome || medico?.nome || ''
  const nomeClinica = clinica?.nome || nomeUsuario
  const semResultado = !buscando && busca.trim().length >= 2 && resultados.pacientes.length === 0 && resultados.agendamentos.length === 0 && paginasFiltradas.length === 0

  return (
    <header ref={rootRef} style={{
      display: 'flex', alignItems: 'center', gap: '10px 12px', padding: '0 2px',
      flexWrap: compacto ? 'wrap' : 'nowrap', position: 'relative', zIndex: 45,
    }}>
      {/* Título da página */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <h1 style={{ margin: 0, fontSize: compacto ? 19 : 21, fontWeight: 700, letterSpacing: '-.025em', lineHeight: 1.2, color: T.text.primary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{titulo}</h1>
        {descricao && !compacto && (
          <div style={{ fontSize: 12.5, color: T.text.quaternary, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{descricao}</div>
        )}
      </div>

      {/* Busca ⌘K */}
      <div style={{ flex: compacto ? '1 1 100%' : '0 1 320px', order: compacto ? 3 : 0, minWidth: 0, position: 'relative' }}>
        <label style={{
          display: 'flex', alignItems: 'center', gap: 10, height: 38, padding: '0 6px 0 14px', borderRadius: 12, background: '#fff',
          border: `1px solid ${buscaFocus ? T.brand.primaryAccent : T.border.default}`, boxShadow: buscaFocus ? T.shadow.focusRing : 'none',
          color: T.text.tertiary, cursor: 'text', transition: 'border-color .15s, box-shadow .15s',
        }}>
          <Search size={16} strokeWidth={1.6} />
          <input
            ref={inputRef}
            value={busca}
            onChange={e => { setBusca(e.target.value); setAberto('busca') }}
            onFocus={() => { setBuscaFocus(true); setAberto('busca') }}
            onBlur={() => setBuscaFocus(false)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                const p = resultados.pacientes[0]
                if (p) ir(`/pacientes/${p.id}`)
                else if (paginasFiltradas[0]) ir(paginasFiltradas[0].href)
              }
            }}
            placeholder="Buscar paciente ou página"
            style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', padding: 0, minHeight: 0, boxShadow: 'none', fontSize: 13.5, color: T.text.primary }}
          />
          <kbd style={{ fontSize: 11, border: `1px solid ${T.border.default}`, borderRadius: 7, padding: '3px 7px', background: T.bg.page, color: T.text.secondary }}>⌘K</kbd>
        </label>

        {aberto === 'busca' && (
          <div style={{ ...popover, left: 0, right: 0, minWidth: 300, maxHeight: 380, overflow: 'auto' }}>
            {buscando && <div style={{ padding: '10px 10px', fontSize: 12.5, color: T.text.quaternary }}>Buscando…</div>}
            {resultados.pacientes.length > 0 && (
              <>
                <div style={{ fontSize: 11.5, color: '#9A98A5', padding: '8px 10px 4px' }}>Pacientes</div>
                {resultados.pacientes.map((p: any) => (
                  <button key={p.id} onMouseDown={e => e.preventDefault()} onClick={() => ir(`/pacientes/${p.id}`)} style={itemMenu} onMouseEnter={hoverOn} onMouseLeave={hoverOff}>
                    <Avatar nome={p.nome} size={28} />
                    <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: 600 }}>{p.nome}</span>
                      {p.telefone && <span style={{ fontSize: 12, color: T.text.quaternary }}>{p.telefone}</span>}
                    </span>
                  </button>
                ))}
              </>
            )}
            {resultados.agendamentos.length > 0 && (
              <>
                <div style={{ fontSize: 11.5, color: '#9A98A5', padding: '8px 10px 4px' }}>Agendamentos</div>
                {resultados.agendamentos.map((a: any) => (
                  <button key={a.id} onMouseDown={e => e.preventDefault()} onClick={() => ir('/agenda?ag=' + a.id)} style={itemMenu} onMouseEnter={hoverOn} onMouseLeave={hoverOff}>
                    <Icon icon={CalendarClock} size={16} color={T.text.secondary} />
                    <span style={{ flex: 1 }}>{a.motivo || 'Consulta'}</span>
                    <span className="mono" style={{ fontSize: 11.5, color: T.text.tertiary }}>{new Date(a.data_hora).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}</span>
                  </button>
                ))}
              </>
            )}
            {paginasFiltradas.length > 0 && (
              <>
                <div style={{ fontSize: 11.5, color: '#9A98A5', padding: '8px 10px 4px' }}>Páginas</div>
                {paginasFiltradas.map(p => (
                  <button key={p.href} onMouseDown={e => e.preventDefault()} onClick={() => ir(p.href)} style={itemMenu} onMouseEnter={hoverOn} onMouseLeave={hoverOff}>
                    <Icon icon={p.icon} size={16} color={T.text.secondary} />
                    <span style={{ flex: 1 }}>{p.label}</span>
                    <CornerDownLeft size={13} color="#B4B2BF" />
                  </button>
                ))}
              </>
            )}
            {semResultado && (
              <div style={{ padding: '22px 10px', textAlign: 'center', fontSize: 13, color: T.text.quaternary }}>Nada encontrado para “{busca}”</div>
            )}
          </div>
        )}
      </div>

      {/* Atalhos */}
      {modo && (
        <div style={{ display: 'flex', flexShrink: 0, gap: 4, position: 'relative' }}>
          {!atendente && <IconButton icon={Sparkles} size={38} title="Assistente IA" onClick={() => router.push('/assistente-ia')} />}
          <IconButton
            icon={Bell} size={38} title="Notificações"
            active={aberto === 'notif'}
            badge={notifs.length > 0 ? (notifs.length > 9 ? '9+' : notifs.length) : undefined}
            onClick={() => setAberto(aberto === 'notif' ? null : 'notif')}
          />
          {aberto === 'notif' && (
            <div style={{ ...popover, right: 0, width: 340, padding: 0, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px 10px' }}>
                <span style={{ fontSize: 14, fontWeight: 700 }}>Notificações</span>
                {notifs.length > 0 && (
                  <button
                    onClick={async () => {
                      await Promise.all(notifs.map((n: any) => fetch('/api/notificacoes-sofia', {
                        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ id: n.id, lida: true }),
                      })))
                      setNotifs([])
                    }}
                    style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 600, color: T.brand.primary, fontFamily: 'inherit' }}
                  >Marcar todas como lidas</button>
                )}
              </div>
              <div style={{ maxHeight: 380, overflowY: 'auto' }}>
                {notifs.length === 0 ? (
                  <div style={{ padding: '28px 16px', textAlign: 'center', fontSize: 13, color: T.text.quaternary, borderTop: `1px solid ${T.border.muted}` }}>Tudo em dia</div>
                ) : notifs.map((n: any) => (
                  <button
                    key={n.id}
                    onClick={() => {
                      marcarNotifLida(n.id)
                      if (n.agendamento_id) router.push('/agenda?ag=' + n.agendamento_id)
                      else if (n.paciente_id) router.push('/pacientes/' + n.paciente_id)
                      else router.push('/agenda')
                      setAberto(null)
                    }}
                    style={{ ...itemMenu, borderRadius: 0, gap: 12, padding: '12px 16px', alignItems: 'flex-start', borderTop: `1px solid ${T.border.muted}`, background: n.lida ? '#fff' : T.brand.primarySoftBg }}
                    onMouseEnter={hoverOn}
                    onMouseLeave={e => e.currentTarget.style.background = n.lida ? '#fff' : T.brand.primarySoftBg}
                  >
                    <span style={{ width: 34, height: 34, borderRadius: 11, flexShrink: 0, display: 'grid', placeItems: 'center', background: T.brand.primaryLight, color: T.brand.primary }}>
                      <Bell size={16} strokeWidth={1.6} />
                    </span>
                    <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: T.text.primary }}>{n.titulo}</span>
                      {n.descricao && <span style={{ fontSize: 12, color: T.text.quaternary, lineHeight: 1.4 }}>{n.descricao}</span>}
                      <span style={{ fontSize: 11.5, color: '#B4B2BF', marginTop: 2 }}>{n.tempo}</span>
                    </span>
                    {!n.lida && <span style={{ width: 8, height: 8, borderRadius: '50%', background: T.brand.primary, marginTop: 6, flexShrink: 0 }} />}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Chip da clínica + menu do usuário */}
      {modo && (
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <button
            onClick={() => setAberto(aberto === 'menu' ? null : 'menu')}
            style={{
              display: 'flex', alignItems: 'center', gap: 9, height: 38, padding: '0 10px 0 4px', borderRadius: 12,
              background: '#fff', border: `1px solid ${aberto === 'menu' ? '#DCD9E4' : T.border.default}`, maxWidth: 220, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            <Avatar nome={nomeClinica} size={28} forma="square" src={clinica?.logo_url} />
            {!compacto && (
              <span style={{ minWidth: 0, display: 'flex', flexDirection: 'column', lineHeight: 1.2, textAlign: 'left' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: T.text.primary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nomeClinica}</span>
                <span style={{ fontSize: 11, color: T.text.quaternary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nomeUsuario && nomeUsuario !== nomeClinica ? nomeUsuario : (modo === 'clinica' ? 'Administrador' : 'Médico')}</span>
              </span>
            )}
            <ChevronDown size={14} color={T.text.tertiary} />
          </button>

          {aberto === 'menu' && (
            <div style={{ ...popover, right: 0, width: 260 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 10px 12px' }}>
                <Avatar nome={nomeUsuario} size={36} src={medico?.foto_url} />
                <div style={{ minWidth: 0, lineHeight: 1.3 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nomeUsuario}</div>
                  <div style={{ fontSize: 12, color: T.text.quaternary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{(clinicaAdmin || medico)?.email}</div>
                </div>
              </div>
              <div style={{ height: 1, background: T.border.muted, margin: '0 4px 6px' }} />
              {!atendente && <button onClick={() => ir('/perfil')} style={itemMenu} onMouseEnter={hoverOn} onMouseLeave={hoverOff}><UserRound size={16} strokeWidth={1.6} color={T.text.secondary} />Meu perfil</button>}
              {modo === 'clinica' && (
                <>
                  <button onClick={() => ir('/admin')} style={itemMenu} onMouseEnter={hoverOn} onMouseLeave={hoverOff}><SlidersHorizontal size={16} strokeWidth={1.6} color={T.text.secondary} />Painel admin</button>
                  <button onClick={() => ir('/minha-clinica')} style={itemMenu} onMouseEnter={hoverOn} onMouseLeave={hoverOff}><Hospital size={16} strokeWidth={1.6} color={T.text.secondary} />Dados da clínica</button>
                </>
              )}
              <div style={{ height: 1, background: T.border.muted, margin: '6px 4px' }} />
              <button onClick={sair} style={{ ...itemMenu, color: T.status.danger }} onMouseEnter={e => e.currentTarget.style.background = T.status.dangerBg} onMouseLeave={hoverOff}><LogOut size={16} strokeWidth={1.6} />Sair</button>
            </div>
          )}
        </div>
      )}
    </header>
  )
}
