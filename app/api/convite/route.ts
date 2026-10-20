import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { supabaseServidor as db } from '@/lib/servidor'
import { assinarToken, comSessao } from '@/lib/sessao-servidor'

/**
 * Convite da equipe por link (/convite/<token>): a pessoa abre, vê a clínica e cria a própria senha.
 * O token é o token_verificacao do registro em medicos (vale 7 dias, uso único).
 *   GET  ?token=…            → { nome, email, cargo, clinica }
 *   POST { token, senha }    → cria a senha, entra direto (sessão) e segue para o onboarding
 */
const senhaEhForte = (s: string) => s.length >= 8 && /[A-Z]/.test(s) && /[a-z]/.test(s) && /[0-9]/.test(s)

async function porToken(token: string | null) {
  if (!token || token.length < 32) return null
  const { data } = await db.from('medicos').select('*').eq('token_verificacao', token).maybeSingle()
  if (!data) return null
  if (data.token_expira_em && new Date(data.token_expira_em).getTime() < Date.now()) return 'vencido' as const
  return data as any
}

export async function GET(req: NextRequest) {
  const m = await porToken(req.nextUrl.searchParams.get('token'))
  if (!m) return NextResponse.json({ error: 'Este convite não vale mais. Peça um novo ao administrador da clínica.' }, { status: 404 })
  if (m === 'vencido') return NextResponse.json({ error: 'Este convite venceu. Peça um novo ao administrador da clínica.' }, { status: 410 })
  const { data: clinica } = await db.from('clinicas').select('nome').eq('id', m.clinica_id).maybeSingle()
  return NextResponse.json({ nome: m.nome, email: m.email, cargo: m.cargo, clinica: (clinica as any)?.nome || null })
}

export async function POST(req: NextRequest) {
  const { token, senha } = await req.json().catch(() => ({}))
  const m = await porToken(token)
  if (!m) return NextResponse.json({ error: 'Este convite não vale mais. Peça um novo ao administrador da clínica.' }, { status: 404 })
  if (m === 'vencido') return NextResponse.json({ error: 'Este convite venceu. Peça um novo ao administrador da clínica.' }, { status: 410 })
  if (!senhaEhForte(senha || '')) return NextResponse.json({ error: 'Use 8 ou mais caracteres, com letra maiúscula, minúscula e número.' }, { status: 400 })

  const senha_hash = await bcrypt.hash(senha, 10)
  const { error } = await db.from('medicos').update({
    senha_hash, senha_provisoria: false, verificado: true, token_verificacao: null, token_expira_em: null,
  }).eq('id', m.id)
  if (error) return NextResponse.json({ error: 'Não foi possível salvar a senha. Tente de novo.' }, { status: 500 })

  const { data: clinica } = await db.from('clinicas').select('id, nome, tipo').eq('id', m.clinica_id).maybeSingle()
  const sessao = await assinarToken({ sub: m.id, tipo: 'medico', clinica_id: m.clinica_id || null, medico_id: m.id })
  const { senha_hash: _h, senha: _s, token_verificacao: _t, ...medico } = m
  return comSessao(NextResponse.json({ ok: true, token: sessao, medico: { ...medico, senha_provisoria: false, verificado: true }, clinica }), sessao)
}
