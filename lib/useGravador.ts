'use client'

import { useRef, useState, useCallback, useEffect } from 'react'

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

const TERMOS_MEDICOS = [
  'losartana', 'metformina', 'omeprazol', 'atenolol', 'sinvastatina',
  'amoxicilina', 'azitromicina', 'dipirona', 'ibuprofeno', 'paracetamol',
  'enalapril', 'anlodipino', 'hidroclorotiazida', 'levotiroxina', 'prednisona',
  'hemograma', 'glicemia', 'HbA1c', 'TSH', 'creatinina', 'ureia', 'TGO', 'TGP',
  'colesterol', 'triglicerídeos', 'PSA', 'ecocardiograma', 'hipertensão',
  'diabetes', 'hipotireoidismo', 'dislipidemia', 'cefaleia', 'dispneia',
  'taquicardia', 'bradicardia', 'edema', 'tontura', 'náusea', 'vômito',
  'pressão arterial', 'frequência cardíaca', 'saturação de oxigênio',
]

export function useGravador(onNovoTexto: (texto: string) => void): UseGravadorReturn {
  const [gravando, setGravando] = useState(false)
  const [transcrevendo, setTranscrevendo] = useState(false)
  const [transcricaoAcumulada, setTranscricaoAcumulada] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [gravandoPausado, setGravandoPausado] = useState(false)

  const wsRef = useRef<WebSocket | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const textoRef = useRef('')
  const pausadoRef = useRef(false)

  const limpar = useCallback(() => {
    textoRef.current = ''
    setTranscricaoAcumulada('')
    setErro(null)
    setTranscrevendo(false)
  }, [])

  const conectarDeepgram = useCallback(async (): Promise<WebSocket> => {
    // Busca token temporário do servidor (não expõe a key no cliente)
    const res = await fetch('/api/deepgram-token')
    const { token } = await res.json()

    const params = new URLSearchParams({
      model: 'nova-3-medical',
      language: 'pt-BR',
      smart_format: 'true',
      punctuate: 'true',
      interim_results: 'true',
      utterance_end_ms: '1000',
      vad_events: 'true',
      encoding: 'linear16',
      sample_rate: '16000',
      channels: '1',
      keyterm: TERMOS_MEDICOS.slice(0, 50).join('&keyterm='),
    })

    // Deepgram aceita a key como query param no WebSocket
    params.set('access_token', token)
    const ws = new WebSocket(
      `wss://api.deepgram.com/v1/listen?${params.toString()}`
    )

    return new Promise((resolve, reject) => {
      ws.onopen = () => resolve(ws)
      ws.onerror = () => reject(new Error('Erro ao conectar com Deepgram'))
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (data.type === 'Results') {
            const alt = data.channel?.alternatives?.[0]
            const transcript = alt?.transcript || ''
            const isFinal = data.is_final

            if (isFinal && transcript.trim()) {
              setTranscrevendo(false)
              textoRef.current = (textoRef.current + ' ' + transcript).trim()
              setTranscricaoAcumulada(textoRef.current)
              onNovoTexto(textoRef.current)
            } else if (!isFinal && transcript.trim()) {
              setTranscrevendo(true)
            }
          } else if (data.type === 'UtteranceEnd') {
            setTranscrevendo(false)
          }
        } catch (e) {
          console.error('Deepgram parse error:', e)
        }
      }
      ws.onclose = () => {
        setTranscrevendo(false)
      }
      setTimeout(() => reject(new Error('Timeout')), 5000)
    })
  }, [onNovoTexto])

  const iniciarGravacao = useCallback(async () => {
    setErro(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      })
      streamRef.current = stream
      pausadoRef.current = false

      const ws = await conectarDeepgram()
      wsRef.current = ws

      // AudioContext para enviar PCM16 raw ao Deepgram
      const audioCtx = new AudioContext({ sampleRate: 16000 })
      const source = audioCtx.createMediaStreamSource(stream)
      const processor = audioCtx.createScriptProcessor(4096, 1, 1)

      processor.onaudioprocess = (e) => {
        if (pausadoRef.current) return
        if (ws.readyState !== WebSocket.OPEN) return
        const float32 = e.inputBuffer.getChannelData(0)
        const int16 = new Int16Array(float32.length)
        for (let i = 0; i < float32.length; i++) {
          int16[i] = Math.max(-32768, Math.min(32767, float32[i] * 32768))
        }
        ws.send(int16.buffer)
      }

      source.connect(processor)
      processor.connect(audioCtx.destination)

      // Guarda referência para desconectar depois
      ;(wsRef.current as any)._audioCtx = audioCtx
      ;(wsRef.current as any)._processor = processor
      ;(wsRef.current as any)._source = source

      setGravando(true)
    } catch (e: any) {
      setErro('Não foi possível iniciar a gravação. Verifique o microfone e tente novamente.')
      console.error('Erro gravacao:', e)
    }
  }, [conectarDeepgram])

  const pararGravacao = useCallback(() => {
    pausadoRef.current = false

    const ws = wsRef.current
    if (ws) {
      const ctx = (ws as any)._audioCtx
      const proc = (ws as any)._processor
      const src = (ws as any)._source
      proc?.disconnect()
      src?.disconnect()
      ctx?.close()
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'CloseStream' }))
        setTimeout(() => ws.close(), 500)
      }
    }

    streamRef.current?.getTracks().forEach(t => t.stop())
    setGravando(false)
    setGravandoPausado(false)
    setTranscrevendo(false)
  }, [])

  const pausarGravacao = useCallback(() => {
    if (!gravandoPausado) {
      pausadoRef.current = true
      setGravandoPausado(true)
    } else {
      pausadoRef.current = false
      setGravandoPausado(false)
    }
  }, [gravandoPausado])

  return {
    gravando, transcrevendo, transcricaoAcumulada,
    iniciarGravacao, pararGravacao, pausarGravacao,
    gravandoPausado, limpar, erro
  }
}
