import { NextRequest, NextResponse } from 'next/server'
import { escopoCanais } from '@/lib/meta/escopo'
import { metaConfigurada } from '@/lib/meta/graph'
import { buscarPaginas } from '@/lib/meta/paginas'

export async function POST(req: NextRequest) {
  if (!metaConfigurada()) return NextResponse.json({ error: 'Integração com a Meta ainda não configurada no servidor' }, { status: 503 })
  const e = await escopoCanais(req)
  if (!e) return NextResponse.json({ error: 'Sessão expirada' }, { status: 401 })
  const { token_usuario } = await req.json().catch(() => ({}))
  if (!token_usuario) return NextResponse.json({ error: 'Login na Meta não concluído' }, { status: 400 })
  try {
    const paginas = await buscarPaginas(String(token_usuario))
    // tokens das páginas nunca vão para o navegador
    return NextResponse.json({ paginas: paginas.map(({ token, ...p }) => p) })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Não foi possível listar suas páginas' }, { status: 502 })
  }
}
