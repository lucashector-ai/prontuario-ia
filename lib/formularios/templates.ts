import { supabase } from '@/lib/supabase'
import type { Template, Campo } from './types'

/**
 * Lista templates da clínica.
 * Por padrao só retorna os criados pela própria clínica (não os globais).
 */
export async function listarTemplatesClinica(clinicaId: string): Promise<Template[]> {
  try {
    const { data } = await supabase
      .from('formularios_templates')
      .select('*')
      .eq('clinica_id', clinicaId)
      .order('criado_em', { ascending: false })
    
    return (data || []) as Template[]
  } catch {
    return []
  }
}

/**
 * Lista os 5 templates globais (biblioteca).
 * Usado apenas quando o medico esta criando novo template e quer partir de um modelo.
 */
export async function listarTemplatesGlobais(): Promise<Template[]> {
  try {
    const { data } = await supabase
      .from('formularios_templates')
      .select('*')
      .eq('publico', true)
      .is('clinica_id', null)
      .order('nome')
    
    return (data || []) as Template[]
  } catch {
    return []
  }
}

/**
 * Busca um template especifico (da clinica ou global).
 */
export async function buscarTemplate(templateId: string): Promise<Template | null> {
  try {
    const { data } = await supabase
      .from('formularios_templates')
      .select('*')
      .eq('id', templateId)
      .single()
    
    return data as Template | null
  } catch {
    return null
  }
}

/**
 * Cria novo template na clinica.
 * Se baseadoEm for informado, copia os campos do template base.
 */
export async function criarTemplate(params: {
  clinicaId: string
  nome: string
  especialidade?: string | null
  descricao?: string | null
  campos: Campo[]
}): Promise<{ template: Template | null; erro: string | null }> {
  try {
    const { data, error } = await supabase
      .from('formularios_templates')
      .insert({
        clinica_id: params.clinicaId,
        nome: params.nome,
        especialidade: params.especialidade || null,
        descricao: params.descricao || null,
        campos: params.campos,
        publico: false,
      })
      .select()
      .single()
    
    if (error) return { template: null, erro: error.message }
    return { template: data as Template, erro: null }
  } catch (e: any) {
    return { template: null, erro: e.message || 'Erro ao criar template' }
  }
}

/**
 * Atualiza template existente. Só funciona em templates da própria clinica.
 */
export async function atualizarTemplate(templateId: string, updates: Partial<Template>): Promise<{ erro: string | null }> {
  try {
    // Garante que só dados editáveis sejam atualizados
    const patch: any = {}
    if (updates.nome !== undefined) patch.nome = updates.nome
    if (updates.especialidade !== undefined) patch.especialidade = updates.especialidade
    if (updates.descricao !== undefined) patch.descricao = updates.descricao
    if (updates.campos !== undefined) patch.campos = updates.campos

    const { error } = await supabase
      .from('formularios_templates')
      .update(patch)
      .eq('id', templateId)
      .is('publico', false)
    
    if (error) return { erro: error.message }
    return { erro: null }
  } catch (e: any) {
    return { erro: e.message || 'Erro ao atualizar' }
  }
}

/**
 * Deleta template (somente se for da própria clinica, não global).
 */
export async function deletarTemplate(templateId: string): Promise<{ erro: string | null }> {
  try {
    const { error } = await supabase
      .from('formularios_templates')
      .delete()
      .eq('id', templateId)
      .is('publico', false)
    
    if (error) return { erro: error.message }
    return { erro: null }
  } catch (e: any) {
    return { erro: e.message || 'Erro ao deletar' }
  }
}

/**
 * Helper pra gerar ID unico de campo dentro do template.
 * Usa nome do label normalizado + timestamp curto.
 */
export function gerarIdCampo(label: string): string {
  const base = label
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 30)
  
  const suffix = Math.random().toString(36).slice(2, 6)
  return base ? `${base}_${suffix}` : `campo_${suffix}`
}

/**
 * Labels visíveis dos tipos de campo (pra UI).
 */
export const TIPOS_CAMPO_LABELS: Record<string, string> = {
  texto: 'Texto curto',
  textarea: 'Texto longo',
  numero: 'Número',
  select: 'Seleção única',
  multipla: 'Múltipla escolha',
  escala: 'Escala (0-10)',
  data: 'Data',
  sim_nao: 'Sim / Não',
}
