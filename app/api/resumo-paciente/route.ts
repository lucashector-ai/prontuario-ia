
import { NextRequest, NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { prontuario, medico } = await req.json()
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 800,
      messages: [{
        role: "user",
        content: `Você é um médico que precisa explicar o resultado da consulta para um paciente leigo.

PRONTUÁRIO DA CONSULTA:
Subjetivo: ${prontuario.subjetivo}
Avaliação: ${prontuario.avaliacao}
Plano: ${prontuario.plano}
CIDs: ${(prontuario.cids || []).map((c: any) => c.descricao).join(", ")}

Escreva um resumo claro, humano e acolhedor para o PACIENTE (não para o médico).
Use linguagem simples, sem jargões médicos.
Estruture assim:

**O que foi identificado:**
(explique o diagnóstico de forma simples)

**O que você precisa fazer:**
(lista simples das orientações e medicamentos)

**Quando voltar ou buscar ajuda:**
(sinais de alerta e retorno)

**Recado do médico:**
(mensagem acolhedora e motivadora curta)

Escreva em português brasileiro, tom acolhedor e profissional.`
      }]
    })
    const texto = message.content[0].type === "text" ? message.content[0].text : ""
    return NextResponse.json({ resumo: texto })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
