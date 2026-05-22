import { supabase } from '@/lib/supabase'
import { registrarEntrada } from './movimentacoes'
import { verificarEAtualizarComandaPaga } from './comandas'
import type { FormaPagamento, Recebimento, RecebimentoStatus, Resultado } from './types'

const agora = () => new Date().toISOString()

export async function listarFormasPagamento(): Promise<Resultado<FormaPagamento[]>> {
  const { data, error } = await supabase
    .from('formas_pagamento')
    .select('*')
    .eq('ativo', true)
    .order('ordem')
  return { data: (data as FormaPagamento[]) || [], error: error?.message || null }
}

// ─── Leitura ────────────────────────────────────────────────────────────────

export async function listarRecebimentos(
  clinicaId: string,
  filtros?: { status?: RecebimentoStatus[]; de?: string; ate?: string; pacienteId?: string },
): Promise<Resultado<any[]>> {
  let query = supabase
    .from('recebimentos')
    .select('*, pacientes:paciente_id(nome, telefone), formas_pagamento:forma_pagamento_id(nome, codigo), comandas:comanda_id(id, status, profissional_id)')
    .eq('clinica_id', clinicaId)
    .order('vencimento', { ascending: true })
    .limit(500)
  if (filtros?.status && filtros.status.length) query = query.in('status', filtros.status)
  if (filtros?.de) query = query.gte('vencimento', filtros.de)
  if (filtros?.ate) query = query.lte('vencimento', filtros.ate)
  if (filtros?.pacienteId) query = query.eq('paciente_id', filtros.pacienteId)
  const { data, error } = await query
  return { data: data || [], error: error?.message || null }
}

export async function obterRecebimento(id: string): Promise<Resultado<any>> {
  const { data, error } = await supabase
    .from('recebimentos')
    .select('*, pacientes:paciente_id(nome, cpf), formas_pagamento:forma_pagamento_id(nome, codigo), comandas:comanda_id(id, valor_final, observacoes)')
    .eq('id', id)
    .single()
  return { data, error: error?.message || null }
}

export async function criarRecebimento(input: {
  clinica_id: string
  valor: number
  comanda_id?: string | null
  paciente_id?: string | null
  forma_pagamento_id?: string | null
  vencimento?: string | null
  observacoes?: string | null
}): Promise<Resultado<Recebimento>> {
  const { data, error } = await supabase
    .from('recebimentos')
    .insert({
      clinica_id: input.clinica_id,
      valor: input.valor,
      comanda_id: input.comanda_id || null,
      paciente_id: input.paciente_id || null,
      forma_pagamento_id: input.forma_pagamento_id || null,
      vencimento: input.vencimento || null,
      observacoes: input.observacoes || null,
      status: 'pendente',
    })
    .select()
    .single()
  return { data: data as Recebimento | null, error: error?.message || null }
}

// ─── Baixa ──────────────────────────────────────────────────────────────────

export async function darBaixa(
  recebimentoId: string,
  baixa: { forma_pagamento_id: string; valor_pago: number; data?: string; observacoes?: string; usuario_id?: string | null },
): Promise<Resultado<Recebimento>> {
  const { data: receb, error: e1 } = await supabase
    .from('recebimentos').select('*').eq('id', recebimentoId).single()
  if (e1 || !receb) return { data: null, error: e1?.message || 'recebimento não encontrado' }
  if (receb.status === 'pago' || receb.status === 'cancelado') {
    return { data: null, error: 'recebimento não está aberto para baixa' }
  }

  const valorPago = Number(baixa.valor_pago)
  const status: RecebimentoStatus = valorPago >= Number(receb.valor) ? 'pago' : 'parcial'
  const dataPag = baixa.data ? `${baixa.data}T12:00:00` : agora()

  const { data: atualizado, error: e2 } = await supabase
    .from('recebimentos')
    .update({
      status,
      valor_pago: valorPago,
      forma_pagamento_id: baixa.forma_pagamento_id,
      pago_em: status === 'pago' ? dataPag : null,
      pago_por: baixa.usuario_id || null,
      observacoes: baixa.observacoes ?? receb.observacoes,
    })
    .eq('id', recebimentoId)
    .select()
    .single()
  if (e2) return { data: null, error: e2.message }

  // registra entrada no caixa
  await registrarEntrada({
    clinica_id: receb.clinica_id,
    recebimento_id: recebimentoId,
    forma_pagamento_id: baixa.forma_pagamento_id,
    unidade_id: receb.unidade_id,
    valor: valorPago,
    data: baixa.data,
    descricao: 'Baixa de recebimento',
    criado_por: baixa.usuario_id || null,
  })

  // se a comanda toda ficou paga, atualiza
  if (status === 'pago' && receb.comanda_id) {
    await verificarEAtualizarComandaPaga(receb.comanda_id)
  }

  return { data: atualizado as Recebimento, error: null }
}

// Recebimentos pendentes/parciais vencidos contam como atrasados.
export { statusEfetivoRecebimento as statusEfetivo } from './calculos'
