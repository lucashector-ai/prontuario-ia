'use client'
import { useEffect, useRef, useState, use } from 'react'
import { supabase } from '@/lib/supabase'

export default function Sala({ params }: { params: Promise<{ sala_id: string }> }) {
  const { sala_id } = use(params)

  const localRef = useRef<HTMLVideoElement>(null)
  const remoteRef = useRef<HTMLVideoElement>(null)
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const channelRef = useRef<any>(null)
  const timerRef = useRef<any>(null)

  const [status, setStatus] = useState<'idle'|'conectando'|'conectado'|'encerrado'>('idle')
  const [sala, setSala] = useState<any>(null)
  const [isMedico, setIsMedico] = useState(false)
  const [micOn, setMicOn] = useState(true)
  const [camOn, setCamOn] = useState(true)
  const [timer, setTimer] = useState(0)
  const [chat, setChat] = useState<{de:string;msg:string;hora:string}[]>([])
  const [msgInput, setMsgInput] = useState('')
  const [erro, setErro] = useState('')
  const [remoteName, setRemoteName] = useState('')

  useEffect(() => {
    const med = localStorage.getItem('medico')
    setIsMedico(!!med)
    carregarSala()
  }, [sala_id])

  const carregarSala = async () => {
    const { data } = await supabase
      .from('teleconsultas')
      .select('*, medicos(nome), pacientes(nome)')
      .eq('sala_id', sala_id)
      .single()
    if (!data) { setErro('Sala nao encontrada ou link expirado.'); return }
    if (data.status === 'encerrada') { setErro('Esta consulta ja foi encerrada.'); return }
    setSala(data)
  }

  const fmtTimer = (s: number) => String(Math.floor(s/60)).padStart(2,'0') + ':' + String(s%60).padStart(2,'0')

  const iniciarMidia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      localStreamRef.current = stream
      if (localRef.current) { localRef.current.srcObject = stream }
      return stream
    } catch {
      setErro('Nao foi possivel acessar camera/microfone. Verifique as permissoes do browser.')
      return null
    }
  }

  const criarPC = (stream: MediaStream, papel: string) => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
      ]
    })
    stream.getTracks().forEach(t => pc.addTrack(t, stream))

    pc.ontrack = (e) => {
      if (remoteRef.current && e.streams[0]) {
        remoteRef.current.srcObject = e.streams[0]
        setStatus('conectado')
        setRemoteName(papel === 'medico' ? (sala?.pacientes?.nome || 'Paciente') : (sala?.medicos?.nome || 'Medico'))
        timerRef.current = setInterval(() => setTimer(t => t + 1), 1000)
        supabase.from('teleconsultas').update({ status: 'em_andamento', iniciada_em: new Date().toISOString() }).eq('sala_id', sala_id)
      }
    }

    pc.onicecandidate = async (e) => {
      if (e.candidate) {
        await supabase.from('teleconsulta_sinalizacao').insert({
          sala_id, tipo: 'ice',
          dados: { candidate: e.candidate.toJSON() },
          de: papel
        })
      }
    }

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        setStatus('encerrado')
      }
    }

    pcRef.current = pc
    return pc
  }

  const entrar = async () => {
    setStatus('conectando')
    const papel = isMedico ? 'medico' : 'paciente'
    const stream = await iniciarMidia()
    if (!stream) { setStatus('idle'); return }

    const pc = criarPC(stream, papel)

    // Inicia canal realtime para sinalizacao
    const channel = supabase.channel('tc-' + sala_id, { config: { presence: { key: papel } } })
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public',
        table: 'teleconsulta_sinalizacao',
        filter: 'sala_id=eq.' + sala_id
      }, async (payload) => {
        const sig = payload.new as any
        if (sig.de === papel) return

        if (sig.tipo === 'offer' && !isMedico) {
          await pc.setRemoteDescription(new RTCSessionDescription(sig.dados))
          const answer = await pc.createAnswer()
          await pc.setLocalDescription(answer)
          await supabase.from('teleconsulta_sinalizacao').insert({
            sala_id, tipo: 'answer', dados: { type: answer.type, sdp: answer.sdp }, de: 'paciente'
          })
        }

        if (sig.tipo === 'answer' && isMedico) {
          if (pc.signalingState !== 'have-local-offer') return
          await pc.setRemoteDescription(new RTCSessionDescription(sig.dados))
        }

        if (sig.tipo === 'ice') {
          try {
            if (pc.remoteDescription) {
              await pc.addIceCandidate(new RTCIceCandidate(sig.dados.candidate))
            }
          } catch {}
        }

        if (sig.tipo === 'chat') {
          setChat(prev => [...prev, {
            de: sig.de === 'medico' ? (sala?.medicos?.nome || 'Medico') : (sala?.pacientes?.nome || 'Paciente'),
            msg: sig.dados.msg,
            hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
          }])
        }

        if (sig.tipo === 'encerrar') encerrarLocal(false)
      })
      .subscribe()

    channelRef.current = channel

    // Medico cria a offer
    if (isMedico) {
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      await supabase.from('teleconsulta_sinalizacao').insert({
        sala_id, tipo: 'offer',
        dados: { type: offer.type, sdp: offer.sdp },
        de: 'medico'
      })
    }
  }

  const encerrarLocal = (enviarSinal = true) => {
    clearInterval(timerRef.current)
    pcRef.current?.close()
    localStreamRef.current?.getTracks().forEach(t => t.stop())
    channelRef.current?.unsubscribe()
    if (localRef.current) localRef.current.srcObject = null
    if (remoteRef.current) remoteRef.current.srcObject = null
    setStatus('encerrado')
  }

  const encerrar = async () => {
    await supabase.from('teleconsulta_sinalizacao').insert({ sala_id, tipo: 'encerrar', dados: {}, de: isMedico ? 'medico' : 'paciente' })
    await supabase.from('teleconsultas').update({ status: 'encerrada', encerrada_em: new Date().toISOString(), duracao_segundos: timer }).eq('sala_id', sala_id)
    encerrarLocal(false)
  }

  const toggleMic = () => {
    localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = !t.enabled; setMicOn(t.enabled) })
  }

  const toggleCam = () => {
    localStreamRef.current?.getVideoTracks().forEach(t => { t.enabled = !t.enabled; setCamOn(t.enabled) })
  }

  const enviarChat = async () => {
    if (!msgInput.trim()) return
    const msg = msgInput.trim(); setMsgInput('')
    const papel = isMedico ? 'medico' : 'paciente'
    setChat(prev => [...prev, { de: 'Voce', msg, hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) }])
    await supabase.from('teleconsulta_sinalizacao').insert({ sala_id, tipo: 'chat', dados: { msg }, de: papel })
  }

  // Tela de erro
  if (erro) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a', flexDirection: 'column', gap: 16, padding: 24 }}>
      <div style={{ width: 56, height: 56, borderRadius: 14, background: '#7f1d1d', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fca5a5" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
      </div>
      <p style={{ fontSize: 16, color: 'white', fontWeight: 600, margin: 0, textAlign: 'center' }}>{erro}</p>
    </div>
  )

  // Tela de encerrado
  if (status === 'encerrado') return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a', flexDirection: 'column', gap: 20 }}>
      <div style={{ width: 64, height: 64, borderRadius: 16, background: '#14532d', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#86efac" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
      </div>
      <p style={{ fontSize: 20, color: 'white', fontWeight: 700, margin: 0 }}>Consulta encerrada</p>
      {timer > 0 && <p style={{ fontSize: 14, color: '#64748b', margin: 0 }}>Duracao: {fmtTimer(timer)}</p>}
      {isMedico && (
        <a href="/teleconsulta" style={{ marginTop: 8, padding: '10px 24px', background: '#16a34a', color: 'white', borderRadius: 10, textDecoration: 'none', fontSize: 14, fontWeight: 600 }}>
          Voltar para teleconsultas
        </a>
      )}
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ background: '#1e293b', padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, borderBottom: '1px solid #334155' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: 7, background: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: 'white', margin: 0 }}>MedIA Teleconsulta</p>
            <p style={{ fontSize: 11, color: '#64748b', margin: 0 }}>{sala?.titulo || '...'}{remoteName ? ' · ' + remoteName : ''}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {status === 'conectado' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#0f172a', padding: '4px 12px', borderRadius: 20, border: '1px solid #1e3a2f' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }}/>
              <span style={{ fontSize: 13, color: '#22c55e', fontWeight: 700, fontFamily: 'monospace' }}>{fmtTimer(timer)}</span>
            </div>
          )}
          <span style={{ fontSize: 11, color: '#475569', background: '#0f172a', border: '1px solid #334155', padding: '4px 10px', borderRadius: 6 }}>
            {isMedico ? '👨‍⚕️ Medico' : '👤 Paciente'}
          </span>
        </div>
      </div>

      {/* Area principal */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
        {/* Video */}
        <div style={{ flex: 1, position: 'relative', background: '#000', minWidth: 0 }}>

          {/* Video remoto (full) */}
          <video ref={remoteRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>

          {/* Overlay de espera */}
          {status !== 'conectado' && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a', flexDirection: 'column', gap: 24 }}>
              {status === 'idle' ? (
                <>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ width: 80, height: 80, borderRadius: 20, background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="1.5"><path d="M15 10l4.553-2.169A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14v-4zM3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"/></svg>
                    </div>
                    <p style={{ fontSize: 18, color: 'white', fontWeight: 700, margin: '0 0 8px' }}>
                      {sala ? (isMedico ? 'Consulta com ' + (sala.pacientes?.nome || 'paciente') : sala.titulo) : 'Carregando...'}
                    </p>
                    <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 28px' }}>
                      {isMedico ? 'Clique para iniciar e aguardar o paciente conectar' : 'O medico ja esta na sala. Clique para entrar.'}
                    </p>
                    {sala && (
                      <button onClick={entrar} style={{ padding: '14px 40px', background: '#16a34a', color: 'white', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
                        Entrar na sala
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ width: 64, height: 64, borderRadius: '50%', border: '3px solid #16a34a', borderTopColor: 'transparent', margin: '0 auto 20px', animation: 'spin 1s linear infinite' }}/>
                  <p style={{ fontSize: 16, color: 'white', fontWeight: 600, margin: '0 0 6px' }}>
                    {isMedico ? 'Aguardando paciente...' : 'Conectando...'}
                  </p>
                  <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>Camera e microfone ativos</p>
                </div>
              )}
            </div>
          )}

          {/* Video local (pip) */}
          {status !== 'idle' && (
            <div style={{ position: 'absolute', bottom: 90, right: 16, width: 160, height: 120, borderRadius: 10, overflow: 'hidden', border: '2px solid #1e293b', background: '#111', zIndex: 10 }}>
              <video ref={localRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}/>
              {!camOn && (
                <div style={{ position: 'absolute', inset: 0, background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="1.5"><line x1="1" y1="1" x2="23" y2="23"/><path d="M21 21H3a2 2 0 01-2-2V8"/></svg>
                </div>
              )}
              <p style={{ position: 'absolute', bottom: 4, left: 0, right: 0, textAlign: 'center', fontSize: 10, color: 'white', margin: 0, textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>Voce</p>
            </div>
          )}

          {/* Controles */}
          {status !== 'idle' && (
            <div style={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 12, zIndex: 20 }}>
              <button onClick={toggleMic} title={micOn ? 'Mutar' : 'Desmutar'} style={{ width: 52, height: 52, borderRadius: '50%', border: 'none', background: micOn ? 'rgba(30,41,59,0.9)' : '#dc2626', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                  {micOn
                    ? <><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></>
                    : <><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 005.12 2.12M15 9.34V4a3 3 0 00-5.94-.6"/><path d="M17 16.95A7 7 0 015 12v-2m14 0v2a7 7 0 01-.11 1.23"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></>
                  }
                </svg>
              </button>
              <button onClick={toggleCam} title={camOn ? 'Desligar camera' : 'Ligar camera'} style={{ width: 52, height: 52, borderRadius: '50%', border: 'none', background: camOn ? 'rgba(30,41,59,0.9)' : '#dc2626', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                  {camOn
                    ? <path d="M15 10l4.553-2.169A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14v-4zM3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"/>
                    : <><line x1="1" y1="1" x2="23" y2="23"/><path d="M21 21H3a2 2 0 01-2-2V8a2 2 0 012-2h3m3-3h6l2 3h4a2 2 0 012 2v9.34"/></>
                  }
                </svg>
              </button>
              <button onClick={encerrar} title="Encerrar consulta" style={{ width: 52, height: 52, borderRadius: '50%', border: 'none', background: '#dc2626', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
                  <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.27-.27.67-.36 1-.23 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1C10.29 21 3 13.71 3 4.99c0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.23 1L6.6 10.8z"/>
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* Painel de chat (so quando conectado) */}
        {status === 'conectado' && (
          <div style={{ width: 280, background: '#1e293b', display: 'flex', flexDirection: 'column', borderLeft: '1px solid #334155', flexShrink: 0 }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #334155' }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: 'white', margin: 0 }}>Chat</p>
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: '10px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {chat.length === 0 && (
                <p style={{ fontSize: 12, color: '#475569', textAlign: 'center', marginTop: 20 }}>Nenhuma mensagem</p>
              )}
              {chat.map((m, i) => (
                <div key={i} style={{ background: '#0f172a', borderRadius: 8, padding: '8px 10px' }}>
                  <p style={{ fontSize: 10, color: '#16a34a', fontWeight: 700, margin: '0 0 3px' }}>{m.de} · {m.hora}</p>
                  <p style={{ fontSize: 12, color: '#cbd5e1', margin: 0, lineHeight: 1.5 }}>{m.msg}</p>
                </div>
              ))}
            </div>
            <div style={{ padding: '10px', borderTop: '1px solid #334155', display: 'flex', gap: 6 }}>
              <input value={msgInput} onChange={e => setMsgInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && enviarChat()} style={{ flex: 1, padding: '8px 10px', fontSize: 12, borderRadius: 8, border: '1px solid #334155', background: '#0f172a', color: 'white', outline: 'none' }} placeholder="Mensagem..."/>
              <button onClick={enviarChat} style={{ width: 34, height: 34, borderRadius: 8, border: 'none', background: '#16a34a', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
        html, body { margin: 0; padding: 0; background: #0f172a; }
      `}</style>
    </div>
  )
}
