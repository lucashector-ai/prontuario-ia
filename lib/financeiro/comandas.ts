import { supabase } from '@/lib/supabase'
import { registrarEntrada } from './movimentacoes'
import { gerarRepasses } from './repasses'
import { distribuirParcelas, vencimentoParcela } from './calculos'
import type {
  Comanda, ComandaItem, ComandaStatus, ItemTipo, Resultado,
} from './types'

const agora = () => new Date().toISOString()

// Formas que liquidam na hora quando o pagamento é à vista
const FORMAS_LIQUIDAS = ['dinheiro', 'pix', 'cartao_debito']

// ─── Leitura ────────────────────────────────────────────────────────────────

export async function listarComandas(
  clinicaId: string,
  filtros?: { status?: ComandaStatus; pacienteId?: string },
): Promise<Resultado<Comanda[]>> {
  let query = supabase
    .from('comandas')
    .select('*, pacientes:paciente_id(nome), medicos:profissional_id(nome)')
    .eq('clinica_id', clinicaId)
    .order('created_at', { ascending: false })
    .limit(200)
  if (filtros?.status) query = query.eq('status', filtros.status)
  if (filtros?.pacienteId) query = query.eq('paciente_id', filtros.pacienteId)
  const { data, error } = await query
  return { data: (data as Comanda[]) || [], error: error?.message || null }
}

export async function obterComanda(
  comandaId: string,
): Promise<Resultado<{ comanda: Comanda; itens: ComandaItem[] }>> {
  const { data: comanda, error: e1 } = await supabase
    .from('comandas')
    .select('*, pacientes:paciente_id(nome, cpf, telefone), medicos:profissional_id(nome)')
    .eq('id', comandaId)
    .single()
  if (e1 || !comanda) return { data: null, error: e1?.message || 'comanda não encontrada' }

  const { data: itens, error: e2 } = await supabase
    .from('comanda_itens')
    .select('*')
    .eq('comanda_id', comandaId)
    .order('created_at')
  if (e2) return { data: null, error: e2.message }

  return { data: { comanda: comanda as Comanda, itens: (itens as ComandaItem[]) || [] }, error: null }
}

export async function obterComandaPorAgendamento(
  agendamentoId: string,
): Promise<Resultado<Comanda | null>> {
  const { data, error } = await supabase
    .from('comandas')
    .select('*')
    .eq('agendamento_id', agendamentoId)
    .maybeSingle()
  return { data: (data as Comanda) || null, error: error?.message || null }
}

// ─── Criação ────────────────────────────────────────────────────────────────

export async function criarComandaAvulsa(input: {
  clinica_id: string
  paciente_id: string
  profissional_id?: string | null
  unidade_id?: string | null
  observacoes?: string | null
}): Promise<Resultado<Comanda>> {
  const { data, error } = await supabase
    .from('comandas')
    .insert({
      clinica_id: input.clinica_id,
      paciente_id: input.paciente_id,
      profissional_id: input.profissional_id || null,
      unidade_id: input.unidade_id || null,
      observacoes: input.observacoes || null,
      origem: 'avulsa',
      status: 'aberta',
      aberto_em: agora(),
    })
    .select()
    .single()
  return { data: data as Comanda | null, error: error?.message || null }
}

// ─── Itens ──────────────────────────────────────────────────────────────────

async function recalcularTotal(comandaId: string): Promise<void> {
  const { data: itens } = await supabase
    .from('comanda_itens')
    .select('valor_total')
    .eq('comanda_id', comandaId)
  const total = (itens || []).reduce((s, i: any) => s + Number(i.valor_total || 0), 0)
  await supabase.from('comandas').update({ valor_total: total }).eq('id', comandaId)
}

export async function adicionarItem(
  comandaId: string,
  item: {
    tipo: ItemTipo
    descricao: string
    quantidade?: number
    valor_unitario: number
    profissional_id?: string | null
    observacoes?: string | null
  },
): Promise<Resultado<ComandaItem>> {
  const { data, error } = await supabase
    .from('comanda_itens')
    .insert({
      comanda_id: comandaId,
      tipo: item.tipo,
      descricao: item.descricao,
      quantidade: item.quantidade || 1,
      valor_unitario: item.valor_unitario,
      profissional_id: item.profissional_id || null,
      observacoes: item.observacoes || null,
    })
    .select()
    .single()
  if (error) return { data: null, error: error.message }

  await recalcularTotal(comandaId)
  // primeiro item move a comanda de rascunho para aberta
  const { data: c } = await supabase.from('comandas').select('status').eq('id', comandaId).single()
  if (c?.status === 'rascunho') {
    await supabase.from('comandas').update({ status: 'aberta', aberto_em: agora() }).eq('id', comandaId)
  }
  return { data: data as ComandaItem, error: null }
}

export async function removerItem(
  comandaId: string,
  itemId: string,
): Promise<Resultado<boolean>> {
  const { error } = await supabase
    .from('comanda_itens')
    .delete()
    .eq('id', itemId)
    .eq('comanda_id', comandaId)
  if (error) return { data: null, error: error.message }
  await recalcularTotal(comandaId)
  return { data: true, error: null }
}

// ─── Ajustes ────────────────────────────────────────────────────────────────

