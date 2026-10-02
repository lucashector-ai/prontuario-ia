'use client'
import { useState } from 'react'
import { PieChart } from 'lucide-react'
import { EmptyState } from '@/components/ui'
import { ConvenioBadge } from '@/components/ConvenioBadge'
import { corConvenio } from '@/lib/convenios'
import type { LinhaConvenio } from '@/lib/relatorios/calculos'
import { MESES_CURTOS } from '@/lib/relatorios/periodo'
import { Secao, SkeletonBloco, T, nf, pctTxt } from './comuns'
import { corTaxaFalta } from './PorMedico'

export interface Evolucao { series: string[]; meses: { ini: Date; valores: Record<string, number>; total: number }[] }

const cor = (nome: string) => corConvenio(nome === 'Outros' ? 'Outro' : nome)

export function Convenios({ linhas, evolucao, carregando, onCsv }: {
  linhas: LinhaConvenio[]
  evolucao: Evolucao | null
  carregando: boolean
  onCsv: () => void
}) {
  const max = Math.max(1, ...linhas.map(l => l.atendimentos))
  return (
    <Secao id="convenios" titulo="Convênios" descricao="Atendimentos (agendamentos não cancelados) pelo convênio do paciente." onCsv={onCsv}>
      {carregando ? <SkeletonBloco altura={200} /> : linhas.length === 0 ? (
        <EmptyState icon={PieChart} titulo="Sem atendimentos no período" descricao="A divisão por convênio aparece quando houver consultas agendadas." />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: 24, alignItems: 'start' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto auto', columnGap: 12, rowGap: 4, alignItems: 'center', fontSize: 13 }}>
              <span style={th}>Convênio</span><span style={{ ...th, textAlign: 'right' }}>Atend.</span><span style={{ ...th, textAlign: 'right' }}>Faltas</span>
              {linhas.map(l => (
                <Linha key={l.nome} l={l} max={max} />
              ))}
            </div>
          </div>
          {evolucao && <GraficoMensal ev={evolucao} />}
        </div>
      )}
    </Secao>
  )
}

const th: React.CSSProperties = { fontSize: 11, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: T.text.tertiary, paddingBottom: 6 }

function Linha({ l, max }: { l: LinhaConvenio; max: number }) {
  return (
    <>
      <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5, padding: '6px 0' }}>
        <ConvenioBadge convenio={l.nome} size="sm" style={{ alignSelf: 'flex-start' }} />
        <div style={{ height: 6, borderRadius: 99, background: T.border.muted, overflow: 'hidden' }} aria-hidden>
          <div style={{ height: '100%', width: `${(l.atendimentos / max) * 100}%`, background: cor(l.nome), borderRadius: 99 }} />
        </div>
      </div>
      <span style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
        <b>{nf(l.atendimentos)}</b> <span style={{ fontSize: 12, color: T.text.quaternary }}>{pctTxt(l.parte)}</span>
      </span>
      <span style={{ textAlign: 'right', fontSize: 12.5, fontWeight: 600, color: corTaxaFalta(l.taxaFalta) }}>{pctTxt(l.taxaFalta)}</span>
    </>
  )
}

function GraficoMensal({ ev }: { ev: Evolucao }) {
  const [hover, setHover] = useState<number | null>(null)
  const max = Math.max(1, ...ev.meses.map(m => m.total))
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: T.text.tertiary, marginBottom: 10 }}>Evolução mensal</div>
      <div role="img" aria-label={`Atendimentos por convênio nos últimos ${ev.meses.length} meses: ${ev.meses.map(m => `${MESES_CURTOS[m.ini.getMonth()]} ${m.total}`).join(', ')}`}
        style={{ height: 200, display: 'flex', gap: 10 }} onMouseLeave={() => setHover(null)}>
        {ev.meses.map((m, i) => {
          const on = hover === i
          return (
            <div key={i} onMouseEnter={() => setHover(i)} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, position: 'relative' }}>
              <div style={{ flex: 1, width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', gap: 5 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: on ? T.text.primary : T.text.tertiary }}>{m.total || ''}</span>
                <div style={{
                  width: '100%', maxWidth: 38, height: m.total ? `${(m.total / max) * 82}%` : 4, borderRadius: 8, overflow: 'hidden',
                  display: 'flex', flexDirection: 'column-reverse', gap: 2, background: m.total ? 'transparent' : T.border.default,
                  opacity: hover !== null && !on ? 0.5 : 1, transition: 'opacity .15s, height .4s',
                }}>
                  {ev.series.map(s => m.valores[s] > 0 && (
                    <div key={s} style={{ height: `calc(${(m.valores[s] / m.total) * 100}% - 2px)`, minHeight: 2, background: cor(s), flexShrink: 0 }} />
                  ))}
                </div>
              </div>
              <span style={{ fontSize: 12, color: on ? T.text.primary : T.text.tertiary, fontWeight: on ? 700 : 500 }}>{MESES_CURTOS[m.ini.getMonth()]}</span>
              {on && m.total > 0 && (
                <div role="tooltip" style={{
                  position: 'absolute', top: 0, zIndex: 5, ...(i < ev.meses.length / 2 ? { left: 'calc(50% + 22px)' } : { right: 'calc(50% + 22px)' }),
                  background: T.night[800], color: '#fff', borderRadius: 12, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6,
                  minWidth: 170, boxShadow: '0 12px 28px -8px rgba(28,27,34,.4)', pointerEvents: 'none',
                }}>
                  <div style={{ fontSize: 11.5, color: T.text.tertiary }}>{MESES_CURTOS[m.ini.getMonth()]} {m.ini.getFullYear()} · {m.total} atendimentos</div>
                  {ev.series.map(s => (
                    <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 3, background: cor(s) }} />
                      <span style={{ flex: 1, fontSize: 12, color: '#C3C1CC' }}>{s}</span>
                      <span style={{ fontSize: 12.5, fontWeight: 700 }}>{m.valores[s]}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 10, fontSize: 11.5, color: T.text.secondary }}>
        {ev.series.map(s => (
          <span key={s} style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: 3, background: cor(s) }} />{s}</span>
        ))}
      </div>
    </div>
  )
}
