'use client'
import { Lightbulb, UserX } from 'lucide-react'
import { EmptyState } from '@/components/ui'
import type { CelulaFalta } from '@/lib/relatorios/calculos'
import { BASE_MINIMA, DIAS_CURTOS, DIAS_PLURAL, faixaHoras } from '@/lib/relatorios/calculos'
import { Dica, Secao, SkeletonBloco, T, nf, pctTxt } from './comuns'

const BASE = 'oklch(0.62 0.19 20)'
const FAIXAS = [
  { ate: 0.05, mix: 12, label: '< 5%' },
  { ate: 0.1, mix: 30, label: '5–10%' },
  { ate: 0.15, mix: 50, label: '10–15%' },
  { ate: 0.25, mix: 72, label: '15–25%' },
  { ate: Infinity, mix: 95, label: '≥ 25%' },
]
const corFaixa = (t: number) => {
  const f = FAIXAS.find(x => t < x.ate) || FAIXAS[FAIXAS.length - 1]
  return { bg: `color-mix(in oklch, ${BASE} ${f.mix}%, white)`, escuro: f.mix >= 50 }
}

export function Faltas({ mapa, ranking, insights, carregando, onCsv }: {
  mapa: CelulaFalta[][]
  ranking: { dia: number; hora: number; faltas: number; base: number; taxa: number }[]
  insights: string[]
  carregando: boolean
  onCsv: () => void
}) {
  const totalBase = mapa.flat().reduce((s, c) => s + c.base, 0)
  const horas = faixaHoras(mapa)
  const dias = [1, 2, 3, 4, 5, 6, 0].filter(d => d >= 1 && d <= 5 || mapa[d]?.some(c => c.base > 0))
  const maxFaltas = Math.max(1, ...ranking.map(r => r.faltas))

  return (
    <Secao id="faltas" titulo="Faltas" descricao="Taxa de falta por dia da semana e horário (faltas ÷ realizados + faltas)." onCsv={onCsv}>
      {carregando ? <SkeletonBloco altura={220} /> : totalBase === 0 ? (
        <EmptyState icon={UserX} titulo="Sem atendimentos com desfecho no período"
          descricao="Marque os agendamentos como realizado ou faltou na agenda para ver onde as faltas se concentram." />
      ) : (
        <>
          {insights.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 14px', borderRadius: 14, background: T.brand.primarySoftBg, border: `1px solid ${T.brand.primaryAccentLight}` }}>
              {insights.map((t, i) => (
                <div key={i} style={{ display: 'flex', gap: 9, alignItems: 'flex-start', fontSize: 13, lineHeight: 1.5, color: T.text.strong }}>
                  <Lightbulb size={15} strokeWidth={1.6} color={T.brand.primary} style={{ flexShrink: 0, marginTop: 2 }} aria-hidden />
                  <span>{t}</span>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 22, alignItems: 'flex-start' }}>
            {/* Mapa de calor */}
            <div style={{ minWidth: 0, flex: '2 1 440px' }}>
              <style dangerouslySetInnerHTML={{ __html: `@media (max-width: 759px) { .rel-mapa-h-impar { visibility: hidden; } }` }} />
              <div role="img" aria-label={`Mapa de calor da taxa de falta por dia e hora. Maior concentração: ${ranking[0] ? `${DIAS_PLURAL[ranking[0].dia]} às ${ranking[0].hora}h, ${pctTxt(ranking[0].taxa)}` : 'sem dados'}.`}
                style={{ display: 'grid', gridTemplateColumns: `34px repeat(${horas.length}, minmax(0, 1fr))`, gap: 3 }}>
                <span />
                {horas.map((h, k) => (
                  <span key={h} className={k % 2 ? 'rel-mapa-h-impar' : undefined} style={{ fontSize: 10.5, color: T.text.tertiary, textAlign: 'center' }}>{h}h</span>
                ))}
                {dias.map(d => (
                  <Linha key={d} d={d} horas={horas} mapa={mapa} />
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 12, fontSize: 11.5, color: T.text.quaternary }}>
                <span>Taxa de falta</span>
                {FAIXAS.map(f => (
                  <span key={f.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 12, height: 12, borderRadius: 3, background: `color-mix(in oklch, ${BASE} ${f.mix}%, white)` }} />{f.label}
                  </span>
                ))}
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 12, height: 12, borderRadius: 3, background: T.bg.page, border: `1px dashed ${T.border.strong}`, boxSizing: 'border-box' }} />poucos dados
                </span>
              </div>
            </div>

            {/* Ranking */}
            <div style={{ minWidth: 0, flex: '1 1 260px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: T.text.tertiary, marginBottom: 10 }}>Horários com mais faltas</div>
              {ranking.length === 0 ? (
                <p style={{ fontSize: 13, color: T.text.quaternary, margin: 0 }}>Nenhum horário com faltas suficientes para ranquear.</p>
              ) : (
                <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {ranking.map((r, i) => (
                    <li key={`${r.dia}-${r.hora}`} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 13 }}>
                        <span style={{ width: 16, color: T.text.tertiary, fontWeight: 700, fontSize: 12 }}>{i + 1}</span>
                        <span style={{ flex: 1, fontWeight: 600, color: T.text.strong }}>{DIAS_CURTOS[r.dia]} · <span className="mono">{String(r.hora).padStart(2, '0')}h</span></span>
                        <span style={{ fontWeight: 700 }}>{r.faltas}</span>
                        <span style={{ fontSize: 12, color: T.text.quaternary, minWidth: 74, textAlign: 'right' }}>de {r.base} ({pctTxt(r.taxa)})</span>
                      </div>
                      <div style={{ marginLeft: 24, height: 6, borderRadius: 99, background: T.border.muted, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${(r.faltas / maxFaltas) * 100}%`, background: BASE, borderRadius: 99, opacity: 1 - i * 0.13 }} />
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        </>
      )}
    </Secao>
  )
}

function Linha({ d, horas, mapa }: { d: number; horas: number[]; mapa: CelulaFalta[][] }) {
  return (
    <>
      <span style={{ fontSize: 12, fontWeight: 600, color: T.text.secondary, alignSelf: 'center' }}>{DIAS_CURTOS[d]}</span>
      {horas.map(h => {
        const c = mapa[d][h]
        const confiavel = c.base >= BASE_MINIMA && c.taxa !== null
        const cor = confiavel ? corFaixa(c.taxa!) : null
        const texto = c.base === 0 ? `${DIAS_CURTOS[d]} ${h}h: sem atendimentos`
          : `${DIAS_PLURAL[d]} às ${h}h: ${c.faltas} ${c.faltas === 1 ? 'falta' : 'faltas'} em ${nf(c.base)} (${pctTxt(c.taxa, 1)})${confiavel ? '' : ' — poucos dados'}`
        return (
          <Dica key={h} conteudo={texto} rotulo={texto} style={{ display: 'block' }}>
            <span style={{
              width: '100%', height: 30, borderRadius: 6, boxSizing: 'border-box',
              background: cor ? cor.bg : T.bg.page, border: cor ? 'none' : `1px dashed ${c.base ? T.border.strong : T.border.default}`,
              color: cor?.escuro ? '#fff' : T.text.muted, fontSize: 10, fontWeight: 700, display: 'grid', placeItems: 'center',
              cursor: 'default', overflow: 'hidden',
            }} className="rel-celula">
              <span className="rel-celula-txt">{confiavel && c.taxa! >= 0.1 ? Math.round(c.taxa! * 100) : ''}</span>
            </span>
          </Dica>
        )
      })}
    </>
  )
}
