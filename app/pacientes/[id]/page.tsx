'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Sidebar } from '@/components/Sidebar'

type Aba = 'overview' | 'consultas' | 'agendamentos' | 'prontuario' | 'timeline'

const TIPO_CORES: Record<string, {bg:string;text:string;border:string}> = {
  consulta: {bg:'#F9FAFC',text:'#6043C1',border:'#d4c9f7'},
  retorno:  {bg:'#eff6ff',text:'#2563eb',border:'#bfdbfe'},
  exame:    {bg:'#f5f3ff',text:'#7c3aed',border:'#ddd6fe'},
  urgencia: {bg:'#fef2f2',text:'#dc2626',border:'#fecaca'},
}
const STATUS_CORES: Record<string, {bg:string;text:string}> = {
  agendado:   {bg:'#eff6ff',text:'#2563eb'},
  confirmado: {bg:'#F9FAFC',text:'#6043C1'},
  cancelado:  {bg:'#fef2f2',text:'#dc2626'},
  realizado:  {bg:'#f3f4f6',text:'#6b7280'},
}

export default function PacienteDetalhe() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const [medico, setMedico] = useState<any>(null)
  const [paciente, setPaciente] = useState<any>(null)
  const [consultas, setConsultas] = useState<any[]>([])
  const [transcricoesAbertas, setTranscricoesAbertas] = useState<Set<string>>(new Set())
  const [agendamentos, setAgendamentos] = useState<any[]>([])
  const [aba, setAba] = useState<Aba>('overview')
  const [carregando, setCarregando] = useState(true)
  const [editando, setEditando] = useState(false)
  const [editForm, setEditForm] = useState<any>({})
  const [salvando, setSalvando] = useState(false)
  const [modalAg, setModalAg] = useState(false)
  const [agForm, setAgForm] = useState({data_hora:'',tipo:'consulta',motivo:'',observacoes:''})
  const [salvandoAg, setSalvandoAg] = useState(false)
  const [consultaAberta, setConsultaAberta] = useState<any>(null)
  const [uploadandoFoto, setUploadandoFoto] = useState(false)

  useEffect(() => {
    const m = localStorage.getItem('medico')
    if (!m) { router.push('/login'); return }
    const med = JSON.parse(m); setMedico(med); carregar(med.id)
  }, [id])

  const carregar = async (medicoId: string) => {
    const [pR, cR, aR] = await Promise.all([
      fetch('/api/pacientes/' + id),
      supabase.from('consultas').select('*').eq('medico_id', medicoId).order('criado_em', {ascending:false}),
      fetch('/api/agendamentos?paciente_id=' + id),
    ])
    const pd = await pR.json(); const ad = await aR.json()
    if (pd.paciente) { setPaciente(pd.paciente); setEditForm(pd.paciente) }
    setConsultas(cR.data || []); setAgendamentos(ad.agendamentos || [])
    setCarregando(false)
  }

  const salvarPaciente = async () => {
    setSalvando(true)
    const r = await fetch('/api/pacientes/' + id, {method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(editForm)})
    const d = await r.json()
    if (d.paciente) { setPaciente(d.paciente); setEditando(false) }
    setSalvando(false)
  }

  const salvarAg = async (e: React.FormEvent) => {
    e.preventDefault(); setSalvandoAg(true)
    const r = await fetch('/api/agendamentos', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...agForm,paciente_id:id,medico_id:medico.id,status:'agendado'})})
    const d = await r.json()
    if (d.agendamento) {
      setAgendamentos(prev => [...prev, d.agendamento].sort((a,b) => new Date(a.data_hora).getTime()-new Date(b.data_hora).getTime()))
      setModalAg(false); setAgForm({data_hora:'',tipo:'consulta',motivo:'',observacoes:''})
    }
    setSalvandoAg(false)
  }

  const atualizarAg = async (agId: string, status: string) => {
    const r = await fetch('/api/agendamentos', {method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:agId,status})})
    const d = await r.json()
    if (d.agendamento) setAgendamentos(prev => prev.map(a => a.id===agId ? d.agendamento : a))
  }

  const deletarAg = async (agId: string) => {
    if (!confirm('Deletar agendamento?')) return
    await fetch('/api/agendamentos?id='+agId, {method:'DELETE'})
    setAgendamentos(prev => prev.filter(a => a.id!==agId))
  }

  const calcIdade = (nasc: string) => {
    if (!nasc) return null
    const h = new Date(); const d = new Date(nasc); let i = h.getFullYear()-d.getFullYear()
    if (h.getMonth()<d.getMonth()||(h.getMonth()===d.getMonth()&&h.getDate()<d.getDate())) i--
    return i
  }

  const fmt = (s: string) => new Date(s).toLocaleDateString('pt-BR',{day:'2-digit',month:'short',year:'numeric'})
  const fmtH = (s: string) => new Date(s).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})
  const uploadFoto = async (file: File) => {
    if (!file || !paciente) return
    setUploadandoFoto(true)
<<<<<<< Updated upstream
    const reader = new FileReader()
    reader.onload = async (e) => {
      const base64 = e.target?.result as string
      await fetch('/api/pacientes/' + id, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ foto_url: base64 }) })
      setPaciente((p: any) => ({ ...p, foto_url: base64 }))
      if (paciente.telefone) {
        await supabase.from('whatsapp_conversas').update({ foto_url: base64 }).or(`telefone.eq.${paciente.telefone.replace(/\D/g,'')},telefone.eq.+${paciente.telefone.replace(/\D/g,'')},telefone.eq.55${paciente.telefone.replace(/\D/g,'')}`)
      }
      setUploadandoFoto(false)
    }
    reader.readAsDataURL(file)
