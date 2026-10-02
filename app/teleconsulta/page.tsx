'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { LucideIcon } from 'lucide-react'
import {
  Video, ChevronDown, Zap, CalendarPlus, Link2, Keyboard, Lock, Sparkles, Smartphone, MessageCircle,
  Plus, FileText, PhoneOff, VideoOff, CalendarClock,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { tokens } from '@/lib/design-tokens'
import { Avatar, Icon, IconButton, EmptyState, Button } from '@/components/ui'
import { confirmar } from '@/components/ui/dialogos'

const T = tokens

const linkSala = (salaId: string) => window.location.origin + '/sala/' + salaId
const codigoSala = (salaId: string) => (salaId || '').slice(0, 3).toUpperCase() + '-' + (salaId || '').slice(3, 7).toUpperCase()
const hora = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

function rotuloDia(iso: string) {
  const d = new Date(iso), hoje = new Date()
  const amanha = new Date(); amanha.setDate(hoje.getDate() + 1)
  if (d.toDateString() === hoje.toDateString()) return 'HOJE'
  if (d.toDateString() === amanha.toDateString()) return 'AMANHÃ'
  return d.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric' }).replace('.', '').toUpperCase()
}

function quandoComeca(iso: string) {
  const min = Math.round((new Date(iso).getTime() - Date.now()) / 60000)
  if (min <= 0) return 'agora'
  if (min < 60) return `em ${min} min`
  if (new Date(iso).toDateString() === new Date().toDateString()) return `hoje · ${hora(iso)}`
  return `${rotuloDia(iso).toLowerCase()} · ${hora(iso)}`
}

export default function Teleconsulta() {
  const router = useRouter()
  const [medico, setMedico] = useState<any>(null)
  const [salas, setSalas] = useState<any[]>([])
  const [agendadas, setAgendadas] = useState<any[]>([])
  const [carregando, setCarregando] = useState(true)
  const [criando, setCriando] = useState(false)
  const [menuNovo, setMenuNovo] = useState(false)
  const [codigo, setCodigo] = useState('')
  const [toast, setToast] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    (async () => {
      const ca = localStorage.getItem('clinica_admin')
      if (ca) {
        const admin = JSON.parse(ca)
        if (!admin.clinica_id) { router.push('/admin'); return }
        // Busca primeiro medico ativo da clinica
        const { data: primeiroMedico } = await supabase
          .from('medicos').select('*')
          .eq('clinica_id', admin.clinica_id).eq('cargo', 'medico').eq('ativo', true)
          .order('criado_em', { ascending: true }).limit(1).maybeSingle()
        if (!primeiroMedico) { router.push('/admin'); return }
        setMedico(primeiroMedico)
        carregar(primeiroMedico.id)
        return
      }
      const m = localStorage.getItem('medico')
      if (!m) { router.push('/login'); return }
      const med = JSON.parse(m); setMedico(med)
      carregar(med.id)
    })()
  }, [router])

  useEffect(() => {
    if (!menuNovo) return
    const h = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuNovo(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [menuNovo])

  const carregar = useCallback(async (mid: string) => {
    const [r, ags] = await Promise.all([
      fetch('/api/teleconsulta?medico_id=' + mid).then(x => x.json()).catch(() => ({})),
      supabase.from('agendamentos').select('id, data_hora, motivo, meet_link, status, pacientes:paciente_id(nome, telefone)')
        .eq('medico_id', mid).not('meet_link', 'is', null).neq('status', 'cancelado')
        .gte('data_hora', new Date(Date.now() - 30 * 60000).toISOString()).order('data_hora').limit(6),
    ])
    setSalas(r.teleconsultas || [])
    setAgendadas(ags.data || [])
    setCarregando(false)
  }, [])

  const avisar = (texto: string) => {
    setToast(texto)
    setTimeout(() => setToast(null), 2600)
  }

  const criarSala = async (abrir: boolean) => {
    if (!medico || criando) return
    setCriando(true); setMenuNovo(false)
    const cod = Math.random().toString(36).slice(-4).toUpperCase()
    const r = await fetch('/api/teleconsulta', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ medico_id: medico.id, titulo: 'Consulta - ' + cod })
    })
    const d = await r.json()
    if (d.teleconsulta) {
      navigator.clipboard.writeText(linkSala(d.teleconsulta.sala_id)).catch(() => {})
      await carregar(medico.id)
      if (abrir) window.open('/sala/' + d.teleconsulta.sala_id, '_blank')
      avisar(abrir ? 'Sala criada · link copiado' : 'Link criado · copiado para enviar ao paciente')
    } else {
      avisar('Não foi possível criar a sala')
    }
    setCriando(false)
  }

  const entrarComCodigo = () => {
    const v = codigo.trim()
    if (!v) return
    // Aceita link completo (…/sala/<id>) ou o próprio id da sala
    const m = v.match(/\/sala\/([^/?#\s]+)/)
    const id = m ? m[1] : v.replace(/\s/g, '')
    window.open('/sala/' + id, '_blank')
    setCodigo('')
  }

  const copiar = (link: string) => {
    navigator.clipboard.writeText(link).catch(() => {})
    avisar('Link copiado')
  }

  const enviarWpp = async (nomeTelefone: { telefone?: string } | undefined, link: string) => {
    const msgTxt = 'Olá! Dr(a). ' + medico.nome + ' te convidou para uma teleconsulta.\n\nAcesse pelo link (não precisa instalar nada):\n' + link
    if (nomeTelefone?.telefone) {
      await fetch('/api/whatsapp/enviar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telefone: nomeTelefone.telefone, texto: msgTxt, medico_id: medico.id })
      })
      avisar('Convite enviado por WhatsApp')
    } else {
      navigator.clipboard.writeText(msgTxt).catch(() => {})
      avisar('Mensagem copiada · paciente sem telefone')
    }
  }

  const encerrar = async (id: string) => {
    if (!(await confirmar({ titulo: 'Encerrar esta sala?', mensagem: 'O link deixa de funcionar e quem estiver na chamada é desconectado.', confirmar: 'Encerrar sala', perigo: true }))) return
    await supabase.from('teleconsultas').update({ status: 'encerrada', encerrada_em: new Date().toISOString() }).eq('id', id)
    carregar(medico.id)
    avisar('Sala encerrada')
  }

  if (!medico) return null

  const ativas = salas.filter(s => s.status !== 'encerrada')
  const seteDias = Date.now() - 7 * 86400000
  const encerradas = salas.filter(s => s.status === 'encerrada' && new Date(s.encerrada_em || s.criado_em).getTime() > seteDias).slice(0, 6)
  const proxima = agendadas[0]

  const opcoesNovo: { icon: LucideIcon; label: string; desc: string; fn: () => void }[] = [
    { icon: Zap, label: 'Iniciar agora', desc: 'Abre a sala e copia o link', fn: () => criarSala(true) },
    { icon: CalendarPlus, label: 'Agendar para depois', desc: 'Marca na agenda com link de vídeo', fn: () => router.push('/agenda?nova_teleconsulta=1') },
    { icon: Link2, label: 'Criar link para enviar', desc: 'Gera a sala sem entrar agora', fn: () => criarSala(false) },
  ]

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 26 }}>
      {/* Hero */}
      <div className="tele-hero" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.25fr) minmax(0,1fr)', gap: 24, alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, minWidth: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <h2 className="tele-titulo" style={{ margin: 0, fontSize: 28, fontWeight: 700, letterSpacing: '-.03em', lineHeight: 1.15, textWrap: 'balance' as any, color: T.text.primary }}>
              Atenda por vídeo com o prontuário pronto no final
            </h2>
            <p style={{ margin: 0, fontSize: 14, color: T.text.quaternary, lineHeight: 1.55, maxWidth: 520 }}>
              Inicie uma sala agora, agende para depois ou entre com o código enviado ao paciente.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <div ref={menuRef} style={{ position: 'relative' }}>
              <Button size="lg" icon={Video} iconRight={ChevronDown} onClick={() => setMenuNovo(!menuNovo)} disabled={criando}>
                {criando ? 'Criando sala…' : 'Nova teleconsulta'}
              </Button>
              {menuNovo && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 8px)', left: 0, width: 290, background: '#fff', zIndex: 50,
                  border: `1px solid ${T.border.default}`, borderRadius: 14, boxShadow: T.shadow.lg, padding: 6,
                }}>
                  {opcoesNovo.map(o => (
                    <button key={o.label} onClick={o.fn} style={{
                      display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: 10, borderRadius: 10,
                      border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                    }}
                      onMouseEnter={e => e.currentTarget.style.background = T.bg.hover}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <span style={{ width: 34, height: 34, borderRadius: 10, background: T.brand.primarySubtle, color: T.brand.primary, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                        <Icon icon={o.icon} size={16} />
                      </span>
                      <span style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <span style={{ fontSize: 13.5, fontWeight: 600, color: T.text.primary }}>{o.label}</span>
                        <span style={{ fontSize: 12, color: T.text.quaternary }}>{o.desc}</span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <label style={{
              flex: '1 1 220px', minWidth: 0, maxWidth: 340, display: 'flex', alignItems: 'center', gap: 8, height: 44,
              padding: '0 6px 0 14px', borderRadius: 12, border: `1px solid ${T.border.default}`, color: T.text.tertiary, cursor: 'text',
            }}>
              <Keyboard size={17} strokeWidth={1.6} />
              <input
                value={codigo} onChange={e => setCodigo(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') entrarComCodigo() }}
                placeholder="Código ou link da sala"
                style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', padding: 0, minHeight: 0, boxShadow: 'none', fontSize: 13.5, color: T.text.primary }}
              />
              <button onClick={entrarComCodigo} disabled={!codigo.trim()} style={{
                border: 'none', background: 'transparent', padding: '7px 10px', borderRadius: 8, fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
                color: codigo.trim() ? T.brand.primary : T.text.tertiary, cursor: codigo.trim() ? 'pointer' : 'default',
              }}>Entrar</button>
            </label>
          </div>

          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', fontSize: 12.5, color: T.text.secondary }}>
            {([[Lock, 'Criptografia ponta a ponta'], [Sparkles, 'Prontuário gerado por IA'], [Smartphone, 'Paciente entra sem instalar nada']] as [LucideIcon, string][]).map(([I, t]) => (
              <span key={t} style={{ display: 'flex', alignItems: 'center', gap: 6 }}><I size={14} strokeWidth={1.6} color={T.brand.primary} />{t}</span>
            ))}
          </div>
        </div>

        {/* Próxima teleconsulta (card escuro) */}
        <div style={{ borderRadius: 20, background: T.night[800], color: '#fff', padding: 22, display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0, minHeight: 190 }}>
          {proxima ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#A8A5B8', flex: 1 }}>Próxima teleconsulta</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#4ADE80', background: 'rgba(74,222,128,.12)', padding: '4px 10px', borderRadius: 99 }}>{quandoComeca(proxima.data_hora)}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <span style={{ width: 52, height: 52, borderRadius: '50%', background: T.night[600], color: '#D9D2FF', display: 'grid', placeItems: 'center', fontSize: 17, fontWeight: 700, flexShrink: 0 }}>
                  {(proxima.pacientes?.nome || 'P').split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase()}
                </span>
                <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span style={{ fontSize: 18, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{proxima.pacientes?.nome || 'Paciente'}</span>
                  <span style={{ fontSize: 12.5, color: '#A8A5B8' }}>{proxima.motivo || 'Teleconsulta'} · {hora(proxima.data_hora)}</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <BotaoEscuro primario onClick={() => window.open(proxima.meet_link, '_blank')}><Video size={16} strokeWidth={1.6} />Entrar na sala</BotaoEscuro>
                <BotaoEscuro titulo="Copiar link" onClick={() => copiar(proxima.meet_link)}><Link2 size={16} strokeWidth={1.6} /></BotaoEscuro>
                <BotaoEscuro titulo="Enviar lembrete por WhatsApp" onClick={() => enviarWpp(proxima.pacientes, proxima.meet_link)}><MessageCircle size={16} strokeWidth={1.6} /></BotaoEscuro>
              </div>
            </>
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 10 }}>
              <span style={{ width: 44, height: 44, borderRadius: 14, background: 'rgba(255,255,255,.08)', display: 'grid', placeItems: 'center', color: '#D9D2FF' }}>
                <CalendarClock size={20} strokeWidth={1.6} />
              </span>
              <span style={{ fontSize: 16, fontWeight: 700 }}>Nenhuma teleconsulta agendada</span>
              <span style={{ fontSize: 12.5, color: '#A8A5B8', lineHeight: 1.5 }}>Agende pela agenda marcando “com vídeo” — o link é enviado ao paciente automaticamente.</span>
              <div><BotaoEscuro onClick={() => router.push('/agenda?nova_teleconsulta=1')}><CalendarPlus size={16} strokeWidth={1.6} />Agendar teleconsulta</BotaoEscuro></div>
            </div>
          )}
        </div>
      </div>

      {/* Salas ativas */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, letterSpacing: '-.01em' }}>Salas ativas</h3>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: T.status.success, background: T.status.successBg, padding: '2px 8px', borderRadius: 99 }}>{ativas.length}</span>
        </div>
        {carregando ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
            {[0, 1].map(i => <div key={i} className="c360-skel" style={{ height: 150, borderRadius: 16 }} />)}
          </div>
        ) : ativas.length === 0 ? (
          <div style={{ border: `1px dashed #E4E2EA`, borderRadius: 16 }}>
            <EmptyState icon={VideoOff} titulo="Nenhuma sala aberta" descricao="Crie uma sala em “Nova teleconsulta” — ela aparece aqui enquanto estiver ativa." />
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
            {ativas.map(s => <CartaoSala key={s.id} sala={s} medico={medico} onEntrar={() => window.open('/sala/' + s.sala_id, '_blank')}
              onCopiar={() => copiar(linkSala(s.sala_id))} onWpp={() => enviarWpp(s.pacientes, linkSala(s.sala_id))} onEncerrar={() => encerrar(s.id)} />)}
          </div>
        )}
      </div>

      {/* Agendadas + Encerradas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, alignItems: 'start' }}>
        <div style={lista}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, letterSpacing: '-.01em', flex: 1 }}>Agendadas</h3>
            <button onClick={() => router.push('/agenda?nova_teleconsulta=1')} style={linkBtn}
              onMouseEnter={e => e.currentTarget.style.background = T.brand.primarySubtle} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <Plus size={14} />Agendar
            </button>
          </div>
          {agendadas.length === 0 ? (
            <div style={{ padding: '14px 0', borderTop: `1px solid ${T.border.muted}`, fontSize: 13, color: T.text.quaternary }}>Nenhuma teleconsulta nos próximos dias.</div>
          ) : agendadas.map(a => (
            <div key={a.id} style={linha}>
              <div style={{ width: 52, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '6px 0', borderRadius: 10, background: T.bg.page }}>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: '#9A98A5' }}>{rotuloDia(a.data_hora)}</span>
                <span className="mono" style={{ fontSize: 12.5 }}>{hora(a.data_hora)}</span>
              </div>
              <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', lineHeight: 1.35 }}>
                <span style={nomeLinha}>{a.pacientes?.nome || 'Paciente'}</span>
                <span style={{ fontSize: 12, color: T.text.quaternary }}>{a.motivo || 'Teleconsulta'}</span>
              </span>
              <IconButton icon={Link2} size={32} title="Copiar link" onClick={() => copiar(a.meet_link)} />
              <Button variant="secondary" size="sm" onClick={() => window.open(a.meet_link, '_blank')}>Iniciar</Button>
            </div>
          ))}
        </div>

        <div style={lista}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, letterSpacing: '-.01em', flex: 1 }}>Encerradas</h3>
            <span style={{ fontSize: 12, color: T.text.tertiary }}>últimos 7 dias</span>
          </div>
          {encerradas.length === 0 ? (
            <div style={{ padding: '14px 0', borderTop: `1px solid ${T.border.muted}`, fontSize: 13, color: T.text.quaternary }}>Nenhuma teleconsulta encerrada na última semana.</div>
          ) : encerradas.map(e => {
            const dur = e.duracao_segundos ? `${Math.max(1, Math.round(e.duracao_segundos / 60))} min` : null
            const quando = new Date(e.encerrada_em || e.criado_em).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }).replace('.', '')
            return (
              <div key={e.id} style={linha}>
                <span style={{ width: 36, height: 36, borderRadius: '50%', background: T.border.muted, color: T.text.secondary, display: 'grid', placeItems: 'center', fontSize: 11.5, fontWeight: 700, flexShrink: 0 }}>
                  {(e.pacientes?.nome || e.titulo || '?').split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase()}
                </span>
                <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', lineHeight: 1.35 }}>
                  <span style={nomeLinha}>{e.pacientes?.nome || e.titulo || 'Teleconsulta'}</span>
                  <span style={{ fontSize: 12, color: T.text.quaternary }}>{[dur, quando].filter(Boolean).join(' · ')}</span>
                </span>
                <button onClick={() => window.open('/sala/' + e.sala_id + '/historico', '_blank')} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 600, color: T.brand.primary,
                  background: T.brand.primarySubtle, padding: '5px 9px', borderRadius: 99, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit',
                }}>
                  <FileText size={12} />Registro
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {toast && (
        <div style={{
          position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)', zIndex: 300,
          background: T.night[800], color: '#fff', padding: '10px 18px', borderRadius: 99, fontSize: 13, fontWeight: 600,
          boxShadow: T.shadow.lg,
        }}>{toast}</div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `@media (max-width: 980px) { .tele-hero { grid-template-columns: minmax(0,1fr) !important; } } @media (max-width: 759px) { .tele-titulo { font-size: 22px !important; } }` }} />
    </div>
  )
}

const lista: React.CSSProperties = { border: `1px solid ${T.border.default}`, borderRadius: 16, padding: 18, display: 'flex', flexDirection: 'column', gap: 2 }
const linha: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderTop: `1px solid ${T.border.muted}` }
const nomeLinha: React.CSSProperties = { fontSize: 13.5, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: T.text.primary }
const linkBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 5, fontSize: 12.5, fontWeight: 600, color: T.brand.primary, padding: '5px 8px',
  borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit',
}

function BotaoEscuro({ children, onClick, primario, titulo }: { children: React.ReactNode; onClick: () => void; primario?: boolean; titulo?: string }) {
  const [h, setH] = useState(false)
  return (
    <button title={titulo} onClick={onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)} style={{
      flex: primario ? 1 : 'none', minWidth: primario ? 150 : 42, height: 42, padding: primario || !titulo ? '0 16px' : 0, borderRadius: 12,
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, border: 'none', cursor: 'pointer', color: '#fff',
      fontSize: 13.5, fontWeight: 600, fontFamily: 'inherit',
      background: primario ? (h ? '#6A4FE0' : T.brand.primary) : h ? 'rgba(255,255,255,.16)' : 'rgba(255,255,255,.1)',
    }}>{children}</button>
  )
}

function CartaoSala({ sala, medico, onEntrar, onCopiar, onWpp, onEncerrar }: {
  sala: any; medico: any; onEntrar: () => void; onCopiar: () => void; onWpp: () => void; onEncerrar: () => void
}) {
  const [h, setH] = useState(false)
  const andamento = sala.status === 'em_andamento'
  const desde = Math.max(1, Math.round((Date.now() - new Date(sala.iniciada_em || sala.criado_em).getTime()) / 60000))
  return (
    <div onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)} style={{
      border: `1px solid ${h ? 'transparent' : T.border.default}`, borderRadius: 16, padding: 18, display: 'flex', flexDirection: 'column', gap: 14,
      boxShadow: h ? '0 10px 28px -12px rgba(40,30,80,.22)' : 'none', transition: 'box-shadow .2s, border-color .2s', background: '#fff',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: andamento ? T.status.success : '#D9A23B' }} />
        <span style={{ flex: 1, fontSize: 12, fontWeight: 700, color: andamento ? T.status.success : '#8A6A1F' }}>{andamento ? 'Em andamento' : 'Aguardando paciente'}</span>
        <span className="mono" style={{ fontSize: 11.5, color: T.text.tertiary }}>{codigoSala(sala.sala_id)}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ display: 'flex' }}>
          <span style={{ marginRight: -8, border: '2px solid #fff', borderRadius: '50%', display: 'inline-flex' }}><Avatar nome={medico?.nome} size={34} /></span>
          {sala.pacientes?.nome && <span style={{ border: '2px solid #fff', borderRadius: '50%', display: 'inline-flex' }}><Avatar nome={sala.pacientes.nome} size={34} tom="pink" /></span>}
        </div>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2, paddingLeft: 8 }}>
          <span style={nomeLinha}>{sala.pacientes?.nome || sala.titulo || 'Sala sem paciente'}</span>
          <span style={{ fontSize: 12, color: T.text.quaternary }}>{andamento ? `há ${desde} min` : `criada há ${desde} min`}</span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <Button icon={Video} onClick={onEntrar} style={{ flex: 1 }}>{andamento ? 'Voltar à sala' : 'Entrar'}</Button>
        <IconButton icon={Link2} variant="outline" title="Copiar link" onClick={onCopiar} />
        <IconButton icon={MessageCircle} variant="outline" title="Enviar por WhatsApp" onClick={onWpp} />
        <IconButton icon={PhoneOff} variant="outline" tone="danger" title="Encerrar sala" onClick={onEncerrar} />
      </div>
    </div>
  )
}
