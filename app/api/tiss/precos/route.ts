import { NextRequest, NextResponse } from 'next/server'
import { db, erro, ruim, escopoDe, operadoraNoEscopo, numero } from '@/lib/tiss/servidor'

export const dynamic = 'force-dynamic'

// GET /api/tiss/precos?operadora_id=&clinica_id=|medico_id=
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const opId = sp.get('operadora_id')
  if (!opId) return ruim('operadora_id obrigatório')
  const r = await operadoraNoEscopo(opId, escopoDe(sp))
  if (r.erro) return erro(r.erro, r.status)
  const { data, error } = await db.from('tabela_precos').select('*').eq('operadora_id', opId).order('codigo_tuss')
  if (error) return erro(error)
  return NextResponse.json({ precos: data || [] })
}

function validar(b: any): string | null {
  if (!/^\d{8}$/.test(String(b.codigo_tuss || ''))) return 'Código TUSS deve ter 8 dígitos.'
  if (!String(b.descricao || '').trim()) return 'Informe a descrição.'
  if (!(Number(b.valor) > 0)) return 'Valor deve ser maior que zero.'
  return null
}

// POST — { operadora_id, codigo_tuss, descricao, valor } (upsert pelo código)
export async function POST(req: NextRequest) {
  try {
    const b = await req.json()
    const r = await operadoraNoEscopo(b.operadora_id, escopoDe(b))
    if (r.erro) return erro(r.erro, r.status)
    const item = { operadora_id: b.operadora_id, codigo_tuss: String(b.codigo_tuss || '').replace(/\D/g, ''), descricao: String(b.descricao || '').trim(), valor: numero(b.valor) }
    const msg = validar(item)
    if (msg) return ruim(msg, 422)
    const { data, error } = await db.from('tabela_precos').upsert(item, { onConflict: 'operadora_id,codigo_tuss' }).select().single()
    if (error) return erro(error)
    return NextResponse.json({ preco: data })
  } catch (e) { return erro(e) }
}

// PATCH — { id, descricao?, valor? }
export async function PATCH(req: NextRequest) {
  try {
    const b = await req.json()
    const { data: atual, error: e0 } = await db.from('tabela_precos').select('*').eq('id', b.id).maybeSingle()
    if (e0) return erro(e0)
    if (!atual) return ruim('Item não encontrado', 404)
    const r = await operadoraNoEscopo(atual.operadora_id, escopoDe(b))
    if (r.erro) return erro(r.erro, r.status)
    const novo = { ...atual, ...(b.descricao !== undefined ? { descricao: String(b.descricao).trim() } : {}), ...(b.valor !== undefined ? { valor: numero(b.valor) } : {}) }
    const msg = validar(novo)
    if (msg) return ruim(msg, 422)
    const { data, error } = await db.from('tabela_precos').update({ descricao: novo.descricao, valor: novo.valor }).eq('id', b.id).select().single()
    if (error) return erro(error)
    return NextResponse.json({ preco: data })
  } catch (e) { return erro(e) }
}

// DELETE ?id=
export async function DELETE(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const { data: atual, error: e0 } = await db.from('tabela_precos').select('operadora_id').eq('id', sp.get('id') || '').maybeSingle()
  if (e0) return erro(e0)
  if (!atual) return ruim('Item não encontrado', 404)
  const r = await operadoraNoEscopo(atual.operadora_id, escopoDe(sp))
  if (r.erro) return erro(r.erro, r.status)
  const { error } = await db.from('tabela_precos').delete().eq('id', sp.get('id')!)
  if (error) return erro(error)
  return NextResponse.json({ ok: true })
}
