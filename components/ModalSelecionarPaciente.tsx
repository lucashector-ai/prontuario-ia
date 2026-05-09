'use client'

import { useState, useEffect, useRef } from 'react'
import { tokens } from '@/lib/design-tokens'

type Paciente = {
  id: string
  nome: string
  telefone?: string
  cpf?: string
}

type Props = {
  pacientes: Paciente[]
  onSelecionar: (p: Paciente | null) => void
  onFechar: () => void
  permitirAvulsa?: boolean
  titulo?: string
}

export function ModalSelecionarPaciente({ pacientes, onSelecionar, onFechar, permitirAvulsa = true, titulo = 'Selecionar paciente' }: Props) {
  const [busca, setBusca] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const filtrados = busca
    ? pacientes.filter(p => p.nome.toLowerCase().includes(busca.toLowerCase()) || (p.cpf || '').replace(/\D/g, '').includes(busca.replace(/\D/g, '')))
    : pacientes

  return (
    <div onClick={onFechar} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 14, padding: 24, width: '100%', maxWidth: 480, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: tokens.text.primary, margin: '0 0 4px' }}>{titulo}</h2>
            <p style={{ fontSize: 12, color: tokens.text.secondary, margin: 0 }}>{pacientes.length} {pacientes.length === 1 ? 'paciente cadastrado' : 'pacientes cadastrados'}</p>
          </div>
          <button onClick={onFechar} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 4, color: tokens.text.tertiary }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <input
          ref={inputRef}
          value={busca}
          onChange={e => setBusca(e.target.value)}
          placeholder="Buscar por nome ou CPF..."
          style={{ width: '100%', padding: '10px 12px', fontSize: 13, borderRadius: 8, border: `1px solid ${tokens.border.default}`, outline: 'none', boxSizing: 'border-box', marginBottom: 8 }}
        />

        <div style={{ flex: 1, overflowY: 'auto', border: `1px solid ${tokens.bg.hoverStrong}`, borderRadius: 8, minHeight: 200 }}>
          {pacientes.length === 0 ? (
            <p style={{ fontSize: 12, color: tokens.text.tertiary, padding: 24, textAlign: 'center', margin: 0 }}>
              Nenhum paciente cadastrado.<br />
              <a href="/pacientes" style={{ color: tokens.brand.primary, fontWeight: 600, textDecoration: 'none' }}>Cadastrar primeiro paciente →</a>
            </p>
          ) : filtrados.length === 0 ? (
            <p style={{ fontSize: 12, color: tokens.text.tertiary, padding: 24, textAlign: 'center', margin: 0 }}>Nenhum resultado para &quot;{busca}&quot;</p>
          ) : (
            filtrados.map(p => (
              <div key={p.id}
                onClick={() => onSelecionar(p)}
                style={{ padding: '11px 14px', cursor: 'pointer', borderBottom: `1px solid ${tokens.bg.hoverStrong}`, background: 'white' }}
                onMouseEnter={e => (e.currentTarget.style.background = tokens.bg.page)}
                onMouseLeave={e => (e.currentTarget.style.background = 'white')}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: tokens.text.primary }}>{p.nome}</p>
                {p.telefone && <p style={{ margin: '2px 0 0', fontSize: 11, color: tokens.text.tertiary }}>{p.telefone}</p>}
              </div>
            ))
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, paddingTop: 14, borderTop: `1px solid ${tokens.bg.hoverStrong}` }}>
          <a href="/pacientes" style={{ fontSize: 12, color: tokens.brand.primary, fontWeight: 600, textDecoration: 'none' }}>+ Novo paciente</a>
          {permitirAvulsa && (
            <button onClick={() => onSelecionar(null)}
              style={{ fontSize: 12, padding: '7px 14px', borderRadius: 7, border: `1px solid ${tokens.border.default}`, background: 'white', color: tokens.text.secondary, cursor: 'pointer', fontWeight: 500 }}>
              Consulta avulsa
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
