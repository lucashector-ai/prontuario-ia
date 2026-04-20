'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

type TipoConta = 'medico' | 'clinica' | null
type Passo = 'escolha' | 'plano' | 'dados' | 'sucesso'

const PLANOS = [
  { id: 'starter', nome: 'Starter', preco: 'R$ 97/mês', max: '1 médico', features: ['Prontuário SOAP com IA', 'Transcrição ilimitada', 'PDF de prontuário', 'Chat IA (WhatsApp)'], cor: '#1F9D5C', bg: '#f0ebff', border: '#A7E0BF' },
  { id: 'pro', nome: 'Pro', preco: 'R$ 247/mês', max: 'Até 10 médicos', features: ['Tudo do Starter', 'Chat multicanal (Instagram, Messenger)', 'Copiloto clínico avançado', 'Relatórios e métricas', 'Gestão de equipe'], cor: '#0d9488', bg: '#f0fdfa', border: '#99f6e4', destaque: true },
  { id: 'enterprise', nome: 'Enterprise', preco: 'R$ 697/mês', max: 'Médicos ilimitados', features: ['Tudo do Pro', 'API para integrações', 'Suporte dedicado', 'SLA garantido', 'Onboarding personalizado'], cor: '#d97706', bg: '#fffbeb', border: '#fde68a' },
]

