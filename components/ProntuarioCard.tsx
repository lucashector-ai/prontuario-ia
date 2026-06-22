'use client'
import { log } from '@/lib/logger'


import { tokens } from '@/lib/design-tokens'
interface CID { codigo: string; descricao: string; justificativa: string }
interface Hipotese { nome: string; probabilidade: string; justificativa: string }
interface Prontuario { subjetivo: string; objetivo: string; avaliacao: string; plano: string; cids: CID[]; alertas: string[]; hipoteses?: Hipotese[]; resumo_copiloto?: string }
interface Insight { tipo: string; texto: string }
interface Props { prontuario: Prontuario; onCopiar: () => void; nomeMedico?: string; crm?: string; medico?: any; pacienteId?: string; insights?: Insight[]; padroes?: string; totalConsultas?: number }

const secoes = [
  { key: 'subjetivo', letra: 'S', titulo: 'Subjetivo', sub: 'Queixas e história', cor: tokens.status.infoStrong, bg: tokens.status.infoBg, border: tokens.status.infoLight },
  { key: 'objetivo',  letra: 'O', titulo: 'Objetivo',  sub: 'Exame físico',        cor: tokens.status.infoTeal, bg: tokens.status.infoTealBg, border: tokens.status.infoTealLight },
  { key: 'avaliacao', letra: 'A', titulo: 'Avaliação',  sub: 'Hipótese diagnóstica', cor: tokens.appointment.retorno.dot, bg: tokens.appointment.exame.bg, border: tokens.appointment.exame.border },
  { key: 'plano',     letra: 'P', titulo: 'Plano',      sub: 'Conduta e prescrição', cor: tokens.brand.primary, bg: tokens.brand.primaryLighter, border: tokens.brand.primaryAccent },
]

