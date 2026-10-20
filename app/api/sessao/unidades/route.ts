import { NextRequest, NextResponse } from 'next/server'
import { sessaoDaRequisicao, comSessao } from '@/lib/sessao-servidor'
import { supabaseServidor as db } from '@/lib/servidor'
import { unidadesDaPessoa, sessaoNaUnidade } from '@/lib/contas'

/**
 * Unidades da pessoa logada e troca de unidade (seletor no topo).
 *   GET                               → { atual, unidades: [...] }
 *   POST { clinica_id, papel }        → nova sessão naquela unidade (mesmos dados do login)
 */
async function emailDaSessao(req: NextRequest) {
  const s = await sessaoDaRequisicao(req)
  if (!s) return { s: null, email: null }
  const tabela = s.tipo === 'clinica' ? 'clinica_admins' : s.tipo === 'medico' ? 'medicos' : 'atendentes'
  const { data } = await db.from(tabela).select('email').eq('id', s.sub).maybeSingle()
  return { s, email: (data as any)?.email as string | null }
}

export async function GET(req: NextRequest) {
  const { s, email } = await emailDaSessao(req)
  if (!s) return NextResponse.json({ error: 'Sessão expirada. Entre novamente.' }, { status: 401 })
  const unidades = email ? await unidadesDaPessoa(email) : []
  return NextResponse.json({ atual: s.clinica_id, unidades: unidades.map(({ clinica_admin_id, medico_id, ...u }) => u) })
}

export async function POST(req: NextRequest) {
  const { s, email } = await emailDaSessao(req)
  if (!s || !email) return NextResponse.json({ error: 'Sessão expirada. Entre novamente.' }, { status: 401 })
  const { clinica_id, papel } = await req.json().catch(() => ({}))
  const alvo = (await unidadesDaPessoa(email)).find(u => u.clinica_id === clinica_id && (!papel || u.papel === papel))
  if (!alvo) return NextResponse.json({ error: 'Você não tem acesso a esta unidade.' }, { status: 403 })
  const sessao = await sessaoNaUnidade(alvo)
  if (!sessao) return NextResponse.json({ error: 'Este acesso foi desativado. Fale com o administrador.' }, { status: 403 })
  return comSessao(NextResponse.json({ ok: true, ...sessao }), sessao.token)
}
