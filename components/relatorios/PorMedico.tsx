'use client'
import { useMemo, useState } from 'react'
import { ArrowUp, ArrowDown, Users } from 'lucide-react'
import { Avatar, EmptyState } from '@/components/ui'
import type { ColunaMedico, LinhaMedico } from '@/lib/relatorios/calculos'
import { ordenarLinhas, variacao } from '@/lib/relatorios/calculos'
import { Dica, InfoDica, Secao, SkeletonBloco, T, nf, pctTxt } from './comuns'

const DICA_OCUPACAO = 'Estimativa: soma das durações dos agendamentos não cancelados ÷ horas de atendimento do período (dias e horário da agenda pública do médico, sem o almoço; padrão seg–sex 9h–18h). Encaixes fora do horário podem passar de 100%.'

const COLUNAS: { id: ColunaMedico; label: string; dica?: string }[] = [
  { id: 'nome', label: 'Médico' },
  { id: 'realizados', label: 'Realizados' },
  { id: 'taxaFalta', label: 'Faltas' },
  { id: 'cancelados', label: 'Cancel.' },
  { id: 'ocupacao', label: 'Ocupação', dica: DICA_OCUPACAO },
  { id: 'novos', label: 'Novos' },
  { id: 'tele', label: 'Tele' },
  { id: 'retornos', label: 'Retornos' },
]

const COR_FALTA = 'oklch(0.66 0.17 20)'
const COR_CANCEL = 'oklch(0.82 0.02 285)'

