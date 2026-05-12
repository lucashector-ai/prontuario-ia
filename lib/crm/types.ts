export const STATUS_LEAD = ['novo', 'qualificado', 'agendado', 'atendido', 'perdido'] as const
export type StatusLead = (typeof STATUS_LEAD)[number]

export const ORIGEM_LEAD = ['instagram', 'indicacao', 'doctoralia', 'site', 'whatsapp', 'google', 'outro'] as const
export type OrigemLead = (typeof ORIGEM_LEAD)[number]

export const CANAL_CAMPANHA = ['whatsapp', 'email', 'sms', 'sofia'] as const
export type CanalCampanha = (typeof CANAL_CAMPANHA)[number]

export type Lead = {
  id: string
  clinica_id: string
  nome: string
  telefone: string | null
  email: string | null
  origem: OrigemLead
  interesse: string | null
  status: StatusLead
  paciente_id: string | null
  observacoes: string | null
  origem_form_id: string | null
  criado_em: string
  atualizado_em: string
}

export type Campanha = {
  id: string
  clinica_id: string
  nome: string
  segmento: Record<string, any>
  mensagem_template: string
  canal: CanalCampanha
  agendada_para: string | null
  enviada_em: string | null
  destinatarios_total: number
  destinatarios_alcancados: number
  status: 'rascunho' | 'agendada' | 'enviada' | 'cancelada'
  criada_em: string
}

export type CampoForm = {
  nome: string
  label: string
  tipo: 'texto' | 'email' | 'telefone' | 'textarea' | 'select'
  obrigatorio: boolean
  opcoes?: string[]
}

export type CrmForm = {
  id: string
  clinica_id: string
  slug: string
  titulo: string
  descricao: string | null
  campos: CampoForm[]
  cor_primaria: string | null
  mensagem_sucesso: string
  ativo: boolean
  total_submissoes: number
  criado_em: string
}

export const STATUS_LEAD_LABEL: Record<StatusLead, string> = {
  novo: 'Novo',
  qualificado: 'Qualificado',
  agendado: 'Agendado',
  atendido: 'Atendido',
  perdido: 'Perdido',
}

export const ORIGEM_LEAD_LABEL: Record<OrigemLead, string> = {
  instagram: 'Instagram',
  indicacao: 'Indicação',
  doctoralia: 'Doctoralia',
  site: 'Site',
  whatsapp: 'WhatsApp',
  google: 'Google',
  outro: 'Outro',
}

export const CANAL_LABEL: Record<CanalCampanha, string> = {
  whatsapp: 'WhatsApp',
  email: 'Email',
  sms: 'SMS',
  sofia: 'Sofia (IA)',
}
