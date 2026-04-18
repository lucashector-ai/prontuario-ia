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
  const [menuConversa, setMenuConversa] = useState<{id:string,x:number,y:number}|null>(null)
  const [gravando, setGravando] = useState(false)
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder|null>(null)
  const audioChunks = useRef<Blob[]>([])
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
    const d=new Date(iso),h=new Date(),on=new Date(h)
    on.setDate(h.getDate()-1)
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

  useEffect(()=>{
    const m=localStorage.getItem('medico')
    if(!m){router.push('/login');return}
    const med=JSON.parse(m); setMedico(med)
    supabase.from('whatsapp_config').select('*').eq('medico_id',med.id).single().then(({data})=>setConfig(data))
  },[router])

  useEffect(()=>{
    if(!medico) return
    carregarConversas()
    const ch=supabase.channel('wapp-light')
      .on('postgres_changes',{event:'*',schema:'public',table:'whatsapp_mensagens'},()=>carregarConversas())
      .on('postgres_changes',{event:'*',schema:'public',table:'whatsapp_conversas'},()=>carregarConversas())
      .subscribe()
    return ()=>{supabase.removeChannel(ch)}
  },[medico])

  useEffect(()=>{if(ativa) carregarMsgs(ativa.id)},[ativa])
  useEffect(()=>{endRef.current?.scrollIntoView({behavior:'instant' as ScrollBehavior})},[mensagens])

  const carregarConversas = useCallback(async()=>{
    if(!medico) return
    const {data}=await supabase.from('whatsapp_conversas')
      .select('*,whatsapp_mensagens(conteudo,criado_em,tipo,lida)')
      .eq('medico_id',medico.id)
      .order('ultimo_contato',{ascending:false})
    if(!data) return
    setConversas(data.map((c:any)=>({
      ...c,
      ultima:c.whatsapp_mensagens?.sort((a:any,b:any)=>new Date(b.criado_em).getTime()-new Date(a.criado_em).getTime())[0],
      naoLidas:c.whatsapp_mensagens?.filter((m:any)=>!m.lida&&m.tipo==='recebida').length||0
    })))
  },[medico])

  const carregarMsgs = async(id:string)=>{
    const {data}=await supabase.from('whatsapp_mensagens').select('*').eq('conversa_id',id).order('criado_em',{ascending:true})
    setMensagens(data||[])
    await supabase.from('whatsapp_mensagens').update({lida:true}).eq('conversa_id',id).eq('tipo','recebida')
  }

  const enviar = async()=>{
    if(!msg.trim()||!ativa||enviando) return
    setEnviando(true)
    const texto=msg.trim(); setMsg('')
    const {data:nova}=await supabase.from('whatsapp_mensagens').insert({
      conversa_id:ativa.id,tipo:'enviada',conteudo:texto,
      metadata:{manual:true,remetente:medico?.nome}
    }).select().single()
    if(nova) setMensagens(p=>[...p,nova])
    await fetch('/api/whatsapp/enviar',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({telefone:ativa.telefone,texto,medico_id:medico.id})})
    setEnviando(false)
  }

  const enviarResposta = async(texto:string)=>{
    if(!ativa) return
    const {data:nova}=await supabase.from('whatsapp_mensagens').insert({
      conversa_id:ativa.id,tipo:'enviada',conteudo:texto,
      metadata:{manual:true,remetente:medico?.nome}
    }).select().single()
    if(nova) setMensagens(p=>[...p,nova])
    await fetch('/api/whatsapp/enviar',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({telefone:ativa.telefone,texto,medico_id:medico.id})})
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
    const fOk=filtro==='todas'||(filtro==='nao_lidas'&&c.naoLidas>0)||(filtro==='ia'&&c.modo==='ia')||(filtro==='humano'&&c.modo==='humano')
    return bOk&&fOk
  })

  return (
    <div style={{display:'flex',height:'100vh',width:'100vw',background:'#f0f2f5',overflow:'hidden',fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif'}}>
      <style>{`
        *{box-sizing:border-box}
        ::-webkit-scrollbar{width:6px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:#c1c9cd;border-radius:3px}
        .cv:hover{background:#f5f6f6!important}
        .cv.sel{background:#f0f2f5!important}
        .ibtn:hover{background:rgba(0,0,0,0.06)!important;border-radius:50%}
        .botao-resp:hover{background:#f0fdf4!important}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
      `}</style>

      {/* Sidebar */}
      <div style={{width:56,background:'#f0f2f5',borderRight:'1px solid #d1d7db',display:'flex',flexDirection:'column',alignItems:'center',padding:'12px 0',flexShrink:0}}>
        <div style={{width:38,height:38,borderRadius:'50%',background:'#dfe5e7',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:600,color:'#54656f',cursor:'pointer',marginBottom:20}}>
          {ini(medico?.nome||'M')}
        </div>
        <div title="Chats" className="ibtn" style={{width:40,height:40,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:'#00a884',marginBottom:4}}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
        </div>
        <div title="Status" className="ibtn" style={{width:40,height:40,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:'#54656f',marginBottom:4}}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        </div>
        <div title="Canais" className="ibtn" style={{width:40,height:40,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:'#54656f',marginBottom:4}}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.95 9.5a19.79 19.79 0 01-3.07-8.67A2 2 0 012.88 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L7.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
        </div>
        <div title="Comunidades" className="ibtn" style={{width:40,height:40,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:'#54656f',marginBottom:4}}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
        </div>
        <div style={{flex:1}}/>
        <div title="Configurações" className="ibtn" style={{width:40,height:40,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:'#54656f',marginBottom:4}}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
        </div>
        <div title="Voltar" onClick={()=>router.push('/dashboard')} className="ibtn" style={{width:40,height:40,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:'#54656f'}}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        </div>
      </div>

      {/* Lista */}
      <div style={{width:390,background:'#ffffff',borderRight:'1px solid #d1d7db',display:'flex',flexDirection:'column',flexShrink:0}}>
        <div style={{padding:'13px 16px 10px',display:'flex',alignItems:'center',justifyContent:'space-between',background:'#ffffff',borderBottom:'1px solid #f0f2f5'}}>
          <h1 style={{fontSize:20,fontWeight:600,color:'#00a884',margin:0}}>WhatsApp</h1>
          <div style={{display:'flex',gap:2}}>
            <button onClick={()=>setNovaConversa(v=>!v)} className="ibtn" style={{width:36,height:36,border:'none',background:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#54656f" strokeWidth="1.8"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            </button>
            <button className="ibtn" style={{width:36,height:36,border:'none',background:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="#54656f"><circle cx="12" cy="4" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="20" r="1.8"/></svg>
            </button>
          </div>
        </div>
        <div style={{padding:'8px 12px',background:'#ffffff'}}>
          <div style={{display:'flex',alignItems:'center',gap:8,background:'#f0f2f5',borderRadius:8,padding:'7px 12px'}}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#54656f" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Pesquisar ou começar nova conversa" style={{flex:1,border:'none',outline:'none',background:'transparent',fontSize:14,color:'#111827',fontFamily:'inherit'}}/>
          </div>
        </div>
        <div style={{display:'flex',gap:6,padding:'4px 12px 10px',overflowX:'auto'}}>
          {([{id:'todas',label:'Tudo'},{id:'nao_lidas',label:`Não lidas${total>0?` ${total}`:''}`},{id:'ia',label:'Sofia IA'},{id:'humano',label:'Humano'}] as {id:typeof filtro,label:string}[]).map(f=>(
            <button key={f.id} onClick={()=>setFiltro(f.id)} style={{padding:'5px 14px',fontSize:13,fontWeight:500,borderRadius:20,border:'none',background:filtro===f.id?'#d1f4cc':'#f0f2f5',color:filtro===f.id?'#166534':'#54656f',cursor:'pointer',whiteSpace:'nowrap' as const,flexShrink:0}}>
              {f.label}
            </button>
          ))}
        </div>
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
        <div style={{flex:1,overflowY:'auto'}} onClick={()=>setMenuConversa(null)}>
          {filtradas.length===0?(
            <div style={{padding:'32px 16px',textAlign:'center'}}><p style={{fontSize:13,color:'#667781',margin:0}}>Nenhuma conversa</p></div>
          ):filtradas.map(cv=>(
            <div key={cv.id} className={`cv${ativa?.id===cv.id?' sel':''}`}
              onClick={()=>setAtiva(cv)}
              onContextMenu={e=>{e.preventDefault();setMenuConversa({id:cv.id,x:e.clientX,y:e.clientY})}}
              style={{padding:'8px 16px',cursor:'pointer',background:ativa?.id===cv.id?'#f0f2f5':'white',borderBottom:'1px solid #f0f2f5'}}>
              <div style={{display:'flex',gap:12,alignItems:'center'}}>
                {cv.foto_url?(<img src={cv.foto_url} alt={nomeCv(cv)} style={{width:49,height:49,borderRadius:'50%',objectFit:'cover' as const,flexShrink:0}}/>):(
                  <div style={{width:49,height:49,borderRadius:'50%',background:'#dfe5e7',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,color:'#54656f',flexShrink:0}}>{ini(nomeCv(cv))}</div>
                )}
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:3}}>
                    <p style={{fontSize:15,fontWeight:cv.naoLidas>0?600:400,color:'#111827',margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' as const}}>{nomeCv(cv)}</p>
                    <span style={{fontSize:11,color:cv.naoLidas>0?'#25d366':'#667781',flexShrink:0,marginLeft:8}}>{cv.ultima?fmt(cv.ultima.criado_em):''}</span>
                  </div>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <p style={{fontSize:13,color:'#667781',margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' as const,flex:1}}>
                      {cv.ultima?.tipo==='enviada'&&<svg style={{display:'inline',marginRight:2,verticalAlign:'middle'}} width="14" height="10" viewBox="0 0 16 11" fill="none"><path d="M1 5.5L5 9.5L15 1" stroke="#53bdeb" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M5 5.5L9 9.5L15 1" stroke="#53bdeb" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                      {cv.ultima?.conteudo?.substring(0,40)||''}
                    </p>
                    <div style={{display:'flex',alignItems:'center',gap:4,marginLeft:6,flexShrink:0}}>
                      {cv.modo==='humano'&&<span style={{fontSize:10,color:'#667781',background:'#f0f2f5',padding:'1px 6px',borderRadius:10}}>humano</span>}
                      {cv.naoLidas>0&&<span style={{fontSize:11,fontWeight:600,color:'white',background:'#25d366',minWidth:20,height:20,borderRadius:10,display:'flex',alignItems:'center',justifyContent:'center',padding:'0 5px'}}>{cv.naoLidas}</span>}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Menu contexto */}
      {menuConversa&&(
        <>
          <div style={{position:'fixed',inset:0,zIndex:100}} onClick={()=>setMenuConversa(null)}/>
          <div style={{position:'fixed',left:menuConversa.x,top:menuConversa.y,background:'white',borderRadius:10,boxShadow:'0 8px 32px rgba(0,0,0,0.15)',zIndex:101,minWidth:210,overflow:'hidden',padding:'4px 0'}}>
            {[
              {label:'Arquivar conversa'},
              {label:'Marcar como não lida',fn:async()=>{await supabase.from('whatsapp_mensagens').update({lida:false}).eq('conversa_id',menuConversa.id).eq('tipo','recebida');carregarConversas();setMenuConversa(null)}},
              {label:'Limpar mensagens',fn:async()=>{if(confirm('Limpar mensagens?')){await supabase.from('whatsapp_mensagens').delete().eq('conversa_id',menuConversa.id);if(ativa?.id===menuConversa.id) setMensagens([]);setMenuConversa(null)}}},
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

      {/* Chat */}
      {ativa?(
        <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
          <div style={{background:'#ffffff',borderBottom:'1px solid #f0f2f5',padding:'10px 16px',display:'flex',alignItems:'center',gap:12,flexShrink:0}}>
            {ativa.foto_url?(<img src={ativa.foto_url} alt={nomeCv(ativa)} style={{width:40,height:40,borderRadius:'50%',objectFit:'cover' as const}}/>):(
              <div style={{width:40,height:40,borderRadius:'50%',background:'#dfe5e7',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,color:'#54656f'}}>{ini(nomeCv(ativa))}</div>
            )}
            <div style={{flex:1}}>
              <p style={{fontSize:15,fontWeight:500,color:'#111827',margin:0}}>{nomeCv(ativa)}</p>
              <p style={{fontSize:12,color:'#667781',margin:0}}>{ativa.modo==='humano'?`Atendimento humano${ativa.atendente_nome?' · '+ativa.atendente_nome:''}`:' Sofia IA · online'}</p>
            </div>
            <div style={{display:'flex',gap:4,alignItems:'center'}}>
              {ativa.modo==='ia'?(
                <button onClick={async()=>{await supabase.from('whatsapp_conversas').update({modo:'humano',atendente_nome:medico?.nome}).eq('id',ativa.id);setAtiva({...ativa,modo:'humano',atendente_nome:medico?.nome})}} style={{fontSize:12,color:'white',background:'#00a884',border:'none',padding:'6px 16px',borderRadius:20,cursor:'pointer',fontWeight:500}}>Assumir</button>
              ):(
                <button onClick={async()=>{await supabase.from('whatsapp_conversas').update({modo:'ia',atendente_nome:null}).eq('id',ativa.id);setAtiva({...ativa,modo:'ia',atendente_nome:null})}} style={{fontSize:12,color:'#54656f',background:'#e9edef',border:'none',padding:'6px 16px',borderRadius:20,cursor:'pointer'}}>Devolver à IA</button>
              )}
              {ativa.paciente_id&&<a href={'/pacientes/'+ativa.paciente_id} target="_blank" rel="noreferrer" style={{fontSize:12,color:'#54656f',background:'#e9edef',border:'none',padding:'6px 16px',borderRadius:20,cursor:'pointer',textDecoration:'none'}}>Ver ficha</a>}
              <button className="ibtn" style={{width:36,height:36,border:'none',background:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#54656f" strokeWidth="1.8"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              </button>
              <button className="ibtn" style={{width:36,height:36,border:'none',background:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="#54656f"><circle cx="12" cy="4" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="20" r="1.8"/></svg>
              </button>
            </div>
          </div>
          <div style={{flex:1,overflowY:'auto',padding:'12px 8%',background:'#efeae2'}}>
            {mensagens.map((m,idx)=>{
              const rec=m.tipo==='recebida'
              const isIA=m.metadata?.ia
              const isSistema=m.metadata?.sistema
              const dA=new Date(m.criado_em).toDateString()
              const dB=idx>0?new Date(mensagens[idx-1].criado_em).toDateString():null
              const mostraData=idx===0||dA!==dB
              return (
                <div key={m.id}>
                  {mostraData&&<div style={{textAlign:'center',margin:'12px 0'}}><span style={{fontSize:12,color:'#54656f',background:'rgba(255,255,255,0.85)',padding:'5px 14px',borderRadius:8,boxShadow:'0 1px 2px rgba(0,0,0,0.1)'}}>{fmtData(m.criado_em)}</span></div>}
                  {isSistema?(
                    <div style={{textAlign:'center',margin:'6px 0'}}><span style={{fontSize:12,color:'#54656f',background:'rgba(255,255,255,0.85)',padding:'4px 12px',borderRadius:8}}>{m.conteudo}</span></div>
                  ):(
                    <div style={{display:'flex',flexDirection:'column' as const,alignItems:rec?'flex-start':'flex-end',marginBottom:2}}>
                      <div style={{maxWidth:'65%',padding:'6px 10px 8px',borderRadius:rec?'0 7.5px 7.5px 7.5px':'7.5px 7.5px 0 7.5px',background:rec?'#ffffff':'#d9fdd3',boxShadow:'0 1px 0.5px rgba(0,0,0,0.13)'}}>
                        {!rec&&isIA&&<p style={{fontSize:11,fontWeight:700,color:'#00a884',margin:'0 0 2px',textTransform:'uppercase' as const,letterSpacing:'0.04em'}}>Sofia IA</p>}
                        {!rec&&!isIA&&m.metadata?.remetente&&<p style={{fontSize:11,fontWeight:700,color:'#53bdeb',margin:'0 0 2px'}}>{m.metadata.remetente}</p>}
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
                              style={{padding:'10px 16px',borderRadius:8,border:'1px solid #25d366',background:'white',color:'#128c7e',fontSize:14,cursor:'pointer',textAlign:'center' as const,fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',gap:8,boxShadow:'0 1px 2px rgba(0,0,0,0.1)',transition:'all 0.15s'}}>
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
          <div style={{background:'#f0f2f5',padding:'8px 12px',display:'flex',gap:6,alignItems:'flex-end',flexShrink:0}}>
            <button className="ibtn" style={{width:42,height:42,border:'none',background:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#54656f" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><path d="M8 13s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
            </button>
            <button className="ibtn" style={{width:42,height:42,border:'none',background:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#54656f" strokeWidth="1.8"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
            </button>
            <div style={{flex:1,background:'white',borderRadius:24,padding:'9px 16px',display:'flex',alignItems:'flex-end',boxShadow:'0 1px 2px rgba(0,0,0,0.1)'}}>
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
          <div style={{width:180,height:180,borderRadius:'50%',background:'#f0f2f5',display:'flex',alignItems:'center',justifyContent:'center'}}>
            <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 175.216 175.552" opacity="0.3">
              <path fill="#128c7e" d="M87.184 25.227c-33.733 0-61.166 27.423-61.178 61.13a60.98 60.98 0 0 0 9.349 32.535l1.455 2.313-6.179 22.558 23.146-6.069 2.235 1.324c9.387 5.571 20.15 8.517 31.126 8.523h.023c33.707 0 61.14-27.426 61.153-61.135a60.75 60.75 0 0 0-17.895-43.251 60.75 60.75 0 0 0-43.235-17.928z"/>
            </svg>
          </div>
          <div style={{textAlign:'center'}}>
            <p style={{fontSize:32,fontWeight:300,color:'#41525d',margin:'0 0 8px'}}>MedIA WhatsApp</p>
            <p style={{fontSize:15,color:'#667781',margin:'0 0 4px'}}>Selecione uma conversa para começar</p>
            <p style={{fontSize:13,color:'#aebac1',margin:0}}>{config?`Conectado · ${config.phone_number||config.phone_number_id}`:'⚠ WhatsApp não configurado'}</p>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:6,marginTop:8}}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#aebac1" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            <p style={{fontSize:13,color:'#aebac1',margin:0}}>Criptografia de ponta a ponta</p>
          </div>
        </div>
      )}
    </div>
  )
}
