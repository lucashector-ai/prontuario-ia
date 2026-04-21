import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { clinica, admin, medicos } = body

    // Validações básicas
    if (!clinica?.nome || !clinica?.email) {
      return NextResponse.json({ error: 'Nome e email da clínica são obrigatórios' }, { status: 400 })
    }
    if (!admin?.email || !admin?.senha || admin.senha.length < 6) {
      return NextResponse.json({ error: 'Admin precisa de email e senha (min 6 caracteres)' }, { status: 400 })
    }

    // Verifica se email da clínica já existe
    const { data: clinicaExistente } = await supabase
      .from('clinicas').select('id').eq('email', clinica.email).maybeSingle()
    if (clinicaExistente) {
      return NextResponse.json({ error: 'Email da clínica já cadastrado' }, { status: 400 })
    }

    // Verifica se email do admin já existe
    const { data: adminExistente } = await supabase
      .from('clinica_admins').select('id').eq('email', admin.email).maybeSingle()
    if (adminExistente) {
      return NextResponse.json({ error: 'Email do admin já está em uso' }, { status: 400 })
    }

    // 1. Cria a clínica
    const { data: novaClinica, error: errC } = await supabase
      .from('clinicas')
      .insert({
        nome: clinica.nome,
        email: clinica.email,
        telefone: clinica.telefone || null,
        tipo: 'clinica',
      })
      .select()
      .single()

    if (errC) return NextResponse.json({ error: errC.message }, { status: 500 })

    // 2. Cria o admin (owner) da clínica
    const senhaHash = await bcrypt.hash(admin.senha, 10)
    const { error: errA } = await supabase
      .from('clinica_admins')
      .insert({
        clinica_id: novaClinica.id,
        email: admin.email,
        senha_hash: senhaHash,
        nome: admin.nome || clinica.nome,
        role: 'owner',
      })

    if (errA) return NextResponse.json({ error: errA.message }, { status: 500 })

    // 3. Cria os médicos da clínica (se houver)
    const medicosCriados: any[] = []
    if (medicos && Array.isArray(medicos)) {
      for (const m of medicos) {
        if (!m.nome || !m.email || !m.senha) continue
        const senhaMedHash = await bcrypt.hash(m.senha, 10)
        const { data: novoMedico, error: errM } = await supabase
          .from('medicos')
          .insert({
            clinica_id: novaClinica.id,
            nome: m.nome,
            email: m.email,
            senha: senhaMedHash,
            crm: m.crm || null,
            especialidade: m.especialidade || null,
            cargo: 'medico',
            ativo: true,
          })
          .select()
          .single()
        if (!errM && novoMedico) medicosCriados.push(novoMedico)
      }
    }

    return NextResponse.json({
      ok: true,
      clinica: novaClinica,
      medicos_criados: medicosCriados.length,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
