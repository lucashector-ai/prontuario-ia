/**
 * Design system — componentes base do Clinical 360.
 *
 * Construídos sobre os tokens de lib/design-tokens.ts. Use estes componentes
 * em vez de reescrever estilos inline, para manter a plataforma consistente.
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
  secondary: { background: tokens.bg.card, color: tokens.text.strong, border: `1px solid ${tokens.border.default}` },
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
        padding: pad, borderRadius: 9, fontSize: fs, fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        whiteSpace: 'nowrap',
        ...style,
      }}
    />
  )
}

// ── Card ────────────────────────────────────────────────────────────────────

export function Card({ style, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      style={{
        background: tokens.bg.card, border: `1px solid ${tokens.border.subtle}`,
        borderRadius: 16, padding: 20, ...style,
      }}
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

const campoBase: React.CSSProperties = {
  width: '100%', padding: '9px 11px', borderRadius: 9,
  border: `1px solid ${tokens.border.default}`, fontSize: 13, outline: 'none',
  boxSizing: 'border-box', background: tokens.bg.card, color: tokens.text.primary,
}

export function Input({ style, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} style={{ ...campoBase, ...style }} />
}

export function Select({ style, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} style={{ ...campoBase, ...style }} />
}

export function Textarea({ style, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} style={{ ...campoBase, resize: 'vertical', fontFamily: 'inherit', ...style }} />
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
        background: tokens.bg.card, borderRadius: 16, width: `min(${largura}px, 100%)`,
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
