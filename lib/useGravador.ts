'use client'

import { useRef, useState, useCallback } from 'react'

interface UseGravadorReturn {
  gravando: boolean
  transcrevendo: boolean
  transcricaoAcumulada: string
  iniciarGravacao: () => Promise<void>
  pararGravacao: () => void
  pausarGravacao: () => void
  gravandoPausado: boolean
  limpar: () => void
  erro: string | null
}

export function useGravador(onNovoTexto: (texto: string) => void): UseGravadorReturn {
  const [gravando, setGravando] = useState(false)
  const [transcrevendo, setTranscrevendo] = useState(false)
  const [transcricaoAcumulada, setTranscricaoAcumulada] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [gravandoPausado, setGravandoPausado] = useState(false)

  const audioCtxRef = useRef<AudioContext | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const intervaloRef = useRef<NodeJS.Timeout | null>(null)
  const samplesRef = useRef<Float32Array[]>([])
  const textoRef = useRef('')
  const pausadoRef = useRef(false)

  const float32ToWav = (samples: Float32Array, sampleRate: number): Blob => {
    const buffer = new ArrayBuffer(44 + samples.length * 2)
    const view = new DataView(buffer)
    const write = (off: number, str: string) => {
      for (let i = 0; i < str.length; i++) view.setUint8(off + i, str.charCodeAt(i))
    }
    write(0, 'RIFF'); view.setUint32(4, 36 + samples.length * 2, true)
    write(8, 'WAVE'); write(12, 'fmt '); view.setUint32(16, 16, true)
    view.setUint16(20, 1, true); view.setUint16(22, 1, true)
    view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true)
    view.setUint16(32, 2, true); view.setUint16(34, 16, true)
    write(36, 'data'); view.setUint32(40, samples.length * 2, true)
    let off = 44
    for (let i = 0; i < samples.length; i++, off += 2) {
      const s = Math.max(-1, Math.min(1, samples[i]))
      view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true)
    }
    return new Blob([buffer], { type: 'audio/wav' })
  }

  const temVoz = (samples: Float32Array): boolean => {
    let sum = 0
    for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i]
    return Math.sqrt(sum / samples.length) > 0.0001
  }

  const enviarParaDeepgram = useCallback(async () => {
    if (samplesRef.current.length === 0 || pausadoRef.current) return
    const total = samplesRef.current.reduce((a, b) => a + b.length, 0)
    if (total < 8000) { samplesRef.current = []; return }

    const merged = new Float32Array(total)
    let offset = 0
    for (const chunk of samplesRef.current) { merged.set(chunk, offset); offset += chunk.length }
    samplesRef.current = []

    if (!temVoz(merged)) return

    const sampleRate = audioCtxRef.current?.sampleRate || 16000
    const wav = float32ToWav(merged, sampleRate)
    console.log('Enviando audio:', wav.size, 'bytes, samples:', total, 'sampleRate:', sampleRate)

    setTranscrevendo(true)
    try {
      const form = new FormData()
      form.append('audio', wav, 'audio.wav')
      const res = await fetch('/api/transcrever', { method: 'POST', body: form })
      const data = await res.json()

      console.log('Resposta Deepgram:', JSON.stringify(data))
      if (data.texto?.trim()) {
        const texto = data.texto.trim()
        const alucinacoes = ['www.', 'acesse o site', 'inscreva-se', 'obrigado por assistir', 'subtitle', 'legenda', '[música]', '[music]']
        if (alucinacoes.some(p => texto.toLowerCase().includes(p))) return
        textoRef.current = (textoRef.current + ' ' + texto).trim()
        setTranscricaoAcumulada(textoRef.current)
        onNovoTexto(textoRef.current)
      }
    } catch (e) { console.error('Erro transcrever:', e) }
    finally { setTranscrevendo(false) }
  }, [onNovoTexto])

  const iniciarGravacao = useCallback(async () => {
    setErro(null)
    samplesRef.current = []
    pausadoRef.current = false
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      })
      streamRef.current = stream

      const ctx = new AudioContext({ sampleRate: 16000 })
      audioCtxRef.current = ctx
      const source = ctx.createMediaStreamSource(stream)
      sourceRef.current = source
      const processor = ctx.createScriptProcessor(4096, 1, 1)
      processorRef.current = processor

      processor.onaudioprocess = (e) => {
        if (pausadoRef.current) return
        samplesRef.current.push(new Float32Array(e.inputBuffer.getChannelData(0)))
      }

      source.connect(processor)
      processor.connect(ctx.destination)
      setGravando(true)
      intervaloRef.current = setInterval(enviarParaDeepgram, 4000)
    } catch (e: any) {
      setErro('Não foi possível acessar o microfone. Verifique as permissões.')
    }
  }, [enviarParaDeepgram])

  const pararGravacao = useCallback(() => {
    if (intervaloRef.current) clearInterval(intervaloRef.current)
    processorRef.current?.disconnect()
    sourceRef.current?.disconnect()
    audioCtxRef.current?.close()
    streamRef.current?.getTracks().forEach(t => t.stop())
    pausadoRef.current = false
    setGravando(false)
    setGravandoPausado(false)
    setTimeout(enviarParaDeepgram, 300)
  }, [enviarParaDeepgram])

  const pausarGravacao = useCallback(() => {
    if (!gravandoPausado) {
      pausadoRef.current = true
      if (intervaloRef.current) clearInterval(intervaloRef.current)
      processorRef.current?.disconnect()
      setGravandoPausado(true)
    } else {
      pausadoRef.current = false
      if (processorRef.current && audioCtxRef.current && sourceRef.current) {
        sourceRef.current.connect(processorRef.current)
        processorRef.current.connect(audioCtxRef.current.destination)
      }
      intervaloRef.current = setInterval(enviarParaDeepgram, 4000)
      setGravandoPausado(false)
    }
  }, [gravandoPausado, enviarParaDeepgram])

  const limpar = useCallback(() => {
    textoRef.current = ''
    samplesRef.current = []
    setTranscricaoAcumulada('')
    setErro(null)
    setTranscrevendo(false)
  }, [])

  return { gravando, transcrevendo, transcricaoAcumulada, iniciarGravacao, pararGravacao, pausarGravacao, gravandoPausado, limpar, erro }
}
