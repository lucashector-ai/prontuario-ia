'use client'
/**
 * Design system — componentes base do Clinical 360 (v2, handoff "redesign moderno").
 *
 * Construídos sobre os tokens de lib/design-tokens.ts. Use estes componentes
 * em vez de reescrever estilos inline, para manter a plataforma consistente.
 *
 * Regras visuais (resumo — ver .design-handoff/design_system/readme.md):
 *   - Cards: branco, borda 1px #EBEAEF, raio 16, SEM sombra em repouso.
 *     Clicáveis: no hover a borda some, sombra suave e sobem 2px.
 *   - Roxo só em ação primária, item ativo, foco, links e realces de IA.
 *   - Ícones Lucide com stroke 1.6 (ver <Icon>), hover com mola + fill 22%.
 *   - Texto em sentence case; MAIÚSCULAS só em overlines e cabeçalhos de tabela.
 *
 * Componentes:
 *   Layout/superfície : Card, Panel, PageHeader, Modal, ModalAcoes, Drawer
 *   Ações             : Button, IconButton
 *   Formulário        : Input, Select, Textarea, Field, SearchInput, SegmentedControl, Switch, Checkbox, Chip
 *   Sinalização       : Badge, ProgressBar
 *   Navegação         : Tabs
 *   Conteúdo          : EmptyState, MetricCard, KpiCard, Avatar, Icon, IconTile, Overline
 */
import React, { useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { X, ArrowUpRight, ArrowDownRight, Minus, Search, Check } from 'lucide-react'
import { tokens, tint } from '@/lib/design-tokens'
import { usePageHeader } from '@/components/shell/header-context'

const T = tokens
const SPRING = `transform .35s ${T.motion.spring}`

// ── Icon — Lucide padronizado (stroke 1.6, fill 22% quando ativo) ─────────────

export function Icon({ icon: I, size = 18, active, color, style, strokeWidth = 1.6 }: {
  icon: LucideIcon
  size?: number
  active?: boolean
  color?: string
  style?: React.CSSProperties
  strokeWidth?: number
}) {
  return (
    <I
      size={size}
      strokeWidth={strokeWidth}
      color={color ?? 'currentColor'}
      fill={active ? 'currentColor' : 'none'}
      fillOpacity={active ? 0.22 : 0}
      style={{ flexShrink: 0, transition: 'fill-opacity .25s', ...style }}
      aria-hidden
    />
  )
}

/** Quadrado de ícone com tint da cor (KPIs, listas, estados vazios). */
export function IconTile({ icon, color = T.brand.primary, size = 38, iconSize, radius = 12, active, style }: {
  icon: LucideIcon
  color?: string
  size?: number
  iconSize?: number
  radius?: number
  active?: boolean
  style?: React.CSSProperties
}) {
  const bg = color.startsWith('oklch') ? tint(color, active ? 0.18 : 0.1) : `color-mix(in oklch, ${color} ${active ? 18 : 10}%, white)`
  return (
    <span style={{
      width: size, height: size, borderRadius: radius, flexShrink: 0,
      display: 'grid', placeItems: 'center', color, background: bg,
      transition: SPRING, transform: active ? 'rotate(-8deg) scale(1.06)' : 'none',
      ...style,
    }}>
      <Icon icon={icon} size={iconSize ?? Math.round(size * 0.47)} active={active} />
    </span>
  )
}

// ── Button ──────────────────────────────────────────────────────────────────

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'dark' | 'dangerSolid'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: LucideIcon
  iconRight?: LucideIcon
  block?: boolean
}

const BTN_VARIANT: Record<ButtonVariant, React.CSSProperties> = {
  primary: { background: T.brand.primary, color: '#fff', border: `1px solid ${T.brand.primary}` },
  secondary: { background: T.bg.card, color: T.text.strong, border: `1px solid ${T.border.default}` },
  ghost: { background: 'transparent', color: T.brand.primary, border: '1px solid transparent' },
  danger: { background: T.bg.card, color: T.status.danger, border: `1px solid ${T.border.default}` },
  dangerSolid: { background: T.status.danger, color: '#fff', border: `1px solid ${T.status.danger}` },
  dark: { background: T.night[800], color: '#fff', border: `1px solid ${T.night[800]}` },
}
const BTN_HOVER: Record<ButtonVariant, string> = {
  primary: T.brand.primaryHover,
  secondary: T.bg.page,
  ghost: T.brand.primarySubtle,
  danger: T.status.dangerBg,
  dangerSolid: '#A93732',
  dark: '#2E2C36',
}
const BTN_SIZE: Record<ButtonSize, React.CSSProperties> = {
  sm: { height: 32, padding: '0 11px', fontSize: 12.5, borderRadius: 9 },
  md: { height: 36, padding: '0 14px', fontSize: 13, borderRadius: 10 },
  lg: { height: 44, padding: '0 18px', fontSize: 14, borderRadius: 12 },
}

