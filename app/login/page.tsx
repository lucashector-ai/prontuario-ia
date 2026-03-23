'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function Login() {
  const router = useRouter()
  const [form, setForm] = useState({ email: '', senha: '' })
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setCarregando(true); setErro('')
    try {
      const res = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      const data = await res.json()
      if (data.medico) { localStorage.setItem('medico', JSON.stringify(data.medico)); router.push('/') }
      else setErro(data.error || 'Erro ao fazer login')
    } catch { setErro('Erro de conexão') }
    finally { setCarregando(false) }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: '0 0 6px' }}>MedIA</h1>
          <p style={{ fontSize: 14, color: 'var(--text3)', margin: 0 }}>Prontuário clínico inteligente</p>
        </div>

        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16, padding: 28 }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text3)', display: 'block', marginBottom: 8, letterSpacing: '0.04em', textTransform: 'uppercase' }}>E-mail</label>
              <input type="email" required value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))}
                style={{ width: '100%', padding: '10px 14px', fontSize: 14, borderRadius: 10 }}
                placeholder="seu@email.com"/>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text3)', display: 'block', marginBottom: 8, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Senha</label>
              <input type="password" required value={form.senha} onChange={e => setForm(f => ({...f, senha: e.target.value}))}
                style={{ width: '100%', padding: '10px 14px', fontSize: 14, borderRadius: 10 }}
                placeholder="••••••••"/>
            </div>
            {erro && (
              <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '10px 14px' }}>
                <p style={{ fontSize: 12, color: '#fca5a5', margin: 0 }}>{erro}</p>
              </div>
            )}
            <button type="submit" disabled={carregando}
              style={{ padding: '11px', borderRadius: 10, border: 'none', background: carregando ? 'var(--bg3)' : 'var(--accent)', color: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer', marginTop: 4 }}>
              {carregando ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
          <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--text3)', marginTop: 20, marginBottom: 0 }}>
            Não tem conta?{' '}
            <a href="/cadastro" style={{ color: 'var(--accent2)', textDecoration: 'none', fontWeight: 500 }}>Cadastre-se</a>
          </p>
        </div>
      </div>
    </div>
  )
}
