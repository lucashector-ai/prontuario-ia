'use client'
import Link from 'next/link'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [form, setForm] = useState({ email: '', senha: '' })
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [carregandoGoogle, setCarregandoGoogle] = useState(false)
  const [showSenha, setShowSenha] = useState(false)

  useEffect(() => {
    if (searchParams?.get('cadastrado') === '1') {
      setSucesso('Conta criada com sucesso! Faça login pra entrar.')
    }
  }, [searchParams])

  const handleGoogle = async () => {
    setCarregandoGoogle(true); setErro('')
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/auth/callback` }
      })
      if (error) {
        setErro('Login com Google ainda não está configurado. Use seu e-mail e senha.')
        setCarregandoGoogle(false)
      }
    } catch {
      setErro('Login com Google ainda não está configurado.')
      setCarregandoGoogle(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setCarregando(true); setErro(''); setSucesso('')
    try {
      const res = await fetch('/api/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()

      if (!res.ok) { setErro(data.error || 'Erro ao entrar'); return }

      if (data.tipo === 'clinica') {
        localStorage.setItem('clinica_admin', JSON.stringify(data.admin))
        localStorage.setItem('clinica', JSON.stringify(data.clinica))
        localStorage.removeItem('medico')
        router.push('/dashboard')
        return
      }

      if (data.tipo === 'medico' && data.medico) {
        localStorage.setItem('medico', JSON.stringify(data.medico))
        if (data.clinica) localStorage.setItem('clinica', JSON.stringify(data.clinica))
        localStorage.removeItem('clinica_admin')

        if (data.precisa_trocar_senha) { router.push('/trocar-senha-obrigatoria'); return }
        if (!data.medico.onboarding_concluido) { router.push('/onboarding') }
        else { router.push('/') }
        return
      }

      setErro('Resposta inesperada do servidor')
    } catch {
      setErro('Erro de conexão')
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', width: '100vw' }}>
      <style>{`
        @media (max-width: 1024px) {
          .login-image-pane { display: none !important; }
          .login-form-pane { flex: 1 !important; }
        }
      `}</style>

      {/* Painel esquerdo - SÓ imagem */}
      <div className="login-image-pane" style={{ flex: '0 0 25%', position: 'relative' as const, overflow: 'hidden', background: '#fafafa' }}>
        <img
          src="/doctor.png"
          alt="Médico em consulta"
          style={{ width: '100%', height: '100%', objectFit: 'cover' as const, objectPosition: 'center' }}
        />
      </div>

      {/* Painel direito - form centralizado */}
      <div className="login-form-pane" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 60px', background: 'white' }}>
        <div style={{ width: '100%', maxWidth: 380 }}>

          {/* Logo Clinical 360 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 32 }}>
            <div style={{ width: 40, height: 40, background: '#6043C1', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
              </svg>
            </div>
            <span style={{ fontSize: 22, fontWeight: 700, color: '#0a0a0a', letterSpacing: '-0.02em' as const }}>Clinical 360</span>
          </div>

          {/* Título */}
          <div style={{ textAlign: 'center' as const, marginBottom: 28 }}>
            <h1 style={{ fontSize: 26, fontWeight: 600, color: '#0a0a0a', margin: '0 0 8px', letterSpacing: '-0.02em' as const }}>
              Bem-vindo de volta
            </h1>
            <p style={{ fontSize: 14, color: '#737373', margin: 0 }}>
              Entre na sua conta para continuar
            </p>
          </div>

          {/* Mensagens */}
          {sucesso && (
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d', padding: '10px 14px', borderRadius: 10, fontSize: 13, marginBottom: 16 }}>
              {sucesso}
            </div>
          )}
          {erro && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', padding: '10px 14px', borderRadius: 10, fontSize: 13, marginBottom: 16 }}>
              {erro}
            </div>
          )}

          {/* Botão Google */}
          <button
            onClick={handleGoogle}
            disabled={carregandoGoogle}
            style={{
              width: '100%', padding: '12px 16px', borderRadius: 10,
              background: 'white', color: '#0a0a0a', border: '1px solid #e5e5e5',
              fontSize: 14, fontWeight: 600, cursor: carregandoGoogle ? 'wait' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              transition: 'all 0.15s' as const, marginBottom: 16
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#fafafa'}
            onMouseLeave={e => e.currentTarget.style.background = 'white'}
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            {carregandoGoogle ? 'Conectando...' : 'Continuar com Google'}
          </button>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '18px 0' }}>
            <div style={{ flex: 1, height: 1, background: '#e5e5e5' }}/>
            <span style={{ fontSize: 12, color: '#a3a3a3', fontWeight: 500 }}>ou</span>
            <div style={{ flex: 1, height: 1, background: '#e5e5e5' }}/>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <input
              type="email"
              placeholder="seu@email.com"
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              required
              style={{
                width: '100%', padding: '12px 14px', borderRadius: 10,
                border: '1px solid #e5e5e5', fontSize: 14, color: '#0a0a0a',
                marginBottom: 12, outline: 'none', boxSizing: 'border-box' as const,
                transition: 'border 0.15s' as const,
              }}
              onFocus={e => e.target.style.borderColor = '#0a0a0a'}
              onBlur={e => e.target.style.borderColor = '#e5e5e5'}
            />

            <div style={{ position: 'relative' as const, marginBottom: 6 }}>
              <input
                type={showSenha ? 'text' : 'password'}
                placeholder="Senha"
                value={form.senha}
                onChange={e => setForm({ ...form, senha: e.target.value })}
                required
                style={{
                  width: '100%', padding: '12px 44px 12px 14px', borderRadius: 10,
                  border: '1px solid #e5e5e5', fontSize: 14, color: '#0a0a0a',
                  outline: 'none', boxSizing: 'border-box' as const,
                  transition: 'border 0.15s' as const,
                }}
                onFocus={e => e.target.style.borderColor = '#0a0a0a'}
                onBlur={e => e.target.style.borderColor = '#e5e5e5'}
              />
              <button
                type="button"
                onClick={() => setShowSenha(!showSenha)}
                aria-label={showSenha ? 'Ocultar senha' : 'Mostrar senha'}
                style={{
                  position: 'absolute' as const, right: 10, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', padding: 6,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                {showSenha ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#737373" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#737373" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                )}
              </button>
            </div>

            {/* Esqueceu */}
            <div style={{ textAlign: 'right' as const, marginBottom: 18 }}>
              <Link href="/esqueci-senha" style={{ fontSize: 12, color: '#6043C1', textDecoration: 'none', fontWeight: 500 }}>
                Esqueceu a senha?
              </Link>
            </div>

            <button
              type="submit"
              disabled={carregando}
              style={{
                width: '100%', padding: '13px', borderRadius: 10,
                background: '#0a0a0a', color: 'white', border: 'none',
                fontSize: 14, fontWeight: 600, cursor: carregando ? 'wait' : 'pointer',
                transition: 'all 0.15s' as const, marginBottom: 18,
              }}
            >
              {carregando ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          {/* Cadastro */}
          <p style={{ textAlign: 'center' as const, fontSize: 13, color: '#737373', margin: '0 0 20px' }}>
            Não tem conta?{' '}
            <Link href="/cadastro" style={{ color: '#6043C1', textDecoration: 'none', fontWeight: 600 }}>
              Cadastre sua clínica
            </Link>
          </p>

          {/* Termos */}
          <p style={{ textAlign: 'center' as const, fontSize: 11, color: '#a3a3a3', margin: 0, lineHeight: 1.5 }}>
            Ao entrar, você aceita nossos{' '}
            <Link href="/termos" style={{ color: '#737373', textDecoration: 'underline' }}>Termos</Link>
            {' '}e{' '}
            <Link href="/privacidade" style={{ color: '#737373', textDecoration: 'underline' }}>Privacidade</Link>.
          </p>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: 'white' }}/>}>
      <LoginForm/>
    </Suspense>
  )
}
