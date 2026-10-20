/**
 * Risco de falta de um agendamento, por regras simples e auditáveis (sem IA, sem crédito).
 * Cada fator soma pontos e deixa um motivo escrito — a recepção vê exatamente por que o
 * paciente aparece como risco e decide quem confirmar primeiro.
 */

export type NivelRisco = 'baixo' | 'medio' | 'alto'
export type RiscoFalta = { nivel: NivelRisco; pontos: number; motivos: string[] }

type Ag = {
  id: string
  paciente_id?: string | null
  data_hora: string
  status?: string | null
  criado_em?: string | null
  confirmacao_24h_status?: string | null
  confirmacao_24h_enviada?: boolean | null
}

const DIA = 86400000
const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']

/** Taxa de faltas da clínica por dia da semana × hora (só células com base suficiente). */
export function taxaFaltasPorHorario(ags: Ag[], baseMinima = 5): Map<string, number> {
  const c = new Map<string, { f: number; b: number }>()
  for (const a of ags) {
    if (a.status !== 'faltou' && a.status !== 'realizado') continue
    const d = new Date(a.data_hora)
    const k = `${d.getDay()}-${d.getHours()}`
    const v = c.get(k) || { f: 0, b: 0 }
    v.b++
    if (a.status === 'faltou') v.f++
    c.set(k, v)
  }
  const out = new Map<string, number>()
  c.forEach((v, k) => { if (v.b >= baseMinima) out.set(k, v.f / v.b) })
  return out
}

export function riscoFalta(ag: Ag, historicoPaciente: Ag[], taxaHorario?: Map<string, number>, agora = new Date()): RiscoFalta | null {
  if (ag.status !== 'agendado' && ag.status !== 'confirmado' && ag.status !== 'confirmacao_enviada') return null
  const quando = new Date(ag.data_hora)
  if (quando.getTime() < agora.getTime()) return null

  const motivos: string[] = []
  let pontos = 0
  const anteriores = historicoPaciente.filter(a => a.id !== ag.id && new Date(a.data_hora).getTime() < agora.getTime())
  const faltas = anteriores.filter(a => a.status === 'faltou').length
  const realizadas = anteriores.filter(a => a.status === 'realizado').length

  // 1. Histórico do próprio paciente (o fator mais forte)
  if (faltas >= 2) { pontos += 45; motivos.push(`Faltou ${faltas} vezes antes (de ${faltas + realizadas} consultas)`) }
  else if (faltas === 1) {
    const ultimaFalta = anteriores.filter(a => a.status === 'faltou').sort((a, b) => b.data_hora.localeCompare(a.data_hora))[0]
    const ultimaVeio = anteriores.filter(a => a.status === 'realizado').sort((a, b) => b.data_hora.localeCompare(a.data_hora))[0]
    if (!ultimaVeio || ultimaFalta.data_hora > ultimaVeio.data_hora) { pontos += 30; motivos.push('Faltou na última consulta') }
    else { pontos += 15; motivos.push('Já faltou uma vez') }
  } else if (realizadas === 0) { pontos += 10; motivos.push('Primeira consulta (sem histórico)') }

  // 2. Confirmação
  const confirmou = ag.status === 'confirmado' || ag.confirmacao_24h_status === 'confirmado'
  const horasAte = (quando.getTime() - agora.getTime()) / 3600000
  if (ag.confirmacao_24h_status === 'nao_confirmado') { pontos += 60; motivos.push('Avisou que não poderá ir') }
  else if (confirmou) { pontos -= 40; motivos.push('Confirmou presença') }
  else if (ag.confirmacao_24h_enviada && horasAte < 24) { pontos += 20; motivos.push('Não respondeu à confirmação de 24h') }

  // 3. Antecedência da marcação
  if (ag.criado_em) {
    const antecedencia = (quando.getTime() - new Date(ag.criado_em).getTime()) / DIA
    if (antecedencia > 30) { pontos += 12; motivos.push(`Marcado há mais de ${Math.floor(antecedencia)} dias`) }
    else if (antecedencia < 1) { pontos -= 10 }
  }

  // 4. Horário com muitas faltas na clínica
  const t = taxaHorario?.get(`${quando.getDay()}-${quando.getHours()}`)
  if (t !== undefined && t >= 0.25) { pontos += 10; motivos.push(`${DIAS[quando.getDay()]} às ${quando.getHours()}h tem ${Math.round(t * 100)}% de faltas na clínica`) }

  pontos = Math.max(0, Math.min(100, pontos))
  const nivel: NivelRisco = pontos >= 45 ? 'alto' : pontos >= 20 ? 'medio' : 'baixo'
  return { nivel, pontos, motivos }
}

/** Calcula o risco de todos os agendamentos futuros de uma vez (agrupa o histórico por paciente). */
export function riscosDaAgenda(ags: Ag[], agora = new Date()): Map<string, RiscoFalta> {
  const porPaciente = new Map<string, Ag[]>()
  for (const a of ags) if (a.paciente_id) { const l = porPaciente.get(a.paciente_id) || []; l.push(a); porPaciente.set(a.paciente_id, l) }
  const taxa = taxaFaltasPorHorario(ags)
  const out = new Map<string, RiscoFalta>()
  for (const a of ags) {
    if (!a.paciente_id) continue
    const r = riscoFalta(a, porPaciente.get(a.paciente_id) || [], taxa, agora)
    if (r) out.set(a.id, r)
  }
  return out
}
