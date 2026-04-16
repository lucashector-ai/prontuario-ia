
import { NextRequest, NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { tipo, prontuario, medico, paciente } = await req.json()

    let prompt = ""
    if (tipo === "exames") {
      prompt = `Com base no prontuário abaixo, liste os exames complementares mais indicados.

Prontuário:
Avaliação: ${prontuario.avaliacao}
Plano: ${prontuario.plano}
CIDs: ${(prontuario.cids || []).map((c: any) => c.codigo + " " + c.descricao).join(", ")}

Retorne APENAS este JSON sem texto antes ou depois:
{
  "exames": [
    { "nome": "Nome do exame", "indicacao": "Por que foi solicitado", "urgencia": "rotina|urgente|eletivo" }
  ],
  "observacoes": "Orientações gerais para coleta"
}`
    } else {
      prompt = `Gere o texto de um atestado médico profissional com base nos dados abaixo.

Paciente: ${paciente?.nome || "Paciente"}
Diagnóstico: ${(prontuario.cids || []).map((c: any) => c.descricao).join(", ") || prontuario.avaliacao}
Plano: ${prontuario.plano}

Retorne APENAS este JSON:
{
  "dias": 1,
  "motivo": "descrição médica do motivo do afastamento",
  "observacoes": "observações adicionais se necessário",
  "cid": "${(prontuario.cids || [{ codigo: "" }])[0]?.codigo || ""}"
}`
    }

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 600,
      messages: [{ role: "user", content: prompt }]
    })

    const txt = message.content[0].type === "text" ? message.content[0].text : "{}"
    const clean = txt.split("\`\`\`json").join("").split("\`\`\`").join("").trim()
    const data = JSON.parse(clean)
    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
