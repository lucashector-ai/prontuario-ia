'use client'
import { log } from '@/lib/logger'

import { useLayoutEffect, useRef } from 'react'
import { TriangleAlert, Sparkles, Tag, History } from 'lucide-react'
import { tokens } from '@/lib/design-tokens'
import { Badge, Icon } from '@/components/ui'

const T = tokens

interface CID { codigo: string; descricao: string; justificativa: string }
interface Hipotese { nome: string; probabilidade: string; justificativa: string }
interface Prontuario { subjetivo: string; objetivo: string; avaliacao: string; plano: string; cids: CID[]; alertas: string[]; hipoteses?: Hipotese[]; resumo_copiloto?: string }
interface Insight { tipo: string; texto: string }
interface Props {
  prontuario: Prontuario
  onCopiar?: () => void
  nomeMedico?: string
  crm?: string
  medico?: any
  pacienteId?: string
  insights?: Insight[]
  padroes?: string
  totalConsultas?: number
  /** Quando informado, as seções SOAP viram campos editáveis. */
  onEditarSecao?: (key: 'subjetivo' | 'objetivo' | 'avaliacao' | 'plano', valor: string) => void
}

const secoes = [
  { key: 'subjetivo', letra: 'S', titulo: 'Subjetivo' },
  { key: 'objetivo', letra: 'O', titulo: 'Objetivo' },
  { key: 'avaliacao', letra: 'A', titulo: 'Avaliação' },
  { key: 'plano', letra: 'P', titulo: 'Plano' },
] as const

/** Abre o prontuário em HTML para impressão/PDF (mesma chamada que o card fazia antes). */
export async function exportarProntuarioPdf(prontuario: any, medico: any) {
  try {
    const res = await fetch('/api/pdf', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prontuario, medico }),
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

function Rotulo({ children }: { children: React.ReactNode }) {
  return <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: T.text.tertiary }}>{children}</span>
}

function TileLetra({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      width: 30, height: 30, borderRadius: 10, background: T.brand.primarySubtle, color: T.brand.primary,
      display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0,
    }}>{children}</span>
  )
}

/** Textarea sem borda que cresce com o conteúdo. */
function TextoEditavel({ valor, onChange }: { valor: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }, [valor])
  return (
    <textarea
      ref={ref}
      value={valor}
      onChange={e => onChange(e.target.value)}
      rows={2}
      style={{
        width: '100%', boxSizing: 'border-box', border: 'none', outline: 'none', resize: 'none', background: 'transparent',
        padding: 0, margin: 0, fontSize: 13.5, lineHeight: 1.65, color: T.text.strong, fontFamily: 'inherit', minHeight: 44,
        overflow: 'hidden',
      }}
    />
  )
}

const PROB: Record<string, { tone: 'danger' | 'pending' | 'success'; label: string }> = {
  alta: { tone: 'danger', label: 'Alta' },
  media: { tone: 'pending', label: 'Média' },
  baixa: { tone: 'success', label: 'Baixa' },
}

