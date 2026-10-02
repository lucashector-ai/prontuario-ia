import { describe, it, expect } from 'vitest'
import {
  resumir, taxa, variacao, minutosDisponiveis, gradeOcupacao, resumirGrade, horariosOciosos,
  mapaFaltas, rankingFaltas, insightsFaltas, porMedico, ordenarLinhas, porConvenio, contarRetornos, evolucaoConvenios,
} from '../calculos'
import { intervaloPeriodo, intervaloAnterior, mesesAte } from '../periodo'
import { paraCsv } from '../csv'
import { gerarDemo } from '../demo'
import type { AgRel, Jornada, MedRel } from '../tipos'

let n = 0
const ag = (dt: Date, status: string, extra: Partial<AgRel> = {}): AgRel => ({
  id: `a${++n}`, medico_id: 'm1', paciente_id: 'p1', data_hora: dt.toISOString(), duracao: 30, tipo: 'consulta', status, ...extra,
})
const jornada: Jornada = { dias_semana: [1, 2, 3, 4, 5], horario_inicio: '08:00', horario_fim: '12:00', intervalo_almoco: null }
const med: MedRel = { id: 'm1', nome: 'Dra. Ana', jornada }
// semana de 5 a 11 de janeiro de 2026: segunda (5) a domingo (11)
const semana = { ini: new Date(2026, 0, 5), fim: new Date(2026, 0, 12) }
const agora = new Date(2026, 0, 20)

describe('taxas', () => {
  it('comparecimento e falta ignoram cancelados e passados sem desfecho', () => {
    const r = resumir([
      ag(new Date(2026, 0, 5, 8), 'realizado'),
      ag(new Date(2026, 0, 5, 9), 'realizado'),
      ag(new Date(2026, 0, 5, 10), 'realizado'),
      ag(new Date(2026, 0, 6, 8), 'faltou'),
      ag(new Date(2026, 0, 6, 9), 'cancelado'),
      ag(new Date(2026, 0, 7, 9), 'agendado'), // passado sem desfecho
      ag(new Date(2026, 0, 30, 9), 'confirmado'), // futuro
    ], agora)
    expect(r.realizados).toBe(3)
    expect(r.faltas).toBe(1)
    expect(r.taxaComparecimento).toBe(0.75)
    expect(r.taxaFalta).toBe(0.25)
    expect(r.taxaCancelamento).toBeCloseTo(1 / 7)
    expect(r.semDesfecho).toBe(1)
    expect(r.futuros).toBe(1)
  })

  it('taxa sem base é null e variação trata zero', () => {
    expect(taxa(1, 0)).toBeNull()
    expect(resumir([], agora).taxaFalta).toBeNull()
    expect(variacao(10, 0)).toEqual({ delta: 'novo', sinal: 1 })
    expect(variacao(5, 10)).toEqual({ delta: '50%', sinal: -1 })
    expect(variacao(0.12, 0.1, true)).toEqual({ delta: '2,0 p.p.', sinal: 1 })
    expect(variacao(null, 1)).toBeNull()
  })
})

