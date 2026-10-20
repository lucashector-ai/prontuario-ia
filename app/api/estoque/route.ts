import { NextRequest, NextResponse } from 'next/server'
import { log } from '@/lib/logger'
import { supabaseServidor as db } from '@/lib/servidor'
import { contextoDaRequisicao, naoAutenticado, proibido } from '@/lib/acesso'
import { ErroAtendimento } from '@/lib/atendimento/servidor'
import {
  aplicarInventario, insumosDoProcedimento, listarItens, listarMovimentos, registrarEntrada, registrarSaida,
  reposicao, salvarInsumos, salvarItem,
} from '@/lib/estoque/servidor'

/**
 * Estoque da clínica da sessão (dono/gestor e enfermagem; recepção e médico não usam).
 *   GET ?ver=itens|movimentos|reposicao&item_id=   ·   GET ?procedimento_id= → insumos do procedimento
 *   POST { acao: 'item' | 'entrada' | 'saida' | 'inventario' | 'insumos', ... }
 */
const falha = (e: any) => {
  if (e instanceof ErroAtendimento) return NextResponse.json({ error: e.message }, { status: e.status || 400 })
  log.error('[estoque]', e)
  return NextResponse.json({ error: 'Não foi possível concluir. Tente de novo.' }, { status: 500 })
}

async function escopo(req: NextRequest) {
  const ctx = await contextoDaRequisicao(req)
  if (!ctx) return { erro: naoAutenticado() }
  const chave = ctx.clinica_id || ctx.medico_id
  if (!chave || ctx.tipo === 'atendente') return { erro: proibido() }
  if (ctx.clinica_id && !ctx.gestor && ctx.medico_id) {
    const { data: eu } = await db.from('medicos').select('cargo').eq('id', ctx.medico_id).maybeSingle()
    if ((eu as any)?.cargo !== 'enfermagem') return { erro: proibido('O estoque é do administrador e da enfermagem.') }
  }
  return { chave, usuario: ctx.medico_id || null, gestor: ctx.gestor || !ctx.clinica_id }
}

export async function GET(req: NextRequest) {
  const { chave, erro } = await escopo(req)
  if (erro) return erro
  try {
    const sp = req.nextUrl.searchParams
    if (sp.get('procedimento_id')) return NextResponse.json({ insumos: await insumosDoProcedimento(chave!, sp.get('procedimento_id')!) })
    const ver = sp.get('ver') || 'itens'
    if (ver === 'movimentos') return NextResponse.json({ movimentos: await listarMovimentos(chave!, sp.get('item_id')) })
    if (ver === 'reposicao') return NextResponse.json({ reposicao: await reposicao(chave!, Number(sp.get('cobertura')) || 30) })
    return NextResponse.json({ itens: await listarItens(chave!) }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) { return falha(e) }
}

export async function POST(req: NextRequest) {
  const { chave, usuario, gestor, erro } = await escopo(req)
  if (erro) return erro
  try {
    const b = await req.json()
    if (b.acao === 'entrada') return NextResponse.json(await registrarEntrada(chave!, usuario!, b))
    if (b.acao === 'saida') return NextResponse.json(await registrarSaida(chave!, usuario!, b))
    if (b.acao === 'inventario') return NextResponse.json(await aplicarInventario(chave!, usuario!, b.contagem || []))
    if (!gestor) return proibido('Só o administrador cadastra itens e insumos dos procedimentos.')
    if (b.acao === 'item') return NextResponse.json(await salvarItem(chave!, b))
    if (b.acao === 'insumos') return NextResponse.json(await salvarInsumos(chave!, String(b.procedimento_id || ''), b.insumos || []))
    return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 })
  } catch (e) { return falha(e) }
}
