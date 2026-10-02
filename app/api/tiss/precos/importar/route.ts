import { NextRequest, NextResponse } from 'next/server'
import { db, erro, ruim, escopoDe, operadoraNoEscopo } from '@/lib/tiss/servidor'
import { interpretarCsvPrecos } from '@/lib/tiss/csv'

// POST /api/tiss/precos/importar — { operadora_id, csv: "codigo;descricao;valor\n...", clinica_id|medico_id }
// Faz upsert pelo código TUSS (atualiza preços existentes).
export async function POST(req: NextRequest) {
  try {
    const b = await req.json()
    if (!b.operadora_id) return ruim('operadora_id obrigatório')
    const r = await operadoraNoEscopo(b.operadora_id, escopoDe(b))
    if (r.erro) return erro(r.erro, r.status)
    const { itens, ignorados } = interpretarCsvPrecos(String(b.csv || ''))
    if (!itens.length) return NextResponse.json({ error: 'Nenhuma linha válida. Use o formato codigo;descricao;valor', ignorados }, { status: 422 })
    const { error } = await db.from('tabela_precos')
      .upsert(itens.map(i => ({ ...i, operadora_id: b.operadora_id })), { onConflict: 'operadora_id,codigo_tuss' })
    if (error) return erro(error)
    return NextResponse.json({ importados: itens.length, ignorados })
  } catch (e) { return erro(e) }
}
