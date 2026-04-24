
import { NextRequest, NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { transcricao, especialidade } = await req.json()
    if (!transcricao || transcricao.trim().length < 30) {
      return NextResponse.json({ sugestoes: [], alertas: [] })
    }

    const partes = [
      "Voce e um assistente medico analisando uma consulta em andamento.",
      "Com base na transcricao parcial abaixo, ajude o medico a conduzir melhor a consulta.",
      "",
      especialidade ? "Especialidade: " + especialidade : "",
      "",
      "TRANSCRICAO ATUAL:",
      transcricao.slice(-1500),
      "",
      "Retorne APENAS este JSON sem texto antes ou depois:",
      "{",
      "  \"sugestoes\": [",
      "    \"Pergunta ou acao sugerida 1 (maxima 15 palavras)\",",
      "    \"Pergunta ou acao sugerida 2 (maxima 15 palavras)\",",
      "    \"Pergunta ou acao sugerida 3 (maxima 15 palavras)\"",
      "  ],",
      "  \"alertas\": [",
      "    \"Alerta clinico importante se houver (ex: sintoma grave, contraindicacao)\"",
      "  ],",
      "  \"foco\": \"Uma frase descrevendo o principal problema identificado ate agora\"",
      "}"
    ]

    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      messages: [{ role: "user", content: partes.filter(Boolean).join("\n") }]
    })

    const txt = message.content[0].type === "text" ? message.content[0].text : "{}"
    const inicio = txt.indexOf("{")
    const fim = txt.lastIndexOf("}")
    let json: any = {}
    try {
      json = JSON.parse(inicio >= 0 && fim >= 0 ? txt.slice(inicio, fim + 1) : "{}")
    } catch (parseErr) {
      console.warn("[sugestoes-consulta] JSON parse falhou — resposta do modelo:", txt.slice(0, 200))
      return NextResponse.json({ sugestoes: [], alertas: [], foco: "" })
    }

    return NextResponse.json({
      sugestoes: Array.isArray(json.sugestoes) ? json.sugestoes : [],
      alertas: Array.isArray(json.alertas) ? json.alertas : [],
      foco: typeof json.foco === "string" ? json.foco : ""
    })
  } catch (e: any) {
    return NextResponse.json({ sugestoes: [], alertas: [], error: e.message })
  }
}
