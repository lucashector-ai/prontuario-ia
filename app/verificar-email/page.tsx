'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

const ACCENT = '#1F9D5C'

function VerificarContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<'carregando' | 'ok' | 'erro'>('carregando')
  const [mensagem, setMensagem] = useState('')

  useEffect(() => {
    const token = searchParams?.get('token')
    const tipo = searchParams?.get('tipo') || 'medico'

    if (!token) {
      setStatus('erro')
      setMensagem('Link inválido — token ausente')
      return
    }

    fetch('/api/verificar-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, tipo }),
    })
      .then(r => r.json())
      .then(data => {
        if (!data.ok) {
          setStatus('erro')
          setMensagem(data.error || 'Não foi possível verificar o email')
          return
        }

        // Auto-login: grava localStorage
        if (data.tipo_conta === 'clinica') {
          localStorage.setItem('clinica_admin', JSON.stringify(data.admin))
          localStorage.setItem('clinica', JSON.stringify(data.clinica))
          localStorage.removeItem('medico')
        } else {
          localStorage.setItem('medico', JSON.stringify(data.medico))
          if (data.clinica) localStorage.setItem('clinica', JSON.stringify(data.clinica))
          localStorage.removeItem('clinica_admin')
        }

        setStatus('ok')
        setMensagem('Email confirmado! Redirecionando...')

        // Clínica admin vai pro painel, médico vai pro onboarding
        setTimeout(() => {
          if (data.tipo_conta === 'clinica') {
            router.push('/admin')
          } else {
            router.push('/onboarding')
          }
        }, 1200)
      })
      .catch(() => {
        setStatus('erro')
        setMensagem('Erro de conexão')
      })
  }, [searchParams, router])

  return (
    <div style={{ minHeight: '100vh', background: '#F5F5F5', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: 'white', borderRadius: 16, padding: 48, maxWidth: 420, width: '100%', textAlign: 'center' }}>
        {status === 'carregando' && (
          <>
            <div style={{ width: 40, height: 40, border: `3px solid #E8F7EF`, borderTopColor: ACCENT, borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 20px' }}/>
            <p style={{ fontSize: 14, color: '#6b7280', margin: 0 }}>Confirmando sua conta...</p>
          </>
        )}
        {status === 'ok' && (
          <>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#E8F7EF', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: '0 0 8px' }}>Conta confirmada!</h1>
            <p style={{ fontSize: 13, color: '#6b7280', margin: 0, lineHeight: 1.6 }}>{mensagem}</p>
          </>
        )}
        {status === 'erro' && (
          <>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10"/>
                <line x1="15" y1="9" x2="9" y2="15"/>
                <line x1="9" y1="9" x2="15" y2="15"/>
              </svg>
            </div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: '0 0 8px' }}>Não foi possível verificar</h1>
            <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 24px', lineHeight: 1.6 }}>{mensagem}</p>
            <button onClick={() => router.push('/login')} style={{ padding: '12px 24px', background: 'white', color: '#374151', fontSize: 13, fontWeight: 600, borderRadius: 10, border: '1px solid #e5e7eb', cursor: 'pointer' }}>
              Voltar ao login
            </button>
          </>
        )}
      </div>
      <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
    </div>
  )
}

export default function VerificarEmailPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Carregando...</div>}>
      <VerificarContent />
    </Suspense>
  )
}
