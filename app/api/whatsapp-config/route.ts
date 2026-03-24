import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const medicoId = req.nextUrl.searchParams.get('medico_id')
  if (!medicoId) return NextResponse.json({ error: 'medico_id required' }, { status: 400 })
  const { data } = await supabase.from('whatsapp_config').select('id, phone_number_id, phone_number, nome_exibicao, ativo, criado_em').eq('medico_id', medicoId).single()
  return NextResponse.json({ config: data })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { medico_id, phone_number_id, access_token, phone_number, nome_exibicao } = body
    if (!medico_id || !phone_number_id || !access_token) return NextResponse.json({ error: 'Campos obrigatorios faltando' }, { status: 400 })

    // Valida o token e phone_id na Meta API
    const validacao = await fetch('https://graph.facebook.com/v20.0/' + phone_number_id + '?fields=display_phone_number,verified_name', {
      headers: { 'Authorization': 'Bearer ' + access_token }
    })
    const dadosMeta = await validacao.json()
    if (dadosMeta.error) return NextResponse.json({ error: 'Token ou Phone ID invalido: ' + dadosMeta.error.message }, { status: 400 })

    const phoneReal = dadosMeta.display_phone_number || phone_number
    const nomeReal = dadosMeta.verified_name || nome_exibicao

    // Upsert na config
    const { data, error } = await supabase.from('whatsapp_config').upsert({
      medico_id, phone_number_id, access_token,
      phone_number: phoneReal, nome_exibicao: nomeReal, ativo: true,
      atualizado_em: new Date().toISOString()
    }, { onConflict: 'medico_id' }).select('id, phone_number_id, phone_number, nome_exibicao, ativo').single()

    if (error) throw error
    return NextResponse.json({ config: data, meta: { phone: phoneReal, nome: nomeReal } })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const medicoId = req.nextUrl.searchParams.get('medico_id')
  if (!medicoId) return NextResponse.json({ error: 'medico_id required' }, { status: 400 })
  await supabase.from('whatsapp_config').delete().eq('medico_id', medicoId)
  return NextResponse.json({ ok: true })
}
