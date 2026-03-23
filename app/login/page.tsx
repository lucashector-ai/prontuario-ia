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
      const res = await fetch('/api/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (data.medico) { localStorage.setItem('medico', JSON.stringify(data.medico)); router.push('/') }
      else setErro(data.error || 'E-mail ou senha incorretos')
    } catch { setErro('Erro de conexão') }
    finally { setCarregando(false) }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr',
        background: 'white', borderRadius: 20, overflow: 'hidden',
        width: '100%', maxWidth: 960,
        boxShadow: '0 8px 48px rgba(0,0,0,0.12)',
      }}>

        {/* Painel esquerdo — imagem */}
        <div style={{ position: 'relative', minHeight: 580 }}>
          <img
            src="/doctor.png"
            alt="Médico em consulta"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
          {/* Overlay escuro gradiente */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to top, rgba(6,78,59,0.92) 0%, rgba(6,78,59,0.4) 50%, rgba(0,0,0,0.1) 100%)',
          }}/>
          {/* Logo */}
          <div style={{ position: 'absolute', top: 28, left: 28, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
              </svg>
            </div>
            <span style={{ fontSize: 17, fontWeight: 700, color: 'white' }}>MedIA</span>
          </div>
          {/* Texto inferior */}
          <div style={{ position: 'absolute', bottom: 36, left: 32, right: 32 }}>
            <p style={{ fontSize: 20, fontWeight: 700, color: 'white', margin: '0 0 12px', lineHeight: 1.4 }}>
              "Reduzi 70% do tempo de documentação clínica."
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'white', flexShrink: 0 }}>DS</div>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: 'white', margin: 0 }}>Dr. Daniel Santos</p>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', margin: 0 }}>Clínico Geral — São Paulo</p>
              </div>
            </div>
          </div>
        </div>

        {/* Painel direito — formulário */}
        <div style={{ padding: '64px 56px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ maxWidth: 340 }}>
            <div style={{ marginBottom: 36 }}>
              <h1 style={{ fontSize: 26, fontWeight: 800, color: '#111827', margin: '0 0 8px', letterSpacing: '-0.5px' }}>
                Bem-vindo de volta
              </h1>
              <p style={{ fontSize: 14, color: '#6b7280', margin: 0, lineHeight: 1.6 }}>
                Entre na sua conta para continuar atendendo.
              </p>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 7 }}>E-mail</label>
                <input type="email" required value={form.email}
                  onChange={e => setForm(f => ({...f, email: e.target.value}))}
                  style={{ width: '100%', padding: '11px 14px', fontSize: 14, borderRadius: 10 }}
                  placeholder="seu@email.com.br"/>
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 7 }}>Senha</label>
                <input type="password" required value={form.senha}
                  onChange={e => setForm(f => ({...f, senha: e.target.value}))}
                  style={{ width: '100%', padding: '11px 14px', fontSize: 14, borderRadius: 10 }}
                  placeholder="••••••••"/>
              </div>

              {erro && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '10px 14px' }}>
                  <p style={{ fontSize: 13, color: '#dc2626', margin: 0 }}>{erro}</p>
                </div>
              )}

              <button type="submit" disabled={carregando} style={{
                marginTop: 4, padding: '13px', borderRadius: 10, border: 'none', cursor: 'pointer',
                background: carregando ? '#bbf7d0' : '#16a34a', color: 'white',
                fontSize: 14, fontWeight: 700, transition: 'all 0.15s',
                letterSpacing: '0.01em',
              }}>
                {carregando ? 'Entrando...' : 'Entrar'}
              </button>
            </form>

            <div style={{ marginTop: 28, paddingTop: 24, borderTop: '1px solid #f3f4f6' }}>
              <p style={{ textAlign: 'center', fontSize: 13, color: '#9ca3af', margin: 0 }}>
                Não tem conta?{' '}
                <a href="/cadastro" style={{ color: '#16a34a', textDecoration: 'none', fontWeight: 600 }}>
                  Criar conta gratuita →
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
