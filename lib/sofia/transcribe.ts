/**
 * Transcrição de áudios recebidos pelo WhatsApp.
 * Usa Groq (Whisper grátis, rápido) com fallback opcional pra OpenAI.
 *
 * Env vars esperadas:
 * - GROQ_API_KEY (grátis em console.groq.com)
 * - OPENAI_API_KEY (fallback opcional)
 */

const WPP_TOKEN = process.env.WHATSAPP_TOKEN || ''
const GROQ_KEY = process.env.GROQ_API_KEY || ''
const OPENAI_KEY = process.env.OPENAI_API_KEY || ''

/**
 * Baixa o áudio do WhatsApp pelo media_id.
 * Retorna um Buffer com o conteúdo do áudio (opus/ogg).
 */
async function baixarAudioWhatsApp(mediaId: string): Promise<Buffer | null> {
  try {
    // 1. Pega a URL do mídia via Graph API
    const urlRes = await fetch(`https://graph.facebook.com/v20.0/${mediaId}`, {
      headers: { 'Authorization': `Bearer ${WPP_TOKEN}` }
    })
    const urlData = await urlRes.json()
    if (!urlData.url) {
      console.error('baixarAudio: sem URL no response', urlData)
      return null
    }

    // 2. Baixa o arquivo (precisa do token também)
    const audioRes = await fetch(urlData.url, {
      headers: { 'Authorization': `Bearer ${WPP_TOKEN}` }
    })
    if (!audioRes.ok) {
      console.error('baixarAudio: HTTP', audioRes.status)
      return null
    }
    const ab = await audioRes.arrayBuffer()
    return Buffer.from(ab)
  } catch (e) {
    console.error('baixarAudio erro:', e)
    return null
  }
}

/**
 * Transcreve áudio via Groq Whisper (grátis e rápido).
 */
async function transcreverComGroq(audio: Buffer): Promise<string | null> {
  if (!GROQ_KEY) return null
  try {
    const form = new FormData()
    const blob = new Blob([audio], { type: 'audio/ogg' })
    form.append('file', blob, 'audio.ogg')
    form.append('model', 'whisper-large-v3-turbo')
    form.append('language', 'pt')
    form.append('response_format', 'text')

    const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${GROQ_KEY}` },
      body: form,
    })
    if (!res.ok) {
      console.error('Groq transcribe HTTP:', res.status, await res.text())
      return null
    }
    const texto = await res.text()
    return texto.trim()
  } catch (e) {
    console.error('Groq transcribe erro:', e)
    return null
  }
}

/**
 * Fallback: transcreve via OpenAI Whisper (pago).
 */
async function transcreverComOpenAI(audio: Buffer): Promise<string | null> {
  if (!OPENAI_KEY) return null
  try {
    const form = new FormData()
    const blob = new Blob([audio], { type: 'audio/ogg' })
    form.append('file', blob, 'audio.ogg')
    form.append('model', 'whisper-1')
    form.append('language', 'pt')

    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${OPENAI_KEY}` },
      body: form,
    })
    if (!res.ok) return null
    const d = await res.json()
    return d.text?.trim() || null
  } catch (e) {
    console.error('OpenAI transcribe erro:', e)
    return null
  }
}

/**
 * Função principal: recebe media_id do WhatsApp, retorna texto transcrito.
 * Tenta Groq primeiro, cai pra OpenAI se falhar.
 */
export async function transcreverAudioWhatsApp(mediaId: string): Promise<string | null> {
  const audio = await baixarAudioWhatsApp(mediaId)
  if (!audio) return null

  // Tenta Groq primeiro
  let texto = await transcreverComGroq(audio)
  if (texto) return texto

  // Fallback OpenAI
  texto = await transcreverComOpenAI(audio)
  return texto
}
