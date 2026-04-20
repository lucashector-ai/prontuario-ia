'use client'

interface Medicamento { nome: string; dose: string; via: string; frequencia: string; duracao: string; instrucoes: string }
interface Receita { medicamentos: Medicamento[]; observacoes: string }
interface Props { receita: Receita; nomeMedico?: string; crm?: string; especialidade?: string; onImprimir: () => void }

export function ReceitaCard({ receita, nomeMedico, crm, especialidade, onImprimir }: Props) {
  const hoje = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ background: 'white', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ background: '#E8F7EF', borderBottom: '1px solid #A7E0BF', padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, color: '#0d1f1c', margin: 0 }}>{nomeMedico || 'Médico responsável'}</p>
            <p style={{ fontSize: 11, color: '#3d5452', margin: '2px 0 0' }}>{[especialidade, crm].filter(Boolean).join(' · ')}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: 10, color: '#8aa8a5', margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Receituário</p>
            <p style={{ fontSize: 11, color: '#3d5452', margin: '2px 0 0' }}>{hoje}</p>
          </div>
        </div>

        <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {receita.medicamentos?.map((med, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, paddingBottom: 12, borderBottom: i < receita.medicamentos.length - 1 ? '1px solid #f0f4f0' : 'none' }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', background: '#E8F7EF', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700, color: '#1F9D5C', flexShrink: 0
              }}>{i + 1}</div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#0d1f1c', margin: '0 0 6px' }}>{med.nome} {med.dose}</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {med.via && med.via !== 'conforme orientação médica' && (
                    <span style={{ fontSize: 11, color: '#1d4ed8', background: '#eff6ff', padding: '2px 8px', borderRadius: 20, border: '1px solid #bfdbfe' }}>{med.via}</span>
                  )}
                  {med.frequencia && med.frequencia !== 'conforme orientação médica' && (
                    <span style={{ fontSize: 11, color: '#0d9488', background: '#f0fdfa', padding: '2px 8px', borderRadius: 20, border: '1px solid #99f6e4' }}>{med.frequencia}</span>
                  )}
                  {med.duracao && med.duracao !== 'conforme orientação médica' && (
                    <span style={{ fontSize: 11, color: '#d97706', background: '#fffbeb', padding: '2px 8px', borderRadius: 20, border: '1px solid #fde68a' }}>{med.duracao}</span>
                  )}
                </div>
                {med.instrucoes && med.instrucoes !== 'conforme orientação médica' && (
                  <p style={{ fontSize: 11, color: '#8aa8a5', margin: '6px 0 0', fontStyle: 'italic' }}>{med.instrucoes}</p>
                )}
              </div>
            </div>
          ))}
        </div>

        {receita.observacoes && (
          <div style={{ margin: '0 18px 16px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 12px' }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: '#d97706', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Orientações</p>
            <p style={{ fontSize: 12, color: '#92400e', margin: 0 }}>{receita.observacoes}</p>
          </div>
        )}

        <div style={{ padding: '12px 18px', borderTop: '1px solid #f0f4f0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <p style={{ fontSize: 11, color: '#8aa8a5', margin: 0 }}>Válido por 30 dias</p>
          <div style={{ textAlign: 'center', borderTop: '1.5px solid #d1dbd9', paddingTop: 6, minWidth: 130 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: '#3d5452', margin: 0 }}>{nomeMedico}</p>
            {crm && <p style={{ fontSize: 10, color: '#8aa8a5', margin: '2px 0 0' }}>{crm}</p>}
          </div>
        </div>
      </div>

      <button onClick={onImprimir} style={{
        padding: '10px', borderRadius: 8,
        background: 'white', color: '#3d5452', fontSize: 12, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, fontWeight: 500,
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/>
        </svg>
        Imprimir receita
      </button>
    </div>
  )
}