export function ProntuarioCard({ prontuario, nomeMedico, crm, insights, padroes, totalConsultas, onEditarSecao }: Props) {
  const hoje = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
  const corInsight = (tipo: string) => tipo === 'alerta' ? T.status.danger : tipo === 'melhora' ? T.status.success : tipo === 'piora' ? T.status.warning : T.brand.primary
  const iconeInsight = (tipo: string) => tipo === 'recorrencia' ? '↻' : tipo === 'melhora' ? '↑' : tipo === 'piora' ? '↓' : tipo === 'alerta' ? '!' : '+'

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {(prontuario.alertas?.length > 0 || prontuario.resumo_copiloto) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 12 }}>
          {prontuario.alertas?.length > 0 && (
            <div style={{ display: 'flex', gap: 10, padding: '12px 14px', borderRadius: 12, background: T.status.dangerBg, color: T.status.danger }}>
              <Icon icon={TriangleAlert} size={16} style={{ marginTop: 1 }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>Alertas clínicos</span>
                {prontuario.alertas.map((a, i) => (
                  <span key={i} style={{ fontSize: 12.5, lineHeight: 1.5, color: T.status.dangerDark }}>{a}</span>
                ))}
              </div>
            </div>
          )}
          {prontuario.resumo_copiloto && (
            <div style={{ display: 'flex', gap: 10, padding: '12px 14px', borderRadius: 12, background: T.brand.primarySubtle, color: T.brand.primary }}>
              <Icon icon={Sparkles} size={16} style={{ marginTop: 1 }} />
              <p style={{ fontSize: 12.5, color: T.brand.primaryDark, margin: 0, lineHeight: 1.5 }}>
                <strong style={{ fontWeight: 700 }}>Copiloto:</strong> {prontuario.resumo_copiloto}
              </p>
            </div>
          )}
        </div>
      )}

      {secoes.map(({ key, letra, titulo }) => (
        <div key={key} style={{ display: 'flex', gap: 14, padding: '16px 0', borderBottom: `1px solid ${T.border.muted}` }}>
          <TileLetra>{letra}</TileLetra>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Rotulo>{titulo}</Rotulo>
            {onEditarSecao ? (
              <TextoEditavel valor={(prontuario as any)[key] || ''} onChange={v => onEditarSecao(key, v)} />
            ) : (
              <p style={{ fontSize: 13.5, color: T.text.strong, lineHeight: 1.65, margin: 0, whiteSpace: 'pre-line' }}>
                {(prontuario as any)[key] || 'Não mencionado na consulta'}
              </p>
            )}
          </div>
        </div>
      ))}

      {prontuario.cids?.length > 0 && (
        <div style={{ display: 'flex', gap: 14, padding: '16px 0', borderBottom: `1px solid ${T.border.muted}` }}>
          <TileLetra><Icon icon={Tag} size={15} /></TileLetra>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Rotulo>CID-10 sugeridos</Rotulo>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {prontuario.cids.map((cid, i) => (
                <span key={i} title={cid.justificativa || undefined} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8, padding: '7px 11px', borderRadius: 10,
                  border: `1px solid ${T.border.default}`, fontSize: 13, color: T.text.primary,
                }}>
                  <span className="mono" style={{ fontSize: 11.5, fontWeight: 500, color: T.brand.primary }}>{cid.codigo}</span>
                  {cid.descricao}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {prontuario.hipoteses && prontuario.hipoteses.length > 0 && (
        <div style={{ display: 'flex', gap: 14, padding: '16px 0', borderBottom: `1px solid ${T.border.muted}` }}>
          <TileLetra>H</TileLetra>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Rotulo>Hipóteses diagnósticas</Rotulo>
            {prontuario.hipoteses.map((h, i) => {
              const p = PROB[(h.probabilidade || '').toLowerCase()]
              return (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13.5, fontWeight: 700, color: T.text.primary }}>{h.nome}</span>
                    {h.probabilidade && <Badge tone={p?.tone || 'neutral'}>{p?.label || h.probabilidade}</Badge>}
                  </span>
                  {h.justificativa && <span style={{ fontSize: 12.5, color: T.text.secondary, lineHeight: 1.5 }}>{h.justificativa}</span>}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {insights && insights.length > 0 && (
        <div style={{ display: 'flex', gap: 14, padding: '16px 0', borderBottom: `1px solid ${T.border.muted}` }}>
          <TileLetra><Icon icon={History} size={15} /></TileLetra>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Rotulo>Histórico comparativo</Rotulo>
              {totalConsultas ? <span style={{ fontSize: 11.5, color: T.text.tertiary }}>{totalConsultas} consulta{totalConsultas !== 1 ? 's' : ''} anteriores</span> : null}
            </span>
            {padroes && <p style={{ fontSize: 12.5, color: T.text.secondary, margin: 0, lineHeight: 1.5 }}>{padroes}</p>}
            {insights.map((ins, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: corInsight(ins.tipo), flexShrink: 0, width: 14 }}>{iconeInsight(ins.tipo)}</span>
                <p style={{ fontSize: 12.5, color: T.text.strong, margin: 0, lineHeight: 1.5 }}>{ins.texto}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Assinatura */}
      {nomeMedico && (
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, padding: '16px 0 4px' }}>
          <div>
            <p style={{ fontSize: 11.5, color: T.text.tertiary, margin: '0 0 2px' }}>{hoje}</p>
            <p style={{ fontSize: 13.5, fontWeight: 600, color: T.text.primary, margin: 0 }}>{nomeMedico}</p>
            {crm && <p className="mono" style={{ fontSize: 11.5, color: T.text.tertiary, margin: 0 }}>{crm}</p>}
          </div>
          <div style={{ textAlign: 'center', borderTop: `1px solid ${T.border.strong}`, paddingTop: 6, minWidth: 120 }}>
            <p style={{ fontSize: 11, color: T.text.tertiary, margin: 0 }}>assinatura</p>
          </div>
        </div>
      )}
    </div>
  )
}
