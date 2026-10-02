'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ChevronDown, UserRoundCog, PanelRight, Smile, Paperclip, StickyNote, SendHorizontal, Sparkles, Hand, Check, Lock,
  AlertCircle, CheckCheck, X, ExternalLink, Zap, UserRound, Phone, Ban, ArrowLeft,
} from 'lucide-react'
import { tokens } from '@/lib/design-tokens'
import { Avatar, Button } from '@/components/ui'
import type { ChatApi } from './useChat'
import type { Conversa, Mensagem } from './tipos'
import { CANAIS, ETAPAS, canalDe, ehNota, ehSistema, etapaDe, hora, md, nomeDe } from './tipos'
import { AvatarConversa, CanalIcone, EtapaBadge, ItemMenu, MenuConversa, Popover } from './pecas'
import { supabase } from '@/lib/supabase'

import { ConvenioBadge } from '@/components/ConvenioBadge'
const T = tokens
const EMOJIS = ['😊', '🙂', '😉', '👍', '🙏', '👏', '❤️', '😅', '😂', '🤝', '✅', '📅', '⏰', '📍', '💊', '🩺', '📄', '📞', '🎉', '😔', '🤒', '💬', '👋', '⭐']

// Papel de parede do chat: bege claro com cruzes discretas (tema clínico)
const FUNDO = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='88' height='88'%3E%3Cg fill='%23d8d0c4' fill-opacity='.55'%3E%3Cpath d='M18 12h4v6h6v4h-6v6h-4v-6h-6v-4h6z'/%3E%3Ccircle cx='64' cy='26' r='2'/%3E%3Ccircle cx='30' cy='66' r='2'/%3E%3Cpath d='M62 58h3v5h5v3h-5v5h-3v-5h-5v-3h5z'/%3E%3C/g%3E%3C/svg%3E") #F0EBE4`

