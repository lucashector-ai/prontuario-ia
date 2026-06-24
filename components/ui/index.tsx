/**
 * Design system — componentes base do Clinical 360.
 *
 * Construídos sobre os tokens de lib/design-tokens.ts. Use estes componentes
 * em vez de reescrever estilos inline, para manter a plataforma consistente.
 *
 * Componentes disponíveis:
 *   Layout/superfície : Card, PageHeader, Modal, ModalAcoes
 *   Ações             : Button, IconButton
 *   Formulário        : Input, Select, Textarea, Field
 *   Sinalização       : Badge
 *   Navegação         : Tabs
 *   Conteúdo          : EmptyState, MetricCard
 *
 * Exemplos dos componentes novos:
 *
 *   <Card onClick={abrir}>...</Card>                 // card clicável (hover sutil)
 *
 *   <Tabs
 *     tabs={[{ id: 'a', label: 'Visão' }, { id: 'b', label: 'Itens' }]}
 *     ativa={aba} onChange={setAba} />
 *
 *   <EmptyState icon={<Icone/>} titulo="Nada por aqui"
 *     descricao="Crie o primeiro item." acao={<Button>Criar</Button>} />
 *
 *   <MetricCard label="Receita" valor="R$ 12.430" delta="+8%" deltaTone="success" />
 *
 *   <IconButton tone="danger" onClick={excluir}><Lixeira/></IconButton>
 */
import React from 'react'
import { tokens } from '@/lib/design-tokens'

// ── Button ──────────────────────────────────────────────────────────────────

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
}

const BTN_VARIANT: Record<ButtonVariant, React.CSSProperties> = {
  primary: { background: tokens.brand.primary, color: '#fff', border: 'none' },
  secondary: { background: tokens.bg.card, color: tokens.text.strong, border: `1px solid ${tokens.border.subtle}` },
  ghost: { background: 'transparent', color: tokens.brand.primary, border: 'none' },
  danger: { background: tokens.status.danger, color: '#fff', border: 'none' },
}

export function Button({ variant = 'primary', size = 'md', style, disabled, ...props }: ButtonProps) {
  const pad = size === 'sm' ? '6px 12px' : '10px 18px'
  const fs = size === 'sm' ? 12 : 13
  return (
    <button
      {...props}
      disabled={disabled}
      style={{
        ...BTN_VARIANT[variant],
        padding: pad, borderRadius: tokens.radius.lg, fontSize: fs, fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        whiteSpace: 'nowrap',
        ...style,
      }}
    />
  )
}

// ── Card ────────────────────────────────────────────────────────────────────
// Card canônico da plataforma. Sem props = superfície estática (borda subtle).
// Com onClick (ou hover) = clicável, com realce sutil de sombra no hover.

export function Card({ style, onClick, padding = 20, radius, hover, ...props }: React.HTMLAttributes<HTMLDivElement> & {
  padding?: number | string
  radius?: number
  hover?: boolean
}) {
  const isClickable = !!onClick || hover
  return (
    <div
      {...props}
      onClick={onClick}
      style={{
        background: tokens.bg.card,
        border: `1px solid ${tokens.border.subtle}`,
        borderRadius: radius ?? tokens.radius['2xl'],
        padding,
        transition: isClickable ? 'box-shadow 0.15s, transform 0.15s' : undefined,
        cursor: onClick ? 'pointer' : undefined,
        ...style,
      }}
      onMouseEnter={isClickable ? (e) => { e.currentTarget.style.boxShadow = tokens.shadow.lg } : undefined}
      onMouseLeave={isClickable ? (e) => { e.currentTarget.style.boxShadow = 'none' } : undefined}
    />
  )
}

// ── Badge ───────────────────────────────────────────────────────────────────

export type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger'

const BADGE_TONE: Record<BadgeTone, { bg: string; fg: string }> = {
  neutral: { bg: tokens.bg.cardSubtle, fg: tokens.text.secondary },
  info: { bg: tokens.status.infoBg, fg: tokens.status.infoStrong },
  success: { bg: tokens.status.successBg, fg: tokens.status.success },
  warning: { bg: tokens.status.warningBg, fg: tokens.status.warningAmberStrong },
  danger: { bg: tokens.status.dangerBg, fg: tokens.status.danger },
}

