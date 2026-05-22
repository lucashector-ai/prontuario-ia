import { supabase } from '@/lib/supabase'
import type { MovimentacaoCaixa, Resultado } from './types'

const hojeISO = () => new Date().toISOString().slice(0, 10)

interface EntradaInput {
  clinica_id: string
  valor: number
  recebimento_id?: string | null
  forma_pagamento_id?: string | null
  unidade_id?: string | null
  data?: string
  descricao?: string
  origem?: 'recebimento' | 'ajuste_manual' | 'estorno'
  criado_por?: string | null
}

interface SaidaInput {
  clinica_id: string
  valor: number
  despesa_id?: string | null
  forma_pagamento_id?: string | null
  unidade_id?: string | null
  data?: string
  descricao?: string
  origem?: 'despesa' | 'ajuste_manual' | 'estorno' | 'repasse'
  criado_por?: string | null
}

export async function registrarEntrada(input: EntradaInput): Promise<Resultado<MovimentacaoCaixa>> {
  const { data, error } = await supabase
    .from('movimentacoes_caixa')
    .insert({
      clinica_id: input.clinica_id,
      tipo: 'entrada',
      origem: input.origem || 'recebimento',
      recebimento_id: input.recebimento_id || null,
      forma_pagamento_id: input.forma_pagamento_id || null,
      unidade_id: input.unidade_id || null,
      valor: input.valor,
      data_movimentacao: input.data || hojeISO(),
      descricao: input.descricao || null,
      criado_por: input.criado_por || null,
    })
    .select()
    .single()
  return { data: data as MovimentacaoCaixa | null, error: error?.message || null }
}

export async function registrarSaida(input: SaidaInput): Promise<Resultado<MovimentacaoCaixa>> {
  const { data, error } = await supabase
    .from('movimentacoes_caixa')
    .insert({
      clinica_id: input.clinica_id,
      tipo: 'saida',
      origem: input.origem || 'despesa',
      despesa_id: input.despesa_id || null,
      forma_pagamento_id: input.forma_pagamento_id || null,
      unidade_id: input.unidade_id || null,
      valor: input.valor,
      data_movimentacao: input.data || hojeISO(),
      descricao: input.descricao || null,
      criado_por: input.criado_por || null,
    })
    .select()
    .single()
  return { data: data as MovimentacaoCaixa | null, error: error?.message || null }
}

export async function listarMovimentacoes(
  clinicaId: string,
  filtros?: { de?: string; ate?: string },
): Promise<Resultado<MovimentacaoCaixa[]>> {
  let query = supabase
    .from('movimentacoes_caixa')
    .select('*')
    .eq('clinica_id', clinicaId)
    .order('data_movimentacao', { ascending: false })
  if (filtros?.de) query = query.gte('data_movimentacao', filtros.de)
  if (filtros?.ate) query = query.lte('data_movimentacao', filtros.ate)
  const { data, error } = await query
  return { data: (data as MovimentacaoCaixa[]) || [], error: error?.message || null }
}