describe('ocupação', () => {
  it('minutos disponíveis contam só os dias da jornada e descontam o almoço', () => {
    expect(minutosDisponiveis(jornada, semana)).toBe(5 * 240)
    const comAlmoco: Jornada = { ...jornada, horario_fim: '14:00', intervalo_almoco: ['12:00', '13:00'] }
    expect(minutosDisponiveis(comAlmoco, semana)).toBe(5 * 300)
  })

  it('distribui a duração pelas horas e ignora cancelados', () => {
    const g = gradeOcupacao([
      ag(new Date(2026, 0, 5, 8, 30), 'realizado', { duracao: 60 }), // 30 min às 8h + 30 às 9h
      ag(new Date(2026, 0, 5, 10), 'cancelado', { duracao: 60 }),
      ag(new Date(2026, 0, 6, 8), 'faltou', { duracao: null }), // usa 30 min padrão
    ], [med], semana)
    expect(g.ocup[1][8]).toBe(30)
    expect(g.ocup[1][9]).toBe(30)
    expect(g.ocup[1][10]).toBe(0)
    expect(g.ocup[2][8]).toBe(30)
    expect(g.disp[1][8]).toBe(60)
    expect(g.disp[0][8]).toBe(0) // domingo fora da jornada
    const r = resumirGrade(g)
    expect(r.total.disp).toBe(1200)
    expect(r.total.taxa).toBeCloseTo(90 / 1200)
    expect(r.porDia[1].taxa).toBeCloseTo(60 / 240)
  })

  it('horários ociosos vêm do menos ao mais ocupado', () => {
    const g = gradeOcupacao([ag(new Date(2026, 0, 5, 8), 'realizado', { duracao: 60 })], [med], semana)
    const o = horariosOciosos(g, 0.5, 50)
    expect(o.every(x => x.taxa < 0.5)).toBe(true)
    expect(o.find(x => x.dia === 1 && x.hora === 8)).toBeUndefined() // 100% ocupado
    expect(o[0].taxa).toBe(0)
  })

  it('ocupação por médico = durações ÷ jornada', () => {
    const ags = [ag(new Date(2026, 0, 5, 8), 'realizado', { duracao: 120 }), ag(new Date(2026, 0, 6, 8), 'cancelado', { duracao: 120 })]
    const [l] = porMedico([med], ags, [], [], null, semana, agora)
    expect(l.ocupacao).toBeCloseTo(120 / 1200)
    expect(l.realizados).toBe(1)
    expect(l.cancelados).toBe(1)
  })
})

describe('faltas', () => {
  const ags = [
    ...Array.from({ length: 6 }, () => ag(new Date(2026, 0, 5, 8), 'faltou')),
    ...Array.from({ length: 4 }, () => ag(new Date(2026, 0, 5, 8), 'realizado')),
    ...Array.from({ length: 2 }, () => ag(new Date(2026, 0, 7, 14), 'faltou')),
    ...Array.from({ length: 18 }, () => ag(new Date(2026, 0, 7, 14), 'realizado')),
  ]
  it('mapa de calor calcula taxa por dia × hora', () => {
    const m = mapaFaltas(ags)
    expect(m[1][8]).toEqual({ faltas: 6, base: 10, taxa: 0.6 })
    expect(m[3][14].taxa).toBe(0.1)
    expect(m[2][8].taxa).toBeNull()
  })
  it('ranking e insight por regra', () => {
    const m = mapaFaltas(ags)
    expect(rankingFaltas(m)[0]).toMatchObject({ dia: 1, hora: 8, faltas: 6 })
    const ins = insightsFaltas(ags, m)
    expect(ins[0]).toBe('Segundas às 8h concentram 75% das faltas — considere um lembrete 2h antes.')
  })
  it('sem faltas gera mensagem positiva; sem dados, nada', () => {
    expect(insightsFaltas([], mapaFaltas([]))).toEqual([])
    const ok = [ag(new Date(2026, 0, 5, 8), 'realizado')]
    expect(insightsFaltas(ok, mapaFaltas(ok))[0]).toMatch(/Nenhuma falta/)
  })
})

describe('períodos', () => {
  const hoje = new Date(2026, 2, 15)
  it('mês, mês passado, 3 meses e anterior', () => {
    expect(intervaloPeriodo('mes', hoje)).toEqual({ ini: new Date(2026, 2, 1), fim: new Date(2026, 3, 1) })
    expect(intervaloPeriodo('mes_passado', hoje)).toEqual({ ini: new Date(2026, 1, 1), fim: new Date(2026, 2, 1) })
    const t = intervaloPeriodo('3m', hoje)
    expect(intervaloAnterior(t)).toEqual({ ini: new Date(2025, 9, 1), fim: new Date(2026, 0, 1) })
    expect(intervaloAnterior(intervaloPeriodo('ano', hoje))).toEqual({ ini: new Date(2025, 0, 1), fim: new Date(2026, 0, 1) })
  })
  it('personalizado inclui o último dia e o anterior tem o mesmo tamanho', () => {
    const c = intervaloPeriodo('custom', hoje, { ini: '2026-03-10', fim: '2026-03-16' })
    expect(c).toEqual({ ini: new Date(2026, 2, 10), fim: new Date(2026, 2, 17) })
    expect(intervaloAnterior(c)).toEqual({ ini: new Date(2026, 2, 3), fim: new Date(2026, 2, 10) })
  })
  it('meses até o fim do período', () => {
    const ms = mesesAte(new Date(2026, 3, 1), 3)
    expect(ms.map(m => m.ini.getMonth())).toEqual([0, 1, 2])
  })
})

