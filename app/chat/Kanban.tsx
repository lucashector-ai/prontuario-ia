'use client'
import { useState } from 'react'
import { MoreHorizontal, Sparkles, UserRound } from 'lucide-react'
import { tokens, tint } from '@/lib/design-tokens'
import type { ChatApi } from './useChat'
import type { Conversa, EtapaId } from './tipos'
import { ETAPAS, etapaDe, nomeDe, quando } from './tipos'
import { AvatarConversa, MenuConversa, Popover } from './pecas'

const T = tokens

/** Kanban por etapa. Arraste o cartão entre colunas para mudar a etapa; clique para abrir a conversa. */
export function Kanban({ api, conversas, onAbrir }: { api: ChatApi; conversas: Conversa[]; onAbrir: (id: string) => void }) {
  const [arrastando, setArrastando] = useState<string | null>(null)
  const [sobre, setSobre] = useState<EtapaId | null>(null)

  const soltar = (etapa: EtapaId) => {
    const c = conversas.find(x => x.id === arrastando)
    setArrastando(null); setSobre(null)
    if (c && etapaDe(c) !== etapa) api.mudarEtapa(c, etapa)
  }

  return (
    <div style={{ height: '100%', overflowX: 'auto', overflowY: 'hidden', padding: 14, display: 'flex', gap: 12, background: T.bg.page }}>
      {ETAPAS.map(e => {
        const itens = conversas.filter(c => etapaDe(c) === e.id)
        const alvo = sobre === e.id && arrastando
        return (
          <div
            key={e.id}
            onDragOver={ev => { ev.preventDefault(); if (sobre !== e.id) setSobre(e.id) }}
            onDragLeave={ev => { if (!ev.currentTarget.contains(ev.relatedTarget as Node)) setSobre(null) }}
            onDrop={ev => { ev.preventDefault(); soltar(e.id) }}
            style={{
              width: 288, flexShrink: 0, display: 'flex', flexDirection: 'column', minHeight: 0, borderRadius: 16,
              background: alvo ? tint(e.cor, 0.08) : '#F1F1F4', border: `1.5px dashed ${alvo ? e.cor : 'transparent'}`, transition: 'background .15s, border-color .15s',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px 8px' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: e.cor }} />
              <span style={{ flex: 1, fontSize: 13.5, fontWeight: 700, color: T.text.primary }}>{e.label}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: T.text.secondary, background: '#fff', borderRadius: 99, padding: '1px 8px' }}>{itens.length}</span>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '2px 10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {itens.length === 0 && (
                <div style={{ fontSize: 12.5, color: T.text.tertiary, textAlign: 'center', padding: '18px 8px', border: `1px dashed ${T.border.strong}`, borderRadius: 12 }}>
                  Arraste conversas para cá
                </div>
              )}
              {itens.map(c => (
                <CartaoKanban key={c.id} c={c} api={api} arrastando={arrastando === c.id}
                  onDragStart={() => setArrastando(c.id)} onDragEnd={() => { setArrastando(null); setSobre(null) }}
                  onAbrir={() => onAbrir(c.id)} />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function CartaoKanban({ c, api, arrastando, onDragStart, onDragEnd, onAbrir }: {
  c: Conversa; api: ChatApi; arrastando: boolean; onDragStart: () => void; onDragEnd: () => void; onAbrir: () => void
}) {
  const [h, setH] = useState(false)
  const [menu, setMenu] = useState(false)
  return (
    <div
      draggable
      onDragStart={ev => { ev.dataTransfer.effectAllowed = 'move'; ev.dataTransfer.setData('text/plain', c.id); onDragStart() }}
      onDragEnd={onDragEnd}
      onClick={onAbrir}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{
        position: 'relative', background: '#fff', borderRadius: 12, padding: 12, cursor: 'grab', opacity: arrastando ? 0.45 : 1,
        border: `1px solid ${h ? 'transparent' : T.border.default}`, boxShadow: h ? T.shadow.cardHover : 'none',
        transform: h && !arrastando ? 'translateY(-1px)' : 'none', transition: 'box-shadow .2s, transform .2s, border-color .2s',
      }}
    >
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <AvatarConversa c={c} size={36} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nomeDe(c)}</span>
            {c.naoLidas > 0 && <span style={{ minWidth: 18, height: 18, padding: '0 5px', borderRadius: 99, background: '#25D366', color: '#fff', fontSize: 10.5, fontWeight: 700, display: 'grid', placeItems: 'center' }}>{c.naoLidas}</span>}
          </div>
          <div style={{ fontSize: 11.5, color: T.text.tertiary }}>{quando(c.ultima?.criado_em || c.ultimo_contato)}</div>
        </div>
      </div>
      {c.ultima?.conteudo && (
        <div style={{ marginTop: 8, fontSize: 12.5, color: T.text.secondary, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {c.ultima.conteudo}
        </div>
      )}
      <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: T.text.secondary }}>
        {c.modo === 'humano'
          ? <><UserRound size={13} />{c.atendente_nome || 'Sem atendente'}</>
          : <><Sparkles size={13} color={T.brand.primary} />Sofia IA</>}
      </div>
      {(h || menu) && (
        <button onClick={e => { e.stopPropagation(); setMenu(!menu) }} aria-label="Opções" style={{
          position: 'absolute', top: 8, right: 8, width: 26, height: 26, borderRadius: 8, border: 'none', cursor: 'pointer',
          display: 'grid', placeItems: 'center', background: menu ? T.bg.hoverStrong : '#fff', color: T.text.secondary,
        }}><MoreHorizontal size={16} /></button>
      )}
      <Popover aberto={menu} onFechar={() => setMenu(false)} style={{ top: 38, right: 8, width: 250 }}>
        <MenuConversa c={c} api={api} onFechar={() => setMenu(false)} />
      </Popover>
    </div>
  )
}
