'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { SenhaStrength, senhaEhForte } from '@/components/SenhaStrength'

const ACCENT = '#1F9D5C'
const ACCENT_LIGHT = '#E8F7EF'
const BG = '#F5F5F5'

function ToggleSenha({ show, onToggle }: { show: boolean; onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle} style={{
      position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
      background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af',
      padding: 0, display: 'flex', alignItems: 'center',
    }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        {show ? (
          <>
            <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/>
            <line x1="1" y1="1" x2="23" y2="23"/>
          </>
        ) : (
          <>
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
          </>
        )}
      </svg>
    </button>
  )
}

export default function CadastroPage() {
  const router = useRouter()
  const [etapa, setEtapa] = useState<1 | 2>(1)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const [form, setForm] = useState({
    nome: '',
    email: '',
    telefone: '',
    nome_clinica: '',
    senha: '',
    senha_confirma: '',
  })
  const [showSenha, setShowSenha] = useState(false)

  const avancar = () => {
    setErro(null)
    if (!form.nome) return setErro('Preencha seu nome completo')
    if (!form.email) return setErro('Preencha o email')
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email)) return setErro('Email inválido')
    if (!form.nome_clinica) return setErro('Preencha o nome fantasia da clínica')
    setEtapa(2)
  }

  const cadastrar = async () => {
    setErro(null)
    if (!senhaEhForte(form.senha)) return setErro('Senha não atende aos critérios de segurança')
    if (form.senha !== form.senha_confirma) return setErro('Senhas não coincidem')

    setSalvando(true)
    try {
      const res = await fetch('/api/cadastro-clinica', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clinica: {
            nome: form.nome_clinica,
            email: form.email,
            telefone: form.telefone,
          },
          admin: {
            nome: form.nome,
            email: form.email,
            senha: form.senha,
          },
          medicos: [],
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao cadastrar')

      // Faz login automático via API de verificação (usa o token criado)
      const verifyRes = await fetch('/api/verificar-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: data.token_verificacao, tipo: 'admin' }),
      })
      const verifyData = await verifyRes.json()

      if (verifyData.ok && verifyData.tipo_conta === 'clinica') {
        localStorage.setItem('clinica_admin', JSON.stringify(verifyData.admin))
        localStorage.setItem('clinica', JSON.stringify(verifyData.clinica))
        localStorage.removeItem('medico')
        router.push('/onboarding')
      } else {
        router.push('/login')
      }
    } catch (e: any) {
      setErro(e.message)
    } finally {
      setSalvando(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 14px',
    fontSize: 14,
    borderRadius: 10,
    border: '1px solid #e5e7eb',
    background: 'white',
    outline: 'none',
    boxSizing: 'border-box',
    color: '#111827',
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 600,
    color: '#6b7280',
    display: 'block',
    marginBottom: 6,
  }

  return (
    <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 460 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12,
            background: ACCENT, display: 'inline-flex',
            alignItems: 'center', justifyContent: 'center',
            marginBottom: 12,
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
            </svg>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>MedIA</h1>
          <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>Prontuário inteligente com IA</p>
        </div>

        <div style={{ background: 'white', borderRadius: 16, padding: 32 }}>
          {/* Indicador de etapa */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
            <div style={{
              width: 24, height: 24, borderRadius: '50%',
              background: etapa >= 1 ? ACCENT : '#e5e7eb',
              color: etapa >= 1 ? 'white' : '#9ca3af',
              fontSize: 12, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>1</div>
            <div style={{ flex: 1, height: 2, background: etapa >= 2 ? ACCENT : '#e5e7eb' }}/>
            <div style={{
              width: 24, height: 24, borderRadius: '50%',
              background: etapa >= 2 ? ACCENT : '#e5e7eb',
              color: etapa >= 2 ? 'white' : '#9ca3af',
              fontSize: 12, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>2</div>
          </div>

          {erro && (
            <div style={{
              padding: '11px 14px', borderRadius: 10,
              background: '#fef2f2', color: '#991b1b',
              fontSize: 13, marginBottom: 16,
              border: '1px solid #fecaca',
            }}>
              {erro}
            </div>
          )}

          {etapa === 1 && (
            <>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>Vamos começar</h2>
              <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 24px' }}>Conta sobre você e sua clínica</p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={labelStyle}>Nome completo *</label>
                  <input value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} placeholder="Dr. João Silva" style={inputStyle} autoFocus/>
                </div>
                <div>
                  <label style={labelStyle}>Email *</label>
                  <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value.toLowerCase().trim() }))} placeholder="seu@email.com" style={inputStyle}/>
                </div>
                <div>
                  <label style={labelStyle}>Telefone</label>
                  <input value={form.telefone} onChange={e => setForm(p => ({ ...p, telefone: e.target.value }))} placeholder="(11) 99999-9999" style={inputStyle}/>
                </div>
                <div>
                  <label style={labelStyle}>Nome fantasia da clínica *</label>
                  <input value={form.nome_clinica} onChange={e => setForm(p => ({ ...p, nome_clinica: e.target.value }))} placeholder="Ex: Clínica São Paulo" style={inputStyle}/>
                </div>
              </div>

              <button onClick={avancar} style={{
                width: '100%', padding: 14, marginTop: 24,
                background: ACCENT, color: 'white',
                border: 'none', borderRadius: 10,
                fontSize: 14, fontWeight: 700, cursor: 'pointer',
              }}>
                Continuar
              </button>

              <p style={{ fontSize: 12, color: '#9ca3af', margin: '20px 0 0', textAlign: 'center' }}>
                Já tem conta? <a href="/login" style={{ color: ACCENT, fontWeight: 600, textDecoration: 'none' }}>Entrar</a>
              </p>
            </>
          )}

          {etapa === 2 && (
            <>
              <button onClick={() => setEtapa(1)} style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: 12, cursor: 'pointer', marginBottom: 12, padding: 0 }}>
                ← Voltar
              </button>

              <h2 style={{ fontSize: 17, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>Crie uma senha segura</h2>
              <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 24px' }}>Você vai usar pra acessar a plataforma</p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={labelStyle}>Senha *</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showSenha ? 'text' : 'password'}
                      value={form.senha}
                      onChange={e => setForm(p => ({ ...p, senha: e.target.value }))}
                      placeholder="Crie uma senha forte"
                      style={{ ...inputStyle, paddingRight: 40 }}
                      autoFocus
                    />
                    <ToggleSenha show={showSenha} onToggle={() => setShowSenha(s => !s)}/>
                  </div>
                  <SenhaStrength senha={form.senha}/>
                </div>
                <div>
                  <label style={labelStyle}>Confirmar senha *</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showSenha ? 'text' : 'password'}
                      value={form.senha_confirma}
                      onChange={e => setForm(p => ({ ...p, senha_confirma: e.target.value }))}
                      placeholder="Repita a senha"
                      style={{
                        ...inputStyle, paddingRight: 40,
                        borderColor: form.senha_confirma && form.senha !== form.senha_confirma ? '#fca5a5' : '#e5e7eb',
                      }}
                    />
                  </div>
                  {form.senha_confirma && form.senha !== form.senha_confirma && (
                    <p style={{ fontSize: 11, color: '#dc2626', margin: '4px 0 0' }}>Senhas não coincidem</p>
                  )}
                </div>
              </div>

              <button onClick={cadastrar} disabled={salvando} style={{
                width: '100%', padding: 14, marginTop: 24,
                background: salvando ? '#9ca3af' : ACCENT, color: 'white',
                border: 'none', borderRadius: 10,
                fontSize: 14, fontWeight: 700, cursor: salvando ? 'not-allowed' : 'pointer',
              }}>
                {salvando ? 'Criando sua conta...' : 'Criar conta'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
