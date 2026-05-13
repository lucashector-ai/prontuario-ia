'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export type MedicoSession = {
  id: string
  nome: string
  email?: string
  crm?: string
  especialidade?: string
  clinica_id?: string
  slug_publico?: string
  agenda_publica_ativa?: boolean
  agenda_publica_config?: any
}

export function useMedicoLogado() {
  const router = useRouter()
  const [medico, setMedico] = useState<MedicoSession | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    try {
      const raw = localStorage.getItem('medico')
      if (!raw) {
        router.replace('/login')
        return
      }
      const parsed = JSON.parse(raw)
      setMedico(parsed)
    } catch {
      router.replace('/login')
    } finally {
      setLoading(false)
    }
  }, [router])

  return { medico, setMedico, loading }
}
