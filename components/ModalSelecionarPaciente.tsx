'use client'

import { useState } from 'react'
import { UserPlus } from 'lucide-react'
import { tokens } from '@/lib/design-tokens'
import { Avatar, Button, EmptyState, Icon, Modal, SearchInput } from '@/components/ui'

const T = tokens

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

  const filtrados = busca
    ? pacientes.filter(p => p.nome.toLowerCase().includes(busca.toLowerCase()) || (p.cpf || '').replace(/\D/g, '').includes(busca.replace(/\D/g, '')))
    : pacientes

  return (
    <Modal titulo={titulo} onClose={onFechar} largura={480}>
      <p style={{ fontSize: 12.5, color: T.text.quaternary, margin: '-6px 0 12px' }}>
        {pacientes.length} {pacientes.length === 1 ? 'paciente cadastrado' : 'pacientes cadastrados'}
      </p>

      <SearchInput value={busca} onChange={setBusca} placeholder="Buscar por nome ou CPF" autoFocus />

      <div style={{ marginTop: 8, maxHeight: '48vh', minHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {pacientes.length === 0 ? (
          <EmptyState
            icon={UserPlus}
            titulo="Nenhum paciente cadastrado"
            acao={<a href="/pacientes" style={{ fontSize: 13, color: T.brand.primary, fontWeight: 600, textDecoration: 'none' }}>Cadastrar primeiro paciente</a>}
          />
        ) : filtrados.length === 0 ? (
          <p style={{ fontSize: 12.5, color: T.text.tertiary, padding: 24, textAlign: 'center', margin: 0 }}>Nenhum resultado para &quot;{busca}&quot;</p>
        ) : (
          filtrados.map(p => (
            <button
              key={p.id}
              type="button"
              onClick={() => onSelecionar(p)}
              onMouseEnter={e => (e.currentTarget.style.background = T.bg.hover)}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              style={{
                all: 'unset', cursor: 'pointer', boxSizing: 'border-box', width: '100%',
                display: 'flex', alignItems: 'center', gap: 10, padding: 8, borderRadius: 9,
              }}
            >
              <Avatar nome={p.nome} size={30} />
              <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.3, minWidth: 0 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: T.text.primary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.nome}</span>
                {p.telefone && <span style={{ fontSize: 11.5, color: T.text.quaternary }}>{p.telefone}</span>}
              </span>
            </button>
          ))
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.border.muted}` }}>
        <a href="/pacientes" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, color: T.brand.primary, fontWeight: 600, textDecoration: 'none' }}>
          <Icon icon={UserPlus} size={15} />
          Cadastrar novo paciente
        </a>
        {permitirAvulsa && (
          <Button variant="secondary" size="sm" onClick={() => onSelecionar(null)}>Consulta avulsa</Button>
        )}
      </div>
    </Modal>
  )
}
