'use client'

import { useMemo, useState } from 'react'
import { tokens } from '@/lib/design-tokens'
import { moeda, moedaCompacta, dataCurta } from '@/lib/financeiro/format'
import type { FluxoDiario } from '@/lib/financeiro/types'

type Props = {
  serie: FluxoDiario[]
  altura?: number
}

/**
 * Chart de fluxo de caixa custom em SVG. Mostra área de receita (verde) e
 * área de despesa invertida (vermelho), com linha de saldo. Hover mostra
 * tooltip com valores do dia.
 *
 * Premium: gradient fill, animação de entrada (path drawing), grid sutil.
 */
export function FluxoCaixaChart({ serie, altura = 220 }: Props) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)

  const { paths, max, ticks, larguraReal } = useMemo(() => {
    const n = Math.max(1, serie.length)
    const padding = { top: 16, right: 16, bottom: 28, left: 56 }
    const w = 800 // viewBox width — escala via CSS
    const h = altura
    const innerW = w - padding.left - padding.right
    const innerH = h - padding.top - padding.bottom

    const maxV = Math.max(
      1,
      ...serie.map((d) => Math.max(d.receita, d.despesa)),
    )

    const xAt = (i: number) => padding.left + (i / Math.max(1, n - 1)) * innerW
    const yAt = (v: number) => padding.top + innerH - (v / maxV) * innerH

    // áreas via path
    const buildArea = (key: 'receita' | 'despesa'): string => {
      if (n === 0) return ''
      const pontos = serie.map((d, i) => `${xAt(i)},${yAt(d[key])}`).join(' L ')
      const base = `M ${padding.left},${padding.top + innerH} L ${pontos} L ${xAt(n - 1)},${padding.top + innerH} Z`
      return base
    }

    const linha = serie.map((d, i) => `${xAt(i)},${yAt(d.saldo > 0 ? d.saldo : 0)}`).join(' ')

    // ticks horizontais (0, 25, 50, 75, 100%)
    const ticksY = [0, 0.25, 0.5, 0.75, 1].map((t) => ({
      y: padding.top + innerH - t * innerH,
      label: moedaCompacta(maxV * t),
    }))

    return {
      paths: {
        receita: buildArea('receita'),
        despesa: buildArea('despesa'),
        saldo: linha,
        xAt,
        yAt,
        padding,
        w,
        h,
        innerW,
        innerH,
      },
      max: maxV,
      ticks: ticksY,
      larguraReal: w,
    }
  }, [serie, altura])

  const total = serie.reduce(
    (acc, d) => ({ receita: acc.receita + d.receita, despesa: acc.despesa + d.despesa }),
    { receita: 0, despesa: 0 },
  )

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <div style={{ display: 'flex', gap: 16, marginBottom: 12, fontSize: 13, flexWrap: 'wrap' }}>
        <LegendItem cor={tokens.status.success}  label="Receita" valor={total.receita} />
        <LegendItem cor={tokens.status.danger}   label="Despesa" valor={total.despesa} />
        <LegendItem cor={tokens.brand.primary}   label="Saldo" valor={total.receita - total.despesa} />
      </div>

      <svg
        viewBox={`0 0 ${paths.w} ${paths.h}`}
        style={{ width: '100%', height: 'auto', display: 'block' }}
        role="img"
        aria-label="Fluxo de caixa diário"
        onMouseLeave={() => setHoverIdx(null)}
      >
        <defs>
          <linearGradient id="gradReceita" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={tokens.status.success} stopOpacity="0.35" />
            <stop offset="100%" stopColor={tokens.status.success} stopOpacity="0" />
          </linearGradient>
          <linearGradient id="gradDespesa" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={tokens.status.danger} stopOpacity="0.28" />
            <stop offset="100%" stopColor={tokens.status.danger} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* grid horizontal */}
        {ticks.map((t, i) => (
          <g key={i}>
            <line
              x1={paths.padding.left}
              x2={paths.padding.left + paths.innerW}
              y1={t.y}
              y2={t.y}
              stroke={tokens.border.subtle}
              strokeWidth={1}
              strokeDasharray={i === 0 ? '' : '3 4'}
            />
            <text
              x={paths.padding.left - 8}
              y={t.y + 4}
              fontSize={11}
              textAnchor="end"
              fill={tokens.text.tertiary}
            >
              {t.label}
            </text>
          </g>
        ))}

        {/* área despesa (atrás) */}
        <path
          d={paths.despesa}
          fill="url(#gradDespesa)"
          stroke={tokens.status.danger}
          strokeWidth={1.5}
          style={{ animation: 'fluxoFadeIn 600ms ease' }}
        />

        {/* área receita (frente) */}
        <path
          d={paths.receita}
          fill="url(#gradReceita)"
          stroke={tokens.status.success}
          strokeWidth={1.8}
          style={{ animation: 'fluxoFadeIn 600ms ease 120ms backwards' }}
        />

        {/* linha de saldo */}
        <polyline
          points={paths.saldo}
          fill="none"
          stroke={tokens.brand.primary}
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="3 5"
          style={{ animation: 'fluxoFadeIn 600ms ease 240ms backwards' }}
        />

        {/* hover overlay */}
        {serie.map((d, i) => (
          <rect
            key={i}
            x={paths.xAt(i) - (paths.innerW / Math.max(1, serie.length - 1)) / 2}
            y={paths.padding.top}
            width={paths.innerW / Math.max(1, serie.length - 1)}
            height={paths.innerH}
            fill="transparent"
            onMouseEnter={() => setHoverIdx(i)}
            style={{ cursor: 'crosshair' }}
          />
        ))}

        {/* linha + ponto do hover */}
        {hoverIdx !== null && serie[hoverIdx] && (
          <>
            <line
              x1={paths.xAt(hoverIdx)}
              x2={paths.xAt(hoverIdx)}
              y1={paths.padding.top}
              y2={paths.padding.top + paths.innerH}
              stroke={tokens.text.tertiary}
              strokeWidth={1}
              strokeDasharray="2 3"
            />
            <circle cx={paths.xAt(hoverIdx)} cy={paths.yAt(serie[hoverIdx].receita)} r={4} fill={tokens.status.success} stroke="#fff" strokeWidth={2} />
            <circle cx={paths.xAt(hoverIdx)} cy={paths.yAt(serie[hoverIdx].despesa)} r={4} fill={tokens.status.danger} stroke="#fff" strokeWidth={2} />
          </>
        )}

        {/* labels eixo X — só algumas pra não poluir */}
        {serie.map((d, i) => {
          if (serie.length > 10 && i % Math.ceil(serie.length / 7) !== 0 && i !== serie.length - 1) return null
          return (
            <text
              key={i}
              x={paths.xAt(i)}
              y={paths.padding.top + paths.innerH + 18}
              fontSize={10}
              textAnchor="middle"
              fill={tokens.text.tertiary}
            >
              {dataCurta(d.data)}
            </text>
          )
        })}
      </svg>

      {hoverIdx !== null && serie[hoverIdx] && (
        <div
          style={{
            position: 'absolute',
            top: 36,
            left: `${(paths.xAt(hoverIdx) / larguraReal) * 100}%`,
            transform: 'translateX(-50%)',
            background: tokens.bg.card,
            border: `1px solid ${tokens.border.default}`,
            borderRadius: tokens.radius.lg,
            padding: '10px 12px',
            boxShadow: tokens.shadow.lg,
            fontSize: 12,
            pointerEvents: 'none',
            zIndex: 5,
            minWidth: 160,
          }}
        >
          <div style={{ fontWeight: 600, color: tokens.text.primary, marginBottom: 6, fontSize: 13 }}>
            {dataCurta(serie[hoverIdx].data)}
          </div>
          <Row label="Receita" valor={moeda(serie[hoverIdx].receita)} cor={tokens.status.success} />
          <Row label="Despesa" valor={moeda(serie[hoverIdx].despesa)} cor={tokens.status.danger} />
          <Row label="Saldo"   valor={moeda(serie[hoverIdx].saldo)}   cor={tokens.brand.primary} />
        </div>
      )}

      <style>{`@keyframes fluxoFadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  )
}

function LegendItem({ cor, label, valor }: { cor: string; label: string; valor: number }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <span aria-hidden style={{ width: 9, height: 9, borderRadius: '50%', background: cor }} />
      <span style={{ color: tokens.text.tertiary }}>{label}</span>
      <strong style={{ color: tokens.text.primary, fontWeight: 600 }}>{moeda(valor)}</strong>
    </div>
  )
}

function Row({ label, valor, cor }: { label: string; valor: string; cor: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, padding: '2px 0' }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: tokens.text.secondary }}>
        <span aria-hidden style={{ width: 8, height: 8, borderRadius: '50%', background: cor }} />
        {label}
      </span>
      <strong style={{ color: tokens.text.primary, fontWeight: 600 }}>{valor}</strong>
    </div>
  )
}
