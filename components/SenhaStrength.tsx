'use client'

import { useMemo } from 'react'
import { Check, Circle } from 'lucide-react'
import { tokens } from '@/lib/design-tokens'

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
  const cor = atendidas === 0 ? tokens.border.default : atendidas <= 1 ? tokens.status.danger : atendidas <= 3 ? tokens.status.warningAlt : tokens.status.success
  const label = atendidas === 0 ? '' : atendidas <= 1 ? 'Fraca' : atendidas <= 3 ? 'Média' : 'Forte'

  if (!senha) return null

  const item = (ok: boolean, texto: string) => (
    <span style={{ fontSize: 12, color: ok ? tokens.status.success : tokens.text.tertiary, display: 'flex', alignItems: 'center', gap: 5 }}>
      {ok ? <Check size={12} strokeWidth={2} /> : <Circle size={6} strokeWidth={0} fill="currentColor" style={{ margin: '0 3px' }} />}
      {texto}
    </span>
  )

  return (
    <div style={{ marginTop: 2 }}>
      {/* Barra de força */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{ flex: 1, display: 'flex', gap: 4 }}>
          {[0, 1, 2, 3].map(i => (
            <div key={i} style={{
              flex: 1, height: 4, borderRadius: 99,
              background: atendidas > i ? cor : tokens.border.muted,
              transition: 'background 0.15s',
            }}/>
          ))}
        </div>
        {label && <span style={{ fontSize: 12, fontWeight: 600, color: cor, minWidth: 40, textAlign: 'right' }}>{label}</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px' }}>
        {item(regras.tamanho, '8+ caracteres')}
        {item(regras.maiuscula, 'Letra maiúscula')}
        {item(regras.minuscula, 'Letra minúscula')}
        {item(regras.numero, 'Número')}
      </div>
    </div>
  )
}