export function PainelConversa({ api, c, onVoltar }: { api: ChatApi; c: Conversa; onVoltar?: () => void }) {
  const router = useRouter()
  const [texto, setTexto] = useState('')
  const [modoNota, setModoNota] = useState(false)
  const [aberto, setAberto] = useState<null | 'etapa' | 'transferir' | 'menu' | 'emoji'>(null)
  const [painelContato, setPainelContato] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [selResposta, setSelResposta] = useState(0)
  const fimRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { setTexto(''); setModoNota(false); setAberto(null) }, [c.id])
  useEffect(() => { fimRef.current?.scrollIntoView({ block: 'end' }) }, [api.mensagens.length, c.id])
  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 140) + 'px'
  }, [texto])

  // "/atalho" → sugestões de respostas rápidas
  const termoAtalho = !modoNota && texto.startsWith('/') && !texto.includes(' ') ? texto.slice(1).toLowerCase() : null
  const sugestoes = useMemo(() => termoAtalho === null ? [] :
    api.respostas.filter(r => r.atalho.includes(termoAtalho) || r.texto.toLowerCase().includes(termoAtalho)).slice(0, 6),
  [termoAtalho, api.respostas])
  useEffect(() => setSelResposta(0), [termoAtalho])

  const usarResposta = (t: string) => { setTexto(t); setTimeout(() => inputRef.current?.focus(), 0) }

  const enviar = async () => {
    if (!texto.trim() || enviando) return
    setEnviando(true)
    const t = texto
    setTexto('')
    if (modoNota) await api.anotar(t)
    else await api.enviar(t)
    setEnviando(false)
    inputRef.current?.focus()
  }

  const canal = canalDe(c)
  const etapa = etapaDe(c)
  const humano = c.modo === 'humano'
  const sub = [
    canal === 'whatsapp' ? '+' + c.telefone : CANAIS.find(x => x.id === canal)!.label,
    humano ? (c.atendente_nome ? `atendido por ${c.atendente_nome}` : 'aguardando atendente') : 'Sofia IA respondendo',
  ].join(' · ')

  // Agrupa mensagens por dia
  const grupos = useMemo(() => {
    const g: { dia: string; itens: Mensagem[] }[] = []
    api.mensagens.forEach(m => {
      const d = new Date(m.criado_em)
      const hoje = new Date(); const ontem = new Date(); ontem.setDate(hoje.getDate() - 1)
      const dia = d.toDateString() === hoje.toDateString() ? 'Hoje' : d.toDateString() === ontem.toDateString() ? 'Ontem'
        : d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: d.getFullYear() !== hoje.getFullYear() ? 'numeric' : undefined })
      if (!g.length || g[g.length - 1].dia !== dia) g.push({ dia, itens: [] })
      g[g.length - 1].itens.push(m)
    })
    return g
  }, [api.mensagens])

  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 0, minWidth: 0 }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>
        {/* Cabeçalho */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderBottom: `1px solid ${T.border.default}`, background: '#fff', flexShrink: 0 }}>
          {onVoltar && <button onClick={onVoltar} aria-label="Voltar" style={iconeBtn}><ArrowLeft size={18} /></button>}
          <button onClick={() => setPainelContato(true)} style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1, border: 'none', background: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
            <AvatarConversa c={c} size={40} />
            <span style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 15.5, fontWeight: 700, color: T.text.primary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nomeDe(c)}</span>
                {c.bloqueada && <span style={{ fontSize: 10.5, fontWeight: 700, color: T.status.danger, background: T.status.dangerBg, padding: '1px 6px', borderRadius: 6 }}>BLOQUEADO</span>}
              </span>
              <span style={{ fontSize: 12.5, color: T.text.quaternary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</span>
            </span>
          </button>

          {/* Etapa */}
          <div style={{ position: 'relative' }}>
            <button onClick={() => setAberto(aberto === 'etapa' ? null : 'etapa')} style={{ ...chipBtn, gap: 4 }}>
              <EtapaBadge etapa={etapa} /><ChevronDown size={14} color={T.text.tertiary} />
            </button>
            <Popover aberto={aberto === 'etapa'} onFechar={() => setAberto(null)} style={{ top: 'calc(100% + 6px)', right: 0, width: 230 }}>
              <div style={{ fontSize: 11.5, color: '#9A98A5', padding: '6px 10px 4px' }}>Mover para</div>
              {ETAPAS.map(e => (
                <ItemMenu key={e.id} ativo={e.id === etapa}
                  label={<span style={{ display: 'flex', alignItems: 'center', gap: 9, flex: 1 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: e.cor }} />{e.label}{e.id === etapa && <Check size={15} style={{ marginLeft: 'auto' }} />}</span>}
                  onClick={() => { setAberto(null); if (e.id !== etapa) api.mudarEtapa(c, e.id) }} />
              ))}
            </Popover>
          </div>

          {/* IA / humano */}
          {humano
            ? <Button variant="secondary" size="sm" icon={Sparkles} onClick={() => api.devolverIA(c)} title="Devolver a conversa para a Sofia IA">Devolver à IA</Button>
            : <Button size="sm" icon={Hand} onClick={() => api.assumir(c)} title="Pausar a Sofia e assumir a conversa">Assumir</Button>}

          {/* Transferir */}
          <div style={{ position: 'relative' }}>
            <Button variant="secondary" size="sm" icon={UserRoundCog} onClick={() => setAberto(aberto === 'transferir' ? null : 'transferir')}>Transferir</Button>
            <Popover aberto={aberto === 'transferir'} onFechar={() => setAberto(null)} style={{ top: 'calc(100% + 6px)', right: 0, width: 250, maxHeight: 320, overflowY: 'auto' }}>
              <div style={{ fontSize: 11.5, color: '#9A98A5', padding: '6px 10px 4px' }}>Transferir para</div>
              {[api.nomeUsuario, ...api.atendentes.filter((a: any) => a.ativo !== false).map((a: any) => a.nome)]
                .filter((n, i, arr) => n && arr.indexOf(n) === i)
                .map(nome => (
                  <ItemMenu key={nome} ativo={c.atendente_nome === nome}
                    label={<span style={{ display: 'flex', alignItems: 'center', gap: 9, flex: 1 }}><Avatar nome={nome} size={24} />{nome}{nome === api.nomeUsuario && <span style={{ color: T.text.tertiary, fontSize: 12 }}>(você)</span>}</span>}
                    onClick={() => { setAberto(null); api.transferir(c, nome) }} />
                ))}
              {c.atendente_nome && <ItemMenu label="Remover atendente" onClick={() => { setAberto(null); api.transferir(c, null) }} />}
            </Popover>
          </div>

          <button onClick={() => setPainelContato(!painelContato)} title="Dados do contato" style={{ ...iconeBtn, background: painelContato ? T.brand.primaryLight : 'transparent', color: painelContato ? T.brand.primary : T.text.secondary }}>
            <PanelRight size={18} strokeWidth={1.6} />
          </button>
          <div style={{ position: 'relative' }}>
            <button onClick={() => setAberto(aberto === 'menu' ? null : 'menu')} aria-label="Mais opções" style={{ ...iconeBtn, background: aberto === 'menu' ? T.bg.hoverStrong : 'transparent' }}>
              <ChevronDown size={18} />
            </button>
            <Popover aberto={aberto === 'menu'} onFechar={() => setAberto(null)} style={{ top: 'calc(100% + 6px)', right: 0, width: 260 }}>
              <MenuConversa c={c} api={api} onFechar={() => setAberto(null)} comDados onDados={() => setPainelContato(true)} />
            </Popover>
          </div>
        </div>

        {/* Mensagens */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', background: FUNDO, padding: '18px 6% 10px' }}>
          {grupos.length === 0 && (
            <div style={{ textAlign: 'center', marginTop: 40, fontSize: 13, color: T.text.secondary }}>Nenhuma mensagem nesta conversa ainda.</div>
          )}
          {grupos.map(g => (
            <div key={g.dia}>
              <div style={{ display: 'flex', justifyContent: 'center', margin: '10px 0' }}>
                <span style={{ fontSize: 11.5, fontWeight: 600, color: T.text.secondary, background: 'rgba(255,255,255,.92)', padding: '4px 12px', borderRadius: 8, boxShadow: '0 1px 1px rgba(0,0,0,.06)' }}>{g.dia}</span>
              </div>
              {g.itens.map((m, i) => <Bolha key={m.id} m={m} anterior={g.itens[i - 1]} />)}
            </div>
          ))}
          <div ref={fimRef} />
        </div>

        {/* Compositor */}
        <div style={{ position: 'relative', padding: '10px 14px', background: modoNota ? '#FFF8DC' : '#F7F7F8', borderTop: `1px solid ${modoNota ? '#F1E2A6' : T.border.default}`, flexShrink: 0 }}>
          {sugestoes.length > 0 && (
            <div style={{ position: 'absolute', left: 14, right: 14, bottom: 'calc(100% + 6px)', background: '#fff', border: `1px solid ${T.border.default}`, borderRadius: 14, boxShadow: T.shadow.lg, padding: 6, zIndex: 20 }}>
              <div style={{ fontSize: 11.5, color: '#9A98A5', padding: '4px 10px 6px', display: 'flex', alignItems: 'center', gap: 6 }}><Zap size={12} />Respostas rápidas · ↑↓ e Enter</div>
              {sugestoes.map((r, i) => (
                <button key={r.id} onMouseDown={e => { e.preventDefault(); usarResposta(r.texto) }} style={{
                  display: 'flex', gap: 10, width: '100%', padding: '8px 10px', borderRadius: 9, border: 'none', cursor: 'pointer', textAlign: 'left',
                  fontFamily: 'inherit', background: i === selResposta ? T.bg.hover : 'transparent',
                }}>
                  <span className="mono" style={{ fontSize: 12, color: T.brand.primary, flexShrink: 0 }}>/{r.atalho}</span>
                  <span style={{ fontSize: 13, color: T.text.strong, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.texto}</span>
                </button>
              ))}
            </div>
          )}
          {c.bloqueada ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: 44, fontSize: 13, color: T.text.secondary }}>
              <Ban size={15} />Contato bloqueado. Desbloqueie pelo menu para enviar mensagens.
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
              <div style={{ position: 'relative' }}>
                <button onClick={() => setAberto(aberto === 'emoji' ? null : 'emoji')} aria-label="Emojis" style={iconeBtn}><Smile size={20} strokeWidth={1.6} /></button>
                <Popover aberto={aberto === 'emoji'} onFechar={() => setAberto(null)} style={{ bottom: 'calc(100% + 8px)', left: 0, width: 268, display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 2, padding: 8 }}>
                  {EMOJIS.map(e => (
                    <button key={e} onClick={() => { setTexto(t => t + e); inputRef.current?.focus() }} style={{ fontSize: 20, border: 'none', background: 'none', cursor: 'pointer', borderRadius: 8, padding: 4 }}>{e}</button>
                  ))}
                </Popover>
              </div>
              <button onClick={() => api.avisar('Envio de arquivos chega na próxima etapa')} aria-label="Anexar" title="Anexar arquivo" style={iconeBtn}><Paperclip size={19} strokeWidth={1.6} /></button>
              <textarea
                ref={inputRef}
                rows={1}
                value={texto}
                onChange={e => setTexto(e.target.value)}
                onKeyDown={e => {
                  if (sugestoes.length) {
                    if (e.key === 'ArrowDown') { e.preventDefault(); setSelResposta(i => (i + 1) % sugestoes.length); return }
                    if (e.key === 'ArrowUp') { e.preventDefault(); setSelResposta(i => (i - 1 + sugestoes.length) % sugestoes.length); return }
                    if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); usarResposta(sugestoes[selResposta].texto); return }
                  }
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar() }
                }}
                placeholder={modoNota ? 'Nota interna — só a equipe vê' : 'Digite uma mensagem · / para respostas rápidas'}
                style={{
                  flex: 1, resize: 'none', minHeight: 44, maxHeight: 140, padding: '12px 14px', borderRadius: 12, fontSize: 14, lineHeight: 1.45,
                  border: `1px solid ${modoNota ? '#F1E2A6' : T.border.default}`, background: '#fff', outline: 'none', fontFamily: 'inherit', color: T.text.primary,
                }}
              />
              <button onClick={() => setModoNota(!modoNota)} title="Nota interna (não vai para o paciente)" style={{
                height: 44, padding: '0 12px', borderRadius: 12, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
                background: modoNota ? '#F6E7A8' : 'transparent', color: modoNota ? '#7A5D00' : T.text.secondary,
              }}><StickyNote size={17} strokeWidth={1.6} />Nota</button>
              <button onClick={enviar} disabled={!texto.trim() || enviando} aria-label="Enviar" style={{
                width: 44, height: 44, borderRadius: '50%', border: 'none', display: 'grid', placeItems: 'center', flexShrink: 0,
                cursor: texto.trim() ? 'pointer' : 'default', color: '#fff', transition: 'background .15s',
                background: !texto.trim() ? '#B8DFC6' : modoNota ? '#C9A200' : '#25A35A',
              }}><SendHorizontal size={19} /></button>
            </div>
          )}
        </div>
      </div>

      {painelContato && <PainelContato c={c} api={api} onFechar={() => setPainelContato(false)} onAbrirPaciente={id => router.push('/pacientes/' + id)} />}
    </div>
  )
}

