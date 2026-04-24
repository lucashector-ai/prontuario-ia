import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import bcrypt from "bcryptjs"

// Gera senha aleatória com maiúscula, minúscula, número e símbolo
function gerarSenhaProvisoria(): string {
  const maiusculas = 'ABCDEFGHJKLMNPQRSTUVWXYZ' // sem I/O pra evitar confusão
  const minusculas = 'abcdefghjkmnpqrstuvwxyz'  // sem i/l/o
  const numeros = '23456789' // sem 0/1
  const simbolos = '!@#$%&*'
  const all = maiusculas + minusculas + numeros + simbolos

  const pick = (set: string) => set[Math.floor(Math.random() * set.length)]

  // Garante pelo menos 1 de cada
  let s = [
    pick(maiusculas),
    pick(minusculas),
    pick(numeros),
    pick(simbolos),
  ]
  // Preenche até 12 caracteres
  for (let i = 0; i < 8; i++) s.push(pick(all))
  // Embaralha
  return s.sort(() => Math.random() - 0.5).join('')
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { nome, crm, especialidade, email, senha, nome_clinica, clinica_id, cargo: cargoBody, cor } = body
    const cargoFinal = cargoBody === 'recepcionista' ? 'recepcionista' : 'medico'

    if (!nome || !email) {
      return NextResponse.json({ error: "Nome e email são obrigatórios" }, { status: 400 })
    }

    const emailNorm = email.trim().toLowerCase()

    const { data: existe } = await supabase
      .from("medicos").select("id").eq("email", emailNorm).maybeSingle()
    if (existe) {
      return NextResponse.json({ error: "E-mail já cadastrado" }, { status: 400 })
    }

    // CASO 1: clinica já existe, adição de médico pela clínica → gera senha provisória
    if (clinica_id) {
      const senhaProvisoria = gerarSenhaProvisoria()
      const hash = await bcrypt.hash(senhaProvisoria, 10)

      const { data: medico, error } = await supabase
        .from("medicos")
        .insert({
          nome,
          crm: crm || null,
          especialidade: especialidade || null,
          email: emailNorm,
          senha_hash: hash,
          senha_provisoria: true,
          ativo: true,
          clinica_id,
          cargo: cargoFinal,
          verificado: true,
          cor: cor || '#6043C1',
        })
        .select()
        .single()

      if (error || !medico) {
        return NextResponse.json({ error: error?.message || "Erro ao criar médico" }, { status: 500 })
      }

      const { senha_hash, ...medicoSemSenha } = medico as any
      return NextResponse.json({
        medico: medicoSemSenha,
        senha_provisoria_gerada: senhaProvisoria, // frontend mostra pra clínica copiar
      })
    }

    // CASO 2: cadastro inicial da clínica (fluxo antigo mantido)
    if (!senha) {
      return NextResponse.json({ error: "Senha é obrigatória no cadastro inicial" }, { status: 400 })
    }

    const hash = await bcrypt.hash(senha, 10)

    const { data: clinica, error: errClinica } = await supabase
      .from("clinicas")
      .insert({ nome: nome_clinica || `Clínica ${nome}` })
      .select().single()

    if (errClinica || !clinica) {
      return NextResponse.json({ error: "Erro ao criar clínica" }, { status: 500 })
    }

    const { data: medico, error } = await supabase
      .from("medicos")
      .insert({
        nome,
        crm: crm || null,
        especialidade: especialidade || null,
        email: emailNorm,
        senha_hash: hash,
        ativo: true,
        clinica_id: clinica.id,
        cargo: "admin",
        verificado: true,
      })
      .select().single()

    if (error || !medico) {
      return NextResponse.json({ error: error?.message || "Erro ao criar médico" }, { status: 500 })
    }

    const { senha_hash, ...medicoSemSenha } = medico as any
    return NextResponse.json({ medico: medicoSemSenha })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
