'use client'

interface CID { codigo: string; descricao: string; justificativa: string }
interface Prontuario { subjetivo: string; objetivo: string; avaliacao: string; plano: string; cids: CID[]; alertas: string[] }
interface Props { prontuario: Prontuario; onCopiar: () => void; nomeMedico?: string; crm?: string }

const secoes = [
  { key: 'subjetivo', letra: 'S', titulo: 'Subjetivo', sub: 'Queixas e história', accent: '#6366f1', bg: 'rgba(99,102,241,0.08)', border: 'rgba(99,102,241,0.2)' },
  { key: 'objetivo',  letra: 'O', titulo: 'Objetivo',  sub: 'Exame físico',       accent: '#10b981', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.2)' },
  { key: 'avaliacao', letra: 'A', titulo: 'Avaliação',  sub: 'Hipótese diagnóstica', accent: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)' },
  { key: 'plano',     letra: 'P', titulo: 'Plano',      sub: 'Conduta e prescrição', accent: '#ec4899', bg: 'rgba(236,72,153,0.08)', border: 'rgba(236,72,153,0.2)' },
]

export function ProntuarioCard({ prontuario, onCopiar, nomeMedico, crm }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {prontuario.alertas?.length > 0 && (
        <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '12px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
              <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
            </svg>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#ef4444', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Alertas clínicos</span>
          </div>
          {prontuario.alertas.map((a, i) => (
            <p key={i} style={{ fontSize: 12, color: '#fca5a5', margin: '2px 0', display: 'flex', alignItems: 'flex-start', gap: 6 }}>
              <span style={{ color: '#ef4444', marginTop: 2 }}>·</span>{a}
            </p>
          ))}
        </div>
      )}

      {secoes.map(({ key, letra, titulo, sub, accent, bg, border }) => (
        <div key={key} style={{ background: bg, border: `1px solid ${border}`, borderRadius: 10, padding: '12px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{
              width: 26, height: 26, borderRadius: 6, background: accent,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 800, color: 'white', flexShrink: 0
            }}>{letra}</div>
            <div>
              <p style={{ fontSize: 12, fontWeight: 600, color: 'white', margin: 0, lineHeight: 1.2 }}>{titulo}</p>
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', margin: 0 }}>{sub}</p>
            </div>
          </div>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', lineHeight: 1.7, margin: 0, paddingLeft: 36, whiteSpace: 'pre-line' }}>
            {(prontuario as any)[key] || 'Não mencionado na consulta'}
          </p>
        </div>
      ))}

      {prontuario.cids?.length > 0 && (
        <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px' }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 10px' }}>CID-10 sugeridos</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {prontuario.cids.map((cid, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: 'var(--bg2)', borderRadius: 8, padding: '8px 10px' }}>
                <span style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 700, color: 'var(--accent2)', background: 'rgba(99,102,241,0.15)', padding: '2px 8px', borderRadius: 6, flexShrink: 0 }}>{cid.codigo}</span>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', margin: 0 }}>{cid.descricao}</p>
                  <p style={{ fontSize: 11, color: 'var(--text3)', margin: '2px 0 0' }}>{cid.justificativa}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <button onClick={onCopiar}
        style={{
          padding: '9px', borderRadius: 10, border: '1px solid var(--border)',
          background: 'transparent', color: 'var(--text3)', fontSize: 12, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
          transition: 'all 0.15s'
        }}
        onMouseOver={e => { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.color = 'var(--text2)' }}
        onMouseOut={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text3)' }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
        </svg>
        Copiar prontuário
      </button>
    </div>
  )
}
