'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const ACCENT = '#1F9D5C'
const ACCENT_LIGHT = '#E8F7EF'
const BG = '#F5F5F5'

type MedicoExtra = { nome: string; email: string; senha: string; crm: string; especialidade: string }

export default function CadastroPage() {
  const router = useRouter()
  const [etapa, setEtapa] = useState<'escolher' | 'clinica' | 'autonomo'>('escolher')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  // Form clínica
  const [clinicaForm, setClinicaForm] = useState({
    nome: '', email: '', telefone: '',
    adminNome: '', adminEmail: '', adminSenha: '',
  })
  const [medicosExtras, setMedicosExtras] = useState<MedicoExtra[]>([])

  // Form autônomo
  const [autonomoForm, setAutonomoForm] = useState({
    nome: '', email: '', senha: '',
    crm: '', especialidade: '', empresa_nome: '', telefone: '',
  })

  const addMedico = () => {
    setMedicosExtras(prev => [...prev, { nome: '', email: '', senha: '', crm: '', especialidade: '' }])
  }

  const removeMedico = (i: number) => {
    setMedicosExtras(prev => prev.filter((_, idx) => idx !== i))
  }

  const updateMedico = (i: number, campo: keyof MedicoExtra, valor: string) => {
    setMedicosExtras(prev => prev.map((m, idx) => idx === i ? { ...m, [campo]: valor } : m))
  }

  const cadastrarClinica = async () => {
    setErro(null)
    if (!clinicaForm.nome || !clinicaForm.email) return setErro('Preencha nome e email da clínica')
    if (!clinicaForm.adminEmail || !clinicaForm.adminSenha) return setErro('Preencha email e senha do admin')
    if (clinicaForm.adminSenha.length < 6) return setErro('Senha do admin precisa ter ao menos 6 caracteres')

    setSalvando(true)
    try {
      const res = await fetch('/api/cadastro-clinica', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clinica: { nome: clinicaForm.nome, email: clinicaForm.email, telefone: clinicaForm.telefone },
          admin: { nome: clinicaForm.adminNome, email: clinicaForm.adminEmail, senha: clinicaForm.adminSenha },
          medicos: medicosExtras.filter(m => m.nome && m.email && m.senha),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao cadastrar')
      router.push('/login?cadastrado=1')
    } catch (e: any) {
      setErro(e.message)
    } finally {
      setSalvando(false)
    }
  }

  const cadastrarAutonomo = async () => {
    setErro(null)
    if (!autonomoForm.nome || !autonomoForm.email || !autonomoForm.senha) return setErro('Preencha nome, email e senha')
    if (autonomoForm.senha.length < 6) return setErro('Senha precisa ter ao menos 6 caracteres')
    if (!autonomoForm.empresa_nome) return setErro('Preencha o nome da empresa/consultório')

    setSalvando(true)
    try {
      const res = await fetch('/api/cadastro-autonomo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(autonomoForm),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao cadastrar')
      router.push('/login?cadastrado=1')
    } catch (e: any) {
      setErro(e.message)
    } finally {
      setSalvando(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '11px 14px',
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
      <div style={{ width: '100%', maxWidth: etapa === 'clinica' ? 640 : 480 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12,
            background: ACCENT, display: 'inline-flex',
            alignItems: 'center', justifyContent: 'center',
            marginBottom: 12,
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 18 L4 6 L10 6 L12 9 L20 9 L20 18 Z"/>
            </svg>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>MedIA</h1>
          <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>Prontuário inteligente com IA</p>
        </div>

        {erro && (
          <div style={{
            padding: '12px 16px', borderRadius: 10,
            background: '#fef2f2', color: '#991b1b',
            fontSize: 13, marginBottom: 16,
            border: '1px solid #fecaca',
          }}>
            {erro}
          </div>
        )}

        {etapa === 'escolher' && (
          <div style={{ background: 'white', borderRadius: 16, padding: 32 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: '#111827', margin: '0 0 6px', textAlign: 'center' }}>Como vamos começar?</h2>
            <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 28px', textAlign: 'center' }}>Escolha o tipo de conta que faz sentido pra você</p>

            <button onClick={() => setEtapa('clinica')} style={{
              width: '100%', padding: 20, background: 'white',
              border: '2px solid #e5e7eb', borderRadius: 12,
              cursor: 'pointer', marginBottom: 12, textAlign: 'left' as const,
              transition: 'border-color 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = ACCENT}
            onMouseLeave={e => e.currentTarget.style.borderColor = '#e5e7eb'}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 10,
                  background: ACCENT_LIGHT, color: ACCENT,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
                    <polyline points="9 22 9 12 15 12 15 22"/>
                  </svg>
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: '0 0 3px' }}>Sou uma clínica ou hospital</p>
                  <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>Gerencio uma equipe de médicos e quero controle administrativo</p>
                </div>
              </div>
            </button>

            <button onClick={() => setEtapa('autonomo')} style={{
              width: '100%', padding: 20, background: 'white',
              border: '2px solid #e5e7eb', borderRadius: 12,
              cursor: 'pointer', textAlign: 'left' as const,
              transition: 'border-color 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = ACCENT}
            onMouseLeave={e => e.currentTarget.style.borderColor = '#e5e7eb'}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 10,
                  background: ACCENT_LIGHT, color: ACCENT,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z"/>
                  </svg>
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: '0 0 3px' }}>Sou médico autônomo</p>
                  <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>Atendo por conta própria no meu consultório ou empresa</p>
                </div>
              </div>
            </button>

            <p style={{ fontSize: 12, color: '#9ca3af', margin: '24px 0 0', textAlign: 'center' }}>
              Já tem conta? <a href="/login" style={{ color: ACCENT, fontWeight: 600, textDecoration: 'none' }}>Entrar</a>
            </p>
          </div>
        )}

        {etapa === 'clinica' && (
          <div style={{ background: 'white', borderRadius: 16, padding: 32 }}>
            <button onClick={() => setEtapa('escolher')} style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: 12, cursor: 'pointer', marginBottom: 16, padding: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
              ← Voltar
            </button>

            <h2 style={{ fontSize: 17, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>Cadastro de clínica</h2>
            <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 24px' }}>Dados da clínica e do administrador</p>

            <div style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: '#374151', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Dados da clínica</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Nome da clínica *</label>
                  <input value={clinicaForm.nome} onChange={e => setClinicaForm(p => ({ ...p, nome: e.target.value }))} placeholder="Ex: Clínica São Paulo" style={inputStyle}/>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Email de contato *</label>
                    <input type="email" value={clinicaForm.email} onChange={e => setClinicaForm(p => ({ ...p, email: e.target.value }))} placeholder="contato@clinica.com.br" style={inputStyle}/>
                  </div>
                  <div>
                    <label style={labelStyle}>Telefone</label>
                    <input value={clinicaForm.telefone} onChange={e => setClinicaForm(p => ({ ...p, telefone: e.target.value }))} placeholder="(11) 3333-4444" style={inputStyle}/>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: '#374151', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Administrador principal</h3>
              <p style={{ fontSize: 12, color: '#9ca3af', margin: '0 0 12px' }}>Quem vai gerenciar a clínica no sistema</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Nome</label>
                  <input value={clinicaForm.adminNome} onChange={e => setClinicaForm(p => ({ ...p, adminNome: e.target.value }))} placeholder="Ex: João Silva" style={inputStyle}/>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Email de login *</label>
                    <input type="email" value={clinicaForm.adminEmail} onChange={e => setClinicaForm(p => ({ ...p, adminEmail: e.target.value }))} placeholder="admin@clinica.com.br" style={inputStyle}/>
                  </div>
                  <div>
                    <label style={labelStyle}>Senha *</label>
                    <input type="password" value={clinicaForm.adminSenha} onChange={e => setClinicaForm(p => ({ ...p, adminSenha: e.target.value }))} placeholder="Mín 6 caracteres" style={inputStyle}/>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: '#374151', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Médicos da clínica</h3>
              <p style={{ fontSize: 12, color: '#9ca3af', margin: '0 0 12px' }}>Adicione médicos que vão atender (opcional — pode adicionar depois)</p>

              {medicosExtras.map((m, i) => (
                <div key={i} style={{ background: '#F9FAFB', borderRadius: 12, padding: 16, marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: '#374151', margin: 0 }}>Médico {i + 1}</p>
                    <button onClick={() => removeMedico(i)} style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>Remover</button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <input value={m.nome} onChange={e => updateMedico(i, 'nome', e.target.value)} placeholder="Nome completo" style={{ ...inputStyle, padding: '8px 12px', fontSize: 13 }}/>
                    <input value={m.email} onChange={e => updateMedico(i, 'email', e.target.value)} placeholder="Email" type="email" style={{ ...inputStyle, padding: '8px 12px', fontSize: 13 }}/>
                    <input value={m.senha} onChange={e => updateMedico(i, 'senha', e.target.value)} placeholder="Senha" type="password" style={{ ...inputStyle, padding: '8px 12px', fontSize: 13 }}/>
                    <input value={m.crm} onChange={e => updateMedico(i, 'crm', e.target.value)} placeholder="CRM (opcional)" style={{ ...inputStyle, padding: '8px 12px', fontSize: 13 }}/>
                    <input value={m.especialidade} onChange={e => updateMedico(i, 'especialidade', e.target.value)} placeholder="Especialidade" style={{ ...inputStyle, padding: '8px 12px', fontSize: 13, gridColumn: '1 / -1' }}/>
                  </div>
                </div>
              ))}

              <button onClick={addMedico} style={{
                width: '100%', padding: 14,
                background: ACCENT_LIGHT, color: ACCENT,
                border: `1px dashed ${ACCENT}`, borderRadius: 10,
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
                Adicionar médico{medicosExtras.length > 0 ? ' (+)' : ''}
              </button>
            </div>

            <button onClick={cadastrarClinica} disabled={salvando} style={{
              width: '100%', padding: 14,
              background: salvando ? '#9ca3af' : ACCENT, color: 'white',
              border: 'none', borderRadius: 10,
              fontSize: 14, fontWeight: 700, cursor: salvando ? 'not-allowed' : 'pointer',
            }}>
              {salvando ? 'Cadastrando...' : 'Criar conta da clínica'}
            </button>
          </div>
        )}

        {etapa === 'autonomo' && (
          <div style={{ background: 'white', borderRadius: 16, padding: 32 }}>
            <button onClick={() => setEtapa('escolher')} style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: 12, cursor: 'pointer', marginBottom: 16, padding: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
              ← Voltar
            </button>

            <h2 style={{ fontSize: 17, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>Cadastro de médico autônomo</h2>
            <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 24px' }}>Seus dados e dados do seu consultório</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={labelStyle}>Nome completo *</label>
                <input value={autonomoForm.nome} onChange={e => setAutonomoForm(p => ({ ...p, nome: e.target.value }))} placeholder="Ex: Dr. João Silva" style={inputStyle}/>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Email *</label>
                  <input type="email" value={autonomoForm.email} onChange={e => setAutonomoForm(p => ({ ...p, email: e.target.value }))} placeholder="joao@email.com" style={inputStyle}/>
                </div>
                <div>
                  <label style={labelStyle}>Senha *</label>
                  <input type="password" value={autonomoForm.senha} onChange={e => setAutonomoForm(p => ({ ...p, senha: e.target.value }))} placeholder="Mín 6 caracteres" style={inputStyle}/>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>CRM</label>
                  <input value={autonomoForm.crm} onChange={e => setAutonomoForm(p => ({ ...p, crm: e.target.value }))} placeholder="CRM/SP 123456" style={inputStyle}/>
                </div>
                <div>
                  <label style={labelStyle}>Especialidade</label>
                  <input value={autonomoForm.especialidade} onChange={e => setAutonomoForm(p => ({ ...p, especialidade: e.target.value }))} placeholder="Ex: Clínico Geral" style={inputStyle}/>
                </div>
              </div>
              <div>
                <label style={labelStyle}>Nome da empresa/consultório *</label>
                <input value={autonomoForm.empresa_nome} onChange={e => setAutonomoForm(p => ({ ...p, empresa_nome: e.target.value }))} placeholder="Ex: Consultório Dr. João Silva" style={inputStyle}/>
              </div>
              <div>
                <label style={labelStyle}>Telefone</label>
                <input value={autonomoForm.telefone} onChange={e => setAutonomoForm(p => ({ ...p, telefone: e.target.value }))} placeholder="(11) 99999-9999" style={inputStyle}/>
              </div>
            </div>

            <button onClick={cadastrarAutonomo} disabled={salvando} style={{
              width: '100%', padding: 14, marginTop: 24,
              background: salvando ? '#9ca3af' : ACCENT, color: 'white',
              border: 'none', borderRadius: 10,
              fontSize: 14, fontWeight: 700, cursor: salvando ? 'not-allowed' : 'pointer',
            }}>
              {salvando ? 'Cadastrando...' : 'Criar minha conta'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