export function ProntuarioCard({ prontuario, onCopiar, nomeMedico, crm, medico, pacienteId, insights, padroes, totalConsultas }: Props) {
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
    } catch (e) { log.error(e) }
  }

  const corHipotese = (p: string) => p === 'alta' ? { bg: tokens.status.dangerBg, cor: tokens.status.danger, border: tokens.status.dangerLight } : p === 'media' ? { bg: tokens.status.warningBgAlt, cor: tokens.status.warningAlt, border: tokens.status.warningLightAlt } : { bg: tokens.status.successBg, cor: tokens.status.success, border: tokens.status.successLight }
  const iconeInsight = (tipo: string) => tipo === 'recorrencia' ? '↻' : tipo === 'melhora' ? '↑' : tipo === 'piora' ? '↓' : tipo === 'alerta' ? '!' : '+'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {prontuario.alertas?.length > 0 && (
        <div style={{ background: tokens.status.dangerBg, border: `1px solid ${tokens.status.dangerLight}`, borderLeft: `4px solid ${tokens.status.danger}`, borderRadius: '0 10px 10px 0', padding: '12px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={tokens.status.danger} strokeWidth="2">
              <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
            </svg>
            <span style={{ fontSize: 11, fontWeight: 700, color: tokens.status.danger, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Alertas clínicos</span>
          </div>
          {prontuario.alertas.map((a, i) => (
            <p key={i} style={{ fontSize: 12, color: tokens.status.dangerHover, margin: '3px 0', display: 'flex', gap: 6 }}><span>·</span>{a}</p>
          ))}
        </div>
      )}

      {prontuario.resumo_copiloto && (
        <div style={{ background: tokens.brand.primaryLight, borderLeft: `4px solid ${tokens.brand.primary}`, borderRadius: '0 10px 10px 0', padding: '10px 14px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={tokens.brand.primary} strokeWidth="2" style={{flexShrink:0,marginTop:1}}><path d="M12 2a10 10 0 100 20 10 10 0 000-20zm0 5v6m0 3h.01"/></svg>
          <p style={{ fontSize: 12, color: tokens.brand.primaryDark, margin: 0, lineHeight: 1.5 }}><strong>Copiloto:</strong> {prontuario.resumo_copiloto}</p>
        </div>
      )}

      {prontuario.hipoteses && prontuario.hipoteses.length > 0 && (
        <div style={{ background: 'white', borderRadius: 10, padding: '12px 14px' }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: tokens.text.tertiary, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 10px' }}>Hipóteses diagnósticas</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {prontuario.hipoteses.map((h, i) => {
              const c = corHipotese(h.probabilidade)
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 10px', background: c.bg, border: `1px solid ${c.border}`, borderRadius: 8 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: c.cor, background: 'white', padding: '2px 7px', borderRadius: 10, border: `1px solid ${c.border}`, flexShrink: 0, textTransform: 'uppercase' }}>{h.probabilidade}</span>
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 600, color: tokens.text.primary, margin: 0 }}>{h.nome}</p>
                    <p style={{ fontSize: 11, color: tokens.text.secondary, margin: '2px 0 0' }}>{h.justificativa}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {(insights && insights.length > 0) && (
        <div style={{ background: 'white', borderRadius: 10, padding: '12px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: tokens.text.tertiary, letterSpacing: '0.08em', textTransform: 'uppercase', margin: 0 }}>Histórico comparativo</p>
            {totalConsultas && <span style={{ fontSize: 11, color: tokens.text.tertiary }}>{totalConsultas} consulta{totalConsultas !== 1 ? 's' : ''} anteriores</span>}
          </div>
          {padroes && <p style={{ fontSize: 12, color: tokens.text.secondary, margin: '0 0 10px', lineHeight: 1.5, fontStyle: 'italic' }}>{padroes}</p>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {insights.map((ins, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: ins.tipo === 'alerta' ? tokens.status.danger : ins.tipo === 'melhora' ? tokens.status.success : ins.tipo === 'piora' ? tokens.status.warningAlt : tokens.brand.primary, flexShrink: 0, width: 16 }}>{iconeInsight(ins.tipo)}</span>
                <p style={{ fontSize: 12, color: tokens.text.strong, margin: 0, lineHeight: 1.5 }}>{ins.texto}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {secoes.map(({ key, letra, titulo, sub, cor, bg, border }) => (
        <div key={key} style={{ background: bg, border: `1px solid ${border}`, borderRadius: 10, padding: '12px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{ width: 26, height: 26, borderRadius: 7, background: cor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: 'white', flexShrink: 0 }}>{letra}</div>
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, color: tokens.text.primary, margin: 0 }}>{titulo}</p>
              <p style={{ fontSize: 10, color: tokens.text.tertiary, margin: 0 }}>{sub}</p>
            </div>
          </div>
          <p style={{ fontSize: 13, color: tokens.text.strong, lineHeight: 1.7, margin: 0, paddingLeft: 36, whiteSpace: 'pre-line' }}>
            {(prontuario as any)[key] || 'Não mencionado na consulta'}
          </p>
        </div>
      ))}

      {prontuario.cids?.length > 0 && (
        <div style={{ background: tokens.bg.hover, borderRadius: 10, padding: '12px 14px' }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: tokens.text.tertiary, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 10px' }}>CID-10 sugeridos</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {prontuario.cids.map((cid, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: 'white', borderRadius: 8, padding: '8px 10px' }}>
                <span style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 700, color: tokens.brand.primary, background: tokens.brand.primaryLighter, padding: '2px 8px', borderRadius: 5, flexShrink: 0 }}>{cid.codigo}</span>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: tokens.text.primary, margin: 0 }}>{cid.descricao}</p>
                  <p style={{ fontSize: 11, color: tokens.text.tertiary, margin: '2px 0 0' }}>{cid.justificativa}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Assinatura */}
      {nomeMedico && (
        <div style={{ background: 'white', borderRadius: 10, padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontSize: 10, color: tokens.text.tertiary, margin: '0 0 2px' }}>{hoje}</p>
            <p style={{ fontSize: 13, fontWeight: 600, color: tokens.text.primary, margin: 0 }}>{nomeMedico}</p>
            {crm && <p style={{ fontSize: 11, color: tokens.text.tertiary, margin: 0 }}>{crm}</p>}
          </div>
          <div style={{ textAlign: 'center', borderTop: `1.5px solid ${tokens.border.strong}`, paddingTop: 6, minWidth: 100 }}>
            <p style={{ fontSize: 10, color: tokens.text.tertiary, margin: 0 }}>assinatura</p>
          </div>
        </div>
      )}

      {/* Ações */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <button onClick={onCopiar} style={{
          padding: '9px', borderRadius: 8, background: 'white',
          color: tokens.text.secondary, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, fontWeight: 500,
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
          </svg>
          Copiar
        </button>
        <button onClick={handleExportarPDF} style={{
          padding: '9px', borderRadius: 8, background: tokens.brand.primaryLighter,
          color: tokens.brand.primary, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, fontWeight: 600,
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
