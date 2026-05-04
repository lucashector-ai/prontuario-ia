'use client'

type Paciente = {
  id: string
  nome: string
  telefone?: string
  data_nascimento?: string
  sexo?: string
  cpf?: string
}

type Props = {
  paciente: Paciente | null
  onTrocar: () => void
  onSelecionarPrimeiroPaciente?: () => void
  totalConsultas?: number
  ultimaConsulta?: string
}

function calcIdade(dataNasc?: string): string {
  if (!dataNasc) return ''
  const d = new Date(dataNasc)
  if (isNaN(d.getTime())) return ''
  const diff = Date.now() - d.getTime()
  const idade = Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25))
  return idade > 0 && idade < 130 ? idade + 'a' : ''
}

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/)
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase()
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
}

function fmtDataCurta(d?: string): string {
  if (!d) return ''
  const dt = new Date(d)
  if (isNaN(dt.getTime())) return ''
  return dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

export function HeaderPacienteAtivo({ paciente, onTrocar, onSelecionarPrimeiroPaciente, totalConsultas, ultimaConsulta }: Props) {
  if (!paciente) {
    return (
      <div style={{ background: 'white', borderRadius: 12, padding: '12px 16px', border: '1px dashed #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#111827', margin: 0 }}>Consulta avulsa</p>
            <p style={{ fontSize: 11, color: '#9ca3af', margin: '1px 0 0' }}>Sem paciente vinculado</p>
          </div>
        </div>
        <button onClick={onSelecionarPrimeiroPaciente || onTrocar}
          style={{ fontSize: 12, padding: '6px 12px', border: '1px solid #6043C1', background: 'white', color: '#6043C1', borderRadius: 7, cursor: 'pointer', fontWeight: 500 }}>
          Vincular paciente
        </button>
      </div>
    )
  }

  const idade = calcIdade(paciente.data_nascimento)
  const sexoLetra = paciente.sexo ? paciente.sexo[0].toUpperCase() : ''
  const meta = [idade, sexoLetra].filter(Boolean).join(' · ')

  return (
    <div style={{ background: 'white', borderRadius: 12, padding: '10px 14px', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' as const }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#f0ebff', color: '#6043C1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 12, flexShrink: 0 }}>
          {iniciais(paciente.nome)}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' as const }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{paciente.nome}</span>
            {meta && <span style={{ fontSize: 10, color: '#6b7280', background: '#f3f4f6', padding: '2px 7px', borderRadius: 8, fontWeight: 500 }}>{meta}</span>}
          </div>
          {(totalConsultas !== undefined || ultimaConsulta) && (
            <p style={{ fontSize: 11, color: '#9ca3af', margin: '2px 0 0' }}>
              {ultimaConsulta && <>Última: {fmtDataCurta(ultimaConsulta)}</>}
              {totalConsultas !== undefined && totalConsultas > 0 && <> · {totalConsultas}ª consulta</>}
            </p>
          )}
        </div>
      </div>
      <button onClick={onTrocar}
        style={{ fontSize: 11, padding: '5px 10px', border: '1px solid #e5e7eb', background: 'white', color: '#6b7280', borderRadius: 6, cursor: 'pointer', fontWeight: 500, flexShrink: 0 }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = '#6043C1'; e.currentTarget.style.color = '#6043C1' }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.color = '#6b7280' }}>
        Trocar
      </button>
    </div>
  )
}
