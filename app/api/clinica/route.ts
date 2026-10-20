import { NextRequest, NextResponse } from "next/server"
import { supabaseServidor as supabase } from "@/lib/servidor"
import { contextoDaRequisicao, medicoDaClinica, naoAutenticado, proibido } from "@/lib/acesso"
import bcrypt from "bcryptjs"

const senhaEhForte = (s: string) => s.length >= 8 && /[A-Z]/.test(s) && /[a-z]/.test(s) && /[0-9]/.test(s)

// Equipe da clínica — sempre a clínica da SESSÃO (o clinica_id da URL/corpo é ignorado)
async function gestor(req: NextRequest) {
  const ctx = await contextoDaRequisicao(req)
  if (!ctx) return { erro: naoAutenticado() }
  if (!ctx.gestor || !ctx.clinica_id) return { erro: proibido('Só o administrador da clínica gerencia a equipe') }
  return { clinicaId: ctx.clinica_id }
}

// GET - busca médicos da clínica
export async function GET(req: NextRequest) {
  const g = await gestor(req); if (g.erro) return g.erro
  const [{ data: medicos }, { data: clinica }] = await Promise.all([
    supabase.from("medicos").select("id, nome, email, especialidade, crm, cargo, ativo, criado_em").eq("clinica_id", g.clinicaId).order("criado_em"),
    supabase.from("clinicas").select("*, planos(*)").eq("id", g.clinicaId).single(),
  ])
  return NextResponse.json({ medicos: medicos || [], clinica })
}

// POST - adiciona médico à clínica (senha obrigatória e forte — não existe mais senha padrão)
export async function POST(req: NextRequest) {
  try {
    const g = await gestor(req); if (g.erro) return g.erro
    const { nome, email, especialidade, crm, senha, cargo } = await req.json()
    if (!nome || !email) return NextResponse.json({ error: "Nome e email são obrigatórios" }, { status: 400 })
    if (!senhaEhForte(senha || '')) return NextResponse.json({ error: "Senha fraca: use 8+ caracteres com maiúscula, minúscula e número" }, { status: 400 })

    const { data: clinica } = await supabase.from("clinicas").select("*, planos(max_medicos)").eq("id", g.clinicaId).single()
    const { count: totalMedicos } = await supabase.from("medicos").select("*", { count: "exact", head: true }).eq("clinica_id", g.clinicaId).eq("ativo", true)
    const maxMedicos = (clinica as any)?.planos?.max_medicos || 3
    if ((totalMedicos || 0) >= maxMedicos) return NextResponse.json({ error: `Limite de ${maxMedicos} médicos atingido para o plano atual` }, { status: 403 })

    const emailNorm = String(email).trim().toLowerCase()
    const { data: existe } = await supabase.from("medicos").select("id").eq("email", emailNorm).limit(1).maybeSingle()
    if (existe) return NextResponse.json({ error: "Email já cadastrado" }, { status: 400 })

    const hash = await bcrypt.hash(senha, 10)
    const { data: medico, error } = await supabase
      .from("medicos")
      .insert({ nome, email: emailNorm, especialidade, crm, senha_hash: hash, ativo: true, clinica_id: g.clinicaId, cargo: cargo === 'recepcionista' ? 'recepcionista' : 'medico' })
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
  const g = await gestor(req); if (g.erro) return g.erro
  const { medico_id, ativo } = await req.json()
  if (!(await medicoDaClinica(medico_id, g.clinicaId!))) return proibido('Pessoa não encontrada nesta clínica')
  await supabase.from("medicos").update({ ativo: !!ativo }).eq("id", medico_id).eq("clinica_id", g.clinicaId)
  return NextResponse.json({ ok: true })
}

// DELETE - remove médico da clínica
export async function DELETE(req: NextRequest) {
  const g = await gestor(req); if (g.erro) return g.erro
  const medicoId = req.nextUrl.searchParams.get("medico_id")
  if (!medicoId) return NextResponse.json({ error: "medico_id obrigatório" }, { status: 400 })
  if (!(await medicoDaClinica(medicoId, g.clinicaId!))) return proibido('Pessoa não encontrada nesta clínica')
  await supabase.from("medicos").delete().eq("id", medicoId).eq("clinica_id", g.clinicaId)
  return NextResponse.json({ ok: true })
}