export default function Cadastro() {
  const router = useRouter()
  const [tipo, setTipo] = useState<TipoConta>(null)
  const [passo, setPasso] = useState<Passo>('escolha')
  const [form, setForm] = useState({
    // Clínica
    nome_clinica: '', tipo_clinica: '', telefone_clinica: '',
    // Médico
    nome: '', crm: '', especialidade: '', email: '', senha: '', confirmar_senha: '',
    plano: 'pro',
  })
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [showSenha, setShowSenha] = useState(false)

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const requisitos = [
    { label: 'Mínimo 8 caracteres', ok: form.senha.length >= 8 },
    { label: 'Letra maiúscula', ok: /[A-Z]/.test(form.senha) },
    { label: 'Número', ok: /[0-9]/.test(form.senha) },
    { label: 'Senhas coincidem', ok: form.senha.length > 0 && form.senha === form.confirmar_senha },
  ]

  const criarConta = async () => {
    setErro(''); setCarregando(true)
    try {
      const res = await fetch('/api/medicos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: form.nome,
          crm: form.crm,
          especialidade: form.especialidade,
          email: form.email,
          senha: form.senha,
          nome_clinica: form.nome_clinica || `Clínica ${form.nome}`,
          tipo_conta: tipo,
          plano: form.plano,
        })
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      localStorage.setItem('medico', JSON.stringify(data.medico))
      setPasso('sucesso')
    } catch (e: any) {
      setErro(e.message)
    }
    setCarregando(false)
  }

  const s = { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }
  const inp = { padding: '11px 14px', borderRadius: 9, border: '1.5px solid #e5e7eb', outline: 'none', fontSize: 14, width: '100%', fontFamily: 'inherit', color: '#111827', background: 'white', transition: 'border-color 0.15s' }

  // PASSO: ESCOLHA
  if (passo === 'escolha') return (
    <div style={{ ...s, minHeight: '100vh', background: 'linear-gradient(135deg, #f8f7ff 0%, #f0fdf4 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ maxWidth: 600, width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{ width: 36, height: 36, background: '#1F9D5C', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
            </div>
            <span style={{ fontSize: 20, fontWeight: 700, color: '#111827' }}>MedIA</span>
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: '#111827', margin: '0 0 8px' }}>Criar conta</h1>
          <p style={{ fontSize: 16, color: '#6b7280', margin: 0 }}>Como você vai usar o MedIA?</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
          {/* Médico */}
          <div onClick={() => setTipo('medico')}
            style={{ background: 'white', borderRadius: 16, padding: 28, cursor: 'pointer', border: `2px solid ${tipo==='medico'?'#1F9D5C':'#e5e7eb'}`, transition: 'all 0.2s', boxShadow: tipo==='medico'?'0 0 0 4px rgba(96,67,193,0.1)':'none' }}>
            <div style={{ width: 52, height: 52, background: tipo==='medico'?'#1F9D5C':'#f0ebff', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={tipo==='medico'?'white':'#1F9D5C'} strokeWidth="1.8"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </div>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: '#111827', margin: '0 0 6px' }}>Médico</h3>
            <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 14px', lineHeight: 1.5 }}>Profissional autônomo ou em clínica. Prontuário, transcrição e Chat no seu nome.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {['✓ Prontuário IA', '✓ Transcrição de consultas', '✓ Chat com pacientes'].map(f => (
                <span key={f} style={{ fontSize: 12, color: '#6b7280' }}>{f}</span>
              ))}
            </div>
          </div>

          {/* Clínica */}
          <div onClick={() => setTipo('clinica')}
            style={{ background: 'white', borderRadius: 16, padding: 28, cursor: 'pointer', border: `2px solid ${tipo==='clinica'?'#0d9488':'#e5e7eb'}`, transition: 'all 0.2s', boxShadow: tipo==='clinica'?'0 0 0 4px rgba(13,148,136,0.1)':'none' }}>
            <div style={{ width: 52, height: 52, background: tipo==='clinica'?'#0d9488':'#f0fdfa', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={tipo==='clinica'?'white':'#0d9488'} strokeWidth="1.8"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            </div>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: '#111827', margin: '0 0 6px' }}>Clínica</h3>
            <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 14px', lineHeight: 1.5 }}>Organização com múltiplos médicos e atendentes. Gestão centralizada.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {['✓ Múltiplos médicos', '✓ Atendentes e equipe', '✓ Chat centralizado da clínica'].map(f => (
                <span key={f} style={{ fontSize: 12, color: '#6b7280' }}>{f}</span>
              ))}
            </div>
          </div>
        </div>

        <button onClick={() => tipo && setPasso('plano')} disabled={!tipo}
          style={{ width: '100%', padding: 14, borderRadius: 12, border: 'none', background: tipo?'#1F9D5C':'#e5e7eb', color: tipo?'white':'#9ca3af', fontSize: 15, fontWeight: 600, cursor: tipo?'pointer':'not-allowed', marginBottom: 16 }}>
          Continuar →
        </button>

        <p style={{ textAlign: 'center', fontSize: 13, color: '#6b7280', margin: 0 }}>
          Já tem conta? <a href="/login" style={{ color: '#1F9D5C', fontWeight: 600, textDecoration: 'none' }}>Entrar</a>
        </p>
      </div>
    </div>
  )

  // PASSO: PLANO
  if (passo === 'plano') return (
    <div style={{ ...s, minHeight: '100vh', background: 'linear-gradient(135deg, #f8f7ff 0%, #f0fdf4 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ maxWidth: 760, width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <button onClick={() => setPasso('escolha')} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 13, marginBottom: 12 }}>← Voltar</button>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: '#111827', margin: '0 0 8px' }}>Escolha seu plano</h2>
          <p style={{ fontSize: 14, color: '#6b7280', margin: 0 }}>Conta tipo: <strong>{tipo === 'medico' ? 'Médico' : 'Clínica'}</strong> · Cancele quando quiser</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 28 }}>
          {PLANOS.map(p => (
            <div key={p.id} onClick={() => set('plano', p.id)}
              style={{ background: 'white', borderRadius: 14, padding: 22, cursor: 'pointer', border: `2px solid ${form.plano===p.id?p.cor:'#e5e7eb'}`, position: 'relative', transition: 'all 0.2s', boxShadow: form.plano===p.id?`0 0 0 4px ${p.border}`:'none' }}>
              {p.destaque && <div style={{ position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)', background: p.cor, color: 'white', fontSize: 11, fontWeight: 700, padding: '3px 12px', borderRadius: 20 }}>MAIS POPULAR</div>}
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>{p.nome}</h3>
              <p style={{ fontSize: 20, fontWeight: 800, color: p.cor, margin: '0 0 4px' }}>{p.preco}</p>
              <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 14px' }}>{p.max}</p>
              {p.features.map(f => <p key={f} style={{ fontSize: 12, color: '#374151', margin: '0 0 4px' }}>✓ {f}</p>)}
            </div>
          ))}
        </div>

        <button onClick={() => setPasso('dados')}
          style={{ width: '100%', padding: 14, borderRadius: 12, border: 'none', background: '#1F9D5C', color: 'white', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
          Continuar com plano {PLANOS.find(p=>p.id===form.plano)?.nome} →
        </button>
      </div>
    </div>
  )

  // PASSO: DADOS
  if (passo === 'dados') return (
    <div style={{ ...s, minHeight: '100vh', background: 'linear-gradient(135deg, #f8f7ff 0%, #f0fdf4 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ maxWidth: 520, width: '100%', background: 'white', borderRadius: 20, padding: 36 }}>
        <button onClick={() => setPasso('plano')} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 13, marginBottom: 16 }}>← Voltar</button>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: '#111827', margin: '0 0 4px' }}>
          {tipo === 'clinica' ? 'Dados da clínica' : 'Seus dados'}
        </h2>
        <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 24px' }}>
          {tipo === 'clinica' ? 'Você será o administrador da clínica' : 'Crie sua conta de médico'}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {tipo === 'clinica' && (
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Nome da clínica *</label>
              <input value={form.nome_clinica} onChange={e => set('nome_clinica', e.target.value)} style={inp} placeholder="Ex: Clínica São Lucas"/>
            </div>
          )}

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
              {tipo === 'clinica' ? 'Seu nome (administrador)' : 'Nome completo'} *
            </label>
            <input value={form.nome} onChange={e => set('nome', e.target.value)} style={inp} placeholder="Dr. João Silva"/>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>CRM *</label>
              <input value={form.crm} onChange={e => set('crm', e.target.value)} style={inp} placeholder="CRM/SP 123456"/>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Especialidade</label>
              <input value={form.especialidade} onChange={e => set('especialidade', e.target.value)} style={inp} placeholder="Clínica Geral"/>
            </div>
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>E-mail *</label>
            <input type="email" value={form.email} onChange={e => set('email', e.target.value)} style={inp} placeholder="seu@email.com"/>
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Senha *</label>
            <div style={{ position: 'relative' }}>
              <input type={showSenha?'text':'password'} value={form.senha} onChange={e => set('senha', e.target.value)} style={{ ...inp, paddingRight: 40 }} placeholder="Mínimo 8 caracteres"/>
              <button onClick={() => setShowSenha(v=>!v)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 12 }}>
                {showSenha ? 'Ocultar' : 'Ver'}
              </button>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              {requisitos.map(r => (
                <span key={r.label} style={{ fontSize: 11, color: r.ok?'#16a34a':'#9ca3af', display: 'flex', alignItems: 'center', gap: 3 }}>
                  {r.ok ? '✓' : '○'} {r.label}
                </span>
              ))}
            </div>
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Confirmar senha *</label>
            <input type="password" value={form.confirmar_senha} onChange={e => set('confirmar_senha', e.target.value)} style={inp} placeholder="Repita a senha"/>
          </div>
        </div>

        {erro && <div style={{ marginTop: 14, padding: '10px 14px', borderRadius: 8, background: '#fef2f2', color: '#dc2626', fontSize: 13, border: '1px solid #fecaca' }}>{erro}</div>}

        <button onClick={criarConta} disabled={carregando || !form.nome || !form.email || !form.senha || form.senha !== form.confirmar_senha}
          style={{ width: '100%', marginTop: 20, padding: 14, borderRadius: 12, border: 'none', background: (!form.nome||!form.email||!form.senha||form.senha!==form.confirmar_senha)?'#e5e7eb':'#1F9D5C', color: (!form.nome||!form.email||!form.senha)?'#9ca3af':'white', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
          {carregando ? 'Criando conta...' : `Criar ${tipo === 'clinica' ? 'conta da clínica' : 'minha conta'}`}
        </button>

        <p style={{ textAlign: 'center', fontSize: 12, color: '#9ca3af', margin: '16px 0 0' }}>
          Ao criar sua conta você aceita os <a href="#" style={{ color: '#1F9D5C' }}>Termos de Uso</a> e <a href="#" style={{ color: '#1F9D5C' }}>Política de Privacidade</a>
        </p>
      </div>
    </div>
  )

  // SUCESSO
  return (
    <div style={{ ...s, minHeight: '100vh', background: 'linear-gradient(135deg, #f8f7ff 0%, #f0fdf4 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ maxWidth: 440, width: '100%', background: 'white', borderRadius: 20, padding: 40, textAlign: 'center' }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>🎉</div>
        <h2 style={{ fontSize: 24, fontWeight: 800, color: '#111827', margin: '0 0 8px' }}>
          {tipo === 'clinica' ? 'Clínica criada!' : 'Bem-vindo ao MedIA!'}
        </h2>
        <p style={{ fontSize: 15, color: '#6b7280', margin: '0 0 28px', lineHeight: 1.6 }}>
          {tipo === 'clinica'
            ? 'Sua clínica foi criada. Agora você pode convidar médicos e configurar o Chat.'
            : 'Sua conta foi criada. Comece fazendo sua primeira consulta ou configurando o Chat.'}
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button onClick={() => router.push('/dashboard')} style={{ padding: 14, borderRadius: 12, border: 'none', background: '#1F9D5C', color: 'white', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
            Ir para o Dashboard
          </button>
          {tipo === 'clinica' && (
            <button onClick={() => router.push('/minha-clinica')} style={{ padding: 14, borderRadius: 12, border: '1px solid #e5e7eb', background: 'white', color: '#374151', fontSize: 15, cursor: 'pointer' }}>
              Configurar minha clínica →
            </button>
          )}
          <button onClick={() => router.push('/whatsapp-app')} style={{ padding: 14, borderRadius: 12, border: '1px solid #e5e7eb', background: 'white', color: '#374151', fontSize: 15, cursor: 'pointer' }}>
            Configurar Chat →
          </button>
        </div>
      </div>
    </div>
  )
}
