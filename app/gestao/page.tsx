'use client'
/**
 * Painel do gestor — como o atendimento está andando: espera, duração da consulta,
 * faltas, horários de pico, desempenho por médico, por onde o paciente chegou e a
 * triagem. Termina em sugestões práticas com atalho. ?demo=1 mostra dados de exemplo.
 */
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarX, Clock, Lightbulb, Settings2, Stethoscope, Timer, Users } from 'lucide-react'
import { tokens as T } from '@/lib/design-tokens'
import { usePageHeader } from '@/components/shell/header-context'
import { Button, Card, EmptyState, KpiCard, SegmentedControl, Select } from '@/components/ui'
import { carregarIndicadores, ehDemo, type Indicadores } from '@/lib/atendimento/cliente'
import { RISCOS, hojeSP } from '@/lib/atendimento/comum'
import { esperaTexto } from '@/components/atendimento/partes'

type Periodo = 'hoje' | '7' | '30' | '90'
const COR = T.brand.primary
const ORIGEM: Record<string, string> = { recepcao: 'Recepção', whatsapp: 'WhatsApp (“cheguei”)', totem: 'Totem', encaixe: 'Encaixe' }
const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

function intervalo(p: Periodo) {
  const ate = hojeSP()
  if (p === 'hoje') return { de: ate, ate }
  const d = new Date(ate + 'T12:00:00'); d.setDate(d.getDate() - (Number(p) - 1))
  return { de: d.toISOString().slice(0, 10), ate }
}
const min = (v: number | null) => (v === null ? '—' : esperaTexto(v))

