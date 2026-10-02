import { NextRequest, NextResponse } from 'next/server'
import { db, erro, ruim, escopoDe, operadorasDoEscopo, operadoraNoEscopo, proximoNumero, evento } from '@/lib/tiss/servidor'
import { validarGuia } from '@/lib/tiss/validar'
import { agruparParaLote } from '@/lib/tiss/lotes'
import type { Guia } from '@/lib/tiss/tipos'

export const dynamic = 'force-dynamic'

// GET /api/tiss/lotes?clinica_id=|medico_id=
export async function GET(req: NextRequest) {
  const { ids, erro: e0 } = await operadorasDoEscopo(escopoDe(req.nextUrl.searchParams))
  if (e0) return erro(e0)
  if (!ids.length) return NextResponse.json({ lotes: [] })
  const { data, error } = await db.from('lotes_tiss').select('*').in('operadora_id', ids).order('criado_em', { ascending: false }).limit(300)
  if (error) return erro(error)
  return NextResponse.json({ lotes: data || [] })
}

/**
 * POST — monta lote(s) com guias PRONTAS.
 * { guia_ids: string[] }  ou  { operadora_id, competencia: 'yyyy-mm' }  (+ clinica_id|medico_id)
 * Guias de operadoras/tipos/competências diferentes viram lotes separados (regra TISS).
 */
export async function POST(req: NextRequest) {
  try {
    const b = await req.json()
    const esc = escopoDe(b)
    const { ids, erro: e0 } = await operadorasDoEscopo(esc)
    if (e0) return erro(e0)
    if (!ids.length) return ruim('Nenhuma operadora cadastrada.', 422)

    let q = db.from('guias_tiss').select('*').in('operadora_id', ids).eq('status', 'pronta')
    if (Array.isArray(b.guia_ids) && b.guia_ids.length) q = q.in('id', b.guia_ids)
    else if (b.operadora_id && /^\d{4}-\d{2}$/.test(b.competencia || '')) {
      const [a, m] = b.competencia.split('-').map(Number)
      q = q.eq('operadora_id', b.operadora_id).gte('data_atendimento', `${b.competencia}-01`)
        .lt('data_atendimento', new Date(Date.UTC(a, m, 1)).toISOString().slice(0, 10))
    } else return ruim('Informe as guias ou operadora + competência.')
    const { data: guias, error: e1 } = await q
    if (e1) return erro(e1)
    if (!guias?.length) return ruim('Nenhuma guia pronta encontrada. Marque as guias como prontas antes de montar o lote.', 422)

    // Revalida tudo antes de fechar o lote
    const ops: Record<string, any> = {}
    for (const id of Array.from(new Set<string>(guias.map((g: any) => g.operadora_id)))) {
      const r = await operadoraNoEscopo(id, esc)
      if (r.erro) return erro(r.erro, r.status)
      ops[id] = r.operadora
    }
    const problemas = (guias as Guia[]).map(g => ({ g, v: validarGuia(g, { operadora: ops[g.operadora_id] }) })).filter(x => !x.v.ok)
    if (problemas.length) {
      return NextResponse.json({
        error: `${problemas.length} guia(s) com pendências.`,
        guias: problemas.map(p => ({ id: p.g.id, numero: p.g.numero_guia_prestador, erros: p.v.erros })),
      }, { status: 422 })
    }

    const criados: any[] = []
    for (const grp of agruparParaLote(guias as Guia[])) {
      const numeroLote = await proximoNumero(grp.operadora_id, 'ultimo_numero_lote')
      const { data: lote, error: e2 } = await db.from('lotes_tiss').insert({
        operadora_id: grp.operadora_id, numero_lote: numeroLote, tipo_guia: grp.tipo_guia, competencia: grp.competencia,
        quantidade_guias: grp.guias.length, valor_total: grp.valor_total, status: 'aberto',
      }).select().single()
      if (e2) return erro(e2)
      for (const g of grp.guias) {
        const { error: e3 } = await db.from('guias_tiss').update({
          status: 'em_lote', lote_id: lote.id, atualizado_em: new Date().toISOString(),
          historico: [...(g.historico || []), evento('em_lote', `Lote ${numeroLote}`)],
        }).eq('id', g.id).eq('status', 'pronta')
        if (e3) return erro(e3)
      }
      criados.push(lote)
    }
    return NextResponse.json({ lotes: criados })
  } catch (e) { return erro(e) }
}

/**
 * PATCH — { id, acao: 'enviar' (protocolo?) | 'processar' | 'protocolo' (protocolo) }
 * enviar: lote → enviado, guias → enviada. O envio em si é feito pelo usuário no
 * portal/webservice da operadora com o XML exportado.
 */
export async function PATCH(req: NextRequest) {
  try {
    const b = await req.json()
    const { data: lote, error: e0 } = await db.from('lotes_tiss').select('*').eq('id', b.id || '').maybeSingle()
    if (e0) return erro(e0)
    if (!lote) return ruim('Lote não encontrado.', 404)
    const r = await operadoraNoEscopo(lote.operadora_id, escopoDe(b))
    if (r.erro) return erro(r.erro, r.status)
    const protocolo = typeof b.protocolo === 'string' ? b.protocolo.trim() || null : undefined

    if (b.acao === 'enviar') {
      if (lote.status !== 'aberto') return ruim('Lote já foi enviado.', 409)
      const { data, error } = await db.from('lotes_tiss').update({
        status: 'enviado', enviado_em: new Date().toISOString(), ...(protocolo !== undefined ? { protocolo } : {}),
      }).eq('id', lote.id).select().single()
      if (error) return erro(error)
      const { data: gs } = await db.from('guias_tiss').select('id, historico').eq('lote_id', lote.id).eq('status', 'em_lote')
      for (const g of gs || []) {
        await db.from('guias_tiss').update({
          status: 'enviada', atualizado_em: new Date().toISOString(),
          historico: [...(g.historico || []), evento('enviada', protocolo ? `Protocolo ${protocolo}` : `Lote ${lote.numero_lote}`)],
        }).eq('id', g.id)
      }
      return NextResponse.json({ lote: data })
    }
    if (b.acao === 'protocolo') {
      const { data, error } = await db.from('lotes_tiss').update({ protocolo: protocolo ?? null }).eq('id', lote.id).select().single()
      if (error) return erro(error)
      return NextResponse.json({ lote: data })
    }
    if (b.acao === 'processar') {
      const { data, error } = await db.from('lotes_tiss').update({ status: 'processado' }).eq('id', lote.id).select().single()
      if (error) return erro(error)
      return NextResponse.json({ lote: data })
    }
    return ruim('acao inválida')
  } catch (e) { return erro(e) }
}

// DELETE ?id= — desfaz lote ABERTO: guias voltam para "pronta"
export async function DELETE(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const { data: lote, error: e0 } = await db.from('lotes_tiss').select('*').eq('id', sp.get('id') || '').maybeSingle()
  if (e0) return erro(e0)
  if (!lote) return ruim('Lote não encontrado.', 404)
  const r = await operadoraNoEscopo(lote.operadora_id, escopoDe(sp))
  if (r.erro) return erro(r.erro, r.status)
  if (lote.status !== 'aberto') return ruim('Só lotes ainda não enviados podem ser desfeitos.', 409)
  const { error: e1 } = await db.from('guias_tiss').update({ status: 'pronta', lote_id: null, atualizado_em: new Date().toISOString() }).eq('lote_id', lote.id)
  if (e1) return erro(e1)
  const { error } = await db.from('lotes_tiss').delete().eq('id', lote.id)
  if (error) return erro(error)
  return NextResponse.json({ ok: true })
}
