/** Tipos dos relatórios de gestão (só os campos que os cálculos usam). */

export type Intervalo = { ini: Date; fim: Date } // fim exclusivo

export type StatusAgendamento = 'agendado' | 'confirmado' | 'realizado' | 'faltou' | 'cancelado'

export interface AgRel {
  id: string
  medico_id: string
  paciente_id: string | null
  data_hora: string
  duracao: number | null
  tipo: string | null
  status: StatusAgendamento | string
  meet_link?: string | null
  confirmacao_24h_status?: string | null
  convenio?: string | null // do paciente, já normalizado no carregamento
}

export interface PacRel {
  id: string
  medico_id: string | null
  criado_em: string
  convenio: string | null
}

/** Horário de atendimento usado para estimar a ocupação (vem de medicos.agenda_publica_config). */
export interface Jornada {
  dias_semana: number[] // 0 = domingo
  horario_inicio: string // "08:00"
  horario_fim: string
  intervalo_almoco: [string, string] | null
}

export interface MedRel {
  id: string
  nome: string
  cor?: string | null
  especialidade?: string | null
  jornada: Jornada
}

export interface RetornoRel {
  id: string
  medico_id: string | null
  status: string | null
  data_prevista: string | null
}

export interface EsperaRel {
  id: string
  medico_id: string | null
  status: string | null
}

export interface DadosRelatorio {
  medicos: MedRel[]
  agendamentos: AgRel[]
  pacientes: PacRel[]
  retornos: RetornoRel[] | null // null = tabela ainda não existe
  listaEspera: EsperaRel[] | null
}
