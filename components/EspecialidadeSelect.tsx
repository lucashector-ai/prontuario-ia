'use client'

import { useEffect, useRef, useState } from 'react'
import { ESPECIALIDADES_CFM } from '@/lib/especialidades'

interface Props {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  style?: React.CSSProperties
}

export function EspecialidadeSelect({ value, onChange, placeholder = 'Ex: Cardiologia, Dermatologia...', style }: Props) {
  const [open, setOpen] = useState(false)
  const [hover, setHover] = useState(0)
  const wrapRef = useRef<HTMLDivElement>(null)

  // Fecha o dropdown quando clica fora
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const sugestoes = (() => {
    const q = value.trim().toLowerCase()
    if (!q) return ESPECIALIDADES_CFM.slice(0, 8) // Top 8 quando vazio
    // Match: começa com query OU contém query
    const startsWith = ESPECIALIDADES_CFM.filter(e => e.toLowerCase().startsWith(q))
    const contains = ESPECIALIDADES_CFM.filter(e => !e.toLowerCase().startsWith(q) && e.toLowerCase().includes(q))
    return [...startsWith, ...contains].slice(0, 8)
  })()

  const selecionar = (esp: string) => {
    onChange(esp)
    setOpen(false)
  }

  const ehCustom = value.trim().length > 0 && !ESPECIALIDADES_CFM.some(e => e.toLowerCase() === value.trim().toLowerCase())

  return (
    <div ref={wrapRef} style={{ position: 'relative', ...style }}>
      <input
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true); setHover(0) }}
        onFocus={() => setOpen(true)}
        onKeyDown={e => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setHover(h => Math.min(h + 1, sugestoes.length - 1)); setOpen(true) }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setHover(h => Math.max(h - 1, 0)) }
          else if (e.key === 'Enter' && open && sugestoes[hover]) { e.preventDefault(); selecionar(sugestoes[hover]) }
          else if (e.key === 'Escape') setOpen(false)
        }}
        placeholder={placeholder}
        autoComplete="off"
        style={{
          width: '100%', padding: '9px 12px', fontSize: 13, borderRadius: 8,
          border: '1px solid #e5e7eb', outline: 'none', background: 'white',
        }}
      />
      {open && sugestoes.length > 0 && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
          background: 'white', border: '1px solid #e5e7eb', borderRadius: 8,
          boxShadow: '0 8px 24px rgba(0,0,0,0.08)', zIndex: 20,
          maxHeight: 280, overflowY: 'auto',
        }}>
          {sugestoes.map((esp, i) => (
            <div
              key={esp}
              onMouseDown={e => { e.preventDefault(); selecionar(esp) }}
              onMouseEnter={() => setHover(i)}
              style={{
                padding: '8px 12px', fontSize: 13, cursor: 'pointer',
                background: hover === i ? '#f5f3ff' : 'transparent',
                color: hover === i ? '#6043C1' : '#111827',
              }}
            >
              {esp}
            </div>
          ))}
          {ehCustom && (
            <div style={{
              padding: '8px 12px', fontSize: 12, color: '#6b7280',
              borderTop: '1px solid #f3f4f6', background: '#fafafa',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <span>Vai usar &quot;<strong>{value.trim()}&quot;</strong> como especialidade personalizada</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
