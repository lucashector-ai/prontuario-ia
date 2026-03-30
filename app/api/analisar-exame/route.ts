import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const file = form.get('file') as File
    if (!file) return NextResponse.json({ error: 'Arquivo nao enviado' }, { status: 400 })

    const bytes = await file.arrayBuffer()
    const base64 = Buffer.from(bytes).toString('base64')
    const mediaType = file.type as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' | 'application/pdf'

    const isImage = file.type.startsWith('image/')
    const isPdf = file.type === 'application/pdf'

    if (!isImage && !isPdf) {
      return NextResponse.json({ error: 'Formato invalido. Envie JPG, PNG ou PDF.' }, { status: 400 })
    }

    const content: any[] = [
      {
        type: isPdf ? 'document' : 'image',
        source: { type: 'base64', media_type: mediaType, data: base64 }
      },
      {
        type: 'text',
        text: \`Voce e um medico especialista analisando um exame medico. Analise este exame de forma completa e didatica.

Estruture sua resposta assim:
1. TIPO DE EXAME: identifique o tipo de exame
2. VALORES ENCONTRADOS: liste todos os valores com as referencias normais
3. O QUE ESTA ALTERADO: destaque valores fora do normal (use linguagem clara)
4. INTERPRETACAO CLINICA: explique o que os resultados significam clinicamente
5. OBSERVACOES: pontos importantes ou que merecem atencao medica

Use linguagem clara e acessivel. Seja detalhado mas objetivo.\`
      }
    ]

    const message = await anthropic.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 2000,
      messages: [{ role: 'user', content }]
    })

    const analise = (message.content[0] as any).text
    return NextResponse.json({ analise })
  } catch (err: any) {
    console.error('Erro analisar-exame:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