export function Button({ variant = 'primary', size = 'md', icon, iconRight, block, style, disabled, children, onMouseEnter, onMouseLeave, ...props }: ButtonProps) {
  const [h, setH] = useState(false)
  return (
    <button
      {...props}
      disabled={disabled}
      onMouseEnter={(e) => { setH(true); onMouseEnter?.(e) }}
      onMouseLeave={(e) => { setH(false); onMouseLeave?.(e) }}
      style={{
        boxSizing: 'border-box', cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        whiteSpace: 'nowrap', fontFamily: 'inherit', fontWeight: 600,
        transition: 'background .2s, border-color .2s', opacity: disabled ? 0.45 : 1,
        width: block ? '100%' : undefined,
        ...BTN_SIZE[size],
        ...BTN_VARIANT[variant],
        ...(h && !disabled ? { background: BTN_HOVER[variant] } : {}),
        ...style,
      }}
    >
      {icon && <Icon icon={icon} size={size === 'lg' ? 17 : 15} />}
      {children}
      {iconRight && <Icon icon={iconRight} size={14} />}
    </button>
  )
}

// ── IconButton — botão só-ícone ─────────────────────────────────────────────
// Aceita `icon` (Lucide, com mola no hover) ou children (svg legado).

export function IconButton({ icon, children, active, tone, size = 36, variant = 'ghost', badge, style, onMouseEnter, onMouseLeave, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: LucideIcon
  active?: boolean
  tone?: 'default' | 'danger'
  size?: number
  variant?: 'ghost' | 'outline'
  badge?: React.ReactNode
}) {
  const [h, setH] = useState(false)
  const danger = tone === 'danger'
  const corAtiva = danger ? T.status.danger : T.brand.primary
  const bgHover = danger ? T.status.dangerBg : T.brand.primaryLight
  return (
    <button
      {...props}
      onMouseEnter={(e) => { setH(true); onMouseEnter?.(e) }}
      onMouseLeave={(e) => { setH(false); onMouseLeave?.(e) }}
      style={{
        position: 'relative', width: size, height: size, borderRadius: size >= 40 ? 12 : 10,
        display: 'inline-grid', placeItems: 'center', cursor: 'pointer', flexShrink: 0,
        color: active || h ? corAtiva : danger ? T.status.danger : T.text.secondary,
        background: active ? T.brand.primaryLight : h ? bgHover : variant === 'outline' ? T.bg.card : 'transparent',
        border: variant === 'outline' ? `1px solid ${T.border.default}` : 'none',
        transition: 'background .2s, color .2s',
        ...style,
      }}
    >
      {icon ? (
        <span style={{ display: 'inline-grid', transition: SPRING, transform: h ? 'rotate(-8deg) scale(1.06)' : 'none' }}>
          <Icon icon={icon} size={size >= 40 ? 18 : 16} active={h || active} />
        </span>
      ) : children}
      {badge ? (
        <span style={{
          position: 'absolute', top: 3, right: 3, minWidth: 17, height: 17, padding: '0 4px', boxSizing: 'border-box',
          borderRadius: 9, background: T.brand.primary, color: '#fff', fontSize: 10.5, fontWeight: 700,
          lineHeight: '13px', textAlign: 'center', border: `2px solid ${T.bg.page}`,
        }}>{badge}</span>
      ) : null}
    </button>
  )
}

// ── Card ────────────────────────────────────────────────────────────────────
// Sem sombra em repouso. Com onClick/hover: borda some, sombra e sobe 2px.
// `titulo`/`acao` opcionais renderizam o cabeçalho padrão (15/700).

