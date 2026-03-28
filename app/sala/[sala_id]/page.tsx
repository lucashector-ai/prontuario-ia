'use client'
import { useEffect, useRef, useState, use } from 'react'
import { createClient } from '@supabase/supabase-js'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const ICE_SERVERS = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }] }

export default function Sala({ params }: { params: Promise<{ sala_id: string }> }) {
  const { sala_id } = use(params)
  const localRef = useRef<HTMLVideoElement>(null)
  const remoteRef = useRef<HTMLVideoElement>(null)
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const channelRef = useRef<any>(null)
  const timerRef = useRef<any>(null)

  const [fase, setFase] = useState<'carregando'|'lobby'|'conectando'|'conectado'|'encerrado'|'erro'>('carregando')
  const [sala, setSala] = useState<any>(null)
  const [isMedico, setIsMedico] = useState(false)
  const [micOn, setMicOn] = useState(true)
  const [camOn, setCamOn] = useState(true)
  const [timer, setTimer] = useState(0)
  const [chat, setChat] = useState<{de:string,msg:string,h:string}[]>([])
  const [chatInput, setChatInput] = useState('')
  const [erroMsg, setErroMsg] = useState('')
  const [showChat, setShowChat] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const med = localStorage.getItem('medico')
    setIsMedico(!!med)
    init()
    return () => cleanup()
  }, [sala_id])

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [chat])

  const init = async () => {
    const { data } = await sb.from('teleconsultas').select('*, medicos(nome), pacientes(nome)').eq('sala_id', sala_id).single()
    if (!data) { setErroMsg('Sala nao encontrada ou link expirado.'); setFase('erro'); return }
    if (data.status === 'encerrada') { setErroMsg('Esta consulta ja foi encerrada.'); setFase('erro'); return }
    setSala(data)
    setFase('lobby')
  }

  const cleanup = () => {
    clearInterval(timerRef.current)
    pcRef.current?.close()
    streamRef.current?.getTracks().forEach(t => t.stop())
    channelRef.current?.unsubscribe()
  }

  const entrar = async () => {
    setFase('conectando')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 }, audio: true })
      streamRef.current = stream
      if (localRef.current) { localRef.current.srcObject = stream; localRef.current.muted = true }
    } catch {
      setErroMsg('Nao foi possivel acessar camera ou microfone. Verifique as permissoes do navegador.')
      setFase('erro'); return
    }

    const papel = isMedico ? 'medico' : 'paciente'
    const pc = new RTCPeerConnection(ICE_SERVERS)
    pcRef.current = pc
    streamRef.current!.getTracks().forEach(t => pc.addTrack(t, streamRef.current!))

    pc.ontrack = e => {
      if (remoteRef.current && e.streams[0]) {
        remoteRef.current.srcObject = e.streams[0]
        setFase('conectado')
        timerRef.current = setInterval(() => setTimer(t => t + 1), 1000)
      }
    }

    pc.onicecandidate = async e => {
      if (e.candidate) {
        await sb.from('teleconsulta_sinalizacao').insert({ sala_id, tipo: 'ice', dados: { candidate: e.candidate }, de: papel })
      }
    }

    pc.onconnectionstatechange = () => {
      if (['disconnected','failed','closed'].includes(pc.connectionState)) setFase('encerrado')
    }

    const channel = sb.channel('sala:' + sala_id, { config: { broadcast: { self: false } } })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'teleconsulta_sinalizacao', filter: 'sala_id=eq.' + sala_id },
        async (payload) => {
          const sig = payload.new as any
          if (sig.de === papel) return
          try {
            if (sig.tipo === 'offer' && !isMedico) {
              await pc.setRemoteDescription(new RTCSessionDescription(sig.dados))
              const ans = await pc.createAnswer()
              await pc.setLocalDescription(ans)
              await sb.from('teleconsulta_sinalizacao').insert({ sala_id, tipo: 'answer', dados: ans, de: 'paciente' })
            } else if (sig.tipo === 'answer' && isMedico) {
              if (pc.signalingState !== 'stable') await pc.setRemoteDescription(new RTCSessionDescription(sig.dados))
            } else if (sig.tipo === 'ice') {
              await pc.addIceCandidate(new RTCIceCandidate(sig.dados.candidate))
            } else if (sig.tipo === 'chat') {
              setChat(prev => [...prev, { de: sig.de === 'medico' ? 'Medico' : 'Paciente', msg: sig.dados.msg, h: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) }])
            } else if (sig.tipo === 'encerrar') {
              encerrarLocal()
            }
          } catch {}
        })
      .subscribe()
    channelRef.current = channel

    if (isMedico) {
      await sb.from('teleconsultas').update({ status: 'em_andamento', iniciada_em: new Date().toISOString() }).eq('sala_id', sala_id)
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      await sb.from('teleconsulta_sinalizacao').insert({ sala_id, tipo: 'offer', dados: offer, de: 'medico' })
    }
  }

  const encerrarLocal = () => {
    cleanup()
    setFase('encerrado')
  }

  const encerrar = async () => {
    await sb.from('teleconsulta_sinalizacao').insert({ sala_id, tipo: 'encerrar', dados: {}, de: isMedico ? 'medico' : 'paciente' })
    if (isMedico) await sb.from('teleconsultas').update({ status: 'encerrada', encerrada_em: new Date().toISOString(), duracao_segundos: timer }).eq('sala_id', sala_id)
    encerrarLocal()
  }

  const toggleMic = () => { streamRef.current?.getAudioTracks().forEach(t => { t.enabled = !t.enabled; setMicOn(t.enabled) }) }
  const toggleCam = () => { streamRef.current?.getVideoTracks().forEach(t => { t.enabled = !t.enabled; setCamOn(t.enabled) }) }

  const enviarChat = async () => {
    if (!chatInput.trim()) return
    const msg = chatInput.trim(); setChatInput('')
    setChat(prev => [...prev, { de: 'Voce', msg, h: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) }])
    await sb.from('teleconsulta_sinalizacao').insert({ sala_id, tipo: 'chat', dados: { msg }, de: isMedico ? 'medico' : 'paciente' })
  }

  const fmtT = (s: number) => String(Math.floor(s/60)).padStart(2,'0') + ':' + String(s%60).padStart(2,'0')

  if (fase === 'carregando') return (
    <div style={{ minHeight:'100vh', background:'#0a0f1e', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ width:48, height:48, borderRadius:'50%', border:'3px solid #16a34a', borderTopColor:'transparent', animation:'spin 0.8s linear infinite' }}/>
      <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
    </div>
  )

  if (fase === 'erro') return (
    <div style={{ minHeight:'100vh', background:'#0a0f1e', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:16 }}>
      <div style={{ width:56, height:56, borderRadius:14, background:'#dc2626', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
      </div>
      <p style={{ fontSize:16, color:'white', fontWeight:600 }}>{erroMsg}</p>
      {isMedico && <a href="/teleconsulta" style={{ padding:'10px 20px', background:'#16a34a', color:'white', borderRadius:9, textDecoration:'none', fontSize:13, fontWeight:600 }}>Voltar</a>}
    </div>
  )

  if (fase === 'encerrado') return (
    <div style={{ minHeight:'100vh', background:'#0a0f1e', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:16 }}>
      <div style={{ width:64, height:64, borderRadius:16, background:'#16a34a', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
      </div>
      <p style={{ fontSize:20, color:'white', fontWeight:700, margin:0 }}>Consulta encerrada</p>
      <p style={{ fontSize:14, color:'#64748b', margin:0 }}>Duracao: {fmtT(timer)}</p>
      {isMedico && <a href="/teleconsulta" style={{ marginTop:8, padding:'10px 24px', background:'#16a34a', color:'white', borderRadius:10, textDecoration:'none', fontSize:14, fontWeight:600 }}>Voltar para teleconsultas</a>}
    </div>
  )

  return (
    <div style={{ minHeight:'100vh', background:'#0a0f1e', display:'flex', flexDirection:'column' }}>
      {/* Header */}
      <div style={{ background:'#111827', padding:'12px 20px', display:'flex', alignItems:'center', justifyContent:'space-between', borderBottom:'1px solid #1f2937', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:30, height:30, borderRadius:8, background:'#16a34a', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
          </div>
          <div>
            <p style={{ fontSize:13, fontWeight:700, color:'white', margin:0 }}>{sala?.titulo || 'Teleconsulta'}</p>
            <p style={{ fontSize:11, color:'#4b5563', margin:0 }}>{isMedico ? 'Medico' : 'Paciente'} · {sala?.medicos?.nome}</p>
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          {fase === 'conectado' && (
            <div style={{ display:'flex', alignItems:'center', gap:6, background:'#0a0f1e', padding:'5px 12px', borderRadius:20 }}>
              <span style={{ width:7, height:7, borderRadius:'50%', background:'#16a34a', animation:'pulse 2s infinite', display:'inline-block' }}/>
              <span style={{ fontSize:13, color:'#22c55e', fontWeight:700, fontFamily:'monospace' }}>{fmtT(timer)}</span>
            </div>
          )}
          {fase === 'conectado' && (
            <button onClick={() => setShowChat(!showChat)} style={{ padding:'6px 12px', background:showChat?'#1f2937':'#374151', border:'1px solid #374151', borderRadius:8, color:'white', fontSize:12, cursor:'pointer', display:'flex', alignItems:'center', gap:5 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
              Chat {chat.length > 0 && <span style={{ background:'#16a34a', borderRadius:'50%', width:16, height:16, fontSize:9, display:'flex', alignItems:'center', justifyContent:'center' }}>{chat.length}</span>}
            </button>
          )}
        </div>
      </div>

      {/* Video + Chat */}
      <div style={{ flex:1, display:'flex', overflow:'hidden' }}>
        {/* Video principal */}
        <div style={{ flex:1, position:'relative', background:'#000' }}>
          <video ref={remoteRef} autoPlay playsInline style={{ width:'100%', height:'100%', objectFit:'cover' }}/>

          {/* Lobby / conectando overlay */}
          {(fase === 'lobby' || fase === 'conectando') && (
            <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', background:'linear-gradient(135deg, #0a0f1e 0%, #111827 100%)', flexDirection:'column', gap:24 }}>
              <div style={{ textAlign:'center' }}>
                <div style={{ width:80, height:80, borderRadius:20, background:'rgba(22,163,74,0.15)', border:'1.5px solid rgba(22,163,74,0.3)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px' }}>
                  <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="1.5"><path d="M15 10l4.553-2.169A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14v-4zM3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"/></svg>
                </div>
                {fase === 'lobby' ? (
                  <>
                    <p style={{ fontSize:20, color:'white', fontWeight:700, margin:'0 0 8px' }}>{sala?.titulo}</p>
                    <p style={{ fontSize:13, color:'#6b7280', margin:'0 0 28px' }}>
                      {isMedico ? 'Inicie para o paciente poder entrar' : 'Clique para entrar na sala — o medico te aguarda'}
                    </p>
                    <button onClick={entrar} style={{ padding:'14px 40px', background:'#16a34a', color:'white', border:'none', borderRadius:12, fontSize:15, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:8, margin:'0 auto' }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M15 10l4.553-2.169A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14v-4zM3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"/></svg>
                      Entrar na consulta
                    </button>
                  </>
                ) : (
                  <>
                    <div style={{ width:48, height:48, borderRadius:'50%', border:'3px solid #16a34a', borderTopColor:'transparent', animation:'spin 0.8s linear infinite', margin:'0 auto 16px' }}/>
                    <p style={{ fontSize:15, color:'white', fontWeight:600, margin:0 }}>
                      {isMedico ? 'Aguardando paciente entrar...' : 'Conectando ao medico...'}
                    </p>
                    <p style={{ fontSize:12, color:'#4b5563', marginTop:6 }}>Isso pode levar alguns segundos</p>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Local video PiP */}
          {(fase === 'conectando' || fase === 'conectado') && (
            <div style={{ position:'absolute', bottom:80, right:16, width:180, height:130, borderRadius:12, overflow:'hidden', border:'2px solid #1f2937', background:'#111', boxShadow:'0 8px 24px rgba(0,0,0,0.5)' }}>
              <video ref={localRef} autoPlay playsInline muted style={{ width:'100%', height:'100%', objectFit:'cover', transform:'scaleX(-1)' }}/>
              {!camOn && (
                <div style={{ position:'absolute', inset:0, background:'#1f2937', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="1.5"><path d="M1 1l22 22M17 17H7a2 2 0 01-2-2V7m3.56-3.56A9.27 9.27 0 0112 3h8a2 2 0 012 2v12a2 2 0 01-1.73 1.73"/><path d="M21 21H3a2 2 0 01-2-2V8"/></svg>
                </div>
              )}
              <div style={{ position:'absolute', bottom:4, left:6, fontSize:9, color:'#9ca3af', fontWeight:600 }}>VOCE</div>
            </div>
          )}

          {/* Controles */}
          {(fase === 'conectando' || fase === 'conectado') && (
            <div style={{ position:'absolute', bottom:16, left:'50%', transform:'translateX(-50%)', display:'flex', gap:12, background:'rgba(0,0,0,0.6)', padding:'10px 20px', borderRadius:50, backdropFilter:'blur(8px)' }}>
              <button onClick={toggleMic} title={micOn?'Mutar':'Desmutar'} style={{ width:48, height:48, borderRadius:'50%', border:'none', background:micOn?'rgba(255,255,255,0.15)':'#dc2626', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', transition:'background 0.2s' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                  {micOn ? <><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8"/></> : <><path d="M1 1l22 22M9 9v3a3 3 0 005.12 2.12M15 9.34V4a3 3 0 00-5.94-.6"/><path d="M17 16.95A7 7 0 015 12v-2m14 0v2a7 7 0 01-.11 1.23M12 19v4M8 23h8"/></>}
                </svg>
              </button>
              <button onClick={toggleCam} title={camOn?'Desligar camera':'Ligar camera'} style={{ width:48, height:48, borderRadius:'50%', border:'none', background:camOn?'rgba(255,255,255,0.15)':'#dc2626', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', transition:'background 0.2s' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                  {camOn ? <path d="M15 10l4.553-2.169A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14v-4zM3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"/> : <><line x1="1" y1="1" x2="23" y2="23"/><path d="M21 21H3a2 2 0 01-2-2V8a2 2 0 012-2h3m3-3h6l2 3h4a2 2 0 012 2v9.34"/></>}
                </svg>
              </button>
              <button onClick={encerrar} title="Encerrar consulta" style={{ width:48, height:48, borderRadius:'50%', border:'none', background:'#dc2626', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="white"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/></svg>
              </button>
            </div>
          )}
        </div>

        {/* Chat */}
        {showChat && fase === 'conectado' && (
          <div style={{ width:280, background:'#111827', display:'flex', flexDirection:'column', borderLeft:'1px solid #1f2937', flexShrink:0 }}>
            <div style={{ padding:'14px 16px', borderBottom:'1px solid #1f2937' }}>
              <p style={{ fontSize:13, fontWeight:700, color:'white', margin:0 }}>Chat da consulta</p>
            </div>
            <div style={{ flex:1, overflow:'auto', padding:12, display:'flex', flexDirection:'column', gap:8 }}>
              {chat.length === 0 && <p style={{ fontSize:12, color:'#374151', textAlign:'center', marginTop:16 }}>Nenhuma mensagem ainda</p>}
              {chat.map((m,i) => (
                <div key={i} style={{ background:'#1f2937', borderRadius:8, padding:'8px 10px' }}>
                  <p style={{ fontSize:10, color:'#16a34a', fontWeight:700, margin:'0 0 3px' }}>{m.de} · {m.h}</p>
                  <p style={{ fontSize:12, color:'#d1d5db', margin:0, lineHeight:1.4 }}>{m.msg}</p>
                </div>
              ))}
              <div ref={chatEndRef}/>
            </div>
            <div style={{ padding:'10px', borderTop:'1px solid #1f2937', display:'flex', gap:6 }}>
              <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && enviarChat()} style={{ flex:1, padding:'8px 10px', fontSize:12, borderRadius:8, border:'1px solid #374151', background:'#0a0f1e', color:'white', outline:'none' }} placeholder="Mensagem..."/>
              <button onClick={enviarChat} style={{ width:34, height:34, borderRadius:8, border:'none', background:'#16a34a', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
              </button>
            </div>
          </div>
        )}
      </div>
      <style>{'@keyframes spin{to{transform:rotate(360deg)}} @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}'}</style>
    </div>
  )
}