export function Badge({ tone = 'neutral', children, style }: {
  tone?: BadgeTone
  children: React.ReactNode
  style?: React.CSSProperties
}) {
  const c = BADGE_TONE[tone]
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 100,
      background: c.bg, color: c.fg, textTransform: 'uppercase', letterSpacing: '0.03em',
      display: 'inline-block', ...style,
    }}>{children}</span>
  )
}

// ── Form: Input / Select / Textarea / Field ─────────────────────────────────
// Foco padronizado: borda roxa (border.focus) + ring sutil (shadow.focusRing),
// aplicado via onFocus/onBlur (estilo inline não suporta :focus). Os handlers
// do consumidor são preservados (compostos), não sobrescritos.

const campoBase: React.CSSProperties = {
  width: '100%', padding: '9px 11px', borderRadius: tokens.radius.lg,
  border: `1px solid ${tokens.border.subtle}`, fontSize: 13, outline: 'none',
  boxSizing: 'border-box', background: tokens.bg.card, color: tokens.text.primary,
  transition: 'border-color 0.12s, box-shadow 0.12s',
}

export function Input({ style, onFocus, onBlur, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      onFocus={(e) => { e.currentTarget.style.borderColor = tokens.border.focus; e.currentTarget.style.boxShadow = tokens.shadow.focusRing; onFocus?.(e) }}
      onBlur={(e) => { e.currentTarget.style.borderColor = tokens.border.subtle; e.currentTarget.style.boxShadow = 'none'; onBlur?.(e) }}
      style={{ ...campoBase, ...style }}
    />
  )
}

export function Select({ style, onFocus, onBlur, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      onFocus={(e) => { e.currentTarget.style.borderColor = tokens.border.focus; e.currentTarget.style.boxShadow = tokens.shadow.focusRing; onFocus?.(e) }}
      onBlur={(e) => { e.currentTarget.style.borderColor = tokens.border.subtle; e.currentTarget.style.boxShadow = 'none'; onBlur?.(e) }}
      style={{ ...campoBase, ...style }}
    />
  )
}

export function Textarea({ style, onFocus, onBlur, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      onFocus={(e) => { e.currentTarget.style.borderColor = tokens.border.focus; e.currentTarget.style.boxShadow = tokens.shadow.focusRing; onFocus?.(e) }}
      onBlur={(e) => { e.currentTarget.style.borderColor = tokens.border.subtle; e.currentTarget.style.boxShadow = 'none'; onBlur?.(e) }}
      style={{ ...campoBase, resize: 'vertical', fontFamily: 'inherit', ...style }}
    />
  )
}

export function Field({ label, children, style }: {
  label: string
  children: React.ReactNode
  style?: React.CSSProperties
}) {
  return (
    <div style={style}>
      <label style={{
        fontSize: 12, fontWeight: 600, color: tokens.text.secondary,
        display: 'block', marginBottom: 6,
      }}>{label}</label>
      {children}
    </div>
  )
}

// ── PageHeader ──────────────────────────────────────────────────────────────

export function PageHeader({ titulo, descricao, acao }: {
  titulo: string
  descricao?: string
  acao?: React.ReactNode
}) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
      gap: 16, marginBottom: 20,
    }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: tokens.text.primary, margin: 0 }}>{titulo}</h1>
        {descricao && (
          <p style={{ fontSize: 13, color: tokens.text.secondary, margin: '4px 0 0' }}>{descricao}</p>
        )}
      </div>
      {acao}
    </div>
  )
}

// ── Tabs — navegação por abas (underline roxo na ativa) ─────────────────────