export function Card({ style, onClick, padding = 18, radius, hover, titulo, acao, children, onMouseEnter, onMouseLeave, ...props }: Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> & {
  padding?: number | string
  radius?: number
  hover?: boolean
  titulo?: React.ReactNode
  acao?: React.ReactNode
}) {
  const [h, setH] = useState(false)
  const clicavel = !!onClick || hover
  const on = clicavel && h
  return (
    <div
      {...props}
      onClick={onClick}
      onMouseEnter={(e) => { setH(true); onMouseEnter?.(e) }}
      onMouseLeave={(e) => { setH(false); onMouseLeave?.(e) }}
      style={{
        background: T.bg.card,
        border: `1px solid ${on ? 'transparent' : T.border.default}`,
        borderRadius: radius ?? T.radius['2xl'],
        padding,
        boxShadow: on ? T.shadow.cardHover : 'none',
        transform: on ? 'translateY(-2px)' : 'none',
        transition: 'all .2s',
        cursor: onClick ? 'pointer' : undefined,
        ...style,
      }}
    >
      {(titulo || acao) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <h3 style={{ margin: 0, flex: 1, fontSize: 15, fontWeight: 700, letterSpacing: '-.01em', color: T.text.primary }}>{titulo}</h3>
          {acao}
        </div>
      )}
      {children}
    </div>
  )
}

/** Painel branco grande (raio 20) — superfície de conteúdo de uma página. */
export function Panel({ style, padding = 16, children, ...props }: React.HTMLAttributes<HTMLDivElement> & { padding?: number | string }) {
  return (
    <div {...props} style={{
      background: T.bg.card, border: `1px solid ${T.border.default}`, borderRadius: T.radius['3xl'],
      padding, ...style,
    }}>{children}</div>
  )
}

// ── Badge ───────────────────────────────────────────────────────────────────

export type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'pending' | 'accent'

const BADGE_TONE: Record<BadgeTone, { bg: string; fg: string }> = {
  neutral: { bg: T.border.muted, fg: T.text.secondary },
  info: { bg: T.status.infoBg, fg: T.status.infoStrong },
  success: { bg: T.status.successBg, fg: T.status.success },
  warning: { bg: T.status.warningBg, fg: T.status.warning },
  pending: { bg: '#FBF3DF', fg: '#8A6A1F' },
  danger: { bg: T.status.dangerBg, fg: T.status.danger },
  accent: { bg: T.brand.primarySubtle, fg: T.brand.primary },
}

export function Badge({ tone = 'neutral', children, style, dot, icon }: {
  tone?: BadgeTone
  children: React.ReactNode
  style?: React.CSSProperties
  dot?: boolean
  icon?: LucideIcon
}) {
  const c = BADGE_TONE[tone]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontSize: 11.5, fontWeight: 600, padding: '3px 9px', borderRadius: 99,
      background: c.bg, color: c.fg, whiteSpace: 'nowrap', ...style,
    }}>
      {dot && <span style={{ width: 7, height: 7, borderRadius: '50%', background: c.fg }} />}
      {icon && <Icon icon={icon} size={12} />}
      {children}
    </span>
  )
}

// ── Form: Input / Select / Textarea / Field ─────────────────────────────────
// Altura 40, raio 12, borda #EBEAEF; foco = borda lilás + ring 4px.

const campoBase: React.CSSProperties = {
  width: '100%', minHeight: 40, padding: '9px 12px', borderRadius: T.radius.input,
  border: `1px solid ${T.border.default}`, fontSize: 13.5, outline: 'none',
  boxSizing: 'border-box', background: T.bg.card, color: T.text.primary, fontFamily: 'inherit',
  transition: 'border-color .15s, box-shadow .15s',
}
const focar = (el: HTMLElement) => { el.style.borderColor = T.brand.primaryAccent; el.style.boxShadow = T.shadow.focusRing }
// Ao sair do campo volta para a borda definida pelo uso (ex.: vermelho de erro) ou a padrão
const desfocar = (el: HTMLElement, borda?: string) => { el.style.borderColor = borda || T.border.default; el.style.boxShadow = 'none' }

export function Input({ style, onFocus, onBlur, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      onFocus={(e) => { focar(e.currentTarget); onFocus?.(e) }}
      onBlur={(e) => { desfocar(e.currentTarget, style?.borderColor as string | undefined); onBlur?.(e) }}
      style={{ ...campoBase, ...style }}
    />
  )
}

export function Select({ style, onFocus, onBlur, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      onFocus={(e) => { focar(e.currentTarget); onFocus?.(e) }}
      onBlur={(e) => { desfocar(e.currentTarget, style?.borderColor as string | undefined); onBlur?.(e) }}
      style={{ ...campoBase, ...style }}
    />
  )
}

