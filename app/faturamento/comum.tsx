'use client'
/** Peças compartilhadas da página de faturamento. */
import React, { useEffect, useRef, useState } from 'react'
import { Building2, FileText, Layers, Send, Info, Check } from 'lucide-react'
import { tokens as T } from '@/lib/design-tokens'
import { Badge, Icon } from '@/components/ui'
import { STATUS_GUIA, STATUS_LOTE, type StatusGuia, type StatusLote } from '@/lib/tiss/tipos'
import { buscarTuss } from '@/lib/tiss/tuss'

export const brl = (n: number | null | undefined) =>
  (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export const dataBR = (s?: string | null) => {
  if (!s) return '—'
  const [a, m, d] = s.slice(0, 10).split('-')
  return `${d}/${m}/${a}`
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
export const competenciaBR = (c: string) => {
  const [a, m] = (c || '').split('-')
  return a && m ? `${MESES[Number(m) - 1]}/${a}` : '—'
}

export function StatusGuiaBadge({ status }: { status: StatusGuia }) {
  const s = STATUS_GUIA[status] || STATUS_GUIA.rascunho
  return <Badge tone={s.tom} dot>{s.label}</Badge>
}
export function StatusLoteBadge({ status }: { status: StatusLote }) {
  const s = STATUS_LOTE[status] || STATUS_LOTE.aberto
  return <Badge tone={s.tom} dot>{s.label}</Badge>
}

/** Aviso honesto sobre o envio (fica em texto discreto). */
export function AvisoEnvio({ style }: { style?: React.CSSProperties }) {
  return (
    <p style={{ display: 'flex', gap: 6, alignItems: 'flex-start', fontSize: 12, color: T.text.quaternary, margin: 0, lineHeight: 1.45, ...style }}>
      <Icon icon={Info} size={14} style={{ flexShrink: 0, marginTop: 1 }} />
      <span>O envio é feito por você no portal ou webservice da operadora, com o XML exportado aqui. Envio automático por webservice não está incluso.</span>
    </p>
  )
}

const PASSOS = [
  { icon: Building2, titulo: 'Cadastre a operadora', texto: 'Registro ANS, seu código de prestador e a tabela de preços.' },
  { icon: FileText, titulo: 'Gere as guias das consultas', texto: 'Paciente, carteirinha e procedimento já vêm preenchidos.' },
  { icon: Layers, titulo: 'Monte o lote', texto: 'Junte as guias prontas da operadora no mês.' },
  { icon: Send, titulo: 'Exporte o XML e envie', texto: 'Envie o arquivo no portal da operadora e acompanhe o retorno.' },
]

/** Estado vazio que ensina o fluxo. `atual` = passo em que a clínica está (1–4). */
export function PassosFluxo({ atual, acao }: { atual: number; acao?: React.ReactNode }) {
  return (
    <div style={{ padding: '28px 8px 20px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        {PASSOS.map((p, i) => {
          const n = i + 1
          const feito = n < atual
          const ativo = n === atual
          return (
            <div key={n} style={{
              border: `1px solid ${ativo ? T.brand.primaryAccent : T.border.default}`, background: ativo ? T.brand.primarySoftBg : T.bg.card,
              borderRadius: 16, padding: 16, display: 'flex', flexDirection: 'column', gap: 8,
            }}>
              <span style={{
                width: 28, height: 28, borderRadius: 9, display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 700,
                background: feito ? T.status.successBg : ativo ? T.brand.primary : T.border.muted,
                color: feito ? T.status.success : ativo ? '#fff' : T.text.secondary,
              }}>{feito ? <Icon icon={Check} size={15} /> : n}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13.5, fontWeight: 700, color: T.text.primary }}>
                <Icon icon={p.icon} size={15} color={ativo ? T.brand.primary : T.text.quaternary} />{p.titulo}
              </div>
              <span style={{ fontSize: 12.5, color: T.text.quaternary, lineHeight: 1.45 }}>{p.texto}</span>
            </div>
          )
        })}
      </div>
      {acao && <div style={{ display: 'flex', justifyContent: 'center', marginTop: 18 }}>{acao}</div>}
    </div>
  )
}

/** Mensagens de erro inline (vermelho) abaixo de um campo. */
export function ErroCampo({ msgs }: { msgs: string[] }) {
  if (!msgs.length) return null
  return <span style={{ fontSize: 12, color: T.status.danger, lineHeight: 1.35 }}>{msgs.join(' ')}</span>
}

export const estiloErro = (tem: boolean): React.CSSProperties =>
  tem ? { borderColor: T.status.danger, boxShadow: `0 0 0 3px ${T.status.dangerBg}` } : {}

/**
 * Campo de código TUSS com autocomplete (tabela de preços da operadora primeiro,
 * depois a lista curada). Popover: raio 14, sombra lg.
 */
