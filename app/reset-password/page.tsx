'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function ResetPasswordPage() {
  const [senha, setSenha] = useState('')
  const [confirma, setConfirma] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [ok, setOk] = useState(false)
  const router = useRouter()

  async function salvar() {
    if (senha.length < 6) return setErro('Senha deve ter pelo menos 6 caracteres')
    if (senha !== confirma) return setErro('Senhas nao coincidem')
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password: senha })
    setLoading(false)
    if (error) setErro(error.message)
    else { setOk(true); setTimeout(() => router.push('/dashboard'), 2000) }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F5F5F5', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 16px' }}>
      <div style={{ background: 'white', borderRadius: 16, border: '1px solid #f0f0f0', padding: '40px 36px', width: '100%', maxWidth: 380 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', textAlign: 'center', margin: '0 0 6px' }}>Nova senha</h1>
        <p style={{ fontSize: 14, color: '#6b7280', textAlign: 'center', margin: '0 0 28px' }}>Digite sua nova senha abaixo</p>
        {ok ? (
          <div style={{ textAlign: 'center', color: '#16a34a', fontWeight: 600 }}>Senha alterada! Redirecionando...</div>
        ) : (
          <>
            <input type="password" placeholder="Nova senha (min. 6 caracteres)" value={senha}
              onChange={e => setSenha(e.target.value)}
              style={{ width: '100%', padding: '12px 16px', fontSize: 14, borderRadius: 10, border: '1.5px solid #e5e7eb', boxSizing: 'border-box', marginBottom: 12 }} />
            <input type="password" placeholder="Confirmar nova senha" value={confirma}
              onChange={e => setConfirma(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && salvar()}
              style={{ width: '100%', padding: '12px 16px', fontSize: 14, borderRadius: 10, border: '1.5px solid #e5e7eb', boxSizing: 'border-box', marginBottom: 12 }} />
            {erro && <p style={{ fontSize: 13, color: '#dc2626', margin: '0 0 12px' }}>{erro}</p>}
            <button onClick={salvar} disabled={loading}
              style={{ width: '100%', padding: 14, borderRadius: 10, border: 'none', cursor: 'pointer', background: loading ? '#b9a9ef' : '#1F9D5C', color: 'white', fontSize: 15, fontWeight: 700 }}>
              {loading ? 'Salvando...' : 'Salvar nova senha'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