export function Textarea({ style, onFocus, onBlur, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      onFocus={(e) => { focar(e.currentTarget); onFocus?.(e) }}
      onBlur={(e) => { desfocar(e.currentTarget, style?.borderColor as string | undefined); onBlur?.(e) }}
      style={{ ...campoBase, resize: 'vertical', lineHeight: 1.5, ...style }}
    />
  )
}

export function Field({ label, children, style, hint }: {
  label: string
  children: React.ReactNode
  style?: React.CSSProperties
  hint?: string
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0, ...style }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: T.text.secondary }}>{label}</label>
      {children}
      {hint && <span style={{ fontSize: 12, color: T.text.quaternary }}>{hint}</span>}
    </div>
  )
}

/** Busca = UMA barra com borda; o input interno não tem borda própria. */
export function SearchInput({ value, onChange, placeholder = 'Buscar…', style, trailing, autoFocus, inputRef, onKeyDown }: {
  inputRef?: React.Ref<HTMLInputElement>
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>
  value: string
  onChange: (v: string) => void
  placeholder?: string
  style?: React.CSSProperties
  trailing?: React.ReactNode
  autoFocus?: boolean
}) {
  const [f, setF] = useState(false)
  return (
    <label style={{
      display: 'flex', alignItems: 'center', gap: 10, height: 40, padding: '0 12px', borderRadius: T.radius.input,
      background: T.bg.card, border: `1px solid ${f ? T.brand.primaryAccent : T.border.default}`,
      boxShadow: f ? T.shadow.focusRing : 'none', color: T.text.tertiary, cursor: 'text',
      transition: 'border-color .15s, box-shadow .15s', ...style,
    }}>
      <Icon icon={Search} size={16} />
      <input
        ref={inputRef}
        onKeyDown={onKeyDown}
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setF(true)}
        onBlur={() => setF(false)}
        placeholder={placeholder}
        className="c360-campo-interno"
        style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', fontSize: 13.5, color: T.text.primary, padding: 0, minHeight: 0, boxShadow: 'none' }}
      />
      {trailing}
    </label>
  )
}

// ── SegmentedControl — Hoje/Semana/Mês, Dia/Semana/Mês ───────────────────────

export function SegmentedControl<V extends string>({ options, value, onChange, stretch, size = 'md', style }: {
  options: Array<V | { value: V; label: React.ReactNode }>
  value: V
  onChange: (v: V) => void
  stretch?: boolean
  size?: 'sm' | 'md'
  style?: React.CSSProperties
}) {
  return (
    <div style={{
      display: 'flex', padding: 3, gap: 2, background: T.bg.page, border: `1px solid ${T.border.default}`,
      borderRadius: 12, width: stretch ? '100%' : 'fit-content', boxSizing: 'border-box', ...style,
    }}>
      {options.map((o) => {
        const v = (typeof o === 'string' ? o : o.value) as V
        const l = typeof o === 'string' ? o : o.label
        const on = v === value
        return (
          <button key={v} type="button" onClick={() => onChange(v)} style={{
            flex: stretch ? 1 : 'none', textAlign: 'center', whiteSpace: 'nowrap', cursor: 'pointer',
            padding: size === 'sm' ? '4px 11px' : '6px 14px', borderRadius: 9, border: 'none',
            fontSize: size === 'sm' ? 12.5 : 13, fontFamily: 'inherit', fontWeight: on ? 600 : 500,
            color: on ? T.text.primary : T.text.quaternary, background: on ? '#fff' : 'transparent',
            boxShadow: on ? T.shadow.md : 'none', transition: 'background .15s, color .15s',
          }}>{l}</button>
        )
      })}
    </div>
  )
}

// ── Switch / Checkbox / Chip ─────────────────────────────────────────────────

