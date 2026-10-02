import { NextRequest, NextResponse } from 'next/server'
import { escopoCanais } from '@/lib/meta/escopo'
import { criarEstado, instagramConfigurado, urlLoginInstagram } from '@/lib/meta/instagram'

/** Leva a pessoa para o login oficial do Instagram (volta em /callback). */
export async function GET(req: NextRequest) {
  const voltar = new URL('/minha-clinica?aba=canais', req.nextUrl.origin)
  if (!instagramConfigurado()) {
    voltar.searchParams.set('erro', 'Login do Instagram ainda não configurado no servidor')
    return NextResponse.redirect(voltar)
  }
  const e = await escopoCanais(req, req.nextUrl.searchParams.get('medico_id'))
  if (!e?.medicoId) return NextResponse.redirect(new URL('/login?expirou=1', req.nextUrl.origin))
  const redirectUri = `${req.nextUrl.origin}/api/canais/instagram/callback`
  return NextResponse.redirect(urlLoginInstagram(redirectUri, criarEstado({ medicoId: e.medicoId, clinicaId: e.clinicaId })))
}
