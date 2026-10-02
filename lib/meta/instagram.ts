/**
 * "Login do Instagram para empresas" — a clínica entra direto com a conta do Instagram,
 * sem página do Facebook. Tokens de 60 dias, renovados automaticamente (cron de canais).
 *
 * Variáveis: INSTAGRAM_APP_ID (público) e INSTAGRAM_APP_SECRET.
 */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { GRAPH_IG, graph } from '@/lib/meta/graph'

export const ESCOPOS_INSTAGRAM = 'instagram_business_basic,instagram_business_manage_messages'

export function instagramConfigurado() {
  return !!(process.env.INSTAGRAM_APP_ID && process.env.INSTAGRAM_APP_SECRET)
}

// ── "state" assinado: liga a volta do login à clínica/médico que começou ─────
function segredoEstado() {
  return process.env.SUPABASE_JWT_SECRET || process.env.INSTAGRAM_APP_SECRET || ''
}
export function criarEstado(dados: { medicoId: string; clinicaId: string | null; voltar?: string }) {
  const corpo = Buffer.from(JSON.stringify({ ...dados, n: randomBytes(8).toString('hex'), e: Date.now() + 15 * 60_000 })).toString('base64url')
  const sig = createHmac('sha256', segredoEstado()).update(corpo).digest('base64url')
  return `${corpo}.${sig}`
}
export function lerEstado(estado: string | null): { medicoId: string; clinicaId: string | null; voltar?: string } | null {
  if (!estado) return null
  const [corpo, sig] = estado.split('.')
  if (!corpo || !sig) return null
  const esperado = createHmac('sha256', segredoEstado()).update(corpo).digest('base64url')
  const a = Buffer.from(sig), b = Buffer.from(esperado)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  try {
    const d = JSON.parse(Buffer.from(corpo, 'base64url').toString())
    return d.e > Date.now() ? d : null
  } catch { return null }
}

export function urlLoginInstagram(redirectUri: string, estado: string) {
  const u = new URL('https://www.instagram.com/oauth/authorize')
  u.searchParams.set('client_id', process.env.INSTAGRAM_APP_ID!)
  u.searchParams.set('redirect_uri', redirectUri)
  u.searchParams.set('response_type', 'code')
  u.searchParams.set('scope', ESCOPOS_INSTAGRAM)
  u.searchParams.set('state', estado)
  u.searchParams.set('enable_fb_login', '0')
  return u.toString()
}

/** code → token curto → token de 60 dias. */
export async function trocarCodigoInstagram(code: string, redirectUri: string) {
  const form = new URLSearchParams({
    client_id: process.env.INSTAGRAM_APP_ID!, client_secret: process.env.INSTAGRAM_APP_SECRET!,
    grant_type: 'authorization_code', redirect_uri: redirectUri, code: code.replace(/#_$/, ''),
  })
  const r = await fetch('https://api.instagram.com/oauth/access_token', { method: 'POST', body: form })
  const j = await r.json().catch(() => ({}))
  if (!r.ok || !j.access_token) throw new Error(j.error_message || j.error?.message || 'O Instagram recusou o login')
  const longo = await graph<{ access_token: string; expires_in: number }>('https://graph.instagram.com/access_token', {
    params: { grant_type: 'ig_exchange_token', client_secret: process.env.INSTAGRAM_APP_SECRET!, access_token: j.access_token },
  })
  return { token: longo.access_token, expiraEm: new Date(Date.now() + (longo.expires_in || 5184000) * 1000).toISOString() }
}

/** Renova um token de 60 dias (precisa ter mais de 24h de vida). */
export async function renovarTokenInstagram(token: string) {
  const j = await graph<{ access_token: string; expires_in: number }>('https://graph.instagram.com/refresh_access_token', {
    params: { grant_type: 'ig_refresh_token', access_token: token },
  })
  return { token: j.access_token, expiraEm: new Date(Date.now() + (j.expires_in || 5184000) * 1000).toISOString() }
}

/** user_id = id da conta profissional (é o que chega como entry.id nos webhooks). */
export async function perfilInstagram(token: string) {
  return graph<{ user_id: string; id: string; username: string; name?: string; profile_picture_url?: string; account_type?: string }>(
    'me', { token, base: GRAPH_IG, params: { fields: 'user_id,id,username,name,profile_picture_url,account_type' } },
  )
}

/** Inscreve a conta para receber as mensagens no webhook. */
export async function inscreverWebhookInstagram(token: string) {
  return graph('me/subscribed_apps', { token, base: GRAPH_IG, metodo: 'POST', params: { subscribed_fields: 'messages' } })
}
