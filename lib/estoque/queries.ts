import { supabase } from '@/lib/supabase'
import type {
  Fornecedor,
  Lote,
  ProcedimentoRealizado,
  Produto,
  ProdutoUsado,
} from './types'

async function safeList<T>(promise: any): Promise<T[]> {
  try {
    const { data, error } = await promise
    if (error) {
      if (typeof console !== 'undefined') console.warn('[estoque queries]', error.message)
      return []
    }
    return (data as T[]) || []
  } catch (err: any) {
    if (typeof console !== 'undefined') console.warn('[estoque queries]', err?.message || err)
    return []
  }
}

async function safeOne<T>(promise: any): Promise<T | null> {
  try {
    const { data, error } = await promise
    if (error) return null
    return data
  } catch {
    return null
  }
}

// ── Produtos ───────────────────────────────────────────────────────────────

export async function listarProdutos(clinicaId: string): Promise<Produto[]> {
  return safeList<Produto>(
    supabase
      .from('estoque_produtos')
      .select('*')
      .eq('clinica_id', clinicaId)
      .eq('ativo', true)
      .order('nome'),
  )
}

export async function buscarProduto(id: string): Promise<Produto | null> {
  return safeOne<Produto>(supabase.from('estoque_produtos').select('*').eq('id', id).maybeSingle())
}

export async function salvarProduto(input: Partial<Produto> & { clinica_id: string; id?: string }): Promise<Produto | null> {
  const payload: any = { ...input, atualizado_em: new Date().toISOString() }
  if (input.id) {
    return safeOne<Produto>(
      supabase.from('estoque_produtos').update(payload).eq('id', input.id).select().single(),
    )
  }
  return safeOne<Produto>(supabase.from('estoque_produtos').insert(payload).select().single())
}

export async function inativarProduto(id: string): Promise<void> {
  await supabase.from('estoque_produtos').update({ ativo: false }).eq('id', id)
}

// ── Lotes ──────────────────────────────────────────────────────────────────

export async function listarLotesDoProduto(produtoId: string): Promise<Lote[]> {
  return safeList<Lote>(
    supabase
      .from('estoque_lotes')
      .select('*, fornecedor:fornecedor_id(id, nome)')
      .eq('produto_id', produtoId)
      .eq('ativo', true)
      .order('validade', { ascending: true, nullsFirst: false }),
  )
}

export async function listarLotesDaClinica(clinicaId: string): Promise<Lote[]> {
  return safeList<Lote>(
    supabase
      .from('estoque_lotes')
      .select('*, produto:produto_id!inner(id, nome, unidade, categoria, clinica_id), fornecedor:fornecedor_id(id, nome)')
      .eq('produto.clinica_id', clinicaId)
      .eq('ativo', true)
      .order('validade', { ascending: true, nullsFirst: false }),
  )
}

export async function salvarLote(input: Partial<Lote> & { produto_id: string; id?: string }): Promise<Lote | null> {
  const payload: any = { ...input }
  if (input.id) {
    return safeOne<Lote>(supabase.from('estoque_lotes').update(payload).eq('id', input.id).select().single())
  }
  // Quando cria lote novo, soma a quantidade no estoque do produto
  const novoLote = await safeOne<Lote>(supabase.from('estoque_lotes').insert(payload).select().single())
  if (novoLote && input.quantidade_inicial) {
    const { data: prod } = await supabase
      .from('estoque_produtos')
      .select('estoque_atual')
      .eq('id', input.produto_id)
      .maybeSingle()
    if (prod) {
      const atual = Number(prod.estoque_atual) || 0
      await supabase
        .from('estoque_produtos')
        .update({ estoque_atual: atual + Number(input.quantidade_inicial) })
        .eq('id', input.produto_id)
    }
  }
  return novoLote
}

// ── Fornecedores ───────────────────────────────────────────────────────────

export async function listarFornecedores(clinicaId: string): Promise<Fornecedor[]> {
  return safeList<Fornecedor>(
    supabase
      .from('estoque_fornecedores')
      .select('*')
      .eq('clinica_id', clinicaId)
      .eq('ativo', true)
      .order('nome'),
  )
}

