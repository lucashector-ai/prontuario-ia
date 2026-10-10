/**
 * Painel do gestor — indicadores do atendimento num período (servidor).
 *
 *   const r = await indicadores(ctx, { de: '2026-10-01', ate: '2026-10-09' })
 *
 * Tempos em minutos. "Espera" = da chegada até a chamada do médico; "consulta" =
 * do início ao fim; "triagem" = da chegada até sair da triagem.
 */
import { supabaseServidor as db } from '@/lib/servidor'
import { medicosDaClinica, type Contexto } from './servidor'
import { limitesDoDiaSP } from './comum'

const minutos = (a?: string | null, b?: string | null) =>
  a && b ? (new Date(b).getTime() - new Date(a).getTime()) / 60000 : null
const media = (l: (number | null)[]) => {
  const v = l.filter((x): x is number => x !== null && x >= 0 && x < 24 * 60)
  return v.length ? Math.round(v.reduce((s, x) => s + x, 0) / v.length) : null
}
const mediana = (l: (number | null)[]) => {
  const v = l.filter((x): x is number => x !== null && x >= 0 && x < 24 * 60).sort((a, b) => a - b)
  if (!v.length) return null
  const m = Math.floor(v.length / 2)
  return Math.round(v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2)
}
const horaSP = (iso: string) => Number(new Date(iso).toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: 'America/Sao_Paulo' })) % 24
const diaSemanaSP = (iso: string) => new Date(new Date(iso).toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' })).getDay()

export async function indicadores(ctx: Contexto, p: { de: string; ate: string; medicoId?: string | null }) {
  const medicos = (await medicosDaClinica(ctx)) as { id: string; nome: string }[]
  const ids = p.medicoId ? medicos.filter(m => m.id === p.medicoId).map(m => m.id) : medicos.map(m => m.id)
  if (!ids.length) return null
  const { de } = limitesDoDiaSP(p.de)
  const { ate } = limitesDoDiaSP(p.ate)

  const [ats, ags, rets, balcao] = await Promise.all([
    db.from('atendimentos').select('medico_id, status, origem, prioridade, risco, chegada_em, chamado_em, inicio_em, fim_em, saida_status')
      .eq('clinica_id', ctx.clinica).in('medico_id', ids).gte('dia', p.de).lte('dia', p.ate).limit(20000),
    db.from('agendamentos').select('medico_id, status, data_hora, tipo').in('medico_id', ids).gte('data_hora', de).lte('data_hora', ate).limit(20000),
    db.from('retornos').select('medico_id, status, origem, criado_em').in('medico_id', ids).gte('criado_em', de).lte('criado_em', ate).limit(20000),
    db.from('senhas_balcao').select('criado_em, chamado_em, status').eq('clinica_id', ctx.clinica).gte('dia', p.de).lte('dia', p.ate).limit(20000),
  ])
  const A = (ats.data || []) as any[]
  const G = (ags.data || []) as any[]
  const R = (rets.data || []) as any[]
  const B = balcao.error ? [] : ((balcao.data || []) as any[])

  const finalizados = A.filter(a => a.status === 'finalizado')
  const passados = G.filter(g => new Date(g.data_hora).getTime() < Date.now() && g.status !== 'cancelado')
  const faltas = passados.filter(g => g.status === 'faltou').length

  // Chegadas por hora e por dia da semana (para ver o pico)
  const porHora = Array.from({ length: 24 }, (_, h) => ({ hora: h, chegadas: 0, esperaMedia: null as number | null }))
  const esperasPorHora: number[][] = Array.from({ length: 24 }, () => [])
  for (const a of A) {
    const h = horaSP(a.chegada_em)
    porHora[h].chegadas++
    const e = minutos(a.chegada_em, a.chamado_em)
    if (e !== null) esperasPorHora[h].push(e)
  }
  porHora.forEach((x, h) => { x.esperaMedia = media(esperasPorHora[h]) })
  const porDiaSemana = Array.from({ length: 7 }, (_, d) => ({ dia: d, chegadas: A.filter(a => diaSemanaSP(a.chegada_em) === d).length }))

  const contar = (l: any[], campo: string) => l.reduce<Record<string, number>>((acc, x) => { const k = x[campo] || 'nenhum'; acc[k] = (acc[k] || 0) + 1; return acc }, {})

  const porMedico = medicos.filter(m => ids.includes(m.id)).map(m => {
    const meus = A.filter(a => a.medico_id === m.id)
    const meusAg = passados.filter(g => g.medico_id === m.id)
    const fim = meus.filter(a => a.status === 'finalizado')
    return {
      id: m.id, nome: m.nome,
      atendidos: fim.length,
      espera: media(meus.map(a => minutos(a.chegada_em, a.chamado_em))),
      consulta: media(fim.map(a => minutos(a.inicio_em, a.fim_em))),
      faltas: meusAg.filter(g => g.status === 'faltou').length,
      agendados: meusAg.length,
      retornos: R.filter(r => r.medico_id === m.id && r.origem === 'consulta').length,
    }
  }).sort((a, b) => b.atendidos - a.atendidos)

  const retornosConsulta = R.filter(r => r.origem === 'consulta')
  const pico = porHora.reduce((m, x) => (x.chegadas > m.chegadas ? x : m), porHora[0])

  return {
    periodo: { de: p.de, ate: p.ate },
    resumo: {
      chegadas: A.length,
      atendidos: finalizados.length,
      esperaMedia: media(A.map(a => minutos(a.chegada_em, a.chamado_em))),
      esperaMediana: mediana(A.map(a => minutos(a.chegada_em, a.chamado_em))),
      consultaMedia: media(finalizados.map(a => minutos(a.inicio_em, a.fim_em))),
      agendados: passados.length,
      faltas,
      taxaFaltas: passados.length ? Math.round((faltas / passados.length) * 100) : null,
      naoAtenderamChamada: A.filter(a => a.status === 'ausente').length,
      retornosPedidos: retornosConsulta.length,
      retornosAgendados: retornosConsulta.filter(r => r.status === 'agendado' || r.status === 'concluido').length,
      saidasPendentes: A.filter(a => a.saida_status === 'pendente').length,
      balcaoSenhas: B.length,
      balcaoEspera: media(B.map(b => minutos(b.criado_em, b.chamado_em))),
    },
    porHora: porHora.filter(x => x.hora >= 6 && x.hora <= 22),
    porDiaSemana,
    porOrigem: contar(A, 'origem'),
    porRisco: contar(A.filter(a => a.risco), 'risco'),
    porPrioridade: contar(A, 'prioridade'),
    porMedico,
    pico: pico.chegadas ? pico.hora : null,
  }
}
