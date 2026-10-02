'use client'
import { useEffect, useRef } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  MailOpen, Archive, ArchiveRestore, Pin, PinOff, BellOff, Bell, Ban, Download, Eraser, Trash2, UserRound,
} from 'lucide-react'
import { tokens, tint } from '@/lib/design-tokens'
import type { Canal, Conversa, EtapaId } from './tipos'
import { ETAPAS, canalDe, iniciais, nomeDe, silenciada } from './tipos'

const T = tokens

// ── Marcas dos canais (glifos simplificados, cores oficiais) ───────────────────

export function CanalIcone({ canal, size = 18 }: { canal: Canal; size?: number }) {
  if (canal === 'instagram') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" aria-label="Instagram">
        <defs>
          <radialGradient id="ig-g" cx="30%" cy="107%" r="150%">
            <stop offset="0" stopColor="#FDF497" /><stop offset=".05" stopColor="#FDF497" />
            <stop offset=".45" stopColor="#FD5949" /><stop offset=".6" stopColor="#D6249F" /><stop offset=".9" stopColor="#285AEB" />
          </radialGradient>
        </defs>
        <rect width="24" height="24" rx="12" fill="url(#ig-g)" />
        <rect x="6.5" y="6.5" width="11" height="11" rx="3.4" fill="none" stroke="#fff" strokeWidth="1.6" />
        <circle cx="12" cy="12" r="2.7" fill="none" stroke="#fff" strokeWidth="1.6" />
        <circle cx="15.4" cy="8.6" r=".9" fill="#fff" />
      </svg>
    )
  }
  if (canal === 'messenger') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" aria-label="Messenger">
        <defs>
          <linearGradient id="ms-g" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stopColor="#0099FF" /><stop offset=".6" stopColor="#A033FF" /><stop offset="1" stopColor="#FF5280" />
          </linearGradient>
        </defs>
        <rect width="24" height="24" rx="12" fill="url(#ms-g)" />
        <path d="M6.6 14.6l3.3-3.5 1.9 1.7 3.4-1.9-3.3 3.5-1.9-1.7z" fill="#fff" stroke="#fff" strokeWidth="1.1" strokeLinejoin="round" />
      </svg>
    )
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-label="WhatsApp">
      <rect width="24" height="24" rx="12" fill="#25D366" />
      <path d="M12 5.6a6.3 6.3 0 00-5.4 9.5l-.8 2.9 3-.8A6.3 6.3 0 1012 5.6z" fill="none" stroke="#fff" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M9.9 9.3c.2-.4.4-.4.6-.4h.4c.1 0 .3 0 .4.3l.5 1.2c0 .1 0 .3-.1.4l-.3.4c-.1.1-.1.2 0 .4.3.5.7 1 1.2 1.3.4.3.7.4.9.5.1 0 .2 0 .3-.1l.5-.6c.1-.1.3-.2.4-.1l1.2.6c.2.1.3.2.3.3 0 .3-.1.8-.5 1.1-.4.3-1 .5-1.6.3a7 7 0 01-3.6-3.1c-.5-.8-.6-1.6-.4-2.1z" fill="#fff" />
    </svg>
  )
}

/** Ícone de canal "contorno" (filtros) — herda a cor do texto. */
export function CanalContorno({ canal, size = 15 }: { canal: Canal; size?: number }) {
  const s = { width: size, height: size, fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  if (canal === 'instagram') return <svg viewBox="0 0 24 24" {...s}><rect x="3.5" y="3.5" width="17" height="17" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17" cy="7" r=".6" fill="currentColor" /></svg>
  if (canal === 'messenger') return <svg viewBox="0 0 24 24" {...s}><path d="M12 3.5c-4.7 0-8.5 3.5-8.5 8 0 2.5 1.2 4.7 3.1 6.2v3l2.8-1.6c.8.2 1.7.4 2.6.4 4.7 0 8.5-3.5 8.5-8s-3.8-8-8.5-8z" /><path d="M7.5 13.5l3-3 2 1.8 3.5-1.8-3 3-2-1.8z" /></svg>
  return <svg viewBox="0 0 24 24" {...s}><path d="M12 3.5a8.5 8.5 0 00-7.3 12.8L3.6 20.4l4.2-1.1A8.5 8.5 0 1012 3.5z" /><path d="M9 8.6c.2-.4.5-.5.7-.5h.5c.2 0 .3.1.4.3l.6 1.5c.1.2 0 .3-.1.5l-.4.5c-.1.1-.1.3 0 .5.4.6.9 1.2 1.5 1.6.5.3.9.5 1.1.6.2 0 .3 0 .4-.1l.6-.7c.1-.1.3-.2.5-.1l1.5.7c.2.1.3.2.3.4 0 .4-.2 1-.6 1.3-.5.4-1.2.6-2 .4a8.6 8.6 0 01-4.4-3.8c-.6-1-.7-2-.6-2.6z" /></svg>
}

export function AvatarConversa({ c, size = 46 }: { c: Conversa; size?: number }) {
  return (
    <span style={{ position: 'relative', flexShrink: 0, width: size, height: size }}>
      {c.foto_url
        ? <img src={c.foto_url} alt="" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover' }} />
        : <span style={{ width: size, height: size, borderRadius: '50%', background: T.bg.hoverStrong, color: T.text.muted, display: 'grid', placeItems: 'center', fontSize: Math.round(size * 0.34), fontWeight: 700 }}>{iniciais(c.nome_contato || c.telefone)}</span>}
      <span style={{ position: 'absolute', right: -2, bottom: -2, borderRadius: '50%', border: '2px solid #fff', display: 'inline-flex', background: '#fff' }}>
        <CanalIcone canal={canalDe(c)} size={Math.max(14, Math.round(size * 0.36))} />
      </span>
    </span>
  )
}

export function EtapaBadge({ etapa, onClick }: { etapa: EtapaId; onClick?: (e: React.MouseEvent) => void }) {
  const e = ETAPAS.find(x => x.id === etapa)!
  return (
    <span onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 600, padding: '2px 8px', borderRadius: 99,
      color: `color-mix(in oklch, ${e.cor} 75%, black)`, background: tint(e.cor, 0.12), whiteSpace: 'nowrap', cursor: onClick ? 'pointer' : undefined,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: e.cor }} />{e.label}
    </span>
  )
}

