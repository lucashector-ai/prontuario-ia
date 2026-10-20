/**
 * Estoque de insumos (migration 0032). Saídas sempre pela função do banco c360_saida_estoque
 * (lote que vence antes primeiro, atômica); entradas criam lote. A baixa por procedimento é
 * automática quando o agendamento vira "realizado" (trigger no banco).
 */
import { supabaseServidor as db } from '@/lib/servidor'
import { ErroAtendimento } from '@/lib/atendimento/servidor'
import { alertasDoItem, sugestaoReposicao } from './calculos'

const hojeSP = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
const num = (v: any) => { const n = Number(String(v ?? '').replace(',', '.')); return isFinite(n) ? n : NaN }

async function itemDaClinica(chave: string, itemId: string) {
  const { data } = await db.from('estoque_itens').select('*').eq('id', itemId).eq('clinica_chave', chave).maybeSingle()
  if (!data) throw new ErroAtendimento('Item não encontrado.', 404)
  return data as any
}

/** Itens com saldo, próxima validade, alertas e consumo dos últimos 30 dias. */
export async function listarItens(chave: string) {
  const desde = new Date(Date.now() - 30 * 864e5).toISOString()
  const [{ data: itens }, { data: lotes }, { data: saidas }] = await Promise.all([
    db.from('estoque_itens').select('*').eq('clinica_chave', chave).order('nome'),
    db.from('estoque_lotes').select('id, item_id, lote, validade, saldo').eq('clinica_chave', chave).gt('saldo', 0).order('validade', { ascending: true, nullsFirst: false }),
    db.from('estoque_movimentos').select('item_id, quantidade').eq('clinica_chave', chave).lt('quantidade', 0).gte('criado_em', desde)
      .in('tipo', ['baixa_procedimento', 'saida_avulsa']),
  ])
  const hoje = hojeSP()
  return (itens || []).map((i: any) => {
    const ls = (lotes || []).filter((l: any) => l.item_id === i.id)
    const saldo = ls.reduce((s: number, l: any) => s + Number(l.saldo), 0)
    const proximaValidade = ls.find((l: any) => l.validade)?.validade || null
    const consumo30 = -(saidas || []).filter((m: any) => m.item_id === i.id).reduce((s: number, m: any) => s + Number(m.quantidade), 0)
    return { ...i, estoque_minimo: Number(i.estoque_minimo), saldo, proxima_validade: proximaValidade, consumo30, lotes: ls, alertas: alertasDoItem({ saldo, minimo: Number(i.estoque_minimo), proximaValidade }, hoje) }
  })
}

export async function salvarItem(chave: string, p: { id?: string; nome: string; unidade?: string; estoque_minimo?: number; controla_lote?: boolean; custo_unitario?: number | null; ativo?: boolean }) {
  const nome = String(p.nome || '').trim().slice(0, 120)
  if (!nome) throw new ErroAtendimento('Informe o nome do item.', 422)
  const campos = {
    nome, unidade: String(p.unidade || 'un').slice(0, 20), estoque_minimo: Math.max(0, num(p.estoque_minimo) || 0),
    controla_lote: p.controla_lote !== false, custo_unitario: isNaN(num(p.custo_unitario)) || p.custo_unitario === null || p.custo_unitario === undefined ? null : num(p.custo_unitario),
    ativo: p.ativo !== false,
  }
  if (p.id) { await itemDaClinica(chave, p.id); await db.from('estoque_itens').update(campos).eq('id', p.id); return { id: p.id } }
  const { data, error } = await db.from('estoque_itens').insert({ ...campos, clinica_chave: chave }).select('id').single()
  if (error) throw error
  return { id: (data as any).id }
}

/** Entrada como uma nota: várias linhas (item, quantidade, lote, validade) e um fornecedor. */
export async function registrarEntrada(chave: string, usuario: string | null, p: { fornecedor?: string | null; linhas: { item_id: string; quantidade: number; lote?: string | null; validade?: string | null }[] }) {
  const linhas = (p.linhas || []).filter(l => l.item_id && num(l.quantidade) > 0)
  if (!linhas.length) throw new ErroAtendimento('Inclua pelo menos um item com quantidade.', 422)
  for (const l of linhas) {
    await itemDaClinica(chave, l.item_id)
    const validade = l.validade && /^\d{4}-\d{2}-\d{2}$/.test(l.validade) ? l.validade : null
    const { data: lote, error } = await db.from('estoque_lotes').insert({ clinica_chave: chave, item_id: l.item_id, lote: l.lote ? String(l.lote).slice(0, 60) : null, validade, saldo: num(l.quantidade) }).select('id').single()
    if (error) throw error
    await db.from('estoque_movimentos').insert({ clinica_chave: chave, item_id: l.item_id, lote_id: (lote as any).id, tipo: 'entrada', quantidade: num(l.quantidade), fornecedor: p.fornecedor ? String(p.fornecedor).slice(0, 120) : null, usuario_id: usuario })
  }
  return { ok: true, linhas: linhas.length }
}

