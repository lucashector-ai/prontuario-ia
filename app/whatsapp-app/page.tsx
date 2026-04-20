'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import ConfigPanel from './ConfigPanel'

function corAvatar(str:string): string {
  const cores = ['#25d366','#00a884','#1F9D5C','#0d9488','#d97706','#dc2626','#7c3aed','#0891b2','#be185d','#065f46']
  let hash = 0
  for(let i=0;i<str.length;i++) hash = str.charCodeAt(i) + ((hash<<5)-hash)
  return cores[Math.abs(hash)%cores.length]
}

export default function WhatsAppApp() {
  const router = useRouter()
  const [medico, setMedico] = useState<any>(null)
  const [usuario, setUsuario] = useState<any>(null)
  const [config, setConfig] = useState<any>(null)
  const [conversas, setConversas] = useState<any[]>([])
  const [ativa, setAtiva] = useState<any>(null)
  const [mensagens, setMensagens] = useState<any[]>([])
  const [msg, setMsg] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<'todas'|'nao_lidas'|'ia'|'humano'|'aguardando'|'em_atendimento'>('todas')
  const [novaConversa, setNovaConversa] = useState(false)
  const [novoTel, setNovoTel] = useState('')
  const [novaMsgTexto, setNovaMsgTexto] = useState('')
  const [menuConversa, setMenuConversa] = useState<{id:string,x:number,y:number}|null>(null)
  const [gravando, setGravando] = useState(false)
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder|null>(null)
  const [aba, setAba] = useState<'chats'|'equipe'|'contatos'>('chats')
  const [atendentes, setAtendentes] = useState<any[]>([])
  const [departamentos, setDepartamentos] = useState<any[]>([])
  const [novoAt, setNovoAt] = useState({nome:'',email:'',senha:'',cargo:'Atendente'})
  const [salvandoAt, setSalvandoAt] = useState(false)
  const [atMsg, setAtMsg] = useState('')
  const audioChunks = useRef<Blob[]>([])
  const prevMsgsCount = useRef<number>(0)
  const prevConvCount = useRef<number>(0)
  const titleInterval = useRef<any>(null)

  const piscarTitulo = (naoLidas: number) => {
    if (typeof document === 'undefined') return
    if (titleInterval.current) clearInterval(titleInterval.current)
    if (naoLidas === 0) { document.title = 'MedIA — WhatsApp'; return }
    let toggle = false
    titleInterval.current = setInterval(() => {
      document.title = toggle ? `(${naoLidas}) MedIA — WhatsApp` : '🔔 Nova mensagem!'
      toggle = !toggle
    }, 1200)
  }

  const tocarSom = () => {
    if (typeof window === 'undefined') return
    try {
      const ctx = new ((window as any).AudioContext || (window as any).webkitAudioContext)()
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.connect(g); g.connect(ctx.destination)
      o.frequency.setValueAtTime(880, ctx.currentTime)
      o.frequency.setValueAtTime(1100, ctx.currentTime + 0.1)
      g.gain.setValueAtTime(0.3, ctx.currentTime)
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)
      o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.3)
    } catch {}
  }
  const [buscaChat, setBuscaChat] = useState('')
  const [buscaChatAtiva, setBuscaChatAtiva] = useState(false)
  const [menuHeader, setMenuHeader] = useState(false)
  const [showEmoji, setShowEmoji] = useState(false)
  const [showInfo, setShowInfo] = useState(false)
  const [menuLista, setMenuLista] = useState(false)
  const [showConfig, setShowConfig] = useState(false)
  const [showPaciente, setShowPaciente] = useState(false)
  const [dadosPaciente, setDadosPaciente] = useState<any>(null)
  const [consultasPaciente, setConsultasPaciente] = useState<any[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const endRef = useRef<HTMLDivElement>(null)

  const fmt = (iso: string) => {
    const d = new Date(iso), h = new Date()
    const on = new Date(h); on.setDate(h.getDate()-1)
    if (d.toDateString()===h.toDateString()) return d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})
    if (d.toDateString()===on.toDateString()) return 'Ontem'
    return d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'2-digit'})
  }
  const fmtH = (iso:string) => new Date(iso).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})
  const fmtData = (iso:string) => {
    const d=new Date(iso),h=new Date(),on=new Date(h); on.setDate(h.getDate()-1)
    if(d.toDateString()===h.toDateString()) return 'Hoje'
    if(d.toDateString()===on.toDateString()) return 'Ontem'
    return d.toLocaleDateString('pt-BR',{day:'2-digit',month:'long',year:'numeric'})
  }
  const nomeCv = (c:any) => c.nome_contato||c.telefone
  const ini = (n:string) => n?.split(' ').map((x:string)=>x[0]).slice(0,2).join('').toUpperCase()||'?'
  const md = (t:string) => t
    .replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>')
    .replace(/\*(.*?)\*/g,'<em>$1</em>')
    .replace(/---+/g,'<hr style="border:none;border-top:1px solid rgba(0,0,0,0.1);margin:4px 0"/>')
    .split('\n').join('<br/>')

  const carregarDadosPaciente = async (pacienteId: string) => {
    const [pRes, cRes] = await Promise.all([
      fetch('/api/pacientes/' + pacienteId).then(r => r.json()),
      supabase.from('consultas').select('data,tipo,diagnostico_principal,resumo_ia').eq('paciente_id', pacienteId).order('data', {ascending: false}).limit(5)
    ])
    if (pRes.paciente) setDadosPaciente(pRes.paciente)
    if (cRes.data) setConsultasPaciente(cRes.data)
    setShowPaciente(true)
  }

  const carregarAtendentes = (mid:string) => {
    fetch('/api/atendentes?medico_id='+mid).then(r=>r.json()).then(d=>setAtendentes(d.atendentes||[]))
    supabase.from('departamentos').select('*').eq('medico_id',mid).then(({data})=>setDepartamentos(data||[]))
  }

  useEffect(()=>{
    const m=localStorage.getItem('medico')
    if(!m){router.push('/login');return}
    const med=JSON.parse(m); setMedico(med)
    const at=localStorage.getItem('atendente')
    setUsuario(at?JSON.parse(at):med)
    // Registra último acesso se for atendente
    if (at) {
      const atObj = JSON.parse(at)
      fetch('/api/atendentes', {method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({id:atObj.id, ultimo_acesso: new Date().toISOString()})})
    }
    supabase.from('whatsapp_config').select('*').eq('medico_id',med.id).single().then(({data})=>setConfig(data))
    carregarAtendentes(med.id)
  },[router])

  useEffect(()=>{
    if(!medico) return
    carregarConversas()
    const ch=supabase.channel('wapp-light')
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'whatsapp_mensagens'},(payload:any)=>{
        carregarConversas()
        // Se a mensagem é da conversa ativa, adiciona em tempo real sem recarregar tudo
        setAtiva((ativaAtual:any)=>{
          if(ativaAtual && payload.new?.conversa_id===ativaAtual.id){
            setMensagens(p=>{
              if(p.find((m:any)=>m.id===payload.new.id)) return p
              return [...p, payload.new]
            })
          }
          return ativaAtual
        })
      })
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'whatsapp_conversas'},()=>carregarConversas())
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'whatsapp_conversas'},()=>carregarConversas())
      .subscribe()
    return ()=>{supabase.removeChannel(ch)}
  },[medico])

  useEffect(()=>{if(ativa) carregarMsgs(ativa.id)},[ativa])
  
  // Polling — atualiza mensagens a cada 2s
  const ativaIdRef = useRef<string|null>(null)
  useEffect(()=>{
    if(!ativa?.id) return
    ativaIdRef.current = ativa.id
    const interval = setInterval(async()=>{
      if(pausarPolling.current) return
      const id = ativaIdRef.current
      if(!id) return
      const {data} = await supabase.from('whatsapp_mensagens')
        .select('*').eq('conversa_id', id).order('criado_em', {ascending: true})
      if(data) {
        setMensagens(prev=>{
          const prevIds = prev.map((m:any)=>m.id).join(',')
          const newIds = data.map((m:any)=>m.id).join(',')
          if(prevIds === newIds) return prev
          return data
        })
      }
    }, 2000)
    return ()=>{clearInterval(interval); ativaIdRef.current=null}
  },[ativa?.id])

  // Polling da lista de conversas a cada 5s
  useEffect(()=>{
    if(!medico) return
    const interval = setInterval(()=>{ if(!pausarPolling.current) carregarConversas() }, 5000)
    return ()=>clearInterval(interval)
  },[medico?.id])
  useEffect(()=>{endRef.current?.scrollIntoView({behavior:'instant' as ScrollBehavior})},[mensagens])

  const carregarConversas = useCallback(async()=>{
    if(!medico) return
    const {data}=await supabase.from('whatsapp_conversas')
      .select('*,whatsapp_mensagens(conteudo,criado_em,tipo,lida)')
      .eq('medico_id',medico.id)
      .order('ultimo_contato',{ascending:false})
    if(!data) return
    const novasNaoLidas = (data||[]).reduce((a:number,cv:any)=>a+(cv.whatsapp_mensagens?.filter((m:any)=>!m.lida&&m.tipo==='recebida').length||0),0)
    if (prevConvCount.current > 0 && novasNaoLidas > prevConvCount.current) {
      tocarSom()
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification('Nova mensagem — MedIA WhatsApp', { body: 'Você tem novas mensagens', icon: '/favicon.ico' })
      }
    }
    prevConvCount.current = novasNaoLidas
    piscarTitulo(novasNaoLidas)
    // Deduplica por telefone — mantém a mais recente por número
    const dedup = new Map<string,any>()
    data.forEach((cv:any)=>{
      const existing = dedup.get(cv.telefone)
      if (!existing || new Date(cv.ultimo_contato) > new Date(existing.ultimo_contato)) {
        dedup.set(cv.telefone, cv)
      }
    })
    setConversas(Array.from(dedup.values()).map((c:any)=>({
      ...c,
      ultima:c.whatsapp_mensagens?.sort((a:any,b:any)=>new Date(b.criado_em).getTime()-new Date(a.criado_em).getTime())[0],
      naoLidas:c.whatsapp_mensagens?.filter((m:any)=>!m.lida&&m.tipo==='recebida').length||0
    })))
  },[medico])

  const carregarMsgs = async(id:string)=>{
    piscarTitulo(0)
    setShowPaciente(false)
    setDadosPaciente(null)
    const {data}=await supabase.from('whatsapp_mensagens').select('*').eq('conversa_id',id).order('criado_em',{ascending:true})
    setMensagens(data||[])
    await supabase.from('whatsapp_mensagens').update({lida:true}).eq('conversa_id',id).eq('tipo','recebida')
  }

  const enviar = async()=>{
    if(!msg.trim()||!ativa||enviando) return
    setEnviando(true)
    const texto=msg.trim(); setMsg('')
    const nomeRemetente = usuario?.nome||medico?.nome
    // Adiciona nome do atendente em negrito no início da mensagem para o WhatsApp real
    const textoWpp = ativa.modo==='humano' && nomeRemetente ? `*${nomeRemetente}:* ${texto}` : texto
    const {data:nova}=await supabase.from('whatsapp_mensagens').insert({
      conversa_id:ativa.id,tipo:'enviada',conteudo:texto,
      metadata:{manual:true,remetente:nomeRemetente}
    }).select().single()
    if(nova) setMensagens(p=>[...p,nova])
    await fetch('/api/whatsapp/enviar',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({telefone:ativa.telefone,texto:textoWpp,medico_id:medico.id})})
    setEnviando(false)
  }

  const enviarResposta = async(texto:string)=>{
    if(!ativa) return
    // Salva localmente
    const {data:nova}=await supabase.from('whatsapp_mensagens').insert({
      conversa_id:ativa.id,tipo:'recebida',conteudo:texto,
      metadata:{botao:true}
    }).select().single()
    if(nova) setMensagens(p=>[...p,nova])
    // Envia para o webhook para a Sofia processar e responder
    const simRes = await fetch('/api/whatsapp/simular',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
      conversa_id:ativa.id,
      telefone:ativa.telefone,
      texto,
      medico_id:medico?.id
    })})
    // Após Sofia responder, recarrega as mensagens
    if(simRes.ok){
      setTimeout(()=>carregarMsgs(ativa.id), 2000)
      setTimeout(()=>carregarMsgs(ativa.id), 5000)
    }
  }

  const iniciarGravacao = async()=>{
    try{
      const stream=await navigator.mediaDevices.getUserMedia({audio:true})
      const mr=new MediaRecorder(stream)
      audioChunks.current=[]
      mr.ondataavailable=e=>audioChunks.current.push(e.data)
      mr.onstop=async()=>{
        stream.getTracks().forEach(t=>t.stop())
        const blob=new Blob(audioChunks.current,{type:'audio/webm'})
        if(blob.size<500) return
        const form=new FormData(); form.append('audio',blob,'audio.webm')
        const res=await fetch('/api/transcrever',{method:'POST',body:form})
        const data=await res.json()
        if(data.texto?.trim()) setMsg(p=>p?p+' '+data.texto:data.texto)
      }
      mr.start(); setMediaRecorder(mr); setGravando(true)
    }catch{}
  }
  const pararGravacao=()=>{mediaRecorder?.stop();setMediaRecorder(null);setGravando(false)}

  const total = conversas.reduce((a,c)=>a+c.naoLidas,0)
  const filtradas = conversas.filter(c=>{
    const bOk=nomeCv(c).toLowerCase().includes(busca.toLowerCase())||c.telefone.includes(busca)
    const fOk=filtro==='todas'||(filtro==='nao_lidas'&&c.naoLidas>0)||(filtro==='ia'&&c.modo==='ia'&&c.status!=='encerrada')||(filtro==='humano'&&c.modo==='humano'&&c.status!=='encerrada')
    return bOk&&fOk
  })

  const pausarPolling = useRef(false)
  const assumir = async()=>{
    const nm=usuario?.nome||medico?.nome
    pausarPolling.current = true
    await supabase.from('whatsapp_conversas').update({modo:'humano',atendente_nome:nm}).eq('id',ativa.id)
    setAtiva((prev:any)=>({...prev,modo:'humano',atendente_nome:nm}))
    await carregarConversas()
    setTimeout(()=>{ pausarPolling.current = false }, 3000)
  }
  const devolverIA = async()=>{
    await supabase.from('whatsapp_conversas').update({modo:'ia',atendente_nome:null}).eq('id',ativa.id)
    setAtiva({...ativa,modo:'ia',atendente_nome:null})
  }

  return (
    <div style={{display:'flex',height:'100vh',width:'100vw',background:'#f0f2f5',overflow:'hidden',fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif'}}>
      <style>{`
        *{box-sizing:border-box}
        ::-webkit-scrollbar{width:6px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:#c1c9cd;border-radius:3px}
        .cv:hover{background:#f5f6f6!important}.cv.sel{background:#f0f2f5!important}
        .ibtn:hover{background:rgba(0,0,0,0.06)!important;border-radius:50%}
        .botao-resp:hover{background:#f0fdf4!important}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
      `}</style>

      {/* Sidebar */}
      <div style={{width:56,background:'#f0f2f5',borderRight:'1px solid #d1d7db',display:'flex',flexDirection:'column',alignItems:'center',padding:'12px 0',flexShrink:0}}>
        <div onClick={()=>router.push('/perfil')} style={{position:'relative',cursor:'pointer',marginBottom:20}} title={(usuario?.nome||medico?.nome)+' — Ver perfil'}>
          {medico?.foto_url
            ? <img src={medico.foto_url} style={{width:38,height:38,borderRadius:'50%',objectFit:'cover' as const,border:'2px solid rgba(255,255,255,0.3)'}}/>
            : <div style={{width:38,height:38,borderRadius:'50%',background:'#00a884',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:600,color:'white'}}>{ini(usuario?.nome||medico?.nome||'M')}</div>
          }
        </div>
        <div title="Chats" onClick={()=>setAba('chats')} className="ibtn" style={{width:40,height:40,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:aba==='chats'?'#00a884':'#54656f',marginBottom:4}}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
        </div>
        <div title="Contatos" onClick={()=>setAba('contatos')} className="ibtn" style={{width:40,height:40,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:aba==='contatos'?'#00a884':'#54656f',marginBottom:4}}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
        </div>
        <div title="Equipe" onClick={()=>setAba('equipe')} className="ibtn" style={{width:40,height:40,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:aba==='equipe'?'#00a884':'#54656f',marginBottom:4}}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/></svg>
        </div>
        <div style={{flex:1}}/>
        <div title="Configurações" onClick={()=>setShowConfig(v=>!v)} className="ibtn" style={{width:40,height:40,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:showConfig?'#00a884':'#54656f',marginBottom:4}}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
        </div>
        <div title="Voltar à plataforma" onClick={()=>router.push('/dashboard')} className="ibtn" style={{width:40,height:40,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:'#54656f',marginBottom:4}}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        </div>
        <div title="Sair" onClick={()=>{localStorage.removeItem('medico');localStorage.removeItem('atendente');document.cookie='is_atendente=; path=/; max-age=0';document.cookie='medico_id=; path=/; max-age=0';router.push('/login')}} className="ibtn" style={{width:40,height:40,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:'#ef4444'}}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
        </div>
      </div>

      {/* Painel esquerdo */}
      <div style={{width:390,background:'white',borderRight:'1px solid #d1d7db',display:'flex',flexDirection:'column',flexShrink:0}}>

        {/* Header */}
        <div style={{padding:'13px 16px 10px',display:'flex',alignItems:'center',justifyContent:'space-between',background:'white',borderBottom:'1px solid #f0f2f5'}}>
          <h1 style={{fontSize:20,fontWeight:600,color:'#00a884',margin:0}}>
            {aba==='chats'?'WhatsApp':'Equipe'}
          </h1>
          <div style={{display:'flex',gap:2}}>
            {aba==='chats'&&(
              <button onClick={()=>setNovaConversa(v=>!v)} className="ibtn" style={{width:36,height:36,border:'none',background:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#54656f" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/><line x1="12" y1="9" x2="12" y2="15"/><line x1="9" y1="12" x2="15" y2="12"/></svg>
              </button>
            )}
            <div style={{position:'relative' as const}}>
              <button onClick={()=>setMenuLista(v=>!v)} className="ibtn" style={{width:36,height:36,border:'none',background:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="#54656f"><circle cx="12" cy="4" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="20" r="1.8"/></svg>
              </button>
              {menuLista&&(
                <>
                  <div style={{position:'fixed' as const,inset:0,zIndex:50}} onClick={()=>setMenuLista(false)}/>
                  <div style={{position:'absolute' as const,right:0,top:40,background:'white',borderRadius:10,zIndex:51,minWidth:200,overflow:'hidden',padding:'4px 0'}}>
                    {[
                      {label:'Nova conversa',fn:()=>{setNovaConversa(v=>!v);setMenuLista(false)}},
                      {label:'Marcar todas lidas',fn:async()=>{await Promise.all(conversas.map(cv=>supabase.from('whatsapp_mensagens').update({lida:true}).eq('conversa_id',cv.id).eq('tipo','recebida')));carregarConversas();setMenuLista(false)}},
                      {label:'Configurações',fn:()=>{router.push('/whatsapp');setMenuLista(false)}},
                      {label:'Ir para plataforma',fn:()=>{router.push('/dashboard');setMenuLista(false)}},
                    ].map(item=>(
                      <button key={item.label} onClick={item.fn} style={{display:'flex',alignItems:'center',width:'100%',padding:'11px 16px',border:'none',background:'none',color:'#111827',fontSize:14,cursor:'pointer',textAlign:'left' as const}}
                        onMouseEnter={e=>(e.currentTarget.style.background='#f5f6f6')}
                        onMouseLeave={e=>(e.currentTarget.style.background='none')}>
                        {item.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ABA CHATS */}
        {aba==='chats'&&(
          <>
            {/* Busca */}
            <div style={{padding:'8px 12px',background:'white'}}>
              <div style={{display:'flex',alignItems:'center',gap:8,background:'#f0f2f5',borderRadius:20,padding:'8px 14px'}}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#54656f" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Pesquisar ou começar nova conversa" style={{flex:1,border:'none',outline:'none',background:'transparent',fontSize:14,color:'#111827',fontFamily:'inherit'}}/>
              </div>
            </div>

            {/* Filtros */}
            <div style={{display:'flex',gap:6,padding:'4px 12px 10px',overflowX:'auto'}}>
              {([
                {id:'todas' as typeof filtro,label:'Tudo'},
                {id:'nao_lidas' as typeof filtro,label:`Não lidas${total>0?' '+total:''}`},
                {id:'ia' as typeof filtro,label:'Sofia IA'},
                {id:'humano' as typeof filtro,label:'Humano'},
              ]).map(f=>(
                <button key={f.id} onClick={()=>setFiltro(f.id)} style={{padding:'5px 14px',fontSize:13,fontWeight:500,borderRadius:20,border:filtro===f.id?'none':'1px solid #d1d7db',background:filtro===f.id?'#d9fdd3':'white',color:filtro===f.id?'#166534':'#54656f',cursor:'pointer',whiteSpace:'nowrap' as const,flexShrink:0}}>
                  {f.label}
                </button>
              ))}
            </div>

            {/* Nova conversa */}
            {novaConversa&&(
              <div style={{margin:'0 12px 10px',background:'#f0f2f5',borderRadius:10,padding:14}}>
                <p style={{fontSize:12,fontWeight:600,color:'#00a884',margin:'0 0 10px'}}>Nova conversa</p>
                <input value={novoTel} onChange={e=>setNovoTel(e.target.value)} placeholder="Número (ex: 5511999887766)" style={{width:'100%',padding:'8px 10px',fontSize:13,borderRadius:7,border:'1px solid #d1d7db',background:'white',color:'#111',marginBottom:8,outline:'none'}}/>
                <input value={novaMsgTexto} onChange={e=>setNovaMsgTexto(e.target.value)} placeholder="Primeira mensagem..." style={{width:'100%',padding:'8px 10px',fontSize:13,borderRadius:7,border:'1px solid #d1d7db',background:'white',color:'#111',marginBottom:10,outline:'none'}}/>
                <div style={{display:'flex',gap:8}}>
                  <button onClick={async()=>{
                    if(!novoTel.trim()||!novaMsgTexto.trim()) return
                    const tel=novoTel.replace(/\D/g,'')
                    const {data:conv}=await supabase.from('whatsapp_conversas').insert({telefone:tel,nome_contato:tel,medico_id:medico.id,status:'ativa',modo:'humano'}).select().single()
                    if(conv){
                      await supabase.from('whatsapp_mensagens').insert({conversa_id:conv.id,tipo:'enviada',conteudo:novaMsgTexto,metadata:{manual:true}})
                      await fetch('/api/whatsapp/enviar',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({telefone:tel,texto:novaMsgTexto,medico_id:medico.id})})
                      await carregarConversas(); setAtiva(conv)
                    }
                    setNovoTel('');setNovaMsgTexto('');setNovaConversa(false)
                  }} style={{flex:1,padding:'8px',borderRadius:7,border:'none',background:'#00a884',color:'white',fontSize:13,fontWeight:600,cursor:'pointer'}}>Enviar</button>
                  <button onClick={()=>{setNovaConversa(false);setNovoTel('');setNovaMsgTexto('')}} style={{padding:'8px 14px',borderRadius:7,border:'none',background:'#e5e7eb',color:'#374151',fontSize:13,cursor:'pointer'}}>Cancelar</button>
                </div>
              </div>
            )}

            {/* Lista agrupada */}
            <div style={{flex:1,overflowY:'auto'}} onClick={()=>setMenuConversa(null)}>
              {filtradas.length===0?(
                <div style={{padding:'32px 16px',textAlign:'center'}}><p style={{fontSize:13,color:'#667781',margin:0}}>Nenhuma conversa</p></div>
              ):(()=>{
                // Conversa encerrada que recebe nova msg é reativada automaticamente
                const ativas = filtradas.filter(cv=>cv.status!=='encerrada'||(cv.naoLidas>0))
                const emAtendimento = ativas.filter(cv=>cv.status!=='encerrada'&&cv.modo==='humano'&&!!cv.atendente_nome)
                const aguardando = ativas.filter(cv=>cv.status!=='encerrada'&&cv.modo==='humano'&&!cv.atendente_nome)
                const sofiaIA = ativas.filter(cv=>cv.status!=='encerrada'&&cv.modo==='ia')
                // Encerradas com msgs novas voltam para lista ativa
                const encerradasReativadas = ativas.filter(cv=>cv.status==='encerrada'&&cv.naoLidas>0)
                sofiaIA.push(...encerradasReativadas)
                const encerradas = conversas.filter(cv=>cv.status==='encerrada')

                const renderCV = (cv:any) => (
                  <div key={cv.id} className={`cv${ativa?.id===cv.id?' sel':''}`}
                    onClick={()=>setAtiva(cv)}
                    onContextMenu={e=>{e.preventDefault();setMenuConversa({id:cv.id,x:e.clientX,y:e.clientY})}}
                    style={{padding:'0 16px',cursor:'pointer',background:ativa?.id===cv.id?'#f0f2f5':'white'}}>
                    <div style={{display:'flex',gap:12,alignItems:'center',borderBottom:'1px solid #f0f2f5',padding:'10px 0'}}>
                      {cv.foto_url?(
                        <img src={cv.foto_url} alt={nomeCv(cv)} style={{width:49,height:49,borderRadius:'50%',objectFit:'cover' as const,flexShrink:0}}/>
                      ):(
                        <div style={{width:49,height:49,borderRadius:'50%',background:corAvatar(cv.telefone||''),display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,color:'white',fontWeight:600,flexShrink:0}}>{ini(nomeCv(cv))}</div>
                      )}
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:3}}>
                          <p style={{fontSize:15,fontWeight:cv.naoLidas>0?600:400,color:'#111827',margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' as const}}>
                          {cv.canal==='instagram'&&<svg style={{marginRight:4,verticalAlign:'middle',flexShrink:0}} width="14" height="14" viewBox="0 0 24 24" fill="none"><defs><radialGradient id="ig1" cx="30%" cy="107%" r="150%"><stop offset="0%" stopColor="#fdf497"/><stop offset="5%" stopColor="#fdf497"/><stop offset="45%" stopColor="#fd5949"/><stop offset="60%" stopColor="#d6249f"/><stop offset="90%" stopColor="#285AEB"/></radialGradient></defs><rect x="2" y="2" width="20" height="20" rx="5" ry="5" fill="url(#ig1)"/><path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z" fill="white"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>}
                          {cv.canal==='messenger'&&<svg style={{marginRight:4,verticalAlign:'middle',flexShrink:0}} width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" fill="#0099FF"/><path d="M12 6C8.686 6 6 8.462 6 11.538c0 1.636.686 3.099 1.8 4.154V18l2.057-1.132A6.4 6.4 0 0012 17.077c3.314 0 6-2.462 6-5.539C18 8.462 15.314 6 12 6zm.6 7.385l-1.543-1.616-3 1.616 3.3-3.462 1.543 1.616 3-1.616-3.3 3.462z" fill="white"/></svg>}
                          {(!cv.canal||cv.canal==='whatsapp')&&<svg style={{marginRight:4,verticalAlign:'middle',flexShrink:0}} width="14" height="14" viewBox="0 0 175.216 175.552" fill="none"><path fill="#25D366" d="M87.184 25.227c-33.733 0-61.166 27.423-61.178 61.13a60.98 60.98 0 009.349 32.535l1.455 2.313-6.179 22.558 23.146-6.069 2.235 1.324c9.387 5.571 20.15 8.517 31.126 8.523h.023c33.707 0 61.14-27.426 61.153-61.135a60.75 60.75 0 00-17.895-43.251 60.75 60.75 0 00-43.235-17.928z"/><path fill="white" fillRule="evenodd" d="M68.772 55.603c-1.378-3.061-2.828-3.123-4.137-3.176l-3.524-.043c-1.226 0-3.218.46-4.902 2.3s-6.435 6.287-6.435 15.332 6.588 17.785 7.506 19.013 12.718 20.381 31.405 27.75c15.529 6.124 18.689 4.906 22.061 4.6s10.877-4.447 12.408-8.74 1.532-7.971 1.073-8.74-1.685-1.226-3.525-2.146-10.877-5.367-12.562-5.981-2.91-.919-4.137.921-4.746 5.979-5.819 7.206-2.144 1.381-3.984.462-7.76-2.861-14.784-9.124c-5.465-4.873-9.154-10.891-10.228-12.73s-.114-2.835.808-3.751c.825-.824 1.838-2.147 2.759-3.22s1.224-1.84 1.836-3.065.307-2.301-.153-3.22-4.032-10.011-5.666-13.647"/></svg>}
                          {nomeCv(cv)}
                        </p>
                          <span style={{fontSize:11,color:cv.naoLidas>0?'#25d366':'#667781',flexShrink:0,marginLeft:8}}>{cv.ultima?fmt(cv.ultima.criado_em):''}</span>
                        </div>
                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                          <p style={{fontSize:13,color:'#667781',margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' as const,flex:1}}>
                            {cv.ultima?.tipo==='enviada'&&<svg style={{display:'inline',marginRight:2,verticalAlign:'middle'}} width="14" height="10" viewBox="0 0 16 11" fill="none"><path d="M1 5.5L5 9.5L15 1" stroke="#53bdeb" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M5 5.5L9 9.5L15 1" stroke="#53bdeb" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                            {cv.ultima?.conteudo?.substring(0,40)||''}
                          </p>
                          <div style={{display:'flex',alignItems:'center',gap:4,marginLeft:6,flexShrink:0}}>
                            {cv.modo==='humano'&&cv.atendente_nome&&<span style={{fontSize:10,color:'#0066cc',background:'#e8f0fe',padding:'1px 6px',borderRadius:10,fontWeight:500}}>{cv.atendente_nome?.split(' ')[0]}</span>}
                            {cv.naoLidas>0&&<span style={{fontSize:11,fontWeight:600,color:'white',background:'#25d366',minWidth:20,height:20,borderRadius:10,display:'flex',alignItems:'center',justifyContent:'center',padding:'0 5px'}}>{cv.naoLidas}</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )

                const renderSecao = (titulo:string, cor:string, bg:string, lista:any[]) => lista.length===0?null:(
                  <div key={titulo}>
                    <div style={{padding:'10px 16px 6px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                      <span style={{fontSize:11,fontWeight:700,color:cor,textTransform:'uppercase' as const,letterSpacing:'0.06em'}}>{titulo}</span>
                      <span style={{fontSize:11,fontWeight:600,color:'white',background:cor,minWidth:18,height:18,borderRadius:10,display:'flex',alignItems:'center',justifyContent:'center',padding:'0 5px'}}>{lista.length}</span>
                    </div>
                    <div style={{margin:'0 12px 8px',height:1,background:bg}}/>
                    {lista.map(renderCV)}
                  </div>
                )

                return (
                  <>
                    {renderSecao('Em andamento','#0066cc','#dbeafe',emAtendimento)}
                    {renderSecao('Aguardando atendimento','#f59e0b','#fef3c7',aguardando)}
                    {renderSecao('Sofia IA','#00a884','#d1fae5',sofiaIA)}
                    {renderSecao('Atendimentos encerrados','#9ca3af','#f3f4f6',encerradas)}
                  </>
                )
              })()}
            </div>
          </>
        )}

        {/* ABA CONTATOS */}
        {aba==='contatos'&&(
          <div style={{display:'flex',flexDirection:'column' as const,height:'100%'}}>
            <div style={{padding:'16px',borderBottom:'1px solid #f0f2f5',flexShrink:0}}>
              <h3 style={{fontSize:16,fontWeight:700,color:'#111827',margin:'0 0 10px'}}>Contatos</h3>
              <input placeholder="Buscar..." style={{width:'100%',padding:'8px 12px',borderRadius:8,border:'1px solid #d1d7db',outline:'none',fontSize:13}} onChange={e=>{const v=e.target.value.toLowerCase();const els=document.querySelectorAll('.contato-item');els.forEach((el:any)=>{el.style.display=el.dataset.nome?.toLowerCase().includes(v)?'flex':'none'})}}/>
            </div>
            <div style={{flex:1,overflowY:'auto' as const}}>
              {conversas.length===0?(
                <div style={{padding:32,textAlign:'center' as const,color:'#667781',fontSize:13}}>Nenhum contato ainda</div>
              ):conversas.map(cv=>(
                <div key={cv.id} className="contato-item" data-nome={cv.nome_contato||cv.telefone}
                  onClick={()=>{setAtiva(cv);setAba('chats')}}
                  style={{display:'flex',alignItems:'center',gap:12,padding:'10px 16px',cursor:'pointer',borderBottom:'1px solid #f0f2f5'}}
                  onMouseEnter={e=>(e.currentTarget.style.background='#f5f6f6')}
                  onMouseLeave={e=>(e.currentTarget.style.background='white')}>
                  {cv.foto_url
                    ?<img src={cv.foto_url} style={{width:42,height:42,borderRadius:'50%',objectFit:'cover' as const,flexShrink:0}}/>
                    :<div style={{width:42,height:42,borderRadius:'50%',background:'#dfe5e7',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,color:'#54656f',flexShrink:0}}>{ini(cv.nome_contato||cv.telefone)}</div>
                  }
                  <div style={{flex:1,minWidth:0}}>
                    <p style={{fontSize:14,fontWeight:500,color:'#111827',margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' as const}}>{cv.nome_contato||cv.telefone}</p>
                    <p style={{fontSize:12,color:'#667781',margin:0}}>{cv.telefone}</p>
                  </div>
                  <span style={{fontSize:10,padding:'2px 6px',borderRadius:10,background:cv.status==='encerrada'?'#f3f4f6':cv.modo==='ia'?'#d9fdd3':'#dbeafe',color:cv.status==='encerrada'?'#6b7280':cv.modo==='ia'?'#166534':'#1e40af',fontWeight:500,flexShrink:0}}>
                    {cv.status==='encerrada'?'Encerrado':cv.modo==='ia'?'Sofia':'Humano'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ABA EQUIPE */}
        {aba==='equipe'&&(
          <div style={{flex:1,overflowY:'auto',padding:16}}>
            {/* Departamentos */}
            <p style={{fontSize:11,fontWeight:600,color:'#aebac1',margin:'0 0 10px',letterSpacing:'0.08em'}}>DEPARTAMENTOS</p>
            <div style={{display:'flex',flexWrap:'wrap' as const,gap:6,marginBottom:16}}>
              {departamentos.map((d:any)=>(
                <span key={d.id} style={{fontSize:12,padding:'4px 10px',borderRadius:20,background:d.cor+'22',color:d.cor,fontWeight:500,border:`1px solid ${d.cor}44`}}>{d.nome}</span>
              ))}
              {departamentos.length===0&&<span style={{fontSize:12,color:'#aebac1'}}>Nenhum departamento</span>}
              {(!localStorage.getItem('atendente'))&&(
                <button onClick={async()=>{
                  const nome=prompt('Nome do departamento:')
                  const cor=prompt('Cor (hex, ex: #1F9D5C):','#00a884')
                  if(!nome) return
                  const {data}=await supabase.from('departamentos').insert({medico_id:medico?.id,nome,cor:cor||'#00a884'}).select().single()
                  if(data) setDepartamentos((p:any)=>[...p,data])
                }} style={{fontSize:11,padding:'4px 10px',borderRadius:20,border:'1px dashed #aebac1',background:'none',color:'#aebac1',cursor:'pointer'}}>+ Novo</button>
              )}
            </div>
            <p style={{fontSize:11,fontWeight:600,color:'#aebac1',margin:'0 0 14px',letterSpacing:'0.08em'}}>ATENDENTES ATIVOS</p>
            {atendentes.filter((a:any)=>a.ativo!==false).map((at:any)=>(
              <div key={at.id} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 0',borderBottom:'1px solid #f0f2f5'}}>
                <div style={{width:42,height:42,borderRadius:'50%',background:'#dfe5e7',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:600,color:'#54656f',flexShrink:0}}>
                  {ini(at.nome)}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <p style={{fontSize:14,fontWeight:500,color:'#111827',margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' as const}}>{at.nome}</p>
                  <p style={{fontSize:12,color:'#667781',margin:0}}>{at.cargo} · {at.email}</p>
                  {at.ultimo_acesso&&(()=>{const diff=Date.now()-new Date(at.ultimo_acesso).getTime();const online=diff<300000;return <span style={{fontSize:10,color:online?'#00a884':'#aebac1',fontWeight:500}}>{online?'● Online agora':'● Visto '+Math.round(diff/60000)+'min atrás'}</span>})()}
                </div>
                <button onClick={async()=>{
                  if(confirm('Remover '+at.nome+'?')){
                    await fetch('/api/atendentes?id='+at.id,{method:'DELETE'})
                    carregarAtendentes(medico?.id)
                  }
                }} style={{fontSize:11,color:'#ef4444',background:'none',border:'none',cursor:'pointer',padding:'4px 8px',flexShrink:0}}>Remover</button>
              </div>
            ))}
            {atendentes.filter((a:any)=>a.ativo!==false).length===0&&(
              <p style={{fontSize:13,color:'#aebac1',textAlign:'center' as const,marginTop:24}}>Nenhum atendente ainda</p>
            )}

            {/* Formulário novo atendente — só admin vê */}
            {(!localStorage.getItem('atendente') || medico?.cargo==='admin') && (
            <div style={{marginTop:20,padding:14,background:'#f0f2f5',borderRadius:10}}>
              <p style={{fontSize:12,fontWeight:600,color:'#00a884',margin:'0 0 12px'}}>+ Novo atendente</p>
              <input value={novoAt.nome} onChange={e=>setNovoAt(p=>({...p,nome:e.target.value}))} placeholder="Nome completo" style={{width:'100%',padding:'8px 10px',fontSize:13,borderRadius:7,border:'1px solid #d1d7db',background:'white',color:'#111',marginBottom:7,outline:'none',display:'block'}}/>
              <input value={novoAt.email} onChange={e=>setNovoAt(p=>({...p,email:e.target.value}))} placeholder="Email" type="email" style={{width:'100%',padding:'8px 10px',fontSize:13,borderRadius:7,border:'1px solid #d1d7db',background:'white',color:'#111',marginBottom:7,outline:'none',display:'block'}}/>
              <input value={novoAt.senha} onChange={e=>setNovoAt(p=>({...p,senha:e.target.value}))} placeholder="Senha" type="password" style={{width:'100%',padding:'8px 10px',fontSize:13,borderRadius:7,border:'1px solid #d1d7db',background:'white',color:'#111',marginBottom:7,outline:'none',display:'block'}}/>
              <select value={novoAt.cargo} onChange={e=>setNovoAt(p=>({...p,cargo:e.target.value}))} style={{width:'100%',padding:'8px 10px',fontSize:13,borderRadius:7,border:'1px solid #d1d7db',background:'white',color:'#111',marginBottom:10,outline:'none'}}>
                <option>Atendente</option>
                <option>Recepcionista</option>
                <option>Enfermeiro(a)</option>
                <option>Coordenador(a)</option>
              </select>
              {atMsg&&<p style={{fontSize:12,color:atMsg.startsWith('Atendente')?'#00a884':'#ef4444',margin:'0 0 8px'}}>{atMsg}</p>}
              <button disabled={salvandoAt} onClick={async()=>{
                if(!novoAt.nome||!novoAt.email||!novoAt.senha){setAtMsg('Preencha todos os campos');return}
                setSalvandoAt(true);setAtMsg('')
                const r=await fetch('/api/atendentes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({medico_id:medico?.id,...novoAt})})
                const d=await r.json()
                if(d.error){setAtMsg(d.error)}
                else{setAtMsg('Atendente '+d.atendente.nome+' criado!');setNovoAt({nome:'',email:'',senha:'',cargo:'Atendente'});carregarAtendentes(medico?.id)}
                setSalvandoAt(false)
              }} style={{width:'100%',padding:'10px',borderRadius:7,border:'none',background:'#00a884',color:'white',fontSize:13,fontWeight:600,cursor:'pointer'}}>
                {salvandoAt?'Salvando...':'Adicionar atendente'}
              </button>
              <p style={{fontSize:11,color:'#aebac1',margin:'10px 0 0',textAlign:'center' as const}}>
                O atendente acessa via <a href="/login-atendente" target="_blank" style={{color:'#00a884'}}>login-atendente</a>
              </p>
            </div>
            )}
          </div>
        )}
      </div>

      {/* Info conexão */}
      {showInfo&&(
        <>
          <div style={{position:'fixed' as const,inset:0,zIndex:100}} onClick={()=>setShowInfo(false)}/>
          <div style={{position:'fixed' as const,left:60,top:200,background:'white',borderRadius:12,zIndex:101,width:280,padding:20}}>
            <p style={{fontSize:13,fontWeight:600,color:'#00a884',margin:'0 0 14px',letterSpacing:'0.05em'}}>CONEXÃO WHATSAPP</p>
            <div style={{display:'flex',flexDirection:'column' as const,gap:10}}>
              <div style={{padding:'10px 12px',background:'#f0f2f5',borderRadius:8}}>
                <p style={{fontSize:11,color:'#667781',margin:'0 0 2px'}}>Número conectado</p>
                <p style={{fontSize:14,fontWeight:500,color:'#111827',margin:0}}>{config?.phone_number||config?.phone_number_id||'Não configurado'}</p>
              </div>
              <div style={{padding:'10px 12px',background:'#f0fdf4',borderRadius:8}}>
                <p style={{fontSize:11,color:'#667781',margin:'0 0 2px'}}>Status</p>
                <p style={{fontSize:14,fontWeight:500,color:'#00a884',margin:0}}>● Conectado</p>
              </div>
              <div style={{padding:'10px 12px',background:'#f0f2f5',borderRadius:8}}>
                <p style={{fontSize:11,color:'#667781',margin:'0 0 2px'}}>Nome de exibição</p>
                <p style={{fontSize:14,fontWeight:500,color:'#111827',margin:0}}>{config?.nome_exibicao||medico?.nome||'—'}</p>
              </div>
            </div>
            <button onClick={()=>{setShowInfo(false);router.push('/whatsapp')}} style={{width:'100%',marginTop:14,padding:'9px',borderRadius:8,border:'none',background:'#f0f2f5',color:'#54656f',fontSize:13,cursor:'pointer',fontWeight:500}}>
              Configurações avançadas →
            </button>
          </div>
        </>
      )}

      {/* Menu contexto */}
      {menuConversa&&(
        <>
          <div style={{position:'fixed',inset:0,zIndex:100}} onClick={()=>setMenuConversa(null)}/>
          <div style={{position:'fixed',left:menuConversa.x,top:menuConversa.y,background:'white',borderRadius:10,zIndex:101,minWidth:210,overflow:'hidden',padding:'4px 0'}}>
            {[
              {label:'Marcar como não lida',fn:async()=>{await supabase.from('whatsapp_mensagens').update({lida:false}).eq('conversa_id',menuConversa.id).eq('tipo','recebida');carregarConversas();setMenuConversa(null)}},
              {label:'Limpar mensagens',fn:async()=>{if(confirm('Limpar mensagens?')){await supabase.from('whatsapp_mensagens').delete().eq('conversa_id',menuConversa.id);if(ativa?.id===menuConversa.id) setMensagens([]);setMenuConversa(null)}}},
              {label:'Deletar conversa',fn:async()=>{if(confirm('Deletar conversa permanentemente?')){await supabase.from('whatsapp_mensagens').delete().eq('conversa_id',menuConversa.id);await supabase.from('whatsapp_conversas').delete().eq('id',menuConversa.id);if(ativa?.id===menuConversa.id){setAtiva(null);setMensagens([]);}carregarConversas();setMenuConversa(null)}}},
              {label:'Arquivar'},
              {label:'Dados do contato'},
            ].map(item=>(
              <button key={item.label} onClick={item.fn||(()=>setMenuConversa(null))} style={{display:'flex',alignItems:'center',width:'100%',padding:'11px 16px',border:'none',background:'none',color:'#111827',fontSize:14,cursor:'pointer',textAlign:'left' as const}}
                onMouseEnter={e=>(e.currentTarget.style.background='#f5f6f6')}
                onMouseLeave={e=>(e.currentTarget.style.background='none')}>
                {item.label}
              </button>
            ))}
          </div>
        </>
      )}

      {showConfig&&medico&&<ConfigPanel medico={medico} onClose={()=>setShowConfig(false)}/>}

      {/* Painel paciente */}
      {showPaciente&&dadosPaciente&&(
        <div style={{width:300,background:'white',borderLeft:'1px solid #f0f2f5',display:'flex',flexDirection:'column' as const,flexShrink:0,overflow:'hidden'}}>
          <div style={{padding:'14px 16px',borderBottom:'1px solid #f0f2f5',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <p style={{fontSize:14,fontWeight:700,color:'#111827',margin:0}}>Ficha do paciente</p>
            <button onClick={()=>setShowPaciente(false)} style={{background:'none',border:'none',cursor:'pointer',fontSize:18,color:'#6b7280',lineHeight:1}}>×</button>
          </div>
          <div style={{flex:1,overflowY:'auto',padding:16}}>
            {/* Avatar e nome */}
            <div style={{textAlign:'center' as const,marginBottom:16}}>
              {dadosPaciente.foto_url
                ? <img src={dadosPaciente.foto_url} style={{width:64,height:64,borderRadius:'50%',objectFit:'cover' as const,border:'2px solid #f0f2f5'}}/>
                : <div style={{width:64,height:64,borderRadius:'50%',background:'#d9fdd3',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,fontWeight:700,color:'#00a884',margin:'0 auto'}}>{dadosPaciente.nome?.split(' ').map((x:string)=>x[0]).slice(0,2).join('')}</div>
              }
              <p style={{fontSize:15,fontWeight:700,color:'#111827',margin:'8px 0 2px'}}>{dadosPaciente.nome}</p>
              <p style={{fontSize:12,color:'#667781',margin:0}}>{dadosPaciente.sexo}{dadosPaciente.data_nascimento?` · ${new Date().getFullYear()-new Date(dadosPaciente.data_nascimento).getFullYear()} anos`:''}</p>
            </div>
            {/* Dados */}
            <div style={{background:'#F5F5F5',borderRadius:10,padding:'12px 14px',marginBottom:14}}>
              {[
                {label:'Telefone',val:dadosPaciente.telefone},
                {label:'Email',val:dadosPaciente.email},
                {label:'CPF',val:dadosPaciente.cpf},
                {label:'Convênio',val:dadosPaciente.convenio},
              ].filter(d=>d.val).map(d=>(
                <div key={d.label} style={{display:'flex',justifyContent:'space-between',padding:'5px 0',borderBottom:'1px solid #f0f2f5'}}>
                  <span style={{fontSize:11,color:'#667781'}}>{d.label}</span>
                  <span style={{fontSize:11,color:'#111827',fontWeight:500,maxWidth:160,textAlign:'right' as const,wordBreak:'break-all' as const}}>{d.val}</span>
                </div>
              ))}
            </div>
            {/* Últimas consultas */}
            <p style={{fontSize:11,fontWeight:700,color:'#667781',margin:'0 0 8px',textTransform:'uppercase' as const,letterSpacing:'0.05em'}}>Últimas consultas</p>
            {consultasPaciente.length===0
              ? <p style={{fontSize:12,color:'#aebac1',textAlign:'center' as const,padding:'12px 0'}}>Nenhuma consulta registrada</p>
              : consultasPaciente.map((c:any,i:number)=>(
                <div key={i} style={{background:'#F5F5F5',borderRadius:8,padding:'10px 12px',marginBottom:8,border:'1px solid #f0f2f5'}}>
                  <p style={{fontSize:11,color:'#667781',margin:'0 0 4px'}}>{new Date(c.data).toLocaleDateString('pt-BR',{day:'2-digit',month:'short',year:'numeric'})}</p>
                  {c.diagnostico_principal&&<p style={{fontSize:12,fontWeight:600,color:'#111827',margin:'0 0 3px'}}>{c.diagnostico_principal}</p>}
                  {c.resumo_ia&&<p style={{fontSize:11,color:'#374151',margin:0,lineHeight:1.5}}>{c.resumo_ia.substring(0,120)}{c.resumo_ia.length>120?'...':''}</p>}
                </div>
              ))
            }
            {/* Link para ficha completa */}
            <a href={'/pacientes/'+dadosPaciente.id} target="_blank" rel="noreferrer" style={{display:'block',textAlign:'center' as const,marginTop:12,fontSize:12,color:'#00a884',textDecoration:'none',fontWeight:500,padding:'8px',background:'#f0fdf4',borderRadius:8,border:'1px solid #d9fdd3'}}>
              Abrir ficha completa →
            </a>
          </div>
        </div>
      )}

      {/* Chat */}
      {ativa?(
        <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
          {/* Header chat */}
          <div style={{background:'white',borderBottom:'1px solid #f0f2f5',padding:'10px 16px',display:'flex',alignItems:'center',gap:12,flexShrink:0}}>
            {ativa.foto_url?(
              <img src={ativa.foto_url} alt={nomeCv(ativa)} style={{width:40,height:40,borderRadius:'50%',objectFit:'cover' as const}}/>
            ):(
              <div style={{width:40,height:40,borderRadius:'50%',background:'#dfe5e7',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,color:'#54656f'}}>{ini(nomeCv(ativa))}</div>
            )}
            <div style={{flex:1}}>
              <p style={{fontSize:15,fontWeight:500,color:'#111827',margin:0}}>{nomeCv(ativa)}</p>
              <p style={{fontSize:12,color:'#667781',margin:0}}>
                {ativa.modo==='humano'
                  ? `Atendimento humano${ativa.atendente_nome?' · '+ativa.atendente_nome:''}`
                  : 'Sofia IA · online'}
              </p>
            </div>
            <div style={{display:'flex',gap:4,alignItems:'center'}}>
              {ativa.modo==='ia'?(
                <button onClick={assumir} style={{fontSize:12,color:'white',background:'#00a884',border:'none',padding:'6px 16px',borderRadius:20,cursor:'pointer',fontWeight:500}}>Assumir</button>
              ):(
                <div style={{display:'flex',gap:6}}>
                  <button onClick={devolverIA} style={{fontSize:12,color:'#54656f',background:'#e9edef',border:'none',padding:'6px 16px',borderRadius:20,cursor:'pointer'}}>Devolver à IA</button>
                  <button onClick={async()=>{if(confirm('Encerrar este atendimento?')){await supabase.from('whatsapp_conversas').update({status:'encerrada'}).eq('id',ativa.id);setAtiva({...ativa,status:'encerrada'});carregarConversas()}}} style={{fontSize:12,color:'#ef4444',background:'#fee2e2',border:'none',padding:'6px 16px',borderRadius:20,cursor:'pointer'}}>Encerrar</button>
                </div>
              )}
              {ativa.paciente_id&&(
                <button onClick={()=>showPaciente?setShowPaciente(false):carregarDadosPaciente(ativa.paciente_id)} style={{fontSize:12,color:showPaciente?'#00a884':'#54656f',background:showPaciente?'#d9fdd3':'#e9edef',border:'none',padding:'6px 16px',borderRadius:20,cursor:'pointer',fontWeight:500}}>
                  {showPaciente?'✕ Fechar ficha':'👤 Ver ficha'}
                </button>
              )}
              <button onClick={()=>{setBuscaChatAtiva(v=>!v);setBuscaChat('')}} className="ibtn" style={{width:36,height:36,border:'none',background:buscaChatAtiva?'#f0f2f5':'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',borderRadius:'50%'}}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#54656f" strokeWidth="1.8"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              </button>
              <div style={{position:'relative' as const}}>
                <button onClick={()=>setMenuHeader(v=>!v)} className="ibtn" style={{width:36,height:36,border:'none',background:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',borderRadius:'50%'}}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="#54656f"><circle cx="12" cy="4" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="20" r="1.8"/></svg>
                </button>
                {menuHeader&&(
                  <>
                    <div style={{position:'fixed' as const,inset:0,zIndex:50}} onClick={()=>setMenuHeader(false)}/>
                    <div style={{position:'absolute' as const,right:0,top:40,background:'white',borderRadius:8,zIndex:51,minWidth:200,overflow:'hidden',padding:'4px 0'}}>
                      {[
                        {label:'Dados do contato'},
                        {label:'Mensagens favoritas'},
                        {label:'Limpar mensagens',fn:async()=>{if(confirm('Limpar todas as mensagens?')){await supabase.from('whatsapp_mensagens').delete().eq('conversa_id',ativa.id);setMensagens([]);setMenuHeader(false)}}},
                        {label:ativa?.modo==='ia'?'Assumir atendimento':'Devolver à Sofia',fn:()=>{ativa?.modo==='ia'?assumir():devolverIA();setMenuHeader(false)}},
                      ].map(item=>(
                        <button key={item.label} onClick={item.fn||(()=>setMenuHeader(false))} style={{display:'block',width:'100%',padding:'11px 16px',border:'none',background:'none',color:'#111827',fontSize:14,cursor:'pointer',textAlign:'left' as const}}
                          onMouseEnter={e=>(e.currentTarget.style.background='#f5f6f6')}
                          onMouseLeave={e=>(e.currentTarget.style.background='none')}>
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Barra busca chat */}
          {buscaChatAtiva&&(
            <div style={{background:'#f0f2f5',padding:'8px 16px',display:'flex',alignItems:'center',gap:8,borderBottom:'1px solid #d1d7db',flexShrink:0}}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#54656f" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input autoFocus value={buscaChat} onChange={e=>setBuscaChat(e.target.value)} placeholder="Buscar mensagem..." style={{flex:1,border:'none',outline:'none',background:'transparent',fontSize:14,color:'#111827',fontFamily:'inherit'}}/>
              {buscaChat&&<span style={{fontSize:12,color:'#667781'}}>{mensagens.filter(m=>m.conteudo?.toLowerCase().includes(buscaChat.toLowerCase())).length} resultado(s)</span>}
              <button onClick={()=>{setBuscaChatAtiva(false);setBuscaChat('')}} style={{border:'none',background:'none',cursor:'pointer',color:'#54656f',fontSize:20,lineHeight:1}}>×</button>
            </div>
          )}
          {/* Mensagens */}
          <div style={{flex:1,overflowY:'auto',padding:'12px 8%',background:'#efeae2'}}>
            {(buscaChat?mensagens.filter(m=>m.conteudo?.toLowerCase().includes(buscaChat.toLowerCase())):mensagens).map((m,idx)=>{
              const rec=m.tipo==='recebida'
              const isIA=m.metadata?.ia
              const isSistema=m.metadata?.sistema
              const dA=new Date(m.criado_em).toDateString()
              const dB=idx>0?new Date(mensagens[idx-1].criado_em).toDateString():null
              const mostraData=idx===0||dA!==dB
              return (
                <div key={m.id}>
                  {mostraData&&(
                    <div style={{textAlign:'center',margin:'12px 0'}}>
                      <span style={{fontSize:12,color:'#54656f',background:'rgba(255,255,255,0.85)',padding:'5px 14px',borderRadius:8}}>{fmtData(m.criado_em)}</span>
                    </div>
                  )}
                  {isSistema?(
                    <div style={{textAlign:'center',margin:'6px 0'}}>
                      <span style={{fontSize:12,color:'#54656f',background:'rgba(255,255,255,0.85)',padding:'4px 12px',borderRadius:8}}>{m.conteudo}</span>
                    </div>
                  ):(
                    <div style={{display:'flex',flexDirection:'column' as const,alignItems:rec?'flex-start':'flex-end',marginBottom:2}}>
                      <div style={{maxWidth:'65%',padding:'6px 10px 8px',borderRadius:rec?'0 7.5px 7.5px 7.5px':'7.5px 7.5px 0 7.5px',background:rec?'#ffffff':'#d9fdd3'}}>
                        {!rec&&isIA&&<p style={{fontSize:11,fontWeight:700,color:'#00a884',margin:'0 0 2px',textTransform:'uppercase' as const,letterSpacing:'0.04em'}}>Sofia IA</p>}
                        {!rec&&!isIA&&m.metadata?.remetente&&<p style={{fontSize:11,fontWeight:600,color:'#53bdeb',margin:'0 0 2px'}}>{m.metadata.remetente}</p>}
                        <p style={{fontSize:14,color:'#111827',margin:0,lineHeight:1.5,wordBreak:'break-word' as const}} dangerouslySetInnerHTML={{__html:md(m.conteudo)}}/>
                        <div style={{display:'flex',alignItems:'center',justifyContent:'flex-end',gap:3,marginTop:2}}>
                          <span style={{fontSize:11,color:'#667781'}}>{fmtH(m.criado_em)}</span>
                          {!rec&&<svg width="14" height="9" viewBox="0 0 16 11" fill="none"><path d="M1 5.5L5 9.5L15 1" stroke="#53bdeb" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M5 5.5L9 9.5L15 1" stroke="#53bdeb" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                        </div>
                      </div>
                      {m.metadata?.botoes&&m.metadata.botoes.length>0&&(
                        <div style={{display:'flex',flexDirection:'column' as const,gap:4,marginTop:6,maxWidth:'65%'}}>
                          {m.metadata.botoes.map((b:string,i:number)=>(
                            <button key={i} className="botao-resp" onClick={()=>enviarResposta(b)}
                              style={{padding:'10px 16px',borderRadius:8,border:'1px solid #25d366',background:'white',color:'#128c7e',fontSize:14,cursor:'pointer',textAlign:'center' as const,fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',gap:8,transition:'all 0.15s'}}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 00-4-4H4"/></svg>
                              {b}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
            <div ref={endRef}/>
          </div>

          {/* Input */}
          <div style={{background:'#f0f2f5',padding:'8px 12px',display:'flex',gap:6,alignItems:'flex-end',flexShrink:0}}>
            <div style={{position:'relative' as const}}>
              <button onClick={()=>setShowEmoji(v=>!v)} className="ibtn" style={{width:42,height:42,border:'none',background:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#54656f" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><path d="M8 13s1.5 2 4 2 4-2 4-2"/><circle cx="9" cy="9" r="1" fill="#54656f" stroke="none"/><circle cx="15" cy="9" r="1" fill="#54656f" stroke="none"/></svg>
              </button>
              {showEmoji&&(
                <>
                  <div style={{position:'fixed' as const,inset:0,zIndex:50}} onClick={()=>setShowEmoji(false)}/>
                  <div style={{position:'absolute' as const,bottom:50,left:0,background:'white',borderRadius:12,zIndex:51,padding:12,display:'flex',flexWrap:'wrap' as const,gap:4,width:280}}>
                    {['😊','😂','❤️','👍','🙏','😭','😍','🎉','🔥','✅','⚠️','📅','💊','🏥','👨‍⚕️','🩺','💉','🩹','📋','📞','⏰','🔔','✉️','📲','👋','😷','🤒','💪','🌟','👏'].map(e=>(
                      <button key={e} onClick={()=>{setMsg(p=>p+e);setShowEmoji(false)}} style={{fontSize:22,background:'none',border:'none',cursor:'pointer',padding:'4px',borderRadius:6,lineHeight:1}} onMouseEnter={el=>(el.currentTarget.style.background='#f0f2f5')} onMouseLeave={el=>(el.currentTarget.style.background='none')}>{e}</button>
                    ))}
                  </div>
                </>
              )}
            </div>
            <button onClick={()=>fileInputRef.current?.click()} className="ibtn" style={{width:42,height:42,border:'none',background:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#54656f" strokeWidth="1.8"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
            </button>
            <input ref={fileInputRef} type="file" accept="image/*,application/pdf" style={{display:'none'}} onChange={async e=>{
              const file=e.target.files?.[0]; if(!file||!ativa) return
              const texto=`📎 ${file.name} (${(file.size/1024).toFixed(0)}KB)`
              const {data:nova}=await supabase.from('whatsapp_mensagens').insert({conversa_id:ativa.id,tipo:'enviada',conteudo:texto,metadata:{manual:true,remetente:usuario?.nome||medico?.nome,arquivo:true}}).select().single()
              if(nova) setMensagens(p=>[...p,nova])
              e.target.value=''
            }}/>
            <div style={{flex:1,background:'white',borderRadius:24,padding:'9px 16px',display:'flex',alignItems:'flex-end'}}>
              {gravando?(
                <div style={{flex:1,display:'flex',alignItems:'center',gap:8}}>
                  <div style={{width:8,height:8,borderRadius:'50%',background:'#f15c6d',animation:'pulse 1s infinite',flexShrink:0}}/>
                  <span style={{fontSize:14,color:'#667781'}}>Gravando...</span>
                </div>
              ):(
                <textarea value={msg} onChange={e=>setMsg(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();enviar()}}} placeholder="Digite uma mensagem" rows={1} style={{flex:1,border:'none',outline:'none',resize:'none',fontSize:15,lineHeight:1.5,maxHeight:120,background:'transparent',fontFamily:'inherit',color:'#111827'}}/>
              )}
            </div>
            {msg.trim()?(
              <button onClick={enviar} disabled={enviando} style={{width:44,height:44,borderRadius:'50%',border:'none',background:'#00a884',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
              </button>
            ):gravando?(
              <button onClick={pararGravacao} style={{width:44,height:44,borderRadius:'50%',border:'none',background:'#f15c6d',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>
              </button>
            ):(
              <button onClick={iniciarGravacao} className="ibtn" style={{width:44,height:44,border:'none',background:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#54656f" strokeWidth="1.8"><path d="M12 2a3 3 0 00-3 3v7a3 3 0 006 0V5a3 3 0 00-3-3z"/><path d="M19 10v1a7 7 0 01-14 0v-1"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="8" y1="22" x2="16" y2="22"/></svg>
              </button>
            )}
          </div>
        </div>
      ):(
        <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',background:'#f8f9fa',flexDirection:'column',gap:16}}>
          <div style={{width:160,height:160,borderRadius:'50%',background:'#f0f2f5',display:'flex',alignItems:'center',justifyContent:'center'}}>
            <svg xmlns="http://www.w3.org/2000/svg" width="72" height="72" viewBox="0 0 175.216 175.552" opacity="0.25">
              <path fill="#128c7e" d="M87.184 25.227c-33.733 0-61.166 27.423-61.178 61.13a60.98 60.98 0 0 0 9.349 32.535l1.455 2.313-6.179 22.558 23.146-6.069 2.235 1.324c9.387 5.571 20.15 8.517 31.126 8.523h.023c33.707 0 61.14-27.426 61.153-61.135a60.75 60.75 0 0 0-17.895-43.251 60.75 60.75 0 0 0-43.235-17.928z"/>
            </svg>
          </div>
          <div style={{textAlign:'center'}}>
            <p style={{fontSize:28,fontWeight:300,color:'#41525d',margin:'0 0 8px'}}>MedIA WhatsApp</p>
            <p style={{fontSize:14,color:'#667781',margin:'0 0 4px'}}>Selecione uma conversa para começar</p>
            <p style={{fontSize:12,color:'#aebac1',margin:0}}>{config?`Conectado · ${config.phone_number||config.phone_number_id}`:'⚠ WhatsApp não configurado'}</p>
          </div>
          <p style={{fontSize:12,color:'#aebac1',margin:0,display:'flex',alignItems:'center',gap:4}}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#aebac1" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            Criptografia de ponta a ponta
          </p>
        </div>
      )}
    </div>
  )
}
