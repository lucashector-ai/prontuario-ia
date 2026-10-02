'use client'
/** Peças compartilhadas pelas seções de Relatórios (seção, KPI, dica, skeleton). */
import { useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { ArrowUpRight, ArrowDownRight, Minus, FileSpreadsheet, Info } from 'lucide-react'
import { tokens } from '@/lib/design-tokens'
import { Button, IconTile, Icon } from '@/components/ui'

export const T = tokens

export function Secao({ id, titulo, descricao, acoes, onCsv, children }: {
  id: string
  titulo: string
  descricao?: string
  acoes?: React.ReactNode
  onCsv?: () => void
  children: React.ReactNode
}) {
  return (
    <section id={id} className="rel-secao" aria-labelledby={`${id}-titulo`} style={{
      background: '#fff', border: `1px solid ${T.border.default}`, borderRadius: 16, padding: 18,
      display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0, scrollMarginTop: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 220px', minWidth: 0 }}>
          <h2 id={`${id}-titulo`} style={{ margin: 0, fontSize: 16, fontWeight: 700, letterSpacing: '-.01em', color: T.text.primary }}>{titulo}</h2>
          {descricao && <p style={{ margin: '3px 0 0', fontSize: 12.5, color: T.text.quaternary, lineHeight: 1.45 }}>{descricao}</p>}
        </div>
        <div className="rel-noprint" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {acoes}
          {onCsv && <Button size="sm" variant="secondary" icon={FileSpreadsheet} onClick={onCsv} aria-label={`Exportar ${titulo} em CSV`}>CSV</Button>}
        </div>
      </div>
      {children}
    </section>
  )
}

/** Tooltip escuro no hover/foco (padrão do dashboard). */
export function Dica({ conteudo, children, largura = 220, lado = 'cima', style, rotulo }: {
  conteudo: React.ReactNode
  children: React.ReactNode
  largura?: number
  lado?: 'cima' | 'baixo'
  style?: React.CSSProperties
  rotulo?: string
}) {
  const [on, setOn] = useState(false)
  return (
    <span
      tabIndex={0}
      aria-label={rotulo}
      onMouseEnter={() => setOn(true)} onMouseLeave={() => setOn(false)}
      onFocus={() => setOn(true)} onBlur={() => setOn(false)}
      style={{ position: 'relative', display: 'inline-flex', outline: 'none', ...style }}
    >
      {children}
      {on && (
        <span role="tooltip" style={{
          position: 'absolute', left: '50%', transform: 'translateX(-50%)', zIndex: 30, width: 'max-content',
          maxWidth: `min(${largura}px, 80vw)`, ...(lado === 'cima' ? { bottom: 'calc(100% + 8px)' } : { top: 'calc(100% + 8px)' }),
          background: T.night[800], color: '#fff', borderRadius: 10, padding: '9px 11px', fontSize: 12, lineHeight: 1.45,
          fontWeight: 500, textAlign: 'left', boxShadow: '0 12px 28px -8px rgba(28,27,34,.4)', pointerEvents: 'none',
          whiteSpace: 'normal', letterSpacing: 0, textTransform: 'none',
        }}>{conteudo}</span>
      )}
    </span>
  )
}

export function InfoDica({ texto, largura = 260 }: { texto: React.ReactNode; largura?: number }) {
  return (
    <Dica conteudo={texto} largura={largura} rotulo="Como é calculado" lado="baixo">
      <Info size={13} strokeWidth={1.6} color={T.text.tertiary} style={{ cursor: 'help' }} aria-hidden />
    </Dica>
  )
}

/** KPI com variação; `bomQuando` define se subir é bom (verde) ou ruim (vermelho). */
export function KpiRel({ label, valor, sub, delta, sinal = 0, bomQuando = 'maior', comparacao, icon, cor, carregando, dica }: {
  label: string
  valor: React.ReactNode
  sub?: React.ReactNode
  delta?: string
  sinal?: -1 | 0 | 1
  bomQuando?: 'maior' | 'menor'
  comparacao?: string
  icon: LucideIcon
  cor: string
  carregando?: boolean
  dica?: React.ReactNode
}) {
  const bom = sinal === 0 ? null : (sinal > 0) === (bomQuando === 'maior')
  const [c, b] = bom === null ? [T.text.quaternary, T.border.muted] : bom ? [T.status.success, T.status.successBg] : [T.status.danger, T.status.dangerBg]
  const Seta = sinal > 0 ? ArrowUpRight : sinal < 0 ? ArrowDownRight : Minus
  return (
    <div className="rel-kpi" style={{
      flex: '1 1 180px', minWidth: 0, background: '#fff', borderRadius: 16, padding: '16px 16px 16px 18px',
      border: `1px solid ${T.border.default}`, display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
        <span style={{ paddingTop: 8, fontSize: 13, fontWeight: 700, color: T.text.strong, display: 'flex', gap: 5, alignItems: 'flex-start' }}>
          {label}{dica && <InfoDica texto={dica} />}
        </span>
        <IconTile icon={icon} color={cor} size={34} />
      </div>
      {carregando ? (
        <>
          <div className="c360-skel" style={{ marginTop: 12, height: 26, width: '50%', borderRadius: 8 }} />
          <div className="c360-skel" style={{ marginTop: 10, height: 20, width: '75%', borderRadius: 8 }} />
        </>
      ) : (
        <>
          <div style={{ marginTop: 12, display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.03em', lineHeight: 1, color: T.text.primary, fontVariantNumeric: 'tabular-nums' }}>{valor}</span>
            {sub && <span style={{ fontSize: 12.5, color: T.text.quaternary }}>{sub}</span>}
          </div>
          <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {delta ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, height: 22, padding: '0 7px 0 5px', borderRadius: 7, background: b, color: c, fontSize: 12, fontWeight: 600 }}>
                <Icon icon={Seta} size={13} />{delta}
              </span>
            ) : (
              <span style={{ fontSize: 12, color: T.text.tertiary }}>sem base de comparação</span>
            )}
            {delta && comparacao && <span className="rel-kpi-cmp" style={{ fontSize: 12, color: T.text.tertiary }}>{comparacao}</span>}
          </div>
        </>
      )}
    </div>
  )
}

export function SkeletonBloco({ altura = 200 }: { altura?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }} aria-busy="true" aria-label="Carregando">
      <span className="c360-skel" style={{ height: 14, width: '40%', borderRadius: 6 }} />
      <span className="c360-skel" style={{ height: altura, borderRadius: 12 }} />
    </div>
  )
}

export const nf = (n: number) => n.toLocaleString('pt-BR')
export const pctTxt = (v: number | null, casas = 0) => v === null ? '—' : `${(v * 100).toFixed(casas).replace('.', ',')}%`
export const horasTxt = (min: number) => {
  const h = Math.floor(min / 60), m = Math.round(min % 60)
  return h ? `${h}h${m ? String(m).padStart(2, '0') : ''}` : `${m} min`
}
