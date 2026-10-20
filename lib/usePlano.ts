'use client'
/** Plano da clínica logada (clinicas.plano), com cache na sessão do navegador. */
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ehDemo } from '@/lib/demo'

const CHAVE = 'c360-plano'

export function usePlano() {
  // Começa "carregando" (igual no servidor e no navegador, sem erro de hidratação)
  const [plano, setPlano] = useState<string | null | undefined>(undefined)
  useEffect(() => {
    try { const v = sessionStorage.getItem(CHAVE); if (v !== null) setPlano(v || null) } catch {}
    let clinicaId: string | null = null
    try {
      if (ehDemo()) { setPlano(null); return }
      const ca = JSON.parse(localStorage.getItem('clinica_admin') || 'null')
      const m = JSON.parse(localStorage.getItem('medico') || 'null')
      clinicaId = ca?.clinica_id || m?.clinica_id || null
    } catch {}
    if (!clinicaId) return
    supabase.from('clinicas').select('plano').eq('id', clinicaId).maybeSingle().then(({ data, error }) => {
      if (error) return
      const p = (data as any)?.plano ?? null
      setPlano(p)
      try { sessionStorage.setItem(CHAVE, p || '') } catch {}
    })
  }, [])
  return plano // undefined = ainda carregando
}
