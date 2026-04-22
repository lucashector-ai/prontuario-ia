'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function HomePage() {
  const router = useRouter()

  useEffect(() => {
    try {
      // Prioridade 1: clínica admin
      const rawAdmin = localStorage.getItem('clinica_admin')
      if (rawAdmin) {
        const admin = JSON.parse(rawAdmin)
        if (!admin.onboarding_concluido) {
          router.replace('/onboarding')
        } else {
          router.replace('/admin')
        }
        return
      }

      // Prioridade 2: médico
      const rawMedico = localStorage.getItem('medico')
      if (rawMedico) {
        const medico = JSON.parse(rawMedico)
        if (!medico.onboarding_concluido) {
          router.replace('/onboarding')
        } else {
          router.replace('/dashboard')
        }
        return
      }

      // Nenhum dos dois: manda pro login
      router.replace('/login')
    } catch {
      router.replace('/login')
    }
  }, [router])

  return (
    <div style={{ minHeight: '100vh', background: '#F5F5F5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 32, height: 32, border: '2px solid #6043C1', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{"@keyframes spin { to { transform: rotate(360deg) } }"}</style>
    </div>
  )
}