// ── Popover genérico (fecha com clique fora / Esc) ─────────────────────────────

export function Popover({ aberto, onFechar, children, style }: {
  aberto: boolean; onFechar: () => void; children: React.ReactNode; style?: React.CSSProperties
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!aberto) return
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onFechar() }
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onFechar() }
    setTimeout(() => document.addEventListener('mousedown', h), 0)
    window.addEventListener('keydown', k)
    return () => { document.removeEventListener('mousedown', h); window.removeEventListener('keydown', k) }
  }, [aberto, onFechar])
  if (!aberto) return null
  return (
    <div ref={ref} onClick={e => e.stopPropagation()} style={{
      position: 'absolute', zIndex: 60, background: '#fff', border: `1px solid ${T.border.default}`, borderRadius: 14,
      boxShadow: T.shadow.lg, padding: 6, ...style,
    }}>{children}</div>
  )
}

export function ItemMenu({ icon, label, onClick, perigo, ativo }: { icon?: LucideIcon; label: React.ReactNode; onClick: () => void; perigo?: boolean; ativo?: boolean }) {
  const I = icon
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 11, width: '100%', padding: '9px 10px', borderRadius: 9, border: 'none',
      background: ativo ? T.brand.primarySubtle : 'transparent', cursor: 'pointer', fontSize: 13.5, fontFamily: 'inherit', textAlign: 'left',
      color: perigo ? T.status.danger : ativo ? T.brand.primary : T.text.strong, whiteSpace: 'nowrap',
    }}
      onMouseEnter={e => { if (!ativo) e.currentTarget.style.background = perigo ? T.status.dangerBg : T.bg.hover }}
      onMouseLeave={e => { if (!ativo) e.currentTarget.style.background = 'transparent' }}
    >
      {I && <I size={17} strokeWidth={1.6} />}{label}
    </button>
  )
}

export const Divisor = () => <div style={{ height: 1, background: T.border.muted, margin: '6px 4px' }} />

/** Menu de ações de uma conversa (lista, kanban e cabeçalho do chat). */
export function MenuConversa({ c, api, onFechar, comDados, onDados }: {
  c: Conversa
  api: { marcarNaoLida: (c: Conversa) => any; arquivar: (c: Conversa) => any; fixar: (c: Conversa) => any; silenciar: (c: Conversa, h: number | null) => any; bloquear: (c: Conversa) => any; exportar: (c: Conversa) => any; limpar: (c: Conversa) => any; apagar: (c: Conversa) => any }
  onFechar: () => void
  comDados?: boolean
  onDados?: () => void
}) {
  const f = (fn: () => any) => () => { onFechar(); fn() }
  const primeiroNome = (nomeDe(c).split(' ')[0] || 'contato')
  return (
    <>
      <ItemMenu icon={MailOpen} label="Marcar como não lida" onClick={f(() => api.marcarNaoLida(c))} />
      <ItemMenu icon={c.arquivada ? ArchiveRestore : Archive} label={c.arquivada ? 'Desarquivar' : 'Arquivar'} onClick={f(() => api.arquivar(c))} />
      <ItemMenu icon={c.fixada ? PinOff : Pin} label={c.fixada ? 'Desafixar' : 'Fixar no topo'} onClick={f(() => api.fixar(c))} />
      {silenciada(c) ? (
        <ItemMenu icon={Bell} label="Reativar som" onClick={f(() => api.silenciar(c, null))} />
      ) : (
        <>
          <ItemMenu icon={BellOff} label="Silenciar por 8 horas" onClick={f(() => api.silenciar(c, 8))} />
          <ItemMenu icon={BellOff} label="Silenciar por 1 semana" onClick={f(() => api.silenciar(c, 24 * 7))} />
          <ItemMenu icon={BellOff} label="Silenciar sempre" onClick={f(() => api.silenciar(c, Infinity))} />
        </>
      )}
      <ItemMenu icon={Ban} perigo={!c.bloqueada} label={c.bloqueada ? `Desbloquear ${primeiroNome}` : `Bloquear ${primeiroNome}`} onClick={f(() => api.bloquear(c))} />
      <Divisor />
      {comDados && <ItemMenu icon={UserRound} label="Dados do contato" onClick={f(() => onDados?.())} />}
      <ItemMenu icon={Download} label="Exportar conversa" onClick={f(() => api.exportar(c))} />
      <ItemMenu icon={Eraser} label="Limpar conversa" onClick={f(() => api.limpar(c))} />
      <ItemMenu icon={Trash2} perigo label="Apagar conversa" onClick={f(() => api.apagar(c))} />
    </>
  )
}
