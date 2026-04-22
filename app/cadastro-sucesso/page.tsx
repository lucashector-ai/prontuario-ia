'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

const ACCENT = '#6043C1'
const ACCENT_LIGHT = '#ede9fb'

function Content() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [copiado, setCopiado] = useState(false)

  const token = searchParams?.get('token') || ''
  const tipo = searchParams?.get('tipo') || 'medico'
  const email = searchParams?.get('email') || ''

  const linkVerificar = typeof window !== 'undefined'
    ? `${window.location.origin}/verificar-email?token=${token}&tipo=${tipo}`
    : ''

  useEffect(() => {
    if (!token) router.push('/login')
  }, [token, router])

  const copiarLink = () => {
    navigator.clipboard.writeText(linkVerificar)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  const irAgora = () => {
    router.push(`/verificar-email?token=${token}&tipo=${tipo}`)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F5F5F5', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: 'white', borderRadius: 16, padding: 40, maxWidth: 500, width: '100%', textAlign: 'center' }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: ACCENT_LIGHT, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
            <polyline points="22,6 12,13 2,6"/>
          </svg>
        </div>

        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: '0 0 8px' }}>Conta criada!</h1>
        <p style={{ fontSize: 14, color: '#6b7280', margin: '0 0 6px', lineHeight: 1.6 }}>
          Enviamos um link de confirmação para
        </p>
        <p style={{ fontSize: 14, fontWeight: 600, color: '#111827', margin: '0 0 28px', wordBreak: 'break-all' }}>{email}</p>

        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, padding: '16px 20px', marginBottom: 20, textAlign: 'left' }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#92400e', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>⚡ Modo desenvolvimento</p>
          <p style={{ fontSize: 12, color: '#92400e', margin: '0 0 12px', lineHeight: 1.6 }}>
            Ainda estamos integrando o envio de email. Por enquanto, use o link abaixo para confirmar sua conta:
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              readOnly
              value={linkVerificar}
              style={{
                flex: 1, padding: '8px 10px',
                fontSize: 10, fontFamily: 'monospace',
                border: '1px solid #fde68a', borderRadius: 6,
                background: 'white', color: '#92400e',
                outline: 'none', minWidth: 0,
              }}
            />
            <button onClick={copiarLink} style={{
              padding: '8px 12px', borderRadius: 6,
              background: copiado ? '#16a34a' : '#92400e', color: 'white',
              border: 'none', fontSize: 11, fontWeight: 600, cursor: 'pointer',
              flexShrink: 0,
            }}>
              {copiado ? '✓ Copiado' : 'Copiar'}
            </button>
          </div>
        </div>

        <button onClick={irAgora} style={{
          width: '100%', padding: '13px',
          background: ACCENT, color: 'white',
          border: 'none', borderRadius: 10,
          fontSize: 14, fontWeight: 700, cursor: 'pointer',
        }}>
          Confirmar conta agora →
        </button>

        <p style={{ fontSize: 12, color: '#9ca3af', margin: '20px 0 0' }}>
          O link expira em 48 horas
        </p>
      </div>
    </div>
  )
}

export default function CadastroSucesso() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Carregando...</div>}>
      <Content />
    </Suspense>
  )
}
