'use client'
import { useState } from 'react'
import { tokens } from '@/lib/design-tokens'
import { Button, Field, Input, Modal, Select } from '@/components/ui'

type Props = {
  onConfirmar: (dados: { nome: string; cpf: string; data_nascimento: string; sexo: string }) => void
  onFechar: () => void
}

export function ModalDadosPacienteAvulso({ onConfirmar, onFechar }: Props) {
  const [nome, setNome] = useState('')
  const [cpf, setCpf] = useState('')
  const [dataNasc, setDataNasc] = useState('')
  const [sexo, setSexo] = useState('M')
  const [erro, setErro] = useState('')

  const formatarCpf = (v: string) => {
    const d = v.replace(/\D/g, '').slice(0, 11)
    return d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2')
  }

  const validarCpf = (cpf: string): boolean => {
    const d = cpf.replace(/\D/g, '')
    if (d.length !== 11 || /^(.)\1+$/.test(d)) return false
    let s = 0
    for (let i = 0; i < 9; i++) s += parseInt(d[i]) * (10 - i)
    let r = (s * 10) % 11
    if (r === 10) r = 0
    if (r !== parseInt(d[9])) return false
    s = 0
    for (let i = 0; i < 10; i++) s += parseInt(d[i]) * (11 - i)
    r = (s * 10) % 11
    if (r === 10) r = 0
    return r === parseInt(d[10])
  }

  const handleConfirmar = () => {
    setErro('')
    if (!nome.trim() || nome.trim().length < 3) return setErro('Nome completo é obrigatório')
    if (!validarCpf(cpf)) return setErro('CPF inválido')
    if (!dataNasc) return setErro('Data de nascimento é obrigatória')
    onConfirmar({ nome: nome.trim(), cpf: cpf.replace(/\D/g, ''), data_nascimento: dataNasc, sexo })
  }

  return (
    <Modal
      titulo="Dados do paciente"
      onClose={onFechar}
      largura={460}
      rodape={<>
        <Button variant="secondary" onClick={onFechar}>Cancelar</Button>
        <Button onClick={handleConfirmar}>Continuar</Button>
      </>}
    >
      <p style={{ fontSize: 12.5, color: tokens.text.quaternary, margin: '-4px 0 16px', lineHeight: 1.5 }}>
        Como esta consulta não está vinculada a um paciente cadastrado, precisamos dos dados básicos para a receita digital.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field label="Nome completo *">
          <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ana Lima Souza" autoFocus />
        </Field>
        <div style={{ display: 'flex', gap: 12 }}>
          <Field label="CPF *" style={{ flex: 1 }}>
            <Input value={cpf} onChange={e => setCpf(formatarCpf(e.target.value))} placeholder="000.000.000-00" />
          </Field>
          <Field label="Sexo *" style={{ width: 140 }}>
            <Select value={sexo} onChange={e => setSexo(e.target.value)}>
              <option value="M">Masculino</option>
              <option value="F">Feminino</option>
            </Select>
          </Field>
        </div>
        <Field label="Data de nascimento *">
          <Input type="date" value={dataNasc} onChange={e => setDataNasc(e.target.value)} />
        </Field>
      </div>

      {erro && <p style={{ color: tokens.status.danger, fontSize: 12.5, margin: '12px 0 0' }}>{erro}</p>}
    </Modal>
  )
}
