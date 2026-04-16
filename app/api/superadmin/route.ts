import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'media_superadmin_2026'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const { token, action, medico_id, clinica_id, plano } = await req.json()
  if (token !== ADMIN_TOKEN) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  if (action === 'stats') {
    const [
      { count: totalMedicos },
      { count: totalClinicas },
      { count: totalConsultas },
      { count: totalPacientes },
      { data: medicosPorPlano },
      { data: ultimosCadastros },
    ] = await Promise.all([
      supabaseAdmin.from('medicos').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('clinicas').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('consultas').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('pacientes').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('medicos').select('id').limit(1).then(() => ({ data: [] })) as any,
      supabaseAdmin.from('medicos').select('id, nome, email, criado_em, cargo').order('criado_em', { ascending: false }).limit(10),
    ])
    const planoMap: Record<string, number> = {}
    medicosPorPlano?.forEach((c: any) => { planoMap[c.plano] = (planoMap[c.plano] || 0) + 1 })
    return NextResponse.json({ totalMedicos, totalClinicas, totalConsultas, totalPacientes, planoMap, ultimosCadastros })
  }

  if (action === 'list_clinicas') {
    const { data } = await supabaseAdmin
      .from('clinicas')
      .select('id, nome, plano, criado_em, ativo, email_admin')
      .order('criado_em', { ascending: false })
    const clinicasComStats = await Promise.all((data || []).map(async (cl: any) => {
      const [{ count: medicos }, { count: consultas }] = await Promise.all([
        supabaseAdmin.from('medicos').select('*', { count: 'exact', head: true }).eq('clinica_id', cl.id),
        supabaseAdmin.from('consultas').select('*', { count: 'exact', head: true }).eq('medico_id', cl.id),
      ])
      return { ...cl, medicos, consultas }
    }))
    return NextResponse.json({ clinicas: clinicasComStats })
  }

  if (action === 'list_medicos') {
    const { data } = await supabaseAdmin
      .from('medicos')
      .select('id, nome, email, crm, especialidade, cargo, ativo, criado_em, clinica_id')
      .order('criado_em', { ascending: false })
    return NextResponse.json({ medicos: data || [] })
  }

  if (action === 'delete_medico') {
    if (!medico_id) return NextResponse.json({ error: 'medico_id obrigatório' }, { status: 400 })
    await Promise.all([
      supabaseAdmin.from('consultas').delete().eq('medico_id', medico_id),
      supabaseAdmin.from('pacientes').delete().eq('medico_id', medico_id),
      supabaseAdmin.from('agendamentos').delete().eq('medico_id', medico_id),
    ])
    await supabaseAdmin.from('medicos').delete().eq('id', medico_id)
    return NextResponse.json({ ok: true })
  }

  if (action === 'delete_clinica') {
    if (!clinica_id) return NextResponse.json({ error: 'clinica_id obrigatório' }, { status: 400 })
    const { data: medicos } = await supabaseAdmin.from('medicos').select('id').eq('clinica_id', clinica_id)
    for (const m of medicos || []) {
      await Promise.all([
        supabaseAdmin.from('consultas').delete().eq('medico_id', m.id),
        supabaseAdmin.from('pacientes').delete().eq('medico_id', m.id),
        supabaseAdmin.from('agendamentos').delete().eq('medico_id', m.id),
      ])
      await supabaseAdmin.from('medicos').delete().eq('id', m.id)
    }
    await supabaseAdmin.from('clinicas').delete().eq('id', clinica_id)
    return NextResponse.json({ ok: true })
  }

  if (action === 'change_plano') {
    if (!clinica_id || !plano) return NextResponse.json({ error: 'clinica_id e plano obrigatórios' }, { status: 400 })
    await supabaseAdmin.from('clinicas').update({ plano }).eq('id', clinica_id)
    return NextResponse.json({ ok: true })
  }

  if (action === 'toggle_ativo') {
    if (!clinica_id) return NextResponse.json({ error: 'clinica_id obrigatório' }, { status: 400 })
    const { data } = await supabaseAdmin.from('clinicas').select('ativo').eq('id', clinica_id).single()
    await supabaseAdmin.from('clinicas').update({ ativo: !(data as any)?.ativo }).eq('id', clinica_id)
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Ação desconhecida' }, { status: 400 })
}
