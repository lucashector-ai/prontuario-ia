
import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import bcrypt from "bcryptjs"

export async function POST(req: NextRequest) {
  try {
    const { nome, crm, especialidade, email, senha, nome_clinica } = await req.json()
    if (!nome || !email || !senha) return NextResponse.json({ error: "Campos obrigatórios faltando" }, { status: 400 })

    const { data: existe } = await supabase.from("medicos").select("id").eq("email", email).single()
    if (existe) return NextResponse.json({ error: "E-mail já cadastrado" }, { status: 400 })

    const hash = await bcrypt.hash(senha, 10)

    // Cria a clínica primeiro
    const { data: clinica, error: errClinica } = await supabase
      .from("clinicas")
      .insert({ nome: nome_clinica || `Clínica ${nome}`, plano_id: "starter" })
      .select().single()

    if (errClinica || !clinica) return NextResponse.json({ error: "Erro ao criar clínica" }, { status: 500 })

    // Cria o médico como admin da clínica
    const { data: medico, error } = await supabase
      .from("medicos")
      .insert({ nome, crm, especialidade, email, senha_hash: hash, ativo: true, clinica_id: clinica.id, cargo: "admin" })
      .select().single()

    if (error || !medico) return NextResponse.json({ error: error?.message || "Erro ao criar médico" }, { status: 500 })

    const { senha_hash, ...medicoSemSenha } = medico as any
    return NextResponse.json({ medico: medicoSemSenha })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
