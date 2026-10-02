'use client'
import { useState } from 'react'
import { CalendarClock, Hourglass, ListOrdered } from 'lucide-react'
import { EmptyState } from '@/components/ui'
import type { Celula } from '@/lib/relatorios/calculos'
import { DIAS_CURTOS, DIAS_PLURAL } from '@/lib/relatorios/calculos'
import { InfoDica, Secao, SkeletonBloco, T, horasTxt, nf, pctTxt } from './comuns'

const DICA = 'Estimativa: minutos agendados (sem cancelados) ÷ minutos de atendimento disponíveis, pela jornada de cada médico (agenda pública; padrão seg–sex 9h–18h, almoço 12h–13h).'

export function Ocupacao({ porDia, porHora, total, ociosos, listaEspera, carregando, onCsv }: {
  porDia: Celula[]
  porHora: Celula[]
  total: Celula | null
  ociosos: { dia: number; hora: number; taxa: number; livresMin: number }[]
  listaEspera: number | null
  carregando: boolean
  onCsv: () => void
}) {
  const dias = [1, 2, 3, 4, 5, 6, 0].filter(d => porDia[d]?.disp > 0)
  const horas = porHora.map((c, h) => ({ c, h })).filter(x => x.c.disp > 0)
  return (
    <Secao id="ocupacao" titulo="Ocupação da agenda" descricao="Quanto do horário de atendimento foi preenchido com agendamentos." onCsv={onCsv}
      acoes={total && !carregando ? (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: T.text.secondary }}>
          Geral <b style={{ fontSize: 16, color: T.text.primary }}>{pctTxt(total.taxa)}</b><InfoDica texto={DICA} />
        </span>
      ) : undefined}>
      {carregando ? <SkeletonBloco altura={200} /> : !total || total.disp === 0 ? (
        <EmptyState icon={CalendarClock} titulo="Sem horário de atendimento no período"
          descricao="Configure dias e horários em Agenda pública para estimarmos a ocupação." />
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: 22 }}>
            <Grafico titulo="Por dia da semana" itens={dias.map(d => ({
              rotulo: DIAS_CURTOS[d], c: porDia[d], dica: `${DIAS_PLURAL[d]}: ${pctTxt(porDia[d].taxa)} ocupado · ${horasTxt(porDia[d].ocup)} de ${horasTxt(porDia[d].disp)}`,
            }))} />
            <Grafico titulo="Por hora do dia" compacto itens={horas.map(({ c, h }) => ({
              rotulo: `${h}h`, c, dica: `${h}h–${h + 1}h: ${pctTxt(c.taxa)} ocupado · ${horasTxt(c.ocup)} de ${horasTxt(c.disp)}`,
            }))} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: 14 }}>
            <div style={{ border: `1px solid ${T.border.default}`, borderRadius: 14, padding: 14, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13.5, fontWeight: 700, marginBottom: 10 }}>
                <Hourglass size={15} strokeWidth={1.6} color={T.brand.primary} aria-hidden />Horários mais ociosos
              </div>
              {ociosos.length === 0 ? (
                <p style={{ margin: 0, fontSize: 12.5, color: T.text.quaternary }}>Nenhum horário abaixo de 50% de ocupação. Agenda bem aproveitada.</p>
              ) : (
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column' }}>
                  {ociosos.map((o, i) => (
                    <li key={`${o.dia}-${o.hora}`} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderTop: i ? `1px solid ${T.border.muted}` : 'none', fontSize: 13 }}>
                      <span style={{ flex: 1, color: T.text.strong }}>{DIAS_PLURAL[o.dia]} · <span className="mono">{String(o.hora).padStart(2, '0')}h</span></span>
                      <span style={{ fontSize: 12, color: T.text.quaternary }}>{horasTxt(o.livresMin)} livres</span>
                      <span style={{ minWidth: 40, textAlign: 'right', fontWeight: 700, color: T.status.warning }}>{pctTxt(o.taxa)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {listaEspera !== null && (
              <div style={{ border: `1px solid ${T.border.default}`, borderRadius: 14, padding: 14, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13.5, fontWeight: 700 }}>
                  <ListOrdered size={15} strokeWidth={1.6} color={T.brand.primary} aria-hidden />Lista de espera
                </div>
                <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.03em' }}>{nf(listaEspera)}</div>
                <p style={{ margin: 0, fontSize: 12.5, color: T.text.quaternary, lineHeight: 1.45 }}>
                  {listaEspera > 0 && ociosos.length > 0
                    ? `${listaEspera === 1 ? 'Paciente aguardando' : 'Pacientes aguardando'} vaga. Ofereça os horários ociosos acima para encaixar.`
                    : listaEspera > 0 ? 'Pacientes aguardando vaga.' : 'Ninguém aguardando vaga no momento.'}
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </Secao>
  )
}

function corBarra(t: number | null) {
  if (t === null) return T.border.default
  if (t >= 0.85) return T.brand.primary
  if (t >= 0.5) return 'oklch(0.66 0.14 285)'
  return 'oklch(0.82 0.07 285)'
}

function Grafico({ titulo, itens, compacto }: { titulo: string; itens: { rotulo: string; c: Celula; dica: string }[]; compacto?: boolean }) {
  const [hover, setHover] = useState<number | null>(null)
  const max = Math.max(1, ...itens.map(i => i.c.taxa ?? 0))
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: T.text.tertiary, marginBottom: 10 }}>{titulo}</div>
      <div role="img" aria-label={`Ocupação ${titulo.toLowerCase()}: ${itens.map(i => `${i.rotulo} ${pctTxt(i.c.taxa)}`).join(', ')}`}
        style={{ height: 170, display: 'flex', gap: compacto ? 3 : 8, position: 'relative' }} onMouseLeave={() => setHover(null)}>
        {/* linha de 100% */}
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 22 + (132 / max), borderTop: `1px dashed ${T.border.strong}`, pointerEvents: 'none' }} />
        {itens.map((it, i) => {
          const t = it.c.taxa ?? 0
          const on = hover === i
          return (
            <div key={it.rotulo} onMouseEnter={() => setHover(i)} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, position: 'relative' }}>
              <div style={{ flex: 1, width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', gap: 4 }}>
                {!compacto && <span style={{ fontSize: 11, fontWeight: 700, color: on ? T.text.primary : T.text.tertiary }}>{pctTxt(it.c.taxa)}</span>}
                <div style={{
                  width: '100%', maxWidth: compacto ? 26 : 40, height: Math.max(4, (t / max) * 132), borderRadius: compacto ? 5 : 8,
                  background: corBarra(it.c.taxa), opacity: hover !== null && !on ? 0.5 : 1, transition: 'opacity .15s, height .4s',
                }} />
              </div>
              <span style={{ fontSize: compacto ? 10 : 12, color: on ? T.text.primary : T.text.tertiary, fontWeight: on ? 700 : 500, whiteSpace: 'nowrap' }}>{it.rotulo}</span>
              {on && (
                <div role="tooltip" style={{
                  position: 'absolute', bottom: 'calc(100% - 10px)', zIndex: 5, ...(i < itens.length / 2 ? { left: 0 } : { right: 0 }),
                  background: T.night[800], color: '#fff', borderRadius: 10, padding: '8px 10px', fontSize: 12, width: 'max-content', maxWidth: 220,
                  boxShadow: '0 12px 28px -8px rgba(28,27,34,.4)', pointerEvents: 'none',
                }}>{it.dica}</div>
              )}
            </div>
          )
        })}
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8, fontSize: 11.5, color: T.text.quaternary }}>
        {[['≥ 85%', T.brand.primary], ['50–85%', 'oklch(0.66 0.14 285)'], ['< 50%', 'oklch(0.82 0.07 285)']].map(([l, c]) => (
          <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: 3, background: c }} />{l}</span>
        ))}
        {max > 1 && <span>· tracejado = 100%</span>}
      </div>
    </div>
  )
}
