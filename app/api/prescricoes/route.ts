import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// POST /api/prescricoes — salva prescrição vinda do callback Memed
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { paciente_id, medico_id, clinica_id, dados_memed } = body

    if (!paciente_id || !medico_id) {
      return NextResponse.json({ error: 'paciente_id e medico_id sao obrigatorios' }, { status: 400 })
    }

    // Extrai ID Memed e UUID da prescricao
    // Estrutura: { alterada, prescricao: { id, prescriptionUuid, documents[], medicamentos[], ... }, reimpressao }
    const presc = dados_memed?.prescricao || dados_memed || {}
    const prescricao_id_memed = presc.prescriptionUuid || (presc.id ? String(presc.id) : null)
    
    // Memed nao retorna URL publica do PDF no evento. 
    // O PDF precisa ser obtido via API server-side da Memed usando o prescriptionUuid.
    // Por enquanto salvamos null - lista mostra "PDF nao disponivel" e usuario pode reabrir Memed pra ver/imprimir.
    const pdf_url = presc.url_pdf || presc.pdf_url || null

    const { data, error } = await supabase
      .from('prescricoes')
      .insert({
        paciente_id,
        medico_id,
        clinica_id: clinica_id || null,
        prescricao_id_memed,
        dados_memed: dados_memed || null,
        pdf_url,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ prescricao: data })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// GET /api/prescricoes?paciente_id=xxx — lista prescrições de um paciente
export async function GET(req: NextRequest) {
  try {
    const pacienteId = req.nextUrl.searchParams.get('paciente_id')
    if (!pacienteId) {
      return NextResponse.json({ error: 'paciente_id é obrigatório' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('prescricoes')
      .select('*, medicos:medico_id(nome, crm, especialidade)')
      .eq('paciente_id', pacienteId)
      .order('criado_em', { ascending: false })
      .limit(100)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ prescricoes: data || [] })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
