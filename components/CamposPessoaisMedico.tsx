'use client'

interface Props {
  cpf: string
  data_nascimento: string
  onChange: (campo: 'cpf' | 'data_nascimento', valor: string) => void
}

const labelStyle: React.CSSProperties = {
  fontSize: 12, fontWeight: 600, color: '#6b7280',
  display: 'block', marginBottom: 6,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid #e5e7eb',
  fontSize: 13,
  outline: 'none',
  boxSizing: 'border-box',
  background: 'white',
}

export function formatarCPF(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 6) return d.slice(0, 3) + '.' + d.slice(3)
  if (d.length <= 9) return d.slice(0, 3) + '.' + d.slice(3, 6) + '.' + d.slice(6)
  return d.slice(0, 3) + '.' + d.slice(3, 6) + '.' + d.slice(6, 9) + '-' + d.slice(9)
}

export function CamposPessoaisMedico({ cpf, data_nascimento, onChange }: Props) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      <div>
        <label style={labelStyle}>CPF *</label>
        <input
          type="text"
          value={cpf}
          onChange={e => onChange('cpf', formatarCPF(e.target.value))}
          placeholder="123.456.789-10"
          maxLength={14}
          style={inputStyle}
        />
      </div>
      <div>
        <label style={labelStyle}>Data de nascimento *</label>
        <input
          type="date"
          value={data_nascimento}
          onChange={e => onChange('data_nascimento', e.target.value)}
          style={inputStyle}
        />
      </div>
    </div>
  )
}
