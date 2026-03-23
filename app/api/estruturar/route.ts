import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { transcricao } = await req.json()

    if (!transcricao || transcricao.trim().length < 20) {
      return NextResponse.json({ error: 'Transcrição muito curta' }, { status: 400 })
    }

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      messages: [
        {
          role: 'user',
          content: `Você é um assistente médico especializado em documentação clínica brasileira.
          
Analise a transcrição abaixo de uma consulta médica e estruture um prontuário completo no formato SOAP.

REGRAS IMPORTANTES:
- Escreva em português brasileiro formal e técnico
- Use apenas informações presentes na transcrição — nunca invente dados
- Se alguma seção não tiver informações suficientes, escreva "Não mencionado na consulta"
- Sugira de 1 a 3 CIDs mais prováveis com base nos achados
- Seja objetivo e claro, como um médico escreveria

FORMATO DE RESPOSTA — retorne EXATAMENTE este JSON, sem texto antes ou depois:
{
  "subjetivo": "Queixas do paciente, história da doença atual, sintomas relatados",
  "objetivo": "Sinais vitais, exame físico, achados objetivos mencionados",
  "avaliacao": "Hipóteses diagnósticas e raciocínio clínico",
  "plano": "Conduta: medicamentos, exames solicitados, orientações, retorno",
  "cids": [
    { "codigo": "X00", "descricao": "Nome da condição", "justificativa": "Por que este CID" }
  ],
  "alertas": ["Lista de alertas importantes, se houver — ex: alergia mencionada, medicamento de alto risco"]
}

TRANSCRIÇÃO DA CONSULTA:
${transcricao}`,
        },
      ],
    })

    const conteudo = message.content[0].type === 'text' ? message.content[0].text : ''

    // Remove possíveis marcações de código antes de parsear
    const jsonLimpo = conteudo.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const prontuario = JSON.parse(jsonLimpo)

    return NextResponse.json({ prontuario })
  } catch (error: any) {
    console.error('Erro Claude:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
