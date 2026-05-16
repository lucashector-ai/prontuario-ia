import { supabase } from '@/lib/supabase'

export type PapelMensagem = 'user' | 'assistant'

export type Conversa = {
  id: string
  medico_id: string
  clinica_id: string | null
  titulo: string
  criado_em: string
  atualizado_em: string
}

export type Mensagem = {
  id: string
  conversa_id: string
  papel: PapelMensagem
  conteudo: string
  criado_em: string
}

/**
 * Lista conversas de um médico, mais recentes primeiro.
 */
export async function listarConversas(medicoId: string): Promise<Conversa[]> {
  try {
    const { data } = await supabase
      .from('assistente_conversas')
      .select('*')
      .eq('medico_id', medicoId)
      .order('atualizado_em', { ascending: false })
      .limit(100)
    return (data || []) as Conversa[]
  } catch {
    return []
  }
}

/**
 * Cria uma nova conversa vazia.
 */
export async function criarConversa(medicoId: string, clinicaId?: string | null): Promise<Conversa | null> {
  try {
    const { data, error } = await supabase
      .from('assistente_conversas')
      .insert({
        medico_id: medicoId,
        clinica_id: clinicaId || null,
        titulo: 'Nova conversa',
      })
      .select()
      .single()
    if (error) return null
    return data as Conversa
  } catch {
    return null
  }
}

/**
 * Busca todas as mensagens de uma conversa, em ordem cronológica.
 */
export async function listarMensagens(conversaId: string): Promise<Mensagem[]> {
  try {
    const { data } = await supabase
      .from('assistente_mensagens')
      .select('*')
      .eq('conversa_id', conversaId)
      .order('criado_em', { ascending: true })
    return (data || []) as Mensagem[]
  } catch {
    return []
  }
}

/**
 * Salva uma mensagem na conversa e atualiza o timestamp da conversa.
 */
export async function salvarMensagem(params: {
  conversaId: string
  papel: PapelMensagem
  conteudo: string
}): Promise<Mensagem | null> {
  try {
    const { data, error } = await supabase
      .from('assistente_mensagens')
      .insert({
        conversa_id: params.conversaId,
        papel: params.papel,
        conteudo: params.conteudo,
      })
      .select()
      .single()

    if (error) return null

    // Atualiza atualizado_em da conversa (pra ordenar lista lateral)
    await supabase
      .from('assistente_conversas')
      .update({ atualizado_em: new Date().toISOString() })
      .eq('id', params.conversaId)

    return data as Mensagem
  } catch {
    return null
  }
}

/**
 * Atualiza o título da conversa.
 * Usado pra dar nome automático a partir da primeira pergunta.
 */
export async function atualizarTituloConversa(conversaId: string, titulo: string): Promise<void> {
  try {
    await supabase
      .from('assistente_conversas')
      .update({ titulo: titulo.slice(0, 80) })
      .eq('id', conversaId)
  } catch {
    // silencioso — título é cosmético
  }
}

/**
 * Deleta uma conversa (e suas mensagens via cascade).
 */
export async function deletarConversa(conversaId: string): Promise<{ erro: string | null }> {
  try {
    const { error } = await supabase
      .from('assistente_conversas')
      .delete()
      .eq('id', conversaId)
    if (error) return { erro: error.message }
    return { erro: null }
  } catch (e: any) {
    return { erro: e.message || 'Erro ao deletar' }
  }
}

/**
 * Gera um título curto a partir da primeira pergunta do usuário.
 * Heurística simples — sem chamar IA pra economizar.
 */
export function gerarTituloDaPergunta(pergunta: string): string {
  const limpo = pergunta.trim().replace(/\s+/g, ' ')
  if (limpo.length <= 60) return limpo
  return limpo.slice(0, 57) + '...'
}
