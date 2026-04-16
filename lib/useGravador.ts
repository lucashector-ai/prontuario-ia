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

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const intervaloRef = useRef<NodeJS.Timeout | null>(null)
  const textoRef = useRef('')
  const pausadoRef = useRef(false)

  const getMimeType = (): string => {
    const tipos = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4']
    for (const tipo of tipos) {
      if (MediaRecorder.isTypeSupported(tipo)) return tipo
    }
    return ''
  }

  const enviarChunk = useCallback(async () => {
    if (chunksRef.current.length === 0 || pausadoRef.current) return

    const chunks = [...chunksRef.current]
    chunksRef.current = []

    if (chunks.length === 0) return

    const mimeType = getMimeType()
    const blob = new Blob(chunks, { type: mimeType || 'audio/webm' })

    if (blob.size < 1000) return

    setTranscrevendo(true)
    console.log('Enviando chunk:', blob.size, 'bytes,', blob.type)
    try {
      const ext = mimeType.includes('mp4') ? 'mp4' : mimeType.includes('ogg') ? 'ogg' : 'webm'
      const form = new FormData()
      form.append('audio', blob, 'audio.' + ext)
      const res = await fetch('/api/transcrever', { method: 'POST', body: form })
      const data = await res.json()

      if (data.texto?.trim()) {
        const texto = data.texto.trim()
        const alucinacoes = ['www.', 'acesse o site', 'visite o nosso site', 'inscreva-se', 'obrigado por assistir', 'subtitle', 'legenda', '[música]', '[music]']
        if (alucinacoes.some(p => texto.toLowerCase().includes(p))) return

        textoRef.current = (textoRef.current + ' ' + texto).trim()
        setTranscricaoAcumulada(textoRef.current)
        onNovoTexto(textoRef.current)
      }
    } catch (e) {
      console.error('Erro transcricao:', e)
    } finally {
      setTranscrevendo(false)
    }
  }, [onNovoTexto])

  const iniciarGravacao = useCallback(async () => {
    setErro(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      })
      streamRef.current = stream
      chunksRef.current = []
      pausadoRef.current = false

      const mimeType = getMimeType()
      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      mediaRecorderRef.current = mr

      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0 && !pausadoRef.current) {
          chunksRef.current.push(e.data)
        }
      }

      mr.start(1000) // coleta chunks a cada 2s
      setGravando(true)

      // Envia para transcricao a cada 5s
      intervaloRef.current = setInterval(enviarChunk, 6000)
    } catch (e: any) {
      setErro('Nao foi possivel acessar o microfone. Verifique as permissoes.')
    }
  }, [enviarChunk])

  const pararGravacao = useCallback(() => {
    if (intervaloRef.current) clearInterval(intervaloRef.current)
    pausadoRef.current = false

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }

    streamRef.current?.getTracks().forEach(t => t.stop())
    setGravando(false)
    setGravandoPausado(false)

    // Envia ultimo chunk apos 500ms
    setTimeout(enviarChunk, 500)
  }, [enviarChunk])

  const pausarGravacao = useCallback(() => {
    if (!mediaRecorderRef.current) return
    if (!gravandoPausado) {
      if (mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.pause()
      }
      if (intervaloRef.current) clearInterval(intervaloRef.current)
      pausadoRef.current = true
      setGravandoPausado(true)
    } else {
      if (mediaRecorderRef.current.state === 'paused') {
        mediaRecorderRef.current.resume()
      }
      pausadoRef.current = false
      intervaloRef.current = setInterval(enviarChunk, 6000)
      setGravandoPausado(false)
    }
  }, [gravandoPausado, enviarChunk])

  const limpar = useCallback(() => {
    textoRef.current = ''
    chunksRef.current = []
    setTranscricaoAcumulada('')
    setErro(null)
    setTranscrevendo(false)
  }, [])

  return { gravando, transcrevendo, transcricaoAcumulada, iniciarGravacao, pararGravacao, pausarGravacao, gravandoPausado, limpar, erro }
}
