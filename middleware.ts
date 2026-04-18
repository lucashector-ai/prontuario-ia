import { NextRequest, NextResponse } from 'next/server'

// Rotas que atendentes podem acessar
const ATENDENTE_ROUTES = ['/whatsapp-app', '/login-atendente', '/api/']

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Pega o cookie de sessão (vamos usar cookie além do localStorage)
  const isAtendente = req.cookies.get('is_atendente')?.value === 'true'

  if (isAtendente) {
    // Atendente tentando acessar rota proibida
    const permitido = ATENDENTE_ROUTES.some(r => pathname.startsWith(r))
    if (!permitido && pathname !== '/') {
      return NextResponse.redirect(new URL('/whatsapp-app', req.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)']
}
