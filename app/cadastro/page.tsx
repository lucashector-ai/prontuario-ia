'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function Cadastro() {
  const router = useRouter()
  const [form, setForm] = useState({ nome: '', crm: '', especialidade: '', email: '', senha: '' })
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState(false)
  const [carregando, setCarregando] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setCarregando(true); setErro('')
    try {
      const res = await fetch('/api/medicos', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (data.medico) { setSucesso(true); setTimeout(() => router.push('/login'), 2500) }
      else setErro(data.error || 'Erro ao cadastrar')
    } catch { setErro('Erro de conexão') }
    finally { setCarregando(false) }
  }

  if (sucesso) return (
    <div style={{ minHeight: '100vh', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'white', borderRadius: 20, padding: 48, textAlign: 'center', maxWidth: 400, boxShadow: '0 8px 48px rgba(0,0,0,0.12)' }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#f0fdf4', border: '2px solid #bbf7d0', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: '#111827', margin: '0 0 8px' }}>Conta criada com sucesso!</h2>
        <p style={{ fontSize: 14, color: '#6b7280', margin: 0 }}>Redirecionando para o login...</p>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr',
        background: 'white', borderRadius: 20, overflow: 'hidden',
        width: '100%', maxWidth: 960,
        boxShadow: '0 8px 48px rgba(0,0,0,0.12)',
      }}>

        {/* Painel esquerdo — imagem */}
        <div style={{ position: 'relative', minHeight: 640 }}>
          <img
            src="/doctor.png"
            alt="Médico em consulta"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to top, rgba(6,78,59,0.92) 0%, rgba(6,78,59,0.4) 55%, rgba(0,0,0,0.08) 100%)',
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
            <h2 style={{ fontSize: 22, fontWeight: 800, color: 'white', margin: '0 0 16px', lineHeight: 1.35 }}>
              Documentação clínica com inteligência artificial
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {['Prontuário SOAP automático', 'Transcrição em tempo real', 'Receita médica gerada por IA', 'Dados protegidos pela LGPD'].map(f => (
                <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#4ade80', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><path d="M20 6L9 17l-5-5"/></svg>
                  </div>
                  <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', fontWeight: 500 }}>{f}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Painel direito — formulário */}
        <div style={{ padding: '52px 52px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ maxWidth: 340 }}>
            <div style={{ marginBottom: 28 }}>
              <h1 style={{ fontSize: 24, fontWeight: 800, color: '#111827', margin: '0 0 8px', letterSpacing: '-0.5px' }}>
                Criar conta médica
              </h1>
              <p style={{ fontSize: 14, color: '#6b7280', margin: 0 }}>
                Preencha seus dados profissionais.
              </p>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
              {[
                { label: 'Nome completo', key: 'nome', type: 'text', placeholder: 'Dr. João Silva', required: true },
                { label: 'CRM', key: 'crm', type: 'text', placeholder: 'CRM/SP 123456', required: true },
                { label: 'Especialidade', key: 'especialidade', type: 'text', placeholder: 'Clínica Geral', required: false },
                { label: 'E-mail profissional', key: 'email', type: 'email', placeholder: 'dr.joao@email.com.br', required: true },
                { label: 'Senha', key: 'senha', type: 'password', placeholder: 'Mínimo 8 caracteres', required: true },
              ].map(({ label, key, type, placeholder, required }) => (
                <div key={key}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
                    {label}{required && <span style={{ color: '#16a34a', marginLeft: 3 }}>*</span>}
                  </label>
                  <input type={type} required={required} value={(form as any)[key]}
                    onChange={e => setForm(f => ({...f, [key]: e.target.value}))}
                    style={{ width: '100%', padding: '10px 13px', fontSize: 13, borderRadius: 9 }}
                    placeholder={placeholder}/>
                </div>
              ))}

              {erro && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 9, padding: '9px 13px' }}>
                  <p style={{ fontSize: 13, color: '#dc2626', margin: 0 }}>{erro}</p>
                </div>
              )}

              <button type="submit" disabled={carregando} style={{
                marginTop: 6, padding: '12px', borderRadius: 10, border: 'none', cursor: 'pointer',
                background: carregando ? '#bbf7d0' : '#16a34a', color: 'white',
                fontSize: 14, fontWeight: 700, letterSpacing: '0.01em',
              }}>
                {carregando ? 'Criando conta...' : 'Criar conta gratuita'}
              </button>
            </form>

            <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid #f3f4f6' }}>
              <p style={{ textAlign: 'center', fontSize: 13, color: '#9ca3af', margin: 0 }}>
                Já tem conta?{' '}
                <a href="/login" style={{ color: '#16a34a', textDecoration: 'none', fontWeight: 600 }}>
                  Entrar →
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