describe('convênios, retornos, ordenação e CSV', () => {
  it('agrupa convênios e ignora cancelados', () => {
    const r = porConvenio([
      ag(new Date(2026, 0, 5, 8), 'realizado', { convenio: 'Unimed' }),
      ag(new Date(2026, 0, 5, 9), 'faltou', { convenio: 'Unimed' }),
      ag(new Date(2026, 0, 5, 10), 'realizado', { convenio: null }),
      ag(new Date(2026, 0, 5, 11), 'cancelado', { convenio: 'Amil' }),
    ])
    expect(r.map(x => x.nome)).toEqual(['Unimed', 'Particular'])
    expect(r[0]).toMatchObject({ atendimentos: 2, faltas: 1, taxaFalta: 0.5 })
    const ev = evolucaoConvenios([ag(new Date(2026, 0, 5, 8), 'realizado', { convenio: 'Amil' })], mesesAte(new Date(2026, 1, 1), 2))
    expect(ev.meses[1].valores.Amil).toBe(1)
  })
  it('retornos: tabela quando existe, senão agenda', () => {
    expect(contarRetornos([
      { id: '1', medico_id: 'm1', status: 'concluido', data_prevista: '2026-01-06' },
      { id: '2', medico_id: 'm1', status: 'pendente', data_prevista: '2026-01-11' },
      { id: '3', medico_id: 'm1', status: 'cancelado', data_prevista: '2026-01-07' },
      { id: '4', medico_id: 'm1', status: 'pendente', data_prevista: '2026-01-12' },
    ], [], semana)).toEqual({ previstos: 2, concluidos: 1, fonte: 'tabela' })
    expect(contarRetornos(null, [ag(new Date(2026, 0, 5), 'realizado', { tipo: 'retorno' }), ag(new Date(2026, 0, 6), 'agendado', { tipo: 'retorno' })], semana))
      .toEqual({ previstos: 2, concluidos: 1, fonte: 'agenda' })
  })
  it('ordena linhas por coluna', () => {
    const base = { total: 0, realizadosAntes: 0, faltas: 0, cancelados: 0, novos: 0, tele: 0, retornos: 0, taxaFalta: null }
    const linhas = [
      { ...base, id: 'a', nome: 'Bruno', realizados: 5, ocupacao: 0.5 },
      { ...base, id: 'b', nome: 'Ana', realizados: 9, ocupacao: null },
    ]
    expect(ordenarLinhas(linhas, 'realizados', 'desc').map(l => l.id)).toEqual(['b', 'a'])
    expect(ordenarLinhas(linhas, 'nome', 'asc').map(l => l.id)).toEqual(['b', 'a'])
    expect(ordenarLinhas(linhas, 'ocupacao', 'desc').map(l => l.id)).toEqual(['a', 'b'])
  })
  it('CSV com ; e vírgula decimal', () => {
    expect(paraCsv(['Nome', 'Taxa'], [['Dra. Ana; cardio', 12.5], ['Bruno', null]])).toBe('Nome;Taxa\r\n"Dra. Ana; cardio";12,5\r\nBruno;')
  })
})

describe('demo', () => {
  it('é determinística e tem faltas concentradas na segunda cedo', () => {
    const hoje = new Date(2026, 5, 15, 12)
    const a = gerarDemo(hoje), b = gerarDemo(hoje)
    expect(a.agendamentos.length).toBe(b.agendamentos.length)
    expect(a.agendamentos[100]).toEqual(b.agendamentos[100])
    expect(a.medicos).toHaveLength(3)
    expect(a.agendamentos.length).toBeGreaterThan(2000)
    const m = mapaFaltas(a.agendamentos)
    const segCedo = m[1][8].taxa!, quaTarde = m[3][15].taxa!
    expect(segCedo).toBeGreaterThan(quaTarde)
  })
})
