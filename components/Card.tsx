'use client'

import { tokens } from '@/lib/design-tokens'
import type { CSSProperties, ReactNode, MouseEvent } from 'react'

type Props = {
  children: ReactNode
  /** padding interno — padrão 20 */
  padding?: number | string
  /** raio do card — padrão 14 */
  radius?: number
  /** torna o card clicável (ganha cursor e leve realce no hover) */
  onClick?: (e: MouseEvent<HTMLDivElement>) => void
  /** estilos extras, sobrescrevem o padrão */
  style?: CSSProperties
  className?: string
}

/**
 * Card padrão da plataforma.
 * Fundo branco, sombra suave (tokens.shadow.card), sem borda.
 * Use SEMPRE este componente para superfícies de conteúdo —
 * assim o visual fica consistente e mudanças globais são triviais.
 */
export function Card({ children, padding = 20, radius = 14, onClick, style, className }: Props) {
  const base: CSSProperties = {
    background: tokens.bg.card,
    borderRadius: radius,
    padding,
    border: `1px solid ${tokens.border.subtle}`,
    ...style,
  }

  if (onClick) {
    return (
      <div
        className={className}
        onClick={onClick}
        style={{ ...base, cursor: 'pointer', transition: 'box-shadow 0.15s, transform 0.15s' }}
        onMouseEnter={(e) => { e.currentTarget.style.boxShadow = tokens.shadow.lg }}
        onMouseLeave={(e) => { e.currentTarget.style.boxShadow = tokens.shadow.card }}
      >
        {children}
      </div>
    )
  }

  return (
    <div className={className} style={base}>
      {children}
    </div>
  )
}
