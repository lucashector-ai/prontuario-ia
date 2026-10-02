'use client'
/**
 * Transcrição de consulta — ao vivo + revisão final.
 *
 *   const t = useTranscricao(texto => setTranscricao(texto))
 *   await t.iniciarGravacao()
 *   const textoFinal = await t.pararGravacao()   // já com a revisão do áudio inteiro
 *
 * Como funciona:
 *  - Microfone sem o filtro de ruído do navegador (ele apaga voz baixa) e com ganho
 *    automático próprio (public/worklets/captura-pcm.js) — voz fraca é amplificada.
 *  - Áudio contínuo por WebSocket para o Deepgram Nova-3 (pt-BR, vocabulário médico,
 *    separação de falantes). Texto aparece enquanto a pessoa fala; cai a conexão,
 *    reconecta sozinho sem perder o áudio do intervalo.
 *  - A consulta também é gravada; ao encerrar, o áudio inteiro é transcrito de novo
 *    com contexto completo e substitui o texto ao vivo (se der certo).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { log } from '@/lib/logger'
import { supabase } from '@/lib/supabase'
import { PARAMS_DEEPGRAM, TERMOS_MEDICOS_BASE, paramsTermos, textoComFalantes } from '@/lib/transcricao/termos'

export type Conexao = 'parado' | 'conectando' | 'ao_vivo' | 'reconectando' | 'sem_ao_vivo'
export type Fase = 'parado' | 'gravando' | 'finalizando' | 'revisando'

type Palavra = { word: string; punctuated_word?: string; speaker?: number }

// Ao vivo: 40 termos (testado — listas longas pioram o streaming); revisão final usa até 100
const MAX_PENDENTE = 600        // blocos de 100 ms guardados durante reconexão (60 s)
const TENTATIVAS_RECONEXAO = 6

function nivelDe(rms: number) {
  // -60 dB → 0, -12 dB → 1
  const db = 20 * Math.log10(Math.max(rms, 1e-6))
  return Math.max(0, Math.min(1, (db + 60) / 48))
}

function textoDasPalavras(palavras: Palavra[]) {
  const falantes = new Set(palavras.map(p => p.speaker).filter(s => s !== undefined))
  return falantes.size > 1
    ? textoComFalantes(palavras)
    : palavras.map(p => p.punctuated_word || p.word).join(' ').trim()
}

export type OpcoesTranscricao = {
  medicoId?: string | null
  /** false = sem revisão final do áudio inteiro */
  revisaoFinal?: boolean
  /** Usa um microfone já aberto (ex.: teleconsulta) em vez de pedir outro. Não é encerrado no fim. */
  obterStream?: () => MediaStream | null
}

