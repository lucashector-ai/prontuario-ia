import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

export async function POST(req: Request) {
  try {
    const { email, token } = await req.json()
    if (!email || !token) {
      return NextResponse.json({ error: 'Faltam dados.' }, { status: 400 })
    }

    const sb = adminClient()

    const { data: pp } = await sb
      .from('pacientes_portal')
      .select('id, paciente_id, email, magic_link_token, magic_link_expira_em')
      .eq('email', String(email).trim().toLowerCase())
      .maybeSingle()

    if (!pp) {
      return NextResponse.json({ error: 'Email não encontrado.' }, { status: 404 })
    }
    if (pp.magic_link_token !== String(token).trim()) {
      return NextResponse.json({ error: 'Código inválido.' }, { status: 401 })
    }
    if (pp.magic_link_expira_em && new Date(pp.magic_link_expira_em).getTime() < Date.now()) {
      return NextResponse.json({ error: 'Código expirado. Solicite outro.' }, { status: 401 })
    }

    // limpa token + registra visita
    await sb
      .from('pacientes_portal')
      .update({
        magic_link_token: null,
        magic_link_expira_em: null,
        ultima_visita: new Date().toISOString(),
      })
      .eq('id', pp.id)

    // tenta puxar o nome do paciente pra exibir no portal
    let nome: string | undefined
    const { data: paciente } = await sb
      .from('pacientes')
      .select('nome')
      .eq('id', pp.paciente_id)
      .maybeSingle()
    if (paciente?.nome) nome = paciente.nome

    return NextResponse.json({
      session: {
        email: pp.email,
        pacienteId: pp.paciente_id,
        pacientePortalId: pp.id,
        nome,
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Erro inesperado.' }, { status: 500 })
  }
}
