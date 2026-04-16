
import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import bcrypt from "bcryptjs"

// GET - busca médicos da clínica
export async function GET(req: NextRequest) {
  const clinicaId = req.nextUrl.searchParams.get("clinica_id")
  if (!clinicaId) return NextResponse.json({ error: "clinica_id obrigatório" }, { status: 400 })

  const [{ data: medicos }, { data: clinica }] = await Promise.all([
    supabase.from("medicos").select("id, nome, email, especialidade, crm, cargo, ativo, criado_em").eq("clinica_id", clinicaId).order("criado_em"),
    supabase.from("clinicas").select("*, planos(*)").eq("id", clinicaId).single(),
  ])

  return NextResponse.json({ medicos: medicos || [], clinica })
}

// POST - adiciona médico à clínica
export async function POST(req: NextRequest) {
  try {
    const { clinica_id, nome, email, especialidade, crm, senha } = await req.json()
    
    // Verifica limite do plano
    const { data: clinica } = await supabase.from("clinicas").select("*, planos(max_medicos)").eq("id", clinica_id).single()
    const { count: totalMedicos } = await supabase.from("medicos").select("*", { count: "exact", head: true }).eq("clinica_id", clinica_id).eq("ativo", true)
    
    const maxMedicos = (clinica as any)?.planos?.max_medicos || 3
    if ((totalMedicos || 0) >= maxMedicos) return NextResponse.json({ error: `Limite de ${maxMedicos} médicos atingido para o plano atual` }, { status: 403 })

    const { data: existe } = await supabase.from("medicos").select("id").eq("email", email).single()
    if (existe) return NextResponse.json({ error: "E-mail já cadastrado" }, { status: 400 })

    const hash = await bcrypt.hash(senha || "medIA@2026", 10)
    const { data: medico, error } = await supabase
      .from("medicos")
      .insert({ nome, email, especialidade, crm, senha_hash: hash, ativo: true, clinica_id, cargo: "medico" })
      .select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const { senha_hash, ...sem } = medico as any
    return NextResponse.json({ medico: sem })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// PATCH - ativa/desativa médico
export async function PATCH(req: NextRequest) {
  const { medico_id, ativo } = await req.json()
  await supabase.from("medicos").update({ ativo }).eq("id", medico_id)
  return NextResponse.json({ ok: true })
}

// DELETE - remove médico da clínica
export async function DELETE(req: NextRequest) {
  const medicoId = req.nextUrl.searchParams.get("medico_id")
  if (!medicoId) return NextResponse.json({ error: "medico_id obrigatório" }, { status: 400 })
  await supabase.from("medicos").delete().eq("id", medicoId)
  return NextResponse.json({ ok: true })
}
