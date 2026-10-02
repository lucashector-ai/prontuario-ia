'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { SenhaStrength, senhaEhForte } from '@/components/SenhaStrength'
import { tokens } from '@/lib/design-tokens'

import { Marca } from '@/components/Marca'
import { Eye, EyeOff, ArrowLeft } from 'lucide-react'
import { Input, Button } from '@/components/ui'
const ACCENT = tokens.brand.primary
const ACCENT_LIGHT = tokens.brand.primaryLighter
const BG = tokens.bg.page

function ToggleSenha({ show, onToggle }: { show: boolean; onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle} style={{
      position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
      background: 'none', border: 'none', cursor: 'pointer', color: tokens.text.tertiary,
      padding: 0, display: 'flex', alignItems: 'center',
    }} aria-label={show ? 'Ocultar senha' : 'Mostrar senha'}>
      {show ? <EyeOff size={16} strokeWidth={1.6} /> : <Eye size={16} strokeWidth={1.6} />}
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

  // Input do DS (raio 12, borda #EBEAEF, foco lilás) — só ajusta altura/fonte
  const inputStyle: React.CSSProperties = { minHeight: 44, fontSize: 14 }

  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 600,
    color: tokens.text.secondary,
    display: 'block',
    marginBottom: 6,
  }

  return (
    <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 460 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Marca altura={30} style={{ margin: '0 auto 10px' }} />
          <p style={{ fontSize: 13, color: tokens.text.secondary, margin: 0 }}>Prontuário inteligente com IA</p>
        </div>

        <div style={{ background: 'white', border: `1px solid ${tokens.border.subtle}`, borderRadius: 20, padding: 32 }}>
          {/* Indicador de etapa */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
            <div style={{
              width: 24, height: 24, borderRadius: '50%',
              background: etapa >= 1 ? ACCENT : tokens.border.default,
              color: etapa >= 1 ? 'white' : tokens.text.tertiary,
              fontSize: 12, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>1</div>
            <div style={{ flex: 1, height: 2, background: etapa >= 2 ? ACCENT : tokens.border.default }}/>
            <div style={{
              width: 24, height: 24, borderRadius: '50%',
              background: etapa >= 2 ? ACCENT : tokens.border.default,
              color: etapa >= 2 ? 'white' : tokens.text.tertiary,
              fontSize: 12, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>2</div>
          </div>

          {erro && (
            <div style={{
              padding: '10px 12px', borderRadius: 12,
              background: tokens.status.dangerBg, color: tokens.status.danger,
              fontSize: 13, marginBottom: 16,
            }}>
              {erro}
            </div>
          )}

          {etapa === 1 && (
            <>
              <h2 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-.02em', color: tokens.text.primary, margin: '0 0 4px' }}>Vamos começar</h2>
              <p style={{ fontSize: 13.5, color: tokens.text.quaternary, margin: '0 0 24px' }}>Conta sobre você e sua clínica</p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={labelStyle}>Nome completo *</label>
                  <Input value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} placeholder="Dr. João Silva" style={inputStyle} autoFocus/>
                </div>
                <div>
                  <label style={labelStyle}>Email *</label>
                  <Input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value.toLowerCase().trim() }))} placeholder="seu@email.com" style={inputStyle}/>
                </div>
                <div>
                  <label style={labelStyle}>Telefone</label>
                  <Input value={form.telefone} onChange={e => setForm(p => ({ ...p, telefone: e.target.value }))} placeholder="(11) 99999-9999" style={inputStyle}/>
                </div>
                <div>
                  <label style={labelStyle}>Nome fantasia da clínica *</label>
                  <Input value={form.nome_clinica} onChange={e => setForm(p => ({ ...p, nome_clinica: e.target.value }))} placeholder="Ex: Clínica São Paulo" style={inputStyle}/>
                </div>
              </div>

              <Button size="lg" block onClick={avancar} style={{ marginTop: 24 }}>
                Continuar
              </Button>

              <p style={{ fontSize: 12, color: tokens.text.tertiary, margin: '20px 0 0', textAlign: 'center' }}>
                Já tem conta? <a href="/login" style={{ color: ACCENT, fontWeight: 600, textDecoration: 'none' }}>Entrar</a>
              </p>
            </>
          )}

          {etapa === 2 && (
            <>
              <button onClick={() => setEtapa(1)} style={{ background: 'none', border: 'none', color: tokens.text.secondary, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', marginBottom: 12, padding: 0, display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: 'inherit' }}>
                <ArrowLeft size={14} strokeWidth={1.6} /> Voltar
              </button>

              <h2 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-.02em', color: tokens.text.primary, margin: '0 0 4px' }}>Crie uma senha segura</h2>
              <p style={{ fontSize: 13.5, color: tokens.text.quaternary, margin: '0 0 24px' }}>Você vai usar pra acessar a plataforma</p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={labelStyle}>Senha *</label>
                  <div style={{ position: 'relative' }}>
                    <Input
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
                    <Input
                      type={showSenha ? 'text' : 'password'}
                      value={form.senha_confirma}
                      onChange={e => setForm(p => ({ ...p, senha_confirma: e.target.value }))}
                      placeholder="Repita a senha"
                      style={{
                        ...inputStyle, paddingRight: 40,
                        borderColor: form.senha_confirma && form.senha !== form.senha_confirma ? tokens.status.dangerLightAlt : tokens.border.default,
                      }}
                      onBlur={e => { if (form.senha_confirma && form.senha !== form.senha_confirma) e.currentTarget.style.borderColor = tokens.status.dangerLightAlt }}
                    />
                  </div>
                  {form.senha_confirma && form.senha !== form.senha_confirma && (
                    <p style={{ fontSize: 11, color: tokens.status.danger, margin: '4px 0 0' }}>Senhas não coincidem</p>
                  )}
                </div>
              </div>

              <Button size="lg" block onClick={cadastrar} disabled={salvando} style={{ marginTop: 24 }}>
                {salvando ? 'Criando sua conta…' : 'Criar conta'}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
