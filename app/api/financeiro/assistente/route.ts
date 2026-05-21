import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { MODELOS } from '@/lib/ai/models'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// POST /api/financeiro/assistente — responde perguntas sobre o financeiro
export async function POST(req: NextRequest) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'IA não configurada nesta instância' }, { status: 503 })
    }
    const { pergunta, historico, contexto } = await req.json()
    if (!pergunta || typeof pergunta !== 'string') {
      return NextResponse.json({ error: 'pergunta obrigatória' }, { status: 400 })
    }

    const mensagens = [
      ...(Array.isArray(historico) ? historico : [])
        .filter((m: any) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
        .slice(-8),
      { role: 'user' as const, content: pergunta },
    ]

    const message = await anthropic.messages.create({
      model: MODELOS.apoio,
      max_tokens: 700,
      system: `Você é o analista financeiro de uma clínica, dentro do sistema Clinical 360.
Responda perguntas do gestor sobre as finanças da clínica de forma direta, clara e em português brasileiro.

Regras:
- Use SOMENTE os dados do contexto abaixo. Não invente números.
- Se a pergunta não puder ser respondida com os dados disponíveis, diga isso e oriente onde o gestor encontra a informação no sistema.
- Respostas curtas e objetivas. Use no máximo um parágrafo curto ou uma lista de 2-4 itens.
- Quando fizer sentido, sugira uma ação prática.
- Valores em reais (R$).

CONTEXTO FINANCEIRO ATUAL:
${typeof contexto === 'string' ? contexto : JSON.stringify(contexto || {})}`,
      messages: mensagens,
    })

    const resposta = message.content[0]?.type === 'text' ? message.content[0].text : ''
    return NextResponse.json({ resposta })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'erro ao consultar a IA' }, { status: 500 })
  }
}
