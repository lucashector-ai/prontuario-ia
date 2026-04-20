// Biblioteca de ícones SVG usados no MedIA
// Substitui emojis por ícones consistentes

type IconProps = {
  size?: number
  color?: string
  strokeWidth?: number
  style?: React.CSSProperties
}

const defaults = { size: 16, color: 'currentColor', strokeWidth: 2 }

export function IconClipboard({ size, color, strokeWidth, style }: IconProps) {
  const s = { ...defaults, size, color, strokeWidth }
  return (
    <svg width={s.size} height={s.size} viewBox="0 0 24 24" fill="none" stroke={s.color} strokeWidth={s.strokeWidth} style={style}>
      <rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/><path d="M9 13h6M9 17h6"/>
    </svg>
  )
}

export function IconCalendar({ size, color, strokeWidth, style }: IconProps) {
  const s = { ...defaults, size, color, strokeWidth }
  return (
    <svg width={s.size} height={s.size} viewBox="0 0 24 24" fill="none" stroke={s.color} strokeWidth={s.strokeWidth} style={style}>
      <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  )
}

export function IconUsers({ size, color, strokeWidth, style }: IconProps) {
  const s = { ...defaults, size, color, strokeWidth }
  return (
    <svg width={s.size} height={s.size} viewBox="0 0 24 24" fill="none" stroke={s.color} strokeWidth={s.strokeWidth} style={style}>
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
    </svg>
  )
}

export function IconCheck({ size, color, strokeWidth, style }: IconProps) {
  const s = { ...defaults, size, color, strokeWidth }
  return (
    <svg width={s.size} height={s.size} viewBox="0 0 24 24" fill="none" stroke={s.color} strokeWidth={s.strokeWidth} style={style}>
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  )
}

export function IconUpload({ size, color, strokeWidth, style }: IconProps) {
  const s = { ...defaults, size, color, strokeWidth }
  return (
    <svg width={s.size} height={s.size} viewBox="0 0 24 24" fill="none" stroke={s.color} strokeWidth={s.strokeWidth} style={style}>
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
    </svg>
  )
}

export function IconBarChart({ size, color, strokeWidth, style }: IconProps) {
  const s = { ...defaults, size, color, strokeWidth }
  return (
    <svg width={s.size} height={s.size} viewBox="0 0 24 24" fill="none" stroke={s.color} strokeWidth={s.strokeWidth} style={style}>
      <line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/>
    </svg>
  )
}

export function IconBell({ size, color, strokeWidth, style }: IconProps) {
  const s = { ...defaults, size, color, strokeWidth }
  return (
    <svg width={s.size} height={s.size} viewBox="0 0 24 24" fill="none" stroke={s.color} strokeWidth={s.strokeWidth} style={style}>
      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/>
    </svg>
  )
}

export function IconStar({ size, color, strokeWidth, style }: IconProps) {
  const s = { ...defaults, size, color, strokeWidth }
  return (
    <svg width={s.size} height={s.size} viewBox="0 0 24 24" fill="none" stroke={s.color} strokeWidth={s.strokeWidth} style={style}>
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  )
}

export function IconLock({ size, color, strokeWidth, style }: IconProps) {
  const s = { ...defaults, size, color, strokeWidth }
  return (
    <svg width={s.size} height={s.size} viewBox="0 0 24 24" fill="none" stroke={s.color} strokeWidth={s.strokeWidth} style={style}>
      <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
    </svg>
  )
}

export function IconAlert({ size, color, strokeWidth, style }: IconProps) {
  const s = { ...defaults, size, color, strokeWidth }
  return (
    <svg width={s.size} height={s.size} viewBox="0 0 24 24" fill="none" stroke={s.color} strokeWidth={s.strokeWidth} style={style}>
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  )
}

export function IconEdit({ size, color, strokeWidth, style }: IconProps) {
  const s = { ...defaults, size, color, strokeWidth }
  return (
    <svg width={s.size} height={s.size} viewBox="0 0 24 24" fill="none" stroke={s.color} strokeWidth={s.strokeWidth} style={style}>
      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  )
}

export function IconBuilding({ size, color, strokeWidth, style }: IconProps) {
  const s = { ...defaults, size, color, strokeWidth }
  return (
    <svg width={s.size} height={s.size} viewBox="0 0 24 24" fill="none" stroke={s.color} strokeWidth={s.strokeWidth} style={style}>
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  )
}

export function IconTrendUp({ size, color, strokeWidth, style }: IconProps) {
  const s = { ...defaults, size, color, strokeWidth }
  return (
    <svg width={s.size} height={s.size} viewBox="0 0 24 24" fill="none" stroke={s.color} strokeWidth={s.strokeWidth} style={style}>
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
    </svg>
  )
}

export function IconTag({ size, color, strokeWidth, style }: IconProps) {
  const s = { ...defaults, size, color, strokeWidth }
  return (
    <svg width={s.size} height={s.size} viewBox="0 0 24 24" fill="none" stroke={s.color} strokeWidth={s.strokeWidth} style={style}>
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>
    </svg>
  )
}

export function IconClock({ size, color, strokeWidth, style }: IconProps) {
  const s = { ...defaults, size, color, strokeWidth }
  return (
    <svg width={s.size} height={s.size} viewBox="0 0 24 24" fill="none" stroke={s.color} strokeWidth={s.strokeWidth} style={style}>
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  )
}

export function IconRefresh({ size, color, strokeWidth, style }: IconProps) {
  const s = { ...defaults, size, color, strokeWidth }
  return (
    <svg width={s.size} height={s.size} viewBox="0 0 24 24" fill="none" stroke={s.color} strokeWidth={s.strokeWidth} style={style}>
      <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
    </svg>
  )
}

export function IconGift({ size, color, strokeWidth, style }: IconProps) {
  const s = { ...defaults, size, color, strokeWidth }
  return (
    <svg width={s.size} height={s.size} viewBox="0 0 24 24" fill="none" stroke={s.color} strokeWidth={s.strokeWidth} style={style}>
      <polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z"/>
    </svg>
  )
}
