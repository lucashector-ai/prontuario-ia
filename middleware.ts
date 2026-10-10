import { NextRequest, NextResponse } from 'next/server'
import { COOKIE_SESSAO, verificarToken } from '@/lib/token'

// Rotas que atendentes (equipe de atendimento do Chat) podem acessar
const ATENDENTE_ROUTES = ['/chat', '/login-atendente', '/api/']

/**
 * Rotas /api abertas sem sessão (cada uma tem a própria proteção ou é pública por natureza):
 * login/cadastro, webhooks da Meta (verify token), crons (CRON_SECRET), superadmin (ADMIN_TOKEN),
 * API de integração (api_key), agenda pública, formulário e sala do paciente.
 */
const API_PUBLICA_EXATA = new Set([
  '/api/login', '/api/logout', '/api/atendentes/login', '/api/cadastro-clinica', '/api/cadastro-autonomo',
  '/api/verificar-email', '/api/forgot-password',
  '/api/whatsapp', '/api/instagram', '/api/messenger',
  '/api/superadmin', '/api/public',
  '/api/agenda-publica/slots', '/api/agenda-publica/solicitar', '/api/agenda-publica/perfil',
  '/api/formularios/buscar', '/api/formularios/responder',
  '/api/canais/instagram/desautorizar', '/api/canais/instagram/exclusao',
  '/api/canais/instagram/callback',   // protegido pelo "state" assinado
])
const API_PUBLICA_PREFIXO = ['/api/cron/', '/api/sala/', '/api/painel/', '/api/totem/']

function apiPublica(pathname: string) {
  const p = pathname.replace(/\/+$/, '')
  return API_PUBLICA_EXATA.has(p) || API_PUBLICA_PREFIXO.some(x => p.startsWith(x))
}

async function protegerApi(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl
  if (apiPublica(pathname)) return NextResponse.next()

  // Chamadas internas de cron entre rotas
  const auth = req.headers.get('authorization')
  const segredoCron = process.env.CRON_SECRET
  if (segredoCron && auth === `Bearer ${segredoCron}`) return NextResponse.next()

  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : req.cookies.get(COOKIE_SESSAO)?.value
  const sessao = await verificarToken(token)
  if (!sessao) {
    return NextResponse.json({ error: 'Sessão expirada. Entre novamente.' }, { status: 401 })
  }

  // Ninguém consulta dados de outra clínica pela URL
  const clinicaPedida = searchParams.get('clinica_id')
  if (clinicaPedida && sessao.clinica_id && clinicaPedida !== sessao.clinica_id) {
    return NextResponse.json({ error: 'Sem permissão para esta clínica' }, { status: 403 })
  }
  return NextResponse.next()
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (pathname.startsWith('/api')) return protegerApi(req)
  if (pathname.startsWith('/_next')) return NextResponse.next()

  // Lógica de atendente: se é atendente, só pode acessar rotas permitidas
  const isAtendente = req.cookies.get('is_atendente')?.value === 'true'
  if (isAtendente) {
    const permitido = ATENDENTE_ROUTES.some(r => pathname.startsWith(r))
    if (!permitido && pathname !== '/') {
      return NextResponse.redirect(new URL('/chat', req.url))
    }
  }

  // TODO: quando o domínio próprio (clinical360.com.br + app.clinical360.com.br)
  // for configurado, reativar a separação por subdomínio aqui.
  // Por ora, a separação landing × app é feita só na lógica das páginas.

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)']
}
