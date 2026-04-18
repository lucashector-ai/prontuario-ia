'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function WhatsAppApp() {
  const router = useRouter()
  const [medico, setMedico] = useState<any>(null)
  const [config, setConfig] = useState<any>(null)
  const [conversas, setConversas] = useState<any[]>([])
  const [ativa, setAtiva] = useState<any>(null)
  const [mensagens, setMensagens] = useState<any[]>([])
  const [msg, setMsg] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<'todas'|'nao_lidas'|'ia'|'humano'>('todas')
  const [novaConversa, setNovaConversa] = useState(false)
  const [novoTel, setNovoTel] = useState('')
  const [novaMsgTexto, setNovaMsgTexto] = useState('')
  const [menuConversa, setMenuConversa] = useState<{id: string, x: number, y: number} | null>(null)
  const [gravando, setGravando] = useState(false)
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null)
  const audioChunks = useRef<Blob[]>([])
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const fmt = (iso: string) => {
    const d = new Date(iso)
    const hoje = new Date()
    const ontem = new Date(hoje); ontem.setDate(hoje.getDate() - 1)
    if (d.toDateString() === hoje.toDateString()) return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    if (d.toDateString() === ontem.toDateString()) return 'Ontem'
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
  }
  const fmtH = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const fmtData = (iso: string) => {
    const d = new Date(iso)
    const hoje = new Date()
    const ontem = new Date(hoje); ontem.setDate(hoje.getDate() - 1)
    if (d.toDateString() === hoje.toDateString()) return 'Hoje'
    if (d.toDateString() === ontem.toDateString()) return 'Ontem'
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
  }
  const nomeCv = (c: any) => c.nome_contato || c.telefone
  const ini = (n: string) => n?.split(' ').map((x: string) => x[0]).slice(0, 2).join('').toUpperCase() || '?'

  useEffect(() => {
    const m = localStorage.getItem('medico')
    if (!m) { router.push('/login'); return }
    const med = JSON.parse(m)
    setMedico(med)
    supabase.from('whatsapp_config').select('*').eq('medico_id', med.id).single().then(({ data }) => setConfig(data))
  }, [router])

  useEffect(() => {
    if (!medico) return
    carregarConversas()
    const ch = supabase.channel('wapp-app')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_mensagens' }, () => carregarConversas())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_conversas' }, () => carregarConversas())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [medico])

  useEffect(() => {
    if (ativa) carregarMsgs(ativa.id)
  }, [ativa])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'instant' })
  }, [mensagens])

  const carregarConversas = useCallback(async () => {
    if (!medico) return
    const { data } = await supabase
      .from('whatsapp_conversas')
      .select('*, whatsapp_mensagens(conteudo, criado_em, tipo, lida)')
      .eq('medico_id', medico.id)
      .order('ultimo_contato', { ascending: false })
    if (!data) return
    setConversas(data.map((c: any) => ({
      ...c,
      ultima: c.whatsapp_mensagens?.sort((a: any, b: any) => new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime())[0],
      naoLidas: c.whatsapp_mensagens?.filter((m: any) => !m.lida && m.tipo === 'recebida').length || 0
    })))
  }, [medico])

  const carregarMsgs = async (id: string) => {
    const { data } = await supabase.from('whatsapp_mensagens').select('*').eq('conversa_id', id).order('criado_em', { ascending: true })
    setMensagens(data || [])
    await supabase.from('whatsapp_mensagens').update({ lida: true }).eq('conversa_id', id).eq('tipo', 'recebida')
  }

  const enviar = async () => {
    if (!msg.trim() || !ativa || enviando) return
    setEnviando(true)
    const texto = msg.trim(); setMsg('')
    const { data: nova } = await supabase.from('whatsapp_mensagens').insert({
      conversa_id: ativa.id, tipo: 'enviada', conteudo: texto,
      metadata: { manual: true, remetente: medico?.nome }
    }).select().single()
    if (nova) setMensagens(p => [...p, nova])
    await fetch('/api/whatsapp/enviar', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telefone: ativa.telefone, texto, medico_id: medico.id })
    })
    setEnviando(false)
  }

  const iniciarGravacao = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream)
      audioChunks.current = []
      mr.ondataavailable = e => audioChunks.current.push(e.data)
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(audioChunks.current, { type: 'audio/webm' })
        if (blob.size < 500) return
        const form = new FormData()
        form.append('audio', blob, 'audio.webm')
        const res = await fetch('/api/transcrever', { method: 'POST', body: form })
        const data = await res.json()
        if (data.texto?.trim()) setMsg(p => p ? p + ' ' + data.texto : data.texto)
      }
      mr.start(); setMediaRecorder(mr); setGravando(true)
    } catch {}
  }

  const pararGravacao = () => { mediaRecorder?.stop(); setMediaRecorder(null); setGravando(false) }

  const conversasFiltradas = conversas.filter(c => {
    const buscaOk = nomeCv(c).toLowerCase().includes(busca.toLowerCase()) || c.telefone.includes(busca)
    const filtroOk = filtro === 'todas' || (filtro === 'nao_lidas' && c.naoLidas > 0) || (filtro === 'ia' && c.modo === 'ia') || (filtro === 'humano' && c.modo === 'humano')
    return buscaOk && filtroOk
  })

  const totalNaoLidas = conversas.reduce((a, c) => a + c.naoLidas, 0)

  const renderMarkdown = (texto: string) => texto
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/---+/g, '<hr style="border:none;border-top:1px solid rgba(0,0,0,0.1);margin:4px 0"/>')
    .split('\n').join('<br/>')

  const IconChats = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
  const IconStatus = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>
  const IconChannels = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>
  const IconCommunities = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>
  const IconSettings = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
  const IconSearch = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
  const IconMore = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
  const IconNew = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
  const IconAttach = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
  const IconEmoji = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/></svg>
  const IconMic = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8"/></svg>
  const IconSend = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
  const IconStop = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', background: '#111b21', overflow: 'hidden', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #374045; border-radius: 3px; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        .conv-item:hover { background: #202c33 !important; cursor: pointer; }
        .conv-item.active { background: #2a3942 !important; }
        .icon-btn:hover { background: rgba(255,255,255,0.1) !important; }
      `}</style>

      {/* Sidebar esquerda — ícones */}
      <div style={{ width: 56, background: '#202c33', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 12, paddingBottom: 12, flexShrink: 0 }}>
        {/* Avatar médico */}
        <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#3d5a6c', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, color: 'white', cursor: 'pointer', marginBottom: 20 }}>
          {ini(medico?.nome || 'M')}
        </div>
        {/* Ícones nav */}
        {[
          { icon: <IconChats />, label: 'Chats', active: true },
          { icon: <IconStatus />, label: 'Status' },
          { icon: <IconChannels />, label: 'Canais' },
          { icon: <IconCommunities />, label: 'Comunidades' },
        ].map(item => (
          <div key={item.label} title={item.label} className="icon-btn" style={{ width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', marginBottom: 4, color: item.active ? '#00a884' : '#aebac1', background: 'none' }}>
            {item.icon}
          </div>
        ))}
        <div style={{ flex: 1 }}/>
        <div title="Configurações" className="icon-btn" style={{ width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#aebac1', background: 'none' }}>
          <IconSettings />
        </div>
        {/* Link de volta */}
        <div title="Voltar à plataforma" onClick={() => router.push('/dashboard')} className="icon-btn" style={{ width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#aebac1', background: 'none', marginTop: 4 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        </div>
      </div>

      {/* Painel esquerdo — lista de conversas */}
      <div style={{ width: 380, background: '#111b21', borderRight: '1px solid #222e35', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        {/* Header */}
        <div style={{ padding: '14px 16px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: '#e9edef' }}>Conversas</h1>
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={() => setNovaConversa(true)} className="icon-btn" style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', background: 'none', color: '#aebac1', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Nova conversa">
              <IconNew />
            </button>
            <button className="icon-btn" style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', background: 'none', color: '#aebac1', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <IconMore />
            </button>
          </div>
        </div>

        {/* Busca */}
        <div style={{ padding: '0 12px 10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#202c33', borderRadius: 8, padding: '8px 14px' }}>
            <span style={{ color: '#aebac1', display: 'flex', flexShrink: 0 }}><IconSearch /></span>
            <input
              value={busca} onChange={e => setBusca(e.target.value)}
              placeholder="Pesquisar ou começar nova conversa"
              style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 14, color: '#e9edef', fontFamily: 'inherit' }}
            />
          </div>
        </div>

        {/* Filtros */}
        <div style={{ display: 'flex', gap: 6, padding: '0 12px 10px', overflowX: 'auto' }}>
          {[
            { id: 'todas', label: 'Tudo' },
            { id: 'nao_lidas', label: `Não lidas${totalNaoLidas > 0 ? ` ${totalNaoLidas}` : ''}` },
            { id: 'ia', label: 'Sofia IA' },
            { id: 'humano', label: 'Humano' },
          ].map(f => (
            <button key={f.id} onClick={() => setFiltro(f.id as any)} style={{ padding: '5px 14px', fontSize: 13, fontWeight: 500, borderRadius: 20, border: 'none', background: filtro === f.id ? '#00a884' : '#202c33', color: filtro === f.id ? 'white' : '#aebac1', cursor: 'pointer', whiteSpace: 'nowrap' as const, flexShrink: 0, transition: 'all 0.15s' }}>
              {f.label}
            </button>
          ))}
        </div>

        {/* Nova conversa modal inline */}
        {novaConversa && (
          <div style={{ margin: '0 12px 10px', background: '#202c33', borderRadius: 10, padding: 14 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: '#00a884', marginBottom: 10 }}>Nova conversa</p>
            <input value={novoTel} onChange={e => setNovoTel(e.target.value)} placeholder="Número (ex: 5511999887766)" style={{ width: '100%', padding: '8px 10px', fontSize: 13, borderRadius: 7, border: '1px solid #374045', background: '#111b21', color: '#e9edef', marginBottom: 8, outline: 'none' }} />
            <input value={novaMsgTexto} onChange={e => setNovaMsgTexto(e.target.value)} placeholder="Primeira mensagem..." style={{ width: '100%', padding: '8px 10px', fontSize: 13, borderRadius: 7, border: '1px solid #374045', background: '#111b21', color: '#e9edef', marginBottom: 10, outline: 'none' }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={async () => {
                if (!novoTel.trim() || !novaMsgTexto.trim()) return
                const tel = novoTel.replace(/\D/g, '')
                const { data: conv } = await supabase.from('whatsapp_conversas').insert({ telefone: tel, nome_contato: tel, medico_id: medico.id, status: 'ativa', modo: 'humano' }).select().single()
                if (conv) {
                  await supabase.from('whatsapp_mensagens').insert({ conversa_id: conv.id, tipo: 'enviada', conteudo: novaMsgTexto, metadata: { manual: true } })
                  await fetch('/api/whatsapp/enviar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ telefone: tel, texto: novaMsgTexto, medico_id: medico.id }) })
                  await carregarConversas(); setAtiva(conv)
                }
                setNovoTel(''); setNovaMsgTexto(''); setNovaConversa(false)
              }} style={{ flex: 1, padding: '8px', borderRadius: 7, border: 'none', background: '#00a884', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Enviar</button>
              <button onClick={() => { setNovaConversa(false); setNovoTel(''); setNovaMsgTexto('') }} style={{ padding: '8px 14px', borderRadius: 7, border: 'none', background: '#374045', color: '#aebac1', fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
            </div>
          </div>
        )}

        {/* Lista conversas */}
        <div style={{ flex: 1, overflowY: 'auto' }} onClick={() => setMenuConversa(null)}>
          {conversasFiltradas.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center' }}>
              <p style={{ fontSize: 13, color: '#667781' }}>Nenhuma conversa</p>
            </div>
          ) : conversasFiltradas.map(cv => (
            <div key={cv.id}
              className={`conv-item${ativa?.id === cv.id ? ' active' : ''}`}
              onClick={() => setAtiva(cv)}
              onContextMenu={e => { e.preventDefault(); setMenuConversa({ id: cv.id, x: e.clientX, y: e.clientY }) }}
              style={{ padding: '10px 16px', cursor: 'pointer', background: ativa?.id === cv.id ? '#2a3942' : 'transparent', borderBottom: '1px solid #1f2c33', position: 'relative' as const }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                {cv.foto_url ? (
                  <img src={cv.foto_url} alt={nomeCv(cv)} style={{ width: 49, height: 49, borderRadius: '50%', objectFit: 'cover' as const, flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 49, height: 49, borderRadius: '50%', background: '#6b7c85', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 400, color: 'white', flexShrink: 0 }}>
                    {ini(nomeCv(cv))}
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 3 }}>
                    <p style={{ fontSize: 15, fontWeight: 400, color: '#e9edef', letterSpacing: '0.01em', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{nomeCv(cv)}</p>
                    <span style={{ fontSize: 11, color: cv.naoLidas > 0 ? '#00a884' : '#667781', flexShrink: 0, marginLeft: 8 }}>{cv.ultima ? fmt(cv.ultima.criado_em) : ''}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <p style={{ fontSize: 13, color: '#8696a0', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, flex: 1 }}>
                      {cv.ultima?.tipo === 'enviada' && <svg style={{ display: 'inline', marginRight: 2, verticalAlign: 'middle' }} width="14" height="10" viewBox="0 0 16 11" fill="none"><path d="M1 5.5L5 9.5L15 1" stroke="#53bdeb" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M5 5.5L9 9.5L15 1" stroke="#53bdeb" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                      {cv.ultima?.conteudo?.substring(0, 40) || ''}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 6, flexShrink: 0 }}>
                      {cv.modo === 'humano' && <span style={{ fontSize: 10, color: '#8696a0', background: 'rgba(134,150,160,0.15)', padding: '1px 6px', borderRadius: 10 }}>humano</span>}
                      {cv.naoLidas > 0 && <span style={{ fontSize: 11, fontWeight: 600, color: 'white', background: '#00a884', minWidth: 20, height: 20, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px' }}>{cv.naoLidas}</span>}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Menu contexto conversa */}
      {menuConversa && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 100 }} onClick={() => setMenuConversa(null)} />
          <div style={{ position: 'fixed', left: menuConversa.x, top: menuConversa.y, background: '#233138', borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.5)', zIndex: 101, minWidth: 200, overflow: 'hidden', padding: '6px 0' }}>
            {[
              { label: 'Arquivar conversa', icon: '📦' },
              { label: 'Marcar como não lida', icon: '💬', fn: async () => { await supabase.from('whatsapp_mensagens').update({ lida: false }).eq('conversa_id', menuConversa.id).eq('tipo', 'recebida'); carregarConversas(); setMenuConversa(null) } },
              { label: 'Limpar conversa', icon: '🗑', fn: async () => { if (confirm('Limpar todas as mensagens?')) { await supabase.from('whatsapp_mensagens').delete().eq('conversa_id', menuConversa.id); if (ativa?.id === menuConversa.id) setMensagens([]); setMenuConversa(null) } } },
              { label: 'Dados do contato', icon: '👤' },
            ].map(item => (
              <button key={item.label} onClick={item.fn || (() => setMenuConversa(null))} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '12px 16px', border: 'none', background: 'none', color: '#e9edef', fontSize: 14, cursor: 'pointer', textAlign: 'left' as const }}
                onMouseEnter={e => (e.currentTarget.style.background = '#374045')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                <span>{item.icon}</span> {item.label}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Área do chat */}
      {ativa ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#0b141a', overflow: 'hidden' }}>
          {/* Header chat */}
          <div style={{ background: '#202c33', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
            {ativa.foto_url ? (
              <img src={ativa.foto_url} alt={nomeCv(ativa)} style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' as const }} />
            ) : (
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#6b7c85', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: 'white' }}>{ini(nomeCv(ativa))}</div>
            )}
            <div style={{ flex: 1, cursor: 'pointer' }}>
              <p style={{ fontSize: 15, fontWeight: 500, color: '#e9edef', margin: 0 }}>{nomeCv(ativa)}</p>
              <p style={{ fontSize: 12, color: '#8696a0', margin: 0 }}>
                {ativa.modo === 'humano' ? `Atendimento humano${ativa.atendente_nome ? ' · ' + ativa.atendente_nome : ''}` : 'Sofia IA · online'}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {ativa.modo === 'ia' ? (
                <button onClick={async () => {
                  await supabase.from('whatsapp_conversas').update({ modo: 'humano', atendente_nome: medico?.nome }).eq('id', ativa.id)
                  setAtiva({ ...ativa, modo: 'humano', atendente_nome: medico?.nome })
                }} style={{ fontSize: 12, color: '#111b21', background: '#00a884', border: 'none', padding: '5px 14px', borderRadius: 20, cursor: 'pointer', fontWeight: 600 }}>Assumir</button>
              ) : (
                <button onClick={async () => {
                  await supabase.from('whatsapp_conversas').update({ modo: 'ia', atendente_nome: null }).eq('id', ativa.id)
                  setAtiva({ ...ativa, modo: 'ia', atendente_nome: null })
                }} style={{ fontSize: 12, color: '#e9edef', background: '#374045', border: 'none', padding: '5px 14px', borderRadius: 20, cursor: 'pointer' }}>Devolver à IA</button>
              )}
              {ativa.paciente_id && (
                <a href={'/pacientes/' + ativa.paciente_id} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: '#e9edef', background: '#374045', border: 'none', padding: '5px 14px', borderRadius: 20, cursor: 'pointer', textDecoration: 'none' }}>Ver ficha</a>
              )}
              <button className="icon-btn" style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', background: 'none', color: '#aebac1', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <IconSearch />
              </button>
              <button className="icon-btn" style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', background: 'none', color: '#aebac1', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <IconMore />
              </button>
            </div>
          </div>

          {/* Mensagens */}
          <div style={{ flex: 1, overflowY: 'auto' as const, padding: '12px 6%', background: '#0b141a' }}>
            {mensagens.map((m, idx) => {
              const rec = m.tipo === 'recebida'
              const isIA = m.metadata?.ia
              const isSistema = m.metadata?.sistema
              const dataAtual = new Date(m.criado_em).toDateString()
              const dataAnterior = idx > 0 ? new Date(mensagens[idx - 1].criado_em).toDateString() : null
              const mostraData = idx === 0 || dataAtual !== dataAnterior

              return (
                <div key={m.id}>
                  {mostraData && (
                    <div style={{ textAlign: 'center', margin: '12px 0' }}>
                      <span style={{ fontSize: 12, color: '#e9edef', background: '#182229', padding: '5px 14px', borderRadius: 8 }}>{fmtData(m.criado_em)}</span>
                    </div>
                  )}
                  {isSistema ? (
                    <div style={{ textAlign: 'center', margin: '6px 0' }}>
                      <span style={{ fontSize: 12, color: '#8696a0', background: '#182229', padding: '4px 12px', borderRadius: 8 }}>{m.conteudo}</span>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', justifyContent: rec ? 'flex-start' : 'flex-end', marginBottom: 2 }}>
                      <div style={{ maxWidth: '65%', padding: '6px 10px 8px', borderRadius: rec ? '0 7.5px 7.5px 7.5px' : '7.5px 7.5px 0 7.5px', background: rec ? '#202c33' : '#005c4b', boxShadow: '0 1px 0.5px rgba(0,0,0,0.4)', position: 'relative' as const }}>
                        {!rec && isIA && <p style={{ fontSize: 11, fontWeight: 700, color: '#00a884', margin: '0 0 2px', textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>Sofia IA</p>}
                        {!rec && !isIA && m.metadata?.remetente && <p style={{ fontSize: 11, fontWeight: 700, color: '#53bdeb', margin: '0 0 2px' }}>{m.metadata.remetente}</p>}
                        <p style={{ fontSize: 14, color: '#e9edef', margin: 0, lineHeight: 1.5, wordBreak: 'break-word' as const }}
                          dangerouslySetInnerHTML={{ __html: renderMarkdown(m.conteudo) }} />
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 3, marginTop: 2 }}>
                          <span style={{ fontSize: 11, color: '#8696a0' }}>{fmtH(m.criado_em)}</span>
                          {!rec && <svg width="14" height="9" viewBox="0 0 16 11" fill="none"><path d="M1 5.5L5 9.5L15 1" stroke="#53bdeb" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M5 5.5L9 9.5L15 1" stroke="#53bdeb" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
            <div ref={endRef} />
          </div>

          {/* Input */}
          <div style={{ background: '#202c33', padding: '8px 16px', display: 'flex', gap: 8, alignItems: 'flex-end', flexShrink: 0 }}>
            <button className="icon-btn" style={{ width: 40, height: 40, borderRadius: '50%', border: 'none', background: 'none', color: '#aebac1', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <IconEmoji />
            </button>
            <button className="icon-btn" style={{ width: 40, height: 40, borderRadius: '50%', border: 'none', background: 'none', color: '#aebac1', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <IconAttach />
            </button>
            <div style={{ flex: 1, background: '#2a3942', borderRadius: 10, padding: '9px 14px', display: 'flex', alignItems: 'flex-end', minHeight: 42 }}>
              {gravando ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#f15c6d', animation: 'pulse 1s infinite', flexShrink: 0 }}/>
                  <span style={{ fontSize: 14, color: '#8696a0' }}>Gravando...</span>
                </div>
              ) : (
                <textarea
                  ref={inputRef}
                  value={msg} onChange={e => setMsg(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar() } }}
                  placeholder="Digite uma mensagem"
                  rows={1}
                  style={{ flex: 1, border: 'none', outline: 'none', resize: 'none', fontSize: 15, lineHeight: 1.5, maxHeight: 120, background: 'transparent', fontFamily: 'inherit', color: '#e9edef' }}
                />
              )}
            </div>
            {msg.trim() ? (
              <button onClick={enviar} disabled={enviando} style={{ width: 44, height: 44, borderRadius: '50%', border: 'none', background: '#00a884', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <IconSend />
              </button>
            ) : gravando ? (
              <button onClick={pararGravacao} style={{ width: 44, height: 44, borderRadius: '50%', border: 'none', background: '#f15c6d', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <IconStop />
              </button>
            ) : (
              <button onClick={iniciarGravacao} className="icon-btn" style={{ width: 44, height: 44, borderRadius: '50%', border: 'none', background: 'none', color: '#aebac1', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <IconMic />
              </button>
            )}
          </div>
        </div>
      ) : (
        /* Empty state */
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0b141a', flexDirection: 'column', gap: 16 }}>
          <div style={{ width: 200, height: 200, borderRadius: '50%', background: 'rgba(134,150,160,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 175.216 175.552" opacity="0.15">
              <path fill="#e9edef" d="M87.184 25.227c-33.733 0-61.166 27.423-61.178 61.13a60.98 60.98 0 0 0 9.349 32.535l1.455 2.313-6.179 22.558 23.146-6.069 2.235 1.324c9.387 5.571 20.15 8.517 31.126 8.523h.023c33.707 0 61.14-27.426 61.153-61.135a60.75 60.75 0 0 0-17.895-43.251 60.75 60.75 0 0 0-43.235-17.928z"/>
            </svg>
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 32, fontWeight: 300, color: '#e9edef', margin: '0 0 8px', letterSpacing: '-0.5px' }}>MedIA WhatsApp</p>
            <p style={{ fontSize: 15, color: '#8696a0', margin: '0 0 4px' }}>Selecione uma conversa para começar</p>
            <p style={{ fontSize: 13, color: '#667781', margin: 0 }}>
              {config ? `Conectado · ${config.phone_number || config.phone_number_id}` : '⚠ WhatsApp não configurado'}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3b4a54" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            <p style={{ fontSize: 13, color: '#3b4a54', margin: 0 }}>Criptografia de ponta a ponta</p>
          </div>
        </div>
      )}
    </div>
  )
}
