'use client'
import { useState } from 'react'

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
    <div onClick={onFechar} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 14, padding: 28, width: 460, maxWidth: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: '#111827', margin: 0 }}>Dados do paciente</h2>
          <button onClick={onFechar} style={{ background: 'none', border: 'none', fontSize: 20, color: '#9ca3af', cursor: 'pointer', padding: 0, lineHeight: 1 }}>×</button>
        </div>
        <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 20px', lineHeight: 1.5 }}>
          Como esta consulta não está vinculada a um paciente cadastrado, precisamos dos dados básicos para a receita digital.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, color: '#374151', fontWeight: 500, display: 'block', marginBottom: 4 }}>Nome completo *</label>
            <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ana Lima Souza" autoFocus
              style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13 }}/>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, color: '#374151', fontWeight: 500, display: 'block', marginBottom: 4 }}>CPF *</label>
              <input value={cpf} onChange={e => setCpf(formatarCpf(e.target.value))} placeholder="000.000.000-00"
                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13 }}/>
            </div>
            <div style={{ width: 130 }}>
              <label style={{ fontSize: 12, color: '#374151', fontWeight: 500, display: 'block', marginBottom: 4 }}>Sexo *</label>
              <select value={sexo} onChange={e => setSexo(e.target.value)} style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13, background: 'white' }}>
                <option value="M">Masculino</option>
                <option value="F">Feminino</option>
              </select>
            </div>
          </div>
          <div>
            <label style={{ fontSize: 12, color: '#374151', fontWeight: 500, display: 'block', marginBottom: 4 }}>Data de nascimento *</label>
            <input type="date" value={dataNasc} onChange={e => setDataNasc(e.target.value)}
              style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13 }}/>
          </div>
        </div>

        {erro && <p style={{ color: '#dc2626', fontSize: 12, margin: '12px 0 0' }}>{erro}</p>}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 22 }}>
          <button onClick={onFechar} style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid #e5e7eb', background: 'white', color: '#6b7280', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>Cancelar</button>
          <button onClick={handleConfirmar} style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: '#6043C1', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Continuar</button>
        </div>
      </div>
    </div>
  )
}
