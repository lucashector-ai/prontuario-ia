import { NextRequest } from 'next/server'
import { MODELOS, ANTHROPIC_API_URL, ANTHROPIC_API_VERSION } from '@/lib/ai/models'
import { SYSTEM_PROMPT_MEDICO } from '@/lib/ai/system-prompt-medico'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

type MensagemEntrada = {
  papel: 'user' | 'assistant'
  conteudo: string
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

    // Converte pro formato da Anthropic API
    const messages = mensagens.map(m => ({
      role: m.papel === 'user' ? 'user' : 'assistant',
      content: m.conteudo,
    }))

    // Chama a API com streaming ativado
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
      console.error('Erro Anthropic API:', anthropicRes.status, errText)
      return new Response(JSON.stringify({ erro: 'Erro ao processar a resposta' }), { status: 502 })
    }

    // Stream de saída: lê o SSE da Anthropic, extrai só o texto, repassa
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
                // Só nos interessa o delta de texto
                if (evento.type === 'content_block_delta' && evento.delta?.type === 'text_delta') {
                  const texto = evento.delta.text || ''
                  if (texto) {
                    controller.enqueue(encoder.encode(texto))
                  }
                }
              } catch {
                // ignora linhas que não são JSON válido
              }
            }
          }
        } catch (e) {
          console.error('Erro no stream:', e)
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
    console.error('Erro na API do assistente:', e)
    return new Response(JSON.stringify({ erro: e.message || 'Erro interno' }), { status: 500 })
  }
}
