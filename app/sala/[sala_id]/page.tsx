'use client'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function Sala({ params }: { params: { sala_id: string } }) {
  const { sala_id } = params
  const localRef = useRef<HTMLVideoElement>(null)
  const remoteRef = useRef<HTMLVideoElement>(null)
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)

  const [status, setStatus] = useState<'aguardando'|'conectando'|'conectado'|'encerrado'>('aguardando')
  const [sala, setSala] = useState<any>(null)
  const [isMedico, setIsMedico] = useState(false)
  const [micOn, setMicOn] = useState(true)
  const [camOn, setCamOn] = useState(true)
  const [timer, setTimer] = useState(0)
  const [chat, setChat] = useState<Array<{de:string, msg:string, hora:string}>>([])
  const [msgInput, setMsgInput] = useState('')
  const [erro, setErro] = useState('')
  const timerRef = useRef<any>(null)
  const channelRef = useRef<any>(null)

  useEffect(() => {
    carregarSala()
    const med = localStorage.getItem('medico')
    setIsMedico(!!med)
  }, [sala_id])

  const carregarSala = async () => {
    const { data } = await supabase.from('teleconsultas').select('*, medicos(nome), pacientes(nome)').eq('sala_id', sala_id).single()
    if (!data) { setErro('Sala nao encontrada ou link expirado.'); return }
    if (data.status === 'encerrada') { setErro('Esta consulta ja foi encerrada.'); return }
    setSala(data)
  }

  const iniciarMidia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      localStreamRef.current = stream
      if (localRef.current) localRef.current.srcObject = stream
      return stream
    } catch (e) {
      setErro('Nao foi possivel acessar camera/microfone. Verifique as permissoes.')
      return null
    }
  }

  const criarPC = (stream: MediaStream) => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    })
    stream.getTracks().forEach(t => pc.addTrack(t, stream))
    pc.ontrack = (e) => {
      if (remoteRef.current && e.streams[0]) {
        remoteRef.current.srcObject = e.streams[0]
        setStatus('conectado')
        iniciarTimer()
      }
    }
    pc.onicecandidate = async (e) => {
      if (e.candidate) {
        await supabase.from('teleconsulta_sinalizacao').insert({
          sala_id, tipo: 'ice', dados: { candidate: e.candidate },
          de: isMedico ? 'medico' : 'paciente'
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

  const entrarNaSala = async () => {
    setStatus('conectando')
    const stream = await iniciarMidia()
    if (!stream) return

    const papel = isMedico ? 'medico' : 'paciente'
    const pc = criarPC(stream)

    // Escuta sinalizacao em tempo real
    const channel = supabase.channel('sala-' + sala_id)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'teleconsulta_sinalizacao', filter: 'sala_id=eq.' + sala_id },
        async (payload) => {
          const sig = payload.new as any
          if (sig.de === papel) return // ignora proprio sinal
          if (sig.tipo === 'offer' && !isMedico) {
            await pc.setRemoteDescription(new RTCSessionDescription(sig.dados))
            const answer = await pc.createAnswer()
            await pc.setLocalDescription(answer)
            await supabase.from('teleconsulta_sinalizacao').insert({ sala_id, tipo: 'answer', dados: answer, de: 'paciente' })
          }
          if (sig.tipo === 'answer' && isMedico) {
            await pc.setRemoteDescription(new RTCSessionDescription(sig.dados))
          }
          if (sig.tipo === 'ice') {
            try { await pc.addIceCandidate(new RTCIceCandidate(sig.dados.candidate)) } catch(e) {}
          }
          if (sig.tipo === 'chat') {
            setChat(prev => [...prev, { de: sig.de === 'medico' ? 'Medico' : 'Paciente', msg: sig.dados.msg, hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) }])
          }
          if (sig.tipo === 'encerrar') { encerrarLocal() }
        }
      ).subscribe()
    channelRef.current = channel

    // Medico cria a offer
    if (isMedico) {
      await supabase.from('teleconsultas').update({ status: 'em_andamento', iniciada_em: new Date().toISOString() }).eq('sala_id', sala_id)
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      await supabase.from('teleconsulta_sinalizacao').insert({ sala_id, tipo: 'offer', dados: offer, de: 'medico' })
    }
  }

  const iniciarTimer = () => {
    timerRef.current = setInterval(() => setTimer(t => t + 1), 1000)
  }

  const fmtTimer = (s: number) => {
    const m = Math.floor(s / 60), seg = s % 60
    return String(m).padStart(2, '0') + ':' + String(seg).padStart(2, '0')
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
    const de = isMedico ? 'medico' : 'paciente'
    setChat(prev => [...prev, { de: isMedico ? 'Voce' : 'Voce', msg, hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) }])
    await supabase.from('teleconsulta_sinalizacao').insert({ sala_id, tipo: 'chat', dados: { msg }, de })
  }

  const encerrarLocal = () => {
    clearInterval(timerRef.current)
    pcRef.current?.close()
    localStreamRef.current?.getTracks().forEach(t => t.stop())
    channelRef.current?.unsubscribe()
    setStatus('encerrado')
  }

  const encerrar = async () => {
    await supabase.from('teleconsulta_sinalizacao').insert({ sala_id, tipo: 'encerrar', dados: {}, de: isMedico ? 'medico' : 'paciente' })
    await supabase.from('teleconsultas').update({ status: 'encerrada', encerrada_em: new Date().toISOString(), duracao_segundos: timer }).eq('sala_id', sala_id)
    encerrarLocal()
  }

  if (erro) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a', flexDirection: 'column', gap: 16 }}>
      <div style={{ width: 56, height: 56, borderRadius: 14, background: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
      </div>
      <p style={{ fontSize: 16, color: 'white', fontWeight: 600, margin: 0 }}>{erro}</p>
    </div>
  )

  if (status === 'encerrado') return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a', flexDirection: 'column', gap: 20 }}>
      <div style={{ width: 64, height: 64, borderRadius: 16, background: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
      </div>
      <p style={{ fontSize: 20, color: 'white', fontWeight: 700, margin: 0 }}>Consulta encerrada</p>
      <p style={{ fontSize: 14, color: '#94a3b8', margin: 0 }}>Duracao: {fmtTimer(timer)}</p>
      {isMedico && <a href="/agenda" style={{ marginTop: 8, padding: '10px 24px', background: '#16a34a', color: 'white', borderRadius: 10, textDecoration: 'none', fontSize: 14, fontWeight: 600 }}>Voltar para agenda</a>}
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', flexDirection: 'column', userSelect: 'none' }}>
      {/* Header */}
      <div style={{ background: '#1e293b', padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: 'white', margin: 0 }}>MedIA Teleconsulta</p>
            <p style={{ fontSize: 11, color: '#64748b', margin: 0 }}>{sala?.titulo || 'Carregando...'}</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {status === 'conectado' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#0f172a', padding: '5px 12px', borderRadius: 20 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#16a34a', display: 'inline-block' }}/>
              <span style={{ fontSize: 13, color: '#22c55e', fontWeight: 700, fontFamily: 'monospace' }}>{fmtTimer(timer)}</span>
            </div>
          )}
          <span style={{ fontSize: 12, color: '#475569', background: '#1e293b', border: '1px solid #334155', padding: '4px 10px', borderRadius: 6 }}>
            {isMedico ? '👨‍⚕️ Medico' : '👤 Paciente'}
          </span>
        </div>
      </div>

      {/* Main area */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Video area */}
        <div style={{ flex: 1, position: 'relative', background: '#000' }}>
          {/* Remote video (full) */}
          <video ref={remoteRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', background: '#111' }}/>

          {/* Waiting overlay */}
          {status !== 'conectado' && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a', flexDirection: 'column', gap: 20 }}>
              {status === 'aguardando' ? (
                <>
                  <div style={{ width: 80, height: 80, borderRadius: 20, background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="1.5"><path d="M15 10l4.553-2.169A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14v-4zM3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"/></svg>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: 18, color: 'white', fontWeight: 700, margin: '0 0 8px' }}>
                      {sala ? (isMedico ? 'Iniciar consulta com ' + (sala.pacientes?.nome || 'paciente') : 'Sala: ' + sala.titulo) : 'Carregando...'}
                    </p>
                    <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 24px' }}>
                      {isMedico ? 'Clique para conectar e aguardar o paciente' : 'O medico iniciara a consulta em breve'}
                    </p>
                    <button onClick={entrarNaSala} style={{ padding: '14px 36px', background: '#16a34a', color: 'white', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
                      Entrar na sala
                    </button>
                  </div>
                </>
              ) : (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ width: 64, height: 64, borderRadius: '50%', border: '3px solid #16a34a', borderTopColor: 'transparent', animation: 'spin 1s linear infinite', margin: '0 auto 20px' }}/>
                  <p style={{ fontSize: 16, color: 'white', fontWeight: 600, margin: 0 }}>
                    {isMedico ? 'Aguardando paciente...' : 'Conectando...'}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Local video (PiP) */}
          {status !== 'aguardando' && (
            <div style={{ position: 'absolute', bottom: 100, right: 16, width: 160, height: 120, borderRadius: 10, overflow: 'hidden', border: '2px solid #334155', background: '#111' }}>
              <video ref={localRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}/>
              {!camOn && (
                <div style={{ position: 'absolute', inset: 0, background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="1.5"><line x1="1" y1="1" x2="23" y2="23"/><path d="M21 21H3a2 2 0 01-2-2V8a2 2 0 012-2h3m3-3h6l2 3h4a2 2 0 012 2v9.34"/></svg>
                </div>
              )}
            </div>
          )}

          {/* Controls */}
          {status !== 'aguardando' && (
            <div style={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 12 }}>
              <button onClick={toggleMic} style={{ width: 52, height: 52, borderRadius: '50%', border: 'none', background: micOn ? '#334155' : '#dc2626', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                  {micOn ? <><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8"/></> : <><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 005.12 2.12M15 9.34V4a3 3 0 00-5.94-.6"/><path d="M17 16.95A7 7 0 015 12v-2m14 0v2a7 7 0 01-.11 1.23M12 19v4M8 23h8"/></>}
                </svg>
              </button>
              <button onClick={toggleCam} style={{ width: 52, height: 52, borderRadius: '50%', border: 'none', background: camOn ? '#334155' : '#dc2626', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                  {camOn ? <path d="M15 10l4.553-2.169A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14v-4zM3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"/> : <><line x1="1" y1="1" x2="23" y2="23"/><path d="M21 21H3a2 2 0 01-2-2V8a2 2 0 012-2h3m3-3h6l2 3h4a2 2 0 012 2v9.34"/></>}
                </svg>
              </button>
              <button onClick={encerrar} style={{ width: 52, height: 52, borderRadius: '50%', border: 'none', background: '#dc2626', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="white"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/></svg>
              </button>
            </div>
          )}
        </div>

        {/* Chat lateral */}
        {status === 'conectado' && (
          <div style={{ width: 280, background: '#1e293b', display: 'flex', flexDirection: 'column', borderLeft: '1px solid #334155', flexShrink: 0 }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid #334155' }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: 'white', margin: 0 }}>Chat</p>
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {chat.length === 0 && <p style={{ fontSize: 12, color: '#475569', textAlign: 'center', marginTop: 20 }}>Nenhuma mensagem ainda</p>}
              {chat.map((m, i) => (
                <div key={i} style={{ background: '#0f172a', borderRadius: 8, padding: '8px 10px' }}>
                  <p style={{ fontSize: 10, color: '#16a34a', fontWeight: 700, margin: '0 0 3px' }}>{m.de} · {m.hora}</p>
                  <p style={{ fontSize: 12, color: '#cbd5e1', margin: 0, lineHeight: 1.4 }}>{m.msg}</p>
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
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
