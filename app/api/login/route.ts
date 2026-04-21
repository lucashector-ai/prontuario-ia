import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { email, senha } = await req.json()

    if (!email || !senha) {
      return NextResponse.json({ error: 'Email e senha são obrigatórios' }, { status: 400 })
    }

    const emailNorm = email.trim().toLowerCase()

    // 1. Tenta encontrar em clinica_admins
    const { data: admin } = await supabase
      .from('clinica_admins')
      .select('id, email, senha_hash, nome, role, clinica_id, ativo')
      .eq('email', emailNorm)
      .maybeSingle()

    if (admin) {
      if (!admin.ativo) {
        return NextResponse.json({ error: 'Conta desativada' }, { status: 403 })
      }
      const ok = await bcrypt.compare(senha, admin.senha_hash)
      if (!ok) {
        return NextResponse.json({ error: 'Senha incorreta' }, { status: 401 })
      }

      // Busca dados da clínica
      const { data: clinica } = await supabase
        .from('clinicas')
        .select('id, nome, tipo, email, telefone')
        .eq('id', admin.clinica_id)
        .single()

      return NextResponse.json({
        ok: true,
        tipo: 'clinica',
        clinica,
        admin: {
          id: admin.id,
          email: admin.email,
          nome: admin.nome,
          role: admin.role,
          clinica_id: admin.clinica_id,
        },
      })
    }

    // 2. Tenta encontrar em medicos
    const { data: medico } = await supabase
      .from('medicos')
      .select('*')
      .eq('email', emailNorm)
      .maybeSingle()

    if (medico) {
      if (!medico.ativo) {
        return NextResponse.json({ error: 'Conta desativada. Procure o administrador.' }, { status: 403 })
      }

      // A senha do médico pode estar em formato texto ou hash bcrypt
      let senhaOk = false
      if (medico.senha && medico.senha.startsWith('$2')) {
        // hash bcrypt
        senhaOk = await bcrypt.compare(senha, medico.senha)
      } else if (medico.senha === senha) {
        // texto puro (dados legados)
        senhaOk = true
      }

      if (!senhaOk) {
        return NextResponse.json({ error: 'Senha incorreta' }, { status: 401 })
      }

      // Busca clínica pra saber o tipo
      const { data: clinica } = await supabase
        .from('clinicas')
        .select('id, nome, tipo')
        .eq('id', medico.clinica_id)
        .single()

      return NextResponse.json({
        ok: true,
        tipo: 'medico',
        medico: { ...medico, senha: undefined, senha_hash: undefined },
        clinica,
      })
    }

    return NextResponse.json({ error: 'Email não encontrado' }, { status: 404 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