export async function atualizarDescontoAcrescimo(
  comandaId: string,
  valores: { desconto?: number; acrescimo?: number },
): Promise<Resultado<Comanda>> {
  const update: any = {}
  if (valores.desconto !== undefined) update.desconto = valores.desconto
  if (valores.acrescimo !== undefined) update.acrescimo = valores.acrescimo
  const { data, error } = await supabase
    .from('comandas').update(update).eq('id', comandaId).select().single()
  return { data: data as Comanda | null, error: error?.message || null }
}

export async function atualizarComanda(
  comandaId: string,
  campos: { observacoes?: string },
): Promise<Resultado<Comanda>> {
  const { data, error } = await supabase
    .from('comandas').update(campos).eq('id', comandaId).select().single()
  return { data: data as Comanda | null, error: error?.message || null }
}

export async function cancelarComanda(comandaId: string): Promise<Resultado<boolean>> {
  const { error } = await supabase
    .from('comandas').update({ status: 'cancelada' }).eq('id', comandaId)
  return { data: error ? null : true, error: error?.message || null }
}

// ─── Fechamento ─────────────────────────────────────────────────────────────

export async function fecharComanda(
  comandaId: string,
  pagamento: { forma_pagamento_id: string; parcelas: number; observacoes?: string; usuario_id?: string | null },
): Promise<Resultado<Comanda>> {
  const { data: comanda, error: e1 } = await supabase
    .from('comandas').select('*').eq('id', comandaId).single()
  if (e1 || !comanda) return { data: null, error: e1?.message || 'comanda não encontrada' }
  if (comanda.status === 'fechada' || comanda.status === 'paga') {
    return { data: null, error: 'comanda já fechada' }
  }

  const { data: forma } = await supabase
    .from('formas_pagamento').select('*').eq('id', pagamento.forma_pagamento_id).single()
  if (!forma) return { data: null, error: 'forma de pagamento inválida' }

  const total = Number(comanda.valor_final || 0)
  const n = Math.max(1, pagamento.parcelas || 1)
  const valores = distribuirParcelas(total, n)

  // à vista em forma líquida → recebimento já entra como pago
  const liquidaAgora = n === 1 && FORMAS_LIQUIDAS.includes(forma.codigo)

  // 1. fecha a comanda
  const { data: cFechada, error: e2 } = await supabase
    .from('comandas')
    .update({
      status: 'fechada',
      fechado_em: agora(),
      fechado_por: pagamento.usuario_id || null,
      observacoes: pagamento.observacoes ?? comanda.observacoes,
    })
    .eq('id', comandaId)
    .select()
    .single()
  if (e2) return { data: null, error: e2.message }

  // 2. cria os recebimentos
  const linhas = valores.map((valor, i) => ({
    clinica_id: comanda.clinica_id,
    comanda_id: comandaId,
    unidade_id: comanda.unidade_id,
    paciente_id: comanda.paciente_id,
    forma_pagamento_id: pagamento.forma_pagamento_id,
    status: liquidaAgora ? 'pago' : 'pendente',
    valor,
    valor_pago: liquidaAgora ? valor : 0,
    parcela_numero: i + 1,
    parcela_total: n,
    vencimento: vencimentoParcela(i),
    pago_em: liquidaAgora ? agora() : null,
    pago_por: liquidaAgora ? (pagamento.usuario_id || null) : null,
  }))
  const { data: recebimentos, error: e3 } = await supabase
    .from('recebimentos').insert(linhas).select()
  if (e3) return { data: null, error: e3.message }

  // 3. à vista líquido → registra entrada no caixa e marca comanda como paga
  if (liquidaAgora && recebimentos?.[0]) {
    await registrarEntrada({
      clinica_id: comanda.clinica_id,
      recebimento_id: recebimentos[0].id,
      forma_pagamento_id: pagamento.forma_pagamento_id,
      unidade_id: comanda.unidade_id,
      valor: total,
      descricao: 'Recebimento de comanda',
      criado_por: pagamento.usuario_id || null,
    })
    await marcarComoPaga(comandaId)
    return { data: { ...(cFechada as Comanda), status: 'paga' }, error: null }
  }

  return { data: cFechada as Comanda, error: null }
}

export async function marcarComoPaga(comandaId: string): Promise<Resultado<boolean>> {
  const { error } = await supabase
    .from('comandas').update({ status: 'paga' }).eq('id', comandaId)
  if (error) return { data: null, error: error.message }
  // gera os repasses médicos dos itens da comanda
  await gerarRepasses(comandaId)
  return { data: true, error: null }
}

// Chamada após dar baixa num recebimento: se todos os recebíveis da comanda
// estiverem pagos, a comanda vira 'paga'.
export async function verificarEAtualizarComandaPaga(
  comandaId: string,
): Promise<Resultado<boolean>> {
  const { data: recs, error } = await supabase
    .from('recebimentos').select('status').eq('comanda_id', comandaId)
  if (error) return { data: null, error: error.message }
  const ativos = (recs || []).filter((r: any) => r.status !== 'cancelado')
  if (ativos.length === 0) return { data: false, error: null }
  const todosPagos = ativos.every((r: any) => r.status === 'pago')
  if (todosPagos) {
    await marcarComoPaga(comandaId)
    return { data: true, error: null }
  }
  return { data: false, error: null }
}