function Bolha({ m, anterior }: { m: Mensagem; anterior?: Mensagem }) {
  if (ehSistema(m)) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', margin: '8px 0' }}>
        <span style={{ fontSize: 12, color: T.text.secondary, background: '#FFF6D6', padding: '5px 12px', borderRadius: 8 }}>{m.conteudo}</span>
      </div>
    )
  }
  const nota = ehNota(m)
  const enviada = m.tipo === 'enviada'
  const mesmoLado = anterior && anterior.tipo === m.tipo && ehNota(anterior) === nota && !ehSistema(anterior)
  const autor = nota ? (m.metadata?.remetente || 'Equipe') : enviada ? (m.metadata?.ia ? 'Sofia IA' : m.metadata?.remetente) : null
  const mostrarAutor = autor && (!mesmoLado || anterior?.metadata?.remetente !== m.metadata?.remetente || !!anterior?.metadata?.ia !== !!m.metadata?.ia)
  const bg = nota ? '#FFF4C2' : enviada ? '#D9FDD3' : '#fff'
  return (
    <div style={{ display: 'flex', justifyContent: enviada ? 'flex-end' : 'flex-start', marginTop: mesmoLado ? 2 : 8 }}>
      <div style={{
        maxWidth: 'min(72%, 560px)', background: bg, borderRadius: 10, padding: '6px 9px 5px 10px',
        borderTopRightRadius: enviada && !mesmoLado ? 2 : 10, borderTopLeftRadius: !enviada && !mesmoLado ? 2 : 10,
        boxShadow: '0 1px 1px rgba(11,20,26,.1)', border: nota ? '1px dashed #E2C65A' : 'none',
      }}>
        {mostrarAutor && (
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 2, display: 'flex', alignItems: 'center', gap: 5, color: nota ? '#8A6A00' : m.metadata?.ia ? T.brand.primary : '#1F8A5B' }}>
            {nota && <Lock size={11} />}{m.metadata?.ia && <Sparkles size={11} />}{nota ? `Nota interna · ${autor}` : autor}
          </div>
        )}
        <div style={{ fontSize: 14, lineHeight: 1.45, color: '#111B21', wordBreak: 'break-word' }} dangerouslySetInnerHTML={{ __html: md(m.conteudo) }} />
        {Array.isArray(m.metadata?.botoes) && m.metadata.botoes.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>
            {m.metadata.botoes.map((b: string) => (
              <span key={b} style={{ textAlign: 'center', fontSize: 13, fontWeight: 600, color: '#027EB5', background: 'rgba(255,255,255,.7)', borderRadius: 8, padding: '6px 10px' }}>{b}</span>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 4, marginTop: 1 }}>
          <span style={{ fontSize: 11, color: '#667781' }}>{hora(m.criado_em)}</span>
          {enviada && !nota && (m.metadata?.falhou
            ? <span title={m.metadata?.erro || 'Não entregue'} style={{ display: 'inline-flex' }}><AlertCircle size={14} color={T.status.danger} /></span>
            : <CheckCheck size={15} color="#53BDEB" />)}
        </div>
      </div>
    </div>
  )
}

