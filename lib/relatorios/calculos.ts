/**
 * Cálculos puros dos relatórios de gestão (sem React, sem Supabase) — testados em __tests__.
 *
 * Definições:
 *   - Realizado / falta / cancelado: status do agendamento.
 *   - Taxa de comparecimento = realizados ÷ (realizados + faltas). Taxa de falta = faltas ÷ (realizados + faltas).
 *     Agendamentos passados ainda "agendado/confirmado" (sem desfecho marcado) ficam de fora e são contados à parte.
 *   - Taxa de cancelamento = cancelados ÷ total de agendamentos do período.
 *   - Ocupação (estimativa) = soma das durações dos agendamentos não cancelados ÷ minutos de atendimento disponíveis
 *     (jornada do médico: dias da semana × horário − almoço, em cada dia do período).
 */
import type { AgRel, Intervalo, Jornada, MedRel, PacRel, RetornoRel } from './tipos'
import { dentro, paraData } from './periodo'

export const DURACAO_PADRAO = 30
export const DIAS_CURTOS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
export const DIAS_PLURAL = ['Domingos', 'Segundas', 'Terças', 'Quartas', 'Quintas', 'Sextas', 'Sábados']

export const JORNADA_PADRAO: Jornada = {
  dias_semana: [1, 2, 3, 4, 5], horario_inicio: '08:00', horario_fim: '18:00', intervalo_almoco: ['12:00', '13:00'],
}

export function taxa(n: number, d: number): number | null {
  return d > 0 ? n / d : null
}

export const pct = (v: number | null, casas = 0) => v === null ? '—' : `${(v * 100).toFixed(casas).replace('.', ',')}%`

export function filtrarPeriodo<T>(itens: T[], i: Intervalo, data: (x: T) => string | null | undefined): T[] {
  return itens.filter(x => { const d = data(x); return !!d && dentro(paraData(d), i) })
}

// ── Resumo de status ──────────────────────────────────────────────────────────

export interface Resumo {
  total: number
  realizados: number
  faltas: number
  cancelados: number
  semDesfecho: number // passados ainda agendado/confirmado
  futuros: number
  teleconsultas: number // não canceladas com link de vídeo
  taxaComparecimento: number | null
  taxaFalta: number | null
  taxaCancelamento: number | null
}

export function resumir(ags: AgRel[], agora: Date): Resumo {
  let realizados = 0, faltas = 0, cancelados = 0, semDesfecho = 0, futuros = 0, tele = 0
  for (const a of ags) {
    if (a.status === 'realizado') realizados++
    else if (a.status === 'faltou') faltas++
    else if (a.status === 'cancelado') cancelados++
    else if (new Date(a.data_hora) < agora) semDesfecho++
    else futuros++
    if (a.status !== 'cancelado' && a.meet_link) tele++
  }
  return {
    total: ags.length, realizados, faltas, cancelados, semDesfecho, futuros, teleconsultas: tele,
    taxaComparecimento: taxa(realizados, realizados + faltas),
    taxaFalta: taxa(faltas, realizados + faltas),
    taxaCancelamento: taxa(cancelados, ags.length),
  }
}

/** Variação entre períodos. `pp` = em pontos percentuais (para taxas). */
export function variacao(atual: number | null, anterior: number | null, pp = false): { delta: string; sinal: -1 | 0 | 1 } | null {
  if (atual === null || anterior === null) return null
  if (pp) {
    const d = Math.round((atual - anterior) * 1000) / 10
    return { delta: `${Math.abs(d).toFixed(1).replace('.', ',')} p.p.`, sinal: d > 0 ? 1 : d < 0 ? -1 : 0 }
  }
  if (atual === anterior) return { delta: '0%', sinal: 0 }
  if (anterior === 0) return { delta: 'novo', sinal: 1 }
  const v = Math.round(((atual - anterior) / anterior) * 100)
  return { delta: `${Math.abs(v)}%`, sinal: v > 0 ? 1 : v < 0 ? -1 : 0 }
}

