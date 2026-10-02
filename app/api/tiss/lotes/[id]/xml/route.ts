import { NextRequest, NextResponse } from 'next/server'
import { db, erro, ruim, escopoDe, operadoraNoEscopo } from '@/lib/tiss/servidor'
import { gerarXmlLote, xmlParaBytes } from '@/lib/tiss/xml'
import { validarGuia } from '@/lib/tiss/validar'
import type { Guia } from '@/lib/tiss/tipos'

export const dynamic = 'force-dynamic'

/**
 * GET /api/tiss/lotes/:id/xml?clinica_id=|medico_id=
 * Baixa o XML TISS (ISO-8859-1) do lote e grava o hash no lote.
 * O arquivo é enviado pelo usuário no portal/webservice da operadora.
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { data: lote, error: e0 } = await db.from('lotes_tiss').select('*').eq('id', params.id).maybeSingle()
    if (e0) return erro(e0)
    if (!lote) return ruim('Lote não encontrado.', 404)
    const r = await operadoraNoEscopo(lote.operadora_id, escopoDe(req.nextUrl.searchParams))
    if (r.erro) return erro(r.erro, r.status)

    const { data: guias, error: e1 } = await db.from('guias_tiss').select('*').eq('lote_id', lote.id).order('numero_guia_prestador')
    if (e1) return erro(e1)
    const pend = (guias as Guia[] || []).map(g => ({ g, v: validarGuia(g, { operadora: r.operadora }) })).filter(x => !x.v.ok)
    if (pend.length) {
      return NextResponse.json({
        error: `${pend.length} guia(s) com pendências — corrija antes de exportar.`,
        guias: pend.map(p => ({ id: p.g.id, numero: p.g.numero_guia_prestador, erros: p.v.erros })),
      }, { status: 422 })
    }

    const { xml, hash, nomeArquivo } = gerarXmlLote({
      operadora: r.operadora,
      lote: { numero_lote: lote.numero_lote, tipo_guia: lote.tipo_guia || 'consulta' },
      guias: guias as Guia[],
    })
    await db.from('lotes_tiss').update({ xml_hash: hash }).eq('id', lote.id)

    return new NextResponse(Buffer.from(xmlParaBytes(xml)), {
      headers: {
        'Content-Type': 'application/xml; charset=ISO-8859-1',
        'Content-Disposition': `attachment; filename="${nomeArquivo}"`,
        'X-Tiss-Hash': hash,
        'Cache-Control': 'no-store',
      },
    })
  } catch (e: any) {
    if (/único tipo|não tem guias/.test(e?.message || '')) return ruim(e.message, 422)
    return erro(e)
  }
}
