import { supabase } from '@/lib/supabase'
import { registrarSaida } from './movimentacoes'
import type { Despesa, DespesaStatus, Resultado } from './types'

const agora = () => new Date().toISOString()

export async function listarDespesas(
  clinicaId: string,
  filtros?: { status?: DespesaStatus[]; categoria?: string; de?: string; ate?: string },
): Promise<Resultado<Despesa[]>> {
  let query = supabase
    .from('despesas')
    .select('*, formas_pagamento:forma_pagamento_id(nome)')
    .eq('clinica_id', clinicaId)
    .order('vencimento', { ascending: true })
    .limit(500)
  if (filtros?.status?.length) query = query.in('status', filtros.status)
  if (filtros?.categoria) query = query.eq('categoria', filtros.categoria)
  if (filtros?.de) query = query.gte('vencimento', filtros.de)
  if (filtros?.ate) query = query.lte('vencimento', filtros.ate)
  const { data, error } = await query
  return { data: (data as Despesa[]) || [], error: error?.message || null }
}

export async function criarDespesa(input: {
  clinica_id: string
  descricao: string
  valor: number
  categoria?: string | null
  fornecedor?: string | null
  vencimento?: string | null
  recorrente?: boolean
  recorrencia_periodicidade?: 'semanal' | 'mensal' | 'anual' | null
  observacoes?: string | null
}): Promise<Resultado<Despesa>> {
  const { data, error } = await supabase
    .from('despesas')
    .insert({
      clinica_id: input.clinica_id,
      descricao: input.descricao,
      valor: input.valor,
      categoria: input.categoria || null,
      fornecedor: input.fornecedor || null,
      vencimento: input.vencimento || null,
      recorrente: !!input.recorrente,
      recorrencia_periodicidade: input.recorrente ? (input.recorrencia_periodicidade || 'mensal') : null,
      observacoes: input.observacoes || null,
      status: 'pendente',
    })
    .select()
    .single()
  return { data: data as Despesa | null, error: error?.message || null }
}

export async function atualizarDespesa(
  id: string,
  campos: Partial<Pick<Despesa, 'descricao' | 'valor' | 'categoria' | 'fornecedor' | 'vencimento' | 'observacoes' | 'status'>>,
): Promise<Resultado<Despesa>> {
  const { data, error } = await supabase
    .from('despesas').update(campos).eq('id', id).select().single()
  return { data: data as Despesa | null, error: error?.message || null }
}

export async function cancelarDespesa(id: string): Promise<Resultado<boolean>> {
  const { error } = await supabase
    .from('despesas').update({ status: 'cancelado' }).eq('id', id)
  return { data: error ? null : true, error: error?.message || null }
}

export async function pagarDespesa(
  id: string,
  pagamento: { forma_pagamento_id?: string | null; data?: string; observacoes?: string; usuario_id?: string | null },
): Promise<Resultado<Despesa>> {
  const { data: desp, error: e1 } = await supabase
    .from('despesas').select('*').eq('id', id).single()
  if (e1 || !desp) return { data: null, error: e1?.message || 'despesa não encontrada' }
  if (desp.status === 'pago') return { data: null, error: 'despesa já paga' }

  const dataPag = pagamento.data ? `${pagamento.data}T12:00:00` : agora()
  const { data: atualizada, error: e2 } = await supabase
    .from('despesas')
    .update({
      status: 'pago',
      pago_em: dataPag,
      forma_pagamento_id: pagamento.forma_pagamento_id || null,
      observacoes: pagamento.observacoes ?? desp.observacoes,
    })
    .eq('id', id)
    .select()
    .single()
  if (e2) return { data: null, error: e2.message }

  await registrarSaida({
    clinica_id: desp.clinica_id,
    despesa_id: id,
    forma_pagamento_id: pagamento.forma_pagamento_id || null,
    valor: Number(desp.valor || 0),
    data: pagamento.data,
    descricao: `Despesa — ${desp.descricao}`,
    origem: 'despesa',
    criado_por: pagamento.usuario_id || null,
  })

  return { data: atualizada as Despesa, error: null }
}

// Despesa pendente vencida conta como atrasada (status visual).
export function statusEfetivoDespesa(d: { status: string; vencimento: string | null }): string {
  if (d.status === 'pendente' && d.vencimento) {
    if (d.vencimento < new Date().toISOString().slice(0, 10)) return 'atrasado'
  }
  return d.status
}
