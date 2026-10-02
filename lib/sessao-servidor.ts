/**
 * Sessão no servidor: emitir token no login e ler quem está chamando uma rota /api.
 *
 *   // no login
 *   const token = await assinarToken({ sub, tipo, clinica_id, medico_id })
 *   return comSessao(NextResponse.json({ ok: true, token, ... }), token)
 *
 *   // numa rota protegida (o middleware já barrou quem não tem sessão)
 *   const s = await sessaoDaRequisicao(req)   // { tipo, clinica_id, medico_id, ... }
 */
import { NextRequest, NextResponse } from 'next/server'
import { COOKIE_SESSAO, DURACAO_SESSAO_S, verificarToken } from '@/lib/token'

export { assinarToken } from '@/lib/token'

/** Grava o cookie httpOnly da sessão na resposta. */
export function comSessao(res: NextResponse, token: string) {
  res.cookies.set(COOKIE_SESSAO, token, {
    httpOnly: true, sameSite: 'lax', path: '/', maxAge: DURACAO_SESSAO_S,
    secure: process.env.NODE_ENV === 'production',
  })
  return res
}

export function semSessao(res: NextResponse) {
  res.cookies.set(COOKIE_SESSAO, '', { httpOnly: true, path: '/', maxAge: 0 })
  return res
}

/** Token da requisição: cookie da sessão ou `Authorization: Bearer`. */
export function tokenDaRequisicao(req: NextRequest): string | null {
  const auth = req.headers.get('authorization')
  if (auth?.startsWith('Bearer ')) return auth.slice(7)
  return req.cookies.get(COOKIE_SESSAO)?.value || null
}

export async function sessaoDaRequisicao(req: NextRequest) {
  return verificarToken(tokenDaRequisicao(req))
}
