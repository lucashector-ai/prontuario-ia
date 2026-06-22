import { log } from '@/lib/logger'
import { NextRequest } from 'next/server'
import { MODELOS, ANTHROPIC_API_URL, ANTHROPIC_API_VERSION } from '@/lib/ai/models'
import { SYSTEM_PROMPT_MEDICO } from '@/lib/ai/system-prompt-medico'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

type Anexo = {
  tipo: 'image' | 'document'
  media_type: string   // ex: image/jpeg, application/pdf
  data: string         // base64 sem o prefixo data:
}

type MensagemEntrada = {
  papel: 'user' | 'assistant'
  conteudo: string
  anexos?: Anexo[]
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const mensagens: MensagemEntrada[] = body.mensagens || []

    if (!Array.isArray(mensagens) || mensagens.length === 0) {
      return new Response(JSON.stringify({ erro: 'Sem mensagens' }), { status: 400 })
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return new Response(JSON.stringify({ erro: 'Assistente indisponível no momento' }), { status: 503 })
    }

    // Converte pro formato da Anthropic. Mensagens com anexo viram content array.
    const messages = mensagens.map(m => {
      const role = m.papel === 'user' ? 'user' : 'assistant'

      // Sem anexo: content é só string
      if (!m.anexos || m.anexos.length === 0) {
        return { role, content: m.conteudo }
      }

      // Com anexo: content é array de blocos
      const blocos: any[] = []
      for (const anexo of m.anexos) {
        if (anexo.tipo === 'image') {
          blocos.push({
            type: 'image',
            source: { type: 'base64', media_type: anexo.media_type, data: anexo.data },
          })
        } else if (anexo.tipo === 'document') {
          blocos.push({
            type: 'document',
            source: { type: 'base64', media_type: anexo.media_type, data: anexo.data },
          })
        }
      }
      // Texto vem depois dos anexos
      if (m.conteudo) {
        blocos.push({ type: 'text', text: m.conteudo })
      }
      return { role, content: blocos }
    })

    const anthropicRes = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_API_VERSION,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODELOS.raciocinioClinico,
        max_tokens: 2000,
        system: SYSTEM_PROMPT_MEDICO,
        messages,
        stream: true,
      }),
    })

    if (!anthropicRes.ok || !anthropicRes.body) {
      const errText = await anthropicRes.text().catch(() => '')
      log.error('Erro Anthropic API:', anthropicRes.status, errText)
      return new Response(JSON.stringify({ erro: 'Erro ao processar a resposta' }), { status: 502 })
    }

    const encoder = new TextEncoder()
    const decoder = new TextDecoder()

    const stream = new ReadableStream({
      async start(controller) {
        const reader = anthropicRes.body!.getReader()
        let buffer = ''
        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            buffer += decoder.decode(value, { stream: true })
            const linhas = buffer.split('\n')
            buffer = linhas.pop() || ''
            for (const linha of linhas) {
              const trim = linha.trim()
              if (!trim.startsWith('data:')) continue
              const payload = trim.slice(5).trim()
              if (payload === '[DONE]') continue
              try {
                const evento = JSON.parse(payload)
                if (evento.type === 'content_block_delta' && evento.delta?.type === 'text_delta') {
                  const texto = evento.delta.text || ''
                  if (texto) controller.enqueue(encoder.encode(texto))
                }
              } catch {
                // ignora
              }
            }
          }
        } catch (e) {
          log.error('Erro no stream:', e)
        } finally {
          controller.close()
          reader.releaseLock()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'X-Accel-Buffering': 'no',
      },
    })
  } catch (e: any) {
    log.error('Erro na API do assistente:', e)
    return new Response(JSON.stringify({ erro: e.message || 'Erro interno' }), { status: 500 })
  }
}