function PainelContato({ c, api, onFechar, onAbrirPaciente }: { c: Conversa; api: ChatApi; onFechar: () => void; onAbrirPaciente: (id: string) => void }) {
  const [paciente, setPaciente] = useState<any>(null)
  const [consultas, setConsultas] = useState<any[]>([])
  useEffect(() => {
    setPaciente(null); setConsultas([])
    if (!c.paciente_id) return
    fetch('/api/pacientes/' + c.paciente_id).then(r => r.json()).then(d => setPaciente(d.paciente || null)).catch(() => {})
    supabase.from('consultas').select('id, criado_em, avaliacao, cids').eq('paciente_id', c.paciente_id).order('criado_em', { ascending: false }).limit(3)
      .then(({ data }) => setConsultas(data || []))
  }, [c.paciente_id])
  const canal = canalDe(c)
  return (
    <aside style={{ width: 300, flexShrink: 0, borderLeft: `1px solid ${T.border.default}`, background: '#fff', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '14px 14px 10px' }}>
        <span style={{ flex: 1, fontSize: 14.5, fontWeight: 700 }}>Dados do contato</span>
        <button onClick={onFechar} aria-label="Fechar" style={iconeBtn}><X size={17} /></button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '8px 0 4px' }}>
          <AvatarConversa c={c} size={72} />
          <div style={{ fontSize: 16, fontWeight: 700, textAlign: 'center' }}>{nomeDe(c)}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: T.text.secondary }}>
            <CanalIcone canal={canal} size={14} />{CANAIS.find(x => x.id === canal)!.label}
          </div>
        </div>
        <InfoLinha icon={canal === 'whatsapp' ? Phone : UserRound} label={canal === 'whatsapp' ? 'Telefone' : 'ID do contato'} valor={canal === 'whatsapp' ? '+' + c.telefone : c.telefone} mono />
        <InfoLinha icon={UserRoundCog} label="Atendimento" valor={c.modo === 'humano' ? (c.atendente_nome || 'Sem atendente') : 'Sofia IA'} />
        <div>
          <div style={rotulo}>Etapa</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {ETAPAS.map(e => (
              <button key={e.id} onClick={() => api.mudarEtapa(c, e.id)} style={{
                border: `1px solid ${etapaDe(c) === e.id ? T.brand.primaryAccentSoft : T.border.default}`, background: etapaDe(c) === e.id ? T.brand.primarySubtle : '#fff',
                borderRadius: 99, padding: '4px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                color: etapaDe(c) === e.id ? T.brand.primary : T.text.secondary, display: 'flex', alignItems: 'center', gap: 6,
              }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: e.cor }} />{e.label}</button>
            ))}
          </div>
        </div>
        <div style={{ height: 1, background: T.border.muted }} />
        {c.paciente_id ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={rotulo}>Paciente vinculado</div>
            {paciente ? (
              <>
                <div style={{ fontSize: 13.5, fontWeight: 600 }}>{paciente.nome}</div>
                <div style={{ fontSize: 12.5, color: T.text.secondary, lineHeight: 1.6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}><ConvenioBadge convenio={paciente.convenio} />{paciente.email && <span>{paciente.email}</span>}</div>
                  {paciente.alergias && <div style={{ color: T.status.danger, fontWeight: 600 }}>Alergias: {paciente.alergias}</div>}
                </div>
                {consultas.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={rotulo}>Últimas consultas</div>
                    {consultas.map(q => (
                      <div key={q.id} style={{ fontSize: 12.5, padding: '8px 10px', borderRadius: 10, background: T.bg.page }}>
                        <div style={{ fontWeight: 600 }}>{new Date(q.criado_em).toLocaleDateString('pt-BR')}</div>
                        {q.avaliacao && <div style={{ color: T.text.secondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.avaliacao}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : <span className="c360-skel" style={{ height: 40, borderRadius: 8 }} />}
            <Button variant="secondary" size="sm" iconRight={ExternalLink} onClick={() => onAbrirPaciente(c.paciente_id!)}>Abrir ficha do paciente</Button>
          </div>
        ) : (
          <div style={{ fontSize: 12.5, color: T.text.quaternary, lineHeight: 1.5 }}>
            Contato ainda não vinculado a um paciente. A Sofia vincula automaticamente quando reconhece o telefone, CPF ou e-mail.
          </div>
        )}
      </div>
    </aside>
  )
}

function InfoLinha({ icon: I, label, valor, mono }: { icon: any; label: string; valor: string; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ width: 32, height: 32, borderRadius: 10, background: T.bg.page, color: T.text.secondary, display: 'grid', placeItems: 'center', flexShrink: 0 }}><I size={15} strokeWidth={1.6} /></span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 11.5, color: T.text.tertiary }}>{label}</div>
        <div className={mono ? 'mono' : undefined} style={{ fontSize: 13, fontWeight: 600, color: T.text.strong, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{valor}</div>
      </div>
    </div>
  )
}

const rotulo: React.CSSProperties = { fontSize: 11, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: T.text.tertiary, marginBottom: 8 }
const iconeBtn: React.CSSProperties = {
  width: 36, height: 36, borderRadius: 10, border: 'none', background: 'transparent', cursor: 'pointer',
  display: 'grid', placeItems: 'center', color: T.text.secondary, flexShrink: 0,
}
const chipBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', border: 'none', background: 'transparent', cursor: 'pointer', padding: '4px 6px', borderRadius: 9,
}

/** Estado vazio (nenhuma conversa aberta). */
export function ChatVazio({ nome }: { nome: string }) {
  return (
    <div style={{ height: '100%', display: 'grid', placeItems: 'center', background: '#FAFAFB', padding: 24 }}>
      <div style={{ textAlign: 'center', maxWidth: 460, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <span style={{ width: 56, height: 56, borderRadius: 18, background: T.brand.primaryLight, color: T.brand.primary, display: 'grid', placeItems: 'center' }}>
          <SendHorizontal size={24} strokeWidth={1.6} />
        </span>
        <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-.01em' }}>Chat {nome ? `da ${nome}` : 'da clínica'}</div>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
          {CANAIS.map(k => (
            <span key={k.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: T.text.secondary }}><CanalIcone canal={k.id} size={18} />{k.label}</span>
          ))}
        </div>
        <div style={{ fontSize: 13.5, color: T.text.quaternary, lineHeight: 1.6 }}>
          WhatsApp, Instagram Direct e Messenger chegam aqui. A Sofia IA responde sozinha; quando precisar, assuma a conversa,
          transfira para alguém da equipe e acompanhe tudo no Kanban.
        </div>
        <a href="/minha-clinica?aba=canais" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: T.brand.primary, textDecoration: 'none', padding: '8px 14px', borderRadius: 10, border: `1px solid ${T.brand.primaryAccent}`, background: T.bg.card }}>
          Conectar ou gerenciar canais
        </a>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: T.text.tertiary }}><Lock size={13} />Notas internas ficam só para a equipe</div>
      </div>
    </div>
  )
}
