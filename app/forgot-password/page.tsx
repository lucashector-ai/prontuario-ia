'use client'
import { useState } from 'react'
import Link from 'next/link'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [enviado, setEnviado] = useState(false)
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)

  async function enviar() {
    if (!email) return setErro('Digite seu email')
    setLoading(true); setErro('')
    try {
      const res = await fetch('/api/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (data.ok) setEnviado(true)
      else setErro(data.error || 'Email nao encontrado')
    } catch { setErro('Erro de conexao') }
    finally { setLoading(false) }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#EAECEF', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 16px' }}>
      <div style={{ background: 'white', borderRadius: 16, border: '1px solid #f0f0f0', padding: '40px 36px', width: '100%', maxWidth: 380 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ width: 48, height: 48, background: '#f0ebff', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
            <svg width="22" height="22" fill="none" stroke="#6043C1" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: 0 }}>Recuperar senha</h1>
          <p style={{ fontSize: 14, color: '#6b7280', margin: '6px 0 0' }}>Enviaremos um link para seu email</p>
        </div>
        {enviado ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, background: '#f0fdf4', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <svg width="32" height="32" fill="none" stroke="#16a34a" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            </div>
            <p style={{ fontSize: 16, fontWeight: 600, color: '#111827', margin: '0 0 4px' }}>Email enviado!</p>
            <p style={{ fontSize: 14, color: '#6b7280', margin: '0 0 20px' }}>Verifique sua caixa de entrada e spam.</p>
            <Link href="/login" style={{ color: '#6043C1', fontSize: 14, textDecoration: 'none' }}>← Voltar ao login</Link>
          </div>
        ) : (
          <>
            <input type="email" placeholder="seu@email.com" value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && enviar()}
              style={{ width: '100%', padding: '12px 16px', fontSize: 14, borderRadius: 10, border: '1.5px solid #e5e7eb', background: 'white', color: '#111827', boxSizing: 'border-box', marginBottom: 12 }} />
            {erro && <p style={{ fontSize: 13, color: '#dc2626', margin: '0 0 12px' }}>{erro}</p>}
            <button onClick={enviar} disabled={loading}
              style={{ width: '100%', padding: 14, borderRadius: 10, border: 'none', cursor: 'pointer', background: loading ? '#b9a9ef' : '#6043C1', color: 'white', fontSize: 15, fontWeight: 700, marginBottom: 12 }}>
              {loading ? 'Enviando...' : 'Enviar link de recuperacao'}
            </button>
            <div style={{ textAlign: 'center' }}>
              <Link href="/login" style={{ color: '#6b7280', fontSize: 14, textDecoration: 'none' }}>← Voltar ao login</Link>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
