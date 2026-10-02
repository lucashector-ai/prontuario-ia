'use client'

import { useMemo, useRef, useState } from 'react'
import { Printer, Calendar, Users, RotateCw, Info, X, ChartColumnBig } from 'lucide-react'
import { usePageHeader } from '@/components/shell/header-context'
import { Button, Badge, EmptyState, Input, Select, SegmentedControl, Chip } from '@/components/ui'
import { notificar } from '@/components/ui/dialogos'
import { tokens } from '@/lib/design-tokens'
import {
  contarRetornos, evolucaoConvenios, filtrarPeriodo, gradeOcupacao, horariosOciosos, insightsFaltas, mapaFaltas,
  porConvenio, porMedico, rankingFaltas, resumir, resumirGrade, ESPERA_ATIVA, DIAS_PLURAL,
} from '@/lib/relatorios/calculos'
import {
  PERIODOS, intervaloAnterior, intervaloPeriodo, mesesAte, paraInputData, rotuloComparacao, rotuloIntervalo, MESES_CURTOS,
  type PeriodoId,
} from '@/lib/relatorios/periodo'
import { baixarCsv, pctCsv } from '@/lib/relatorios/csv'
import { useRelatorios } from './useRelatorios'
import { VisaoGeral } from '@/components/relatorios/VisaoGeral'
import { PorMedico } from '@/components/relatorios/PorMedico'
import { Faltas } from '@/components/relatorios/Faltas'
import { Ocupacao } from '@/components/relatorios/Ocupacao'
import { Convenios } from '@/components/relatorios/Convenios'

const T = tokens

const SECOES = [
  { id: 'visao', label: 'Visão geral' },
  { id: 'medicos', label: 'Por médico' },
  { id: 'faltas', label: 'Faltas' },
  { id: 'ocupacao', label: 'Ocupação' },
  { id: 'convenios', label: 'Convênios' },
]

