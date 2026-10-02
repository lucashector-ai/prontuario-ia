/**
 * Graph API da Meta (WhatsApp Cloud, Messenger, Instagram) — SÓ no servidor.
 *
 * Variáveis:
 *   NEXT_PUBLIC_META_APP_ID   id do app da Meta (público)
 *   META_APP_SECRET           segredo do app (troca de código por token + assinatura dos webhooks)
 *   META_GRAPH_VERSION        opcional (padrão v23.0)
 */
import { createHmac, timingSafeEqual } from 'node:crypto'
import { supabaseServidor as db } from '@/lib/servidor'

export const GRAPH_VERSAO = process.env.META_GRAPH_VERSION || 'v23.0'
export const GRAPH = `https://graph.facebook.com/${GRAPH_VERSAO}`
/** API do Instagram com login do Instagram (tokens "IG…"). */
export const GRAPH_IG = `https://graph.instagram.com/${GRAPH_VERSAO}`

export class ErroMeta extends Error {
  constructor(msg: string, public codigo?: number, public detalhe?: any) { super(msg) }
}

/** Chamada à Graph API com token. Lança ErroMeta com a mensagem da Meta. */
export async function graph<T = any>(caminho: string, opcoes: { token?: string; metodo?: string; corpo?: any; params?: Record<string, string>; base?: string } = {}): Promise<T> {
  const url = new URL(caminho.startsWith('http') ? caminho : `${opcoes.base || GRAPH}/${caminho.replace(/^\//, '')}`)
  for (const [k, v] of Object.entries(opcoes.params || {})) url.searchParams.set(k, v)
  const r = await fetch(url, {
    method: opcoes.metodo || (opcoes.corpo ? 'POST' : 'GET'),
    headers: {
      ...(opcoes.token ? { Authorization: `Bearer ${opcoes.token}` } : {}),
      ...(opcoes.corpo ? { 'Content-Type': 'application/json' } : {}),
    },
    body: opcoes.corpo ? JSON.stringify(opcoes.corpo) : undefined,
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok || j?.error) throw new ErroMeta(j?.error?.error_user_msg || j?.error?.message || `Meta respondeu ${r.status}`, j?.error?.code, j?.error)
  return j as T
}

export function metaConfigurada() {
  return !!(process.env.NEXT_PUBLIC_META_APP_ID && process.env.META_APP_SECRET)
}

/** Troca o "code" do login da Meta por um token de acesso. */
export async function trocarCodigo(code: string, redirectUri?: string): Promise<string> {
  const j = await graph<{ access_token: string }>('oauth/access_token', {
    params: {
      client_id: process.env.NEXT_PUBLIC_META_APP_ID!,
      client_secret: process.env.META_APP_SECRET!,
      code,
      ...(redirectUri !== undefined ? { redirect_uri: redirectUri } : {}),
    },
  })
  return j.access_token
}

/** Token de usuário de curta duração → longa duração (~60 dias). Tokens de página derivados dele não expiram. */
export async function tokenLongo(tokenUsuario: string): Promise<string> {
  const j = await graph<{ access_token: string }>('oauth/access_token', {
    params: {
      grant_type: 'fb_exchange_token',
      client_id: process.env.NEXT_PUBLIC_META_APP_ID!,
      client_secret: process.env.META_APP_SECRET!,
      fb_exchange_token: tokenUsuario,
    },
  })
  return j.access_token
}

/** Confere X-Hub-Signature-256 dos webhooks. Sem META_APP_SECRET, aceita (modo legado). */
export function assinaturaValida(corpoBruto: string, cabecalho: string | null): boolean {
  // Webhooks do app da Meta e do "login do Instagram" são assinados com segredos diferentes
  const segredos = [process.env.META_APP_SECRET, process.env.INSTAGRAM_APP_SECRET].filter(Boolean) as string[]
  if (!segredos.length) return true
  if (!cabecalho?.startsWith('sha256=')) return false
  const recebido = Buffer.from(cabecalho.slice(7))
  return segredos.some(seg => {
    const esperado = Buffer.from(createHmac('sha256', seg).update(corpoBruto).digest('hex'))
    return recebido.length === esperado.length && timingSafeEqual(recebido, esperado)
  })
}

export type CanalConectado = {
  id: string; clinica_id: string | null; medico_id: string; canal: 'whatsapp' | 'instagram' | 'messenger'
  conta_id: string; nome: string | null; access_token: string | null; detalhe: any; status: string
}

/** Qual clínica/médico é dono desta conta (página, Instagram ou número)? */
export async function canalPorConta(canal: CanalConectado['canal'], contaId: string): Promise<CanalConectado | null> {
  if (!contaId) return null
  const { data } = await db.from('canais_conectados').select('*').eq('canal', canal).eq('conta_id', contaId).neq('status', 'desconectado').maybeSingle()
  return (data as any) || null
}

export async function marcarErroCanal(id: string, erro: string) {
  await db.from('canais_conectados').update({ status: 'erro', erro: erro.slice(0, 300), atualizado_em: new Date().toISOString() }).eq('id', id)
}
