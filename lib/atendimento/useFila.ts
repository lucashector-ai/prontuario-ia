'use client'
/**
 * Fila do dia sempre atualizada: tempo real (Supabase) + verificação a cada 20s
 * (se o tempo real cair, nada fica parado) + aviso entre telas/abas.
 *
 *   const { fila, carregando, erro, recarregar } = useFila(medicoId)
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { carregarFila, ehDemo, ErroApi, EVENTO_FILA, type Fila } from './cliente'

function chaveClinica(): string | null {
  try {
    const ca = localStorage.getItem('clinica_admin')
    if (ca) return JSON.parse(ca).clinica_id || null
    const m = localStorage.getItem('medico')
    if (m) { const med = JSON.parse(m); return med.clinica_id || med.id || null }
  } catch {}
  return null
}

export function useFila(medicoId?: string | null, ativo = true) {
  const [fila, setFila] = useState<Fila | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<{ msg: string; faltaMigration: boolean } | null>(null)
  const versao = useRef(0)

  const recarregar = useCallback(async () => {
    const v = ++versao.current
    try {
      const f = await carregarFila(medicoId)
      if (v !== versao.current) return
      setFila(f); setErro(null)
    } catch (e: any) {
      if (v !== versao.current) return
      setErro({ msg: e?.message || 'Não foi possível carregar a fila.', faltaMigration: e instanceof ErroApi && e.faltaMigration })
    } finally {
      if (v === versao.current) setCarregando(false)
    }
  }, [medicoId])

  useEffect(() => {
    if (!ativo) return
    setCarregando(true)
    recarregar()

    // Várias mudanças seguidas (ex.: chamar = 2 updates) viram uma recarga só
    let timer: ReturnType<typeof setTimeout> | null = null
    const agendar = () => { if (timer) clearTimeout(timer); timer = setTimeout(recarregar, 250) }

    const intervalo = setInterval(() => { if (document.visibilityState === 'visible') recarregar() }, 20000)
    const onStorage = (e: StorageEvent) => { if (e.key?.startsWith('c360-demo-fila')) agendar() }
    window.addEventListener(EVENTO_FILA, agendar)
    window.addEventListener('storage', onStorage)
    window.addEventListener('focus', agendar)

    const clinica = !ehDemo() ? chaveClinica() : null
    const canal = clinica
      ? supabase.channel('fila-' + clinica + '-' + Math.random().toString(36).slice(2))
          .on('postgres_changes', { event: '*', schema: 'public', table: 'atendimentos', filter: `clinica_id=eq.${clinica}` }, agendar)
          .subscribe()
      : null

    return () => {
      if (timer) clearTimeout(timer)
      clearInterval(intervalo)
      window.removeEventListener(EVENTO_FILA, agendar)
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('focus', agendar)
      if (canal) supabase.removeChannel(canal)
    }
  }, [recarregar, ativo])

  return { fila, carregando, erro, recarregar }
}
