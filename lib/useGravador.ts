'use client'

import { useRef, useState, useCallback } from 'react'

interface UseGravadorReturn {
  gravando: boolean
  transcricaoAcumulada: string
  iniciarGravacao: () => Promise<void>
  pararGravacao: () => void
  limpar: () => void
  erro: string | null
}

export function useGravador(onNovoTexto: (texto: string) => void): UseGravadorReturn {
  const [gravando, setGravando] = useState(false)
  const [transcricaoAcumulada, setTranscricaoAcumulada] = useState('')
  const [erro, setErro] = useState<string | null>(null)

  const audioContextRef = useRef<AudioContext | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const intervaloRef = useRef<NodeJS.Timeout | null>(null)
  const samplesRef = useRef<Float32Array[]>([])
  const textoRef = useRef('')

  const float32ToWav = (samples: Float32Array, sampleRate: number): Blob => {
    const buffer = new ArrayBuffer(44 + samples.length * 2)
    const view = new DataView(buffer)
    const writeStr = (off: number, str: string) => { for (let i = 0; i < str.length; i++) view.setUint8(off + i, str.charCodeAt(i)) }
    writeStr(0, 'RIFF')
    view.setUint32(4, 36 + samples.length * 2, true)
    writeStr(8, 'WAVE')
    writeStr(12, 'fmt ')
    view.setUint32(16, 16, true)
    view.setUint16(20, 1, true)
    view.setUint16(22, 1, true)
    view.setUint32(24, sampleRate, true)
    view.setUint32(28, sampleRate * 2, true)
    view.setUint16(32, 2, true)
    view.setUint16(34, 16, true)
    writeStr(36, 'data')
    view.setUint32(40, samples.length * 2, true)
    let off = 44
    for (let i = 0; i < samples.length; i++, off += 2) {
      const s = Math.max(-1, Math.min(1, samples[i]))
      view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true)
    }
    return new Blob([buffer], { type: 'audio/wav' })
  }

  const enviarAudio = useCallback(async () => {
    if (samplesRef.current.length === 0) return
    const total = samplesRef.current.reduce((acc, a) => acc + a.length, 0)
    if (total < 4000) return
    const merged = new Float32Array(total)
    let offset = 0
    for (const chunk of samplesRef.current) { merged.set(chunk, offset); offset += chunk.length }
    samplesRef.current = []

    const sampleRate = audioContextRef.current?.sampleRate || 16000
    const wav = float32ToWav(merged, sampleRate)

    try {
      const form = new FormData()
      form.append('audio', wav, 'audio.wav')
      const res = await fetch('/api/transcrever', { method: 'POST', body: form })
      const data = await res.json()
      if (data.texto?.trim()) {
        textoRef.current += ' ' + data.texto
        const limpo = textoRef.current.trim()
        setTranscricaoAcumulada(limpo)
        onNovoTexto(limpo)
      }
    } catch (e) {
      console.error('Erro transcrição:', e)
    }
  }, [onNovoTexto])

  const iniciarGravacao = useCallback(async () => {
    setErro(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const ctx = new AudioContext({ sampleRate: 16000 })
      audioContextRef.current = ctx
      const source = ctx.createMediaStreamSource(stream)
      const processor = ctx.createScriptProcessor(4096, 1, 1)
      processorRef.current = processor
      processor.onaudioprocess = (e) => {
        const data = e.inputBuffer.getChannelData(0)
        samplesRef.current.push(new Float32Array(data))
      }
      source.connect(processor)
      processor.connect(ctx.destination)
      setGravando(true)
      intervaloRef.current = setInterval(enviarAudio, 8000)
    } catch (e: any) {
      setErro('Não foi possível acessar o microfone. Verifique as permissões do navegador.')
    }
  }, [enviarAudio])

  const pararGravacao = useCallback(() => {
    if (intervaloRef.current) clearInterval(intervaloRef.current)
    processorRef.current?.disconnect()
    audioContextRef.current?.close()
    streamRef.current?.getTracks().forEach(t => t.stop())
    setTimeout(enviarAudio, 300)
    setGravando(false)
  }, [enviarAudio])

  const limpar = useCallback(() => {
    textoRef.current = ''
    setTranscricaoAcumulada('')
    samplesRef.current = []
    setErro(null)
  }, [])

  return { gravando, transcricaoAcumulada, iniciarGravacao, pararGravacao, limpar, erro }
}
