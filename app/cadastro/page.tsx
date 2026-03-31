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
    <div style={{ height: '100vh', background: '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#f0fdf4', border: '2px solid #d4c9f7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#6043C1" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
        </div>
        <h2 style={{ fontSize: 24, fontWeight: 800, color: '#111827', margin: '0 0 8px' }}>Conta criada!</h2>
        <p style={{ fontSize: 14, color: '#6b7280', margin: 0 }}>Redirecionando para o login...</p>
      </div>
    </div>
  )

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden' }}>

      {/* Painel esquerdo — imagem */}
      <div style={{ flex: '0 0 45%', position: 'relative', overflow: 'hidden' }}>
        <img
          src="/doctor.png"
          alt="Médico em consulta"
          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }}
        />
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to top, rgba(4,47,31,0.96) 0%, rgba(5,60,40,0.55) 45%, rgba(0,0,0,0.15) 100%)',
        }}/>

        {/* Logo */}
        <div style={{ position: 'absolute', top: 32, left: 36, display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
            </svg>
          </div>
          <span style={{ fontSize: 18, fontWeight: 700, color: 'white', letterSpacing: '-0.3px' }}>MedIA</span>
        </div>

        {/* Texto inferior */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 40px 48px' }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: 'white', margin: '0 0 20px', lineHeight: 1.4, letterSpacing: '-0.3px' }}>
            Documentação clínica com inteligência artificial
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              'Prontuário SOAP gerado automaticamente',
              'Transcrição em tempo real da consulta',
              'Receita médica com um clique',
              'Dados protegidos pela LGPD',
            ].map(f => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#6043C1', border: '1px solid #4ade80', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><path d="M20 6L9 17l-5-5"/></svg>
                </div>
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', fontWeight: 500 }}>{f}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Painel direito — formulário */}
      <div style={{
        flex: 1, background: 'white',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '48px 64px', overflow: 'auto',
      }}>
        <div style={{ width: '100%', maxWidth: 380 }}>
          <div style={{ marginBottom: 32 }}>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: '#111827', margin: '0 0 10px', letterSpacing: '-0.5px' }}>
              Criar conta médica
            </h1>
            <p style={{ fontSize: 14, color: '#6b7280', margin: 0, lineHeight: 1.6 }}>
              Preencha seus dados para começar gratuitamente.
            </p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[
              { label: 'Nome completo', key: 'nome', type: 'text', placeholder: 'Dr. João Silva', required: true },
              { label: 'CRM', key: 'crm', type: 'text', placeholder: 'CRM/SP 123456', required: true },
              { label: 'Especialidade', key: 'especialidade', type: 'text', placeholder: 'Clínica Geral', required: false },
              { label: 'E-mail profissional', key: 'email', type: 'email', placeholder: 'dr.joao@email.com.br', required: true },
              { label: 'Senha', key: 'senha', type: 'password', placeholder: 'Mínimo 8 caracteres', required: true },
            ].map(({ label, key, type, placeholder, required }) => (
              <div key={key}>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 7 }}>
                  {label}{required && <span style={{ color: '#6043C1', marginLeft: 3 }}>*</span>}
                </label>
                <input
                  type={type} required={required} value={(form as any)[key]}
                  onChange={e => setForm(f => ({...f, [key]: e.target.value}))}
                  style={{ width: '100%', padding: '11px 15px', fontSize: 14, borderRadius: 10, border: '1.5px solid #e5e7eb', background: 'white', color: '#111827' }}
                  placeholder={placeholder}
                />
              </div>
            ))}

            {erro && (
              <div style={{ background: '#fef2f2', border: '1.5px solid #fecaca', borderRadius: 10, padding: '10px 14px' }}>
                <p style={{ fontSize: 13, color: '#dc2626', margin: 0, fontWeight: 500 }}>{erro}</p>
              </div>
            )}

            <button type="submit" disabled={carregando} style={{
              marginTop: 4, padding: '13px', borderRadius: 10, border: 'none', cursor: 'pointer',
              background: carregando ? '#86efac' : '#6043C1',
              color: 'white', fontSize: 15, fontWeight: 700, letterSpacing: '0.01em',
            }}>
              {carregando ? 'Criando conta...' : 'Criar conta gratuita'}
            </button>
          </form>

          <div style={{ marginTop: 28, paddingTop: 24, borderTop: '1px solid #f3f4f6', textAlign: 'center' }}>
            <p style={{ fontSize: 14, color: '#9ca3af', margin: 0 }}>
              Já tem conta?{' '}
              <a href="/login" style={{ color: '#6043C1', textDecoration: 'none', fontWeight: 700 }}>
                Entrar →
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
