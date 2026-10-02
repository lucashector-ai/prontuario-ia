'use client'
import { useCallback, useEffect, useState } from 'react'
import { WifiOff, ServerCrash, RotateCw } from 'lucide-react'
import { tokens } from '@/lib/design-tokens'

const T = tokens
type Estado = 'ok' | 'offline' | 'servidor'

/**
 * Faixa de aviso quando não há internet ou o banco (Supabase) não responde.
 * Sem isso as telas só aparecem vazias, como se não houvesse dados.
 */
export function AvisoConexao() {
  const [estado, setEstado] = useState<Estado>('ok')
  const [checando, setChecando] = useState(false)

  const checar = useCallback(async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) { setEstado('offline'); return }
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!url) return
    setChecando(true)
    try {
      // no-cors: só queremos saber se o servidor é alcançável (DNS/rede); a resposta é opaca
      const ctrl = new AbortController()
      const t = setTimeout(() => ctrl.abort(), 8000)
      await fetch(url + '/auth/v1/health', { mode: 'no-cors', cache: 'no-store', signal: ctrl.signal })
      clearTimeout(t)
      setEstado('ok')
    } catch {
      setEstado('servidor')
    } finally {
      setChecando(false)
    }
  }, [])

  useEffect(() => {
    checar()
    const i = setInterval(checar, 30000)
    const on = () => checar()
    const off = () => setEstado('offline')
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { clearInterval(i); window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [checar])

  if (estado === 'ok') return null
  const offline = estado === 'offline'
  const I = offline ? WifiOff : ServerCrash
  return (
    <div role="alert" style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px 9px 14px', borderRadius: 12, flexShrink: 0,
      background: T.status.warningBg, border: '1px solid #F3D9AE', color: '#7A4A00', fontSize: 13,
    }}>
      <I size={16} strokeWidth={1.8} style={{ flexShrink: 0 }} />
      <span style={{ flex: 1, minWidth: 0, lineHeight: 1.4 }}>
        <strong style={{ fontWeight: 700 }}>{offline ? 'Você está sem internet.' : 'Sem conexão com o servidor de dados.'}</strong>{' '}
        {offline ? 'As informações vão atualizar quando a conexão voltar.' : 'As telas podem aparecer vazias até a conexão voltar.'}
      </span>
      <button onClick={checar} disabled={checando} style={{
        display: 'flex', alignItems: 'center', gap: 6, height: 30, padding: '0 10px', borderRadius: 8, border: '1px solid #EBC98E',
        background: '#fff', color: '#7A4A00', fontSize: 12.5, fontWeight: 600, cursor: checando ? 'wait' : 'pointer', fontFamily: 'inherit', flexShrink: 0,
      }}>
        <RotateCw size={13} style={{ animation: checando ? 'spin .8s linear infinite' : 'none' }} />Tentar novamente
      </button>
    </div>
  )
}
