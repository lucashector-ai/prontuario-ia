'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { MessagesSquare, Columns3, Zap, Plus, ChevronDown, Check, Pencil, Trash2, Users } from 'lucide-react'
import { tokens } from '@/lib/design-tokens'
import { usePageHeader } from '@/components/shell/header-context'
import { Button, Modal, Field, Input, Textarea, Avatar, EmptyState } from '@/components/ui'
import { useChat } from './useChat'
import type { Canal } from './tipos'
import { CANAIS, canalDe, nomeDe, silenciada } from './tipos'
import { ListaConversas, type FiltroLista } from './ListaConversas'
import { PainelConversa, ChatVazio } from './PainelConversa'
import { Kanban } from './Kanban'
import { CanalContorno, ItemMenu, Popover } from './pecas'

const T = tokens
type Visao = 'conversas' | 'kanban'
const SEM_ATENDENTE = '__sem__'

export default function ChatPage() {
  const api = useChat()
  const [visao, setVisao] = useState<Visao>('conversas')
  const [canal, setCanal] = useState<'todos' | Canal>('todos')
  const [atendente, setAtendente] = useState<string>('todos')
  const [filtro, setFiltro] = useState<FiltroLista>('todas')
  const [busca, setBusca] = useState('')
  const [menuAtendente, setMenuAtendente] = useState(false)
  const [modal, setModal] = useState<null | 'respostas' | 'nova'>(null)
  const [mobile, setMobile] = useState(false)

  useEffect(() => {
    const f = () => setMobile(window.innerWidth < 900)
    f(); window.addEventListener('resize', f)
    return () => window.removeEventListener('resize', f)
  }, [])

  // Lembra a visão escolhida
  useEffect(() => { try { const v = localStorage.getItem('c360-chat-visao'); if (v === 'kanban') setVisao('kanban') } catch {} }, [])
  const trocarVisao = (v: Visao) => { setVisao(v); try { localStorage.setItem('c360-chat-visao', v) } catch {} }

  const ativas = api.conversas.filter(c => !c.arquivada)
  usePageHeader('Chat', api.carregando ? 'Carregando conversas…' : `${ativas.length} conversa${ativas.length === 1 ? '' : 's'} · WhatsApp, Instagram e Messenger`)

  // Som quando chega mensagem nova (ignora conversas silenciadas)
  const naoLidasRef = useRef<number | null>(null)
  useEffect(() => {
    const total = api.conversas.filter(c => !silenciada(c) && !c.arquivada).reduce((s, c) => s + c.naoLidas, 0)
    if (naoLidasRef.current !== null && total > naoLidasRef.current) bip()
    naoLidasRef.current = total
    document.title = total > 0 ? `(${total}) Chat · Clinical 360` : 'Clinical 360 — Gestão Inteligente da Clínica'
  }, [api.conversas])
  useEffect(() => () => { document.title = 'Clinical 360 — Gestão Inteligente da Clínica' }, [])

  // Filtros comuns (canal, atendente, busca) + filtro da lista
  const base = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return api.conversas.filter(c => {
      if (canal !== 'todos' && canalDe(c) !== canal) return false
      if (atendente === SEM_ATENDENTE && (c.modo !== 'humano' || c.atendente_nome)) return false
      if (atendente !== 'todos' && atendente !== SEM_ATENDENTE && c.atendente_nome !== atendente) return false
      if (q && !(nomeDe(c).toLowerCase().includes(q) || c.telefone.includes(q.replace(/\D/g, '') || '§') || (c.ultima?.conteudo || '').toLowerCase().includes(q))) return false
      return true
    })
  }, [api.conversas, canal, atendente, busca])

  const passa = (f: FiltroLista, c: typeof base[number]) => {
    if (f === 'arquivadas') return !!c.arquivada
    if (c.arquivada) return false
    if (f === 'naoLidas') return c.naoLidas > 0
    if (f === 'minhas') return c.modo === 'humano' && c.atendente_nome === api.nomeUsuario
    if (f === 'semAtendente') return c.modo === 'humano' && !c.atendente_nome
    if (f === 'ia') return c.modo !== 'humano'
    return true
  }
  const contagem = useMemo(() => {
    const out = {} as Record<FiltroLista, number>
    ;(['todas', 'naoLidas', 'minhas', 'semAtendente', 'ia', 'arquivadas'] as FiltroLista[]).forEach(f => {
      out[f] = f === 'naoLidas' ? base.filter(c => passa(f, c)).reduce((s, c) => s + (c.naoLidas > 0 ? 1 : 0), 0) : base.filter(c => passa(f, c)).length
    })
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, api.nomeUsuario])
  const lista = useMemo(() => base.filter(c => passa(filtro, c)).sort((a, b) =>
    (Number(!!b.fixada) - Number(!!a.fixada)) || (new Date(b.ultima?.criado_em || b.ultimo_contato).getTime() - new Date(a.ultima?.criado_em || a.ultimo_contato).getTime()),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [base, filtro, api.nomeUsuario])
  const doKanban = useMemo(() => base.filter(c => !c.arquivada), [base])

  const nomesAtendentes = useMemo(() => Array.from(new Set([
    api.nomeUsuario,
    ...api.atendentes.filter((a: any) => a.ativo !== false).map((a: any) => a.nome),
    ...api.conversas.map(c => c.atendente_nome).filter(Boolean) as string[],
  ].filter(Boolean))), [api.nomeUsuario, api.atendentes, api.conversas])
  const rotuloAtendente = atendente === 'todos' ? 'Todos os atendentes' : atendente === SEM_ATENDENTE ? 'Sem atendente' : atendente

  if (!api.carregando && !api.medico) {
    return (
      <div style={{ padding: 24 }}>
        <EmptyState icon={Users} titulo="Nenhum médico ativo na clínica" descricao="O Chat usa a caixa de entrada de um médico. Cadastre um médico no Painel admin para começar." />
      </div>
    )
  }

  const mostrarLista = !mobile || !api.ativa
  const mostrarChat = !mobile || !!api.ativa

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: mobile ? 8 : 14, gap: mobile ? 8 : 12, minHeight: 0 }}>
      {/* Barra de ferramentas */}
      <div style={{ display: 'flex', alignItems: 'center', gap: mobile ? 6 : 10, flexWrap: mobile ? 'nowrap' : 'wrap', flexShrink: 0, overflowX: mobile ? 'auto' : undefined, scrollbarWidth: 'none' }}>
        <Segmentado
          opcoes={[{ id: 'conversas', label: 'Conversas', icon: <MessagesSquare size={15} strokeWidth={1.6} />, classeRotulo: 'chat-rotulo-visao' }, { id: 'kanban', label: 'Kanban', icon: <Columns3 size={15} strokeWidth={1.6} />, classeRotulo: 'chat-rotulo-visao' }]}
          valor={visao} onChange={v => trocarVisao(v as Visao)}
        />

        <div style={{ position: 'relative', display: mobile ? 'none' : 'block' }}>
          <button onClick={() => setMenuAtendente(!menuAtendente)} style={{
            display: 'flex', alignItems: 'center', gap: 8, height: 38, padding: '0 12px', minWidth: 180, borderRadius: 11,
            border: `1px solid ${T.border.default}`, background: '#fff', cursor: 'pointer', fontSize: 13.5, fontWeight: 500, fontFamily: 'inherit', color: T.text.strong,
          }}>
            <span style={{ flex: 1, textAlign: 'left', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{rotuloAtendente}</span>
            <ChevronDown size={15} color={T.text.tertiary} />
          </button>
          <Popover aberto={menuAtendente} onFechar={() => setMenuAtendente(false)} style={{ top: 'calc(100% + 6px)', left: 0, width: 250, maxHeight: 340, overflowY: 'auto' }}>
            {[{ id: 'todos', nome: 'Todos os atendentes' }, { id: SEM_ATENDENTE, nome: 'Sem atendente' }, ...nomesAtendentes.map(n => ({ id: n, nome: n }))].map(o => (
              <ItemMenu key={o.id} ativo={atendente === o.id}
                label={<span style={{ display: 'flex', alignItems: 'center', gap: 9, flex: 1 }}>
                  {o.id !== 'todos' && o.id !== SEM_ATENDENTE && <Avatar nome={o.nome} size={22} />}
                  {o.nome}{o.id === api.nomeUsuario && <span style={{ color: T.text.tertiary, fontSize: 12 }}>(você)</span>}
                  {atendente === o.id && <Check size={15} style={{ marginLeft: 'auto' }} />}
                </span>}
                onClick={() => { setAtendente(o.id); setMenuAtendente(false) }} />
            ))}
          </Popover>
        </div>

        <Segmentado
          opcoes={[{ id: 'todos', label: 'Todos' }, ...CANAIS.map(k => ({ id: k.id, label: k.label, icon: <CanalContorno canal={k.id} />, classeRotulo: 'chat-rotulo-canal' }))]}
          valor={canal} onChange={v => setCanal(v as any)}
        />

        <div style={{ flex: 1 }} />
        {!mobile && <Button variant="secondary" icon={Zap} onClick={() => setModal('respostas')} title="Respostas rápidas"><span className="chat-rotulo-respostas">Respostas rápidas</span></Button>}
        <Button icon={Plus} onClick={() => setModal('nova')} title="Nova conversa" style={mobile ? { padding: '0 10px' } : undefined}>{!mobile && 'Nova conversa'}</Button>
      </div>

      {/* Área principal */}
      <div style={{ flex: 1, minHeight: 0, border: `1px solid ${T.border.default}`, borderRadius: 16, overflow: 'hidden', background: '#fff' }}>
        {visao === 'kanban' ? (
          <Kanban api={api} conversas={doKanban} onAbrir={id => { trocarVisao('conversas'); api.abrir(id) }} />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: mobile ? 'minmax(0, 1fr)' : 'minmax(300px, 360px) minmax(0, 1fr)', height: '100%', minHeight: 0 }}>
            {mostrarLista && (
              <ListaConversas api={api} conversas={lista} busca={busca} setBusca={setBusca} filtro={filtro} setFiltro={setFiltro} contagem={contagem} />
            )}
            {mostrarChat && (
              <div style={{ minWidth: 0, minHeight: 0 }}>
                {api.ativa
                  ? <PainelConversa api={api} c={api.ativa} onVoltar={mobile ? () => api.abrir(null) : undefined} />
                  : <ChatVazio nome={api.clinicaNome} />}
              </div>
            )}
          </div>
        )}
      </div>

      {api.toast && (
        <div style={{
          position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)', zIndex: 300, background: T.night[800], color: '#fff',
          padding: '10px 18px', borderRadius: 99, fontSize: 13, fontWeight: 600, boxShadow: T.shadow.lg, maxWidth: 'calc(100vw - 32px)',
        }}>{api.toast}</div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @media (max-width: 1599px) { .chat-rotulo-canal { display: none; } }
        @media (max-width: 1279px) { .chat-rotulo-respostas { display: none; } }
        @media (max-width: 899px) { .chat-rotulo-visao { display: none; } }
      ` }} />

      {modal === 'respostas' && <ModalRespostas api={api} onFechar={() => setModal(null)} />}
      {modal === 'nova' && <ModalNovaConversa onFechar={() => setModal(null)} onCriar={async (tel, nome, texto) => { await api.novaConversa(tel, nome, texto); setModal(null); trocarVisao('conversas') }} />}
    </div>
  )
}

function Segmentado({ opcoes, valor, onChange }: { opcoes: { id: string; label: string; icon?: React.ReactNode; classeRotulo?: string }[]; valor: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', padding: 3, gap: 2, background: T.bg.page, border: `1px solid ${T.border.default}`, borderRadius: 12 }}>
      {opcoes.map(o => {
        const on = o.id === valor
        return (
          <button key={o.id} title={o.label} onClick={() => onChange(o.id)} style={{
            display: 'flex', alignItems: 'center', gap: 7, padding: '6px 12px', borderRadius: 9, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
            fontSize: 13, fontFamily: 'inherit', fontWeight: on ? 600 : 500,
            color: on ? T.text.primary : T.text.quaternary, background: on ? '#fff' : 'transparent', boxShadow: on ? T.shadow.md : 'none',
          }}>{o.icon}<span className={o.classeRotulo}>{o.label}</span></button>
        )
      })}
    </div>
  )
}

function ModalRespostas({ api, onFechar }: { api: ReturnType<typeof useChat>; onFechar: () => void }) {
  const [editando, setEditando] = useState<{ id?: string; atalho: string; texto: string } | null>(null)
  return (
    <Modal titulo="Respostas rápidas" onClose={onFechar} largura={560}>
      <p style={{ margin: '0 0 14px', fontSize: 13, color: T.text.quaternary, lineHeight: 1.5 }}>
        Digite <span className="mono" style={{ color: T.brand.primary }}>/</span> no chat para usar. Ex.: <span className="mono">/horarios</span> insere o texto da resposta.
      </p>
      {editando ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Field label="Atalho"><Input value={editando.atalho} onChange={e => setEditando({ ...editando, atalho: e.target.value })} placeholder="horarios" autoFocus /></Field>
          <Field label="Mensagem"><Textarea rows={5} value={editando.texto} onChange={e => setEditando({ ...editando, texto: e.target.value })} placeholder="Atendemos de segunda a sexta, das 8h às 18h…" /></Field>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button variant="secondary" onClick={() => setEditando(null)}>Cancelar</Button>
            <Button disabled={!editando.atalho.trim() || !editando.texto.trim()} onClick={async () => { await api.salvarResposta(editando.atalho, editando.texto.trim(), editando.id); setEditando(null) }}>Salvar</Button>
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 340, overflowY: 'auto' }}>
            {api.respostas.length === 0 && <div style={{ fontSize: 13, color: T.text.tertiary, padding: '18px 0', textAlign: 'center' }}>Nenhuma resposta cadastrada ainda.</div>}
            {api.respostas.map(r => (
              <div key={r.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px', border: `1px solid ${T.border.default}`, borderRadius: 12 }}>
                <span className="mono" style={{ fontSize: 12.5, color: T.brand.primary, flexShrink: 0, paddingTop: 1 }}>/{r.atalho}</span>
                <span style={{ flex: 1, fontSize: 13, color: T.text.strong, lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>{r.texto}</span>
                <button onClick={() => setEditando({ id: r.id, atalho: r.atalho, texto: r.texto })} aria-label="Editar" style={miniBtn}><Pencil size={14} /></button>
                <button onClick={() => api.removerResposta(r.id)} aria-label="Remover" style={{ ...miniBtn, color: T.status.danger }}><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
            <Button icon={Plus} onClick={() => setEditando({ atalho: '', texto: '' })}>Nova resposta</Button>
          </div>
        </>
      )}
    </Modal>
  )
}

function ModalNovaConversa({ onFechar, onCriar }: { onFechar: () => void; onCriar: (tel: string, nome: string, texto: string) => Promise<void> }) {
  const [tel, setTel] = useState('')
  const [nome, setNome] = useState('')
  const [texto, setTexto] = useState('')
  const [salvando, setSalvando] = useState(false)
  const digitos = tel.replace(/\D/g, '')
  const valido = digitos.length >= 12 // DDI + DDD + número
  return (
    <Modal titulo="Nova conversa no WhatsApp" onClose={onFechar} largura={460}
      rodape={<>
        <Button variant="secondary" onClick={onFechar}>Cancelar</Button>
        <Button disabled={!valido || salvando} onClick={async () => { setSalvando(true); await onCriar(digitos, nome.trim(), texto); setSalvando(false) }}>{salvando ? 'Enviando…' : 'Iniciar conversa'}</Button>
      </>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Field label="Telefone com DDI e DDD" hint={tel && !valido ? 'Ex.: 55 11 91234-5678' : undefined}><Input value={tel} onChange={e => setTel(e.target.value)} placeholder="55 11 91234-5678" autoFocus inputMode="tel" /></Field>
        <Field label="Nome do contato (opcional)"><Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Maria Souza" /></Field>
        <Field label="Primeira mensagem (opcional)" hint="Fora da janela de 24h o WhatsApp só entrega mensagens de modelo aprovado."><Textarea rows={3} value={texto} onChange={e => setTexto(e.target.value)} placeholder="Olá! Aqui é da clínica…" /></Field>
      </div>
    </Modal>
  )
}

const miniBtn: React.CSSProperties = { width: 28, height: 28, borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', display: 'grid', placeItems: 'center', color: T.text.secondary, flexShrink: 0 }

function bip() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const o = ctx.createOscillator(), g = ctx.createGain()
    o.type = 'sine'; o.frequency.value = 880
    g.gain.setValueAtTime(0.0001, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25)
    o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.26)
  } catch {}
}
