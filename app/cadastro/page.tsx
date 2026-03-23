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
      const res = await fetch('/api/medicos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      const data = await res.json()
      if (data.medico) { setSucesso(true); setTimeout(() => router.push('/login'), 2000) }
      else setErro(data.error || 'Erro ao cadastrar')
    } catch { setErro('Erro de conexão') }
    finally { setCarregando(false) }
  }

  if (sucesso) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2"><path d="M20 6L9 17l-5-5"/></svg>
        </div>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)', margin: '0 0 8px' }}>Conta criada!</h2>
        <p style={{ fontSize: 14, color: 'var(--text3)', margin: 0 }}>Redirecionando para o login...</p>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: '0 0 6px' }}>Criar conta</h1>
          <p style={{ fontSize: 13, color: 'var(--text3)', margin: 0 }}>Comece a usar o MedIA gratuitamente</p>
        </div>

        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16, padding: 28 }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[
              { label: 'Nome completo', key: 'nome', type: 'text', placeholder: 'Dr. João Silva', required: true },
              { label: 'CRM', key: 'crm', type: 'text', placeholder: 'CRM/SP 123456', required: true },
              { label: 'Especialidade', key: 'especialidade', type: 'text', placeholder: 'Clínica Geral', required: false },
              { label: 'E-mail', key: 'email', type: 'email', placeholder: 'seu@email.com', required: true },
              { label: 'Senha', key: 'senha', type: 'password', placeholder: '••••••••', required: true },
            ].map(({ label, key, type, placeholder, required }) => (
              <div key={key}>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', display: 'block', marginBottom: 6, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  {label} {required && <span style={{ color: 'var(--accent2)' }}>*</span>}
                </label>
                <input type={type} required={required} value={(form as any)[key]}
                  onChange={e => setForm(f => ({...f, [key]: e.target.value}))}
                  style={{ width: '100%', padding: '10px 14px', fontSize: 13, borderRadius: 10 }}
                  placeholder={placeholder}/>
              </div>
            ))}
            {erro && (
              <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '10px 14px' }}>
                <p style={{ fontSize: 12, color: '#fca5a5', margin: 0 }}>{erro}</p>
              </div>
            )}
            <button type="submit" disabled={carregando}
              style={{ padding: '11px', borderRadius: 10, border: 'none', background: carregando ? 'var(--bg3)' : 'var(--accent)', color: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer', marginTop: 4 }}>
              {carregando ? 'Criando conta...' : 'Criar conta'}
            </button>
          </form>
          <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--text3)', marginTop: 20, marginBottom: 0 }}>
            Já tem conta?{' '}
            <a href="/login" style={{ color: 'var(--accent2)', textDecoration: 'none', fontWeight: 500 }}>Entrar</a>
          </p>
        </div>
      </div>
    </div>
  )
}
