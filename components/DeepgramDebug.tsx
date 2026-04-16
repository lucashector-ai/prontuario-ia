'use client'

import { useEffect, useRef, useState } from 'react'

type LogEntry = {
  ts: string
  type: 'ws' | 'transcript' | 'error' | 'audio' | 'info'
  label: string
  data?: any
}

export default function DeepgramDebug() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [expanded, setExpanded] = useState(true)
  const [wsPatched, setWsPatched] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const addLog = (type: LogEntry['type'], label: string, data?: any) => {
    const ts = new Date().toLocaleTimeString('pt-BR', { hour12: false, fractionalSecondDigits: 2 })
    const style = { ws:'color:#60a5fa', transcript:'color:#4ade80;font-weight:bold', error:'color:#f87171;font-weight:bold', audio:'color:#a78bfa', info:'color:#94a3b8' }[type]
    console.log(`%c[MedIA ${ts}] ${label}`, style, data ?? '')
    setLogs(prev => [...prev.slice(-200), { ts, type, label, data }])
  }

  useEffect(() => {
    if (wsPatched) return
    const OrigWS = window.WebSocket
    class PatchedWS extends OrigWS {
      constructor(url: string | URL, protocols?: string | string[]) {
        super(url, protocols)
        if (!url.toString().includes('deepgram')) return
        addLog('ws', '🔌 WS conectando', { url: url.toString() })
        this.addEventListener('open', () => addLog('ws', '✅ WS OPEN'))
        this.addEventListener('close', (e: CloseEvent) => addLog('ws', `🔴 WS CLOSED code:${e.code}`, { reason: e.reason }))
        this.addEventListener('error', (e: Event) => addLog('error', '❌ WS ERROR', e))
        this.addEventListener('message', (e: MessageEvent) => {
          try {
            const msg = JSON.parse(e.data)
            if (msg?.type === 'Results') {
              const t = msg?.channel?.alternatives?.[0]?.transcript ?? ''
              const conf = msg?.channel?.alternatives?.[0]?.confidence ?? 0
              if (t) addLog('transcript', `📝 ${msg.is_final ? '[FINAL]' : '[interim]'}${msg.speech_final ? '[SPEECH_FINAL]' : ''}`, { transcript: t, confidence: (conf*100).toFixed(1)+'%', is_final: msg.is_final })
              else addLog('info', '📭 Results vazio (silêncio)', { is_final: msg.is_final })
            } else {
              addLog('info', `📨 ${msg?.type}`, msg)
            }
          } catch { addLog('info', '📨 msg não-JSON', { data: e.data }) }
        })
      }
    }
    // @ts-ignore
    window.WebSocket = PatchedWS
    const OrigMR = window.MediaRecorder
    if (OrigMR) {
      // @ts-ignore
      window.MediaRecorder = class extends OrigMR {
        constructor(s: MediaStream, o?: MediaRecorderOptions) {
          super(s, o)
          addLog('audio', '🎙️ MediaRecorder criado', { mimeType: this.mimeType })
          this.addEventListener('start', () => addLog('audio', '▶️ START'))
          this.addEventListener('stop', () => addLog('audio', '⏹️ STOP'))
          this.addEventListener('dataavailable', (e: BlobEvent) => addLog('audio', '📦 chunk', { size: e.data.size+'b', type: e.data.type }))
          this.addEventListener('error', (e: Event) => addLog('error', '❌ MediaRecorder ERROR', e))
        }
      }
    }
    setWsPatched(true)
    addLog('info', '🔍 Debug ativo')
    return () => { // @ts-ignore
      window.WebSocket = OrigWS }
  }, [wsPatched])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [logs])

  const colors = { ws:'#60a5fa', transcript:'#4ade80', error:'#f87171', audio:'#a78bfa', info:'#94a3b8' }

  return (
    <div style={{ position:'fixed', bottom:16, right:16, width:expanded?420:160, maxHeight:expanded?500:40, background:'#0f172a', border:'1px solid #1e3a5f', borderRadius:12, fontFamily:"'JetBrains Mono',monospace", fontSize:11, zIndex:9999, boxShadow:'0 25px 50px rgba(0,0,0,.6)', overflow:'hidden', display:'flex', flexDirection:'column' }}>
      <div onClick={() => setExpanded(e=>!e)} style={{ padding:'8px 12px', background:'#1e3a5f', cursor:'pointer', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <span style={{ color:'#60a5fa', fontWeight:700 }}>🩺 MedIA Debug</span>
        <div style={{ display:'flex', gap:8 }}>
          <span style={{ color:'#94a3b8', fontSize:10 }}>{logs.length} logs</span>
          <span style={{ color:'#60a5fa' }}>{expanded?'▼':'▲'}</span>
        </div>
      </div>
      {expanded && <>
        <div style={{ flex:1, overflowY:'auto', padding:'8px 4px' }}>
          {logs.length === 0 && <div style={{ color:'#475569', padding:12, textAlign:'center' }}>Aguardando eventos...<br/><span style={{color:'#334155'}}>Inicie a gravação</span></div>}
          {logs.map((log, i) => (
            <div key={i} style={{ padding:'3px 8px', borderBottom:'1px solid #1e293b', display:'flex', gap:6 }}>
              <span style={{ color:'#475569', flexShrink:0, fontSize:10 }}>{log.ts}</span>
              <div style={{ flex:1, minWidth:0 }}>
                <span style={{ color:colors[log.type] }}>{log.label}</span>
                {log.type === 'transcript' && log.data && (
                  <div style={{ color:'#e2e8f0', background:'#1e293b', borderRadius:4, padding:'2px 6px', marginTop:2, wordBreak:'break-word', borderLeft:'2px solid #4ade80' }}>
                    "{log.data.transcript}" <span style={{ color:'#475569' }}>{log.data.confidence}</span>
                  </div>
                )}
                {log.type === 'error' && log.data && <div style={{ color:'#f87171', fontSize:10, marginTop:2 }}>{JSON.stringify(log.data).slice(0,120)}</div>}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
        <div style={{ padding:'6px 12px', borderTop:'1px solid #1e293b', display:'flex', justifyContent:'space-between' }}>
          <span style={{ color:'#334155', fontSize:10 }}>{wsPatched?'✓ interceptado':'⏳'}</span>
          <button onClick={() => setLogs([])} style={{ background:'none', border:'1px solid #1e293b', borderRadius:4, color:'#475569', cursor:'pointer', fontSize:10, padding:'2px 8px' }}>limpar</button>
        </div>
      </>}
    </div>
  )
}
