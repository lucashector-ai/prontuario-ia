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

type Tela = 'carregando' | 'espera' | 'chamada' | 'encerrado' | 'erro' | 'encerrada_paciente' | 'encerrada_paciente'

export default function Sala({ params }: { params: { sala_id: string } }) {
  const { sala_id } = params
  const [tela, setTela] = useState<Tela>('carregando')
  const [sala, setSala] = useState<any>(null)
  const [isMedico, setIsMedico] = useState(false)
  const [micOn, setMicOn] = useState(true)
  const [camOn, setCamOn] = useState(true)
  const [chatAberto, setChatAberto] = useState(false)
  const [arquivoAberto, setArquivoAberto] = useState<{url:string,nome:string,tipo:string}|null>(null)
  const [configAberto, setConfigAberto] = useState(false)
  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([])
  const [videoInputs, setVideoInputs] = useState<MediaDeviceInfo[]>([])
  const [audioOutputs, setAudioOutputs] = useState<MediaDeviceInfo[]>([])
  const [audioInputId, setAudioInputId] = useState<string>('')
  const [videoInputId, setVideoInputId] = useState<string>('')
  const [audioOutputId, setAudioOutputId] = useState<string>('')
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
  const localVideoRef = useRef<HTMLVideoElement>(null)
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
  const chatRef = useRef<{de:string;msg:string;hora:string}[]>([])
  const anexosRef = useRef<{nome:string;url:string;tipo:string;de:string;hora:string}[]>([])

  useEffect(() => {
    const med = localStorage.getItem('medico')
    papelRef.current = med ? 'medico' : 'paciente'
    setIsMedico(!!med)
    carregarSala()
    return () => pararEspera()
  }, [sala_id])

  useEffect(() => {
    chatRef.current = chat
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chat])

  useEffect(() => {
    anexosRef.current = anexos
  }, [anexos])

  useEffect(() => {
    if (chatAberto) setNaoLidas(0)
  }, [chatAberto])

  // Conecta stream local ao PiP quando tela de chamada renderiza
  // Usa setTimeout pois o ref pode no estar pronto no primeiro tick
  useEffect(() => {
    if (tela === 'chamada' && streamRef.current) {
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

  // PiP: conecta stream local ao video da camera
  useEffect(() => {
    const v = localVideoRef.current
    const stream = streamRef.current
    if (tela === 'chamada' && v && stream && !v.srcObject) {
      v.srcObject = stream
    }
  }, [tela])

  const carregarSala = async () => {
    const { data } = await sb.from('teleconsultas').select('*').eq('sala_id', sala_id).single()
    if (!data) { setErro('Sala nao encontrada ou link expirado.'); setTela('erro'); return }
    if (data.status === 'encerrada') {
      setErro('Esta consulta ja foi encerrada. O link expirou.')
      setTela('erro')
      return
    }
    setSala(data)
    iniciarEspera()
  }

  //  SALA DE ESPERA 
  const iniciarEspera = async () => {
    setTela('espera')
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
        setTela('encerrada_paciente')
        setTimeout(() => { try { window.close() } catch {} window.location.href = '/login' }, 4000)
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
    // Usa refs para evitar closure stale com state desatualizado
    const mensagens = chatRef.current
    const anexosAtual = anexosRef.current
    // Salva historico completo de mensagens no banco
    if (mensagens.length > 0) {
      const msgRows = mensagens.map(m => ({
        sala_id,
        de: m.de,
        msg: m.msg,
        hora: m.hora,
        criado_em: new Date().toISOString()
      }))
      const { error } = await sb.from('sala_mensagens').insert(msgRows)
      if (error) console.error('Erro ao salvar mensagens:', error)
    }
    // Atualiza resumo na teleconsulta
    const resumo = mensagens.map(m => m.de + ': ' + m.msg).join('\n')
    const { error: errResumo } = await sb.from('teleconsultas').update({
      chat_resumo: resumo || null,
      total_anexos: anexosAtual.length
    }).eq('sala_id', sala_id)
    if (errResumo) console.error('Erro ao salvar resumo:', errResumo)
    const { error: errStatus } = await sb.from('teleconsultas').update({ status: 'encerrada', encerrada_em: new Date().toISOString(), duracao_segundos: timer }).eq('sala_id', sala_id)
    if (errStatus) console.error('Erro ao atualizar status:', errStatus)
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
      setAudioOutputs(devices.filter(d => d.kind === 'audiooutput'))
    } catch (e) { console.error('Devices:', e) }
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

  if (tela === 'carregando') return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a' }}>
      <div style={{ width: 48, height: 48, borderRadius: '50%', border: '3px solid #16a34a', borderTopColor: 'transparent', animation: 'spin 1s linear infinite' }}/>
      <style>{`
          @keyframes shrink { from { transform: scaleX(1) } to { transform: scaleX(0) } }
          @keyframes spin{to{transform:rotate(360deg)}}`}</style>
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
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a', flexDirection: 'column', gap: 20 }}>
      <div style={{ width: 64, height: 64, borderRadius: 16, background: '#14532d', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#86efac" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
      </div>
      <p style={{ fontSize: 20, color: 'white', fontWeight: 700, margin: 0 }}>Consulta encerrada</p>
      {timer > 0 && <p style={{ fontSize: 14, color: '#64748b', margin: 0 }}>Duracao: {fmtTimer(timer)}</p>}
      {isMedico
        ? <a href="/teleconsulta" style={{ marginTop: 8, padding: '10px 24px', background: '#16a34a', color: 'white', borderRadius: 10, textDecoration: 'none', fontSize: 14, fontWeight: 600 }}>Voltar para teleconsultas</a>
        : <p style={{ fontSize: 13, color: '#475569', margin: 0 }}>Esta pagina sera fechada em instantes...</p>
      }
      <style>{`
          @keyframes shrink { from { transform: scaleX(1) } to { transform: scaleX(0) } }
          *{box-sizing:border-box}html,body{margin:0;padding:0}`}</style>
    </div>
  )

  //  SALA DE ESPERA 
  if (tela === 'espera') return (
    <div style={{ minHeight: '100dvh', background: '#0f172a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
      <div style={{ width: '100%', maxWidth: 480, display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Header */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: 7, background: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'white' }}>MedIA Teleconsulta</span>
          </div>
          <p style={{ fontSize: 18, fontWeight: 700, color: 'white', margin: '0 0 4px' }}>{sala?.titulo || 'Teleconsulta'}</p>
          <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>Verifique camera e microfone antes de entrar</p>
        </div>

        {/* Preview camera */}
        <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', background: '#111827', borderRadius: 14, overflow: 'hidden', border: '1px solid #1e293b' }}>
          <video ref={esperaRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}/>
          {!camOkEspera && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="1.5"><path d="M15 10l4.553-2.169A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14v-4zM3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"/></svg>
              <p style={{ fontSize: 12, color: '#475569', margin: 0 }}>Carregando camera...</p>
            </div>
          )}
          {/* Badge status */}
          <div style={{ position: 'absolute', top: 10, left: 10, display: 'flex', gap: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 20, background: camOkEspera ? 'rgba(22,163,74,0.85)' : 'rgba(220,38,38,0.85)', color: 'white' }}>
              {camOkEspera ? ' Camera OK' : ' Sem camera'}
            </span>
          </div>
        </div>

        {/* Microfone */}
        <div style={{ background: '#1e293b', borderRadius: 12, padding: '14px 16px', border: '1px solid #334155' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={micOkEspera ? '#22c55e' : '#ef4444'} strokeWidth="2">
                <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/>
                <path d="M19 10v2a7 7 0 01-14 0v-2"/>
                <line x1="12" y1="19" x2="12" y2="23"/>
                <line x1="8" y1="23" x2="16" y2="23"/>
              </svg>
              <span style={{ fontSize: 13, color: 'white', fontWeight: 500 }}>Microfone</span>
            </div>
            <span style={{ fontSize: 11, fontWeight: 600, color: micOkEspera ? '#22c55e' : '#ef4444' }}>
              {micOkEspera ? 'Funcionando' : 'Sem acesso'}
            </span>
          </div>
          {/* Barra de volume */}
          <div style={{ height: 6, background: '#0f172a', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: micVol + '%', background: micVol > 60 ? '#22c55e' : micVol > 20 ? '#84cc16' : '#334155', borderRadius: 3, transition: 'width 0.05s, background 0.2s' }}/>
          </div>
          <p style={{ fontSize: 11, color: '#475569', margin: '6px 0 0' }}>
            {micVol > 5 ? 'Microfone captando audio' : 'Fale algo para testar o microfone'}
          </p>
        </div>

        {/* Botao entrar */}
        <button onClick={entrarNaChamada} disabled={entrando || !camOkEspera} style={{ width: '100%', padding: '15px', background: (!camOkEspera || entrando) ? '#1e3a2f' : '#16a34a', color: (!camOkEspera || entrando) ? '#475569' : 'white', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: (!camOkEspera || entrando) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          {entrando ? (
            <>
              <div style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', animation: 'spin 0.8s linear infinite' }}/>
              Conectando...
            </>
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 10l4.553-2.169A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14v-4zM3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"/></svg>
              Estou pronto  entrar na sala
            </>
          )}
        </button>

        <p style={{ textAlign: 'center', fontSize: 12, color: '#334155', margin: 0 }}>
          {isMedico ? 'O paciente entrara quando clicar no link enviado' : 'O medico ja esta aguardando na sala'}
        </p>
      </div>
      <style>{`
          @keyframes shrink { from { transform: scaleX(1) } to { transform: scaleX(0) } }
          
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
        html, body { margin: 0; padding: 0; background: #0f172a; }
      `}</style>
    </div>
  )


  useEffect(() => {
    if (tela === 'chamada' && localVideoRef.current && streamRef.current) {
      localVideoRef.current.srcObject = streamRef.current
    }
  }, [tela])
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
          


          {/* Barra de controles estilo Meet */}
          {/* Indicador de gravacao */}
          {gravando && (
            <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(220,38,38,0.9)', borderRadius: 8, padding: '4px 10px', zIndex: 25 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'white' }}/>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'white' }}>{gravandoPausado ? 'PAUSADO' : 'REC'}</span>
            </div>
          )}
          {/* Camera local PiP */}
          <div style={{ position: 'absolute', bottom: 84, right: 12, width: 'clamp(80px,20vw,140px)', aspectRatio: '16/9', borderRadius: 10, overflow: 'hidden', border: '2px solid rgba(255,255,255,0.2)', zIndex: 15, background: '#000' }}>
            <video ref={localVideoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}/>
          </div>
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 'clamp(64px,10vh,80px)', background: 'linear-gradient(transparent, rgba(5,10,25,0.97))', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20, padding: '0 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(10px,2.5vw,16px)' }}>
              <button onClick={toggleMic} title={micOn ? 'Silenciar' : 'Ativar mic'} style={{ width: 'clamp(48px,12vw,56px)', height: 'clamp(48px,12vw,56px)', borderRadius: '50%', border: 'none', background: micOn ? 'rgba(255,255,255,0.18)' : '#dc2626', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width='22' height='22' viewBox='0 0 24 24' fill='none' stroke='white' strokeWidth='2'>{micOn ? <><path d='M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z'/><path d='M19 10v2a7 7 0 01-14 0v-2'/><line x1='12' y1='19' x2='12' y2='23'/><line x1='8' y1='23' x2='16' y2='23'/></> : <><line x1='1' y1='1' x2='23' y2='23'/><path d='M9 9v3a3 3 0 005.12 2.12M15 9.34V4a3 3 0 00-5.94-.6'/><path d='M17 16.95A7 7 0 015 12v-2m14 0v2a7 7 0 01-.11 1.23'/><line x1='12' y1='19' x2='12' y2='23'/><line x1='8' y1='23' x2='16' y2='23'/></>}</svg>
              </button>
              <button onClick={toggleCam} title={camOn ? 'Desligar cam' : 'Ligar cam'} style={{ width: 'clamp(48px,12vw,56px)', height: 'clamp(48px,12vw,56px)', borderRadius: '50%', border: 'none', background: camOn ? 'rgba(255,255,255,0.18)' : '#dc2626', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width='22' height='22' viewBox='0 0 24 24' fill='none' stroke='white' strokeWidth='2'>{camOn ? <path d='M23 7l-7 5 7 5V7zM1 5a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2H3a2 2 0 01-2-2V5z'/> : <><line x1='1' y1='1' x2='23' y2='23'/><path d='M21 21H3a2 2 0 01-2-2V8m4-4h12a2 2 0 012 2v9.34'/></>}</svg>
              </button>
              <button onClick={() => setConfigAberto(o => !o)} title='Configuracoes' style={{ width: 'clamp(48px,12vw,56px)', height: 'clamp(48px,12vw,56px)', borderRadius: '50%', border: 'none', background: configAberto ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.18)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width='22' height='22' viewBox='0 0 24 24' fill='none' stroke='white' strokeWidth='2'><circle cx='12' cy='12' r='3'/><path d='M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z'/></svg>
              </button>
              <button onClick={encerrar} title='Encerrar' style={{ width: 'clamp(48px,12vw,56px)', height: 'clamp(48px,12vw,56px)', borderRadius: '50%', border: 'none', background: '#dc2626', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width='22' height='22' viewBox='0 0 24 24' fill='none' stroke='white' strokeWidth='2'><line x1='18' y1='6' x2='6' y2='18'/><line x1='6' y1='6' x2='18' y2='18'/></svg>
              </button>
            </div>
            <button onClick={() => { setChatAberto(o => !o); setNaoLidas(0) }} title='Chat' style={{ position: 'absolute', right: 'clamp(8px,2vw,16px)', width: 'clamp(44px,11vw,48px)', height: 'clamp(44px,11vw,48px)', borderRadius: '50%', border: 'none', background: chatAberto ? '#16a34a' : 'rgba(255,255,255,0.18)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='white' strokeWidth='2'><path d='M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z'/></svg>
              {naoLidas > 0 && <span style={{ position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderRadius: '50%', background: '#ef4444' }}/>}
            </button>
          </div>

          {/* Painel de configuracoes */}
          {configAberto && (
            <div style={{ position: 'absolute', bottom: 80, right: 16, width: 300, background: '#1e293b', borderRadius: 12, border: '1px solid #334155', padding: 16, zIndex: 30 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: 'white', margin: 0 }}>Configuracoes</p>
                <button onClick={() => setConfigAberto(false)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>x</button>
              </div>
              {audioInputs.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <p style={{ fontSize: 11, color: '#64748b', margin: '0 0 4px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Microfone</p>
                  <select value={audioInputId} onChange={e => setAudioInputId(e.target.value)}
                    style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: 6, color: 'white', padding: '6px 8px', fontSize: 12 }}>
                    {audioInputs.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || 'Microfone ' + d.deviceId.slice(0,4)}</option>)}
                  </select>
                </div>
              )}
              {videoInputs.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <p style={{ fontSize: 11, color: '#64748b', margin: '0 0 4px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Camera</p>
                  <select value={videoInputId} onChange={e => setVideoInputId(e.target.value)}
                    style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: 6, color: 'white', padding: '6px 8px', fontSize: 12 }}>
                    {videoInputs.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || 'Camera ' + d.deviceId.slice(0,4)}</option>)}
                  </select>
                </div>
              )}
              {audioOutputs.length > 0 && (
                <div>
                  <p style={{ fontSize: 11, color: '#64748b', margin: '0 0 4px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Alto-falante</p>
                  <select value={audioOutputId} onChange={e => setAudioOutputId(e.target.value)}
                    style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: 6, color: 'white', padding: '6px 8px', fontSize: 12 }}>
                    {audioOutputs.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || 'Alto-falante ' + d.deviceId.slice(0,4)}</option>)}
                  </select>
                </div>
              )}
            </div>
          )}
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
                      <a href={(item as any).url} onClick={e => { e.preventDefault(); setArquivoAberto({ url: (item as any).url, nome: (item as any).nome || 'imagem', tipo: (item as any).tipo || 'image/jpeg' }) }}>
                        <img src={(item as any).url} alt={(item as any).nome} style={{ width: '100%', borderRadius: 6, cursor: 'pointer', maxHeight: 160, objectFit: 'cover' }}/>
                        <p style={{ fontSize: 11, color: '#475569', margin: '4px 0 0' }}>{(item as any).nome}</p>
                      </a>
                    ) : (
                      <a href={(item as any).url} onClick={e => { e.preventDefault(); setArquivoAberto({ url: (item as any).url, nome: (item as any).nome || 'arquivo', tipo: (item as any).tipo || 'application/pdf' }) }} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#1e293b', padding: '8px 10px', borderRadius: 6, textDecoration: 'none', cursor: 'pointer' }}>
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

      {/* Visor inline de arquivo (imagem/PDF) */}
      {arquivoAberto && (
        <div onClick={() => setArquivoAberto(null)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:16, cursor:'pointer' }}>
          <div onClick={e => e.stopPropagation()} style={{ position:'relative', maxWidth:'90vw', maxHeight:'90vh', display:'flex', flexDirection:'column', alignItems:'center', cursor:'default' }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
              <p style={{ fontSize:13, color:'white', fontWeight:600, margin:0 }}>{arquivoAberto.nome}</p>
              <a href={arquivoAberto.url} download={arquivoAberto.nome} onClick={e => e.stopPropagation()}
                style={{ fontSize:11, color:'#60a5fa', background:'rgba(96,165,250,0.15)', padding:'4px 10px', borderRadius:6, textDecoration:'none', fontWeight:600 }}>
                Baixar
              </a>
              <button onClick={() => setArquivoAberto(null)}
                style={{ background:'none', border:'none', color:'#94a3b8', cursor:'pointer', fontSize:20, lineHeight:1 }}></button>
            </div>
            {arquivoAberto.tipo.startsWith('image/') ? (
              <img src={arquivoAberto.url} alt={arquivoAberto.nome} style={{ maxWidth:'85vw', maxHeight:'80vh', borderRadius:8, objectFit:'contain' }}/>
            ) : arquivoAberto.tipo === 'application/pdf' ? (
              <iframe src={arquivoAberto.url} title={arquivoAberto.nome} style={{ width:'80vw', height:'80vh', borderRadius:8, border:'none', background:'white' }}/>
            ) : (
              <div style={{ background:'#1e293b', borderRadius:12, padding:'32px 24px', textAlign:'center' }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                <p style={{ fontSize:13, color:'#94a3b8', margin:'12px 0 0' }}>Tipo nao suportado para preview</p>
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
          @keyframes shrink { from { transform: scaleX(1) } to { transform: scaleX(0) } }

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
// deploy seg 30 mar 2026 20:47:05 -03