export function useTranscricao(onTexto: (texto: string) => void, opcoes: OpcoesTranscricao = {}) {
  const [fase, setFase] = useState<Fase>('parado')
  const [pausado, setPausado] = useState(false)
  const [conexao, setConexao] = useState<Conexao>('parado')
  const [parcial, setParcial] = useState('')
  const [nivel, setNivel] = useState(0)
  const [vozBaixa, setVozBaixa] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [texto, setTexto] = useState('')

  const onTextoRef = useRef(onTexto); onTextoRef.current = onTexto
  const opcoesRef = useRef(opcoes); opcoesRef.current = opcoes

  const streamRef = useRef<MediaStream | null>(null)
  const streamProprioRef = useRef(true)   // false = microfone emprestado (não paramos as faixas)
  const fontesExtrasRef = useRef<MediaStreamAudioSourceNode[]>([])
  const ctxRef = useRef<AudioContext | null>(null)
  const noRef = useRef<AudioWorkletNode | null>(null)
  const gravadorRef = useRef<MediaRecorder | null>(null)
  const pedacosRef = useRef<Blob[]>([])
  const wsRef = useRef<WebSocket | null>(null)
  const pendenteRef = useRef<ArrayBuffer[]>([])
  const palavrasRef = useRef<Palavra[]>([])
  const termosRef = useRef<string[]>(TERMOS_MEDICOS_BASE)
  const ativoRef = useRef(false)       // gravação em andamento (não encerrada)
  const pausadoRef = useRef(false)
  const tentativasRef = useRef(0)
  const keepAliveRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const ganhoAltoDesdeRef = useRef<number | null>(null)
  const inicioRef = useRef(0)

  const publicar = useCallback(() => {
    const t = textoDasPalavras(palavrasRef.current)
    setTexto(t)
    onTextoRef.current(t)
  }, [])

  // ── WebSocket com o Deepgram ────────────────────────────────────────────
  const conectar = useCallback(async (): Promise<boolean> => {
    try {
      const r = await fetch('/api/deepgram-token', { method: 'POST' })
      const j = await r.json().catch(() => ({}))
      if (!j.access_token) throw new Error(j.error || 'sem token')
      const url = `wss://api.deepgram.com/v1/listen?${PARAMS_DEEPGRAM}&encoding=linear16&sample_rate=16000&channels=1`
        + `&interim_results=true&endpointing=300&utterance_end_ms=1200&vad_events=true&${paramsTermos(termosRef.current, 40)}`
      const ws = new WebSocket(url, ['bearer', j.access_token])
      ws.binaryType = 'arraybuffer'
      await new Promise<void>((ok, falha) => {
        const t = setTimeout(() => falha(new Error('tempo esgotado')), 7000)
        ws.onopen = () => { clearTimeout(t); ok() }
        ws.onerror = () => { clearTimeout(t); falha(new Error('falha ao conectar')) }
      })
      ws.onmessage = (m) => {
        try {
          const d = JSON.parse(typeof m.data === 'string' ? m.data : '')
          if (d.type !== 'Results') return
          const alt = d.channel?.alternatives?.[0]
          if (!alt) return
          if (d.is_final) {
            const ws_: Palavra[] = alt.words || []
            if (ws_.length) { palavrasRef.current.push(...ws_); publicar() }
            setParcial('')
          } else {
            setParcial((alt.transcript || '').trim())
          }
        } catch { /* mensagens não-JSON */ }
      }
      ws.onclose = () => {
        if (wsRef.current !== ws) return
        wsRef.current = null
        if (ativoRef.current) reconectar()
      }
      wsRef.current = ws
      tentativasRef.current = 0
      // envia o que ficou guardado durante a queda
      for (const b of pendenteRef.current.splice(0)) ws.send(b)
      setConexao('ao_vivo')
      return true
    } catch (e: any) {
      log.warn('[transcricao] conexão ao vivo falhou:', e?.message || e)
      return false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publicar])

  const reconectar = useCallback(async () => {
    if (!ativoRef.current) return
    setConexao('reconectando')
    while (ativoRef.current && tentativasRef.current < TENTATIVAS_RECONEXAO) {
      tentativasRef.current++
      await new Promise(r => setTimeout(r, Math.min(8000, 800 * 2 ** (tentativasRef.current - 1))))
      if (!ativoRef.current) return
      if (await conectar()) return
    }
    if (ativoRef.current) setConexao('sem_ao_vivo')
  }, [conectar])

  // ── Início ──────────────────────────────────────────────────────────────
  const iniciarGravacao = useCallback(async () => {
    setErro(null); setParcial(''); setVozBaixa(false)
    palavrasRef.current = []; pendenteRef.current = []; pedacosRef.current = []
    setTexto('')
    tentativasRef.current = 0
    ganhoAltoDesdeRef.current = null

    let stream: MediaStream
    const emprestado = opcoesRef.current.obterStream?.()
    try {
      if (emprestado && emprestado.getAudioTracks().length) {
        stream = new MediaStream(emprestado.getAudioTracks())
        streamProprioRef.current = false
      } else {
        streamProprioRef.current = true
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: false,   // o filtro do navegador corta voz baixa/distante
            autoGainControl: true,
          },
        })
      }
    } catch {
      setErro('Não foi possível acessar o microfone. Libere a permissão no navegador e tente de novo.')
      return
    }
    streamRef.current = stream

    try {
      const ctx = new AudioContext()
      ctxRef.current = ctx
      await ctx.audioWorklet.addModule('/worklets/captura-pcm.js')
      const fonte = ctx.createMediaStreamSource(stream)
      const no = new AudioWorkletNode(ctx, 'captura-pcm', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1] })
      noRef.current = no
      const destino = ctx.createMediaStreamDestination()
      fonte.connect(no).connect(destino)
      if (ctx.state === 'suspended') await ctx.resume()

      no.port.onmessage = (e) => {
        const d = e.data
        if (d.pcm) {
          const ws = wsRef.current
          if (ws && ws.readyState === WebSocket.OPEN) ws.send(d.pcm)
          else if (ativoRef.current) {
            pendenteRef.current.push(d.pcm)
            if (pendenteRef.current.length > MAX_PENDENTE) pendenteRef.current.shift()
          }
        } else if (d.nivel !== undefined) {
          setNivel(nivelDe(d.nivel))
          // ganho no máximo por vários segundos = voz chegando muito fraca
          if (d.ganho >= 25 && d.nivel > 0.0015) {
            ganhoAltoDesdeRef.current ??= Date.now()
            if (Date.now() - ganhoAltoDesdeRef.current > 4000) setVozBaixa(true)
          } else if (d.ganho < 18) {
            ganhoAltoDesdeRef.current = null
            setVozBaixa(false)
          }
        }
      }

      // Gravação do áudio já tratado, para a revisão final
      if (opcoesRef.current.revisaoFinal !== false && typeof MediaRecorder !== 'undefined') {
        const tipos = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus', 'audio/webm']
        const tipo = tipos.find(t => MediaRecorder.isTypeSupported(t))
        const rec = new MediaRecorder(destino.stream, { ...(tipo ? { mimeType: tipo } : {}), audioBitsPerSecond: 32000 })
        rec.ondataavailable = (e) => { if (e.data.size) pedacosRef.current.push(e.data) }
        rec.start(5000)
        gravadorRef.current = rec
      }
    } catch (e: any) {
      log.error('[transcricao] áudio', e)
      setErro('Seu navegador não conseguiu processar o áudio. Use o Chrome, Edge ou Safari atualizados.')
      if (streamProprioRef.current) stream.getTracks().forEach(t => t.stop())
      return
    }

    ativoRef.current = true
    pausadoRef.current = false
    inicioRef.current = Date.now()
    setPausado(false)
    setFase('gravando')
    setConexao('conectando')

    // Vocabulário (dicionário do médico + base) — não segura o início
    fetch('/api/transcrever/termos' + (opcoesRef.current.medicoId ? `?medico_id=${opcoesRef.current.medicoId}` : ''))
      .then(r => r.json()).then(j => { if (Array.isArray(j.termos)) termosRef.current = j.termos }).catch(() => {})
      .finally(async () => { if (ativoRef.current && !(await conectar())) reconectar() })

    keepAliveRef.current = setInterval(() => {
      const ws = wsRef.current
      if (pausadoRef.current && ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'KeepAlive' }))
    }, 5000)
  }, [conectar, reconectar])

  // ── Pausa ───────────────────────────────────────────────────────────────
  const pausarGravacao = useCallback(() => {
    const p = !pausadoRef.current
    pausadoRef.current = p
    noRef.current?.port.postMessage({ ativo: !p })
    const rec = gravadorRef.current
    if (rec) { if (p && rec.state === 'recording') rec.pause(); else if (!p && rec.state === 'paused') rec.resume() }
    setPausado(p)
    if (p) setParcial('')
  }, [])

  // ── Encerrar (retorna o texto final) ────────────────────────────────────
  const encerrarAudio = () => {
    if (keepAliveRef.current) { clearInterval(keepAliveRef.current); keepAliveRef.current = null }
    noRef.current?.port.postMessage({ ativo: false })
    if (streamProprioRef.current) streamRef.current?.getTracks().forEach(t => t.stop())
    fontesExtrasRef.current.forEach(f => { try { f.disconnect() } catch {} })
    fontesExtrasRef.current = []
    ctxRef.current?.close().catch(() => {})
    streamRef.current = null; ctxRef.current = null; noRef.current = null
  }

  const pararGravacao = useCallback(async (): Promise<string> => {
    if (!ativoRef.current) return textoDasPalavras(palavrasRef.current)
    ativoRef.current = false
    setFase('finalizando')
    setParcial('')

    // 1. Fecha o ao vivo esperando as últimas frases
    const ws = wsRef.current
    wsRef.current = null
    if (ws && ws.readyState === WebSocket.OPEN) {
      await new Promise<void>(ok => {
        const t = setTimeout(ok, 3000)
        ws.onclose = () => { clearTimeout(t); ok() }
        // Finalize descarrega o trecho em andamento; CloseStream encerra depois dele
        try { ws.send(JSON.stringify({ type: 'Finalize' })); ws.send(JSON.stringify({ type: 'CloseStream' })) } catch { clearTimeout(t); ok() }
      })
    }
    try { ws?.close() } catch {}

    // 2. Para o gravador e junta o áudio
    const rec = gravadorRef.current
    gravadorRef.current = null
    let audio: Blob | null = null
    if (rec && rec.state !== 'inactive') {
      await new Promise<void>(ok => { rec.onstop = () => ok(); rec.stop() })
      audio = new Blob(pedacosRef.current, { type: rec.mimeType || 'audio/webm' })
    }
    encerrarAudio()
    setNivel(0); setVozBaixa(false); setConexao('parado')

    const textoAoVivo = textoDasPalavras(palavrasRef.current)

    // 3. Revisão final do áudio inteiro
    const duracao = (Date.now() - inicioRef.current) / 1000
    if (audio && audio.size > 8000 && duracao > 4) {
      setFase('revisando')
      try {
        const ext = (audio.type.includes('mp4') ? 'm4a' : audio.type.includes('ogg') ? 'ogg' : 'webm')
        const p = await fetch('/api/transcrever/final', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ acao: 'preparar', extensao: ext }),
        }).then(r => r.json())
        if (!p.token) throw new Error(p.error || 'sem upload')
        const up = await supabase.storage.from(p.bucket).uploadToSignedUrl(p.caminho, p.token, audio, { contentType: audio.type || 'audio/webm' })
        if (up.error) throw up.error
        const f = await fetch('/api/transcrever/final', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ acao: 'transcrever', caminho: p.caminho, termos: termosRef.current }),
        }).then(r => r.json())
        const final = String(f.texto || '').trim()
        // Usa a revisão se ela não "perdeu" fala em relação ao ao vivo
        if (final && final.length >= textoAoVivo.length * 0.6) {
          setTexto(final)
          onTextoRef.current(final)
          setFase('parado')
          return final
        }
      } catch (e: any) {
        log.warn('[transcricao] revisão final falhou, mantendo o texto ao vivo:', e?.message || e)
      }
    }
    setFase('parado')
    return textoAoVivo
  }, [])

  /**
   * Mistura outra voz na transcrição (ex.: o áudio do paciente na teleconsulta).
   * Pode ser chamado a qualquer momento da gravação.
   */
  const adicionarFonte = useCallback((extra: MediaStream | null | undefined) => {
    const ctx = ctxRef.current, no = noRef.current
    if (!ctx || !no || !extra || !extra.getAudioTracks().length) return false
    try {
      const fonte = ctx.createMediaStreamSource(new MediaStream(extra.getAudioTracks()))
      fonte.connect(no)
      fontesExtrasRef.current.push(fonte)
      return true
    } catch { return false }
  }, [])

  const limpar = useCallback(() => {
    palavrasRef.current = []
    setTexto(''); setParcial(''); setErro(null)
  }, [])

  // Sai da página no meio da gravação: libera microfone e conexão
  useEffect(() => () => {
    ativoRef.current = false
    try { wsRef.current?.close() } catch {}
    try { gravadorRef.current?.stop() } catch {}
    encerrarAudio()
  }, [])

  const gravando = fase === 'gravando'
  return {
    // compatível com o useGravador antigo
    gravando,
    gravandoPausado: pausado,
    transcrevendo: fase === 'finalizando' || fase === 'revisando',
    transcricaoAcumulada: texto,
    iniciarGravacao,
    pararGravacao,
    pausarGravacao,
    limpar,
    erro,
    // novos
    adicionarFonte,
    fase,
    parcial,
    nivel,
    vozBaixa,
    conexao,
  }
}
