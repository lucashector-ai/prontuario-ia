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
      'Voce e um medico especialista analisando um exame medico.',
      'Analise o exame e retorne APENAS um JSON valido (sem texto antes ou depois).',
      '',
      contexto ? 'CONTEXTO CLINICO DO PACIENTE: ' + contexto : '',
      contexto ? '' : '',
      'Retorne EXATAMENTE este formato JSON:',
      '{',
      '  "tipo": "Nome do exame (ex: Hemograma completo, ECG, Ressonancia de coluna)",',
      '  "resumo": "Frase curta resumindo o achado principal (1 linha)",',
      '  "alertas": ["Achado critico 1", "Achado critico 2"],',
      '  "valores": [',
      '    {',
      '      "nome": "Hemoglobina",',
      '      "valor": "10.2 g/dL",',
      '      "referencia": "12.0-15.5 g/dL",',
      '      "status": "alterado",',
      '      "interpretacao": "Abaixo do limite, sugere anemia leve"',
      '    }',
      '  ],',
      '  "conclusao": "Paragrafo com a interpretacao clinica completa do exame, considerando o contexto do paciente",',
      '  "recomendacoes": ["Solicitar dosagem de ferritina", "Repetir exame em 30 dias"]',
      '}',
      '',
      'REGRAS DO JSON:',
      '- "status" SEMPRE deve ser uma destas 3 strings: "critico", "alterado", ou "normal"',
      '- "alertas" so inclui achados realmente importantes/perigosos. Pode ser array vazio se nada critico.',
      '- "valores" lista TODOS os parametros mensuraveis (hemograma, bioquimica, etc). Para exames de imagem (raio-X, ressonancia, ECG) pode ser array vazio.',
      '- "interpretacao" de cada valor: 1 frase explicando o que aquele numero significa',
      '- "recomendacoes": acoes praticas pro medico considerar. Use linguagem tecnica medica.',
      '- "conclusao": linguagem tecnica medica, mas didatica. Considera o contexto do paciente se fornecido.',
      '- Para exames de imagem: foque "valores" em achados anatomicos descritos no laudo (ex: "Disco L4-L5", valor: "Protrusao", referencia: "Sem alteracao", status: "alterado").',
      '- NAO use markdown nem aspas escapadas dentro de strings. JSON simples e direto.',
    ].filter(s => s !== null).join('\n')

    const message = await anthropic.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 4000,
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
      // Fallback: retorna texto puro pro front mostrar algo em vez de tela vazia
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