// ── Retornos ──────────────────────────────────────────────────────────────────

const RETORNO_CONCLUIDO = ['concluido', 'concluído', 'realizado']
const RETORNO_DESCARTADO = ['descartado', 'cancelado']
/** Lista de espera (migration 0010): quem ainda aguarda vaga. */
export const ESPERA_ATIVA = ['aguardando', 'oferecido']

/** Usa a tabela `retornos` quando existe; senão deriva dos agendamentos do tipo "retorno". */
export function contarRetornos(retornos: RetornoRel[] | null, agsPeriodo: AgRel[], i: Intervalo): { previstos: number; concluidos: number; fonte: 'tabela' | 'agenda' } {
  if (retornos) {
    const doPeriodo = filtrarPeriodo(retornos, i, r => r.data_prevista).filter(r => !RETORNO_DESCARTADO.includes(String(r.status)))
    return { previstos: doPeriodo.length, concluidos: doPeriodo.filter(r => RETORNO_CONCLUIDO.includes(String(r.status))).length, fonte: 'tabela' }
  }
  const ret = agsPeriodo.filter(a => a.tipo === 'retorno' && a.status !== 'cancelado')
  return { previstos: ret.length, concluidos: ret.filter(a => a.status === 'realizado').length, fonte: 'agenda' }
}

// ── Ocupação ──────────────────────────────────────────────────────────────────

export const hhmm = (s: string) => { const [h, m] = s.split(':').map(Number); return (h || 0) * 60 + (m || 0) }

const sobreposicao = (a0: number, a1: number, b0: number, b1: number) => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0))

/** Minutos disponíveis de um dia de trabalho dentro da janela [de, ate) em minutos do dia. */
function minutosJornada(j: Jornada, de = 0, ate = 1440): number {
  const ini = hhmm(j.horario_inicio), fim = hhmm(j.horario_fim)
  let m = sobreposicao(ini, fim, de, ate)
  if (j.intervalo_almoco) {
    const a0 = Math.max(hhmm(j.intervalo_almoco[0]), ini), a1 = Math.min(hhmm(j.intervalo_almoco[1]), fim)
    if (a1 > a0) m -= sobreposicao(a0, a1, de, ate)
  }
  return Math.max(0, m)
}

/** Grade dia da semana × hora (7 × 24) com minutos disponíveis e ocupados. */
export interface Grade { disp: number[][]; ocup: number[][] }

const gradeVazia = (): Grade => ({
  disp: Array.from({ length: 7 }, () => Array(24).fill(0)),
  ocup: Array.from({ length: 7 }, () => Array(24).fill(0)),
})

export function minutosDisponiveis(j: Jornada, i: Intervalo): number {
  let total = 0
  for (let d = new Date(i.ini); d < i.fim; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
    if (j.dias_semana.includes(d.getDay())) total += minutosJornada(j)
  }
  return total
}

/** Distribui as durações dos agendamentos (não cancelados) pelas horas que ocupam. */
export function gradeOcupacao(ags: AgRel[], medicos: MedRel[], i: Intervalo): Grade {
  const g = gradeVazia()
  for (const m of medicos) {
    for (let d = new Date(i.ini); d < i.fim; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
      if (!m.jornada.dias_semana.includes(d.getDay())) continue
      for (let h = 0; h < 24; h++) g.disp[d.getDay()][h] += minutosJornada(m.jornada, h * 60, h * 60 + 60)
    }
  }
  const ids = new Set(medicos.map(m => m.id))
  for (const a of ags) {
    if (a.status === 'cancelado' || !ids.has(a.medico_id)) continue
    const dt = new Date(a.data_hora)
    if (!dentro(dt, i)) continue
    let ini = dt.getHours() * 60 + dt.getMinutes()
    const fim = Math.min(1440, ini + (a.duracao || DURACAO_PADRAO))
    while (ini < fim) {
      const h = Math.floor(ini / 60), corte = Math.min(fim, (h + 1) * 60)
      g.ocup[dt.getDay()][h] += corte - ini
      ini = corte
    }
  }
  return g
}

