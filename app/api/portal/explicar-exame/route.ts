import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const { nome, resultado } = await req.json()

    if (!resultado || typeof resultado !== 'string') {
      return NextResponse.json({
        error: 'Esse exame ainda não tem resultado em texto. Peça à clínica pra anexar o laudo.',
      }, { status: 400 })
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey || apiKey === 'placeholder') {
      return NextResponse.json({
        error: 'Explicação via IA não está configurada no servidor ainda.',
      }, { status: 503 })
    }

    const client = new Anthropic({ apiKey })

    const prompt = `Você é um assistente médico que explica resultados de exames para pacientes brasileiros leigos.

Regras:
- Não dê diagnóstico. Não substitua o médico.
- Use português brasileiro coloquial mas respeitoso.
- Não use jargão técnico. Quando precisar usar um termo médico, explique entre parênteses.
- Foque em: o que mostra, se há algo fora da referência, e o que o paciente pode perguntar ao médico.
- Máximo 4 parágrafos curtos.

Exame: ${nome || 'Exame não nomeado'}

Resultado:
${resultado}

Escreva uma explicação acessível em 3-4 parágrafos curtos.`

    const completion = await client.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }],
    })

    const texto = completion.content
      .filter((b) => b.type === 'text')
      .map((b: any) => b.text)
      .join('\n')
      .trim()

    return NextResponse.json({ explicacao: texto })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Falha inesperada.' }, { status: 500 })
  }
}
