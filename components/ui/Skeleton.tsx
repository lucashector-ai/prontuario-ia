import { HTMLAttributes } from 'react'
import { tokens } from '@/lib/design-tokens'

type Props = HTMLAttributes<HTMLDivElement> & {
  width?: number | string
  height?: number | string
  radius?: number | string
  circle?: boolean
}

export function Skeleton({ width = '100%', height = 16, radius, circle, style, ...rest }: Props) {
  const r = circle ? '50%' : radius ?? tokens.radius.md

  return (
    <div
      aria-hidden
      style={{
        width,
        height,
        borderRadius: r,
        background: `linear-gradient(90deg, ${tokens.bg.cardSubtle} 0%, ${tokens.bg.hover} 50%, ${tokens.bg.cardSubtle} 100%)`,
        backgroundSize: '200% 100%',
        animation: 'skeletonShimmer 1.4s ease-in-out infinite',
        ...style,
      }}
      {...rest}
    />
  )
}

export function SkeletonText({ lines = 3, lastLineWidth = '70%' }: { lines?: number; lastLineWidth?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} height={12} width={i === lines - 1 ? lastLineWidth : '100%'} />
      ))}
    </div>
  )
}
