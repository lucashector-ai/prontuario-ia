import { supabase } from '@/lib/supabase'

export type AgendaConfig = {
  duracao_consulta_min: number
  antecedencia_minima_horas: number
  antecedencia_maxima_dias: number
  dias_semana: number[]
  horario_inicio: string
  horario_fim: string
  intervalo_almoco: [string, string] | null
  modo_aprovacao: 'automatico' | 'manual'
  formulario_template_id?: string | null
}

export const CONFIG_DEFAULT: AgendaConfig = {
  duracao_consulta_min: 30,
  antecedencia_minima_horas: 24,
  antecedencia_maxima_dias: 60,
  dias_semana: [1, 2, 3, 4, 5],
  horario_inicio: '09:00',
  horario_fim: '18:00',
  intervalo_almoco: ['12:00', '13:00'],
  modo_aprovacao: 'automatico',
  formulario_template_id: null,
}

export function parseConfig(raw: any): AgendaConfig {
  if (!raw || typeof raw !== 'object') return CONFIG_DEFAULT
  return {
    duracao_consulta_min: Number(raw.duracao_consulta_min) || CONFIG_DEFAULT.duracao_consulta_min,
    antecedencia_minima_horas: raw.antecedencia_minima_horas !== undefined ? Number(raw.antecedencia_minima_horas) : CONFIG_DEFAULT.antecedencia_minima_horas,
    antecedencia_maxima_dias: Number(raw.antecedencia_maxima_dias) || CONFIG_DEFAULT.antecedencia_maxima_dias,
    dias_semana: Array.isArray(raw.dias_semana) ? raw.dias_semana : CONFIG_DEFAULT.dias_semana,
    horario_inicio: raw.horario_inicio || CONFIG_DEFAULT.horario_inicio,
    horario_fim: raw.horario_fim || CONFIG_DEFAULT.horario_fim,
    intervalo_almoco: Array.isArray(raw.intervalo_almoco) ? raw.intervalo_almoco : CONFIG_DEFAULT.intervalo_almoco,
    formulario_template_id: raw.formulario_template_id || null,
    modo_aprovacao: raw.modo_aprovacao === 'manual' ? 'manual' : 'automatico',
  }
}

function hhmmParaMin(hhmm: string): number {
  const partes = hhmm.split(':').map(Number)
  return partes[0] * 60 + partes[1]
}

function minParaHhmm(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0')
}

function gerarSlotsTeoricos(config: AgendaConfig): string[] {
  const inicioMin = hhmmParaMin(config.horario_inicio)
  const fimMin = hhmmParaMin(config.horario_fim)
  const duracao = config.duracao_consulta_min
  const slots: string[] = []

  for (let t = inicioMin; t + duracao <= fimMin; t += duracao) {
    const slotInicio = t
    const slotFim = t + duracao

    if (config.intervalo_almoco) {
      const aIni = hhmmParaMin(config.intervalo_almoco[0])
      const aFim = hhmmParaMin(config.intervalo_almoco[1])
      if (slotInicio < aFim && slotFim > aIni) continue
    }

    slots.push(minParaHhmm(t))
  }

  return slots
}

async function buscarHorariosOcupados(medicoId: string, dataISO: string): Promise<Set<string>> {
  const ocupados = new Set<string>()
  const inicioDia = dataISO + 'T00:00:00'
  const fimDia = dataISO + 'T23:59:59'

  const { data: agendamentos } = await supabase
    .from('agendamentos')
    .select('data_hora, status')
    .eq('medico_id', medicoId)
    .gte('data_hora', inicioDia)
    .lte('data_hora', fimDia)

  if (agendamentos) {
    for (const a of agendamentos) {
      if (a.status === 'cancelado') continue
      const d = new Date(a.data_hora)
      const hhmm = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0')
      ocupados.add(hhmm)
    }
  }

  const { data: solicitacoes } = await supabase
    .from('agenda_publica_solicitacoes')
    .select('data_hora, status')
    .eq('medico_id', medicoId)
    .gte('data_hora', inicioDia)
    .lte('data_hora', fimDia)
    .in('status', ['aguardando_confirmacao', 'confirmado'])

  if (solicitacoes) {
    for (const s of solicitacoes) {
      const d = new Date(s.data_hora)
      const hhmm = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0')
      ocupados.add(hhmm)
    }
  }

  return ocupados
}

export async function calcularSlotsDisponiveis(
  medicoId: string,
  dataISO: string,
  config: AgendaConfig
): Promise<string[]> {
  const data = new Date(dataISO + 'T12:00:00')
  const diaSemana = data.getDay()

  if (!config.dias_semana.includes(diaSemana)) return []

  const agora = new Date()
  const limiteAntecedencia = new Date(agora.getTime() + config.antecedencia_minima_horas * 60 * 60 * 1000)

  const slotsTeoricos = gerarSlotsTeoricos(config)
  const ocupados = await buscarHorariosOcupados(medicoId, dataISO)

  return slotsTeoricos.filter(hhmm => {
    if (ocupados.has(hhmm)) return false
    const slotDate = new Date(dataISO + 'T' + hhmm + ':00')
    if (slotDate < limiteAntecedencia) return false
    return true
  })
}

export async function calcularDisponibilidadeMes(
  medicoId: string,
  ano: number,
  mes: number,
  config: AgendaConfig
): Promise<Record<string, number>> {
  const result: Record<string, number> = {}
  const ultimoDia = new Date(ano, mes, 0).getDate()
  const hoje = new Date()
  const limiteMax = new Date(hoje.getTime() + config.antecedencia_maxima_dias * 24 * 60 * 60 * 1000)
  const hojeApenasData = new Date(hoje.toDateString())

  for (let dia = 1; dia <= ultimoDia; dia++) {
    const dataObj = new Date(ano, mes - 1, dia)
    if (dataObj > limiteMax) continue
    if (dataObj < hojeApenasData) continue

    const dataISO = ano + '-' + String(mes).padStart(2, '0') + '-' + String(dia).padStart(2, '0')
    const slots = await calcularSlotsDisponiveis(medicoId, dataISO, config)
    if (slots.length > 0) result[dataISO] = slots.length
  }

  return result
}