=======
    try {
      const reader = new FileReader()
      reader.onload = async (e) => {
        const base64 = e.target?.result as string
        // Salva como data URL no campo foto_url do paciente
        const res = await fetch('/api/pacientes/' + id, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ foto_url: base64 })
        })
        const data = await res.json()
        if (data.paciente) {
          setPaciente((p: any) => ({ ...p, foto_url: base64 }))
          // Sincroniza com whatsapp_conversas se o paciente tem telefone
          if (paciente.telefone) {
            await supabase.from('whatsapp_conversas')
              .update({ foto_url: base64 })
              .eq('telefone', paciente.telefone.replace(/\D/g, ''))
          }
        }
      }
      reader.readAsDataURL(file)
    } finally {
      setUploadandoFoto(false)
    }
  }

        }
      }
      reader.readAsDataURL(file)
    } finally {
      setUploadandoFoto(false)
    }
  }

        }
      }
      reader.readAsDataURL(file)
    } finally {
      setUploadandoFoto(false)
    }
>>>>>>> Stashed changes
  }

  const fmtF = (s: string) => new Date(s).toLocaleDateString('pt-BR',{weekday:'short',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})

  const ini = paciente?.nome?.split(' ').map((n:string)=>n[0]).slice(0,2).join('').toUpperCase()||'?'
  const idadePac = calcIdade(paciente?.data_nascimento)
  const prox = agendamentos.find(a=>a.status==='agendado'&&new Date(a.data_hora)>new Date())

  const secoes = [
    {key:'subjetivo',letra:'S',titulo:'Subjetivo',cor:'#2563eb',bg:'#eff6ff',border:'#bfdbfe'},
    {key:'objetivo', letra:'O',titulo:'Objetivo', cor:'#0d9488',bg:'#f0fdfa',border:'#99f6e4'},
    {key:'avaliacao',letra:'A',titulo:'Avaliacao',cor:'#7c3aed',bg:'#f5f3ff',border:'#ddd6fe'},
    {key:'plano',    letra:'P',titulo:'Plano',    cor:'#6043C1',bg:'#F9FAFC',border:'#d4c9f7'},
  ]

  return (
    <div style={{display:'flex',height:'100vh',background:'#f9fafb',overflow:'hidden'}}>
      <Sidebar />
      <main style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
        {carregando ? (
          <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center'}}>
            <div style={{width:40,height:40,borderRadius:'50%',border:'3px solid #ede9fb',borderTopColor:'#6043C1',animation:'spin 0.8s linear infinite'}}/>
          </div>
        ) : (<>
          <div style={{background: 'transparent',borderBottom: 'none',padding:'0 28px',height:64,display:'flex',alignItems:'center',gap:16,flexShrink:0}}>
            <button onClick={()=>router.push('/pacientes')} style={{background:'none',border:'none',cursor:'pointer',color:'#6b7280',display:'flex',alignItems:'center',gap:6,fontSize:13}}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
              Pacientes
            </button>
            <span style={{color:'#d1d5db'}}>/</span>
            <div style={{display:'flex',alignItems:'center',gap:10,flex:1}}>
<<<<<<< Updated upstream
              <div style={{position:'relative',cursor:'pointer'}} onClick={()=>(document.getElementById('foto-hdr') as HTMLInputElement)?.click()} title="Trocar foto">
                {paciente?.foto_url?<img src={paciente.foto_url} style={{width:36,height:36,borderRadius:'50%',objectFit:'cover',border:'2px solid #d4c9f7'}}/>:<div style={{width:36,height:36,borderRadius:'50%',background:'#F9FAFC',border:'2px solid #d4c9f7',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:700,color:'#6043C1'}}>{ini}</div>}
              </div>
              <input id="foto-hdr" type="file" accept="image/*" style={{display:'none'}} onChange={e=>e.target.files?.[0]&&uploadFoto(e.target.files[0])}/>
=======
              <div style={{position:'relative',cursor:'pointer'}} onClick={()=>document.getElementById('foto-input-header')?.click()} title="Clique para trocar foto">
                {paciente?.foto_url
                  ? <img src={paciente.foto_url} alt={paciente.nome} style={{width:36,height:36,borderRadius:'50%',objectFit:'cover',border:'2px solid #d4c9f7'}}/>
                  : <div style={{width:36,height:36,borderRadius:'50%',background:'#F9FAFC',border:'2px solid #d4c9f7',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:700,color:'#6043C1'}}>{ini}</div>}
                {uploadandoFoto&&<div style={{position:'absolute',inset:0,background:'rgba(255,255,255,0.7)',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center'}}><div style={{width:14,height:14,border:'2px solid #6043C1',borderTopColor:'transparent',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/></div>}
              </div>
              <input id="foto-input-header" type="file" accept="image/*" style={{display:'none'}} onChange={e=>e.target.files?.[0]&&uploadFoto(e.target.files[0])}/>
>>>>>>> Stashed changes
              <div>
                <p style={{fontSize:15,fontWeight:700,color:'#111827',margin:0}}>{paciente?.nome}</p>
                <p style={{fontSize:11,color:'#9ca3af',margin:0}}>{[paciente?.sexo,idadePac?idadePac+' anos':null].filter(Boolean).join(' · ')}</p>
              </div>
            </div>
            <div style={{display:'flex',gap:8}}>
              <button onClick={()=>setModalAg(true)} style={{display:'flex',alignItems:'center',gap:7,padding:'8px 16px',borderRadius:8,border:'1px solid #d4c9f7',background:'#F9FAFC',color:'#6043C1',fontSize:13,fontWeight:600,cursor:'pointer'}}>Agendar</button>
              <a href="/consulta" style={{display:'flex',alignItems:'center',gap:7,padding:'8px 16px',borderRadius:8,border:'none',background:'#6043C1',color:'white',fontSize:13,fontWeight:600,textDecoration:'none'}}>Nova consulta</a>
            </div>
          </div>
          <div style={{background: 'transparent',borderBottom: 'none',padding:'0 28px',display:'flex',flexShrink:0}}>
            {([{id:'overview',label:'Visão geral'},{id:'consultas',label:'Consultas ('+consultas.length+')'},{id:'agendamentos',label:'Agenda ('+agendamentos.filter(a=>a.status!=='cancelado').length+')'},{id:'prontuario',label:'Prontuário'},{id:'timeline',label:'Linha do tempo'}] as {id:Aba;label:string}[]).map(tab=>(
              <button key={tab.id} onClick={()=>setAba(tab.id)} style={{padding:'14px 16px',background:'transparent',border:'none',cursor:'pointer',fontSize:13,fontWeight:aba===tab.id?600:400,color:aba===tab.id?'#111827':'#6b7280',borderBottom:aba===tab.id?'2px solid #6043C1':'2px solid transparent',marginBottom:-1}}>{tab.label}</button>
            ))}
          </div>
          <div style={{flex:1,overflow:'auto',padding:28}}>
            {aba==='overview'&&(
              <div style={{display:'grid',gridTemplateColumns:'300px 1fr',gap:20,maxWidth:1100}}>
                <div style={{display:'flex',flexDirection:'column',gap:14}}>
                  <div style={{background:'white',boxShadow: '0 1px 4px rgba(0,0,0,0.07)',borderRadius:14,overflow:'hidden'}}>
                    <div style={{background:'linear-gradient(135deg,#ede9fb,#ede9fb)',padding:'24px 20px',textAlign:'center',borderBottom: 'none'}}>
<<<<<<< Updated upstream
                      <div style={{position:'relative',cursor:'pointer',width:64,height:64,margin:'0 auto 12px'}} onClick={()=>(document.getElementById('foto-card') as HTMLInputElement)?.click()} title="Trocar foto">
                        {paciente?.foto_url?<img src={paciente.foto_url} style={{width:64,height:64,borderRadius:'50%',objectFit:'cover',border:'3px solid #d4c9f7'}}/>:<div style={{width:64,height:64,borderRadius:'50%',background:'white',border:'3px solid #d4c9f7',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,fontWeight:800,color:'#6043C1'}}>{ini}</div>}
=======
                      <div style={{position:'relative',cursor:'pointer',width:64,height:64,margin:'0 auto 12px'}} onClick={()=>document.getElementById('foto-input-card')?.click()} title="Clique para trocar foto">
                        {paciente?.foto_url
                          ? <img src={paciente.foto_url} alt={paciente.nome} style={{width:64,height:64,borderRadius:'50%',objectFit:'cover',border:'3px solid #d4c9f7'}}/>
                          : <div style={{width:64,height:64,borderRadius:'50%',background:'white',border:'3px solid #d4c9f7',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,fontWeight:800,color:'#6043C1'}}>{ini}</div>}
>>>>>>> Stashed changes
                        <div style={{position:'absolute',bottom:0,right:0,width:20,height:20,background:'#6043C1',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',border:'2px solid white'}}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
                        </div>
                        {uploadandoFoto&&<div style={{position:'absolute',inset:0,background:'rgba(255,255,255,0.7)',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center'}}><div style={{width:18,height:18,border:'2px solid #6043C1',borderTopColor:'transparent',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/></div>}
                      </div>
<<<<<<< Updated upstream
                      <input id="foto-card" type="file" accept="image/*" style={{display:'none'}} onChange={e=>e.target.files?.[0]&&uploadFoto(e.target.files[0])}/>
=======
                      <input id="foto-input-card" type="file" accept="image/*" style={{display:'none'}} onChange={e=>e.target.files?.[0]&&uploadFoto(e.target.files[0])}/>
>>>>>>> Stashed changes
                      <h2 style={{fontSize:16,fontWeight:700,color:'#111827',margin:'0 0 4px'}}>{paciente?.nome}</h2>
                      <p style={{fontSize:12,color:'#6b7280',margin:0}}>{[paciente?.sexo,idadePac?idadePac+' anos':null].filter(Boolean).join(' · ')}</p>
                      {prox&&<div style={{marginTop:12,background:'#eff6ff',border:'1px solid #bfdbfe',borderRadius:8,padding:'6px 12px'}}><p style={{fontSize:11,color:'#2563eb',margin:0}}>Prox: {fmt(prox.data_hora)} {fmtH(prox.data_hora)}</p></div>}
                    </div>
                    <div style={{padding:'16px 20px'}}>
                      <div style={{display:'flex',justifyContent:'space-between',marginBottom:12}}>
                        <p style={{fontSize:11,fontWeight:700,color:'#9ca3af',textTransform:'uppercase',letterSpacing:'0.06em',margin:0}}>Dados pessoais</p>
                        <button onClick={()=>setEditando(!editando)} style={{fontSize:11,color:'#6043C1',background:'none',border:'none',cursor:'pointer',fontWeight:600}}>{editando?'Cancelar':'Editar'}</button>
                      </div>
                      {editando?(
                        <div style={{display:'flex',flexDirection:'column',gap:9}}>
                          {['nome','cpf','telefone','email','endereco','convenio','nr_carteirinha'].map(k=>(
                            <div key={k}>
                              <label style={{fontSize:11,fontWeight:600,color:'#6b7280',display:'block',marginBottom:3,textTransform:'capitalize'}}>{k}</label>
                              <input value={editForm[k]||''} onChange={e=>setEditForm((p:any)=>({...p,[k]:e.target.value}))} style={{width:'100%',padding:'7px 10px',fontSize:12,borderRadius:7,boxShadow: '0 1px 4px rgba(0,0,0,0.07)'}}/>
                            </div>
                          ))}
                          {['alergias','comorbidades','medicamentos_uso'].map(k=>(
                            <div key={k}>
                              <label style={{fontSize:11,fontWeight:600,color:'#6b7280',display:'block',marginBottom:3,textTransform:'capitalize'}}>{k.replace('_',' ')}</label>
                              <textarea value={editForm[k]||''} onChange={e=>setEditForm((p:any)=>({...p,[k]:e.target.value}))} style={{width:'100%',padding:'7px 10px',fontSize:12,borderRadius:7,boxShadow: '0 1px 4px rgba(0,0,0,0.07)',minHeight:52,resize:'vertical'}}/>
                            </div>
                          ))}
                          <button onClick={salvarPaciente} disabled={salvando} style={{padding:'9px',borderRadius:8,border:'none',background:'#6043C1',color:'white',fontSize:13,fontWeight:600,cursor:'pointer'}}>{salvando?'Salvando...':'Salvar'}</button>
                        </div>
                      ):(
                        <div style={{display:'flex',flexDirection:'column',gap:9}}>
                          {[{l:'CPF',v:paciente?.cpf},{l:'Tel',v:paciente?.telefone},{l:'Email',v:paciente?.email},{l:'Endereco',v:paciente?.endereco},{l:'Convenio',v:paciente?.convenio},{l:'Carteirinha',v:paciente?.nr_carteirinha}].filter(f=>f.v).map(f=>(
                            <div key={f.l} style={{display:'flex',justifyContent:'space-between'}}>
                              <span style={{fontSize:12,color:'#9ca3af'}}>{f.l}</span>
                              <span style={{fontSize:12,color:'#374151',fontWeight:500}}>{f.v}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  {(paciente?.alergias||paciente?.comorbidades||paciente?.medicamentos_uso)&&!editando&&(
                    <div style={{background: '#F9FAFC',boxShadow: '0 1px 4px rgba(0,0,0,0.07)',borderRadius:14,padding:'16px 20px',display:'flex',flexDirection:'column',gap:10}}>
                      {paciente.alergias&&<div style={{background:'#fef2f2',border:'1px solid #fecaca',borderRadius:8,padding:'10px 12px'}}><p style={{fontSize:10,fontWeight:700,color:'#dc2626',margin:'0 0 3px',textTransform:'uppercase'}}>Alergias</p><p style={{fontSize:12,color:'#b91c1c',margin:0}}>{paciente.alergias}</p></div>}
                      {paciente.comorbidades&&<div style={{background:'#fffbeb',border:'1px solid #fde68a',borderRadius:8,padding:'10px 12px'}}><p style={{fontSize:10,fontWeight:700,color:'#d97706',margin:'0 0 3px',textTransform:'uppercase'}}>Comorbidades</p><p style={{fontSize:12,color:'#92400e',margin:0}}>{paciente.comorbidades}</p></div>}
                      {paciente.medicamentos_uso&&<div style={{background:'#F9FAFC',border:'1px solid #d4c9f7',borderRadius:8,padding:'10px 12px'}}><p style={{fontSize:10,fontWeight:700,color:'#6043C1',margin:'0 0 3px',textTransform:'uppercase'}}>Medicamentos</p><p style={{fontSize:12,color:'#6043C1',margin:0}}>{paciente.medicamentos_uso}</p></div>}
                    </div>
                  )}
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:14}}>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12}}>
                    {[{l:'Consultas',v:String(consultas.length),c:'#2563eb'},{l:'Agendamentos',v:String(agendamentos.filter(a=>a.status!=='cancelado').length),c:'#6043C1'},{l:'Proximo',v:prox?fmt(prox.data_hora):'Nao agendado',c:'#7c3aed'}].map(m=>(
                      <div key={m.l} style={{background: '#F9FAFC',boxShadow: '0 1px 4px rgba(0,0,0,0.07)',borderRadius:12,padding:'16px 18px'}}>
                        <p style={{fontSize:22,fontWeight:800,color:m.c,margin:'0 0 4px'}}>{m.v}</p>
                        <p style={{fontSize:12,color:'#9ca3af',margin:0}}>{m.l}</p>
                      </div>
                    ))}
                  </div>
                  <div style={{background:'white',boxShadow: '0 1px 4px rgba(0,0,0,0.07)',borderRadius:14,overflow:'hidden'}}>
                    <div style={{padding:'14px 20px',borderBottom: 'none',display:'flex',justifyContent:'space-between'}}>
                      <p style={{fontSize:13,fontWeight:700,color:'#111827',margin:0}}>Últimas consultas</p>
                      <button onClick={()=>setAba('consultas')} style={{fontSize:12,color:'#6043C1',background:'none',border:'none',cursor:'pointer',fontWeight:600}}>Ver todas</button>
                    </div>
                    {consultas.length===0?<div style={{padding:24,textAlign:'center'}}><p style={{fontSize:13,color:'#9ca3af',margin:0}}>Nenhuma consulta</p></div>
                    :consultas.slice(0,4).map(c=>(
                      <div key={c.id} onClick={()=>{setConsultaAberta(c);setAba('consultas')}} style={{padding:'12px 20px',borderBottom:'1px solid #f9fafb',cursor:'pointer'}}>
                        <p style={{fontSize:11,color:'#9ca3af',margin:'0 0 3px'}}>{fmt(c.criado_em)}</p>
                        <p style={{fontSize:12,color:'#374151',margin:0}}>{(c.subjetivo||'').substring(0,80)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {aba==='consultas'&&(
              <div style={{display:'grid',gridTemplateColumns:'300px 1fr',gap:20,maxWidth:1100}}>
                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  {consultas.length===0?<div style={{background:'white',boxShadow: '0 1px 4px rgba(0,0,0,0.07)',borderRadius:12,padding:24,textAlign:'center'}}><p style={{fontSize:13,color:'#9ca3af',margin:0}}>Nenhuma consulta</p></div>
                  :consultas.map(c=>(
                    <div key={c.id} onClick={()=>setConsultaAberta(consultaAberta?.id===c.id?null:c)} style={{background: '#F9FAFC',border:'1px solid '+(consultaAberta?.id===c.id?'#d4c9f7':'#e5e7eb'),borderRadius:12,padding:'12px 16px',cursor:'pointer'}}>
                      <p style={{fontSize:11,color:'#9ca3af',margin:'0 0 4px'}}>{fmt(c.criado_em)}</p>
                      <p style={{fontSize:12,color:'#374151',margin:'0 0 7px'}}>{(c.subjetivo||'').substring(0,90)}</p>
                      <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>{(c.cids||[]).map((cid:any)=><span key={cid.codigo} style={{fontSize:10,color:'#6043C1',background:'#F9FAFC',padding:'1px 6px',borderRadius:4,fontFamily:'monospace',fontWeight:700,border:'1px solid #d4c9f7'}}>{cid.codigo}</span>)}</div>
                    </div>
                  ))}
                </div>
                <div>
                  {consultaAberta?(
                    <div style={{background:'white',boxShadow: '0 1px 4px rgba(0,0,0,0.07)',borderRadius:14}}>
                      <div style={{padding:'14px 20px',borderBottom: 'none'}}><p style={{fontSize:14,fontWeight:700,color:'#111827',margin:0}}>{fmtF(consultaAberta.criado_em)}</p></div>
                      <div style={{padding:20}}>
                        {secoes.map(s=>(
                          <div key={s.key} style={{background:s.bg,border:'1px solid '+s.border,borderRadius:10,padding:'12px 14px',marginBottom:10}}>
                            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
                              <div style={{width:22,height:22,borderRadius:6,background:s.cor,display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:800,color:'white'}}>{s.letra}</div>
                              <p style={{fontSize:12,fontWeight:700,color:'#111827',margin:0}}>{s.titulo}</p>
                            </div>
                            <p style={{fontSize:12,color:'#374151',margin:0,lineHeight:1.7,paddingLeft:30}}>{consultaAberta[s.key]||'--'}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ):<div style={{background:'white',border:'1px dashed #e5e7eb',borderRadius:14,padding:40,textAlign:'center'}}><p style={{fontSize:13,color:'#9ca3af',margin:0}}>Selecione uma consulta</p></div>}
                </div>
              </div>
            )}
            {aba==='agendamentos'&&(
              <div style={{maxWidth:800}}>
                <div style={{display:'flex',justifyContent:'flex-end',marginBottom:16}}>
                  <button onClick={()=>setModalAg(true)} style={{padding:'8px 16px',borderRadius:8,border:'none',background:'#6043C1',color:'white',fontSize:13,fontWeight:600,cursor:'pointer'}}>+ Novo agendamento</button>
                </div>
                {agendamentos.length===0?(
                  <div style={{background:'white',border:'1px dashed #e5e7eb',borderRadius:14,padding:40,textAlign:'center'}}>
                    <p style={{fontSize:14,fontWeight:600,color:'#374151',margin:'0 0 12px'}}>Nenhum agendamento</p>
                    <button onClick={()=>setModalAg(true)} style={{padding:'8px 20px',borderRadius:8,border:'none',background:'#6043C1',color:'white',fontSize:13,fontWeight:600,cursor:'pointer'}}>Agendar agora</button>
                  </div>
                ):(
                  <div style={{display:'flex',flexDirection:'column',gap:10}}>
                    {agendamentos.map(ag=>{
                      const tc=TIPO_CORES[ag.tipo]||TIPO_CORES.consulta
                      const sc=STATUS_CORES[ag.status]||STATUS_CORES.agendado
                      const passado=new Date(ag.data_hora)<new Date()
                      return(
                        <div key={ag.id} style={{background: '#F9FAFC',boxShadow: '0 1px 4px rgba(0,0,0,0.07)',borderRadius:12,padding:'16px 20px',display:'flex',gap:16,opacity:ag.status==='cancelado'?0.5:1}}>
                          <div style={{background:tc.bg,border:'1px solid '+tc.border,borderRadius:10,padding:'8px 12px',textAlign:'center',flexShrink:0,minWidth:56}}>
                            <p style={{fontSize:18,fontWeight:800,color:tc.text,margin:0,lineHeight:1}}>{new Date(ag.data_hora).getDate()}</p>
                            <p style={{fontSize:10,color:tc.text,margin:0,textTransform:'uppercase'}}>{new Date(ag.data_hora).toLocaleDateString('pt-BR',{month:'short'})}</p>
                            <p style={{fontSize:11,color:tc.text,margin:0}}>{fmtH(ag.data_hora)}</p>
                          </div>
                          <div style={{flex:1}}>
                            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                              <p style={{fontSize:14,fontWeight:700,color:'#111827',margin:0}}>{ag.motivo||'Consulta'}</p>
                              <span style={{fontSize:10,background:tc.bg,color:tc.text,padding:'1px 7px',borderRadius:20,border:'1px solid '+tc.border,fontWeight:600}}>{ag.tipo}</span>
                              <span style={{fontSize:10,background:sc.bg,color:sc.text,padding:'1px 7px',borderRadius:20,fontWeight:600}}>{ag.status}</span>
                            </div>
                            {ag.observacoes&&<p style={{fontSize:12,color:'#6b7280',margin:'0 0 8px'}}>{ag.observacoes}</p>}
                            <div style={{display:'flex',gap:8}}>
                              {!passado&&ag.status==='agendado'&&<>
                                <button onClick={()=>atualizarAg(ag.id,'confirmado')} style={{fontSize:11,color:'#6043C1',background:'#F9FAFC',border:'1px solid #d4c9f7',padding:'3px 10px',borderRadius:6,cursor:'pointer',fontWeight:600}}>Confirmar</button>
                                <button onClick={()=>atualizarAg(ag.id,'cancelado')} style={{fontSize:11,color:'#dc2626',background:'#fef2f2',border:'1px solid #fecaca',padding:'3px 10px',borderRadius:6,cursor:'pointer',fontWeight:600}}>Cancelar</button>
                              </>}
                              {passado&&ag.status!=='realizado'&&ag.status!=='cancelado'&&(
                                <button onClick={()=>atualizarAg(ag.id,'realizado')} style={{fontSize:11,color:'#6b7280',background:'#f3f4f6',boxShadow: '0 1px 4px rgba(0,0,0,0.07)',padding:'3px 10px',borderRadius:6,cursor:'pointer',fontWeight:600}}>Marcar realizado</button>
                              )}
                            </div>
                          </div>
                          <button onClick={()=>deletarAg(ag.id)} style={{background:'none',border:'none',cursor:'pointer',color:'#d1d5db'}}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
            {aba==='prontuario'&&(
              <div style={{maxWidth:800}}>
                <div style={{background:'white',boxShadow: '0 1px 4px rgba(0,0,0,0.07)',borderRadius:14,padding:'20px 24px',marginBottom:20}}>
                  <h2 style={{fontSize:15,fontWeight:700,color:'#111827',margin:'0 0 14px'}}>Resumo clinico</h2>
                  {(paciente?.alergias||paciente?.comorbidades||paciente?.medicamentos_uso)?(
                    <div style={{display:'flex',flexDirection:'column',gap:10}}>
                      {paciente.alergias&&<div style={{background:'#fef2f2',border:'1px solid #fecaca',borderRadius:8,padding:'10px 14px'}}><p style={{fontSize:10,fontWeight:700,color:'#dc2626',margin:'0 0 3px',textTransform:'uppercase'}}>Alergias</p><p style={{fontSize:13,color:'#b91c1c',margin:0}}>{paciente.alergias}</p></div>}
                      {paciente.comorbidades&&<div style={{background:'#fffbeb',border:'1px solid #fde68a',borderRadius:8,padding:'10px 14px'}}><p style={{fontSize:10,fontWeight:700,color:'#d97706',margin:'0 0 3px',textTransform:'uppercase'}}>Comorbidades</p><p style={{fontSize:13,color:'#92400e',margin:0}}>{paciente.comorbidades}</p></div>}
                      {paciente.medicamentos_uso&&<div style={{background:'#F9FAFC',border:'1px solid #d4c9f7',borderRadius:8,padding:'10px 14px'}}><p style={{fontSize:10,fontWeight:700,color:'#6043C1',margin:'0 0 3px',textTransform:'uppercase'}}>Medicamentos</p><p style={{fontSize:13,color:'#6043C1',margin:0}}>{paciente.medicamentos_uso}</p></div>}
                    </div>
                  ):<p style={{fontSize:13,color:'#9ca3af',margin:0}}>Nenhum dado clinico preenchido.</p>}
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:14}}>
                  {consultas.map((c,idx)=>(
                    <div key={c.id} style={{background:'white',boxShadow: '0 1px 4px rgba(0,0,0,0.07)',borderRadius:12,overflow:'hidden'}}>
                      <div style={{padding:'10px 18px',background: 'transparent',borderBottom: 'none',display:'flex',justifyContent:'space-between'}}>
                        <p style={{fontSize:13,fontWeight:600,color:'#374151',margin:0}}>#{consultas.length-idx} {fmtF(c.criado_em)}</p>
                            {c.transcricao && <span style={{fontSize:9,fontWeight:700,color:'#1d4ed8',background:'#eff6ff',border:'1px solid #bfdbfe',padding:'2px 7px',borderRadius:10}}>📹 Teleconsulta</span>}
                        <div style={{display:'flex',gap:4}}>{(c.cids||[]).map((cid:any)=><span key={cid.codigo} style={{fontSize:10,color:'#6043C1',background:'#F9FAFC',padding:'1px 6px',borderRadius:4,fontFamily:'monospace',fontWeight:700,border:'1px solid #d4c9f7'}}>{cid.codigo}</span>)}</div>
                      </div>
                      <div style={{padding:'14px 18px',display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                        {secoes.map(s=>(
                          <div key={s.key} style={{background:s.bg,border:'1px solid '+s.border,borderRadius:8,padding:'10px 12px'}}>
                            <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:5}}>
                              <div style={{width:20,height:20,borderRadius:5,background:s.cor,display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:800,color:'white'}}>{s.letra}</div>
                              <p style={{fontSize:11,fontWeight:700,color:'#374151',margin:0}}>{s.titulo}</p>
                            </div>
                            <p style={{fontSize:11,color:'#374151',margin:0,lineHeight:1.6,paddingLeft:27}}>{c[s.key]||'--'}</p>
                          </div>
                        ))}
                      </div>
                      {/* Receita */}
                      {c.receita && (
                        <div style={{padding:'10px 18px',borderTop:'1px solid #f3f4f6'}}>
                          <p style={{fontSize:11,fontWeight:700,color:'#374151',textTransform:'uppercase' as const,letterSpacing:'0.05em',margin:'0 0 6px'}}>Receita / Prescricao</p>
                          <p style={{fontSize:11,color:'#6b7280',margin:0,lineHeight:1.6,whiteSpace:'pre-wrap' as const}}>{c.receita}</p>
                        </div>
                      )}
                      {/* Transcrição colapsavel */}
                      {c.transcricao && (
                        <div style={{padding:'8px 18px',borderTop:'1px solid #f3f4f6'}}>
                          <button onClick={() => {
                            const s = new Set(transcricoesAbertas)
                            s.has(c.id) ? s.delete(c.id) : s.add(c.id)
                            setTranscricoesAbertas(s)
                          }} style={{display:'flex',alignItems:'center',gap:5,background:'none',border:'none',cursor:'pointer',padding:0}}>
                            <span style={{fontSize:11,fontWeight:600,color:'#374151'}}>📝 Transcrição</span>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" style={{transform:transcricoesAbertas.has(c.id)?'rotate(180deg)':'none',transition:'transform 0.2s'}}><polyline points="6 9 12 15 18 9"/></svg>
                          </button>
                          {transcricoesAbertas.has(c.id) && (
                            <div style={{marginTop:6,background:'#f8fafc',borderRadius:7,padding:'8px 10px',fontSize:11,color:'#475569',lineHeight:1.7,maxHeight:160,overflow:'auto',whiteSpace:'pre-wrap' as const}}>
                              {c.transcricao}
                            </div>
                          )}
                        </div>
                      )}
                      {/* Botoes */}
                      <div style={{padding:'8px 18px 12px',borderTop:'1px solid #f3f4f6',display:'flex',gap:8}}>
                        <a href={'/api/pdf-prontuario?consulta_id='+c.id+'&medico_id='+medico?.id} target="_blank" rel="noreferrer"
                          style={{display:'flex',alignItems:'center',gap:4,padding:'5px 10px',borderRadius:6,border:'1px solid #d4c9f7',background:'#f0ebff',color:'#6043C1',fontSize:12,fontWeight:600,textDecoration:'none'}}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>
                          PDF Prontuário
                        </a>
                        <a href={'/api/pdf-receita?consulta_id='+c.id+'&medico_id='+medico?.id} target="_blank" rel="noreferrer"
                          style={{fontSize:11,color:'#1d4ed8',background:'#eff6ff',border:'1px solid #bfdbfe',padding:'5px 10px',borderRadius:6,textDecoration:'none',display:'inline-flex',alignItems:'center',gap:4}}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                          PDF Receita
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
}
              {aba==='timeline'&&(
                <div style={{maxWidth:800}}>
                  <div style={{marginBottom:20}}>
                    <h2 style={{fontSize:15,fontWeight:700,color:'#111827',margin:'0 0 4px'}}>Linha do tempo clínica</h2>
                    <p style={{fontSize:12,color:'#9ca3af',margin:0}}>{consultas.length} consulta{consultas.length!==1?'s':''} registrada{consultas.length!==1?'s':''}</p>
                  </div>
                  {consultas.length===0?(
                    <div style={{textAlign:'center',padding:'40px 20px',background:'white',borderRadius:14,border:'1px solid #f0f0f0'}}>
                      <p style={{fontSize:13,color:'#9ca3af',margin:0}}>Nenhuma consulta registrada ainda</p>
                    </div>
                  ):(
                    <div style={{position:'relative'}}>
                      <div style={{position:'absolute',left:19,top:0,bottom:0,width:2,background:'#e5e7eb'}}/>
                      <div style={{display:'flex',flexDirection:'column',gap:0}}>
                        {consultas.map((c:any,i:number)=>{
                          const cids = c.cids||[]
                          const alertas = c.alertas||[]
                          const data = new Date(c.criado_em)
                          const dataFmt = data.toLocaleDateString('pt-BR',{day:'2-digit',month:'short',year:'numeric'})
                          const hora = data.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})
                          const isUltima = i===0
                          return (
                            <div key={c.id} style={{display:'flex',gap:16,paddingBottom:24,position:'relative'}}>
                              <div style={{flexShrink:0,zIndex:1}}>
                                <div style={{width:40,height:40,borderRadius:'50%',background:isUltima?'#6043C1':'white',border:isUltima?'none':'2px solid #d4c9f7',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,color:isUltima?'white':'#6043C1'}}>
                                  {consultas.length-i}
                                </div>
                              </div>
                              <div style={{flex:1,background:'white',borderRadius:12,border:'1px solid #f0f0f0',padding:'14px 16px',boxShadow:'0 1px 3px rgba(0,0,0,0.06)'}}>
                                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
                                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                                    <span style={{fontSize:13,fontWeight:700,color:'#111827'}}>{dataFmt}</span>
                                    <span style={{fontSize:11,color:'#9ca3af'}}>{hora}</span>
                                    {isUltima&&<span style={{fontSize:10,fontWeight:700,color:'#6043C1',background:'#f0ebff',padding:'2px 8px',borderRadius:10,border:'1px solid #d4c9f7'}}>mais recente</span>}
                                  </div>
                                  <div style={{display:'flex',gap:6}}>
                                    <a href={'/api/pdf-prontuario?consulta_id='+c.id+'&medico_id='+medico?.id} target="_blank" rel="noreferrer" style={{fontSize:11,color:'#6043C1',background:'#f0ebff',padding:'4px 10px',borderRadius:6,textDecoration:'none',fontWeight:600}}>PDF</a>
                                  </div>
                                </div>
                                {alertas.length>0&&(
                                  <div style={{background:'#fef2f2',border:'1px solid #fecaca',borderRadius:8,padding:'6px 10px',marginBottom:10,display:'flex',alignItems:'flex-start',gap:6}}>
                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" style={{flexShrink:0,marginTop:1}}><path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
                                    <p style={{fontSize:11,color:'#b91c1c',margin:0,lineHeight:1.4}}>{alertas.join(' · ')}</p>
                                  </div>
                                )}
                                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:cids.length>0?10:0}}>
                                  {c.subjetivo&&(
                                    <div>
                                      <p style={{fontSize:10,fontWeight:700,color:'#9ca3af',textTransform:'uppercase',letterSpacing:'0.06em',margin:'0 0 3px'}}>Subjetivo</p>
                                      <p style={{fontSize:12,color:'#374151',margin:0,lineHeight:1.5}}>{(c.subjetivo||'').substring(0,120)}{c.subjetivo?.length>120?'...':''}</p>
                                    </div>
                                  )}
                                  {c.avaliacao&&(
                                    <div>
                                      <p style={{fontSize:10,fontWeight:700,color:'#9ca3af',textTransform:'uppercase',letterSpacing:'0.06em',margin:'0 0 3px'}}>Avaliação</p>
                                      <p style={{fontSize:12,color:'#374151',margin:0,lineHeight:1.5}}>{(c.avaliacao||'').substring(0,120)}{c.avaliacao?.length>120?'...':''}</p>
                                    </div>
                                  )}
                                </div>
                                {cids.length>0&&(
                                  <div style={{display:'flex',gap:6,flexWrap:'wrap',marginTop:8}}>
                                    {cids.map((cid:any,j:number)=>(
                                      <span key={j} style={{fontSize:10,fontWeight:700,color:'#6043C1',background:'#f0ebff',padding:'2px 8px',borderRadius:10,border:'1px solid #d4c9f7',fontFamily:'monospace'}}>{cid.codigo}</span>
                                    ))}
                                  </div>
                                )}
                                {i>0&&consultas[i-1]&&(
                                  <div style={{marginTop:10,paddingTop:10,borderTop:'1px solid #f9fafb'}}>
                                    <p style={{fontSize:10,color:'#9ca3af',margin:'0 0 3px',fontStyle:'italic'}}>vs consulta anterior ({new Date(consultas[i-1].criado_em).toLocaleDateString('pt-BR',{day:'2-digit',month:'short'})})</p>
                                    {c.subjetivo&&consultas[i-1].subjetivo&&c.subjetivo.substring(0,50)===consultas[i-1].subjetivo.substring(0,50)&&(
                                      <p style={{fontSize:11,color:'#d97706',margin:0}}>↻ Queixa similar à consulta anterior</p>
                                    )}
                                    {cids.length>0&&consultas[i-1].cids?.some((prev:any)=>cids.find((cur:any)=>cur.codigo===prev.codigo))&&(
                                      <p style={{fontSize:11,color:'#dc2626',margin:0}}>⚠ CID recorrente detectado</p>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
          </div>
        </>)}
      </main>
      {modalAg&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:50,padding:24}}>
          <div style={{background:'white',borderRadius:16,width:'100%',maxWidth:440,padding:28,boxShadow:'0 20px 60px rgba(0,0,0,0.15)'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20}}>
              <h3 style={{fontSize:16,fontWeight:700,color:'#111827',margin:0}}>Agendar consulta</h3>
              <button onClick={()=>setModalAg(false)} style={{background:'none',border:'none',cursor:'pointer',color:'#9ca3af',fontSize:18,lineHeight:1}}>x</button>
            </div>
            <div style={{background:'#F9FAFC',border:'1px solid #d4c9f7',borderRadius:10,padding:'10px 14px',marginBottom:18}}>
              <p style={{fontSize:13,fontWeight:600,color:'#6043C1',margin:'0 0 2px'}}>{paciente?.nome}</p>
              <p style={{fontSize:11,color:'#6b7280',margin:0}}>{[paciente?.sexo,idadePac?idadePac+' anos':null].filter(Boolean).join(' · ')}</p>
            </div>
            <form onSubmit={salvarAg} style={{display:'flex',flexDirection:'column',gap:14}}>
              <div>
                <label style={{fontSize:12,fontWeight:600,color:'#374151',display:'block',marginBottom:6}}>Data e hora</label>
                <input type="datetime-local" required value={agForm.data_hora} onChange={e=>setAgForm(f=>({...f,data_hora:e.target.value}))} style={{width:'100%',padding:'10px 12px',fontSize:13,borderRadius:8,border:'1.5px solid #e5e7eb'}}/>
              </div>
              <div>
                <label style={{fontSize:12,fontWeight:600,color:'#374151',display:'block',marginBottom:6}}>Tipo</label>
                <select value={agForm.tipo} onChange={e=>setAgForm(f=>({...f,tipo:e.target.value}))} style={{width:'100%',padding:'10px 12px',fontSize:13,borderRadius:8,border:'1.5px solid #e5e7eb'}}>
                  <option value="consulta">Consulta</option>
                  <option value="retorno">Retorno</option>
                  <option value="exame">Exame</option>
                  <option value="urgencia">Urgencia</option>
                </select>
              </div>
              <div>
                <label style={{fontSize:12,fontWeight:600,color:'#374151',display:'block',marginBottom:6}}>Motivo</label>
                <input value={agForm.motivo} onChange={e=>setAgForm(f=>({...f,motivo:e.target.value}))} style={{width:'100%',padding:'10px 12px',fontSize:13,borderRadius:8,border:'1.5px solid #e5e7eb'}} placeholder="Cefaleia, retorno..."/>
              </div>
              <div>
                <label style={{fontSize:12,fontWeight:600,color:'#374151',display:'block',marginBottom:6}}>Observacoes</label>
                <textarea value={agForm.observacoes} onChange={e=>setAgForm(f=>({...f,observacoes:e.target.value}))} style={{width:'100%',padding:'10px 12px',fontSize:13,borderRadius:8,border:'1.5px solid #e5e7eb',minHeight:64,resize:'vertical'}}/>
              </div>
              <button type="submit" disabled={salvandoAg} style={{padding:'12px',borderRadius:9,border:'none',background:'#6043C1',color:'white',fontSize:14,fontWeight:700,cursor:'pointer'}}>{salvandoAg?'Salvando...':'Confirmar agendamento'}</button>
            </form>
          </div>
        </div>
      )}
      <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
    </div>
  )
}
