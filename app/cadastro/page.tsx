'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Passo = 1 | 2 | 3 | 4

const PLANOS = [
  { id: 'starter', nome: 'Starter', preco: 'R$ 97/mês', max: 'Até 3 médicos', features: ['Prontuário SOAP com IA', 'Transcrição ilimitada', 'PDF de prontuário', 'Histórico de pacientes'], cor: '#6043C1', bg: '#f0ebff', border: '#d4c9f7' },
  { id: 'pro', nome: 'Pro', preco: 'R$ 247/mês', max: 'Até 10 médicos', features: ['Tudo do Starter', 'WhatsApp IA ativo', 'Copiloto clínico avançado', 'Insights de negócio', 'Gestão de equipe'], cor: '#0d9488', bg: '#f0fdfa', border: '#99f6e4', destaque: true },
  { id: 'enterprise', nome: 'Enterprise', preco: 'R$ 697/mês', max: 'Médicos ilimitados', features: ['Tudo do Pro', 'API para integrações', 'Suporte dedicado', 'SLA garantido', 'Onboarding personalizado'], cor: '#d97706', bg: '#fffbeb', border: '#fde68a' },
]

export default function Cadastro() {
  const router = useRouter()
  const [passo, setPasso] = useState<Passo>(1)
  const [form, setForm] = useState({
    nome_clinica: '', tipo_clinica: '',
    nome: '', crm: '', especialidade: '', email: '', senha: '', confirmar_senha: '',
    plano: 'starter',
  })
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [showSenha, setShowSenha] = useState(false)
  const [showConfirmar, setShowConfirmar] = useState(false)
  const [sucesso, setSucesso] = useState(false)

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const requisitos = [
    { label: 'Mínimo 8 caracteres', ok: form.senha.length >= 8 },
    { label: 'Letra maiúscula', ok: /[A-Z]/.test(form.senha) },
    { label: 'Número', ok: /[0-9]/.test(form.senha) },
    { label: 'Caractere especial', ok: /[^A-Za-z0-9]/.test(form.senha) },
    { label: 'Senhas coincidem', ok: form.senha.length > 0 && form.senha === form.confirmar_senha },
  ]



  const avancar = () => {
    setErro('')
    if (passo === 1) {
      if (!form.nome_clinica.trim()) return setErro('Nome da clínica é obrigatório')
      setPasso(2)
    } else if (passo === 2) {
      if (!form.nome.trim() || !form.email.trim() || !form.senha) return setErro('Nome, e-mail e senha são obrigatórios')
      if (form.senha.length < 8) return setErro('Senha deve ter pelo menos 8 caracteres')
      if (form.senha !== form.confirmar_senha) return setErro('As senhas não coincidem')
      if (!form.crm.trim()) return setErro('CRM é obrigatório')
      setPasso(3)
    } else if (passo === 3) {
      setPasso(4)
    }
  }

  const handleSubmit = async () => {
    setCarregando(true); setErro('')
    try {
      const res = await fetch('/api/medicos', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: form.nome, crm: form.crm, especialidade: form.especialidade, email: form.email, senha: form.senha, nome_clinica: form.nome_clinica, plano: form.plano }),
      })
      const data = await res.json()
      if (data.medico) { setSucesso(true); setTimeout(() => router.push('/login'), 3000) }
      else setErro(data.error || 'Erro ao criar conta')
    } catch { setErro('Erro de conexão') }
    finally { setCarregando(false) }
  }

  const TIPOS = ['Clínica geral', 'Consultório solo', 'Clínica especializada', 'Hospital', 'Centro médico', 'Outro']

  const Lado = () => (
    <div style={{ flex: '0 0 42%', position: 'relative', overflow: 'hidden' }}>
      <img src="/doctor.png" alt="MedIA" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }}/>
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(4,47,31,0.96) 0%, rgba(5,60,40,0.55) 45%, rgba(0,0,0,0.15) 100%)' }}/>
      <div style={{ position: 'absolute', top: 32, left: 36, display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
        </div>
        <span style={{ fontSize: 18, fontWeight: 700, color: 'white' }}>MedIA</span>
      </div>
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 40px 48px' }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: 'white', margin: '0 0 20px', lineHeight: 1.4 }}>A plataforma de prontuário inteligente para clínicas modernas</h2>
        {['Prontuário SOAP gerado com IA', 'Transcrição em tempo real', 'Gestão completa da equipe', 'Dados seguros — LGPD'].map(f => (
          <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#6043C1', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><path d="M20 6L9 17l-5-5"/></svg>
            </div>
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', fontWeight: 500 }}>{f}</span>
          </div>
        ))}
      </div>
    </div>
  )

  if (sucesso) return (
    <div style={{ height: '100vh', background: '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', maxWidth: 400 }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#f0ebff', border: '2px solid #d4c9f7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#6043C1" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
        </div>
        <h2 style={{ fontSize: 26, fontWeight: 800, color: '#111827', margin: '0 0 10px' }}>Clínica criada com sucesso!</h2>
        <p style={{ fontSize: 14, color: '#6b7280', margin: '0 0 6px' }}>Sua conta de administrador foi configurada.</p>
        <p style={{ fontSize: 13, color: '#9ca3af' }}>Redirecionando para o login...</p>
      </div>
    </div>
  )

  const progresso = ((passo - 1) / 3) * 100

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden' }}>
      <Lado />
      <div style={{ flex: 1, background: 'white', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Progress bar */}
        <div style={{ height: 3, background: '#f3f4f6' }}>
          <div style={{ height: '100%', width: progresso + '%', background: '#6043C1', transition: 'width 0.4s ease' }}/>
        </div>

        <div style={{ flex: 1, overflow: 'auto', display: 'flex', alignItems: passo === 3 ? 'flex-start' : 'center', justifyContent: 'center', padding: '40px 64px' }}>
          <div style={{ width: '100%', maxWidth: passo === 3 ? 560 : 400 }}>

            {/* Step indicator */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 32 }}>
              {[1,2,3,4].map(s => (
                <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, background: s < passo ? '#6043C1' : s === passo ? '#f0ebff' : '#f3f4f6', color: s < passo ? 'white' : s === passo ? '#6043C1' : '#9ca3af', border: s === passo ? '2px solid #6043C1' : 'none' }}>
                    {s < passo ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><path d="M20 6L9 17l-5-5"/></svg> : s}
                  </div>
                  {s < 4 && <div style={{ width: 32, height: 2, background: s < passo ? '#6043C1' : '#f3f4f6', borderRadius: 1 }}/>}
                </div>
              ))}
              <span style={{ fontSize: 12, color: '#9ca3af', marginLeft: 8 }}>Passo {passo} de 4</span>
            </div>

            {/* PASSO 1 - Dados da clínica */}
            {passo === 1 && (
              <div>
                <h1 style={{ fontSize: 26, fontWeight: 800, color: '#111827', margin: '0 0 8px' }}>Sua clínica</h1>
                <p style={{ fontSize: 14, color: '#6b7280', margin: '0 0 32px', lineHeight: 1.6 }}>Vamos começar com as informações da sua clínica ou consultório.</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                  <div>
                    <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 7 }}>Nome da clínica <span style={{ color: '#6043C1' }}>*</span></label>
                    <input value={form.nome_clinica} onChange={e => set('nome_clinica', e.target.value)} placeholder="Ex: Clínica São Lucas" style={{ width: '100%', padding: '12px 16px', fontSize: 14, borderRadius: 10, border: '1.5px solid #e5e7eb', boxSizing: 'border-box' as const }}/>
                  </div>
                  <div>
                    <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 7 }}>Tipo de estabelecimento</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      {TIPOS.map(t => (
                        <button key={t} onClick={() => set('tipo_clinica', t)} style={{ padding: '10px 12px', borderRadius: 8, border: `1.5px solid ${form.tipo_clinica === t ? '#6043C1' : '#e5e7eb'}`, background: form.tipo_clinica === t ? '#f0ebff' : 'white', color: form.tipo_clinica === t ? '#6043C1' : '#374151', fontSize: 13, fontWeight: form.tipo_clinica === t ? 600 : 400, cursor: 'pointer', textAlign: 'left' as const }}>{t}</button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* PASSO 2 - Dados do médico admin */}
            {passo === 2 && (
              <div>
                <h1 style={{ fontSize: 26, fontWeight: 800, color: '#111827', margin: '0 0 8px' }}>Sua conta</h1>
                <p style={{ fontSize: 14, color: '#6b7280', margin: '0 0 32px', lineHeight: 1.6 }}>Você será o administrador da clínica <strong>{form.nome_clinica}</strong>.</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {[
                    { label: 'Nome completo', key: 'nome', type: 'text', placeholder: 'Dr. João Silva', req: true },
                    { label: 'CRM', key: 'crm', type: 'text', placeholder: 'CRM/SP 123456', req: true },
                    { label: 'Especialidade', key: 'especialidade', type: 'text', placeholder: 'Ex: Clínica Geral', req: false },
                    { label: 'E-mail profissional', key: 'email', type: 'email', placeholder: 'dr.joao@email.com.br', req: true },
                    { label: 'Senha', key: 'senha', type: 'password', placeholder: 'Mínimo 8 caracteres', req: true },
                    { label: 'Confirmar senha', key: 'confirmar_senha', type: 'password', placeholder: 'Repita a senha', req: true },
                  ].map(f => (
                    <div key={f.key}>
                      <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>{f.label}{f.req && <span style={{ color: '#6043C1', marginLeft: 3 }}>*</span>}</label>
                      <div style={{ position: 'relative' }}>
                        <input
                          type={f.type === 'password' ? (f.key === 'confirmar_senha' ? (showConfirmar ? 'text' : 'password') : (showSenha ? 'text' : 'password')) : f.type}
                          value={(form as any)[f.key]}
                          onChange={e => set(f.key, e.target.value)}
                          placeholder={f.placeholder}
                          style={{ width: '100%', padding: '11px 15px', paddingRight: f.type === 'password' ? 42 : 15, fontSize: 14, borderRadius: 10, border: '1.5px solid #e5e7eb', boxSizing: 'border-box' as const }}
                        />
                        {f.type === 'password' && (
                          <button type="button" onClick={() => f.key === 'confirmar_senha' ? setShowConfirmar(s => !s) : setShowSenha(s => !s)}
                            style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 0, display: 'flex' }}>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              {(f.key === 'confirmar_senha' ? showConfirmar : showSenha) ? <><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></> : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>}
                            </svg>
                          </button>
                        )}
                      </div>
                      {f.key === 'senha' && form.senha.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
                          {requisitos.map(r => (
                            <span key={r.label} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 500, color: r.ok ? '#16a34a' : '#9ca3af', background: r.ok ? '#f0fdf4' : '#f9fafb', border: `1px solid ${r.ok ? '#bbf7d0' : '#e5e7eb'}`, padding: '3px 8px', borderRadius: 20, transition: 'all 0.2s' }}>
                              {r.ok ? '✓' : '○'} {r.label}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* PASSO 3 - Plano */}
            {passo === 3 && (
              <div>
                <h1 style={{ fontSize: 26, fontWeight: 800, color: '#111827', margin: '0 0 8px' }}>Escolha seu plano</h1>
                <p style={{ fontSize: 14, color: '#6b7280', margin: '0 0 32px', lineHeight: 1.6 }}>Você pode mudar de plano a qualquer momento dentro da plataforma.</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {PLANOS.map(p => (
                    <div key={p.id} onClick={() => set('plano', p.id)} style={{ padding: '16px 20px', borderRadius: 12, border: `2px solid ${form.plano === p.id ? p.cor : '#e5e7eb'}`, background: form.plano === p.id ? p.bg : 'white', cursor: 'pointer', transition: 'all 0.15s' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 20, height: 20, borderRadius: '50%', border: `2px solid ${form.plano === p.id ? p.cor : '#d1d5db'}`, background: form.plano === p.id ? p.cor : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {form.plano === p.id && <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'white' }}/>}
                          </div>
                          <span style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>{p.nome}</span>
                          {p.destaque && <span style={{ fontSize: 10, fontWeight: 700, color: p.cor, background: p.bg, border: `1px solid ${p.border}`, padding: '2px 8px', borderRadius: 10 }}>Mais popular</span>}
                        </div>
                        <div style={{ textAlign: 'right' as const }}>
                          <span style={{ fontSize: 16, fontWeight: 800, color: p.cor }}>{p.preco}</span>
                          <p style={{ fontSize: 11, color: '#9ca3af', margin: 0 }}>{p.max}</p>
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 6, paddingLeft: 30 }}>
                        {p.features.map(f => (
                          <span key={f} style={{ fontSize: 11, color: '#6b7280' }}>✓ {f}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* PASSO 4 - Confirmação */}
            {passo === 4 && (
              <div>
                <h1 style={{ fontSize: 26, fontWeight: 800, color: '#111827', margin: '0 0 8px' }}>Confirme seus dados</h1>
                <p style={{ fontSize: 14, color: '#6b7280', margin: '0 0 28px' }}>Tudo certo? Revise antes de criar sua conta.</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {[
                    { label: 'Clínica', valor: form.nome_clinica + (form.tipo_clinica ? ' · ' + form.tipo_clinica : '') },
                    { label: 'Médico admin', valor: form.nome },
                    { label: 'CRM', valor: form.crm },
                    { label: 'Especialidade', valor: form.especialidade || '—' },
                    { label: 'E-mail', valor: form.email },
                    { label: 'Plano', valor: PLANOS.find(p => p.id === form.plano)?.nome + ' — ' + PLANOS.find(p => p.id === form.plano)?.preco },
                  ].map(r => (
                    <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f3f4f6' }}>
                      <span style={{ fontSize: 13, color: '#9ca3af', fontWeight: 500 }}>{r.label}</span>
                      <span style={{ fontSize: 13, color: '#111827', fontWeight: 600, textAlign: 'right' as const, maxWidth: 220, wordBreak: 'break-word' as const }}>{r.valor}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Erro */}
            {erro && (
              <div style={{ marginTop: 16, background: '#fef2f2', border: '1.5px solid #fecaca', borderRadius: 10, padding: '10px 14px' }}>
                <p style={{ fontSize: 13, color: '#dc2626', margin: 0, fontWeight: 500 }}>{erro}</p>
              </div>
            )}

            {/* Botões de navegação */}
            <div style={{ display: 'flex', gap: 10, marginTop: 28 }}>
              {passo > 1 && (
                <button onClick={() => setPasso(p => (p - 1) as Passo)} style={{ flex: 1, padding: '13px', borderRadius: 10, border: '1.5px solid #e5e7eb', background: 'white', color: '#374151', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                  Voltar
                </button>
              )}
              {passo < 4 ? (
                <button onClick={avancar} style={{ flex: 2, padding: '13px', borderRadius: 10, border: 'none', background: '#6043C1', color: 'white', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                  Continuar →
                </button>
              ) : (
                <button onClick={handleSubmit} disabled={carregando} style={{ flex: 2, padding: '13px', borderRadius: 10, border: 'none', background: carregando ? '#b9a9ef' : '#6043C1', color: 'white', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                  {carregando ? 'Criando conta...' : 'Criar minha conta →'}
                </button>
              )}
            </div>

            <div style={{ marginTop: 24, textAlign: 'center' as const }}>
              <p style={{ fontSize: 13, color: '#9ca3af', margin: 0 }}>
                Já tem conta?{' '}
                <a href="/login" style={{ color: '#6043C1', textDecoration: 'none', fontWeight: 700 }}>Entrar →</a>
              </p>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