export interface Celula { disp: number; ocup: number; taxa: number | null }

export function resumirGrade(g: Grade) {
  const soma = (xs: number[]) => xs.reduce((s, x) => s + x, 0)
  const cel = (disp: number, ocup: number): Celula => ({ disp, ocup, taxa: taxa(ocup, disp) })
  const porDia = g.disp.map((linha, d) => cel(soma(linha), soma(g.ocup[d])))
  const porHora = Array.from({ length: 24 }, (_, h) => cel(soma(g.disp.map(l => l[h])), soma(g.ocup.map(l => l[h]))))
  const total = cel(soma(porDia.map(c => c.disp)), soma(porDia.map(c => c.ocup)))
  return { porDia, porHora, total }
}

/** Horários (dia × hora) com menor ocupação, entre os que têm atendimento disponível. */
export function horariosOciosos(g: Grade, limite = 0.5, max = 6): { dia: number; hora: number; taxa: number; livresMin: number }[] {
  const out: { dia: number; hora: number; taxa: number; livresMin: number }[] = []
  for (let d = 0; d < 7; d++) for (let h = 0; h < 24; h++) {
    const disp = g.disp[d][h]
    if (disp <= 0) continue
    const t = Math.min(1, g.ocup[d][h] / disp)
    if (t < limite) out.push({ dia: d, hora: h, taxa: t, livresMin: Math.max(0, disp - g.ocup[d][h]) })
  }
  return out.sort((a, b) => a.taxa - b.taxa || b.livresMin - a.livresMin).slice(0, max)
}

// ── Faltas: mapa de calor ─────────────────────────────────────────────────────

export interface CelulaFalta { faltas: number; base: number; taxa: number | null }
export const BASE_MINIMA = 3 // abaixo disso a taxa da célula não é confiável

/** Mapa dia da semana × hora com faltas ÷ (realizados + faltas). */
export function mapaFaltas(ags: AgRel[]): CelulaFalta[][] {
  const m = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => ({ faltas: 0, base: 0, taxa: null as number | null })))
  for (const a of ags) {
    if (a.status !== 'faltou' && a.status !== 'realizado') continue
    const dt = new Date(a.data_hora)
    const c = m[dt.getDay()][dt.getHours()]
    c.base++
    if (a.status === 'faltou') c.faltas++
  }
  for (const linha of m) for (const c of linha) c.taxa = taxa(c.faltas, c.base)
  return m
}

/** Faixa de horas a mostrar no mapa (só as que têm movimento), com mínimo 8h–18h. */
export function faixaHoras(mapa: { base: number }[][]): number[] {
  let min = 8, max = 17
  mapa.forEach(l => l.forEach((c, h) => { if (c.base > 0) { min = Math.min(min, h); max = Math.max(max, h) } }))
  return Array.from({ length: max - min + 1 }, (_, k) => min + k)
}

export function rankingFaltas(mapa: CelulaFalta[][], max = 5): { dia: number; hora: number; faltas: number; base: number; taxa: number }[] {
  const out: { dia: number; hora: number; faltas: number; base: number; taxa: number }[] = []
  mapa.forEach((l, d) => l.forEach((c, h) => {
    if (c.faltas > 0 && c.base >= BASE_MINIMA) out.push({ dia: d, hora: h, faltas: c.faltas, base: c.base, taxa: c.taxa! })
  }))
  return out.sort((a, b) => b.faltas - a.faltas || b.taxa - a.taxa).slice(0, max)
}

