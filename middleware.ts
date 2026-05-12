import { NextRequest, NextResponse } from 'next/server'

// Rotas que atendentes (WhatsApp) podem acessar
const ATENDENTE_ROUTES = ['/whatsapp-app', '/login-atendente', '/api/']

// Rotas do APP (subdomínio app.*)
const ROTAS_APP = [
  '/dashboard', '/agenda', '/pacientes', '/historico', '/nova-consulta',
  '/teleconsulta', '/sala', '/exames', '/whatsapp', '/whatsapp-app',
  '/admin', '/clinica', '/perfil', '/onboarding',
  '/login', '/login-atendente', '/cadastro',
  '/esqueci-senha', '/trocar-senha-obrigatoria', '/auth',
  '/portal', '/design-system', '/financeiro', '/financeiro-premium', '/estoque', '/crm',
]

// Rotas de MARKETING (domínio raiz)
const ROTAS_MARKETING = [
  '/', '/sobre', '/precos', '/blog', '/contato',
  '/privacidade', '/termos', '/lgpd',
]

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // ===== PARTE 1: lógica de atendente (mantida) =====
  const isAtendente = req.cookies.get('is_atendente')?.value === 'true'
  if (isAtendente) {
    const permitido = ATENDENTE_ROUTES.some(r => pathname.startsWith(r))
    if (!permitido && pathname !== '/') {
      return NextResponse.redirect(new URL('/whatsapp-app', req.url))
    }
  }

  // ===== PARTE 2: separação landing/app por subdomínio =====
  const url = req.nextUrl.clone()
  const hostname = req.headers.get('host') || ''

  // Ignora API/static
  if (pathname.startsWith('/api') || pathname.startsWith('/_next')) {
    return NextResponse.next()
  }

  const ehLocalhost = hostname.includes('localhost') || hostname.includes('127.0.0.1')
  const ehVercelDefault = hostname.includes('vercel.app')
  const dominioPrincipal = process.env.NEXT_PUBLIC_DOMINIO_PRINCIPAL
  const ehDominioConfigurado = !!dominioPrincipal && hostname.endsWith(dominioPrincipal)

  // Modo dev / sem domínio: libera tudo
  if (ehLocalhost || ehVercelDefault || !ehDominioConfigurado) {
    return NextResponse.next()
  }

  // Domínio configurado: aplica regras
  const ehSubdominoApp = hostname.startsWith('app.')
  const ehDominioRaiz = hostname === dominioPrincipal || hostname === `www.${dominioPrincipal}`

  // Rota de APP em domínio raiz → vai pra app.*
  if (ehDominioRaiz && ROTAS_APP.some(r => pathname === r || pathname.startsWith(r + '/'))) {
    url.host = `app.${dominioPrincipal}`
    return NextResponse.redirect(url, 308)
  }

  // Rota de MARKETING em app.* → vai pro raiz (com exceção do "/")
  if (ehSubdominoApp && ROTAS_MARKETING.some(r => pathname === r)) {
    if (pathname === '/') {
      url.pathname = '/login'
      return NextResponse.redirect(url, 308)
    }
    url.host = dominioPrincipal
    return NextResponse.redirect(url, 308)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)']
}
