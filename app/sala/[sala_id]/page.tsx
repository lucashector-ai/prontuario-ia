'use client'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const ICE = { iceServers: [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
]}

type Tela = 'carregando' | 'precall' | 'espera' | 'chamada' | 'encerrado' | 'encerrada_paciente' | 'erro'

export default function Sala({ params }: { params: { sala_id: string } }) {
  const { sala_id } = params
  const [tela, setTela] = useState<Tela>('carregando')
  const [sala, setSala] = useState<any>(null)
  const [isMedico, setIsMedico] = useState(false)
  const [micOn, setMicOn] = useState(true)
  const [camOn, setCamOn] = useState(true)
  const [chatAberto, setChatAberto] = useState(false)
  const [chat, setChat] = useState<{de:string;msg:string;hora:string}[]>([])
  const [msgInput, setMsgInput] = useState('')
  const [naoLidas, setNaoLidas] = useState(0)
  const [timer, setTimer] = useState(0)
  const [erro, setErro] = useState('')
  const [micVol, setMicVol] = useState(0)
  const [camOkEspera, setCamOkEspera] = useState(false)
  const [micOkEspera, setMicOkEspera] = useState(false)
  const [entrando, setEntrando] = useState(false)
  const [remoteConectado, setRemoteConectado] = useState(false)
  const [anexos, setAnexos] = useState<{nome:string;url:string;tipo:string;de:string;hora:string}[]>([])
  const [enviandoAnexo, setEnviandoAnexo] = useState(false)
  const anexoInputRef = useRef<HTMLInputElement>(null)
  // Fase 4: Transcrio
  const [gravando, setGravando] = useState(false)
  const [gravandoPausado, setGravandoPausado] = useState(false)
  const [transcricaoFinal, setTranscricaoFinal] = useState('')
  const [prontuarioFinal, setProntuarioFinal] = useState<any>(null)
  const [configAberto, setConfigAberto] = useState(false)
  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([])
  const [videoInputs, setVideoInputs] = useState<MediaDeviceInfo[]>([])
  const [transcricao, setTranscricao] = useState('')
  const [processando, setProcessando] = useState(false)
  const [prontuarioModal, setProntuarioModal] = useState(false)
  const [prontuarioData, setProntuarioData] = useState<any>(null)
  const [salvando, setSalvando] = useState(false)
  const [salvado, setSalvado] = useState(false)
  const camposRef = useRef<Record<string, string>>({})
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const localRef = useRef<HTMLVideoElement>(null)
  const remoteRef = useRef<HTMLVideoElement>(null)
  const esperaRef = useRef<HTMLVideoElement>(null)
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const esperaStreamRef = useRef<MediaStream | null>(null)
  const channelRef = useRef<any>(null)
  const timerRef = useRef<any>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const volFrameRef = useRef<number>(0)
  const papelRef = useRef('')
  const iceBufRef = useRef<RTCIceCandidateInit[]>([])
  const remoteSetRef = useRef(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const med = localStorage.getItem('medico')
    papelRef.current = med ? 'medico' : 'paciente'
    setIsMedico(!!med)
    carregarSala()
    return () => pararEspera()
  }, [sala_id])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chat])

  useEffect(() => {
    if (chatAberto) setNaoLidas(0)
  }, [chatAberto])

  // Conecta stream local ao PiP quando tela de chamada renderiza
  // Usa setTimeout pois o ref pode no estar pronto no primeiro tick
  useEffect(() => {
    if ((tela === 'chamada' || tela === 'precall') && streamRef.current) {
      const conectar = () => {
        if (localRef.current && streamRef.current) {
          localRef.current.srcObject = streamRef.current
        }
      }
      conectar()
      // Retry aps 100ms por segurana (ref pode estar null no primeiro tick)
      const t = setTimeout(conectar, 100)
      return () => clearTimeout(t)
    }
  }, [tela])

  const carregarSala = async () => {
    const { data } = await sb.from('teleconsultas').select('*').eq('sala_id', sala_id).single()
    if (!data) { setErro('Sala nao encontrada ou link expirado.'); setTela('erro'); return }
    if (data.status === 'encerrada') {
      await sb.from('teleconsultas').update({ status: 'aguardando', encerrada_em: null }).eq('sala_id', sala_id)
      data.status = 'aguardando'
    }
    setSala(data)
    iniciarEspera()
  }

  //  SALA DE ESPERA 
  const iniciarEspera = async () => {
    if (papelRef.current === 'medico') {
      setTela('precall')
    } else {
      setTela('espera')
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      esperaStreamRef.current = stream
      if (esperaRef.current) esperaRef.current.srcObject = stream
      setCamOkEspera(true)

      // Analisador de volume do mic
      const ctx = new AudioContext()
      const src = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      src.connect(analyser)
      analyserRef.current = analyser
      setMicOkEspera(true)

      const loop = () => {
        const buf = new Uint8Array(analyser.frequencyBinCount)
        analyser.getByteFrequencyData(buf)
        const avg = buf.reduce((a, b) => a + b, 0) / buf.length
        setMicVol(Math.min(100, avg * 2.5))
        volFrameRef.current = requestAnimationFrame(loop)
      }
      loop()
    } catch {
      setErro('Sem acesso a camera/microfone. Verifique as permissoes no browser.')
      setTela('erro')
    }
  }

  const pararEspera = () => {
    esperaStreamRef.current?.getTracks().forEach(t => t.stop())
    cancelAnimationFrame(volFrameRef.current)
  }

  //  ENTRAR NA CHAMADA 
  const entrarNaChamada = async () => {
    setEntrando(true)
    pararEspera()

    const papel = papelRef.current
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    } catch {
      setErro('Sem acesso a camera/microfone.')
      setTela('erro')
      return
    }
    streamRef.current = stream
    if (localRef.current) localRef.current.srcObject = stream

    const pc = new RTCPeerConnection(ICE)
    pcRef.current = pc
    stream.getTracks().forEach(t => pc.addTrack(t, stream))

    // Keepalive data channel
    try {
      const dc = pc.createDataChannel('keepalive')
      dc.onopen = () => {
        const ping = setInterval(() => {
          try { if (dc.readyState === 'open') dc.send('ping') } catch {}
          if (dc.readyState === 'closed') clearInterval(ping)
        }, 10000)
      }
    } catch {}

    pc.ontrack = (e) => {
      if (remoteRef.current && e.streams[0]) {
        remoteRef.current.srcObject = e.streams[0]
        setRemoteConectado(true)
        setEntrando(false)
        tocarSom('entrada')
        if (!timerRef.current) timerRef.current = setInterval(() => setTimer(t => t + 1), 1000)
        sb.from('teleconsultas').update({ status: 'em_andamento', iniciada_em: new Date().toISOString() }).eq('sala_id', sala_id)
      }
    }

    pc.onicecandidate = (e) => {
      if (e.candidate) send('ice', e.candidate.toJSON())
    }

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected') {
        // Queda momentanea  nao encerra
      }
      if (pc.connectionState === 'failed') pc.restartIce()
    }

    const channel = sb.channel('sala:' + sala_id, { config: { broadcast: { self: false } } })
      .on('broadcast', { event: 'offer' }, async ({ payload }) => {
        if (payload.de === papel) return
        await pc.setRemoteDescription(new RTCSessionDescription(payload.dados))
        remoteSetRef.current = true
        for (const c of iceBufRef.current) { try { await pc.addIceCandidate(new RTCIceCandidate(c)) } catch {} }
        iceBufRef.current = []
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        send('answer', { type: answer.type, sdp: answer.sdp })
      })
      .on('broadcast', { event: 'answer' }, async ({ payload }) => {
        if (payload.de === papel) return
        if (pc.signalingState === 'have-local-offer') {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.dados))
          remoteSetRef.current = true
          for (const c of iceBufRef.current) { try { await pc.addIceCandidate(new RTCIceCandidate(c)) } catch {} }
          iceBufRef.current = []
        }
      })
      .on('broadcast', { event: 'ice' }, async ({ payload }) => {
        if (payload.de === papel) return
        if (remoteSetRef.current) { try { await pc.addIceCandidate(new RTCIceCandidate(payload.dados)) } catch {} }
        else iceBufRef.current.push(payload.dados)
      })
      .on('broadcast', { event: 'pronto' }, ({ payload }) => {
        if (payload.de === papel) return
        if (papel === 'medico') fazerOffer(pc)
      })
      .on('broadcast', { event: 'anexo' }, ({ payload }) => {
        if (payload.de === papelRef.current) return
        const hora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        const papel = papelRef.current
        setAnexos(p => [...p, { ...payload.dados, de: papel === 'medico' ? 'Paciente' : 'Medico', hora }])
        setNaoLidas(n => n + 1)
        tocarSom('mensagem')
        if (!chatAberto) setNaoLidas(n => n + 1)
      })
      .on('broadcast', { event: 'chat' }, ({ payload }) => {
        if (payload.de === papel) return
        const nova = { de: payload.de === 'medico' ? 'Medico' : 'Paciente', msg: payload.dados, hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) }
        setChat(p => [...p, nova])
        setNaoLidas(n => n + 1)
        tocarSom('mensagem')
      })
      .on('broadcast', { event: 'encerrar' }, () => {
        tocarSom('saida')
        encerrarLocal()
        if (papelRef.current === 'paciente') {
        clearInterval(timerRef.current as any)
        setTimer(0)
        setTimeout(() => { try { window.close() } catch {} window.location.href = '/login' }, 2000)
      }
      })
      .subscribe(async (s) => {
        if (s === 'SUBSCRIBED') {
          setTela('chamada')
          setEntrando(false)
          send('pronto', { papel })
          // Garante que o PiP recebe o stream aps render
          setTimeout(() => {
            if (localRef.current && streamRef.current) {
              localRef.current.srcObject = streamRef.current
            }
          }, 200)
          // Medico: inicia gravacao automaticamente
          if (papel === 'medico') setTimeout(() => iniciarGravacao(), 500)
        }
      })

    channelRef.current = channel
  }

  const fazerOffer = async (pc: RTCPeerConnection) => {
    if (pc.signalingState !== 'stable') return
    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    send('offer', { type: offer.type, sdp: offer.sdp })
  }

  const send = (tipo: string, dados: any) => {
    channelRef.current?.send({ type: 'broadcast', event: tipo, payload: { dados, de: papelRef.current } })
  }

  const encerrarLocal = () => {
    clearInterval(timerRef.current)
    pcRef.current?.close()
    streamRef.current?.getTracks().forEach(t => t.stop())
    channelRef.current?.unsubscribe()
    if (localRef.current) localRef.current.srcObject = null
    if (remoteRef.current) remoteRef.current.srcObject = null
    setTela('encerrado')
  }

  const encerrar = async () => {
    send('encerrar', {})
    await sb.from('teleconsultas').update({ status: 'encerrada', encerrada_em: new Date().toISOString(), duracao_segundos: timer }).eq('sala_id', sala_id)
    // Para gravacao
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop()
      setGravando(false)
    }
    encerrarLocal()
    if (papelRef.current === 'paciente') {
      setTimeout(() => { try { window.close() } catch {} }, 3000)
      return
    }
    // Medico: transcreve e gera prontuario
    if (papelRef.current === 'medico') {
      setProcessando(true)
      await new Promise(res => setTimeout(res, 300))
      const texto = await transcreverAudio()
      if (texto && texto.trim().length > 10) {
        await gerarProntuario(texto)
      } else {
        setProcessando(false)
      }
    }
  }

  const toggleMic = () => { streamRef.current?.getAudioTracks().forEach(t => { t.enabled = !t.enabled; setMicOn(t.enabled) }) }
  const toggleCam = () => { streamRef.current?.getVideoTracks().forEach(t => { t.enabled = !t.enabled; setCamOn(t.enabled) }) }
  // Inicia gravao  captura o udio local do mdico
  const iniciarGravacao = () => {
    if (!streamRef.current) return
    // Pega s as faixas de udio do stream local
    const audioStream = new MediaStream(streamRef.current.getAudioTracks())
    const recorder = new MediaRecorder(audioStream, { mimeType: 'audio/webm' })
    chunksRef.current = []
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }
    // Envia chunk a cada 30s para transcrio incremental
    recorder.start(30000)
    recorderRef.current = recorder
    setGravando(true)
  }

  const pararGravacao = () => {
    recorderRef.current?.stop()
    setGravando(false)
  }

  const toggleGravacao = () => {
    if (gravando) pararGravacao()
    else iniciarGravacao()
  }

  // Transcreve os chunks acumulados via Whisper
  const pausarGravacao = () => {
    if (!recorderRef.current) return
    if (recorderRef.current.state === 'recording') {
      recorderRef.current.pause()
      setGravandoPausado(true)
    } else if (recorderRef.current.state === 'paused') {
      recorderRef.current.resume()
      setGravandoPausado(false)
    }
  }

  const transcreverAudio = async (): Promise<string> => {
    if (chunksRef.current.length === 0) return transcricao
    const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
    if (blob.size < 1000) return transcricao
    const fd = new FormData()
    fd.append('audio', new File([blob], 'consulta.webm', { type: 'audio/webm' }))
    try {
      const r = await fetch('/api/transcrever', { method: 'POST', body: fd })
      const d = await r.json()
      if (d.texto) {
        const nova = transcricao ? transcricao + ' ' + d.texto : d.texto
        setTranscricao(nova)
        return nova
      }
    } catch {}
    return transcricao
  }

  // Gera pronturio a partir da transcrio via Claude
  const gerarProntuario = async (textoTranscricao: string) => {
    if (!textoTranscricao.trim()) return
    setProcessando(true)
    try {
      const r = await fetch('/api/estruturar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcricao: textoTranscricao })
      })
      const d = await r.json()
      if (d.estruturado || d.prontuario || d) {
        setProntuarioData(d)
        setProntuarioModal(true)
      }
    } catch {}
    setProcessando(false)
  }

  const salvarProntuario = async () => {
    if (salvando || salvado) return
    setSalvando(true)
    try {
      const med = JSON.parse(localStorage.getItem('medico') || '{}')
      const campos = camposRef.current
      const pd = prontuarioData?.prontuario ?? prontuarioData ?? {}
      const body = {
        medico_id: med.id,
        paciente_id: sala?.paciente_id || null,
        data_consulta: new Date().toISOString(),
        transcricao: transcricao || '',
        subjetivo:  campos.subjetivo  ?? pd.subjetivo  ?? '',
        objetivo:   campos.objetivo   ?? pd.objetivo   ?? '',
        avaliacao:  campos.avaliacao  ?? pd.avaliacao  ?? '',
        plano:      campos.plano      ?? pd.plano      ?? '',
        cids:       pd.cids    ?? [],
        alertas:    pd.alertas ?? [],
        receita:    campos.receita ?? pd.receita ?? '',
      }
      const r = await fetch('/api/consultas', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const d = await r.json()
      if (d.id) {
        setSalvado(true)
        setTimeout(() => { window.location.href = '/historico' }, 1500)
      }
    } catch (err) { console.error('Erro salvar:', err) }
    setSalvando(false)
  }

  const carregarDispositivos = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      setAudioInputs(devices.filter(d => d.kind === 'audioinput'))
      setVideoInputs(devices.filter(d => d.kind === 'videoinput'))
    } catch(e) {}
  }

  const tocarSom = (tipo: 'entrada' | 'saida' | 'mensagem') => {
    try {
      const ctx = new AudioContext()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      gain.gain.setValueAtTime(0.3, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6)
      if (tipo === 'entrada') {
        // Dois tons ascendentes  "ding dong"
        osc.frequency.setValueAtTime(520, ctx.currentTime)
        osc.frequency.setValueAtTime(660, ctx.currentTime + 0.15)
      } else if (tipo === 'saida') {
        // Dois tons descendentes
        osc.frequency.setValueAtTime(660, ctx.currentTime)
        osc.frequency.setValueAtTime(440, ctx.currentTime + 0.15)
      } else {
        // Mensagem  tom curto suave
        osc.frequency.setValueAtTime(880, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2)
      }
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 0.6)
    } catch {}
  }

  const fmtTimer = (s: number) => String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0')

  const enviarAnexo = async (file: File) => {
    if (!file || enviandoAnexo) return
    setEnviandoAnexo(true)
    try {
      // Converte para base64
      const base64 = await new Promise<string>((res, rej) => {
        const reader = new FileReader()
        reader.onload = () => res(reader.result as string)
        reader.onerror = rej
        reader.readAsDataURL(file)
      })
      const hora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      const anexo = { nome: file.name, url: base64, tipo: file.type, de: 'Voce', hora }
      setAnexos(p => [...p, anexo])
      // Envia pelo broadcast (base64 funciona para imagens/PDFs pequenos)
      send('anexo', { nome: file.name, url: base64, tipo: file.type })
      if (!chatAberto) { setChatAberto(true); setNaoLidas(0) }
    } catch { console.error('Erro ao enviar anexo') }
    setEnviandoAnexo(false)
  }

  const enviarChat = () => {
    if (!msgInput.trim()) return
    const msg = msgInput.trim(); setMsgInput('')
    setChat(p => [...p, { de: 'Voce', msg, hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) }])
    send('chat', msg)
  }

  //  TELAS 

  useEffect(() => {
    if (tela === 'chamada' || tela === 'precall') {
      if (localRef.current && streamRef.current) {
        localRef.current.srcObject = streamRef.current
      }
    }
  }, [tela])

  // Conecta stream ao video na precall
  useEffect(() => {
    if (tela === 'precall' && localRef.current && streamRef.current) {
      localRef.current.srcObject = streamRef.current
    }
  }, [tela])

  if (tela === 'carregando') return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a' }}>
      <div style={{ width: 48, height: 48, borderRadius: '50%', border: '3px solid #16a34a', borderTopColor: 'transparent', animation: 'spin 1s linear infinite' }}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  if (tela === 'erro') return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a', flexDirection: 'column', gap: 16, padding: 24 }}>
      <div style={{ width: 56, height: 56, borderRadius: 14, background: '#7f1d1d', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fca5a5" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
      </div>
      <p style={{ fontSize: 16, color: 'white', fontWeight: 600, margin: 0, textAlign: 'center', maxWidth: 320 }}>{erro}</p>
    </div>
  )

  if (tela === 'encerrado') return (
    <div style={{ minHeight: '100dvh', background: '#0f172a', overflowY: 'auto' }}>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '32px 16px' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
            <svg width='26' height='26' viewBox='0 0 24 24' fill='none' stroke='white' strokeWidth='2'><polyline points='20 6 9 17 4 12'/></svg>
          </div>
          <h1 style={{ color: 'white', fontSize: 22, fontWeight: 700, margin: '0 0 4px' }}>Consulta encerrada</h1>
          <p style={{ color: '#64748b', fontSize: 13, margin: 0 }}>Consulta - {String(sala_id).slice(-4).toUpperCase()}</p>
          {timer > 0 && <p style={{ color: '#475569', fontSize: 12, margin: '4px 0 0' }}>Duracao: {fmtTimer(timer)}</p>}
        </div>
        {transcricaoFinal ? (
          <div style={{ background: '#1e293b', borderRadius: 12, padding: 20, marginBottom: 16, border: '1px solid #334155' }}>
            <h2 style={{ color: '#60a5fa', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 12px' }}>Transcricao da consulta</h2>
            <p style={{ color: '#e2e8f0', fontSize: 14, lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap' }}>{transcricaoFinal}</p>
          </div>
        ) : (
          <div style={{ background: '#1e293b', borderRadius: 12, padding: 16, marginBottom: 16, border: '1px solid #334155', textAlign: 'center' }}>
            <p style={{ color: '#64748b', fontSize: 13, margin: 0 }}>Processando transcricao...</p>
          </div>
        )}
        {prontuarioFinal && (
          <div style={{ background: '#1e293b', borderRadius: 12, padding: 20, marginBottom: 16, border: '1px solid #334155' }}>
            <h2 style={{ color: '#34d399', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 16px' }}>Prontuario gerado</h2>
            {['subjetivo','objetivo','avaliacao','plano'].map((k: string) => (prontuarioFinal as any)[k] && (
              <div key={k} style={{ marginBottom: 14 }}>
                <p style={{ color: '#94a3b8', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', margin: '0 0 4px' }}>{k}</p>
                <p style={{ color: '#e2e8f0', fontSize: 14, lineHeight: 1.6, margin: 0 }}>{(prontuarioFinal as any)[k]}</p>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', marginTop: 8 }}>
          <button onClick={() => window.location.href = '/agenda'}
            style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: '#7c3aed', color: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            Agendar retorno
          </button>
          <button onClick={() => window.location.href = '/historico'}
            style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: '#2563eb', color: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            Ver historico
          </button>
          <button onClick={() => window.location.href = '/teleconsulta'}
            style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid #334155', background: 'transparent', color: '#94a3b8', fontSize: 14, cursor: 'pointer' }}>
            Nova consulta
          </button>
        </div>
      </div>
    </div>
  )

  if (tela === 'precall') return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0f172a', gap: 20, padding: 24 }}>
      <h1 style={{ color: 'white', fontSize: 20, fontWeight: 700, margin: 0 }}>Testar camera e microfone</h1>
      <p style={{ color: '#64748b', fontSize: 14, margin: 0 }}>Verifique se sua camera e microfone estao funcionando antes de entrar.</p>
      <div style={{ width: 'min(400px,90vw)', aspectRatio: '16/9', borderRadius: 12, overflow: 'hidden', background: '#111', border: '2px solid #1e293b', position: 'relative' }}>
        <video ref={localRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}/>
        <div style={{ position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 10 }}>
          <button onClick={toggleMic} style={{ width: 40, height: 40, borderRadius: '50%', border: 'none', background: micOn ? 'rgba(255,255,255,0.2)' : '#dc2626', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='white' strokeWidth='2'>
              {micOn ? <><path d='M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z'/><path d='M19 10v2a7 7 0 01-14 0v-2'/><line x1='12' y1='19' x2='12' y2='23'/></> : <><line x1='1' y1='1' x2='23' y2='23'/><path d='M9 9v3a3 3 0 005.12 2.12M15 9.34V4a3 3 0 00-5.94-.6'/></>}
            </svg>
          </button>
          <button onClick={toggleCam} style={{ width: 40, height: 40, borderRadius: '50%', border: 'none', background: camOn ? 'rgba(255,255,255,0.2)' : '#dc2626', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='white' strokeWidth='2'>
              {camOn ? <path d='M23 7l-7 5 7 5V7zM1 5a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2H3a2 2 0 01-2-2V5z'/> : <><line x1='1' y1='1' x2='23' y2='23'/><path d='M21 21H3a2 2 0 01-2-2V8m4-4h12a2 2 0 012 2v9.34'/></>}
            </svg>
          </button>
        </div>
      </div>
      <button onClick={() => { setTela('chamada') }}
        style={{ padding: '12px 32px', borderRadius: 10, border: 'none', background: '#16a34a', color: 'white', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
        Entrar na consulta
      </button>
    </div>
  )

  if (tela === 'espera') return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0f172a', gap: 20, padding: 24 }}>
      {papelRef.current === 'paciente' ? (
        <>
          <div style={{ width: 96, height: 96, borderRadius: '50%', background: 'linear-gradient(135deg,#1d4ed8,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width='44' height='44' viewBox='0 0 24 24' fill='none' stroke='white' strokeWidth='1.5'><path d='M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2'/><circle cx='12' cy='7' r='4'/></svg>
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ color: 'white', fontSize: 20, fontWeight: 700, margin: '0 0 8px' }}>Aguardando o medico</p>
            <p style={{ color: '#64748b', fontSize: 14, margin: 0 }}>O medico entrara em breve. Por favor, aguarde.</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e' }}/>
            <span style={{ color: '#22c55e', fontSize: 13, fontWeight: 600 }}>Conectado</span>
          </div>
        </>
      ) : (
        <>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#1e293b', border: '2px solid #334155', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width='32' height='32' viewBox='0 0 24 24' fill='none' stroke='#64748b' strokeWidth='1.5'><path d='M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2'/><circle cx='9' cy='7' r='4'/><path d='M23 21v-2a4 4 0 00-3-3.87'/><path d='M16 3.13a4 4 0 010 7.75'/></svg>
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ color: 'white', fontSize: 20, fontWeight: 700, margin: '0 0 8px' }}>Sala de espera</p>
            <p style={{ color: '#64748b', fontSize: 14, margin: 0 }}>Aguardando o paciente conectar...</p>
          </div>
        </>
      )}
    </div>
  )

  //  TELA DA CHAMADA 
  return (
    <div style={{ width: '100vw', height: '100dvh', background: '#0f172a', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ background: '#1e293b', padding: '8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, borderBottom: '1px solid #334155', minHeight: 48 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 26, height: 26, borderRadius: 6, background: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
          </div>
          <p style={{ fontSize: 13, fontWeight: 700, color: 'white', margin: 0 }}>{sala?.titulo || 'Teleconsulta'}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {tela === 'chamada' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#0f172a', padding: '3px 10px', borderRadius: 20, border: '1px solid #1e3a2f' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }}/>
              <span style={{ fontSize: 12, color: '#22c55e', fontWeight: 700, fontFamily: 'monospace' }}>{fmtTimer(timer)}</span>
            </div>
          )}
          {isMedico && tela === 'chamada' && (
            <button onClick={toggleGravacao}
              style={{ display:'flex', alignItems:'center', gap:5, padding:'4px 12px', borderRadius:20, border:'none', cursor:'pointer',
                background: gravando ? 'rgba(220,38,38,0.15)' : 'rgba(22,163,74,0.15)',
                color: gravando ? '#f87171' : '#86efac' }}>
              <span style={{ width:7, height:7, borderRadius:'50%', background: gravando ? '#ef4444' : '#22c55e', display:'inline-block',
                animation: gravando ? 'pulse 1s infinite' : 'none' }}/>
              <span style={{ fontSize:11, fontWeight:600 }}>{gravando ? 'Gravando...' : 'Gravar'}</span>
            </button>
          )}
          {isMedico && processando && (
            <div style={{ display:'flex', alignItems:'center', gap:5, padding:'4px 10px', borderRadius:20, background:'rgba(234,179,8,0.15)' }}>
              <div style={{ width:12, height:12, borderRadius:'50%', border:'2px solid rgba(234,179,8,0.4)', borderTopColor:'#eab308', animation:'spin 0.8s linear infinite' }}/>
              <span style={{ fontSize:11, color:'#fbbf24', fontWeight:600 }}>Gerando prontuario...</span>
            </div>
          )}
          <span style={{ fontSize: 10, color: '#475569', background: '#0f172a', border: '1px solid #1e293b', padding: '3px 8px', borderRadius: 6 }}>
            {isMedico ? ' Medico' : ' Paciente'}
          </span>
        </div>
      </div>

      {/* Corpo: video + chat */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0, position: 'relative' }}>

        {/* Area de video  usa letterbox para video portrait no desktop */}
        <div style={{ flex: 1, position: 'relative', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', minWidth: 0 }}>
          {/* Video remoto: object-fit:contain garante letterbox para mobile portrait */}
          <video ref={remoteRef} autoPlay playsInline
            style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#000', maxWidth: '100%', maxHeight: '100%' }}/>

          {/* Overlay aguardando */}
          {!remoteConectado && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a', flexDirection: 'column', gap: 16 }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', border: '3px solid #16a34a', borderTopColor: 'transparent', animation: 'spin 1s linear infinite' }}/>
              <p style={{ fontSize: 15, color: 'white', fontWeight: 600, margin: 0 }}>
                {isMedico ? 'Aguardando paciente entrar...' : 'Conectando...'}
              </p>
            </div>
          )}

          {/* Video local PiP  canto inferior direito */}
          {(tela === 'chamada' || entrando) && (
            <div style={{ position: 'absolute', bottom: 72, right: 12, width: 'clamp(100px, 22vw, 160px)', aspectRatio: '4/3', borderRadius: 10, overflow: 'hidden', border: '2px solid #1e293b', background: '#111', zIndex: 10 }}>
              <video ref={localRef} autoPlay playsInline muted
                style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}/>
              {!camOn && (
                <div style={{ position: 'absolute', inset: 0, background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="1.5"><line x1="1" y1="1" x2="23" y2="23"/><path d="M21 21H3a2 2 0 01-2-2V8"/></svg>
                </div>
              )}
              <p style={{ position: 'absolute', bottom: 3, left: 0, right: 0, textAlign: 'center', fontSize: 10, color: 'rgba(255,255,255,0.7)', margin: 0 }}>Voce</p>
            </div>
          )}

          {/* Botao flutuante do chat */}
          {tela === 'chamada' && remoteConectado && (
            <button onClick={() => { setChatAberto(o => !o); setNaoLidas(0) }}
              style={{ position: 'absolute', bottom: 72, left: 12, width: 44, height: 44, borderRadius: '50%', border: 'none', background: chatAberto ? '#16a34a' : 'rgba(30,41,59,0.9)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
              {naoLidas > 0 && !chatAberto && (
                <span style={{ position: 'absolute', top: -2, right: -2, width: 18, height: 18, borderRadius: '50%', background: '#ef4444', fontSize: 10, fontWeight: 700, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{naoLidas}</span>
              )}
            </button>
          )}

          {/* Controles */}
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 80, background: 'linear-gradient(transparent, rgba(5,10,25,0.95))', zIndex: 20 }}>
            {/* Centro: Mic | Cam | Config | Encerrar */}
            <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', display: 'flex', gap: 12 }}>
              <button onClick={toggleMic}
                style={{ width: 52, height: 52, borderRadius: '50%', border: 'none', background: micOn ? 'rgba(255,255,255,0.18)' : '#dc2626', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width='22' height='22' viewBox='0 0 24 24' fill='none' stroke='white' strokeWidth='2'>
                  {micOn ? <><path d='M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z'/><path d='M19 10v2a7 7 0 01-14 0v-2'/><line x1='12' y1='19' x2='12' y2='23'/><line x1='8' y1='23' x2='16' y2='23'/></> : <><line x1='1' y1='1' x2='23' y2='23'/><path d='M9 9v3a3 3 0 005.12 2.12M15 9.34V4a3 3 0 00-5.94-.6'/><path d='M17 16.95A7 7 0 015 12v-2m14 0v2a7 7 0 01-.11 1.23'/><line x1='12' y1='19' x2='12' y2='23'/><line x1='8' y1='23' x2='16' y2='23'/></> }
                </svg>
              </button>
              <button onClick={toggleCam}
                style={{ width: 52, height: 52, borderRadius: '50%', border: 'none', background: camOn ? 'rgba(255,255,255,0.18)' : '#dc2626', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width='22' height='22' viewBox='0 0 24 24' fill='none' stroke='white' strokeWidth='2'>
                  {camOn ? (<path d='M23 7l-7 5 7 5V7zM1 5a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2H3a2 2 0 01-2-2V5z'/>) : (<><line x1='1' y1='1' x2='23' y2='23'/><path d='M21 21H3a2 2 0 01-2-2V8m4-4h12a2 2 0 012 2v9.34'/></>)}
                </svg>
              </button>
              <button onClick={() => { setConfigAberto(o => !o); carregarDispositivos() }}
                style={{ width: 52, height: 52, borderRadius: '50%', border: 'none', background: configAberto ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.15)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width='22' height='22' viewBox='0 0 24 24' fill='none' stroke='white' strokeWidth='2'><circle cx='12' cy='12' r='3'/><path d='M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z'/></svg>
              </button>
              <button onClick={encerrar}
                style={{ width: 52, height: 52, borderRadius: '50%', border: 'none', background: '#dc2626', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width='22' height='22' viewBox='0 0 24 24' fill='none' stroke='white' strokeWidth='2'><line x1='18' y1='6' x2='6' y2='18'/><line x1='6' y1='6' x2='18' y2='18'/></svg>
              </button>
            </div>
            {/* Chat - direito */}
            <div style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)' }}>
              <button onClick={() => { setChatAberto(o => !o); setNaoLidas(0) }}
                style={{ width: 48, height: 48, borderRadius: '50%', border: 'none', background: chatAberto ? '#16a34a' : 'rgba(255,255,255,0.15)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                <svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='white' strokeWidth='2'><path d='M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z'/></svg>
                {naoLidas > 0 && <span style={{ position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderRadius: '50%', background: '#ef4444' }}/>}
              </button>
            </div>
            {/* Painel config */}
            {configAberto && (
              <div style={{ position: 'absolute', bottom: 88, left: '50%', transform: 'translateX(-50%)', background: '#1e293b', borderRadius: 12, border: '1px solid #334155', padding: 16, minWidth: 260, zIndex: 30 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <p style={{ color: 'white', fontWeight: 700, fontSize: 13, margin: 0 }}>Configuracoes</p>
                  <button onClick={() => setConfigAberto(false)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>x</button>
                </div>
                {audioInputs.length > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <p style={{ fontSize: 11, color: '#64748b', margin: '0 0 4px', textTransform: 'uppercase', fontWeight: 600 }}>Microfone</p>
                    <select style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: 6, color: 'white', padding: '6px 8px', fontSize: 12 }}>
                      {audioInputs.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || 'Microfone'}</option>)}
                    </select>
                  </div>
                )}
                {videoInputs.length > 0 && (
                  <div>
                    <p style={{ fontSize: 11, color: '#64748b', margin: '0 0 4px', textTransform: 'uppercase', fontWeight: 600 }}>Camera</p>
                    <select style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: 6, color: 'white', padding: '6px 8px', fontSize: 12 }}>
                      {videoInputs.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || 'Camera'}</option>)}
                    </select>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Input de arquivo oculto */}
        <input ref={anexoInputRef} type="file" accept="image/*,.pdf" style={{ display:'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) enviarAnexo(f); e.target.value = '' }}/>

      {/* Painel de chat  desliza da direita */}
        {chatAberto && (
          <div style={{ width: 'clamp(260px, 30vw, 320px)', background: '#1e293b', display: 'flex', flexDirection: 'column', borderLeft: '1px solid #334155', flexShrink: 0, animation: 'slideIn 0.2s ease' }}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid #334155', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: 'white', margin: 0 }}>Chat</p>
              <button onClick={() => setChatAberto(false)} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', padding: 4 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: '10px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {chat.length === 0 && anexos.length === 0 && <p style={{ fontSize: 12, color: '#475569', textAlign: 'center', marginTop: 20 }}>Nenhuma mensagem</p>}
              {/* Mescla chat e anexos por hora */}
              {[...chat.map(m => ({...m, _tipo:'msg'})), ...anexos.map(a => ({...a, _tipo:'anexo'}))].map((item, i) => (
                item._tipo === 'anexo' ? (
                  <div key={'a'+i} style={{ background: '#0f172a', borderRadius: 8, padding: '8px 10px' }}>
                    <p style={{ fontSize: 10, color: item.de === 'Voce' ? '#16a34a' : '#60a5fa', fontWeight: 700, margin: '0 0 5px' }}>{item.de}  {item.hora}</p>
                    {(item as any).tipo?.startsWith('image/') ? (
                      <a href={(item as any).url} download={(item as any).nome || "imagem"} onClick={e => { e.preventDefault(); const link = document.createElement("a"); link.href = (item as any).url; link.download = (item as any).nome || "imagem"; document.body.appendChild(link); link.click(); document.body.removeChild(link) }}>
                        <img src={(item as any).url} alt={(item as any).nome} style={{ width: '100%', borderRadius: 6, cursor: 'pointer', maxHeight: 160, objectFit: 'cover' }}/>
                        <p style={{ fontSize: 11, color: '#475569', margin: '4px 0 0' }}>{(item as any).nome}</p>
                      </a>
                    ) : (
                      <a href={(item as any).url} download={(item as any).nome} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#1e293b', padding: '8px 10px', borderRadius: 6, textDecoration: 'none' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                        <div>
                          <p style={{ fontSize: 11, color: '#cbd5e1', margin: 0, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(item as any).nome}</p>
                          <p style={{ fontSize: 10, color: '#475569', margin: 0 }}>Clique para baixar</p>
                        </div>
                      </a>
                    )}
                  </div>
                ) : (
                  <div key={'m'+i} style={{ background: '#0f172a', borderRadius: 8, padding: '8px 10px' }}>
                    <p style={{ fontSize: 10, color: item.de === 'Voce' ? '#16a34a' : '#60a5fa', fontWeight: 700, margin: '0 0 3px' }}>{item.de}  {item.hora}</p>
                    <p style={{ fontSize: 12, color: '#cbd5e1', margin: 0, lineHeight: 1.5 }}>{(item as any).msg}</p>
                  </div>
                )
              ))}

              <div ref={endRef}/>
            </div>
            <div style={{ padding: '10px', borderTop: '1px solid #334155', display: 'flex', gap: 6 }}>
              <button onClick={() => anexoInputRef.current?.click()} disabled={enviandoAnexo}
                style={{ width: 34, height: 34, borderRadius: 8, border: '1px solid #334155', background: '#0f172a', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                title="Enviar arquivo">
                {enviandoAnexo
                  ? <div style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid #475569', borderTopColor: '#16a34a', animation: 'spin 0.8s linear infinite' }}/>
                  : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
                }
              </button>
              <input value={msgInput} onChange={e => setMsgInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && enviarChat()}
                style={{ flex: 1, padding: '8px 10px', fontSize: 12, borderRadius: 8, border: '1px solid #334155', background: '#0f172a', color: 'white', outline: 'none' }} placeholder="Mensagem..."/>
              <button onClick={enviarChat} style={{ width: 34, height: 34, borderRadius: 8, border: 'none', background: '#16a34a', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal prontuario pos-consulta */}
      {prontuarioModal && prontuarioData && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:999, padding:16 }}>
          <div style={{ background:'#1e293b', borderRadius:16, width:'100%', maxWidth:600, maxHeight:'85vh', display:'flex', flexDirection:'column', border:'1px solid #334155' }}>
            <div style={{ padding:'16px 20px', borderBottom:'1px solid #334155', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ width:32, height:32, borderRadius:8, background:'#14532d', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#86efac" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                </div>
                <div>
                  <p style={{ fontSize:14, fontWeight:700, color:'white', margin:0 }}>Prontuario gerado pela IA</p>
                  <p style={{ fontSize:11, color:'#64748b', margin:0 }}>Baseado na transcricao da consulta  revise antes de salvar</p>
                </div>
              </div>
              <button onClick={() => setProntuarioModal(false)} style={{ background:'none', border:'none', color:'#475569', cursor:'pointer' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div style={{ flex:1, overflow:'auto', padding:'16px 20px', display:'flex', flexDirection:'column', gap:14 }}>
              {/* Transcrio */}
              {transcricao && (
                <div>
                  <p style={{ fontSize:11, fontWeight:600, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.05em', margin:'0 0 6px' }}>Transcricao</p>
                  <div style={{ background:'#0f172a', borderRadius:8, padding:'10px 12px', fontSize:12, color:'#94a3b8', lineHeight:1.6, maxHeight:80, overflow:'auto' }}>
                    {transcricao}
                  </div>
                </div>
              )}
              {/* Campos do pronturio */}
              {['subjetivo','objetivo','avaliacao','plano'].map(campo => {
                const pd = prontuarioData?.prontuario ?? prontuarioData ?? {}
                const val = pd[campo] ?? ''
                if (!val) return null
                const label = campo === 'subjetivo' ? 'S  Subjetivo' : campo === 'objetivo' ? 'O  Objetivo' : campo === 'avaliacao' ? 'A  Avaliacao / CID' : 'P  Plano'
                return (
                  <div key={campo}>
                    <p style={{ fontSize:11, fontWeight:600, color:'#64748b', textTransform:'uppercase' as const, letterSpacing:'0.05em', margin:'0 0 6px' }}>{label}</p>
                    <textarea defaultValue={val} rows={3} onChange={e => { camposRef.current[campo] = e.target.value }}
                      style={{ width:'100%', padding:'10px 12px', fontSize:12, borderRadius:8, border:'1px solid #334155', background:'#0f172a', color:'#e2e8f0', resize:'vertical' as const, outline:'none', fontFamily:'inherit', lineHeight:1.6 }}/>
                  </div>
                )
              })}
              {(() => {
                const pd = prontuarioData?.prontuario ?? prontuarioData ?? {}
                const rec = pd.receita ?? ''
                return rec ? (
                  <div>
                    <p style={{ fontSize:11, fontWeight:600, color:'#64748b', textTransform:'uppercase' as const, letterSpacing:'0.05em', margin:'0 0 6px' }}>Receita / Prescricao</p>
                    <textarea defaultValue={rec} rows={3} onChange={e => { camposRef.current.receita = e.target.value }}
                      style={{ width:'100%', padding:'10px 12px', fontSize:12, borderRadius:8, border:'1px solid #334155', background:'#0f172a', color:'#e2e8f0', resize:'vertical' as const, outline:'none', fontFamily:'inherit', lineHeight:1.6 }}/>
                  </div>
                ) : null
              })()}
            </div>
            <div style={{ padding:'14px 20px', borderTop:'1px solid #334155', display:'flex', gap:10, flexShrink:0 }}>
              <button onClick={salvarProntuario} disabled={salvando || salvado}
                style={{ flex:1, padding:'10px', borderRadius:9, border:'none', background: salvado ? '#14532d' : '#16a34a', color:'white', fontSize:13, fontWeight:700, cursor: (salvando||salvado) ? 'default' : 'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                {salvado
                  ? <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>Salvo! Abrindo historico...</>
                  : salvando
                  ? <><div style={{ width:14, height:14, borderRadius:'50%', border:'2px solid rgba(255,255,255,0.3)', borderTopColor:'white', animation:'spin 0.8s linear infinite' }}/>Salvando...</>
                  : <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>Salvar no historico</>
                }
              </button>
              <button onClick={() => setProntuarioModal(false)} style={{ padding:'10px 18px', borderRadius:9, border:'1px solid #334155', background:'transparent', color:'#64748b', fontSize:13, cursor:'pointer' }}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        * { box-sizing: border-box; }
        html, body { margin: 0; padding: 0; background: #0f172a; overflow: hidden; }
        @media (max-width: 640px) {
          html, body { height: 100dvh; }
        }
      `}</style>
    </div>
  )
}