/** Insights em texto por regra (sem IA). Máximo 3, do mais forte ao mais fraco. */
export function insightsFaltas(ags: AgRel[], mapa: CelulaFalta[][]): string[] {
  const out: string[] = []
  const totalFaltas = mapa.flat().reduce((s, c) => s + c.faltas, 0)
  const totalBase = mapa.flat().reduce((s, c) => s + c.base, 0)
  if (totalBase === 0) return []
  if (totalFaltas === 0) return ['Nenhuma falta registrada no período. Continue com as confirmações.']
  const media = totalFaltas / totalBase
  const p = (v: number) => `${Math.round(v * 100)}%`

  // 1. Horário que concentra faltas
  const top = rankingFaltas(mapa, 1)[0]
  if (top && totalFaltas >= 5 && top.faltas / totalFaltas >= 0.1) {
    out.push(`${DIAS_PLURAL[top.dia]} às ${top.hora}h concentram ${p(top.faltas / totalFaltas)} das faltas — considere um lembrete 2h antes.`)
  }

  // 2. Dia da semana com taxa bem acima da média
  const porDia = mapa.map(l => l.reduce((s, c) => ({ f: s.f + c.faltas, b: s.b + c.base }), { f: 0, b: 0 }))
  const piorDia = porDia.map((x, d) => ({ d, t: taxa(x.f, x.b), b: x.b })).filter(x => x.b >= 10 && x.t !== null)
    .sort((a, b) => b.t! - a.t!)[0]
  if (piorDia && piorDia.t! >= media * 1.4) {
    out.push(`A taxa de falta às ${DIAS_PLURAL[piorDia.d].toLowerCase()} (${p(piorDia.t!)}) é ${(piorDia.t! / media).toFixed(1).replace('.', ',')}× a média do período (${p(media)}).`)
  }

  // 3. Confirmação 24h pelo WhatsApp
  const comDesfecho = ags.filter(a => a.status === 'realizado' || a.status === 'faltou')
  const conf = comDesfecho.filter(a => a.confirmacao_24h_status === 'confirmado')
  const semResp = comDesfecho.filter(a => a.confirmacao_24h_status && a.confirmacao_24h_status !== 'confirmado')
  const tf = (xs: AgRel[]) => taxa(xs.filter(a => a.status === 'faltou').length, xs.length)
  const tc = tf(conf), ts = tf(semResp)
  if (conf.length >= 10 && semResp.length >= 10 && tc !== null && ts !== null && ts - tc >= 0.05) {
    out.push(`Quem confirma pelo WhatsApp falta ${p(tc)}; quem não responde, ${p(ts)}. Ligue para quem não confirmou na véspera.`)
  }

  // 4. Teleconsulta x presencial
  const tele = comDesfecho.filter(a => a.meet_link), pres = comDesfecho.filter(a => !a.meet_link)
  const tt = tf(tele), tp = tf(pres)
  if (out.length < 3 && tele.length >= 10 && pres.length >= 10 && tt !== null && tp !== null && Math.abs(tt - tp) >= 0.04) {
    out.push(tt < tp
      ? `Teleconsultas têm menos faltas (${p(tt)}) que as presenciais (${p(tp)}) — ofereça vídeo para quem costuma faltar.`
      : `Teleconsultas têm mais faltas (${p(tt)}) que as presenciais (${p(tp)}) — reforce o envio do link no dia.`)
  }
  return out.slice(0, 3)
}

// ── Por médico ────────────────────────────────────────────────────────────────

export interface LinhaMedico {
  id: string
  nome: string
  cor?: string | null
  especialidade?: string | null
  total: number
  realizados: number
  realizadosAntes: number
  faltas: number
  taxaFalta: number | null
  cancelados: number
  ocupacao: number | null
  novos: number
  tele: number
  retornos: number
}

