import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// POST /api/prescricoes/excluir — marca prescricao como excluida (Memed compliance)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { prescricao_id_memed, prescricao_id_numerico, dados_memed } = body

    if (!prescricao_id_memed && !prescricao_id_numerico) {
      return NextResponse.json({ error: 'prescricao_id_memed ou prescricao_id_numerico obrigatorio' }, { status: 400 })
    }

    // Tenta buscar primeiro pelo id numerico (vem do evento prescricaoExcluida)
    // depois pelo UUID (caso seja outro fluxo)
    const idParaBuscar = prescricao_id_numerico || prescricao_id_memed
    const colunaParaBuscar = prescricao_id_numerico ? 'prescricao_id_numerico' : 'prescricao_id_memed'

    const { data, error } = await supabase
      .from('prescricoes')
      .update({ 
        excluida: true, 
        excluida_em: new Date().toISOString(),
        dados_exclusao: dados_memed || null,
      })
      .eq(colunaParaBuscar, String(idParaBuscar))
      .select()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, atualizadas: data?.length || 0 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
