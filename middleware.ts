import { NextRequest, NextResponse } from 'next/server'

// Rotas que atendentes (equipe de atendimento do Chat) podem acessar
const ATENDENTE_ROUTES = ['/chat', '/login-atendente', '/api/']

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Ignora API/static
  if (pathname.startsWith('/api') || pathname.startsWith('/_next')) {
    return NextResponse.next()
  }

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