export function TussInput({ codigo, onEscolher, onDigitar, extras, erro, placeholder = 'Código ou nome' }: {
  codigo: string
  onEscolher: (i: { codigo: string; descricao: string; valor?: number }) => void
  onDigitar: (codigo: string) => void
  extras: Array<{ codigo: string; descricao: string; valor?: number }>
  erro?: boolean
  placeholder?: string
}) {
  const [aberto, setAberto] = useState(false)
  const [termo, setTermo] = useState(codigo)
  const [foco, setFoco] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => { setTermo(codigo) }, [codigo])
  useEffect(() => {
    const fora = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false) }
    document.addEventListener('mousedown', fora)
    return () => document.removeEventListener('mousedown', fora)
  }, [])
  const itens = aberto ? buscarTuss(termo === codigo && /^\d{8}$/.test(codigo) ? '' : termo, extras, 8) : []
  const escolher = (i: { codigo: string; descricao: string; valor?: number }) => { onEscolher(i); setTermo(i.codigo); setAberto(false) }
  return (
    <div ref={ref} style={{ position: 'relative', minWidth: 0 }}>
      <input
        value={termo}
        placeholder={placeholder}
        className="mono"
        onFocus={() => { setAberto(true); setFoco(0) }}
        onChange={(e) => {
          const v = e.target.value
          setTermo(v); setAberto(true); setFoco(0)
          if (/^\d{0,10}$/.test(v.replace(/[.\-\s]/g, ''))) onDigitar(v.replace(/\D/g, ''))
        }}
        onKeyDown={(e) => {
          if (!itens.length) return
          if (e.key === 'ArrowDown') { e.preventDefault(); setFoco(f => Math.min(itens.length - 1, f + 1)) }
          if (e.key === 'ArrowUp') { e.preventDefault(); setFoco(f => Math.max(0, f - 1)) }
          if (e.key === 'Enter') { e.preventDefault(); escolher(itens[foco]) }
          if (e.key === 'Escape') setAberto(false)
        }}
        style={{
          width: '100%', boxSizing: 'border-box', height: 38, padding: '0 10px', borderRadius: T.radius.input,
          border: `1px solid ${T.border.default}`, fontSize: 13, outline: 'none', background: '#fff', color: T.text.primary,
          ...estiloErro(!!erro),
        }}
      />
      {aberto && itens.length > 0 && (
        <div style={{
          position: 'absolute', zIndex: 20, top: 'calc(100% + 6px)', left: 0, width: 'min(420px, 80vw)', background: '#fff',
          border: `1px solid ${T.border.default}`, borderRadius: T.radius.xl, boxShadow: T.shadow.lg, padding: 6, maxHeight: 300, overflowY: 'auto',
        }}>
          {itens.map((i, k) => (
            <button key={i.codigo} type="button" onMouseDown={(e) => { e.preventDefault(); escolher(i) }} onMouseEnter={() => setFoco(k)}
              style={{
                display: 'flex', width: '100%', gap: 10, alignItems: 'baseline', textAlign: 'left', padding: '8px 10px', border: 'none',
                borderRadius: 9, cursor: 'pointer', fontFamily: 'inherit', background: k === foco ? T.bg.hover : 'transparent',
              }}>
              <span className="mono" style={{ fontSize: 12.5, color: T.brand.primary, fontWeight: 600, flexShrink: 0 }}>{i.codigo}</span>
              <span style={{ flex: 1, fontSize: 12.5, color: T.text.strong, lineHeight: 1.35 }}>{i.descricao}</span>
              {i.daTabela && i.valor ? <span style={{ fontSize: 12, color: T.text.secondary, flexShrink: 0 }}>{brl(i.valor)}</span> : null}
            </button>
          ))}
          <p style={{ margin: '4px 10px 4px', fontSize: 11, color: T.text.tertiary }}>Lista de referência — confira na tabela TUSS vigente e no contrato da operadora.</p>
        </div>
      )}
    </div>
  )
}

/** Estilos responsivos das tabelas da página (viram cartões abaixo de 760px). */
export const CSS_FATURAMENTO = `
.fat-tabela { width: 100%; }
.fat-cab, .fat-linha { display: grid; align-items: center; gap: 12px; padding: 0 14px; }
.fat-cab { height: 38px; font-size: 11px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; color: ${T.text.quaternary}; border-bottom: 1px solid ${T.border.muted}; }
.fat-linha { min-height: 56px; padding-top: 8px; padding-bottom: 8px; border-bottom: 1px solid ${T.border.muted}; font-size: 13px; color: ${T.text.strong}; transition: background .15s; }
.fat-linha:last-child { border-bottom: none; }
.fat-linha.clicavel { cursor: pointer; }
.fat-linha.clicavel:hover { background: ${T.bg.hover}; }
.fat-linha.selecionada { background: ${T.brand.primarySoftBg}; }
.fat-rotulo { display: none; }
.fat-num { font-variant-numeric: tabular-nums; text-align: right; }
@media (max-width: 760px) {
  .fat-cab { display: none; }
  .fat-linha { grid-template-columns: 1fr 1fr !important; gap: 6px 12px; padding: 12px 14px; }
  .fat-linha > .fat-largo { grid-column: 1 / -1; }
  .fat-rotulo { display: block; font-size: 10.5px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; color: ${T.text.tertiary}; }
  .fat-num { text-align: left; }
  .fat-esconde-mobile { display: none !important; }
}
`
