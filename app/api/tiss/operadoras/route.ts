import { NextRequest, NextResponse } from 'next/server'
import { db, erro, ruim, escopoDe, operadoraNoEscopo } from '@/lib/tiss/servidor'
import { validarOperadora } from '@/lib/tiss/validar'

export const dynamic = 'force-dynamic'

const CAMPOS = ['nome', 'registro_ans', 'codigo_prestador', 'cnpj_operadora', 'cnes', 'nome_contratado', 'versao_tiss', 'prazo_pagamento_dias', 'ativo'] as const

function limpar(b: any) {
  const o: Record<string, any> = {}
  for (const k of CAMPOS) if (k in b) o[k] = typeof b[k] === 'string' ? b[k].trim() : b[k]
  if (o.registro_ans !== undefined) o.registro_ans = String(o.registro_ans || '').replace(/\D/g, '')
  if (o.cnpj_operadora !== undefined) o.cnpj_operadora = String(o.cnpj_operadora || '').replace(/\D/g, '') || null
  if (o.cnes !== undefined) o.cnes = String(o.cnes || '').replace(/\D/g, '') || '9999999'
  if (o.prazo_pagamento_dias !== undefined) o.prazo_pagamento_dias = Number(o.prazo_pagamento_dias) || null
  return o
}

// GET /api/tiss/operadoras?clinica_id=|medico_id=
export async function GET(req: NextRequest) {
  const esc = escopoDe(req.nextUrl.searchParams)
  if (!esc.clinica_id && !esc.medico_id) return ruim('Informe clinica_id ou medico_id.')
  let q = db.from('operadoras').select('*').order('nome')
  q = esc.clinica_id ? q.eq('clinica_id', esc.clinica_id) : q.eq('medico_id', esc.medico_id!)
  const { data, error } = await q
  if (error) return erro(error)
  return NextResponse.json({ operadoras: data || [] })
}

// POST — cadastra operadora no escopo
export async function POST(req: NextRequest) {
  try {
    const b = await req.json()
    const esc = escopoDe(b)
    if (!esc.clinica_id && !esc.medico_id) return ruim('Informe clinica_id ou medico_id.')
    const dados = limpar(b)
    const v = validarOperadora(dados)
    if (!v.ok) return NextResponse.json({ error: v.erros[0].mensagem, erros: v.erros }, { status: 422 })
    const { data, error } = await db.from('operadoras').insert({
      ...dados,
      clinica_id: esc.clinica_id || null,
      medico_id: esc.clinica_id ? null : esc.medico_id,
    }).select().single()
    if (error) return erro(error)
    return NextResponse.json({ operadora: data })
  } catch (e) { return erro(e) }
}

// PATCH — { id, ...campos, clinica_id|medico_id }
export async function PATCH(req: NextRequest) {
  try {
    const b = await req.json()
    if (!b.id) return ruim('id obrigatório')
    const r = await operadoraNoEscopo(b.id, escopoDe(b))
    if (r.erro) return erro(r.erro, r.status)
    const dados = limpar(b)
    const v = validarOperadora({ ...r.operadora, ...dados })
    if (!v.ok) return NextResponse.json({ error: v.erros[0].mensagem, erros: v.erros }, { status: 422 })
    const { data, error } = await db.from('operadoras').update(dados).eq('id', b.id).select().single()
    if (error) return erro(error)
    return NextResponse.json({ operadora: data })
  } catch (e) { return erro(e) }
}

// DELETE ?id= — exclui; se já tem guias, apenas desativa (preserva o histórico)
export async function DELETE(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const id = sp.get('id')
  if (!id) return ruim('id obrigatório')
  const r = await operadoraNoEscopo(id, escopoDe(sp))
  if (r.erro) return erro(r.erro, r.status)
  const { count, error: e1 } = await db.from('guias_tiss').select('id', { count: 'exact', head: true }).eq('operadora_id', id)
  if (e1) return erro(e1)
  if ((count || 0) > 0) {
    const { error } = await db.from('operadoras').update({ ativo: false }).eq('id', id)
    if (error) return erro(error)
    return NextResponse.json({ ok: true, desativada: true })
  }
  const { error } = await db.from('operadoras').delete().eq('id', id)
  if (error) return erro(error)
  return NextResponse.json({ ok: true })
}
