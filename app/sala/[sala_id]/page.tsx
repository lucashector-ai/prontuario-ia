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

type Tela = 'carregando' | 'espera' | 'chamada' | 'encerrado' | 'erro'

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

  // ────── SALA DE ESPERA ──────
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

  // ────── ENTRAR NA CHAMADA ──────
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
        setTela('chamada')
        setEntrando(false)
        timerRef.current = setInterval(() => setTimer(t => t + 1), 1000)
        sb.from('teleconsultas').update({ status: 'em_andamento', iniciada_em: new Date().toISOString() }).eq('sala_id', sala_id)
      }
    }

    pc.onicecandidate = (e) => {
      if (e.candidate) send('ice', e.candidate.toJSON())
    }

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected') {
        // Queda momentanea — nao encerra
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
      .on('broadcast', { event: 'chat' }, ({ payload }) => {
        if (payload.de === papel) return
        const nova = { de: payload.de === 'medico' ? 'Medico' : 'Paciente', msg: payload.dados, hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) }
        setChat(p => [...p, nova])
        setNaoLidas(n => n + 1)
      })
      .on('broadcast', { event: 'encerrar' }, () => {
        encerrarLocal()
        if (papelRef.current === 'paciente') setTimeout(() => { try { window.close() } catch {} }, 3000)
      })
      .subscribe(async (s) => {
        if (s === 'SUBSCRIBED') {
          send('pronto', { papel })
          if (papel === 'medico') setEntrando(true)
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
    encerrarLocal()
    if (papelRef.current === 'paciente') setTimeout(() => { try { window.close() } catch {} }, 3000)
  }

  const toggleMic = () => { streamRef.current?.getAudioTracks().forEach(t => { t.enabled = !t.enabled; setMicOn(t.enabled) }) }
  const toggleCam = () => { streamRef.current?.getVideoTracks().forEach(t => { t.enabled = !t.enabled; setCamOn(t.enabled) }) }
  const fmtTimer = (s: number) => String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0')

  const enviarChat = () => {
    if (!msgInput.trim()) return
    const msg = msgInput.trim(); setMsgInput('')
    setChat(p => [...p, { de: 'Voce', msg, hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) }])
    send('chat', msg)
  }

  // ────── TELAS ──────

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
      <style>{`*{box-sizing:border-box}html,body{margin:0;padding:0}`}</style>
    </div>
  )

  // ────── SALA DE ESPERA ──────
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
              {camOkEspera ? '📹 Camera OK' : '📹 Sem camera'}
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
              Estou pronto — entrar na sala
            </>
          )}
        </button>

        <p style={{ textAlign: 'center', fontSize: 12, color: '#334155', margin: 0 }}>
          {isMedico ? 'O paciente entrara quando clicar no link enviado' : 'O medico ja esta aguardando na sala'}
        </p>
      </div>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
        html, body { margin: 0; padding: 0; background: #0f172a; }
      `}</style>
    </div>
  )

  // ────── TELA DA CHAMADA ──────
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
          <span style={{ fontSize: 10, color: '#475569', background: '#0f172a', border: '1px solid #1e293b', padding: '3px 8px', borderRadius: 6 }}>
            {isMedico ? '👨‍⚕️ Medico' : '👤 Paciente'}
          </span>
        </div>
      </div>

      {/* Corpo: video + chat */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0, position: 'relative' }}>

        {/* Area de video — usa letterbox para video portrait no desktop */}
        <div style={{ flex: 1, position: 'relative', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', minWidth: 0 }}>
          {/* Video remoto: object-fit:contain garante letterbox para mobile portrait */}
          <video ref={remoteRef} autoPlay playsInline
            style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#000', maxWidth: '100%', maxHeight: '100%' }}/>

          {/* Overlay aguardando */}
          {tela !== 'chamada' && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a', flexDirection: 'column', gap: 16 }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', border: '3px solid #16a34a', borderTopColor: 'transparent', animation: 'spin 1s linear infinite' }}/>
              <p style={{ fontSize: 15, color: 'white', fontWeight: 600, margin: 0 }}>
                {isMedico ? 'Aguardando paciente entrar...' : 'Conectando...'}
              </p>
            </div>
          )}

          {/* Video local PiP — canto inferior direito */}
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
          {tela === 'chamada' && (
            <button onClick={() => { setChatAberto(o => !o); setNaoLidas(0) }}
              style={{ position: 'absolute', bottom: 72, left: 12, width: 44, height: 44, borderRadius: '50%', border: 'none', background: chatAberto ? '#16a34a' : 'rgba(30,41,59,0.9)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
              {naoLidas > 0 && !chatAberto && (
                <span style={{ position: 'absolute', top: -2, right: -2, width: 18, height: 18, borderRadius: '50%', background: '#ef4444', fontSize: 10, fontWeight: 700, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{naoLidas}</span>
              )}
            </button>
          )}

          {/* Controles */}
          <div style={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 12, zIndex: 20 }}>
            <button onClick={toggleMic} style={{ width: 48, height: 48, borderRadius: '50%', border: 'none', background: micOn ? 'rgba(30,41,59,0.9)' : '#dc2626', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                {micOn ? <><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></> : <><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 005.12 2.12M15 9.34V4a3 3 0 00-5.94-.6"/><path d="M17 16.95A7 7 0 015 12v-2m14 0v2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></>}
              </svg>
            </button>
            <button onClick={toggleCam} style={{ width: 48, height: 48, borderRadius: '50%', border: 'none', background: camOn ? 'rgba(30,41,59,0.9)' : '#dc2626', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                {camOn ? <path d="M15 10l4.553-2.169A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14v-4zM3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"/> : <><line x1="1" y1="1" x2="23" y2="23"/><path d="M21 21H3a2 2 0 01-2-2V8a2 2 0 012-2h3m3-3h6l2 3h4a2 2 0 012 2v9.34"/></>}
              </svg>
            </button>
            <button onClick={encerrar} style={{ width: 48, height: 48, borderRadius: '50%', border: 'none', background: '#dc2626', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.27-.27.67-.36 1-.23 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1C10.29 21 3 13.71 3 4.99c0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.23 1L6.6 10.8z"/></svg>
            </button>
          </div>
        </div>

        {/* Painel de chat — desliza da direita */}
        {chatAberto && (
          <div style={{ width: 'clamp(260px, 30vw, 320px)', background: '#1e293b', display: 'flex', flexDirection: 'column', borderLeft: '1px solid #334155', flexShrink: 0, animation: 'slideIn 0.2s ease' }}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid #334155', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: 'white', margin: 0 }}>Chat</p>
              <button onClick={() => setChatAberto(false)} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', padding: 4 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: '10px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {chat.length === 0 && <p style={{ fontSize: 12, color: '#475569', textAlign: 'center', marginTop: 20 }}>Nenhuma mensagem</p>}
              {chat.map((m, i) => (
                <div key={i} style={{ background: '#0f172a', borderRadius: 8, padding: '8px 10px' }}>
                  <p style={{ fontSize: 10, color: m.de === 'Voce' ? '#16a34a' : '#60a5fa', fontWeight: 700, margin: '0 0 3px' }}>{m.de} · {m.hora}</p>
                  <p style={{ fontSize: 12, color: '#cbd5e1', margin: 0, lineHeight: 1.5 }}>{m.msg}</p>
                </div>
              ))}
              <div ref={endRef}/>
            </div>
            <div style={{ padding: '10px', borderTop: '1px solid #334155', display: 'flex', gap: 6 }}>
              <input value={msgInput} onChange={e => setMsgInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && enviarChat()}
                style={{ flex: 1, padding: '8px 10px', fontSize: 12, borderRadius: 8, border: '1px solid #334155', background: '#0f172a', color: 'white', outline: 'none' }} placeholder="Mensagem..."/>
              <button onClick={enviarChat} style={{ width: 34, height: 34, borderRadius: 8, border: 'none', background: '#16a34a', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        * { box-sizing: border-box; }
        html, body { margin: 0; padding: 0; background: #0f172a; overflow: hidden; }
        @media (max-width: 640px) {
          html, body { height: 100dvh; }
        }
      `}</style>
    </div>
  )
}
