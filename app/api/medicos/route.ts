import { NextRequest, NextResponse } from "next/server"
import { supabaseServidor as supabase } from "@/lib/servidor"
import { contextoDaRequisicao, naoAutenticado, proibido } from "@/lib/acesso"
import { ehGratis } from "@/lib/planos"
import { planoDaClinica } from "@/lib/planos-servidor"
import bcrypt from "bcryptjs"

// Gera senha aleatória com maiúscula, minúscula, número e símbolo
function gerarSenhaProvisoria(): string {
  const maiusculas = 'ABCDEFGHJKLMNPQRSTUVWXYZ' // sem I/O pra evitar confusão
  const minusculas = 'abcdefghjkmnpqrstuvwxyz'  // sem i/l/o
  const numeros = '23456789' // sem 0/1
  const simbolos = '!@#$%&*'
  const all = maiusculas + minusculas + numeros + simbolos

  // Sorteio criptográfico (Math.random é previsível)
  const pick = (set: string) => set[crypto.getRandomValues(new Uint32Array(1))[0] % set.length]

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
    // Só o gestor cadastra gente, e sempre na clínica da própria sessão (nunca a do corpo)
    const ctx = await contextoDaRequisicao(req)
    if (!ctx) return naoAutenticado()
    if (!ctx.gestor || !ctx.clinica_id) return proibido('Só o administrador da clínica cadastra a equipe')
    const clinica_id = ctx.clinica_id
    if (ehGratis(await planoDaClinica(clinica_id))) return proibido('O plano Grátis é para quem atende sozinho. Para cadastrar a equipe, passe para um plano completo.')

    const body = await req.json()
    const { nome, crm, especialidade, email, cargo: cargoBody, cor, comissao_tipo, comissao_valor, comissao_base, cpf, data_nascimento } = body
    const cargoFinal = cargoBody === 'recepcionista' || cargoBody === 'enfermagem' ? cargoBody : 'medico'

    if (!nome || !email) {
      return NextResponse.json({ error: "Nome e email são obrigatórios" }, { status: 400 })
    }

    const emailNorm = email.trim().toLowerCase()

    const { data: existe } = await supabase
      .from("medicos").select("id").eq("email", emailNorm).maybeSingle()
    if (existe) {
      return NextResponse.json({ error: "Email já cadastrado" }, { status: 400 })
    }

    // Adição de médico/recepção pela clínica → gera senha provisória
    {
      const senhaProvisoria = gerarSenhaProvisoria()
      const tokenConvite = Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('')
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
          // Convite por link (/convite/<token>), vale 7 dias — a senha provisória continua como alternativa
          token_verificacao: tokenConvite,
          token_expira_em: new Date(Date.now() + 7 * 24 * 3600e3).toISOString(),
          ativo: true,
          clinica_id,
          cargo: cargoFinal,
          verificado: true,
          cor: cor || '#6043C1',
          comissao_tipo: comissao_tipo || 'sem',
          comissao_valor: comissao_valor || null,
          comissao_base: comissao_base || 'receita',
          cpf: cpf || null,
          data_nascimento: data_nascimento || null,
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
        convite_token: tokenConvite,
      })
    }

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
