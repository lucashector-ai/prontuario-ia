'use client'

import { useEffect, useState } from 'react'

/**
 * Hook compatível com a convenção do projeto: clinica_id vive em localStorage,
 * setada pelo flow de login (clinica_admin ou medico).
 */
export function useClinicaId() {
  const [clinicaId, setClinicaId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    try {
      const ca = typeof window !== 'undefined' ? localStorage.getItem('clinica_admin') : null
      const med = typeof window !== 'undefined' ? localStorage.getItem('medico') : null
      let cid: string | null = null
      if (ca) cid = JSON.parse(ca).clinica_id
      else if (med) cid = JSON.parse(med).clinica_id
      setClinicaId(cid)
    } catch {
      setClinicaId(null)
    } finally {
      setLoading(false)
    }
  }, [])

  return { clinicaId, loading }
}
