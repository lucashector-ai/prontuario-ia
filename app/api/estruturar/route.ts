import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })


const TEMPLATES_ESPECIALIDADE: Record<string, string> = {
  psiquiatria: `Além do SOAP padrão, inclua campos específicos:
- "humor": avaliação do humor e afeto
- "pensamento": padrões de pensamento, ideação
- "risco": avaliação de risco (suicida, heteroagressividade)
- "medicacao_psiquiatrica": medicamentos psiquiátricos em uso`,

  cardiologia: `Além do SOAP padrão, enfatize:
- Fatores de risco cardiovascular (HAS, DM, tabagismo, dislipidemia)
- Sintomas cardíacos: precordialgia, dispneia, palpitações, síncope
- Exame físico: ausculta cardíaca, PA em ambos os braços, pulsos`,

  dermatologia: `Além do SOAP padrão, inclua:
- Descrição detalhada das lesões: morfologia, distribuição, cor, tamanho
- Tempo de evolução e fatores desencadeantes
- Tratamentos tópicos em uso`,

  pediatria: `Além do SOAP padrão, inclua:
- Idade em meses/anos, peso e altura (percentis se disponível)
- Vacinação em dia (sim/não)
- Desenvolvimento neuropsicomotor
- Quem acompanha a criança`,

  ginecologia: `Além do SOAP padrão, inclua:
- Data da última menstruação (DUM) e regularidade
- Data do último Papanicolau
- Uso de anticoncepcional
- Histórico obstétrico (G P A)`,

  ortopedia: `Além do SOAP padrão, enfatize:
- Localização exata da dor (usar anatomia)
- Mecanismo de lesão se traumático
- EVA (escala de dor 0-10)
- Limitação funcional: o que não consegue fazer`,
}

function getTemplateEspecialidade(especialidade: string): string {
  const esp = especialidade?.toLowerCase() || ''
  for (const [key, template] of Object.entries(TEMPLATES_ESPECIALIDADE)) {
    if (esp.includes(key)) return template
  }
  return ''
}

export async function POST(req: NextRequest) {
  try {
    const { transcricao } = await req.json()

    if (!transcricao || transcricao.trim().length < 20) {
      return NextResponse.json({ error: 'Transcrição muito curta' }, { status: 400 })
    }

    const { especialidade, pre_consulta } = await req.json().catch(() => ({})) || {}
    // Re-parse pois ja fizemos json() antes
    const templateEsp = getTemplateEspecialidade(especialidade || '')

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
  "alertas": ["Lista de alertas importantes, se houver — ex: alergia mencionada, medicamento de alto risco"],
  "hipoteses": [
    { "nome": "Nome da hipótese diagnóstica", "probabilidade": "alta|media|baixa", "justificativa": "Breve justificativa baseada nos achados" }
  ],
  "resumo_copiloto": "Uma frase curta descrevendo o caso clínico principal para orientar o médico"
}

TRANSCRIÇÃO DA CONSULTA:
\${transcricao}

\${pre_consulta ? 'PRÉ-CONSULTA (respondido pelo paciente antes da consulta):\n' + pre_consulta : ''}\`,
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
