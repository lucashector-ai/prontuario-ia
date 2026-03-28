'use client'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

// Cliente Supabase criado localmente para nao depender de auth
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
  ]
}

export default function Sala({ params }: { params: { sala_id: string } }) {
  const { sala_id } = params
  const [sala, setSala] = useState<any>(null)
  const [isMedico, setIsMedico] = useState(false)
  const [status, setStatus] = useState<'idle'|'aguardando'|'conectando'|'conectado'|'encerrado'>('idle')
  const [micOn, setMicOn] = useState(true)
  const [camOn, setCamOn] = useState(true)
  const [timer, setTimer] = useState(0)
  const [chat, setChat] = useState<{de:string;msg:string;hora:string}[]>([])
  const [msgInput, setMsgInput] = useState('')
  const [erro, setErro] = useState('')
  const [logDebug, setLogDebug] = useState<string[]>([])

  const localRef = useRef<HTMLVideoElement>(null)
  const remoteRef = useRef<HTMLVideoElement>(null)
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const channelRef = useRef<any>(null)
  const timerRef = useRef<any>(null)
  const iceBufRef = useRef<RTCIceCandidateInit[]>([])
  const remoteSetRef = useRef(false)
  const papelRef = useRef<string>('')

  const log = (msg: string) => {
    console.log('[Sala]', msg)
    setLogDebug(p => [...p.slice(-8), msg])
  }

  useEffect(() => {
    const med = localStorage.getItem('medico')
    const papel = med ? 'medico' : 'paciente'
    papelRef.current = papel
    setIsMedico(!!med)
    carregarSala()
  }, [sala_id])

  const carregarSala = async () => {
    const { data } = await sb.from('teleconsultas').select('*').eq('sala_id', sala_id).single()
    if (!data) { setErro('Sala nao encontrada ou link expirado.'); return }
    // Reabre sala se estava encerrada (paciente acessando antes do medico)
    if (data.status === 'encerrada') {
      setErro('Esta consulta ja foi encerrada.')
      return
    }
    setSala(data)
    setStatus('idle')
  }

  // Envia mensagem pelo canal broadcast
  const send = (tipo: string, dados: any) => {
    channelRef.current?.send({ type: 'broadcast', event: tipo, payload: { dados, de: papelRef.current } })
  }

  // Adiciona ICE buffered depois de setRemoteDescription
  const flushIce = async (pc: RTCPeerConnection) => {
    for (const c of iceBufRef.current) {
      try { await pc.addIceCandidate(new RTCIceCandidate(c)) } catch {}
    }
    iceBufRef.current = []
  }

  const entrar = async () => {
    const papel = papelRef.current
    log('Entrando como: ' + papel)
    setStatus('conectando')

    // 1. Pega midia
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    } catch {
      setErro('Sem acesso a camera/microfone. Verifique as permissoes no browser.')
      setStatus('idle')
      return
    }
    streamRef.current = stream
    if (localRef.current) localRef.current.srcObject = stream
    log('Midia ok')

    // 2. Cria PeerConnection
    const pc = new RTCPeerConnection(ICE_SERVERS)
    pcRef.current = pc
    stream.getTracks().forEach(t => pc.addTrack(t, stream))

    pc.ontrack = (e) => {
      log('ontrack - stream remoto chegou')
      if (remoteRef.current && e.streams[0]) {
        remoteRef.current.srcObject = e.streams[0]
        setStatus('conectado')
        timerRef.current = setInterval(() => setTimer(t => t + 1), 1000)
        sb.from('teleconsultas').update({ status: 'em_andamento', iniciada_em: new Date().toISOString() }).eq('sala_id', sala_id)
      }
    }

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        log('ICE candidate gerado')
        send('ice', e.candidate.toJSON())
      }
    }

    pc.onconnectionstatechange = () => {
      log('connectionState: ' + pc.connectionState)
      if (pc.connectionState === 'failed') {
        log('FALHOU - tentando restart ICE')
        pc.restartIce()
      }
      if (pc.connectionState === 'disconnected') setStatus('encerrado')
    }

    pc.onicegatheringstatechange = () => log('iceGathering: ' + pc.iceGatheringState)
    pc.onsignalingstatechange = () => log('signaling: ' + pc.signalingState)

    // 3. Entra no canal broadcast
    const channel = sb.channel('sala:' + sala_id, {
      config: { broadcast: { self: false, ack: false } }
    })

    channel
      .on('broadcast', { event: 'offer' }, async ({ payload }) => {
        if (payload.de === papel) return
        log('Recebeu offer')
        await pc.setRemoteDescription(new RTCSessionDescription(payload.dados))
        remoteSetRef.current = true
        await flushIce(pc)
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        send('answer', { type: answer.type, sdp: answer.sdp })
        log('Answer enviado')
      })
      .on('broadcast', { event: 'answer' }, async ({ payload }) => {
        if (payload.de === papel) return
        log('Recebeu answer')
        if (pc.signalingState === 'have-local-offer') {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.dados))
          remoteSetRef.current = true
          await flushIce(pc)
        }
      })
      .on('broadcast', { event: 'ice' }, async ({ payload }) => {
        if (payload.de === papel) return
        if (remoteSetRef.current) {
          try { await pc.addIceCandidate(new RTCIceCandidate(payload.dados)) } catch {}
        } else {
          iceBufRef.current.push(payload.dados)
        }
      })
      .on('broadcast', { event: 'pronto' }, ({ payload }) => {
        if (payload.de === papel) return
        log('Outro lado entrou - ' + payload.de)
        // Se sou medico e o paciente entrou, mando offer
        if (papel === 'medico') fazerOffer(pc)
      })
      .on('broadcast', { event: 'chat' }, ({ payload }) => {
        if (payload.de === papel) return
        setChat(p => [...p, { de: payload.de === 'medico' ? (null || 'Medico') : 'Paciente', msg: payload.dados, hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) }])
      })
      .on('broadcast', { event: 'encerrar' }, () => encerrarLocal())
      .subscribe(async (s) => {
        log('Canal subscribe: ' + s)
        if (s === 'SUBSCRIBED') {
          // Avisa que estou pronto
          send('pronto', { papel })
          // Se sou medico, aguardo o paciente; se sou paciente, aviso e aguardo offer
          if (papel === 'medico') {
            setStatus('aguardando')
            log('Medico aguardando paciente...')
          }
          // Se paciente, o evento 'pronto' que chega no medico vai triggar o offer
        }
      })

    channelRef.current = channel
  }

  const fazerOffer = async (pc: RTCPeerConnection) => {
    if (pc.signalingState !== 'stable') { log('Nao posso fazer offer, state: ' + pc.signalingState); return }
    log('Criando offer...')
    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    send('offer', { type: offer.type, sdp: offer.sdp })
    log('Offer enviado')
  }

  const encerrarLocal = () => {
    clearInterval(timerRef.current)
    pcRef.current?.close()
    streamRef.current?.getTracks().forEach(t => t.stop())
    channelRef.current?.unsubscribe()
    if (localRef.current) localRef.current.srcObject = null
    if (remoteRef.current) remoteRef.current.srcObject = null
    setStatus('encerrado')
  }

  const encerrar = async () => {
    send('encerrar', {})
    await sb.from('teleconsultas').update({ status: 'encerrada', encerrada_em: new Date().toISOString(), duracao_segundos: timer }).eq('sala_id', sala_id)
    encerrarLocal()
  }

  const toggleMic = () => { streamRef.current?.getAudioTracks().forEach(t => { t.enabled = !t.enabled; setMicOn(t.enabled) }) }
  const toggleCam = () => { streamRef.current?.getVideoTracks().forEach(t => { t.enabled = !t.enabled; setCamOn(t.enabled) }) }
  const fmtTimer = (s: number) => String(Math.floor(s/60)).padStart(2,'0') + ':' + String(s%60).padStart(2,'0')

  const enviarChat = async () => {
    if (!msgInput.trim()) return
    const msg = msgInput.trim(); setMsgInput('')
    setChat(p => [...p, { de: 'Voce', msg, hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) }])
    send('chat', msg)
  }

  if (erro) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#0f172a', flexDirection:'column', gap:16 }}>
      <div style={{ width:56, height:56, borderRadius:14, background:'#7f1d1d', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fca5a5" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
      </div>
      <p style={{ fontSize:16, color:'white', fontWeight:600, margin:0 }}>{erro}</p>
    </div>
  )

  if (status === 'encerrado') return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#0f172a', flexDirection:'column', gap:20 }}>
      <div style={{ width:64, height:64, borderRadius:16, background:'#14532d', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#86efac" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
      </div>
      <p style={{ fontSize:20, color:'white', fontWeight:700, margin:0 }}>Consulta encerrada</p>
      {timer > 0 && <p style={{ fontSize:14, color:'#64748b', margin:0 }}>Duracao: {fmtTimer(timer)}</p>}
      {isMedico && <a href="/teleconsulta" style={{ marginTop:8, padding:'10px 24px', background:'#16a34a', color:'white', borderRadius:10, textDecoration:'none', fontSize:14, fontWeight:600 }}>Voltar</a>}
    </div>
  )

  return (
    <div style={{ minHeight:'100vh', background:'#0f172a', display:'flex', flexDirection:'column' }}>
      {/* Header */}
      <div style={{ background:'#1e293b', padding:'10px 20px', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0, borderBottom:'1px solid #334155' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:30, height:30, borderRadius:7, background:'#16a34a', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
          </div>
          <div>
            <p style={{ fontSize:13, fontWeight:700, color:'white', margin:0 }}>MedIA Teleconsulta</p>
            <p style={{ fontSize:11, color:'#64748b', margin:0 }}>{sala?.titulo || '...'}</p>
          </div>
        </div>
        <div style={{ display:'flex', gap:10, alignItems:'center' }}>
          {status === 'conectado' && (
            <div style={{ display:'flex', alignItems:'center', gap:6, background:'#0f172a', padding:'4px 12px', borderRadius:20, border:'1px solid #1e3a2f' }}>
              <span style={{ width:7, height:7, borderRadius:'50%', background:'#22c55e', display:'inline-block' }}/>
              <span style={{ fontSize:13, color:'#22c55e', fontWeight:700, fontFamily:'monospace' }}>{fmtTimer(timer)}</span>
            </div>
          )}
          <span style={{ fontSize:11, color:'#475569', background:'#0f172a', border:'1px solid #334155', padding:'4px 10px', borderRadius:6 }}>
            {isMedico ? '👨‍⚕️ Medico' : '👤 Paciente'}
          </span>
        </div>
      </div>

      <div style={{ flex:1, display:'flex', overflow:'hidden', minHeight:0 }}>
        {/* Area video */}
        <div style={{ flex:1, position:'relative', background:'#000', minWidth:0 }}>
          <video ref={remoteRef} autoPlay playsInline style={{ width:'100%', height:'100%', objectFit:'cover' }}/>

          {/* Overlays de estado */}
          {status !== 'conectado' && (
            <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', background:'#0f172a', flexDirection:'column', gap:20 }}>
              {status === 'idle' && sala && (
                <>
                  <div style={{ width:80, height:80, borderRadius:20, background:'#1e293b', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto' }}>
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="1.5"><path d="M15 10l4.553-2.169A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14v-4zM3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"/></svg>
                  </div>
                  <div style={{ textAlign:'center' }}>
                    <p style={{ fontSize:18, color:'white', fontWeight:700, margin:'0 0 6px' }}>{sala.titulo}</p>
                    <p style={{ fontSize:13, color:'#64748b', margin:'0 0 24px' }}>
                      {isMedico ? 'Clique para iniciar — o paciente vai conectar pelo link' : 'Clique para entrar na consulta com o medico'}
                    </p>
                    <button onClick={entrar} style={{ padding:'14px 40px', background:'#16a34a', color:'white', border:'none', borderRadius:12, fontSize:15, fontWeight:700, cursor:'pointer' }}>
                      Entrar na sala
                    </button>
                  </div>
                </>
              )}
              {(status === 'conectando' || status === 'aguardando') && (
                <div style={{ textAlign:'center' }}>
                  <div style={{ width:64, height:64, borderRadius:'50%', border:'3px solid #16a34a', borderTopColor:'transparent', margin:'0 auto 20px', animation:'spin 1s linear infinite' }}/>
                  <p style={{ fontSize:16, color:'white', fontWeight:600, margin:'0 0 6px' }}>
                    {status === 'aguardando' ? 'Aguardando paciente entrar...' : 'Conectando...'}
                  </p>
                  <p style={{ fontSize:12, color:'#64748b', margin:0 }}>Camera e microfone ativos</p>
                  {/* Debug log */}
                  {logDebug.length > 0 && (
                    <div style={{ marginTop:16, background:'rgba(255,255,255,0.05)', borderRadius:8, padding:'8px 12px', maxWidth:340, textAlign:'left' }}>
                      {logDebug.map((l,i) => <p key={i} style={{ fontSize:10, color:'#475569', margin:'1px 0', fontFamily:'monospace' }}>{l}</p>)}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Video local PiP */}
          {status !== 'idle' && (
            <div style={{ position:'absolute', bottom:90, right:16, width:160, height:120, borderRadius:10, overflow:'hidden', border:'2px solid #1e293b', background:'#111', zIndex:10 }}>
              <video ref={localRef} autoPlay playsInline muted style={{ width:'100%', height:'100%', objectFit:'cover', transform:'scaleX(-1)' }}/>
              {!camOn && (
                <div style={{ position:'absolute', inset:0, background:'#1e293b', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="1.5"><line x1="1" y1="1" x2="23" y2="23"/><path d="M21 21H3a2 2 0 01-2-2V8"/></svg>
                </div>
              )}
              <p style={{ position:'absolute', bottom:4, left:0, right:0, textAlign:'center', fontSize:10, color:'white', margin:0 }}>Voce</p>
            </div>
          )}

          {/* Controles */}
          {status !== 'idle' && (
            <div style={{ position:'absolute', bottom:20, left:'50%', transform:'translateX(-50%)', display:'flex', gap:12, zIndex:20 }}>
              <button onClick={toggleMic} style={{ width:52, height:52, borderRadius:'50%', border:'none', background:micOn ? 'rgba(30,41,59,0.9)' : '#dc2626', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                  {micOn ? <><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></> : <><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 005.12 2.12M15 9.34V4a3 3 0 00-5.94-.6"/><path d="M17 16.95A7 7 0 015 12v-2m14 0v2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></>}
                </svg>
              </button>
              <button onClick={toggleCam} style={{ width:52, height:52, borderRadius:'50%', border:'none', background:camOn ? 'rgba(30,41,59,0.9)' : '#dc2626', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                  {camOn ? <path d="M15 10l4.553-2.169A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14v-4zM3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"/> : <><line x1="1" y1="1" x2="23" y2="23"/><path d="M21 21H3a2 2 0 01-2-2V8a2 2 0 012-2h3m3-3h6l2 3h4a2 2 0 012 2v9.34"/></>}
                </svg>
              </button>
              <button onClick={encerrar} style={{ width:52, height:52, borderRadius:'50%', border:'none', background:'#dc2626', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="white"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.27-.27.67-.36 1-.23 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1C10.29 21 3 13.71 3 4.99c0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.23 1L6.6 10.8z"/></svg>
              </button>
            </div>
          )}
        </div>

        {/* Chat */}
        {status === 'conectado' && (
          <div style={{ width:280, background:'#1e293b', display:'flex', flexDirection:'column', borderLeft:'1px solid #334155', flexShrink:0 }}>
            <div style={{ padding:'12px 16px', borderBottom:'1px solid #334155' }}>
              <p style={{ fontSize:13, fontWeight:700, color:'white', margin:0 }}>Chat</p>
            </div>
            <div style={{ flex:1, overflow:'auto', padding:'10px', display:'flex', flexDirection:'column', gap:8 }}>
              {chat.length === 0 && <p style={{ fontSize:12, color:'#475569', textAlign:'center', marginTop:20 }}>Nenhuma mensagem</p>}
              {chat.map((m,i) => (
                <div key={i} style={{ background:'#0f172a', borderRadius:8, padding:'8px 10px' }}>
                  <p style={{ fontSize:10, color:'#16a34a', fontWeight:700, margin:'0 0 3px' }}>{m.de} · {m.hora}</p>
                  <p style={{ fontSize:12, color:'#cbd5e1', margin:0, lineHeight:1.5 }}>{m.msg}</p>
                </div>
              ))}
            </div>
            <div style={{ padding:'10px', borderTop:'1px solid #334155', display:'flex', gap:6 }}>
              <input value={msgInput} onChange={e => setMsgInput(e.target.value)} onKeyDown={e => e.key==='Enter' && enviarChat()} style={{ flex:1, padding:'8px 10px', fontSize:12, borderRadius:8, border:'1px solid #334155', background:'#0f172a', color:'white', outline:'none' }} placeholder="Mensagem..."/>
              <button onClick={enviarChat} style={{ width:34, height:34, borderRadius:8, border:'none', background:'#16a34a', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
              </button>
            </div>
          </div>
        )}
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}*{box-sizing:border-box}html,body{margin:0;padding:0;background:#0f172a}`}</style>
    </div>
  )
}
