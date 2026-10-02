/**
 * Dados de demonstração (/relatorios?demo=1): 3 médicos, ~6 meses de agenda + 3 semanas à frente.
 * Gerados de forma determinística (seed fixa) a partir de "hoje", com padrões plausíveis:
 *   - segundas cedo e sextas no fim da tarde concentram faltas;
 *   - quem confirma pelo WhatsApp falta bem menos;
 *   - movimento cresce um pouco a cada mês.
 */
import { tokens } from '../design-tokens'
import { paraInputData } from './periodo'
import type { AgRel, DadosRelatorio, EsperaRel, MedRel, PacRel, RetornoRel } from './tipos'

const SEED = 360

/** PRNG mulberry32 — mesma sequência a cada carregamento. */
export function criarAleatorio(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6D2B79F5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const CONVENIOS_PESO: [string, number][] = [
  ['Particular', 30], ['Unimed', 22], ['Bradesco Saúde', 12], ['SulAmérica', 10], ['Amil', 10],
  ['Hapvida', 6], ['Porto Seguro', 5], ['Cassi', 5],
]

type Perfil = { med: MedRel; slot: number; duracao: number; preenchimento: number; tele: number; faltaBase: number }

const PERFIS: Perfil[] = [
  {
    med: { id: 'demo-m1', nome: 'Dra. Mariana Albuquerque', especialidade: 'Cardiologia', cor: tokens.data.purple,
      jornada: { dias_semana: [1, 2, 3, 4, 5], horario_inicio: '08:00', horario_fim: '18:00', intervalo_almoco: ['12:00', '13:00'] } },
    slot: 30, duracao: 30, preenchimento: 0.8, tele: 0.08, faltaBase: 0.06,
  },
  {
    med: { id: 'demo-m2', nome: 'Dr. Rafael Montenegro', especialidade: 'Dermatologia', cor: tokens.data.pink,
      jornada: { dias_semana: [1, 2, 3, 4, 5], horario_inicio: '09:00', horario_fim: '19:00', intervalo_almoco: ['13:00', '14:00'] } },
    slot: 30, duracao: 30, preenchimento: 0.66, tele: 0.04, faltaBase: 0.07,
  },
  {
    med: { id: 'demo-m3', nome: 'Dra. Camila Torres', especialidade: 'Psiquiatria', cor: tokens.data.green,
      jornada: { dias_semana: [1, 2, 4, 5], horario_inicio: '08:00', horario_fim: '17:00', intervalo_almoco: ['12:00', '13:00'] } },
    slot: 60, duracao: 50, preenchimento: 0.58, tele: 0.42, faltaBase: 0.09,
  },
]

export function gerarDemo(hoje: Date = new Date()): DadosRelatorio {
  const rnd = criarAleatorio(SEED)
  const escolher = <T,>(pesos: [T, number][]): T => {
    const tot = pesos.reduce((s, [, p]) => s + p, 0)
    let r = rnd() * tot
    for (const [v, p] of pesos) { if ((r -= p) <= 0) return v }
    return pesos[pesos.length - 1][0]
  }
  const inicio = new Date(hoje.getFullYear(), hoje.getMonth() - 5, 1)
  const fim = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + 21)
  const agora = hoje.getTime()

  const agendamentos: AgRel[] = []
  const pacientes: PacRel[] = []
  const retornos: RetornoRel[] = []
  const carteira: Record<string, PacRel[]> = {}
  let seq = 0

  for (let d = new Date(inicio); d < fim; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
    const dia = d.getDay()
    const mesesDesdeInicio = (d.getFullYear() - inicio.getFullYear()) * 12 + d.getMonth() - inicio.getMonth()
    for (const p of PERFIS) {
      const j = p.med.jornada
      if (!j.dias_semana.includes(dia)) continue
      const [hi] = j.horario_inicio.split(':').map(Number), [hf] = j.horario_fim.split(':').map(Number)
      const almoco = j.intervalo_almoco ? Number(j.intervalo_almoco[0].split(':')[0]) : -1
      for (let min = hi * 60; min + p.duracao <= hf * 60; min += p.slot) {
        const hora = Math.floor(min / 60)
        if (hora === almoco) continue
        // procura: cresce ~2,5% ao mês; manhã de sexta e fim de tarde um pouco mais vazios
        let prob = p.preenchimento + mesesDesdeInicio * 0.025
        if (dia === 5 && hora >= 16) prob -= 0.25
        if (hora >= 17) prob -= 0.12
        if (dia === 3 && hora < 10) prob -= 0.1
        const futuro = new Date(d.getFullYear(), d.getMonth(), d.getDate(), hora, min % 60).getTime() > agora
        if (futuro) prob -= 0.15 + (new Date(d).getTime() - agora) / (86400000 * 40) // agenda futura ainda enchendo
        if (rnd() > prob) continue

        const dt = new Date(d.getFullYear(), d.getMonth(), d.getDate(), hora, min % 60)
        // paciente: novo ou da carteira
        const lista = (carteira[p.med.id] ??= [])
        let pac: PacRel
        if (lista.length < 12 || rnd() < 0.24) {
          pac = {
            id: `demo-p${pacientes.length + 1}`, medico_id: p.med.id, convenio: escolher(CONVENIOS_PESO),
            criado_em: new Date(dt.getTime() - Math.floor(rnd() * 4) * 86400000).toISOString(),
          }
          pacientes.push(pac); lista.push(pac)
        } else pac = lista[Math.floor(rnd() * lista.length)]

        const tele = rnd() < p.tele
        const tipo = escolher<string>([['consulta', 66], ['retorno', 27], ['exame', 5], ['urgencia', 2]])
        let status: string, confirmacao: string | null = null
        if (futuro) {
          status = dt.getTime() - agora < 2 * 86400000 && rnd() < 0.6 ? 'confirmado' : 'agendado'
        } else {
          confirmacao = escolher<string>([['confirmado', 68], ['pendente', 24], ['nao_confirmado', 8]])
          let pf = p.faltaBase
          if (dia === 1 && hora < 10) pf += 0.17 // segunda cedo
          if (dia === 5 && hora >= 16) pf += 0.09 // sexta fim de tarde
          if (dia === 2 && hora === 8) pf += 0.07
          if (tele) pf -= 0.03
          if (pac.convenio === 'Hapvida') pf += 0.04
          pf *= confirmacao === 'confirmado' ? 0.45 : 1.9
          const r = rnd()
          status = r < 0.055 ? 'cancelado' : r < 0.055 + pf ? 'faltou' : rnd() < 0.012 ? 'agendado' : 'realizado'
        }
        agendamentos.push({
          id: `demo-a${++seq}`, medico_id: p.med.id, paciente_id: pac.id, data_hora: dt.toISOString(),
          duracao: p.duracao, tipo, status, meet_link: tele ? 'https://meet.google.com/demo' : null,
          confirmacao_24h_status: confirmacao, convenio: pac.convenio,
        })
        if (status === 'realizado' && tipo === 'consulta' && rnd() < 0.4) {
          const prev = new Date(dt.getTime() + (rnd() < 0.6 ? 30 : 60) * 86400000)
          const vencido = prev.getTime() < agora
          retornos.push({
            id: `demo-r${retornos.length + 1}`, medico_id: p.med.id, data_prevista: paraInputData(prev),
            status: vencido ? (rnd() < 0.72 ? 'concluido' : 'descartado') : (rnd() < 0.5 ? 'agendado' : 'pendente'),
          })
        }
      }
    }
  }

  const listaEspera: EsperaRel[] = Array.from({ length: 14 }, (_, k) => ({
    id: `demo-e${k + 1}`, medico_id: PERFIS[k % 3].med.id, status: k % 5 === 4 ? 'oferecido' : 'aguardando',
  }))

  return { medicos: PERFIS.map(p => p.med), agendamentos, pacientes, retornos, listaEspera }
}
