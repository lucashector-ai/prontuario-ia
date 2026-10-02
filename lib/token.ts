/**
 * Token de sessão do Clinical 360 — JWT HS256 assinado com o JWT secret do Supabase.
 * O Supabase (PostgREST/Realtime) aceita esse token, então as políticas de RLS
 * enxergam `auth.jwt() ->> 'clinica_id'` e `'medico_id'`.
 *
 * Usa só Web Crypto: funciona no middleware (edge) e nas rotas (node).
 */

export type ClaimsSessao = {
  sub: string
  tipo: 'clinica' | 'medico' | 'atendente'
  clinica_id: string | null
  medico_id: string | null
}

export type TokenDecodificado = ClaimsSessao & { role: string; exp: number; iat: number }

export const COOKIE_SESSAO = 'c360_sessao'
export const DURACAO_SESSAO_S = 7 * 24 * 3600

const enc = new TextEncoder()

function b64url(bytes: Uint8Array | string): string {
  const b = typeof bytes === 'string' ? enc.encode(bytes) : bytes
  let s = ''
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i])
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function deB64url(s: string): Uint8Array<ArrayBuffer> {
  const pad = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)
  const bin = atob(pad)
  const out = new Uint8Array(new ArrayBuffer(bin.length))
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function segredo(): string | null {
  return process.env.SUPABASE_JWT_SECRET || null
}

async function chave(s: string) {
  return crypto.subtle.importKey('raw', enc.encode(s), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])
}

/** Emite o token. Lança erro se SUPABASE_JWT_SECRET não estiver configurado. */
export async function assinarToken(c: ClaimsSessao): Promise<string> {
  const s = segredo()
  if (!s) throw new Error('SUPABASE_JWT_SECRET não configurado')
  const agora = Math.floor(Date.now() / 1000)
  const corpo = {
    ...c, role: 'authenticated', aud: 'authenticated', iss: 'clinical360',
    iat: agora, exp: agora + DURACAO_SESSAO_S,
  }
  const dados = `${b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${b64url(JSON.stringify(corpo))}`
  const assinatura = new Uint8Array(await crypto.subtle.sign('HMAC', await chave(s), enc.encode(dados)))
  return `${dados}.${b64url(assinatura)}`
}

/** Confere assinatura e validade. Retorna null se inválido/expirado. */
export async function verificarToken(token?: string | null): Promise<TokenDecodificado | null> {
  const s = segredo()
  if (!s || !token) return null
  const partes = token.split('.')
  if (partes.length !== 3) return null
  try {
    const ok = await crypto.subtle.verify('HMAC', await chave(s), deB64url(partes[2]), enc.encode(`${partes[0]}.${partes[1]}`))
    if (!ok) return null
    const corpo = JSON.parse(new TextDecoder().decode(deB64url(partes[1])))
    if (corpo.iss !== 'clinical360' || !corpo.exp || corpo.exp * 1000 < Date.now()) return null
    return corpo
  } catch {
    return null
  }
}

/** Lê o payload sem verificar (uso no navegador: só para saber se expirou). */
export function lerToken(token?: string | null): TokenDecodificado | null {
  try {
    const p = token?.split('.')[1]
    return p ? JSON.parse(new TextDecoder().decode(deB64url(p))) : null
  } catch {
    return null
  }
}
