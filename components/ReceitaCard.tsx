'use client'

interface Medicamento { nome: string; dose: string; via: string; frequencia: string; duracao: string; instrucoes: string }
interface Receita { medicamentos: Medicamento[]; observacoes: string }
interface Props { receita: Receita; nomeMedico?: string; crm?: string; especialidade?: string; onImprimir: () => void }

export function ReceitaCard({ receita, nomeMedico, crm, especialidade, onImprimir }: Props) {
  const hoje = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', margin: 0 }}>{nomeMedico || 'Médico responsável'}</p>
            <p style={{ fontSize: 11, color: 'var(--text3)', margin: '2px 0 0' }}>{[especialidade, crm].filter(Boolean).join(' · ')}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: 10, color: 'var(--text3)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Receituário</p>
            <p style={{ fontSize: 11, color: 'var(--text3)', margin: '2px 0 0' }}>{hoje}</p>
          </div>
        </div>

        <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {receita.medicamentos?.map((med, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, paddingBottom: 10, borderBottom: i < receita.medicamentos.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <div style={{
                width: 26, height: 26, borderRadius: '50%', background: 'rgba(99,102,241,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700, color: 'var(--accent2)', flexShrink: 0
              }}>{i + 1}</div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', margin: '0 0 6px' }}>{med.nome} {med.dose}</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {med.via && med.via !== 'conforme orientação médica' && (
                    <span style={{ fontSize: 11, color: '#818cf8', background: 'rgba(99,102,241,0.1)', padding: '2px 8px', borderRadius: 20 }}>{med.via}</span>
                  )}
                  {med.frequencia && med.frequencia !== 'conforme orientação médica' && (
                    <span style={{ fontSize: 11, color: '#34d399', background: 'rgba(16,185,129,0.1)', padding: '2px 8px', borderRadius: 20 }}>{med.frequencia}</span>
                  )}
                  {med.duracao && med.duracao !== 'conforme orientação médica' && (
                    <span style={{ fontSize: 11, color: '#fbbf24', background: 'rgba(245,158,11,0.1)', padding: '2px 8px', borderRadius: 20 }}>{med.duracao}</span>
                  )}
                </div>
                {med.instrucoes && med.instrucoes !== 'conforme orientação médica' && (
                  <p style={{ fontSize: 11, color: 'var(--text3)', margin: '6px 0 0', fontStyle: 'italic' }}>{med.instrucoes}</p>
                )}
              </div>
            </div>
          ))}
        </div>

        {receita.observacoes && (
          <div style={{ margin: '0 16px 16px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8, padding: '10px 12px' }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: '#fbbf24', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Orientações</p>
            <p style={{ fontSize: 12, color: '#fcd34d', margin: 0 }}>{receita.observacoes}</p>
          </div>
        )}

        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <p style={{ fontSize: 11, color: 'var(--text3)', margin: 0 }}>Válido por 30 dias</p>
          <div style={{ textAlign: 'center', borderTop: '1px solid var(--border2)', paddingTop: 6, minWidth: 120 }}>
            <p style={{ fontSize: 11, color: 'var(--text3)', margin: 0 }}>{nomeMedico}</p>
            {crm && <p style={{ fontSize: 10, color: 'var(--text3)', margin: '2px 0 0', opacity: 0.6 }}>{crm}</p>}
          </div>
        </div>
      </div>

      <button onClick={onImprimir}
        style={{
          padding: '10px', borderRadius: 10, border: '1px solid var(--border)',
          background: 'transparent', color: 'var(--text2)', fontSize: 12, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, transition: 'all 0.15s'
        }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/>
        </svg>
        Imprimir receita
      </button>
    </div>
  )
}