export default function RelatoriosPage() {
  const [hoje] = useState(() => new Date())
  const [periodo, setPeriodo] = useState<PeriodoId>('mes')
  const [custom, setCustom] = useState(() => ({
    ini: paraInputData(new Date(hoje.getFullYear(), hoje.getMonth(), 1)), fim: paraInputData(hoje),
  }))
  const [medicoSel, setMedicoSel] = useState<string | null>(null)
  const raiz = useRef<HTMLDivElement>(null)

  const intervalo = useMemo(() => intervaloPeriodo(periodo, hoje, custom), [periodo, hoje, custom])
  const anterior = useMemo(() => intervaloAnterior(intervalo), [intervalo])
  const meses6 = useMemo(() => mesesAte(intervalo.fim, 6), [intervalo])
  const carga = useMemo(() => ({
    ini: new Date(Math.min(anterior.ini.getTime(), meses6[0].ini.getTime())), fim: intervalo.fim,
  }), [anterior, meses6, intervalo])

  const { demo, pronto, ehClinica, medicos, dados, carregando, erro, avisos, recarregar } = useRelatorios(carga)
  const multi = ehClinica && medicos.length > 1
  const medicoAtual = medicos.find(m => m.id === medicoSel) || null

  usePageHeader('Relatórios', medicoAtual
    ? `Indicadores de ${medicoAtual.nome}`
    : multi ? `Gestão da clínica · ${medicos.length} médicos` : 'Indicadores da sua agenda')

  // ── Cálculos ────────────────────────────────────────────────────────────────
  const r = useMemo(() => {
    if (!dados) return null
    const agora = new Date()
    const meds = medicoSel ? dados.medicos.filter(m => m.id === medicoSel) : dados.medicos
    const ids = new Set(meds.map(m => m.id))
    const doMedico = <X extends { medico_id: string | null }>(xs: X[]) => xs.filter(x => x.medico_id && ids.has(x.medico_id))
    const agsTodos = doMedico(dados.agendamentos)
    const ags = filtrarPeriodo(agsTodos, intervalo, a => a.data_hora)
    const agsAntes = filtrarPeriodo(agsTodos, anterior, a => a.data_hora)
    const pac = doMedico(dados.pacientes)
    const ret = dados.retornos ? doMedico(dados.retornos) : null
    const mapa = mapaFaltas(ags)
    const grade = gradeOcupacao(ags, meds, intervalo)
    const g = resumirGrade(grade)
    return {
      visao: {
        atual: resumir(ags, agora), antes: resumir(agsAntes, agora),
        novos: [filtrarPeriodo(pac, intervalo, p => p.criado_em).length, filtrarPeriodo(pac, anterior, p => p.criado_em).length] as [number, number],
        retornos: contarRetornos(ret, ags, intervalo), retornosAntes: contarRetornos(ret, agsAntes, anterior),
      },
      linhas: porMedico(
        dados.medicos,
        filtrarPeriodo(dados.agendamentos, intervalo, a => a.data_hora),
        filtrarPeriodo(dados.agendamentos, anterior, a => a.data_hora),
        dados.pacientes, dados.retornos, intervalo, agora,
      ),
      mapa, ranking: rankingFaltas(mapa), insights: insightsFaltas(ags, mapa),
      ocupacao: { ...g, ociosos: horariosOciosos(grade) },
      convenios: porConvenio(ags),
      evolucao: evolucaoConvenios(agsTodos, meses6),
      espera: dados.listaEspera ? doMedico(dados.listaEspera).filter(e => ESPERA_ATIVA.includes(String(e.status))).length : null,
    }
  }, [dados, medicoSel, intervalo, anterior, meses6])

  // ── Exportação ──────────────────────────────────────────────────────────────
  const sufixo = `${paraInputData(intervalo.ini)}_a_${paraInputData(new Date(intervalo.fim.getTime() - 86400000))}${medicoAtual ? '_' + medicoAtual.nome.replace(/\W+/g, '-').toLowerCase() : ''}`
  const csv = {
    visao: () => {
      if (!r) return
      const { atual: a, antes: b } = r.visao
      baixarCsv(`relatorio-visao-geral_${sufixo}`, ['Indicador', 'Período', 'Período anterior'], [
        ['Atendimentos realizados', a.realizados, b.realizados],
        ['Taxa de comparecimento (%)', pctCsv(a.taxaComparecimento), pctCsv(b.taxaComparecimento)],
        ['Faltas', a.faltas, b.faltas],
        ['Taxa de falta (%)', pctCsv(a.taxaFalta), pctCsv(b.taxaFalta)],
        ['Cancelamentos', a.cancelados, b.cancelados],
        ['Taxa de cancelamento (%)', pctCsv(a.taxaCancelamento), pctCsv(b.taxaCancelamento)],
        ['Teleconsultas', a.teleconsultas, b.teleconsultas],
        ['Pacientes novos', r.visao.novos[0], r.visao.novos[1]],
        ['Retornos previstos', r.visao.retornos.previstos, r.visao.retornosAntes.previstos],
        ['Retornos concluídos', r.visao.retornos.concluidos, r.visao.retornosAntes.concluidos],
        ['Agendamentos passados sem desfecho', a.semDesfecho, b.semDesfecho],
      ])
    },
    medicos: () => r && baixarCsv(`relatorio-por-medico_${sufixo}`,
      ['Médico', 'Especialidade', 'Realizados', 'Realizados (período anterior)', 'Faltas', 'Taxa de falta (%)', 'Cancelamentos', 'Ocupação estimada (%)', 'Pacientes novos', 'Teleconsultas', 'Retornos'],
      r.linhas.map(l => [l.nome, l.especialidade, l.realizados, l.realizadosAntes, l.faltas, pctCsv(l.taxaFalta), l.cancelados, pctCsv(l.ocupacao), l.novos, l.tele, l.retornos])),
    faltas: () => r && baixarCsv(`relatorio-faltas_${sufixo}`, ['Dia da semana', 'Hora', 'Faltas', 'Realizados + faltas', 'Taxa de falta (%)'],
      r.mapa.flatMap((linha, d) => linha.map((c, h) => ({ c, d, h }))).filter(x => x.c.base > 0)
        .map(({ c, d, h }) => [DIAS_PLURAL[d], `${h}h`, c.faltas, c.base, pctCsv(c.taxa)])),
    ocupacao: () => r && baixarCsv(`relatorio-ocupacao_${sufixo}`, ['Agrupamento', 'Item', 'Minutos disponíveis', 'Minutos agendados', 'Ocupação (%)'], [
      ...[1, 2, 3, 4, 5, 6, 0].filter(d => r.ocupacao.porDia[d].disp > 0).map(d => ['Dia da semana', DIAS_PLURAL[d], r.ocupacao.porDia[d].disp, r.ocupacao.porDia[d].ocup, pctCsv(r.ocupacao.porDia[d].taxa)]),
      ...r.ocupacao.porHora.map((c, h) => ({ c, h })).filter(x => x.c.disp > 0).map(({ c, h }) => ['Hora', `${h}h`, c.disp, c.ocup, pctCsv(c.taxa)]),
      ['Total', 'Período', r.ocupacao.total.disp, r.ocupacao.total.ocup, pctCsv(r.ocupacao.total.taxa)],
    ]),
    convenios: () => r && baixarCsv(`relatorio-convenios_${sufixo}`,
      ['Convênio', 'Atendimentos', 'Participação (%)', 'Realizados', 'Faltas', 'Taxa de falta (%)', ...r.evolucao.meses.map(m => `${MESES_CURTOS[m.ini.getMonth()]}/${m.ini.getFullYear()}`)],
      r.convenios.map(c => [c.nome, c.atendimentos, pctCsv(c.parte), c.realizados, c.faltas, pctCsv(c.taxaFalta),
        ...r.evolucao.meses.map(m => m.valores[c.nome] ?? null)])),
  }

  const imprimir = () => {
    const el = raiz.current
    if (!el) return
    const w = window.open('', '_blank', 'width=1000,height=800')
    if (!w) { notificar('Permita pop-ups para imprimir o relatório', 'erro'); return }
    const estilos = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]')).map(n => n.outerHTML).join('\n')
    w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Relatório ${rotuloIntervalo(intervalo)}</title>${estilos}
      <style>
        @page { size: A4; margin: 12mm; }
        html, body { background: #fff !important; margin: 0; overflow: visible !important; height: auto !important; }
        body { padding: 0 4px; -webkit-print-color-adjust: exact; print-color-adjust: exact; font-family: Inter, system-ui, sans-serif; color: ${T.text.primary}; }
        .rel-noprint { display: none !important; }
        .rel-print-only { display: block !important; }
        .rel-secao { break-after: page; page-break-after: always; break-inside: avoid; border: none !important; padding: 0 !important; }
        .rel-secao:last-of-type { break-after: auto; page-break-after: auto; }
        .rel-tab-med { display: block !important; } .rel-cards-med { display: none !important; }
        .rel-secoes { gap: 0 !important; }
      </style></head><body>${el.innerHTML}</body></html>`)
    w.document.close()
    setTimeout(() => { w.focus(); w.print() }, 400)
  }

  const irPara = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  if (!pronto) return <div style={{ padding: 20 }}><span className="c360-skel" style={{ display: 'block', height: 40, borderRadius: 12 }} /></div>

  if (!medicos.length) {
    return (
      <div className="c360-pagina">
        <EmptyState icon={Users} titulo="Nenhum médico ativo"
          descricao={erro || 'Cadastre médicos ativos na clínica para gerar os relatórios.'} />
      </div>
    )
  }

  const textoCmp = rotuloComparacao(periodo)
  const semMovimento = !carregando && r && r.visao.atual.total === 0

  return (
    <div className="c360-pagina" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <style dangerouslySetInnerHTML={{ __html: `
        .rel-periodo-seg { display: flex; } .rel-periodo-sel { display: none; }
        @media (max-width: 759px) { .rel-periodo-seg { display: none !important; } .rel-periodo-sel { display: block; } }
        .rel-print-only { display: none; }
      ` }} />

      {/* Barra de filtros */}
      <div className="rel-noprint" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div className="rel-periodo-seg" style={{ flexShrink: 0 }}>
          <SegmentedControl<PeriodoId> options={PERIODOS} value={periodo} onChange={setPeriodo} />
        </div>
        <div className="rel-periodo-sel" style={{ flex: '1 1 160px', minWidth: 0 }}>
          <Select aria-label="Período" value={periodo} onChange={e => setPeriodo(e.target.value as PeriodoId)}>
            {PERIODOS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </Select>
        </div>
        {periodo === 'custom' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: '1 1 260px', minWidth: 0 }}>
            <Input type="date" aria-label="Data inicial" value={custom.ini} max={custom.fim}
              onChange={e => e.target.value && setCustom(c => ({ ...c, ini: e.target.value }))} style={{ minWidth: 0 }} />
            <span style={{ fontSize: 12.5, color: T.text.tertiary }}>até</span>
            <Input type="date" aria-label="Data final" value={custom.fim} min={custom.ini}
              onChange={e => e.target.value && setCustom(c => ({ ...c, fim: e.target.value }))} style={{ minWidth: 0 }} />
          </div>
        )}
        {multi && (
          <div style={{ flex: '0 1 240px', minWidth: 0 }}>
            <Select aria-label="Filtrar por médico" value={medicoSel || ''} onChange={e => setMedicoSel(e.target.value || null)}>
              <option value="">Todos os médicos</option>
              {medicos.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
            </Select>
          </div>
        )}
        <div style={{ flex: 1 }} />
        {demo && <Badge tone="accent" dot>Demonstração</Badge>}
        <Button variant="secondary" icon={Printer} onClick={imprimir} disabled={carregando || !r}>Imprimir relatório</Button>
      </div>

      <div className="rel-noprint" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 12.5, color: T.text.quaternary }}>
        <Calendar size={14} strokeWidth={1.6} aria-hidden />
        <span><b style={{ color: T.text.strong }}>{rotuloIntervalo(intervalo)}</b> · comparado a {rotuloIntervalo(anterior)}</span>
        {medicoAtual && (
          <Chip ativo onClick={() => setMedicoSel(null)} icon={X} style={{ height: 26, fontSize: 12 }}>{medicoAtual.nome}</Chip>
        )}
        <span style={{ flex: 1 }} />
        <nav aria-label="Seções do relatório" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {SECOES.filter(s => s.id !== 'medicos' || multi).map(s => (
            <button key={s.id} onClick={() => irPara(s.id)} style={{
              border: `1px solid ${T.border.default}`, background: '#fff', borderRadius: 99, padding: '4px 10px', fontSize: 12,
              fontWeight: 600, color: T.text.muted, cursor: 'pointer', fontFamily: 'inherit',
            }}>{s.label}</button>
          ))}
        </nav>
      </div>

      {avisos.length > 0 && (
        <div className="rel-noprint" role="note" style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: T.text.quaternary }}>
          {avisos.map(a => <span key={a} style={{ display: 'flex', gap: 6, alignItems: 'center' }}><Info size={13} strokeWidth={1.6} aria-hidden />{a}</span>)}
        </div>
      )}

      {erro ? (
        <div style={{ border: `1px solid ${T.border.default}`, borderRadius: 16 }}>
          <EmptyState icon={ChartColumnBig} titulo="Não foi possível gerar o relatório" descricao={erro}
            acao={<Button size="sm" icon={RotateCw} onClick={recarregar}>Tentar de novo</Button>} />
        </div>
      ) : (
        <div ref={raiz} className="rel-secoes" style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
          <div className="rel-print-only" style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 20, fontWeight: 700 }}>Relatório de gestão{medicoAtual ? ` · ${medicoAtual.nome}` : ''}</div>
            <div style={{ fontSize: 12.5, color: T.text.quaternary }}>
              {rotuloIntervalo(intervalo)} · comparado a {rotuloIntervalo(anterior)} · gerado em {new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
            </div>
          </div>

          {semMovimento && (
            <div className="rel-noprint" style={{ border: `1px dashed ${T.border.strong}`, borderRadius: 16 }}>
              <EmptyState icon={Calendar} titulo="Nenhum agendamento neste período"
                descricao="Escolha outro período ou confira se a agenda está sendo usada pelos médicos." />
            </div>
          )}

          <VisaoGeral d={r?.visao ?? null} comparacao={textoCmp} carregando={carregando} onCsv={csv.visao} />
          {multi && (
            <PorMedico linhas={r?.linhas ?? []} carregando={carregando} selecionado={medicoSel}
              onSelecionar={id => { setMedicoSel(id); if (id) irPara('visao') }} onCsv={csv.medicos} />
          )}
          <Faltas mapa={r?.mapa ?? []} ranking={r?.ranking ?? []} insights={r?.insights ?? []} carregando={carregando || !r} onCsv={csv.faltas} />
          <Ocupacao porDia={r?.ocupacao.porDia ?? []} porHora={r?.ocupacao.porHora ?? []} total={r?.ocupacao.total ?? null}
            ociosos={r?.ocupacao.ociosos ?? []} listaEspera={r?.espera ?? null} carregando={carregando || !r} onCsv={csv.ocupacao} />
          <Convenios linhas={r?.convenios ?? []} evolucao={r?.evolucao ?? null} carregando={carregando || !r} onCsv={csv.convenios} />
        </div>
      )}
    </div>
  )
}
