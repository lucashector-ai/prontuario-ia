'use client'

interface CID { codigo: string; descricao: string; justificativa: string }
interface Prontuario { subjetivo: string; objetivo: string; avaliacao: string; plano: string; cids: CID[]; alertas: string[] }
interface Props { prontuario: Prontuario; onCopiar: () => void; nomeMedico?: string; crm?: string; medico?: any }

const secoes = [
  { key: 'subjetivo', letra: 'S', titulo: 'Subjetivo', sub: 'Queixas e história', cor: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
  { key: 'objetivo',  letra: 'O', titulo: 'Objetivo',  sub: 'Exame físico',        cor: '#0d9488', bg: '#f0fdfa', border: '#99f6e4' },
  { key: 'avaliacao', letra: 'A', titulo: 'Avaliação',  sub: 'Hipótese diagnóstica', cor: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' },
  { key: 'plano',     letra: 'P', titulo: 'Plano',      sub: 'Conduta e prescrição', cor: '#6043C1', bg: '#f3f0fd', border: '#d4c9f7' },
]

export function ProntuarioCard({ prontuario, onCopiar, nomeMedico, crm, medico }: Props) {
  const hoje = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })

  const handleExportarPDF = async () => {
    try {
      const res = await fetch('/api/pdf', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prontuario, medico: medico || { nome: nomeMedico, crm } }),
      })
      const html = await res.text()
      const blob = new Blob([html], { type: 'text/html' })
      const url = URL.createObjectURL(blob)
      const win = window.open(url, '_blank')
      if (win) {
        win.addEventListener('load', () => {
          setTimeout(() => { win.print() }, 500)
        })
      }
    } catch (e) { console.error(e) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {prontuario.alertas?.length > 0 && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderLeft: '4px solid #dc2626', borderRadius: '0 10px 10px 0', padding: '12px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2">
              <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
            </svg>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#dc2626', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Alertas clínicos</span>
          </div>
          {prontuario.alertas.map((a, i) => (
            <p key={i} style={{ fontSize: 12, color: '#b91c1c', margin: '3px 0', display: 'flex', gap: 6 }}><span>·</span>{a}</p>
          ))}
        </div>
      )}

      {secoes.map(({ key, letra, titulo, sub, cor, bg, border }) => (
        <div key={key} style={{ background: bg, border: `1px solid ${border}`, borderRadius: 10, padding: '12px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{ width: 26, height: 26, borderRadius: 7, background: cor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: 'white', flexShrink: 0 }}>{letra}</div>
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#111827', margin: 0 }}>{titulo}</p>
              <p style={{ fontSize: 10, color: '#9ca3af', margin: 0 }}>{sub}</p>
            </div>
          </div>
          <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.7, margin: 0, paddingLeft: 36, whiteSpace: 'pre-line' }}>
            {(prontuario as any)[key] || 'Não mencionado na consulta'}
          </p>
        </div>
      ))}

      {prontuario.cids?.length > 0 && (
        <div style={{ background: '#f9fafb', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', borderRadius: 10, padding: '12px 14px' }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 10px' }}>CID-10 sugeridos</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {prontuario.cids.map((cid, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: 'white', borderRadius: 8, padding: '8px 10px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <span style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 700, color: '#6043C1', background: '#f3f0fd', padding: '2px 8px', borderRadius: 5, border: '1px solid #d4c9f7', flexShrink: 0 }}>{cid.codigo}</span>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: '#111827', margin: 0 }}>{cid.descricao}</p>
                  <p style={{ fontSize: 11, color: '#9ca3af', margin: '2px 0 0' }}>{cid.justificativa}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Assinatura */}
      {nomeMedico && (
        <div style={{ background: 'white', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', borderRadius: 10, padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontSize: 10, color: '#9ca3af', margin: '0 0 2px' }}>{hoje}</p>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#111827', margin: 0 }}>{nomeMedico}</p>
            {crm && <p style={{ fontSize: 11, color: '#9ca3af', margin: 0 }}>{crm}</p>}
          </div>
          <div style={{ textAlign: 'center', borderTop: '1.5px solid #d1d5db', paddingTop: 6, minWidth: 100 }}>
            <p style={{ fontSize: 10, color: '#9ca3af', margin: 0 }}>assinatura</p>
          </div>
        </div>
      )}

      {/* Ações */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <button onClick={onCopiar} style={{
          padding: '9px', borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', background: 'white',
          color: '#6b7280', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, fontWeight: 500,
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
          </svg>
          Copiar
        </button>
        <button onClick={handleExportarPDF} style={{
          padding: '9px', borderRadius: 8, border: '1px solid #d4c9f7', background: '#f3f0fd',
          color: '#6043C1', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, fontWeight: 600,
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
          </svg>
          Exportar PDF
        </button>
      </div>
    </div>
  )
}
