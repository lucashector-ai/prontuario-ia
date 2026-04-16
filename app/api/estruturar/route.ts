import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const TEMPLATES: Record<string, string> = {
  psiquiatria: 'Enfatize: humor e afeto, padroes de pensamento, avaliacao de risco (suicida/heteroagressividade), medicamentos psiquiatricos em uso.',
  cardiologia: 'Enfatize: fatores de risco cardiovascular (HAS, DM, tabagismo, dislipidemia), sintomas cardiacos (precordialgia, dispneia, palpitacoes), ausculta e PA em ambos os bracos.',
  dermatologia: 'Enfatize: descricao das lesoes (morfologia, distribuicao, cor, tamanho), tempo de evolucao, fatores desencadeantes, tratamentos topicos em uso.',
  pediatria: 'Enfatize: idade em meses/anos, peso e altura com percentis, vacinacao em dia, desenvolvimento neuropsicomotor, quem acompanha a crianca.',
  ginecologia: 'Enfatize: data da ultima menstruacao (DUM), regularidade, ultimo Papanicolau, anticoncepcional em uso, historico obstetrico (G P A).',
  ortopedia: 'Enfatize: localizacao exata da dor, mecanismo de lesao, EVA (escala 0-10), limitacao funcional.',
}

function getTemplate(especialidade: string): string {
  const esp = (especialidade || '').toLowerCase()
  for (const [key, tmpl] of Object.entries(TEMPLATES)) {
    if (esp.includes(key)) return tmpl
  }
  return ''
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { transcricao, especialidade, pre_consulta } = body

    if (!transcricao || transcricao.trim().length < 20) {
      return NextResponse.json({ error: 'Transcricao muito curta' }, { status: 400 })
    }

    const template = getTemplate(especialidade || '')

    const partes = [
      'Voce e um assistente medico especializado em documentacao clinica brasileira.',
      'Analise a transcricao abaixo e estruture um prontuario completo no formato SOAP.',
      '',
      'REGRAS:',
      '- Escreva em portugues brasileiro formal e tecnico',
      '- Use apenas informacoes presentes na transcricao',
      '- Se alguma secao nao tiver informacoes, escreva "Nao mencionado na consulta"',
      '- Sugira de 1 a 3 CIDs mais provaveis',
      template ? 'INSTRUCOES ESPECIFICAS: ' + template : '',
      '',
      'Retorne EXATAMENTE este JSON sem texto antes ou depois:',
      '{',
      '  "subjetivo": "Queixas e historia da doenca",',
      '  "objetivo": "Exame fisico e achados objetivos",',
      '  "avaliacao": "Hipoteses diagnosticas e raciocinio clinico",',
      '  "plano": "Conduta: medicamentos, exames, orientacoes, retorno",',
      '  "cids": [{ "codigo": "X00", "descricao": "Nome", "justificativa": "Por que" }],',
      '  "alertas": ["alertas importantes se houver"],',
      '  "hipoteses": [{ "nome": "Nome", "probabilidade": "alta|media|baixa", "justificativa": "Breve" }],',
      '  "resumo_copiloto": "Uma frase descrevendo o caso clinico principal"',
      '}',
      '',
      'TRANSCRICAO:',
      transcricao,
    ]

    if (pre_consulta) {
      partes.push('')
      partes.push('PRE-CONSULTA (respondido pelo paciente antes):')
      partes.push(pre_consulta)
    }

    const prompt = partes.filter(Boolean).join('\n')

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    })

    const conteudo = message.content[0].type === 'text' ? message.content[0].text : ''
    const inicio = conteudo.indexOf('{')
    const fim = conteudo.lastIndexOf('}')
    const jsonStr = inicio >= 0 && fim >= 0 ? conteudo.slice(inicio, fim + 1) : conteudo
    const prontuario = JSON.parse(jsonStr)

    return NextResponse.json({ prontuario })
  } catch (error: any) {
    console.error('Erro Claude:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
