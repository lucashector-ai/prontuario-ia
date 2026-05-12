export type PortalPaciente = {
  id: string
  paciente_id: string
  email: string
  ultima_visita: string | null
  preferencias: {
    notificacoes_email: boolean
    notificacoes_whatsapp: boolean
    idioma: string
  }
}

export type PortalDocumento = {
  id: string
  paciente_id: string
  tipo: 'atestado' | 'receita' | 'exame_laudo' | 'recibo' | 'outro'
  titulo: string
  url: string
  assinado_em: string | null
  criado_em: string
}

export type PortalChatMensagem = {
  id: string
  paciente_id: string
  remetente: 'paciente' | 'clinica' | 'sofia'
  conteudo: string
  lida: boolean
  criada_em: string
}

export type PortalProtocolo = {
  id: string
  paciente_id: string
  nome: string
  descricao: string | null
  iniciado_em: string
  termina_em: string | null
  proximo_passo: string | null
  progresso_percentual: number
  status: 'ativo' | 'concluido' | 'pausado' | 'cancelado'
}

export type Consulta = {
  id: string
  paciente_id: string
  medico_id: string | null
  data: string
  resumo?: string | null
  hipoteses?: string | null
  conduta?: string | null
  observacoes?: string | null
  status?: string | null
}

export type Agendamento = {
  id: string
  paciente_id: string
  medico_id: string | null
  data: string
  hora: string | null
  tipo: string | null
  status: string | null
  observacoes: string | null
}

export type Prescricao = {
  id: string
  paciente_id: string
  consulta_id: string | null
  conteudo: string | null
  medicamentos?: any
  criado_em: string
}

export type Exame = {
  id: string
  paciente_id: string
  nome: string
  data_realizacao: string | null
  laudo_url: string | null
  resultado_texto: string | null
  criado_em: string
}
