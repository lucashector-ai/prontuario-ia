'use client'

interface CID { codigo: string; descricao: string; justificativa: string }
interface Prontuario { subjetivo: string; objetivo: string; avaliacao: string; plano: string; cids: CID[]; alertas: string[] }
interface Props { prontuario: Prontuario; onCopiar: () => void; nomeMedico?: string; crm?: string }

const secoes = [
  { key: 'subjetivo', letra: 'S', titulo: 'Subjetivo', sub: 'Queixas e história', cor: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
  { key: 'objetivo',  letra: 'O', titulo: 'Objetivo',  sub: 'Exame físico',         cor: '#0d9488', bg: '#f0fdfa', border: '#99f6e4' },
  { key: 'avaliacao', letra: 'A', titulo: 'Avaliação',  sub: 'Hipótese diagnóstica', cor: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' },
  { key: 'plano',     letra: 'P', titulo: 'Plano',      sub: 'Conduta e prescrição', cor: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
]

export function ProntuarioCard({ prontuario, onCopiar, nomeMedico, crm }: Props) {
  const hoje = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {prontuario.alertas?.length > 0 && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '12px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2">
              <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
            </svg>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#dc2626', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Alertas clínicos</span>
          </div>
          {prontuario.alertas.map((a, i) => (
            <p key={i} style={{ fontSize: 12, color: '#b91c1c', margin: '3px 0', display: 'flex', gap: 6 }}>
              <span>·</span>{a}
            </p>
          ))}
        </div>
      )}

      {secoes.map(({ key, letra, titulo, sub, cor, bg, border }) => (
        <div key={key} style={{ background: bg, border: `1px solid ${border}`, borderRadius: 10, padding: '12px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{
              width: 26, height: 26, borderRadius: 7, background: cor,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 800, color: 'white', flexShrink: 0
            }}>{letra}</div>
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#0d1f1c', margin: 0 }}>{titulo}</p>
              <p style={{ fontSize: 10, color: '#8aa8a5', margin: 0 }}>{sub}</p>
            </div>
          </div>
          <p style={{ fontSize: 13, color: '#3d5452', lineHeight: 1.7, margin: 0, paddingLeft: 36, whiteSpace: 'pre-line' }}>
            {(prontuario as any)[key] || 'Não mencionado na consulta'}
          </p>
        </div>
      ))}

      {prontuario.cids?.length > 0 && (
        <div style={{ background: '#f8fafb', border: '1px solid #e8eeed', borderRadius: 10, padding: '12px 14px' }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: '#8aa8a5', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 10px' }}>CID-10 sugeridos</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {prontuario.cids.map((cid, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: 'white', borderRadius: 8, padding: '8px 10px', border: '1px solid #e8eeed' }}>
                <span style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 700, color: '#16a34a', background: '#f0fdf4', padding: '2px 8px', borderRadius: 5, border: '1px solid #bbf7d0', flexShrink: 0 }}>{cid.codigo}</span>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: '#0d1f1c', margin: 0 }}>{cid.descricao}</p>
                  <p style={{ fontSize: 11, color: '#8aa8a5', margin: '2px 0 0' }}>{cid.justificativa}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {(nomeMedico || crm) && (
        <div style={{ background: 'white', border: '1px solid #e8eeed', borderRadius: 10, padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontSize: 10, color: '#8aa8a5', margin: '0 0 2px' }}>{hoje}</p>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#0d1f1c', margin: 0 }}>{nomeMedico}</p>
            {crm && <p style={{ fontSize: 11, color: '#8aa8a5', margin: 0 }}>{crm}</p>}
          </div>
          <div style={{ textAlign: 'center', borderTop: '1.5px solid #d1dbd9', paddingTop: 6, minWidth: 100 }}>
            <p style={{ fontSize: 10, color: '#8aa8a5', margin: 0 }}>assinatura</p>
          </div>
        </div>
      )}

      <button onClick={onCopiar} style={{
        padding: '9px', borderRadius: 8, border: '1px solid #e8eeed',
        background: 'white', color: '#8aa8a5', fontSize: 12, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, fontWeight: 500,
      }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
        </svg>
        Copiar prontuário
      </button>
    </div>
  )
}
