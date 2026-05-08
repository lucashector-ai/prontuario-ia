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
    const { prescricao_id_memed, dados_memed } = body

    if (!prescricao_id_memed) {
      return NextResponse.json({ error: 'prescricao_id_memed obrigatorio' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('prescricoes')
      .update({ 
        excluida: true, 
        excluida_em: new Date().toISOString(),
        dados_exclusao: dados_memed || null,
      })
      .eq('prescricao_id_memed', prescricao_id_memed)
      .select()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, atualizadas: data?.length || 0 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
