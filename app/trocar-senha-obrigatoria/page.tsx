'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { SenhaStrength, senhaEhForte } from '@/components/SenhaStrength'

const ACCENT = '#6043C1'
const BG = '#F5F5F5'

export default function TrocarSenhaObrigatoria() {
  const router = useRouter()
  const [medico, setMedico] = useState<any>(null)
  const [senha, setSenha] = useState('')
  const [confirma, setConfirma] = useState('')
  const [showSenha, setShowSenha] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    const m = localStorage.getItem('medico')
    if (!m) { router.push('/login'); return }
    const med = JSON.parse(m)
    if (!med.senha_provisoria) {
      router.push('/onboarding')
      return
    }
    setMedico(med)
  }, [router])

  const salvar = async () => {
    setErro(null)
    if (!senhaEhForte(senha)) return setErro('Senha não atende aos critérios de segurança')
    if (senha !== confirma) return setErro('Senhas não coincidem')

    setSalvando(true)
    try {
      const res = await fetch('/api/trocar-senha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ medico_id: medico.id, senha_nova: senha }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      // Atualiza localStorage com flag desligada
      const novoMedico = { ...medico, senha_provisoria: false }
      localStorage.setItem('medico', JSON.stringify(novoMedico))
      router.push('/onboarding')
    } catch (e: any) {
      setErro(e.message || 'Erro ao salvar')
    } finally {
      setSalvando(false)
    }
  }

  if (!medico) return null

  return (
    <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 460 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#ede9fb', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0110 0v4"/>
            </svg>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: '0 0 8px' }}>Crie sua senha</h1>
          <p style={{ fontSize: 13, color: '#6b7280', margin: 0, lineHeight: 1.6 }}>
            Olá {medico.nome?.split(' ')[0]}! Defina uma senha forte pra substituir a provisória.
          </p>
        </div>

        <div style={{ background: 'white', borderRadius: 16, padding: 28 }}>
          {erro && (
            <div style={{ background: '#fef2f2', color: '#991b1b', padding: '11px 14px', borderRadius: 10, fontSize: 13, marginBottom: 16, border: '1px solid #fecaca' }}>
              {erro}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 6 }}>Nova senha</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showSenha ? 'text' : 'password'}
                  value={senha}
                  onChange={e => setSenha(e.target.value)}
                  placeholder="Crie uma senha forte"
                  autoFocus
                  style={{
                    width: '100%', padding: '12px 40px 12px 14px', fontSize: 14,
                    borderRadius: 10, border: '1px solid #e5e7eb',
                    outline: 'none', boxSizing: 'border-box', color: '#111827',
                  }}
                />
                <button type="button" onClick={() => setShowSenha(s => !s)} style={{
                  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af',
                  padding: 0, display: 'flex', alignItems: 'center',
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    {showSenha ? (
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
              </div>
              <SenhaStrength senha={senha}/>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 6 }}>Confirmar senha</label>
              <input
                type={showSenha ? 'text' : 'password'}
                value={confirma}
                onChange={e => setConfirma(e.target.value)}
                placeholder="Repita a senha"
                style={{
                  width: '100%', padding: '12px 14px', fontSize: 14,
                  borderRadius: 10,
                  border: `1px solid ${confirma && senha !== confirma ? '#fca5a5' : '#e5e7eb'}`,
                  outline: 'none', boxSizing: 'border-box', color: '#111827',
                }}
              />
              {confirma && senha !== confirma && (
                <p style={{ fontSize: 11, color: '#dc2626', margin: '4px 0 0' }}>Senhas não coincidem</p>
              )}
            </div>

            <button onClick={salvar} disabled={salvando} style={{
              padding: 14,
              background: salvando ? '#9ca3af' : ACCENT,
              color: 'white', border: 'none', borderRadius: 10,
              fontSize: 14, fontWeight: 700, cursor: salvando ? 'not-allowed' : 'pointer',
            }}>
              {salvando ? 'Salvando...' : 'Criar senha e continuar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
