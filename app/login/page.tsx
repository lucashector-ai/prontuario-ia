'use client'
import Link from 'next/link'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function Login() {
  const router = useRouter()
  const [form, setForm] = useState({ email: '', senha: '' })
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [showSenha, setShowSenha] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setCarregando(true); setErro('')
    try {
      const res = await fetch('/api/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (data.medico) { localStorage.setItem('medico', JSON.stringify(data.medico)); if (!data.medico.onboarding_concluido) { router.push('/onboarding') } else { router.push('/') } }
      else setErro(data.error || 'E-mail ou senha incorretos')
    } catch { setErro('Erro de conexão') }
    finally { setCarregando(false) }
  }

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden' }}>

      {/* Painel esquerdo — imagem ocupa metade da tela */}
      <div style={{ flex: '0 0 45%', position: 'relative', overflow: 'hidden' }}>
        <img
          src="/doctor.png"
          alt="Médico em consulta"
          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }}
        />
        {/* Overlay gradiente */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to top, rgba(4,47,31,0.95) 0%, rgba(5,60,40,0.5) 45%, rgba(0,0,0,0.15) 100%)',
        }}/>

        {/* Logo */}
        <div style={{ position: 'absolute', top: 32, left: 36, display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
            </svg>
          </div>
          <span style={{ fontSize: 18, fontWeight: 700, color: 'white', letterSpacing: '-0.3px' }}>MedIA</span>
        </div>

        {/* Texto na parte inferior */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 40px 48px' }}>
          <p style={{ fontSize: 22, fontWeight: 800, color: 'white', margin: '0 0 20px', lineHeight: 1.4, letterSpacing: '-0.3px' }}>
            "Reduzi 70% do tempo de documentação clínica com o MedIA."
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              background: 'rgba(255,255,255,0.2)', border: '1.5px solid rgba(255,255,255,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 700, color: 'white', flexShrink: 0,
            }}>DS</div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: 'white', margin: 0 }}>Dr. Daniel Santos</p>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', margin: 0 }}>Clínico Geral — São Paulo</p>
            </div>
          </div>
        </div>
      </div>

      {/* Painel direito — formulário ocupa o restante */}
      <div style={{
        flex: 1, background: 'white',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '48px 64px',
      }}>
        <div style={{ width: '100%', maxWidth: 380 }}>
          <div style={{ marginBottom: 40 }}>
            <h1 style={{ fontSize: 30, fontWeight: 800, color: '#111827', margin: '0 0 10px', letterSpacing: '-0.5px' }}>
              Bem-vindo de volta
            </h1>
            <p style={{ fontSize: 15, color: '#6b7280', margin: 0, lineHeight: 1.6 }}>
              Entre na sua conta para continuar atendendo seus pacientes.
            </p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 8 }}>E-mail</label>
              <input
                type="email" required value={form.email}
                onChange={e => setForm(f => ({...f, email: e.target.value}))}
                style={{ width: '100%', padding: '12px 16px', fontSize: 14, borderRadius: 10, border: '1.5px solid #e5e7eb', background: 'white', color: '#111827', transition: 'border-color 0.15s' }}
                placeholder="seu@email.com.br"
              />
            </div>

            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 8 }}>Senha</label>
              <div style={{ position: 'relative' }}>
              <input
                type={showSenha ? 'text' : 'password'} required value={form.senha}
                onChange={e => setForm(f => ({...f, senha: e.target.value}))}
                style={{ width: '100%', padding: '12px 16px', fontSize: 14, borderRadius: 10, border: '1.5px solid #e5e7eb', background: 'white', color: '#111827' }}
                placeholder="••••••••"
              />
              <button type="button" onClick={() => setShowSenha(s => !s)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 0, display: 'flex', alignItems: 'center' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">{showSenha ? <><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></> : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>}</svg>
              </button>
              </div>
            </div>

            <div style={{ textAlign: 'right', marginTop: -8 }}>
              <Link href="/forgot-password" style={{ fontSize: 13, color: '#1F9D5C', textDecoration: 'none' }}>Esqueceu sua senha?</Link>
            </div>

            {erro && (
              <div style={{ background: '#fef2f2', border: '1.5px solid #fecaca', borderRadius: 10, padding: '11px 16px' }}>
                <p style={{ fontSize: 13, color: '#dc2626', margin: 0, fontWeight: 500 }}>{erro}</p>
              </div>
            )}

            <button type="submit" disabled={carregando} style={{
              padding: '14px', borderRadius: 10, border: 'none', cursor: 'pointer',
              background: carregando ? '#b9a9ef' : '#1F9D5C',
              color: 'white', fontSize: 15, fontWeight: 700,
              letterSpacing: '0.01em', marginTop: 4,
              transition: 'background 0.15s',
            }}>
              {carregando ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          <div style={{ marginTop: 32, paddingTop: 28, borderTop: '1px solid #f3f4f6', textAlign: 'center' }}>
            <p style={{ fontSize: 13, color: '#9ca3af', margin: 0 }}>
              Acesso exclusivo para clínicas cadastradas.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
