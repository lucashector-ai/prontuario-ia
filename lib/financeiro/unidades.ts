import { supabase } from '@/lib/supabase'
import type { Resultado, Unidade } from './types'

export async function listarUnidades(
  clinicaId: string,
  apenasAtivas = false,
): Promise<Resultado<Unidade[]>> {
  let query = supabase
    .from('unidades')
    .select('*')
    .eq('clinica_id', clinicaId)
    .order('nome')
  if (apenasAtivas) query = query.eq('ativo', true)
  const { data, error } = await query
  return { data: (data as Unidade[]) || [], error: error?.message || null }
}

export async function criarUnidade(input: {
  clinica_id: string
  nome: string
  endereco?: string | null
}): Promise<Resultado<Unidade>> {
  const { data, error } = await supabase
    .from('unidades')
    .insert({
      clinica_id: input.clinica_id,
      nome: input.nome,
      endereco: input.endereco || null,
    })
    .select()
    .single()
  return { data: data as Unidade | null, error: error?.message || null }
}

export async function atualizarUnidade(
  id: string,
  campos: { nome?: string; endereco?: string | null; ativo?: boolean },
): Promise<Resultado<Unidade>> {
  const { data, error } = await supabase
    .from('unidades').update(campos).eq('id', id).select().single()
  return { data: data as Unidade | null, error: error?.message || null }
}