export function porMedico(
  medicos: MedRel[], ags: AgRel[], agsAntes: AgRel[], pacientes: PacRel[],
  retornos: RetornoRel[] | null, i: Intervalo, agora: Date,
): LinhaMedico[] {
  return medicos.map(m => {
    const meus = ags.filter(a => a.medico_id === m.id)
    const r = resumir(meus, agora)
    const disp = minutosDisponiveis(m.jornada, i)
    const ocup = meus.filter(a => a.status !== 'cancelado').reduce((s, a) => s + (a.duracao || DURACAO_PADRAO), 0)
    const ret = contarRetornos(retornos ? retornos.filter(x => x.medico_id === m.id) : null, meus, i)
    return {
      id: m.id, nome: m.nome, cor: m.cor, especialidade: m.especialidade,
      total: r.total, realizados: r.realizados,
      realizadosAntes: agsAntes.filter(a => a.medico_id === m.id && a.status === 'realizado').length,
      faltas: r.faltas, taxaFalta: r.taxaFalta, cancelados: r.cancelados,
      ocupacao: taxa(ocup, disp),
      novos: filtrarPeriodo(pacientes, i, p => p.criado_em).filter(p => p.medico_id === m.id).length,
      tele: r.teleconsultas, retornos: ret.previstos,
    }
  })
}

export type ColunaMedico = 'nome' | 'realizados' | 'faltas' | 'taxaFalta' | 'cancelados' | 'ocupacao' | 'novos' | 'tele' | 'retornos'

export function ordenarLinhas(linhas: LinhaMedico[], col: ColunaMedico, dir: 'asc' | 'desc'): LinhaMedico[] {
  const f = dir === 'asc' ? 1 : -1
  return [...linhas].sort((a, b) => {
    if (col === 'nome') return a.nome.localeCompare(b.nome, 'pt-BR') * f
    const va = a[col] ?? -1, vb = b[col] ?? -1
    return ((va as number) - (vb as number)) * f || a.nome.localeCompare(b.nome, 'pt-BR')
  })
}

// ── Convênios ─────────────────────────────────────────────────────────────────

export interface LinhaConvenio { nome: string; atendimentos: number; realizados: number; faltas: number; taxaFalta: number | null; parte: number }

/** Agendamentos não cancelados por convênio do paciente (o convênio já vem normalizado do carregamento). */
export function porConvenio(ags: AgRel[]): LinhaConvenio[] {
  const mapa: Record<string, { n: number; r: number; f: number }> = {}
  for (const a of ags) {
    if (a.status === 'cancelado') continue
    const c = a.convenio || 'Particular'
    const x = (mapa[c] ??= { n: 0, r: 0, f: 0 })
    x.n++
    if (a.status === 'realizado') x.r++
    if (a.status === 'faltou') x.f++
  }
  const total = Object.values(mapa).reduce((s, x) => s + x.n, 0)
  return Object.entries(mapa)
    .map(([nome, x]) => ({ nome, atendimentos: x.n, realizados: x.r, faltas: x.f, taxaFalta: taxa(x.f, x.r + x.f), parte: total ? x.n / total : 0 }))
    .sort((a, b) => b.atendimentos - a.atendimentos)
}

/** Evolução mensal: para cada mês, contagem por convênio (top N + "Outros"). */
export function evolucaoConvenios(ags: AgRel[], meses: Intervalo[], top = 5): { series: string[]; meses: { ini: Date; valores: Record<string, number>; total: number }[] } {
  const ranking = porConvenio(ags.filter(a => meses.some(m => dentro(new Date(a.data_hora), m))))
  const principais = ranking.slice(0, top).map(r => r.nome)
  const temOutros = ranking.length > top
  const series = temOutros ? [...principais, 'Outros'] : principais
  return {
    series,
    meses: meses.map(m => {
      const valores: Record<string, number> = Object.fromEntries(series.map(s => [s, 0]))
      let total = 0
      for (const a of ags) {
        if (a.status === 'cancelado' || !dentro(new Date(a.data_hora), m)) continue
        const c = a.convenio || 'Particular'
        const k = principais.includes(c) ? c : 'Outros'
        if (k in valores) { valores[k]++; total++ }
      }
      return { ini: m.ini, valores, total }
    }),
  }
}
