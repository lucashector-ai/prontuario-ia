import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(req: NextRequest) {
  const { medico_id } = await req.json()
  if (!medico_id) return NextResponse.json({ error: 'medico_id required' }, { status: 400 })

  const token = process.env.WHATSAPP_TOKEN || ''
  const phone_number_id = process.env.WHATSAPP_PHONE_ID || '1030374870164992'

  const { data, error } = await supabase.from('whatsapp_config').upsert({
    medico_id,
    phone_number_id,
    access_token: token,
    token: token,
    nome_exibicao: 'Clínica',
    ativo: true,
    atualizado_em: new Date().toISOString()
  }, { onConflict: 'medico_id' }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, phone_number_id, tem_token: !!token })
}
