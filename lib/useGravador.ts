'use client'

import { useRef, useState, useCallback } from 'react'

interface UseGravadorReturn {
  gravando: boolean
  transcrevendo: boolean
  transcricaoAcumulada: string
  iniciarGravacao: () => Promise<void>
  pararGravacao: () => void
  limpar: () => void
  erro: string | null
}

export function useGravador(onNovoTexto: (texto: string) => void): UseGravadorReturn {
  const [gravando, setGravando] = useState(false)
  const [transcrevendo, setTranscrevendo] = useState(false)
  const [transcricaoAcumulada, setTranscricaoAcumulada] = useState('')
  const [erro, setErro] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const intervaloRef = useRef<NodeJS.Timeout | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const textoRef = useRef('')

  // Detecta volume atual do microfone via AnalyserNode
  const getVolume = (): number => {
    if (!analyserRef.current) return 0
    const data = new Uint8Array(analyserRef.current.frequencyBinCount)
    analyserRef.current.getByteFrequencyData(data)
    return data.reduce((a, b) => a + b, 0) / data.length
  }

  const enviarChunks = useCallback(async () => {
    if (chunksRef.current.length === 0) return

    // Verifica volume — se abaixo de 5 (escala 0-255) é silêncio
    const volume = getVolume()
    if (volume < 5) {
      console.log('Silêncio — descartando, volume:', volume)
      chunksRef.current = []
      return
    }

    const mimeType = mediaRecorderRef.current?.mimeType || 'audio/webm'
    const blob = new Blob(chunksRef.current, { type: mimeType })
    chunksRef.current = []

    if (blob.size < 5000) return // muito pequeno

    const ext = mimeType.includes('mp4') ? 'mp4'
              : mimeType.includes('ogg') ? 'ogg'
              : 'webm'

    setTranscrevendo(true)
    try {
      const form = new FormData()
      form.append('audio', blob, `audio.${ext}`)
      const res = await fetch('/api/transcrever', { method: 'POST', body: form })
      const data = await res.json()

      if (data.texto?.trim()) {
        const texto = data.texto.trim()
        // Filtra alucinações conhecidas do Whisper
        const padroes = ['www.', '.com', '.br', '.pt', 'para mais informações',
          'inscreva-se', 'obrigado por assistir', 'legendas', '♪', 'música',
          'acesse o site', 'visite o nosso', 'nova acrópole', 'opus dei',
          'marco paret', 'transcrição automática']
        const ehAlucinacao = padroes.some(p => texto.toLowerCase().includes(p))
        if (ehAlucinacao) { console.log('Alucinação filtrada:', texto); return }

        textoRef.current = (textoRef.current + ' ' + texto).trim()
        setTranscricaoAcumulada(textoRef.current)
        onNovoTexto(textoRef.current)
      }
    } catch (e) { console.error('Erro transcrição:', e) }
    finally { setTranscrevendo(false) }
  }, [onNovoTexto])

  const iniciarGravacao = useCallback(async () => {
    setErro(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      })
      streamRef.current = stream

      // Analyser para detectar volume em tempo real
      const ctx = new AudioContext()
      audioCtxRef.current = ctx
      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)
      analyserRef.current = analyser

      // Detecta formato suportado
      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', '']
        .find(m => m === '' || MediaRecorder.isTypeSupported(m)) || ''

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {})
      mediaRecorderRef.current = recorder
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.start(1000)
      setGravando(true)

      // Envia a cada 5 segundos
      intervaloRef.current = setInterval(enviarChunks, 5000)
    } catch (e: any) {
      setErro('Não foi possível acessar o microfone. Verifique as permissões do navegador.')
    }
  }, [enviarChunks])

  const pararGravacao = useCallback(() => {
    if (intervaloRef.current) clearInterval(intervaloRef.current)
    if (mediaRecorderRef.current?.state !== 'inactive') mediaRecorderRef.current?.stop()
    streamRef.current?.getTracks().forEach(t => t.stop())
    audioCtxRef.current?.close()
    setTimeout(enviarChunks, 500)
    setGravando(false)
  }, [enviarChunks])

  const limpar = useCallback(() => {
    textoRef.current = ''
    setTranscricaoAcumulada('')
    chunksRef.current = []
    setErro(null)
    setTranscrevendo(false)
  }, [])

  return { gravando, transcrevendo, transcricaoAcumulada, iniciarGravacao, pararGravacao, limpar, erro }
}
