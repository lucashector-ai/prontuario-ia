'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function HomePage() {
  const router = useRouter()

  useEffect(() => {
    try {
      const raw = localStorage.getItem('medico')
      if (!raw) { router.replace('/login'); return }
      const medico = JSON.parse(raw)
      if (!medico.onboarding_concluido) {
        router.replace('/onboarding')
      } else {
        router.replace('/dashboard')
      }
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
