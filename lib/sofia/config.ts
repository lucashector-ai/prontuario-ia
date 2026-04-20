import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export type SofiaConfig = {
  id?: string
  medico_id: string
  ativa: boolean
  autonomia: 'auto' | 'supervisionado'
  saudacao?: string | null
  horario_funcionamento: Record<string, string | null>
  duracao_consulta_padrao: number
  preco_consulta?: number | null
  precos_tipos: Record<string, number>
  pre_atendimento_ativo: boolean
  pre_atendimento_automatico: boolean
  pre_atendimento_prompt_extra?: string | null
}

const DEFAULT: Omit<SofiaConfig, 'medico_id'> = {
  ativa: true,
  autonomia: 'auto',
  saudacao: null,
  horario_funcionamento: {
    seg: '08:00-18:00', ter: '08:00-18:00', qua: '08:00-18:00',
    qui: '08:00-18:00', sex: '08:00-18:00', sab: '08:00-12:00', dom: null
  },
  duracao_consulta_padrao: 30,
  preco_consulta: null,
  precos_tipos: {},
  pre_atendimento_ativo: true,
  pre_atendimento_automatico: true,
  pre_atendimento_prompt_extra: null,
}

export async function getSofiaConfig(medico_id: string): Promise<SofiaConfig> {
  if (!medico_id) return { medico_id: '', ...DEFAULT }
  const { data } = await supabase
    .from('sofia_config')
    .select('*')
    .eq('medico_id', medico_id)
    .maybeSingle()
  if (data) return data as SofiaConfig
  // se não existe, cria
  const { data: criada } = await supabase
    .from('sofia_config')
    .insert({ medico_id, ...DEFAULT })
    .select()
    .single()
  return (criada as SofiaConfig) || { medico_id, ...DEFAULT }
}

export async function updateSofiaConfig(medico_id: string, patch: Partial<SofiaConfig>) {
  const { data, error } = await supabase
    .from('sofia_config')
    .update({ ...patch, atualizado_em: new Date().toISOString() })
    .eq('medico_id', medico_id)
    .select()
    .single()
  return { data, error }
}