export function Tabs({ tabs, ativa, onChange, style }: {
  tabs: { id: string; label: string; icon?: React.ReactNode }[]
  ativa: string
  onChange: (id: string) => void
  style?: React.CSSProperties
}) {
  return (
    <div style={{ display: 'flex', gap: 4, borderBottom: `1px solid ${tokens.border.subtle}`, marginBottom: 24, ...style }}>
      {tabs.map(t => {
        const isAtiva = t.id === ativa
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '10px 14px', border: 'none', background: 'transparent',
              cursor: 'pointer', fontSize: 14, fontFamily: 'inherit',
              fontWeight: isAtiva ? 600 : 500,
              color: isAtiva ? tokens.brand.primary : tokens.text.secondary,
              borderBottom: isAtiva ? `2px solid ${tokens.brand.primary}` : '2px solid transparent',
              marginBottom: -1,
            }}
          >
            {t.icon}
            {t.label}
          </button>
        )
      })}
    </div>
  )
}

// ── EmptyState — estado vazio padronizado (ícone solto, sem quadrado) ────────

export function EmptyState({ icon, titulo, descricao, acao }: {
  icon?: React.ReactNode
  titulo: string
  descricao?: string
  acao?: React.ReactNode
}) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '48px 24px', textAlign: 'center', gap: 8,
    }}>
      {icon && <div style={{ color: tokens.text.tertiary, marginBottom: 8 }}>{icon}</div>}
      <p style={{ fontSize: 15, fontWeight: 600, color: tokens.text.primary, margin: 0 }}>{titulo}</p>
      {descricao && <p style={{ fontSize: 13, color: tokens.text.secondary, margin: 0, maxWidth: 360 }}>{descricao}</p>}
      {acao && <div style={{ marginTop: 12 }}>{acao}</div>}
    </div>
  )
}

// ── MetricCard — card de KPI (label, valor grande, delta opcional) ──────────

export function MetricCard({ label, valor, delta, deltaTone, sublabel }: {
  label: string
  valor: string | number
  delta?: string
  deltaTone?: 'success' | 'danger' | 'neutral'
  sublabel?: string
}) {
  const deltaColor = deltaTone === 'success' ? tokens.status.success
    : deltaTone === 'danger' ? tokens.status.danger
    : tokens.text.secondary
  return (
    <div style={{
      background: tokens.bg.card, border: `1px solid ${tokens.border.subtle}`,
      borderRadius: tokens.radius.xl, padding: 16,
    }}>
      <p style={{ fontSize: 13, color: tokens.text.secondary, margin: 0 }}>{label}</p>
      <p style={{ fontSize: 24, fontWeight: 700, color: tokens.text.primary, margin: '6px 0 0', fontVariantNumeric: 'tabular-nums' }}>{valor}</p>
      {(delta || sublabel) && (
        <p style={{ fontSize: 12, color: deltaColor, margin: '4px 0 0' }}>
          {delta}{sublabel ? (delta ? ' · ' : '') + sublabel : ''}
        </p>
      )}
    </div>
  )
}

// ── IconButton — botão só-ícone (sino, editar, deletar) ─────────────────────

export function IconButton({ children, active, tone, style, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean
  tone?: 'default' | 'danger'
}) {
  const color = tone === 'danger' ? tokens.status.danger : tokens.text.secondary
  return (
    <button
      {...props}
      style={{
        width: 36, height: 36, borderRadius: tokens.radius.lg,
        background: active ? tokens.bg.hoverStrong : 'transparent',
        border: 'none', cursor: 'pointer', color,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        transition: 'background 0.12s',
        ...style,
      }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = tokens.bg.hover }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent' }}
    >
      {children}
    </button>
  )
}

// ── Modal ───────────────────────────────────────────────────────────────────

export function Modal({ titulo, children, onClose, largura = 460 }: {
  titulo?: string
  children: React.ReactNode
  onClose: () => void
  largura?: number
}) {
  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, background: tokens.bg.overlay, zIndex: 200,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
    >
      <div style={{
        background: tokens.bg.card, borderRadius: tokens.radius['2xl'], width: `min(${largura}px, 100%)`,
        maxHeight: '90vh', overflowY: 'auto', padding: 26,
      }}>
        {titulo && (
          <h2 style={{ fontSize: 17, fontWeight: 700, color: tokens.text.primary, margin: '0 0 16px' }}>
            {titulo}
          </h2>
        )}
        {children}
      </div>
    </div>
  )
}

// ── ModalAcoes — rodapé padrão de modal ─────────────────────────────────────

export function ModalAcoes({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
      {children}
    </div>
  )
}