export async function salvarFornecedor(input: Partial<Fornecedor> & { clinica_id: string; id?: string }): Promise<Fornecedor | null> {
  const payload: any = { ...input }
  if (input.id) {
    return safeOne<Fornecedor>(supabase.from('estoque_fornecedores').update(payload).eq('id', input.id).select().single())
  }
  return safeOne<Fornecedor>(supabase.from('estoque_fornecedores').insert(payload).select().single())
}

export async function inativarFornecedor(id: string): Promise<void> {
  await supabase.from('estoque_fornecedores').update({ ativo: false }).eq('id', id)
}

// ── Procedimentos realizados (histórico) ───────────────────────────────────

export async function listarProcedimentosRealizados(clinicaId: string, limit = 200): Promise<ProcedimentoRealizado[]> {
  return safeList<ProcedimentoRealizado>(
    supabase
      .from('procedimentos_realizados')
      .select('*, paciente:paciente_id(nome), medico:medico_id(nome)')
      .eq('clinica_id', clinicaId)
      .order('realizado_em', { ascending: false })
      .limit(limit),
  )
}

/**
 * Registra um procedimento realizado E decrementa o estoque dos produtos
 * consumidos. Calcula custo_total + margem.
 *
 * Pode ser chamado por:
 * - UI direta (botão "registrar procedimento")
 * - hook ao finalizar consulta (Sprint 6: precisa de evento no app legado)
 */
export async function registrarProcedimentoRealizado(input: {
  clinicaId: string
  agendamentoId?: string | null
  pacienteId?: string | null
  medicoId?: string | null
  procedimentoId?: string | null
  nomeProcedimento?: string | null
  produtosUsados: ProdutoUsado[]
  precoCobrado: number
  observacoes?: string | null
}): Promise<{ ok: true; id: string; custoTotal: number; margem: number } | { ok: false; error: string }> {
  try {
    // 1) Resolve custos atuais de cada produto + decrementa estoque
    let custoTotal = 0
    for (const u of input.produtosUsados) {
      const { data: prod } = await supabase
        .from('estoque_produtos')
        .select('estoque_atual, custo_unitario')
        .eq('id', u.produto_id)
        .maybeSingle()
      if (!prod) continue

      const custoUnit = u.custo_unitario ?? (Number(prod.custo_unitario) || 0)
      custoTotal += custoUnit * u.quantidade

      // Decrementa o estoque
      const novoEstoque = Math.max(0, (Number(prod.estoque_atual) || 0) - u.quantidade)
      await supabase.from('estoque_produtos').update({ estoque_atual: novoEstoque }).eq('id', u.produto_id)

      // Decrementa do lote específico (se informado)
      if (u.lote_id) {
        const { data: lote } = await supabase
          .from('estoque_lotes')
          .select('quantidade_atual')
          .eq('id', u.lote_id)
          .maybeSingle()
        if (lote) {
          const restante = Math.max(0, (Number(lote.quantidade_atual) || 0) - u.quantidade)
          await supabase.from('estoque_lotes').update({ quantidade_atual: restante }).eq('id', u.lote_id)
        }
      }
    }

    const margemValor = input.precoCobrado - custoTotal
    const margemPct = input.precoCobrado > 0 ? (margemValor / input.precoCobrado) * 100 : null

    const { data, error } = await supabase
      .from('procedimentos_realizados')
      .insert({
        clinica_id: input.clinicaId,
        agendamento_id: input.agendamentoId || null,
        paciente_id: input.pacienteId || null,
        medico_id: input.medicoId || null,
        procedimento_id: input.procedimentoId || null,
        nome_procedimento: input.nomeProcedimento || null,
        produtos_usados: input.produtosUsados,
        custo_total: custoTotal,
        preco_cobrado: input.precoCobrado,
        margem_valor: margemValor,
        margem_percentual: margemPct,
        observacoes: input.observacoes || null,
      })
      .select('id')
      .single()

    if (error || !data) return { ok: false, error: error?.message || 'Erro ao salvar.' }
    return { ok: true, id: data.id, custoTotal, margem: margemValor }
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Falha inesperada.' }
  }
}
