
import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import Anthropic from "@anthropic-ai/sdk"

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { paciente_id, medico_id, prontuario_atual } = await req.json()
    if (!paciente_id || !prontuario_atual) return NextResponse.json({ insights: [] })

    const { data: consultas } = await supabase
      .from("consultas")
      .select("subjetivo, avaliacao, plano, cids, criado_em")
      .eq("paciente_id", paciente_id)
      .eq("medico_id", medico_id)
      .order("criado_em", { ascending: false })
      .limit(5)

    if (!consultas || consultas.length === 0) return NextResponse.json({ insights: [], historico: [] })

    const historicoTexto = consultas.map((c: any, i: number) => {
      const data = new Date(c.criado_em).toLocaleDateString("pt-BR")
      return `Consulta ${i + 1} (${data}): Subjetivo: ${c.subjetivo || ""} | Avaliação: ${c.avaliacao || ""} | CIDs: ${(c.cids || []).map((x: any) => x.codigo).join(", ")}`
    }).join("\n")

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 800,
      messages: [{
        role: "user",
        content: `Você é um assistente médico analisando o histórico de um paciente.

CONSULTA ATUAL:
Subjetivo: ${prontuario_atual.subjetivo}
Avaliação: ${prontuario_atual.avaliacao}
CIDs: ${(prontuario_atual.cids || []).map((c: any) => c.codigo + " " + c.descricao).join(", ")}

HISTÓRICO DE CONSULTAS ANTERIORES:
${historicoTexto}

Analise e retorne APENAS este JSON sem texto antes ou depois:
{
  "insights": [
    { "tipo": "recorrencia|melhora|piora|novo|alerta", "texto": "Insight clínico observado comparando consultas" }
  ],
  "padroes": "Resumo de 1-2 frases sobre padrões observados no histórico deste paciente"
}`
      }]
    })

    const txt = message.content[0].type === "text" ? message.content[0].text : "{}"
    const clean = txt.split("```json").join("").split("```").join("").trim()
    const json = JSON.parse(clean)
    return NextResponse.json({ ...json, total_consultas: consultas.length })
  } catch (e: any) {
    return NextResponse.json({ insights: [], error: e.message })
  }
}
