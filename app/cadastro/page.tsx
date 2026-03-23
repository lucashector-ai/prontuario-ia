'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function Cadastro() {
  const router = useRouter()
  const [form, setForm] = useState({ nome: '', crm: '', especialidade: '', email: '', senha: '' })
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState(false)
  const [carregando, setCarregando] = useState(false)
  const [step, setStep] = useState(1)

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
      <div style={{ background: 'white', borderRadius: 20, padding: 48, textAlign: 'center', maxWidth: 400, boxShadow: '0 4px 32px rgba(0,0,0,0.08)' }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#f0fdf4', border: '2px solid #bbf7d0', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: '#111827', margin: '0 0 8px' }}>Conta criada!</h2>
        <p style={{ fontSize: 14, color: '#6b7280', margin: 0 }}>Redirecionando para o login...</p>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{
        display: 'grid', gridTemplateColumns: '420px 1fr',
        background: 'white', borderRadius: 20, overflow: 'hidden',
        width: '100%', maxWidth: 900,
        boxShadow: '0 4px 32px rgba(0,0,0,0.08)',
      }}>

        {/* Painel esquerdo */}
        <div style={{
          background: 'linear-gradient(160deg, #064e3b 0%, #065f46 50%, #047857 100%)',
          padding: '48px 40px', display: 'flex', flexDirection: 'column',
          justifyContent: 'space-between', position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', top: -60, right: -60, width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }}/>
          <div style={{ position: 'absolute', bottom: -40, left: -40, width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }}/>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 48 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
                </svg>
              </div>
              <span style={{ fontSize: 18, fontWeight: 700, color: 'white' }}>MedIA</span>
            </div>

            <h2 style={{ fontSize: 26, fontWeight: 800, color: 'white', margin: '0 0 14px', lineHeight: 1.3 }}>
              Comece a usar gratuitamente
            </h2>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.65)', margin: '0 0 36px', lineHeight: 1.7 }}>
              Crie sua conta em menos de 2 minutos e transforme sua documentação clínica.
            </p>

            {/* Steps */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[
                { n: 1, title: 'Dados profissionais', desc: 'Nome, CRM e especialidade' },
                { n: 2, title: 'Acesso à conta', desc: 'E-mail e senha segura' },
                { n: 3, title: 'Pronto para usar', desc: 'Acesso imediato ao sistema' },
              ].map(s => (
                <div key={s.n} style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                  <div style={{
                    width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                    background: s.n === 1 ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.15)',
                    border: '1px solid rgba(255,255,255,0.3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: 700,
                    color: s.n === 1 ? '#065f46' : 'rgba(255,255,255,0.7)',
                  }}>{s.n}</div>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: s.n === 1 ? 'white' : 'rgba(255,255,255,0.6)', margin: 0 }}>{s.title}</p>
                    <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', margin: '2px 0 0' }}>{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 14, padding: '16px 18px', border: '1px solid rgba(255,255,255,0.1)' }}>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', margin: '0 0 6px' }}>✓ Gratuito para começar</p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', margin: '0 0 6px' }}>✓ Sem cartão de crédito</p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', margin: 0 }}>✓ Dados protegidos pela LGPD</p>
          </div>
        </div>

        {/* Painel direito — formulário */}
        <div style={{ padding: '56px 52px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ maxWidth: 360 }}>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: '#111827', margin: '0 0 8px' }}>Criar conta médica</h1>
            <p style={{ fontSize: 14, color: '#6b7280', margin: '0 0 32px' }}>Preencha seus dados profissionais.</p>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { label: 'Nome completo', key: 'nome', type: 'text', placeholder: 'Dr. João Silva', required: true },
                { label: 'CRM', key: 'crm', type: 'text', placeholder: 'CRM/SP 123456', required: true },
                { label: 'Especialidade', key: 'especialidade', type: 'text', placeholder: 'Clínica Geral', required: false },
                { label: 'E-mail profissional', key: 'email', type: 'email', placeholder: 'dr.joao@clinica.com.br', required: true },
                { label: 'Senha', key: 'senha', type: 'password', placeholder: 'Mínimo 8 caracteres', required: true },
              ].map(({ label, key, type, placeholder, required }) => (
                <div key={key}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
                    {label}{required && <span style={{ color: '#16a34a', marginLeft: 2 }}>*</span>}
                  </label>
                  <input type={type} required={required} value={(form as any)[key]}
                    onChange={e => setForm(f => ({...f, [key]: e.target.value}))}
                    style={{ width: '100%', padding: '10px 14px', fontSize: 13, borderRadius: 10 }}
                    placeholder={placeholder}/>
                </div>
              ))}

              {erro && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '10px 14px' }}>
                  <p style={{ fontSize: 13, color: '#dc2626', margin: 0 }}>{erro}</p>
                </div>
              )}

              <button type="submit" disabled={carregando} style={{
                padding: '12px', borderRadius: 10, border: 'none', cursor: 'pointer',
                background: carregando ? '#d1fae5' : '#16a34a', color: 'white',
                fontSize: 14, fontWeight: 700, marginTop: 4,
              }}>
                {carregando ? 'Criando conta...' : 'Criar conta gratuita'}
              </button>
            </form>

            <p style={{ textAlign: 'center', fontSize: 13, color: '#9ca3af', marginTop: 24 }}>
              Já tem conta?{' '}
              <a href="/login" style={{ color: '#16a34a', textDecoration: 'none', fontWeight: 600 }}>Entrar</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