export default function GestaoPage() {
  const router = useRouter()
  usePageHeader('Gestão do atendimento', 'Espera, faltas, picos e desempenho por médico')
  const [periodo, setPeriodo] = useState<Periodo>('7')
  const [medicoId, setMedicoId] = useState('')
  const [dados, setDados] = useState<Indicadores | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  useEffect(() => {
    try { const s = localStorage.getItem('c360-gestao-periodo') as Periodo; if (s) setPeriodo(s) } catch {}
  }, [])
  useEffect(() => {
    setCarregando(true); setErro('')
    carregarIndicadores({ ...intervalo(periodo), medico_id: medicoId || undefined })
      .then(setDados).catch(e => setErro(e.message)).finally(() => setCarregando(false))
  }, [periodo, medicoId])
  const trocarPeriodo = (p: Periodo) => { setPeriodo(p); try { localStorage.setItem('c360-gestao-periodo', p) } catch {} }

  const r = dados?.resumo
  const sugestoes = useMemo(() => dados ? gerarSugestoes(dados) : [], [dados])
  const ir = (url: string) => router.push(url + (ehDemo() ? (url.includes('?') ? '&' : '?') + 'demo=1' : ''))

  if (erro) return <div className="c360-pagina"><Card><EmptyState icon={Settings2} titulo="Não foi possível carregar" descricao={erro} /></Card></div>

  return (
    <div className="c360-pagina" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <SegmentedControl value={periodo} onChange={trocarPeriodo} options={[{ value: 'hoje', label: 'Hoje' }, { value: '7', label: '7 dias' }, { value: '30', label: '30 dias' }, { value: '90', label: '90 dias' }]} />
        {(dados?.porMedico.length || 0) > 1 || medicoId ? (
          <Select value={medicoId} onChange={e => setMedicoId(e.target.value)} style={{ width: 'auto', minWidth: 200 }} aria-label="Médico">
            <option value="">Todos os médicos</option>
            {(dados?.porMedico || []).map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
          </Select>
        ) : null}
      </div>

      <div className="c360-kpis" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <KpiCard label="Atendidos" valor={r?.atendidos ?? '—'} icon={Users} comparacao={`${r?.chegadas ?? 0} chegadas`} carregando={carregando} />
        <KpiCard label="Espera até o médico" valor={min(r?.esperaMedia ?? null)} icon={Clock} comparacao={`metade espera até ${min(r?.esperaMediana ?? null)}`} cor={T.data.orange} carregando={carregando} />
        <KpiCard label="Duração da consulta" valor={min(r?.consultaMedia ?? null)} icon={Timer} comparacao="média" cor={T.data.blue} carregando={carregando} />
        <KpiCard label="Faltas" valor={r?.taxaFaltas === null || r?.taxaFaltas === undefined ? '—' : `${r.taxaFaltas}%`} icon={CalendarX} comparacao={`${r?.faltas ?? 0} de ${r?.agendados ?? 0} agendados`} cor={T.status.danger} carregando={carregando} />
      </div>

      {sugestoes.length > 0 && (
        <Card titulo={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Lightbulb size={16} color={T.data.orange} /> O que dá para melhorar</span>}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {sugestoes.map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <span style={{ flex: '1 1 300px', fontSize: 13.5, lineHeight: 1.5 }}>{s.texto}</span>
                {s.acao && <Button size="sm" variant="secondary" onClick={() => ir(s.acao!.url)}>{s.acao.label}</Button>}
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="c360-gestao-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16 }}>
        <style dangerouslySetInnerHTML={{ __html: '@media (max-width: 1023px) { .c360-gestao-grid { grid-template-columns: minmax(0, 1fr) !important; } }' }} />
        <Card titulo="Chegadas por hora" acao={dados?.pico !== null && dados?.pico !== undefined ? <span style={{ fontSize: 12.5, color: T.text.secondary }}>pico às {dados.pico}h</span> : undefined}>
          {carregando ? <Esqueleto /> : <Barras itens={(dados?.porHora || []).map(h => ({ rotulo: `${h.hora}h`, valor: h.chegadas, dica: `${h.hora}h: ${h.chegadas} chegada${h.chegadas === 1 ? '' : 's'}` }))} />}
        </Card>
        <Card titulo="Espera média por hora de chegada">
          {carregando ? <Esqueleto /> : <Barras sufixo=" min" itens={(dados?.porHora || []).map(h => ({ rotulo: `${h.hora}h`, valor: h.esperaMedia ?? 0, vazio: h.esperaMedia === null, dica: h.esperaMedia === null ? `${h.hora}h: sem chegadas` : `${h.hora}h: espera média de ${h.esperaMedia} min` }))} />}
        </Card>
      </div>

      <Card titulo={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Stethoscope size={16} /> Por médico</span>} padding={0}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 620 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: T.text.secondary, fontSize: 12 }}>
                {['Médico', 'Atendidos', 'Espera média', 'Consulta média', 'Faltas', 'Retornos pedidos'].map((h, i) => <th key={h} style={{ padding: '10px 16px', fontWeight: 650, textAlign: i ? 'right' : 'left', borderBottom: `1px solid ${T.border.muted}` }}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {(dados?.porMedico || []).map(m => {
                const pior = (dados?.porMedico || []).length > 1 && m.espera !== null && m.espera === Math.max(...(dados?.porMedico || []).map(x => x.espera ?? 0))
                return (
                  <tr key={m.id} style={{ borderBottom: `1px solid ${T.border.muted}` }}>
                    <td style={{ padding: '10px 16px', fontWeight: 600 }}>{m.nome}</td>
                    <td style={td}>{m.atendidos}</td>
                    <td style={{ ...td, color: pior ? T.status.danger : undefined, fontWeight: pior ? 700 : 400 }}>{min(m.espera)}</td>
                    <td style={td}>{min(m.consulta)}</td>
                    <td style={td}>{m.faltas}{m.agendados ? <span style={{ color: T.text.tertiary }}> ({Math.round((m.faltas / m.agendados) * 100)}%)</span> : null}</td>
                    <td style={td}>{m.retornos}</td>
                  </tr>
                )
              })}
              {!carregando && !dados?.porMedico.length && <tr><td colSpan={6} style={{ padding: 16, color: T.text.tertiary }}>Sem atendimentos no período.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="c360-gestao-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16 }}>
        <Card titulo="Por onde o paciente chegou">
          {carregando ? <Esqueleto /> : <BarrasHorizontais itens={Object.entries(dados?.porOrigem || {}).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ rotulo: ORIGEM[k] || k, valor: v, cor: COR }))} />}
        </Card>
        <Card titulo="Triagem por cor">
          {carregando ? <Esqueleto /> : Object.keys(dados?.porRisco || {}).length === 0
            ? <div style={{ fontSize: 13, color: T.text.tertiary }}>Sem triagens no período (a triagem é ligada em Minha clínica → Recepção e painel).</div>
            : <BarrasHorizontais itens={RISCOS.map(rr => ({ rotulo: rr.label, valor: dados?.porRisco[rr.valor] || 0, cor: rr.cor }))} />}
        </Card>
        <Card titulo="Dias da semana mais cheios">
          {carregando ? <Esqueleto /> : <Barras itens={(dados?.porDiaSemana || []).map(d => ({ rotulo: DIAS[d.dia], valor: d.chegadas, dica: `${DIAS[d.dia]}: ${d.chegadas} chegada${d.chegadas === 1 ? '' : 's'}` }))} />}
        </Card>
        <Card titulo="Retornos e balcão">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
            <Mini titulo="Retornos pedidos" valor={r?.retornosPedidos ?? 0} detalhe={r?.retornosPedidos ? `${Math.round(((r.retornosAgendados || 0) / r.retornosPedidos) * 100)}% já agendados` : '—'} />
            <Mini titulo="Saídas pendentes" valor={r?.saidasPendentes ?? 0} detalhe="esperando a recepção" />
            <Mini titulo="Senhas de balcão" valor={r?.balcaoSenhas ?? 0} detalhe={`espera média ${min(r?.balcaoEspera ?? null)}`} />
            <Mini titulo="Não atenderam a chamada" valor={r?.naoAtenderamChamada ?? 0} detalhe="chamados e não vieram" />
          </div>
        </Card>
      </div>
    </div>
  )
}

const td: React.CSSProperties = { padding: '10px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }

function gerarSugestoes(d: Indicadores) {
  const l: { texto: string; acao?: { label: string; url: string } }[] = []
  const r = d.resumo
  if (d.pico !== null && d.porHora.length) {
    const pico = d.porHora.find(h => h.hora === d.pico)
    if (pico && pico.esperaMedia && pico.esperaMedia >= 20) l.push({ texto: `Às ${d.pico}h chegam mais pacientes e a espera passa de ${pico.esperaMedia} min. Vale espalhar os horários da agenda ou reforçar a recepção nesse horário.`, acao: { label: 'Ver agenda', url: '/agenda' } })
  }
  const ms = d.porMedico.filter(m => m.espera !== null)
  if (ms.length > 1) {
    const pior = [...ms].sort((a, b) => (b.espera || 0) - (a.espera || 0))[0]
    const media = r.esperaMedia || 0
    if ((pior.espera || 0) >= media + 8) l.push({ texto: `Os pacientes de ${pior.nome} esperam ${pior.espera} min em média (a clínica: ${media} min). Pode ser agenda apertada ou consultas mais longas (${pior.consulta ?? '—'} min).` })
  }
  if ((r.taxaFaltas || 0) >= 10) l.push({ texto: `${r.taxaFaltas}% dos agendados faltaram. A confirmação automática pelo WhatsApp 24h antes costuma reduzir bastante as faltas.`, acao: { label: 'Ver automações', url: '/minha-clinica?aba=automacoes' } })
  if (r.retornosPedidos && r.retornosAgendados / r.retornosPedidos < 0.8) l.push({ texto: `${r.retornosPedidos - r.retornosAgendados} retornos pedidos pelos médicos ainda não foram agendados.`, acao: { label: 'Ver retornos', url: '/retornos' } })
  if (r.saidasPendentes > 0) l.push({ texto: r.saidasPendentes === 1 ? '1 paciente saiu do consultório com algo para a recepção resolver.' : `${r.saidasPendentes} pacientes saíram do consultório com algo para a recepção resolver.`, acao: { label: 'Abrir recepção', url: '/recepcao' } })
  return l
}

function Esqueleto() { return <span className="c360-skel" style={{ display: 'block', height: 150, borderRadius: 10 }} /> }

/** Barras verticais de uma série (cor da marca), dica no hover/foco, rótulo só no maior valor. */
function Barras({ itens, sufixo = '' }: { itens: { rotulo: string; valor: number; dica: string; vazio?: boolean }[]; sufixo?: string }) {
  const [ativo, setAtivo] = useState<number | null>(null)
  const max = Math.max(1, ...itens.map(i => i.valor))
  const iMax = itens.findIndex(i => i.valor === max && max > 0)
  if (!itens.some(i => i.valor > 0)) return <div style={{ fontSize: 13, color: T.text.tertiary, padding: '30px 0', textAlign: 'center' }}>Sem dados no período.</div>
  return (
    <div style={{ position: 'relative' }}>
      <div role="img" aria-label={itens.map(i => i.dica).join('; ')} style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 150, borderBottom: `1px solid ${T.border.default}` }}>
        {itens.map((it, i) => (
          <div key={i} tabIndex={0} onMouseEnter={() => setAtivo(i)} onMouseLeave={() => setAtivo(null)} onFocus={() => setAtivo(i)} onBlur={() => setAtivo(null)}
            style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', cursor: 'default', outline: 'none', position: 'relative' }}>
            {i === iMax && <span style={{ fontSize: 11, fontWeight: 700, color: T.text.secondary, marginBottom: 3 }}>{it.valor}{sufixo}</span>}
            <div style={{ width: '70%', maxWidth: 28, height: `${(it.valor / max) * (i === iMax ? 82 : 92)}%`, minHeight: it.valor > 0 ? 3 : 0, borderRadius: '4px 4px 0 0',
              background: COR, opacity: it.vazio ? 0 : ativo === null || ativo === i ? 1 : 0.45, transition: 'opacity .12s' }} />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 2, marginTop: 6 }}>
        {itens.map((it, i) => <span key={i} style={{ flex: 1, textAlign: 'center', fontSize: 10.5, color: T.text.tertiary, overflow: 'hidden', whiteSpace: 'nowrap' }}>{itens.length > 12 && i % 2 ? '' : it.rotulo}</span>)}
      </div>
      {ativo !== null && (
        <div style={{ position: 'absolute', top: -6, left: `${((ativo + 0.5) / itens.length) * 100}%`, transform: 'translate(-50%, -100%)', background: T.text.primary, color: '#fff', fontSize: 12, padding: '5px 9px', borderRadius: 8, whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 2 }}>
          {itens[ativo].dica}
        </div>
      )}
    </div>
  )
}

function BarrasHorizontais({ itens }: { itens: { rotulo: string; valor: number; cor: string }[] }) {
  const max = Math.max(1, ...itens.map(i => i.valor))
  const total = itens.reduce((s, i) => s + i.valor, 0)
  if (!total) return <div style={{ fontSize: 13, color: T.text.tertiary }}>Sem dados no período.</div>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {itens.map(i => (
        <div key={i.rotulo} title={`${i.rotulo}: ${i.valor} (${Math.round((i.valor / total) * 100)}%)`}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 4 }}>
            <span style={{ color: T.text.primary }}>{i.rotulo}</span>
            <span style={{ color: T.text.secondary, fontVariantNumeric: 'tabular-nums' }}>{i.valor} · {Math.round((i.valor / total) * 100)}%</span>
          </div>
          <div style={{ height: 8, borderRadius: 4, background: T.bg.page }}>
            <div style={{ width: `${(i.valor / max) * 100}%`, height: '100%', borderRadius: 4, background: i.cor, minWidth: i.valor ? 4 : 0 }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function Mini({ titulo, valor, detalhe }: { titulo: string; valor: React.ReactNode; detalhe: string }) {
  return (
    <div style={{ padding: 12, borderRadius: 12, border: `1px solid ${T.border.default}` }}>
      <div style={{ fontSize: 12, color: T.text.secondary }}>{titulo}</div>
      <div style={{ fontSize: 22, fontWeight: 750, marginTop: 2 }}>{valor}</div>
      <div style={{ fontSize: 11.5, color: T.text.tertiary }}>{detalhe}</div>
    </div>
  )
}
