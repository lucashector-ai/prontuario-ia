import { NextRequest, NextResponse } from 'next/server'
import { supabaseServidor as db } from '@/lib/servidor'

/** Perfil público da agenda online: só os campos que o paciente precisa ver. */
export async function GET(req: NextRequest) {
  const medicoSlug = req.nextUrl.searchParams.get('medico')
  const clinicaSlug = req.nextUrl.searchParams.get('clinica')
  if (!medicoSlug) return NextResponse.json({ error: 'Médico não encontrado.' }, { status: 404 })

  const { data: medico } = await db.from('medicos')
    .select('id, nome, especialidade, crm, foto_url, clinica_id, agenda_publica_ativa, agenda_publica_config')
    .eq('slug_publico', medicoSlug).maybeSingle()
  if (!medico) return NextResponse.json({ error: 'Médico não encontrado.' }, { status: 404 })
  if (!medico.agenda_publica_ativa) return NextResponse.json({ error: 'Esse médico ainda não ativou a agenda pública.' }, { status: 403 })

  let clinica: { id: string; nome: string; logo_url: string | null } | null = null
  if (clinicaSlug) {
    const { data } = await db.from('clinicas').select('id, nome, logo_url').eq('slug_publico', clinicaSlug).maybeSingle()
    if (data && data.id === medico.clinica_id) clinica = data
  } else if (medico.clinica_id) {
    const { data } = await db.from('clinicas').select('id, nome, logo_url').eq('id', medico.clinica_id).maybeSingle()
    clinica = data
  }
  return NextResponse.json({ medico, clinica })
}
