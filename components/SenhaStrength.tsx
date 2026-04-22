'use client'

import { useMemo } from 'react'

export interface RegrasSenha {
  tamanho: boolean
  maiuscula: boolean
  minuscula: boolean
  numero: boolean
}

export function validarSenha(senha: string): RegrasSenha {
  return {
    tamanho: senha.length >= 8,
    maiuscula: /[A-Z]/.test(senha),
    minuscula: /[a-z]/.test(senha),
    numero: /[0-9]/.test(senha),
  }
}

export function senhaEhForte(senha: string): boolean {
  const r = validarSenha(senha)
  return r.tamanho && r.maiuscula && r.minuscula && r.numero
}

export function SenhaStrength({ senha }: { senha: string }) {
  const regras = useMemo(() => validarSenha(senha), [senha])
  const atendidas = Object.values(regras).filter(Boolean).length
  const cor = atendidas === 0 ? '#e5e7eb' : atendidas <= 1 ? '#dc2626' : atendidas <= 3 ? '#f59e0b' : '#6043C1'
  const label = atendidas === 0 ? '' : atendidas <= 1 ? 'Fraca' : atendidas <= 3 ? 'Média' : 'Forte'

  if (!senha) return null

  const itemStyle = (ok: boolean): React.CSSProperties => ({
    fontSize: 11,
    color: ok ? '#6043C1' : '#9ca3af',
    display: 'flex',
    alignItems: 'center',
    gap: 5,
  })

  const check = (ok: boolean) => (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={ok ? '#6043C1' : '#9ca3af'} strokeWidth="3">
      {ok ? <polyline points="20 6 9 17 4 12"/> : <circle cx="12" cy="12" r="3"/>}
    </svg>
  )

  return (
    <div style={{ marginTop: 6 }}>
      {/* Barra de força */}
      <div style={{ display: 'flex', gap: 3, marginBottom: 8 }}>
        {[0, 1, 2, 3].map(i => (
          <div key={i} style={{
            flex: 1, height: 3, borderRadius: 2,
            background: atendidas > i ? cor : '#e5e7eb',
            transition: 'background 0.15s',
          }}/>
        ))}
      </div>
      {label && (
        <p style={{ fontSize: 10, fontWeight: 600, color: cor, margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 12px' }}>
        <span style={itemStyle(regras.tamanho)}>{check(regras.tamanho)} 8+ caracteres</span>
        <span style={itemStyle(regras.maiuscula)}>{check(regras.maiuscula)} Letra maiúscula</span>
        <span style={itemStyle(regras.minuscula)}>{check(regras.minuscula)} Letra minúscula</span>
        <span style={itemStyle(regras.numero)}>{check(regras.numero)} Número</span>
      </div>
    </div>
  )
}