export function Switch({ checked, onChange, label, descricao, disabled }: {
  checked: boolean
  onChange: (v: boolean) => void
  label?: React.ReactNode
  descricao?: React.ReactNode
  disabled?: boolean
}) {
  const t = (
    <button type="button" role="switch" aria-checked={checked} disabled={disabled} onClick={() => onChange(!checked)} style={{
      width: 36, height: 20, borderRadius: 99, border: 'none', padding: 0, flexShrink: 0, position: 'relative',
      background: checked ? T.brand.primary : '#DCDAE3', cursor: disabled ? 'not-allowed' : 'pointer',
      transition: 'background .2s', opacity: disabled ? 0.5 : 1,
    }}>
      <span style={{
        position: 'absolute', top: 2, left: checked ? 18 : 2, width: 16, height: 16, borderRadius: '50%',
        background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,.2)', transition: 'left .2s',
      }} />
    </button>
  )
  if (!label) return t
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 13.5, fontWeight: 600, color: T.text.primary }}>{label}</span>
        {descricao && <span style={{ fontSize: 12.5, color: T.text.quaternary, lineHeight: 1.45 }}>{descricao}</span>}
      </div>
      {t}
    </div>
  )
}

export function Checkbox({ checked, onChange, label, color = T.brand.primary }: {
  checked: boolean
  onChange: (v: boolean) => void
  label?: React.ReactNode
  color?: string
}) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer', fontSize: 13, color: T.text.strong }}>
      <span onClick={(e) => { e.preventDefault(); onChange(!checked) }} style={{
        width: 16, height: 16, borderRadius: 5, flexShrink: 0, display: 'grid', placeItems: 'center',
        background: checked ? color : '#fff', border: `1.5px solid ${checked ? color : '#DCDAE3'}`, color: '#fff',
        transition: 'background .15s, border-color .15s',
      }}>{checked && <Check size={11} strokeWidth={3} />}</span>
      {label && <span onClick={(e) => { e.preventDefault(); onChange(!checked) }}>{label}</span>}
    </label>
  )
}

export function Chip({ ativo, onClick, children, icon, style }: {
  ativo?: boolean
  onClick?: () => void
  children: React.ReactNode
  icon?: LucideIcon
  style?: React.CSSProperties
}) {
  return (
    <button type="button" onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, height: 32, padding: '0 12px', borderRadius: 99,
      fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap',
      border: `1px solid ${ativo ? T.brand.primaryAccentSoft : T.border.default}`,
      background: ativo ? T.brand.primarySubtle : '#fff',
      color: ativo ? T.brand.primary : T.text.muted,
      transition: 'all .15s', ...style,
    }}>
      {icon && <Icon icon={icon} size={14} />}
      {children}
    </button>
  )
}

// ── ProgressBar ──────────────────────────────────────────────────────────────

export function ProgressBar({ valor, cor = T.brand.primary, altura = 6, trilho = T.brand.primaryLight }: {
  valor: number // 0–100
  cor?: string
  altura?: number
  trilho?: string
}) {
  return (
    <div style={{ height: altura, borderRadius: 99, background: trilho, overflow: 'hidden' }}>
      <div style={{ width: `${Math.max(0, Math.min(100, valor))}%`, height: '100%', background: cor, borderRadius: 99, transition: 'width .4s' }} />
    </div>
  )
}

// ── Avatar — iniciais em tint ───────────────────────────────────────────────

export function Avatar({ nome, iniciais, size = 36, forma = 'circle', tom = 'purple', src }: {
  nome?: string
  iniciais?: string
  size?: number
  forma?: 'circle' | 'square'
  tom?: 'purple' | 'pink' | 'blue' | 'green' | 'dark'
  src?: string | null
}) {
  const ini = iniciais || (nome || '').split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase()
  const P = {
    purple: [T.brand.primary, T.brand.primaryLight],
    pink: ['#C0397A', '#FCEBF3'],
    blue: ['#1F6FB2', '#E8F1FB'],
    green: [T.status.success, T.status.successBg],
    dark: ['#fff', T.night[800]],
  }[tom]
  const radius = forma === 'square' ? Math.round(size * 0.3) : '50%'
  if (src) return <img src={src} alt="" style={{ width: size, height: size, borderRadius: radius, objectFit: 'cover', flexShrink: 0 }} />
  return (
    <span style={{
      width: size, height: size, borderRadius: radius, background: P[1], color: P[0], flexShrink: 0,
      display: 'inline-grid', placeItems: 'center', fontSize: Math.round(size * 0.34), fontWeight: 700,
    }}>{ini}</span>
  )
}

// ── Overline — rótulo de seção (MAIÚSCULAS 11/700 +.05em) ─────────────────────

export function Overline({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: T.text.tertiary, ...style }}>
      {children}
    </div>
  )
}

