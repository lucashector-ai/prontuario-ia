export type TipoCampo = 'texto' | 'textarea' | 'numero' | 'select' | 'multipla' | 'escala' | 'data' | 'sim_nao'

export type Campo = {
  id: string              // identificador unico no form (ex: "queixa_principal")
  tipo: TipoCampo
  label: string           // pergunta visivel
  descricao?: string      // hint abaixo do label
  obrigatorio: boolean
  
  // específico por tipo
  placeholder?: string                  // texto/textarea/numero
  opcoes?: string[]                     // select/multipla
  min?: number                          // numero/escala
  max?: number                          // numero/escala
  passo?: number                        // escala (ex: 1)
}

export type Template = {
  id: string
  clinica_id: string | null
  nome: string
  especialidade: string | null
  descricao: string | null
  campos: Campo[]
  publico: boolean
  criado_em: string
}

export type Envio = {
  id: string
  template_id: string
  clinica_id: string
  medico_id: string | null
  agendamento_id: string | null
  paciente_id: string | null
  nome_paciente: string
  telefone: string | null
  email: string | null
  token: string
  expira_em: string
  status: 'pendente' | 'preenchido' | 'expirado' | 'cancelado'
  origem: 'manual' | 'agenda_publica' | 'agendamento_interno'
  enviado_em: string
  preenchido_em: string | null
  resposta_id: string | null
}

export type Resposta = {
  id: string
  envio_id: string
  template_id: string
  paciente_id: string | null
  agendamento_id: string | null
  respostas: Record<string, any>
  resumo_ia: string | null
  preenchido_em: string
}
