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
        display: 'grid', gridTemplateColumns: '420px 1fr',
        background: 'white', borderRadius: 20,
        overflow: 'hidden', width: '100%', maxWidth: 900,
        boxShadow: '0 4px 32px rgba(0,0,0,0.08)',
      }}>

        {/* Painel esquerdo — visual */}
        <div style={{
          background: 'linear-gradient(160deg, #064e3b 0%, #065f46 50%, #047857 100%)',
          padding: '48px 40px', display: 'flex', flexDirection: 'column',
          justifyContent: 'space-between', position: 'relative', overflow: 'hidden',
        }}>
          {/* Círculos decorativos */}
          <div style={{ position: 'absolute', top: -60, right: -60, width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }}/>
          <div style={{ position: 'absolute', bottom: -40, left: -40, width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }}/>
          <div style={{ position: 'absolute', top: '40%', right: -30, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.03)' }}/>

          {/* Logo */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 48 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
                </svg>
              </div>
              <span style={{ fontSize: 18, fontWeight: 700, color: 'white' }}>MedIA</span>
            </div>

            {/* Destaque central */}
            <div style={{ marginBottom: 40 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 20, padding: '5px 14px', marginBottom: 20 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80' }}/>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', fontWeight: 500 }}>Plataforma certificada</span>
              </div>
              <h2 style={{ fontSize: 28, fontWeight: 800, color: 'white', margin: '0 0 14px', lineHeight: 1.3 }}>
                Documentação clínica com inteligência artificial
              </h2>
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.65)', margin: 0, lineHeight: 1.7 }}>
                Prontuário SOAP, prescrições e CIDs gerados automaticamente a partir da sua consulta.
              </p>
            </div>

            {/* Features */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { icon: '🎙', text: 'Transcrição em tempo real' },
                { icon: '📋', text: 'Prontuário SOAP estruturado' },
                { icon: '💊', text: 'Receita médica automática' },
                { icon: '🔒', text: 'Dados protegidos pela LGPD' },
              ].map(f => (
                <div key={f.text} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}>{f.icon}</div>
                  <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', fontWeight: 500 }}>{f.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Depoimento */}
          <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 14, padding: '18px 20px', border: '1px solid rgba(255,255,255,0.1)' }}>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', margin: '0 0 12px', lineHeight: 1.6, fontStyle: 'italic' }}>
              "Reduzi em 70% o tempo de documentação. O MedIA entende o vocabulário médico perfeitamente."
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: 'white' }}>DS</div>
              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: 'white', margin: 0 }}>Dr. Daniel Santos</p>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', margin: 0 }}>Clínica Geral — São Paulo</p>
              </div>
            </div>
          </div>
        </div>

        {/* Painel direito — formulário */}
        <div style={{ padding: '56px 52px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ maxWidth: 360 }}>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: '#111827', margin: '0 0 8px' }}>Bem-vindo de volta</h1>
            <p style={{ fontSize: 14, color: '#6b7280', margin: '0 0 36px' }}>
              Entre na sua conta para continuar.
            </p>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 7 }}>E-mail</label>
                <input type="email" required value={form.email}
                  onChange={e => setForm(f => ({...f, email: e.target.value}))}
                  style={{ width: '100%', padding: '11px 14px', fontSize: 14, borderRadius: 10 }}
                  placeholder="seu@email.com.br"/>
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Senha</label>
                </div>
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
                padding: '12px', borderRadius: 10, border: 'none', cursor: 'pointer',
                background: carregando ? '#d1fae5' : '#16a34a', color: 'white',
                fontSize: 14, fontWeight: 700, marginTop: 4, transition: 'all 0.15s',
              }}>
                {carregando ? 'Entrando...' : 'Entrar'}
              </button>
            </form>

            <p style={{ textAlign: 'center', fontSize: 13, color: '#9ca3af', marginTop: 28 }}>
              Não tem conta?{' '}
              <a href="/cadastro" style={{ color: '#16a34a', textDecoration: 'none', fontWeight: 600 }}>Criar conta gratuita</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