// ── PageHeader ──────────────────────────────────────────────────────────────
// O título e a descrição vão para o cabeçalho do app (fora do painel).
// Aqui dentro só sobra a linha de ações (se houver).

export function PageHeader({ titulo, descricao, acao }: {
  titulo: string
  descricao?: string
  acao?: React.ReactNode
}) {
  usePageHeader(titulo, descricao)
  if (!acao) return null
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
      {acao}
    </div>
  )
}

// ── Tabs — navegação por abas (sublinhado roxo na ativa) ─────────────────────

export function Tabs({ tabs, ativa, onChange, style }: {
  tabs: { id: string; label: string; icon?: React.ReactNode }[]
  ativa: string
  onChange: (id: string) => void
  style?: React.CSSProperties
}) {
  return (
    <div style={{ display: 'flex', gap: 4, borderBottom: `1px solid ${T.border.default}`, marginBottom: 20, ...style }}>
      {tabs.map(t => {
        const isAtiva = t.id === ativa
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '10px 12px', border: 'none', background: 'transparent',
              cursor: 'pointer', fontSize: 13.5, fontFamily: 'inherit', whiteSpace: 'nowrap',
              fontWeight: isAtiva ? 600 : 500,
              color: isAtiva ? T.text.primary : T.text.quaternary,
              borderBottom: `2px solid ${isAtiva ? T.brand.primary : 'transparent'}`,
              marginBottom: -1, transition: 'color .15s',
            }}
          >
            {t.icon && <span style={{ display: 'inline-grid', color: isAtiva ? T.brand.primary : 'inherit' }}>{t.icon}</span>}
            {t.label}
          </button>
        )
      })}
    </div>
  )
}

// ── EmptyState ──────────────────────────────────────────────────────────────
// `icon` aceita um ícone Lucide (recomendado) ou um nó React (legado).

export function EmptyState({ icon, titulo, descricao, acao }: {
  icon?: LucideIcon | React.ReactNode
  titulo: string
  descricao?: string
  acao?: React.ReactNode
}) {
  const ehLucide = typeof icon === 'function' || (typeof icon === 'object' && icon !== null && 'render' in (icon as any))
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '40px 20px', textAlign: 'center', gap: 8,
    }}>
      {icon && (
        <span style={{
          width: 48, height: 48, borderRadius: 15, marginBottom: 4,
          background: T.brand.primaryLight, color: T.brand.primary,
          display: 'grid', placeItems: 'center',
        }}>{ehLucide ? <Icon icon={icon as LucideIcon} size={22} /> : (icon as React.ReactNode)}</span>
      )}
      <p style={{ fontSize: 14.5, fontWeight: 700, color: T.text.primary, margin: 0 }}>{titulo}</p>
      {descricao && <p style={{ fontSize: 12.5, color: T.text.quaternary, margin: 0, maxWidth: 340, lineHeight: 1.45 }}>{descricao}</p>}
      {acao && <div style={{ marginTop: 8 }}>{acao}</div>}
    </div>
  )
}

// ── KpiCard — padrão do dashboard (rótulo, tile colorido, número, variação) ──