export function PorMedico({ linhas, carregando, selecionado, onSelecionar, onCsv }: {
  linhas: LinhaMedico[]
  carregando: boolean
  selecionado: string | null
  onSelecionar: (id: string | null) => void
  onCsv: () => void
}) {
  const [col, setCol] = useState<ColunaMedico>('realizados')
  const [dir, setDir] = useState<'asc' | 'desc'>('desc')
  const ordenadas = useMemo(() => ordenarLinhas(linhas, col, dir), [linhas, col, dir])
  const maxTotal = Math.max(1, ...linhas.map(l => l.realizados + l.faltas + l.cancelados))
  const ordenar = (c: ColunaMedico) => {
    if (c === col) setDir(dir === 'asc' ? 'desc' : 'asc')
    else { setCol(c); setDir(c === 'nome' ? 'asc' : 'desc') }
  }
  const clicar = (id: string) => onSelecionar(selecionado === id ? null : id)

  return (
    <Secao id="medicos" titulo="Por médico" descricao="Clique em um médico para filtrar o relatório inteiro." onCsv={onCsv}>
      <style dangerouslySetInnerHTML={{ __html: `
        .rel-tab-med { display: block; }
        .rel-cards-med { display: none; }
        @media (max-width: 899px) { .rel-tab-med { display: none; } .rel-cards-med { display: flex; } }
        .rel-linha-med:hover { background: ${T.bg.page}; }
        .rel-linha-med:focus-visible { outline: 2px solid ${T.brand.primaryAccent}; outline-offset: -2px; }
      ` }} />
      {carregando ? <SkeletonBloco altura={160} /> : linhas.length === 0 ? (
        <EmptyState icon={Users} titulo="Nenhum médico encontrado" descricao="Cadastre médicos ativos na clínica para ver o desempenho de cada um." />
      ) : (
        <>
          <div className="rel-tab-med" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
              <thead>
                <tr>
                  {COLUNAS.map(c => (
                    <th key={c.id} aria-sort={col === c.id ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                      style={{ textAlign: c.id === 'nome' ? 'left' : 'right', padding: '0 8px 10px', borderBottom: `1px solid ${T.border.default}`, whiteSpace: 'nowrap' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <button onClick={() => ordenar(c.id)} style={{
                          display: 'inline-flex', alignItems: 'center', gap: 3, border: 'none', background: 'none', padding: 0, cursor: 'pointer',
                          fontFamily: 'inherit', fontSize: 11, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase',
                          color: col === c.id ? T.text.strong : T.text.tertiary,
                        }}>
                          {c.label}
                          {col === c.id && (dir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                        </button>
                        {c.dica && <InfoDica texto={c.dica} />}
                      </span>
                    </th>
                  ))}
                  <th style={{ textAlign: 'left', padding: '0 8px 10px', borderBottom: `1px solid ${T.border.default}`, fontSize: 11, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: T.text.tertiary, width: '22%' }}>Desempenho</th>
                </tr>
              </thead>
              <tbody>
                {ordenadas.map(l => {
                  const sel = selecionado === l.id
                  const v = variacao(l.realizados, l.realizadosAntes)
                  return (
                    <tr key={l.id} className="rel-linha-med" tabIndex={0} role="button" aria-pressed={sel}
                      aria-label={`Filtrar relatório por ${l.nome}`}
                      onClick={() => clicar(l.id)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); clicar(l.id) } }}
                      style={{ cursor: 'pointer', background: sel ? T.brand.primarySoftBg : undefined, boxShadow: sel ? `inset 3px 0 0 ${T.brand.primary}` : undefined }}>
                      <td style={td('left')}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 170 }}>
                          <PontoMedico cor={l.cor} nome={l.nome} />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 600, color: T.text.primary, whiteSpace: 'nowrap' }}>{l.nome}</div>
                            {l.especialidade && <div style={{ fontSize: 11.5, color: T.text.quaternary }}>{l.especialidade}</div>}
                          </div>
                        </div>
                      </td>
                      <td style={td()}>
                        <span style={{ fontWeight: 700 }}>{nf(l.realizados)}</span>
                        {v && v.sinal !== 0 && <span style={{ display: 'block', fontSize: 11, fontWeight: 600, color: v.sinal > 0 ? T.status.success : T.status.danger }}>{v.sinal > 0 ? '+' : '−'}{v.delta}</span>}
                      </td>
                      <td style={td()}>{nf(l.faltas)} <span style={{ color: corTaxaFalta(l.taxaFalta), fontWeight: 600 }}>({pctTxt(l.taxaFalta)})</span></td>
                      <td style={td()}>{nf(l.cancelados)}</td>
                      <td style={td()}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, justifyContent: 'flex-end' }}>
                          <MiniBarra valor={l.ocupacao} />
                          <span style={{ minWidth: 36 }}>{pctTxt(l.ocupacao)}</span>
                        </div>
                      </td>
                      <td style={td()}>{nf(l.novos)}</td>
                      <td style={td()}>{nf(l.tele)}</td>
                      <td style={td()}>{nf(l.retornos)}</td>
                      <td style={td('left')}><BarraDesempenho l={l} max={maxTotal} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <Legenda />
          </div>

          <div className="rel-cards-med" style={{ flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', fontSize: 12, color: T.text.quaternary }}>
              Ordenar por
              <select value={col} onChange={e => { const c = e.target.value as ColunaMedico; setCol(c); setDir(c === 'nome' ? 'asc' : 'desc') }}
                aria-label="Ordenar médicos por"
                style={{ height: 30, borderRadius: 9, border: `1px solid ${T.border.default}`, background: '#fff', fontSize: 12.5, padding: '0 8px', fontFamily: 'inherit', color: T.text.strong }}>
                {COLUNAS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
            {ordenadas.map(l => {
              const sel = selecionado === l.id
              return (
                <button key={l.id} onClick={() => clicar(l.id)} aria-pressed={sel} style={{
                  textAlign: 'left', fontFamily: 'inherit', cursor: 'pointer', padding: 14, borderRadius: 14,
                  border: `1px solid ${sel ? T.brand.primaryAccent : T.border.default}`, background: sel ? T.brand.primarySoftBg : '#fff',
                  display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <PontoMedico cor={l.cor} nome={l.nome} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: T.text.primary }}>{l.nome}</div>
                      {l.especialidade && <div style={{ fontSize: 11.5, color: T.text.quaternary }}>{l.especialidade}</div>}
                    </div>
                    <span style={{ fontSize: 20, fontWeight: 700, color: T.text.primary }}>{nf(l.realizados)}</span>
                  </div>
                  <BarraDesempenho l={l} max={maxTotal} />
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, fontSize: 12 }}>
                    <Mini label="Faltas" valor={`${l.faltas} (${pctTxt(l.taxaFalta)})`} />
                    <Mini label="Cancel." valor={nf(l.cancelados)} />
                    <Mini label="Ocupação" valor={pctTxt(l.ocupacao)} />
                    <Mini label="Novos" valor={nf(l.novos)} />
                    <Mini label="Tele" valor={nf(l.tele)} />
                    <Mini label="Retornos" valor={nf(l.retornos)} />
                  </div>
                </button>
              )
            })}
            <Legenda />
          </div>
        </>
      )}
    </Secao>
  )
}

const td = (align: 'left' | 'right' = 'right'): React.CSSProperties => ({
  textAlign: align, padding: '11px 8px', borderBottom: `1px solid ${T.border.muted}`, color: T.text.strong, verticalAlign: 'middle', whiteSpace: 'nowrap',
})

export const corTaxaFalta = (t: number | null) => t === null ? T.text.tertiary : t >= 0.15 ? T.status.danger : t >= 0.08 ? T.status.warning : T.status.success

function PontoMedico({ cor, nome }: { cor?: string | null; nome: string }) {
  if (!cor) return <Avatar nome={nome.replace(/^(Dr|Dra)\.?\s+/i, '')} size={30} />
  const ini = nome.replace(/^(Dr|Dra)\.?\s+/i, '').split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase()
  return (
    <span aria-hidden style={{
      width: 30, height: 30, borderRadius: '50%', flexShrink: 0, display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 700,
      background: `color-mix(in oklch, ${cor} 14%, white)`, color: `color-mix(in oklch, ${cor} 80%, black)`,
    }}>{ini}</span>
  )
}

function MiniBarra({ valor }: { valor: number | null }) {
  const v = Math.min(1, valor ?? 0)
  return (
    <span aria-hidden style={{ width: 44, height: 6, borderRadius: 99, background: T.border.muted, overflow: 'hidden', display: 'inline-block' }}>
      <span style={{ display: 'block', height: '100%', width: `${v * 100}%`, background: T.brand.primary, borderRadius: 99 }} />
    </span>
  )
}

function BarraDesempenho({ l, max }: { l: LinhaMedico; max: number }) {
  const seg = [
    { n: l.realizados, cor: l.cor || T.brand.primary, label: 'Realizados' },
    { n: l.faltas, cor: COR_FALTA, label: 'Faltas' },
    { n: l.cancelados, cor: COR_CANCEL, label: 'Cancelados' },
  ]
  const total = seg.reduce((s, x) => s + x.n, 0)
  return (
    <Dica rotulo={`${l.nome}: ${l.realizados} realizados, ${l.faltas} faltas, ${l.cancelados} cancelados`} style={{ width: '100%' }} conteudo={
      <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {seg.map(s => (
          <span key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ width: 8, height: 8, borderRadius: 3, background: s.cor }} />
            <span style={{ flex: 1, color: '#C3C1CC' }}>{s.label}</span>
            <b>{s.n}</b>
          </span>
        ))}
      </span>
    }>
      <span role="img" aria-hidden style={{ display: 'flex', width: '100%', height: 10, borderRadius: 99, background: T.border.muted, overflow: 'hidden' }}>
        <span style={{ display: 'flex', width: `${(total / max) * 100}%`, gap: 2 }}>
          {seg.map(s => s.n > 0 && <span key={s.label} style={{ width: `${(s.n / total) * 100}%`, minWidth: 3, background: s.cor }} />)}
        </span>
      </span>
    </Dica>
  )
}

function Legenda() {
  return (
    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 10, fontSize: 11.5, color: T.text.quaternary }}>
      {[['Realizados', T.brand.primary], ['Faltas', COR_FALTA], ['Cancelados', COR_CANCEL]].map(([l, c]) => (
        <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: 3, background: c }} />{l}</span>
      ))}
      <span>· barra proporcional ao maior volume da equipe</span>
    </div>
  )
}

function Mini({ label, valor }: { label: string; valor: string }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: T.text.tertiary }}>{label}</div>
      <div style={{ fontWeight: 600, color: T.text.strong, marginTop: 2 }}>{valor}</div>
    </div>
  )
}