/** Saída manual (uso avulso, perda, vencido) pelo lote que vence antes. */
export async function registrarSaida(chave: string, usuario: string | null, p: { item_id: string; quantidade: number; tipo: 'saida_avulsa' | 'perda' | 'vencido'; motivo?: string | null }) {
  if (!['saida_avulsa', 'perda', 'vencido'].includes(p.tipo)) throw new ErroAtendimento('Tipo de saída inválido.', 422)
  const qtd = num(p.quantidade)
  if (!(qtd > 0)) throw new ErroAtendimento('Informe a quantidade.', 422)
  await itemDaClinica(chave, p.item_id)
  const { data, error } = await db.rpc('c360_saida_estoque', { p_chave: chave, p_item: p.item_id, p_qtd: qtd, p_tipo: p.tipo, p_motivo: p.motivo ? String(p.motivo).slice(0, 200) : null, p_usuario: usuario })
  if (error) throw error
  return { ok: true, faltou: Number(data) || 0 }
}

/** Inventário: para cada item contado, gera o ajuste (entrada num lote "inventário" ou saída FEFO). */
export async function aplicarInventario(chave: string, usuario: string | null, contagem: { item_id: string; contado: number }[]) {
  const itens = await listarItens(chave)
  let ajustes = 0
  for (const c of contagem || []) {
    const it = itens.find(i => i.id === c.item_id)
    const contado = num(c.contado)
    if (!it || isNaN(contado) || contado < 0) continue
    const dif = Math.round((contado - it.saldo) * 100) / 100
    if (dif === 0) continue
    if (dif > 0) {
      const { data: lote } = await db.from('estoque_lotes').insert({ clinica_chave: chave, item_id: it.id, lote: 'inventário', saldo: dif }).select('id').single()
      await db.from('estoque_movimentos').insert({ clinica_chave: chave, item_id: it.id, lote_id: (lote as any)?.id, tipo: 'ajuste', quantidade: dif, motivo: 'Inventário', usuario_id: usuario })
    } else {
      await db.rpc('c360_saida_estoque', { p_chave: chave, p_item: it.id, p_qtd: -dif, p_tipo: 'ajuste', p_motivo: 'Inventário', p_usuario: usuario })
    }
    ajustes++
  }
  return { ok: true, ajustes }
}

export async function listarMovimentos(chave: string, itemId?: string | null) {
  let q = db.from('estoque_movimentos').select('id, item_id, tipo, quantidade, falta, fornecedor, motivo, criado_em, agendamento_id, item:estoque_itens(nome, unidade), lote:estoque_lotes(lote, validade), paciente:pacientes(nome)')
    .eq('clinica_chave', chave).order('criado_em', { ascending: false }).limit(200)
  if (itemId) q = q.eq('item_id', itemId)
  const { data } = await q
  return data || []
}

/** Reposição sugerida com o "porquê" (consumo de 30 dias, agenda de 14 dias, validade e mínimo). */
export async function reposicao(chave: string, cobertura = 30) {
  const itens = (await listarItens(chave)).filter(i => i.ativo)
  const ate = new Date(Date.now() + 14 * 864e5).toISOString()
  const { data: procs } = await db.from('procedimentos').select('id').eq('clinica_id', chave)
  const procIds = (procs || []).map((p: any) => p.id)
  const [{ data: ags }, { data: insumos }] = await Promise.all([
    procIds.length ? db.from('agendamentos').select('procedimento_id').in('procedimento_id', procIds).in('status', ['agendado', 'confirmado'])
      .gte('data_hora', new Date().toISOString()).lt('data_hora', ate) : Promise.resolve({ data: [] as any[] }),
    db.from('procedimento_insumos').select('procedimento_id, item_id, quantidade').eq('clinica_chave', chave),
  ])
  const previsto: Record<string, number> = {}
  for (const a of (ags || []) as any[]) for (const i of (insumos || []).filter((x: any) => x.procedimento_id === a.procedimento_id) as any[]) previsto[i.item_id] = (previsto[i.item_id] || 0) + Number(i.quantidade)
  const limite = new Date(Date.now() + cobertura * 864e5).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
  return itens.map(i => {
    const vencendo = (i.lotes || []).filter((l: any) => l.validade && l.validade <= limite).reduce((s: number, l: any) => s + Number(l.saldo), 0)
    const r = sugestaoReposicao({ saldo: i.saldo, minimo: i.estoque_minimo, consumo30: i.consumo30, previsto14: previsto[i.id] || 0, vencendo, cobertura })
    return { item_id: i.id, nome: i.nome, unidade: i.unidade, saldo: i.saldo, ...r }
  }).filter(r => r.sugerido > 0).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}

/** O que cada procedimento consome ("Consome" na ficha do procedimento). */
export async function insumosDoProcedimento(chave: string, procedimentoId: string) {
  const { data } = await db.from('procedimento_insumos').select('item_id, quantidade, item:estoque_itens(nome, unidade)').eq('clinica_chave', chave).eq('procedimento_id', procedimentoId)
  return data || []
}

export async function salvarInsumos(chave: string, procedimentoId: string, insumos: { item_id: string; quantidade: number }[]) {
  const { data: proc } = await db.from('procedimentos').select('id').eq('id', procedimentoId).eq('clinica_id', chave).maybeSingle()
  if (!proc) throw new ErroAtendimento('Procedimento não encontrado.', 404)
  const linhas = (insumos || []).filter(i => i.item_id && num(i.quantidade) > 0)
  for (const i of linhas) await itemDaClinica(chave, i.item_id)
  await db.from('procedimento_insumos').delete().eq('procedimento_id', procedimentoId)
  if (linhas.length) {
    const { error } = await db.from('procedimento_insumos').insert(linhas.map(i => ({ clinica_chave: chave, procedimento_id: procedimentoId, item_id: i.item_id, quantidade: num(i.quantidade) })))
    if (error) throw error
  }
  return { ok: true }
}