export function KpiCard({ label, valor, delta, tendencia = 'up', comparacao = 'vs. mês anterior', icon, cor = T.data.purple, carregando }: {
  label: string
  valor: React.ReactNode
  delta?: string
  tendencia?: 'up' | 'down' | 'flat'
  comparacao?: string
  icon: LucideIcon
  cor?: string
  carregando?: boolean
}) {
  const [h, setH] = useState(false)
  const TR = {
    up: [T.status.success, T.status.successBg, ArrowUpRight],
    down: [T.status.danger, T.status.dangerBg, ArrowDownRight],
    flat: [T.text.quaternary, T.border.muted, Minus],
  }[tendencia] as [string, string, LucideIcon]
  return (
    <div
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{
        flex: '1 1 170px', minWidth: 0, background: '#fff', borderRadius: 16, padding: '18px 18px 18px 20px',
        border: `1px solid ${h ? 'transparent' : T.border.default}`,
        boxShadow: h ? T.shadow.cardHover : 'none', transform: h ? 'translateY(-2px)' : 'none', transition: 'all .25s',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
        <span style={{ paddingTop: 10, fontSize: 13.5, fontWeight: 700, color: T.text.strong }}>{label}</span>
        <IconTile icon={icon} color={cor} active={h} />
      </div>
      {carregando ? (
        <>
          <div className="c360-skel" style={{ marginTop: 14, height: 28, width: '55%', borderRadius: 8 }} />
          <div className="c360-skel" style={{ marginTop: 12, height: 24, width: '75%', borderRadius: 8 }} />
        </>
      ) : (
        <>
          <div style={{ marginTop: 14, fontSize: 28, fontWeight: 700, letterSpacing: '-.03em', lineHeight: 1, color: T.text.primary, fontVariantNumeric: 'tabular-nums' }}>{valor}</div>
          {delta !== undefined && (
            <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 3, height: 24, padding: '0 8px 0 6px', borderRadius: 8,
                background: TR[1], color: TR[0], fontSize: 12.5, fontWeight: 600,
              }}><Icon icon={TR[2]} size={13} />{delta}</span>
              <span style={{ fontSize: 12.5, color: T.text.tertiary }}>{comparacao}</span>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── MetricCard — KPI simples (legado; prefira KpiCard quando houver ícone) ────

export function MetricCard({ label, valor, delta, deltaTone, sublabel }: {
  label: string
  valor: string | number
  delta?: string
  deltaTone?: 'success' | 'danger' | 'neutral'
  sublabel?: string
}) {
  const deltaColor = deltaTone === 'success' ? T.status.success
    : deltaTone === 'danger' ? T.status.danger
    : T.text.quaternary
  return (
    <div style={{
      background: T.bg.card, border: `1px solid ${T.border.default}`,
      borderRadius: T.radius['2xl'], padding: '16px 18px',
    }}>
      <p style={{ fontSize: 13, fontWeight: 600, color: T.text.secondary, margin: 0 }}>{label}</p>
      <p style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.03em', color: T.text.primary, margin: '8px 0 0', lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>{valor}</p>
      {(delta || sublabel) && (
        <p style={{ fontSize: 12.5, color: deltaColor, margin: '6px 0 0' }}>
          {delta}{sublabel ? (delta ? ' · ' : '') + sublabel : ''}
        </p>
      )}
    </div>
  )
}

// ── Modal / Drawer ──────────────────────────────────────────────────────────

export function Modal({ titulo, children, onClose, largura = 480, rodape }: {
  titulo?: string
  children: React.ReactNode
  onClose: () => void
  largura?: number
  rodape?: React.ReactNode
}) {
  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, background: T.bg.overlay, zIndex: 200,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
    >
      <div style={{
        background: T.bg.card, borderRadius: T.radius['3xl'], width: `min(${largura}px, 100%)`,
        maxHeight: 'calc(100vh - 40px)', overflowY: 'auto', boxShadow: T.shadow.modal,
      }}>
        {titulo && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '18px 20px 14px' }}>
            <h2 style={{ flex: 1, fontSize: 16, fontWeight: 700, color: T.text.primary, margin: 0 }}>{titulo}</h2>
            <IconButton icon={X} size={32} onClick={onClose} aria-label="Fechar" />
          </div>
        )}
        <div style={{ padding: titulo ? '0 20px 20px' : 22 }}>
          {children}
          {rodape && <ModalAcoes>{rodape}</ModalAcoes>}
        </div>
      </div>
    </div>
  )
}

export function ModalAcoes({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 18 }}>
      {children}
    </div>
  )
}

export function Drawer({ titulo, children, onClose, largura = 440, rodape }: {
  titulo?: React.ReactNode
  children: React.ReactNode
  onClose: () => void
  largura?: number
  rodape?: React.ReactNode
}) {
  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose() }} style={{
      position: 'fixed', inset: 0, background: T.bg.overlay, zIndex: 200, display: 'flex', justifyContent: 'flex-end', padding: 12,
    }}>
      <div style={{
        width: `min(${largura}px, calc(100vw - 24px))`, height: '100%', background: '#fff', borderRadius: T.radius['3xl'],
        boxShadow: T.shadow.modal, display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '18px 20px 14px', borderBottom: `1px solid ${T.border.muted}` }}>
          <div style={{ flex: 1, minWidth: 0, fontSize: 16, fontWeight: 700 }}>{titulo}</div>
          <IconButton icon={X} size={32} onClick={onClose} aria-label="Fechar" />
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>{children}</div>
        {rodape && <div style={{ padding: '14px 20px', borderTop: `1px solid ${T.border.muted}`, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>{rodape}</div>}
      </div>
    </div>
  )
}
