import { NextRequest, NextResponse } from 'next/server'
import { log } from '@/lib/logger'
import { validarFormatoSlug, checarDisponibilidadeSlug, sugerirAlternativaSlug } from '@/lib/agenda-publica/slug'

export async function POST(req: NextRequest) {
  try {
    const { slug, tipo, id } = await req.json()
    
    const formato = validarFormatoSlug(slug)
    if (!formato.valido) {
      return NextResponse.json({ disponivel: false, erro: formato.erro })
    }

    const { disponivel, ocupadoPor } = await checarDisponibilidadeSlug(
      slug,
      tipo === 'medico' || tipo === 'clinica' ? tipo : undefined,
      id
    )

    if (disponivel) {
      return NextResponse.json({ disponivel: true })
    }

    const sugestao = await sugerirAlternativaSlug(slug)
    const ocupadoPorLabel = ocupadoPor === 'medico' ? 'outro médico' : 'uma clínica'
    return NextResponse.json({
      disponivel: false,
      erro: 'Esse link já está sendo usado por ' + ocupadoPorLabel,
      sugestao
    })
  } catch (e: any) {
    log.error('[check-slug]', e?.message)
    return NextResponse.json({ disponivel: false, erro: 'Não foi possível conferir este endereço agora. Tente de novo.' }, { status: 500 })
  }
}
