import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const file = form.get('file') as File
    const contexto = (form.get('contexto') as string) || ''
    if (!file) return NextResponse.json({ error: 'Arquivo nao enviado' }, { status: 400 })
    const bytes = await file.arrayBuffer()
    const base64 = Buffer.from(bytes).toString('base64')
    const isImage = file.type.startsWith('image/')
    const isPdf = file.type === 'application/pdf'
    if (!isImage && !isPdf) return NextResponse.json({ error: 'Formato invalido. Envie JPG, PNG ou PDF.' }, { status: 400 })
    const mediaType = file.type as any
    const srcBlock: any = isPdf
      ? { type: 'document', source: { type: 'base64', media_type: mediaType, data: base64 } }
      : { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } }

    const partes = [
      'Voce e um medico clinico altamente experiente, com formacao em medicina baseada em evidencias e capacidade de mobilizar conhecimento de multiplas especialidades (cardiologia, endocrinologia, nefrologia, hematologia, gastroenterologia, neurologia, ortopedia, ginecologia, pneumologia, dermatologia, pediatria, etc).',
      '',
      'Sua tarefa e analisar o exame anexo com o RIGOR de um medico que vai assinar o laudo.',
      '',
      'PROCESSO DE RACIOCINIO (faca isso mentalmente antes de responder):',
      '1. IDENTIFIQUE O TIPO DE EXAME — laboratorial (hemograma, bioquimica, hormonios, sorologia), imagem (raio-X, USG, TC, RM, ECG, ecocardio), ou outro. Identifique tambem qual especialidade e mais relevante.',
      '2. ANALISE CADA VALOR/ACHADO — para cada parametro, compare com o intervalo de referencia. Considere idade, sexo e contexto clinico se fornecidos. Lembre que valores no limite as vezes sao mais importantes que voce pensa.',
      '3. PENSE EM DIAGNOSTICOS DIFERENCIAIS — quais condicoes podem explicar o conjunto de achados? Pense em pelo menos 2-3 hipoteses antes de concluir.',
      '4. AVALIE GRAVIDADE E URGENCIA — algum achado pede atencao imediata? Ha sinais de descompensacao, risco cardiovascular, malignidade ou doenca aguda?',
      '5. ESTRUTURE A RESPOSTA — agora preencha o JSON com profundidade clinica.',
      '',
      contexto ? 'CONTEXTO CLINICO DO PACIENTE: ' + contexto : 'Sem contexto clinico fornecido — analise os achados de forma generica mas indique quando o contexto seria importante.',
      '',
      'RETORNE APENAS um JSON valido (sem texto antes ou depois):',
      '{',
      '  "tipo": "Nome especifico do exame (ex: Hemograma completo com plaquetas e VHS, ECG de 12 derivacoes, Ressonancia magnetica de coluna lombar)",',
      '  "resumo": "Frase curta e informativa com o achado principal — nao seja generico",',
      '  "alertas": ["Achados criticos ou urgentes que pedem atencao imediata. Pode ser array vazio se nada critico."],',
      '  "valores": [',
      '    {',
      '      "nome": "Nome do parametro",',
      '      "valor": "Valor encontrado com unidade",',
      '      "referencia": "Intervalo de referencia para idade/sexo do paciente",',
      '      "status": "critico OU alterado OU normal",',
      '      "interpretacao": "Frase tecnica explicando o significado clinico DESTE valor especifico (nao genericos)"',
      '    }',
      '  ],',
      '  "conclusao": "Paragrafo de 4-8 linhas com analise clinica completa: identifique o padrao geral, considere diagnosticos diferenciais quando relevante, articule o significado conjunto dos achados. Use linguagem tecnica precisa mas didatica. Mencione diretrizes quando aplicavel (ex: SBC para cardio, SBD para diabetes, ADA, KDIGO, etc).",',
      '  "recomendacoes": ["Acoes praticas e especificas: exames complementares com nome exato, ajustes terapeuticos, encaminhamentos para especialistas, controles de seguimento, mudancas de habito relevantes"]',
      '}',
      '',
      'REGRAS CRITICAS:',
      '- "status" SEMPRE deve ser uma destas 3 strings: "critico" (risco imediato), "alterado" (fora do referencia mas nao urgente), ou "normal" (dentro do referencia).',
      '- Para exames de imagem (raio-X, ressonancia, ECG, ecocardio): "valores" lista achados anatomicos descritos no laudo (ex: nome="Disco L4-L5", valor="Protrusao posterior central", referencia="Sem alteracao morfologica", status="alterado").',
      '- "interpretacao" precisa ser ESPECIFICA, nao generica. Se hemoglobina baixa, diga se sugere anemia ferropriva vs talassemia vs cronica baseado no quadro. Se TSH alto, diga hipotireoidismo subclinico vs primario.',
      '- "recomendacoes" precisa nomear exames especificos (ex: "Solicitar ferritina e saturacao de transferrina" e nao "Investigar anemia"). Nomeie medicamentos com classes especificas quando aplicavel.',
      '- "conclusao" cita diretrizes brasileiras/internacionais quando relevante.',
      '- NAO use markdown nem aspas escapadas dentro de strings. JSON simples.',
      '- Se o exame esta totalmente normal, "alertas" e "recomendacoes" podem ser arrays vazios e a "conclusao" deve confirmar normalidade.',
    ].filter(s => s !== null).join('\n')

    const message = await anthropic.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 6000,
      messages: [{ role: 'user', content: [srcBlock, { type: 'text', text: partes }] }]
    })

    const texto = (message.content[0] as any).text || ''
    const inicio = texto.indexOf('{')
    const fim = texto.lastIndexOf('}')
    let analise: any = null
    try {
      analise = JSON.parse(inicio >= 0 && fim >= 0 ? texto.slice(inicio, fim + 1) : '{}')
    } catch (parseErr) {
      console.warn('[analisar-exame] JSON parse falhou, retornando texto bruto. Resposta:', texto.slice(0, 300))
      return NextResponse.json({
        analise: {
          tipo: 'Exame medico',
          resumo: '',
          alertas: [],
          valores: [],
          conclusao: texto,
          recomendacoes: [],
        }
      })
    }

    return NextResponse.json({ analise })
  } catch (err: any) {
    console.error('[analisar-exame] erro:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
