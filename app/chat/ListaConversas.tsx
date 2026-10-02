'use client'
import { useState } from 'react'
import { ChevronDown, CheckCheck, Pin, BellOff, Ban, Sparkles, StickyNote, AlertCircle } from 'lucide-react'
import { tokens } from '@/lib/design-tokens'
import { SearchInput } from '@/components/ui'
import type { ChatApi } from './useChat'
import type { Conversa } from './tipos'
import { etapaDe, nomeDe, quando, silenciada } from './tipos'
import { AvatarConversa, EtapaBadge, MenuConversa, Popover } from './pecas'

const T = tokens
export type FiltroLista = 'todas' | 'naoLidas' | 'minhas' | 'semAtendente' | 'ia' | 'arquivadas'

export function ListaConversas({ api, conversas, busca, setBusca, filtro, setFiltro, contagem }: {
  api: ChatApi
  conversas: Conversa[]
  busca: string
  setBusca: (v: string) => void
  filtro: FiltroLista
  setFiltro: (f: FiltroLista) => void
  contagem: Record<FiltroLista, number>
}) {
  const chips: { id: FiltroLista; label: string }[] = [
    { id: 'todas', label: 'Todas' },
    { id: 'naoLidas', label: 'Não lidas' },
    { id: 'minhas', label: 'Minhas' },
    { id: 'semAtendente', label: 'Sem atendente' },
    { id: 'ia', label: 'Sofia IA' },
    { id: 'arquivadas', label: 'Arquivadas' },
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%', borderRight: `1px solid ${T.border.default}`, background: '#fff' }}>
      <div style={{ padding: '14px 14px 10px', display: 'flex', flexDirection: 'column', gap: 10, borderBottom: `1px solid ${T.border.muted}` }}>
        <SearchInput value={busca} onChange={setBusca} placeholder="Buscar nome, telefone ou mensagem" style={{ background: T.bg.page }} />
        <div className="chat-chips" style={{ display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none' }}>
          {chips.map(ch => {
            const on = filtro === ch.id
            const n = contagem[ch.id]
            return (
              <button key={ch.id} onClick={() => setFiltro(ch.id)} style={{
                flexShrink: 0, height: 30, padding: '0 12px', borderRadius: 99, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap',
                background: on ? T.brand.primaryLight : T.bg.page, color: on ? T.brand.primary : T.text.secondary,
              }}>
                {ch.label}{ch.id === 'naoLidas' && n > 0 ? ` ${n}` : ''}
              </button>
            )
          })}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {api.carregando ? [0, 1, 2, 3, 4].map(i => (
          <div key={i} style={{ display: 'flex', gap: 12, padding: '14px 16px' }}>
            <span className="c360-skel" style={{ width: 46, height: 46, borderRadius: '50%' }} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 4 }}>
              <span className="c360-skel" style={{ width: '50%', height: 12, borderRadius: 5 }} />
              <span className="c360-skel" style={{ width: '80%', height: 10, borderRadius: 5 }} />
            </div>
          </div>
        )) : conversas.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', fontSize: 13, color: T.text.quaternary }}>
            {busca ? `Nada encontrado para “${busca}”` : filtro === 'todas' ? 'Nenhuma conversa ainda' : 'Nenhuma conversa neste filtro'}
          </div>
        ) : conversas.map(c => <ItemConversa key={c.id} c={c} api={api} ativa={api.ativaId === c.id} />)}
      </div>
    </div>
  )
}

function ItemConversa({ c, api, ativa }: { c: Conversa; api: ChatApi; ativa: boolean }) {
  const [hover, setHover] = useState(false)
  const [menu, setMenu] = useState(false)
  const u = c.ultima
  const nota = u?.metadata?.nota
  const falhou = u?.metadata?.falhou
  const naoLida = c.naoLidas > 0
  return (
    <div
      onClick={() => api.abrir(c.id)}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        position: 'relative', display: 'flex', gap: 12, padding: '12px 14px 0 16px', cursor: 'pointer',
        background: ativa ? T.bg.hoverStrong : hover ? T.bg.hover : '#fff', transition: 'background .12s',
      }}
    >
      <div style={{ paddingTop: 2 }}><AvatarConversa c={c} /></div>
      <div style={{ flex: 1, minWidth: 0, paddingBottom: 12, borderBottom: `1px solid ${T.border.muted}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ flex: 1, minWidth: 0, fontSize: 14.5, fontWeight: naoLida ? 700 : 600, color: T.text.primary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nomeDe(c)}</span>
          {c.bloqueada && <Ban size={13} color={T.status.danger} />}
          {silenciada(c) && <BellOff size={13} color={T.text.tertiary} />}
          {c.fixada && <Pin size={13} color={T.text.tertiary} />}
          <span style={{ fontSize: 11.5, color: naoLida ? '#1FA855' : T.text.tertiary, fontWeight: naoLida ? 600 : 500 }}>{quando(u?.criado_em || c.ultimo_contato)}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3, fontSize: 13, color: T.text.secondary }}>
          {u && u.tipo === 'enviada' && !nota && (falhou
            ? <AlertCircle size={14} color={T.status.danger} style={{ flexShrink: 0 }} />
            : u.metadata?.ia ? <Sparkles size={13} color={T.brand.primary} style={{ flexShrink: 0 }} /> : <CheckCheck size={15} color={T.text.tertiary} style={{ flexShrink: 0 }} />)}
          {nota && <StickyNote size={13} color="#B08900" style={{ flexShrink: 0 }} />}
          <span style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: naoLida ? 600 : 400, color: naoLida ? T.text.strong : undefined }}>
            {u?.conteudo || 'Sem mensagens'}
          </span>
          {naoLida && !hover && (
            <span style={{ minWidth: 20, height: 20, padding: '0 6px', borderRadius: 99, background: silenciada(c) ? T.text.tertiary : '#25D366', color: '#fff', fontSize: 11, fontWeight: 700, display: 'grid', placeItems: 'center' }}>{c.naoLidas}</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 7 }}>
          <EtapaBadge etapa={etapaDe(c)} />
          <span style={{ fontSize: 11.5, color: T.text.tertiary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {c.modo !== 'humano' ? 'Sofia IA' : c.atendente_nome || 'Sem atendente'}
          </span>
        </div>
      </div>

      {(hover || menu) && (
        <button
          onClick={e => { e.stopPropagation(); setMenu(!menu) }}
          aria-label="Opções da conversa"
          style={{
            position: 'absolute', top: 10, right: 10, width: 28, height: 28, borderRadius: '50%', border: 'none', cursor: 'pointer',
            display: 'grid', placeItems: 'center', background: menu ? T.border.default : '#fff', color: T.text.secondary,
            boxShadow: '0 1px 3px rgba(28,27,34,.12)',
          }}
        ><ChevronDown size={16} /></button>
      )}
      <Popover aberto={menu} onFechar={() => setMenu(false)} style={{ top: 42, right: 10, width: 250 }}>
        <MenuConversa c={c} api={api} onFechar={() => setMenu(false)} />
      </Popover>
    </div>
  )
}

