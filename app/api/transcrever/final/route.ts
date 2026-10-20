import { NextRequest, NextResponse } from 'next/server'
import { supabaseServidor as db } from '@/lib/servidor'
import { sessaoDaRequisicao } from '@/lib/sessao-servidor'
import { log } from '@/lib/logger'
import { PARAMS_DEEPGRAM, TERMOS_MEDICOS_BASE, paramsTermos, textoComFalantes } from '@/lib/transcricao/termos'

export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * Revisão final da transcrição: o áudio inteiro da consulta passa pelo Deepgram de uma vez
 * (contexto completo + separação de falantes), o que corrige erros da transcrição ao vivo.
 *
 *   1. { acao: 'preparar', extensao: 'webm' }  → URL assinada para o navegador enviar o áudio
 *   2. { acao: 'transcrever', caminho, termos } → texto final; o áudio é apagado em seguida (LGPD)
 */
const BUCKET = 'transcricoes'

/** Transcrição pelo Groq (Whisper large v3 turbo). Devolve null se não houver chave ou der erro. */
async function transcreverGroq(url: string, termos: string[]): Promise<{ texto: string; duracao: number | null } | null> {
  const chave = process.env.GROQ_API_KEY
  if (!chave) return null
  try {
    const audio = await fetch(url)
    if (!audio.ok) return null
    const blob = await audio.blob()
    if (blob.size > 24 * 1024 * 1024) return null   // acima do limite do Groq: usa o Deepgram
    const form = new FormData()
    form.append('file', blob, 'consulta.' + (blob.type.includes('mp4') ? 'm4a' : blob.type.includes('ogg') ? 'ogg' : 'webm'))
    form.append('model', 'whisper-large-v3-turbo')
    form.append('language', 'pt')
    form.append('response_format', 'verbose_json')
    form.append('temperature', '0')
    // Vocabulário médico como contexto (o Whisper aceita um texto curto de "prompt")
    form.append('prompt', 'Consulta médica em português. Termos: ' + termos.slice(0, 40).join(', ') + '.')
    const r = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', { method: 'POST', headers: { Authorization: `Bearer ${chave}` }, body: form })
    if (!r.ok) { log.warn('[transcrever/final] groq', r.status, (await r.text()).slice(0, 200)); return null }
    const j = await r.json()
    const texto = String(j.text || '').trim()
    return texto ? { texto, duracao: j.duration ?? null } : null
  } catch (e: any) {
    log.warn('[transcrever/final] groq falhou:', e?.message || e)
    return null
  }
}

async function garantirBucket() {
  const { data } = await db.storage.getBucket(BUCKET)
  if (!data) await db.storage.createBucket(BUCKET, { public: false, fileSizeLimit: '200MB' })
}

export async function POST(req: NextRequest) {
  const sessao = await sessaoDaRequisicao(req)
  if (!sessao) return NextResponse.json({ error: 'Sessão expirada' }, { status: 401 })
  const corpo = await req.json().catch(() => ({}))

  try {
    if (corpo.acao === 'preparar') {
      await garantirBucket()
      const ext = /^[a-z0-9]{2,5}$/.test(corpo.extensao || '') ? corpo.extensao : 'webm'
      const caminho = `${sessao.clinica_id || sessao.medico_id || 'sem-clinica'}/${Date.now()}-${crypto.randomUUID()}.${ext}`
      const { data, error } = await db.storage.from(BUCKET).createSignedUploadUrl(caminho)
      if (error || !data) throw new Error(error?.message || 'Não foi possível preparar o envio')
      return NextResponse.json({ bucket: BUCKET, caminho, token: data.token })
    }

    if (corpo.acao === 'transcrever') {
      const caminho = String(corpo.caminho || '')
      const dono = sessao.clinica_id || sessao.medico_id || 'sem-clinica'
      if (!caminho.startsWith(dono + '/')) return NextResponse.json({ error: 'Arquivo inválido' }, { status: 403 })

      const { data: assinado, error: errUrl } = await db.storage.from(BUCKET).createSignedUrl(caminho, 600)
      if (errUrl || !assinado) throw new Error(errUrl?.message || 'Áudio não encontrado')

      const termos: string[] = Array.isArray(corpo.termos) ? corpo.termos.map(String) : TERMOS_MEDICOS_BASE

      // 1º Groq Whisper (bem mais barato: ~US$ 0,04 por hora de áudio). Quem falou cada frase
      // é identificado depois pela IA (/api/transcrever/papeis). Se falhar, cai no Deepgram.
      const viaGroq = await transcreverGroq(assinado.signedUrl, termos)
      if (viaGroq) {
        db.storage.from(BUCKET).remove([caminho]).catch(() => {})
        return NextResponse.json({ texto: viaGroq.texto, falantes: 0, duracao: viaGroq.duracao, confianca: null, motor: 'groq' })
      }

      const r = await fetch(`https://api.deepgram.com/v1/listen?${PARAMS_DEEPGRAM}&utterances=true&${paramsTermos(termos)}`, {
        method: 'POST',
        headers: { Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: assinado.signedUrl }),
      })
      // Áudio não fica guardado — só servia para a revisão
      db.storage.from(BUCKET).remove([caminho]).catch(() => {})

      if (!r.ok) {
        const erro = await r.text()
        log.error('[transcrever/final] deepgram', erro)
        return NextResponse.json({ error: 'Falha na revisão do áudio' }, { status: 502 })
      }
      const j = await r.json()
      const alt = j.results?.channels?.[0]?.alternatives?.[0]
      const palavras = alt?.words || []
      const falantes = new Set(palavras.map((p: any) => p.speaker).filter((x: any) => x !== undefined)).size
      // Com uma pessoa só, texto corrido; com duas ou mais, marcado por falante
      const texto = falantes > 1 ? textoComFalantes(palavras) : (alt?.transcript || '').trim()
      return NextResponse.json({
        texto,
        falantes,
        duracao: j.metadata?.duration || null,
        confianca: alt?.confidence ?? null,
      })
    }

    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
  } catch (e: any) {
    log.error('[transcrever/final]', e?.message || e)
    return NextResponse.json({ error: e?.message || 'Erro na revisão' }, { status: 500 })
  }
}
