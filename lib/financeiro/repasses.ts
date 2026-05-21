import { supabase } from '@/lib/supabase'
import { registrarSaida } from './movimentacoes'
import type { ItemTipo, Repasse, RepasseRegra, RepasseStatus, Resultado } from './types'

const agora = () => new Date().toISOString()
const competenciaAtual = () => {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
}

// ─── Regras de comissão ─────────────────────────────────────────────────────

export async function listarRegras(clinicaId: string): Promise<Resultado<any[]>> {
  const { data, error } = await supabase
    .from('repasse_regras')
    .select('*, medicos:profissional_id(nome)')
    .eq('clinica_id', clinicaId)
    .order('created_at', { ascending: false })
  return { data: data || [], error: error?.message || null }
}

export async function criarRegra(input: {
  clinica_id: string
  profissional_id: string
  tipo_item?: ItemTipo | null
  percentual: number
}): Promise<Resultado<RepasseRegra>> {
  const { data, error } = await supabase
    .from('repasse_regras')
    .insert({
      clinica_id: input.clinica_id,
      profissional_id: input.profissional_id,
      tipo_item: input.tipo_item || null,
      percentual: input.percentual,
    })
    .select()
    .single()
  return { data: data as RepasseRegra | null, error: error?.message || null }
}

export async function atualizarRegra(
  id: string,
  campos: { percentual?: number; ativo?: boolean },
): Promise<Resultado<RepasseRegra>> {
  const { data, error } = await supabase
    .from('repasse_regras').update(campos).eq('id', id).select().single()
  return { data: data as RepasseRegra | null, error: error?.message || null }
}

export async function removerRegra(id: string): Promise<Resultado<boolean>> {
  const { error } = await supabase.from('repasse_regras').delete().eq('id', id)
  return { data: error ? null : true, error: error?.message || null }
}

// ─── Geração de repasses ────────────────────────────────────────────────────

// Chamada quando a comanda vira 'paga'. Gera 1 repasse por item que tenha
// profissional + regra de comissão aplicável. Não duplica.
export async function gerarRepasses(comandaId: string): Promise<void> {
  const { data: existente } = await supabase
    .from('repasses').select('id').eq('comanda_id', comandaId).limit(1)
  if (existente && existente.length) return

  const { data: comanda } = await supabase
    .from('comandas').select('id, clinica_id, profissional_id').eq('id', comandaId).single()
  if (!comanda || !comanda.clinica_id) return

  const { data: itens } = await supabase
    .from('comanda_itens')
    .select('id, tipo, descricao, valor_total, profissional_id')
    .eq('comanda_id', comandaId)
  if (!itens || !itens.length) return

  const { data: regras } = await supabase
    .from('repasse_regras').select('*').eq('clinica_id', comanda.clinica_id).eq('ativo', true)
  if (!regras || !regras.length) return

  const competencia = competenciaAtual()
  const linhas: any[] = []
  for (const item of itens) {
    const prof = item.profissional_id || comanda.profissional_id
    if (!prof) continue
    const especifica = regras.find((r: any) => r.profissional_id === prof && r.tipo_item === item.tipo)
    const padrao = regras.find((r: any) => r.profissional_id === prof && !r.tipo_item)
    const regra = especifica || padrao
    if (!regra) continue
    const base = Number(item.valor_total || 0)
    const valor = Math.round(base * (Number(regra.percentual) / 100) * 100) / 100
    linhas.push({
      clinica_id: comanda.clinica_id,
      profissional_id: prof,
      comanda_id: comandaId,
      comanda_item_id: item.id,
      descricao: item.descricao,
      base_calculo: base,
      percentual: regra.percentual,
      valor,
      status: 'pendente',
      competencia,
    })
  }
  if (linhas.length) await supabase.from('repasses').insert(linhas)
}

// ─── Leitura e baixa de repasses ────────────────────────────────────────────

export async function listarRepasses(
  clinicaId: string,
  filtros?: { status?: RepasseStatus[]; profissionalId?: string; competencia?: string },
): Promise<Resultado<any[]>> {
  let query = supabase
    .from('repasses')
    .select('*, medicos:profissional_id(nome)')
    .eq('clinica_id', clinicaId)
    .order('created_at', { ascending: false })
    .limit(800)
  if (filtros?.status?.length) query = query.in('status', filtros.status)
  if (filtros?.profissionalId) query = query.eq('profissional_id', filtros.profissionalId)
  if (filtros?.competencia) query = query.eq('competencia', filtros.competencia)
  const { data, error } = await query
  return { data: data || [], error: error?.message || null }
}

export async function atualizarStatusRepasse(
  id: string,
  status: RepasseStatus,
): Promise<Resultado<Repasse>> {
  const { data, error } = await supabase
    .from('repasses').update({ status }).eq('id', id).select().single()
  return { data: data as Repasse | null, error: error?.message || null }
}

export async function pagarRepasse(
  id: string,
  opcoes?: { usuario_id?: string | null; nomeProfissional?: string },
): Promise<Resultado<Repasse>> {
  const { data: rep, error: e1 } = await supabase
    .from('repasses').select('*').eq('id', id).single()
  if (e1 || !rep) return { data: null, error: e1?.message || 'repasse não encontrado' }
  if (rep.status === 'pago') return { data: null, error: 'repasse já pago' }
  if (rep.status === 'cancelado') return { data: null, error: 'repasse cancelado' }

  const { data: atualizado, error: e2 } = await supabase
    .from('repasses')
    .update({ status: 'pago', pago_em: agora() })
    .eq('id', id)
    .select()
    .single()
  if (e2) return { data: null, error: e2.message }

  await registrarSaida({
    clinica_id: rep.clinica_id,
    valor: Number(rep.valor || 0),
    origem: 'repasse',
    descricao: `Repasse médico${opcoes?.nomeProfissional ? ' — ' + opcoes.nomeProfissional : ''}`,
    criado_por: opcoes?.usuario_id || null,
  })

  return { data: atualizado as Repasse, error: null }
}
