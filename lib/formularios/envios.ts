import { supabase } from '@/lib/supabase'
import type { Envio, Resposta } from './types'

/**
 * Gera token URL-safe único (sem caracteres especiais).
 * Formato: 16 chars alfanuméricos. Probabilidade de colisão ~zero.
 */
export function gerarToken(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let token = ''
  for (let i = 0; i < 16; i++) {
    token += chars[Math.floor(Math.random() * chars.length)]
  }
  return token
}

/**
 * Cria um novo envio de formulário pra um paciente.
 * Retorna o token único pro link público.
 */
export async function criarEnvio(params: {
  templateId: string
  clinicaId: string
  medicoId?: string
  agendamentoId?: string
  pacienteId?: string
  nomePaciente: string
  telefone?: string
  email?: string
  origem?: 'manual' | 'agenda_publica' | 'agendamento_interno'
  diasValidade?: number
}): Promise<{ envio: Envio | null; erro: string | null }> {
  try {
    const token = gerarToken()
    const diasValidade = params.diasValidade ?? 30
    const expiraEm = new Date(Date.now() + diasValidade * 24 * 60 * 60 * 1000).toISOString()

    const { data, error } = await supabase
      .from('formularios_envios')
      .insert({
        template_id: params.templateId,
        clinica_id: params.clinicaId,
        medico_id: params.medicoId || null,
        agendamento_id: params.agendamentoId || null,
        paciente_id: params.pacienteId || null,
        nome_paciente: params.nomePaciente,
        telefone: params.telefone || null,
        email: params.email || null,
        token,
        expira_em: expiraEm,
        origem: params.origem || 'manual',
        status: 'pendente',
      })
      .select()
      .single()

    if (error) return { envio: null, erro: error.message }
    return { envio: data as Envio, erro: null }
  } catch (e: any) {
    return { envio: null, erro: e.message || 'Erro ao criar envio' }
  }
}

/**
 * Busca envio pelo token. Valida status e expiração.
 * Usado pela página pública /formulario/[clinica]/[token].
 */
export async function buscarEnvioPorToken(token: string, clinicaSlug?: string): Promise<{
  envio: Envio | null
  template: any
  clinica: any
  medico: any
  erro: string | null
}> {
  try {
    const { data: envio, error } = await supabase
      .from('formularios_envios')
      .select(`
        *,
        formularios_templates (*),
        clinicas (id, nome, slug_publico, logo_url),
        medicos (id, nome, especialidade)
      `)
      .eq('token', token)
      .single()

    if (error || !envio) {
      return { envio: null, template: null, clinica: null, medico: null, erro: 'Link inválido ou expirado' }
    }

    // Verifica slug da clínica se informado
    if (clinicaSlug && envio.clinicas?.slug_publico !== clinicaSlug) {
      return { envio: null, template: null, clinica: null, medico: null, erro: 'Link inválido' }
    }

    // Já preenchido
    if (envio.status === 'preenchido') {
      return { 
        envio: envio as Envio, 
        template: envio.formularios_templates, 
        clinica: envio.clinicas, 
        medico: envio.medicos, 
        erro: 'Formulário já preenchido' 
      }
    }

    // Cancelado
    if (envio.status === 'cancelado') {
      return { envio: null, template: null, clinica: null, medico: null, erro: 'Formulário cancelado' }
    }

    // Expirado
    if (new Date(envio.expira_em) < new Date()) {
      // Marca como expirado se ainda não estiver
      if (envio.status !== 'expirado') {
        await supabase
          .from('formularios_envios')
          .update({ status: 'expirado' })
          .eq('id', envio.id)
      }
      return { envio: null, template: null, clinica: null, medico: null, erro: 'Link expirado' }
    }

    return {
      envio: envio as Envio,
      template: envio.formularios_templates,
      clinica: envio.clinicas,
      medico: envio.medicos,
      erro: null,
    }
  } catch (e: any) {
    return { envio: null, template: null, clinica: null, medico: null, erro: e.message || 'Erro' }
  }
}

/**
 * Marca envio como preenchido e vincula resposta.
 */
export async function marcarComoPreenchido(envioId: string, respostaId: string) {
  return supabase
    .from('formularios_envios')
    .update({
      status: 'preenchido',
      preenchido_em: new Date().toISOString(),
      resposta_id: respostaId,
    })
    .eq('id', envioId)
}

/**
 * Cancela um envio (médico desistiu).
 */
export async function cancelarEnvio(envioId: string) {
  return supabase
    .from('formularios_envios')
    .update({ status: 'cancelado' })
    .eq('id', envioId)
}

/**
 * Lista envios de uma clínica (com filtros).
 */
export async function listarEnviosClinica(clinicaId: string, filtros?: {
  status?: string
  pacienteId?: string
  limit?: number
}): Promise<Envio[]> {
  try {
    let query = supabase
      .from('formularios_envios')
      .select('*, formularios_templates(nome)')
      .eq('clinica_id', clinicaId)
      .order('enviado_em', { ascending: false })
      .limit(filtros?.limit || 100)

    if (filtros?.status) query = query.eq('status', filtros.status)
    if (filtros?.pacienteId) query = query.eq('paciente_id', filtros.pacienteId)

    const { data } = await query
    return (data || []) as Envio[]
  } catch {
    return []
  }
}

/**
 * Constrói URL pública do formulário.
 */
export function urlFormularioPublico(clinicaSlug: string, token: string): string {
  return `https://clinical360.vercel.app/formulario/${clinicaSlug}/${token}`
}
