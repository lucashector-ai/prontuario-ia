'use client'
/** "Ver o texto enquanto grava (+1 crédito)": liga o texto ao vivo para esta e as próximas consultas. */
import { useEffect, useState } from 'react'
import { tokens as T } from '@/lib/design-tokens'
import { lerAoVivo, salvarAoVivo } from '@/lib/transcricao/aoVivo'

export function ChaveAoVivo() {
  const [v, setV] = useState(false)
  useEffect(() => { setV(lerAoVivo()) }, [])
  return (
    <label title="Desligado: o texto aparece quando você encerra a gravação, e a consulta gasta 1 crédito. Ligado: o texto aparece enquanto vocês conversam (+1 crédito)."
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: T.text.secondary, cursor: 'pointer', whiteSpace: 'nowrap' }}>
      <input type="checkbox" checked={v} onChange={e => { setV(e.target.checked); salvarAoVivo(e.target.checked) }} />
      Ver o texto enquanto grava <span style={{ color: T.text.tertiary }}>(+1 crédito)</span>
    </label>
  )
}
