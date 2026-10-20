import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { contextoDaRequisicao, naoAutenticado, proibido } from '@/lib/acesso'

/** Procedimentos sempre da clínica da SESSÃO; o clinica_id da tela é ignorado. Alterar: só gestor/autônomo. */
async function escopo(req: NextRequest, alterar = false) {
  const ctx = await contextoDaRequisicao(req)
  if (!ctx) return { erro: naoAutenticado() }
  const chave = ctx.clinica_id || ctx.medico_id
  if (!chave || ctx.tipo === 'atendente') return { erro: proibido() }
  if (alterar && ctx.clinica_id && !ctx.gestor) return { erro: proibido('Só o administrador da clínica altera os procedimentos.') }
  return { chave }
}

const lista = (v: any) => Array.isArray(v) ? v.map((x: any) => String(x).trim().toLowerCase()).filter(Boolean).slice(0, 6) : String(v || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean).slice(0, 6)

// GET ?clinica_id=xxx — lista procedimentos ativos da clínica
export async function GET(req: NextRequest) {
  const { chave: clinicaId, erro } = await escopo(req)
  if (erro) return erro
  const incluirInativos = req.nextUrl.searchParams.get('incluir_inativos') === '1'

  let q = supabase
    .from('procedimentos')
    .select('*')
    .eq('clinica_id', clinicaId)
    .order('nome', { ascending: true })

  if (!incluirInativos) q = q.eq('ativo', true)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ procedimentos: data || [] })
}

// POST — cria procedimento
export async function POST(req: NextRequest) {
  try {
    const { chave: clinica_id, erro } = await escopo(req, true)
    if (erro) return erro
    const body = await req.json()
    const { nome, duracao, valor, custo_insumos, custo_operacional, tipo_sala, equipamentos_tipos } = body
    if (!nome) return NextResponse.json({ error: 'Informe o nome.' }, { status: 400 })
    const { data, error } = await supabase
      .from('procedimentos')
      .insert({
        clinica_id,
        nome: nome.trim(),
        duracao: parseInt(duracao) || 30,
        valor: valor != null && valor !== '' ? parseFloat(valor) : null,
        custo_insumos: custo_insumos != null && custo_insumos !== '' ? parseFloat(custo_insumos) : 0,
        custo_operacional: custo_operacional != null && custo_operacional !== '' ? parseFloat(custo_operacional) : 0,
        ...(tipo_sala !== undefined ? { tipo_sala: tipo_sala || null } : {}),
        ...(equipamentos_tipos !== undefined ? { equipamentos_tipos: lista(equipamentos_tipos) } : {}),
      })
      .select()
      .single()
    if (error) throw error
    return NextResponse.json({ procedimento: data })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// PATCH — edita procedimento
export async function PATCH(req: NextRequest) {
  try {
    const { chave, erro } = await escopo(req, true)
    if (erro) return erro
    const body = await req.json()
    const { id, nome, duracao, valor, ativo, custo_insumos, custo_operacional, tipo_sala, equipamentos_tipos } = body
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const updates: any = { atualizado_em: new Date().toISOString() }
    if (nome !== undefined) updates.nome = nome.trim()
    if (duracao !== undefined) updates.duracao = parseInt(duracao) || 30
    if (valor !== undefined) updates.valor = valor != null && valor !== '' ? parseFloat(valor) : null
    if (custo_insumos !== undefined) updates.custo_insumos = custo_insumos !== '' ? parseFloat(custo_insumos) || 0 : 0
    if (custo_operacional !== undefined) updates.custo_operacional = custo_operacional !== '' ? parseFloat(custo_operacional) || 0 : 0
    if (ativo !== undefined) updates.ativo = !!ativo
    if (tipo_sala !== undefined) updates.tipo_sala = tipo_sala || null
    if (equipamentos_tipos !== undefined) updates.equipamentos_tipos = lista(equipamentos_tipos)

    const { data, error } = await supabase
      .from('procedimentos')
      .update(updates)
      .eq('id', id)
      .eq('clinica_id', chave!)
      .select()
      .single()
    if (error) throw error
    return NextResponse.json({ procedimento: data })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// DELETE ?id=xxx — soft delete (ativo=false)
export async function DELETE(req: NextRequest) {
  const { chave, erro } = await escopo(req, true)
  if (erro) return erro
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { error } = await supabase
    .from('procedimentos')
    .update({ ativo: false, atualizado_em: new Date().toISOString() })
    .eq('id', id)
    .eq('clinica_id', chave!)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
