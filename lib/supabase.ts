import { createClient } from '@supabase/supabase-js'
import { lerToken } from '@/lib/token'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const CHAVE_TOKEN = 'c360_token'

/** Token da sessão no navegador (null se ausente ou expirado). */
export function tokenSessao(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const t = localStorage.getItem(CHAVE_TOKEN)
    const p = lerToken(t)
    return t && p && p.exp * 1000 > Date.now() ? t : null
  } catch { return null }
}

/**
 * Cliente do banco.
 * - Navegador: chave pública + token da sessão. O RLS do banco libera só os dados
 *   da clínica de quem está logado; sem login, não se vê nada.
 * - Servidor (rotas /api): service role. As rotas são protegidas pelo middleware.
 */
export const supabase = typeof window === 'undefined'
  ? createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY || anon, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (u: any, i: any) => fetch(u, { ...i, cache: 'no-store' }) } })
  : createClient(url, anon, { accessToken: async () => tokenSessao() })

/** Só para o Supabase Auth (OAuth/recuperação de senha) — não lê dados. */
export const supabaseAuth = createClient(url, anon)
