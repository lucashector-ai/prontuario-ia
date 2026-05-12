'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { HipotesesCard } from '@/components/HipotesesCard'
import { supabase } from '@/lib/supabase'
import { Sidebar } from '@/components/Sidebar'
import { MemedPrescricao } from '@/components/MemedPrescricao'
import { BotaoMemed } from '@/components/BotaoMemed'
import { tokens } from '@/lib/design-tokens'

type Aba = 'overview' | 'consultas' | 'agendamentos' | 'prontuario' | 'timeline' | 'financeiro'

const TIPO_CORES: Record<string, {bg:string;text:string;border:string}> = {
  consulta: {bg:tokens.bg.hover,text:tokens.brand.primary,border:tokens.brand.primaryAccent},
  retorno:  {bg:tokens.status.infoBg,text:tokens.status.infoStrong,border:tokens.status.infoLight},
  exame:    {bg:tokens.appointment.exame.bg,text:tokens.appointment.retorno.dot,border:tokens.appointment.exame.border},
  urgencia: {bg:tokens.status.dangerBg,text:tokens.status.danger,border:tokens.status.dangerLight},
}
const STATUS_CORES: Record<string, {bg:string;text:string}> = {
  agendado:   {bg:tokens.status.infoBg,text:tokens.status.infoStrong},
  confirmado: {bg:tokens.bg.hover,text:tokens.brand.primary},
  cancelado:  {bg:tokens.status.dangerBg,text:tokens.status.danger},
  realizado:  {bg:tokens.bg.hoverStrong,text:tokens.text.secondary},
}

export default function PacienteDetalhe() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const [medico, setMedico] = useState<any>(null)
  const [paciente, setPaciente] = useState<any>(null)
  const [prescricoes, setPrescricoes] = useState<any[]>([])
  const [carregandoPresc, setCarregandoPresc] = useState(false)
  const [memedAberto, setMemedAberto] = useState(false)
  const [medicoLogado, setMedicoLogado] = useState<any>(null)

  useEffect(() => {
    (async () => {
      const ca = localStorage.getItem('clinica_admin')
      if (ca) {
        // Logado como admin: pega primeiro médico ativo da clínica pra Memed
        const admin = JSON.parse(ca)
        if (admin.clinica_id) {
          const { data: primMed } = await supabase
            .from('medicos').select('*')
            .eq('clinica_id', admin.clinica_id).eq('cargo', 'medico').eq('ativo', true)
            .order('criado_em').limit(1).maybeSingle()
          if (primMed) { setMedicoLogado(primMed); return }
        }
      }
      const m = localStorage.getItem('medico')
      if (m) setMedicoLogado(JSON.parse(m))
    })()
  }, [])

  useEffect(() => {
    if (paciente?.id) carregarPrescricoes()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paciente?.id])

  useEffect(() => {
    if (paciente?.id) carregarComandas()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paciente?.id])

  const carregarPrescricoes = async () => {
    if (!paciente?.id) return
    setCarregandoPresc(true)
    try {
      const r = await fetch('/api/prescricoes?paciente_id=' + paciente.id)
      const d = await r.json()
      setPrescricoes(d.prescricoes || [])
    } catch (e) { console.error(e) }
    finally { setCarregandoPresc(false) }
  }

  const carregarComandas = async () => {
    if (!paciente?.id) return
    setCarregandoComandas(true)
    try {
      const r = await fetch('/api/comandas?paciente_id=' + paciente.id)
      const d = await r.json()
      setComandasPaciente(d.comandas || [])
    } catch (e) { console.error(e) }
    finally { setCarregandoComandas(false) }
  }

  async function criarNovaComanda() {
    if (!paciente?.id) return
    try {
      const r = await fetch('/api/comandas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paciente_id: paciente.id,
          medico_id: paciente.medico_id || null,
          clinica_id: paciente.clinica_id || null,
        }),
      })
      const d = await r.json()
      if (d.error) { alert('Erro: ' + d.error); return }
      if (d.comanda?.id) {
        router.push('/comandas/' + d.comanda.id)
      }
    } catch (e: any) {
      alert('Erro ao criar comanda: ' + (e?.message || ''))
    }
  }

  const [consultas, setConsultas] = useState<any[]>([])
  const [transcricoesAbertas, setTranscricoesAbertas] = useState<Set<string>>(new Set())
  const [agendamentos, setAgendamentos] = useState<any[]>([])
  const [aba, setAba] = useState<Aba>('overview')
  const [comandasPaciente, setComandasPaciente] = useState<any[]>([])
  const [carregandoComandas, setCarregandoComandas] = useState(false)
  const [carregando, setCarregando] = useState(true)
  const [mapaMedicos, setMapaMedicos] = useState<Record<string, { nome: string; cor: string }>>({})
  const [editando, setEditando] = useState(false)
  const [editForm, setEditForm] = useState<any>({})
  const [salvando, setSalvando] = useState(false)
  const [modalAg, setModalAg] = useState(false)
  const [agForm, setAgForm] = useState({data_hora:'',tipo:'consulta',motivo:'',observacoes:''})
  const [salvandoAg, setSalvandoAg] = useState(false)
  const [consultaAberta, setConsultaAberta] = useState<any>(null)
  const [uploadandoFoto, setUploadandoFoto] = useState(false)

  useEffect(() => {
    const ca_ = localStorage.getItem('clinica_admin')
    const m = ca_ || localStorage.getItem('medico')
    if (!m) { router.push('/login'); return }
    const med = JSON.parse(m); setMedico(med); carregar(med.id)
  }, [id])

  const carregar = async (medicoId: string) => {
    // Se for clinica admin, busca de todos os medicos da clinica
    const caStr = localStorage.getItem('clinica_admin')
    let medicoIds = [medicoId]
    if (caStr) {
      const admin = JSON.parse(caStr)
      if (admin.clinica_id) {
        const { data: meds } = await supabase.from('medicos').select('id, nome, cor').eq('clinica_id', admin.clinica_id).eq('cargo', 'medico').eq('ativo', true)
        if (meds && meds.length > 0) {
          medicoIds = meds.map((m: any) => m.id)
          const mapa: Record<string, { nome: string, cor: string }> = {}
          meds.forEach((m: any) => { mapa[m.id] = { nome: m.nome, cor: m.cor || tokens.brand.primary } })
          setMapaMedicos(mapa)
        }
      }
    }

    const [pR, cR, aR] = await Promise.all([
      fetch('/api/pacientes/' + id),
      supabase.from('consultas').select('*').in('medico_id', medicoIds).order('criado_em', {ascending:false}),
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
  }

  const fmtF = (s: string) => new Date(s).toLocaleDateString('pt-BR',{weekday:'short',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})

  const ini = paciente?.nome?.split(' ').map((n:string)=>n[0]).slice(0,2).join('').toUpperCase()||'?'
  const idadePac = calcIdade(paciente?.data_nascimento)
  const prox = (() => {
    // Inicio do dia atual
    const inicioHoje = new Date(); inicioHoje.setHours(0, 0, 0, 0)
    // Aceita agendado ou confirmado, e data >= hoje (inclui hoje mesmo se passou da hora)
    const futuros = agendamentos
      .filter(a => (a.status === 'agendado' || a.status === 'confirmado') && new Date(a.data_hora) >= inicioHoje)
      .sort((a, b) => new Date(a.data_hora).getTime() - new Date(b.data_hora).getTime())
    return futuros[0] || null
  })()

  const secoes = [
    {key:'subjetivo',letra:'S',titulo:'Subjetivo',cor:tokens.status.infoStrong,bg:tokens.status.infoBg,border:tokens.status.infoLight},
    {key:'objetivo', letra:'O',titulo:'Objetivo', cor:tokens.status.infoTeal,bg:tokens.status.infoTealBg,border:tokens.status.infoTealLight},
    {key:'avaliacao',letra:'A',titulo:'Avaliacao',cor:tokens.appointment.retorno.dot,bg:tokens.appointment.exame.bg,border:tokens.appointment.exame.border},
    {key:'plano',    letra:'P',titulo:'Plano',    cor:tokens.brand.primary,bg:tokens.bg.hover,border:tokens.brand.primaryAccent},
  ]

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100vh',background:tokens.bg.page,overflow:'hidden'}}>
      <main style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
        {carregando ? (
          <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center'}}>
            <div style={{width:40,height:40,borderRadius:'50%',border:`3px solid ${tokens.brand.primaryLighter}`,borderTopColor:tokens.brand.primary,animation:'spin 0.8s linear infinite'}}/>
          </div>
        ) : (<>
          <div style={{background:'white',borderRadius:16,padding:'14px 20px',margin:'24px 24px 0',display:'flex',alignItems:'center',gap:16,flexShrink:0}}>
            <button onClick={()=>router.push('/pacientes')} style={{background:'none',border:'none',cursor:'pointer',color:tokens.text.secondary,display:'flex',alignItems:'center',gap:6,fontSize:13}}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
              Pacientes
            </button>
            <span style={{color:tokens.border.strong}}>/</span>
            <div style={{display:'flex',alignItems:'center',gap:10,flex:1}}>
              <div style={{position:'relative',cursor:'pointer'}} onClick={()=>(document.getElementById('foto-hdr') as HTMLInputElement)?.click()} title="Trocar foto">
                {paciente?.foto_url?<img src={paciente.foto_url} style={{width:36,height:36,borderRadius:'50%',objectFit:'cover',border:`2px solid ${tokens.brand.primaryAccent}`}}/>:<div style={{width:36,height:36,borderRadius:'50%',background:tokens.bg.hover,border:`2px solid ${tokens.brand.primaryAccent}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:700,color:tokens.brand.primary}}>{ini}</div>}
              </div>
              <input id="foto-hdr" type="file" accept="image/*" style={{display:'none'}} onChange={e=>e.target.files?.[0]&&uploadFoto(e.target.files[0])}/>
              <div>
                <p style={{fontSize:15,fontWeight:700,color:tokens.text.primary,margin:0}}>{paciente?.nome}</p>
                <p style={{fontSize:11,color:tokens.text.tertiary,margin:0}}>{[paciente?.sexo,idadePac?idadePac+' anos':null].filter(Boolean).join(' · ')}</p>
              </div>
            </div>
            <div style={{display:'flex',gap:8}}>
              <BotaoMemed onClick={()=>setMemedAberto(true)} variant="primary" />
              <button onClick={()=>setModalAg(true)} style={{display:'flex',alignItems:'center',gap:7,padding:'8px 16px',borderRadius:8,background:tokens.bg.hover,color:tokens.brand.primary,fontSize:13,fontWeight:600,cursor:'pointer'}}>Agendar</button>
              <a href="/consulta" style={{display:'flex',alignItems:'center',gap:7,padding:'8px 16px',borderRadius:8,border:'none',background:tokens.brand.primary,color:'white',fontSize:13,fontWeight:600,textDecoration:'none'}}>Nova consulta</a>
            </div>
          </div>
          <div style={{background:'white',borderRadius:16,padding:'0 16px',margin:'12px 24px 0',display:'flex',flexShrink:0,gap:4}}>
            {([{id:'overview',label:'Visão geral'},{id:'consultas',label:'Consultas ('+consultas.length+')'},{id:'agendamentos',label:'Agenda ('+agendamentos.filter(a=>a.status!=='cancelado').length+')'},{id:'prontuario',label:'Prontuário'},{id:'timeline',label:'Linha do tempo'}] as {id:Aba;label:string}[]).map(tab=>(
              <button key={tab.id} onClick={()=>setAba(tab.id)} style={{padding:'14px 16px',background:'transparent',border:'none',cursor:'pointer',fontSize:13,fontWeight:aba===tab.id?600:400,color:aba===tab.id?tokens.text.primary:tokens.text.secondary,borderBottom:aba===tab.id?`2px solid ${tokens.brand.primary}`:'2px solid transparent',marginBottom:-1}}>{tab.label}</button>
            ))}
          </div>
          <div style={{flex:1,overflow:'auto',padding:'20px 24px 24px'}}>
            {aba==='overview'&&(
              <div style={{display:'grid',gridTemplateColumns:'320px 1fr',gap:20}}>
                <div style={{display:'flex',flexDirection:'column',gap:14}}>
                  <div style={{background:'white',borderRadius:16,overflow:'hidden'}}>
                    <div style={{background:`linear-gradient(135deg,${tokens.brand.primaryLighter},${tokens.brand.primaryLighter})`,padding:'24px 20px',textAlign:'center',borderBottom: 'none'}}>
                      <div style={{position:'relative',cursor:'pointer',width:64,height:64,margin:'0 auto 12px'}} onClick={()=>(document.getElementById('foto-card') as HTMLInputElement)?.click()} title="Trocar foto">
                        {paciente?.foto_url?<img src={paciente.foto_url} style={{width:64,height:64,borderRadius:'50%',objectFit:'cover',border:`3px solid ${tokens.brand.primaryAccent}`}}/>:<div style={{width:64,height:64,borderRadius:'50%',background:'white',border:`3px solid ${tokens.brand.primaryAccent}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,fontWeight:800,color:tokens.brand.primary}}>{ini}</div>}
                        <div style={{position:'absolute',bottom:0,right:0,width:20,height:20,background:tokens.brand.primary,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',border:'2px solid white'}}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
                        </div>
                        {uploadandoFoto&&<div style={{position:'absolute',inset:0,background:'rgba(255,255,255,0.7)',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center'}}><div style={{width:18,height:18,border:`2px solid ${tokens.brand.primary}`,borderTopColor:'transparent',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/></div>}
                      </div>
                      <input id="foto-card" type="file" accept="image/*" style={{display:'none'}} onChange={e=>e.target.files?.[0]&&uploadFoto(e.target.files[0])}/>
                      <h2 style={{fontSize:16,fontWeight:700,color:tokens.text.primary,margin:'0 0 4px'}}>{paciente?.nome}</h2>
                      <p style={{fontSize:12,color:tokens.text.secondary,margin:0}}>{[paciente?.sexo,idadePac?idadePac+' anos':null].filter(Boolean).join(' · ')}</p>
                      {prox&&<div style={{marginTop:12,background:tokens.status.infoBg,border:`1px solid ${tokens.status.infoLight}`,borderRadius:8,padding:'6px 12px'}}><p style={{fontSize:11,color:tokens.status.infoStrong,margin:0}}>Próx: {fmt(prox.data_hora)} {fmtH(prox.data_hora)}</p></div>}
                    </div>
                    <div style={{padding:'16px 20px'}}>
                      <div style={{display:'flex',justifyContent:'space-between',marginBottom:12}}>
                        <p style={{fontSize:11,fontWeight:700,color:tokens.text.tertiary,textTransform:'uppercase',letterSpacing:'0.06em',margin:0}}>Dados pessoais</p>
                        <button onClick={()=>setEditando(!editando)} style={{fontSize:11,color:tokens.brand.primary,background:'none',border:'none',cursor:'pointer',fontWeight:600}}>{editando?'Cancelar':'Editar'}</button>
                      </div>
                      {editando?(
                        <div style={{display:'flex',flexDirection:'column',gap:9}}>
                          {['nome','cpf','telefone','email','endereco','convenio','nr_carteirinha'].map(k=>(
                            <div key={k}>
                              <label style={{fontSize:11,fontWeight:600,color:tokens.text.secondary,display:'block',marginBottom:3,textTransform:'capitalize'}}>{k}</label>
                              <input value={editForm[k]||''} onChange={e=>setEditForm((p:any)=>({...p,[k]:e.target.value}))} style={{width:'100%',padding:'7px 10px',fontSize:12,borderRadius:7}}/>
                            </div>
                          ))}
                          {['alergias','comorbidades','medicamentos_uso'].map(k=>(
                            <div key={k}>
                              <label style={{fontSize:11,fontWeight:600,color:tokens.text.secondary,display:'block',marginBottom:3,textTransform:'capitalize'}}>{k.replace('_',' ')}</label>
                              <textarea value={editForm[k]||''} onChange={e=>setEditForm((p:any)=>({...p,[k]:e.target.value}))} style={{width:'100%',padding:'7px 10px',fontSize:12,borderRadius:7,minHeight:52,resize:'vertical'}}/>
                            </div>
                          ))}
                          <button onClick={salvarPaciente} disabled={salvando} style={{padding:'9px',borderRadius:8,border:'none',background:tokens.brand.primary,color:'white',fontSize:13,fontWeight:600,cursor:'pointer'}}>{salvando?'Salvando...':'Salvar'}</button>
                        </div>
                      ):(
                        <div style={{display:'flex',flexDirection:'column',gap:9}}>
                          {[{l:'CPF',v:paciente?.cpf},{l:'Tel',v:paciente?.telefone},{l:'Email',v:paciente?.email},{l:'Endereco',v:paciente?.endereco},{l:'Convenio',v:paciente?.convenio},{l:'Carteirinha',v:paciente?.nr_carteirinha}].filter(f=>f.v).map(f=>(
                            <div key={f.l} style={{display:'flex',justifyContent:'space-between'}}>
                              <span style={{fontSize:12,color:tokens.text.tertiary}}>{f.l}</span>
                              <span style={{fontSize:12,color:tokens.text.strong,fontWeight:500}}>{f.v}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  {(paciente?.alergias||paciente?.comorbidades||paciente?.medicamentos_uso)&&!editando&&(
                    <div style={{background:'white',borderRadius:16,padding:'16px 20px',display:'flex',flexDirection:'column',gap:10}}>
                      {paciente.alergias&&<div style={{background:tokens.status.dangerBg,border:`1px solid ${tokens.status.dangerLight}`,borderRadius:8,padding:'10px 12px'}}><p style={{fontSize:10,fontWeight:700,color:tokens.status.danger,margin:'0 0 3px',textTransform:'uppercase'}}>Alergias</p><p style={{fontSize:12,color:tokens.status.dangerHover,margin:0}}>{paciente.alergias}</p></div>}
                      {paciente.comorbidades&&<div style={{background:tokens.status.warningBgAlt,border:`1px solid ${tokens.status.warningLightAlt}`,borderRadius:8,padding:'10px 12px'}}><p style={{fontSize:10,fontWeight:700,color:tokens.status.warningAlt,margin:'0 0 3px',textTransform:'uppercase'}}>Comorbidades</p><p style={{fontSize:12,color:tokens.status.warningText,margin:0}}>{paciente.comorbidades}</p></div>}
                      {paciente.medicamentos_uso&&<div style={{background:tokens.bg.hover,borderRadius:8,padding:'10px 12px'}}><p style={{fontSize:10,fontWeight:700,color:tokens.brand.primary,margin:'0 0 3px',textTransform:'uppercase'}}>Medicamentos</p><p style={{fontSize:12,color:tokens.brand.primary,margin:0}}>{paciente.medicamentos_uso}</p></div>}
                    </div>
                  )}
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:14}}>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12}}>
                    {[{l:'Consultas',v:String(consultas.length),c:tokens.status.infoStrong},{l:'Agendamentos',v:String(agendamentos.filter(a=>a.status!=='cancelado').length),c:tokens.brand.primary},{l:'Próximo',v:prox?fmt(prox.data_hora):'Não agendado',c:tokens.appointment.retorno.dot}].map(m=>(
                      <div key={m.l} style={{background:'white',borderRadius:16,padding:'18px 20px'}}>
                        <p style={{fontSize:22,fontWeight:800,color:m.c,margin:'0 0 4px'}}>{m.v}</p>
                        <p style={{fontSize:12,color:tokens.text.tertiary,margin:0}}>{m.l}</p>
                      </div>
                    ))}
                  </div>
                  <div style={{background:'white',borderRadius:16,overflow:'hidden'}}>
                    <div style={{padding:'14px 20px',borderBottom: 'none',display:'flex',justifyContent:'space-between'}}>
                      <p style={{fontSize:13,fontWeight:700,color:tokens.text.primary,margin:0}}>Últimas consultas</p>
                      <button onClick={()=>setAba('consultas')} style={{fontSize:12,color:tokens.brand.primary,background:'none',border:'none',cursor:'pointer',fontWeight:600}}>Ver todas</button>
                    </div>
                    {consultas.length===0?<div style={{padding:'60px 24px',textAlign:'center'}}><p style={{fontSize:13,color:tokens.text.tertiary,margin:0}}>Nenhuma consulta registrada ainda</p></div>
                    :consultas.slice(0,4).map(c=>(
                      <div key={c.id} onClick={()=>{setConsultaAberta(c);setAba('consultas')}} style={{padding:'12px 20px',borderBottom:`1px solid ${tokens.bg.hover}`,cursor:'pointer'}}>
                        <p style={{fontSize:11,color:tokens.text.tertiary,margin:'0 0 3px'}}>{fmt(c.criado_em)}</p>
                        <p style={{fontSize:12,color:tokens.text.strong,margin:0}}>{(c.subjetivo||'').substring(0,80)}</p>
                      </div>
                    ))}
                  </div>

                  {/* Prescricoes Memed */}
                  {prescricoes.length > 0 && (
                    <div style={{background:'white',borderRadius:16,overflow:'hidden',marginTop:12}}>
                      <div style={{padding:'14px 20px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                        <p style={{fontSize:13,fontWeight:700,color:tokens.text.primary,margin:0}}>Prescrições Memed</p>
                        <span style={{fontSize:11,color:tokens.text.tertiary}}>{prescricoes.length} {prescricoes.length === 1 ? 'prescrição' : 'prescrições'}</span>
                      </div>
                      {prescricoes.slice(0, 5).map((p: any) => {
                        const data = new Date(p.criado_em)
                        const dataFmt = data.toLocaleDateString('pt-BR') + ' às ' + data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                        const meds = p.dados_memed?.prescricao?.medicamentos || []
                        const idCurto = p.prescricao_id_memed ? String(p.prescricao_id_memed).substring(0, 8) : p.id.substring(0, 8)
                        const medicoNome = p.dados_memed?.prescricao?.medico?.nome_medico || p.medicos?.nome || ''
                        const crm = p.dados_memed?.prescricao?.medico?.board?.board_number
                        const uf = p.dados_memed?.prescricao?.medico?.board?.board_state
                        const crmFmt = crm && uf ? `CRM/${uf} ${crm}` : ''
                        return (
                          <div key={p.id} style={{padding:'14px 20px',borderTop:`1px solid ${tokens.bg.hover}`}}>
                            <div style={{display:'flex',alignItems:'flex-start',gap:12,marginBottom:meds.length>0?10:0}}>
                              <div style={{width:32,height:32,borderRadius:8,background:tokens.brand.primaryLight,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,marginTop:2}}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={tokens.brand.primary} strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="15" x2="15" y2="15"/><line x1="9" y1="11" x2="15" y2="11"/></svg>
                              </div>
                              <div style={{flex:1,minWidth:0}}>
                                <p style={{fontSize:12,fontWeight:600,color:tokens.text.primary,margin:'0 0 3px'}}>Prescrição #{idCurto}</p>
                                <p style={{fontSize:11,color:tokens.text.tertiary,margin:0}}>{dataFmt}{medicoNome ? ' · ' + medicoNome : ''}{crmFmt ? ' · ' + crmFmt : ''}</p>
                              </div>
                              <span style={{fontSize:10,fontWeight:600,color:tokens.brand.primary,background:tokens.brand.primaryLight,padding:'3px 8px',borderRadius:100,flexShrink:0}}>
                                {meds.length} {meds.length === 1 ? 'item' : 'itens'}
                              </span>
                            </div>
                            {meds.length > 0 && (
                              <div style={{paddingLeft:44,display:'flex',flexDirection:'column' as const,gap:6}}>
                                {meds.slice(0, 4).map((m: any, idx: number) => (
                                  <div key={idx} style={{padding:'8px 12px',background:tokens.bg.page,borderRadius:8,fontSize:12}}>
                                    <p style={{margin:0,fontWeight:600,color:tokens.neutral[700]}}>{m.nome || m.descricao || 'Medicamento'}</p>
                                    {m.sanitized_posology && (
                                      <p style={{margin:'2px 0 0',fontSize:11,color:tokens.text.quaternary,lineHeight:1.4}}>{m.sanitized_posology}</p>
                                    )}
                                  </div>
                                ))}
                                {meds.length > 4 && (
                                  <p style={{fontSize:11,color:tokens.text.tertiary,margin:'2px 0 0',paddingLeft:4}}>+ {meds.length - 4} {meds.length - 4 === 1 ? 'medicamento' : 'medicamentos'}</p>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
            {aba==='consultas'&&(
              <div style={{display:'grid',gridTemplateColumns:'320px 1fr',gap:20}}>
                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  {consultas.length===0?<div style={{background:'white',borderRadius:16,padding:'60px 24px',textAlign:'center',minHeight:200}}><p style={{fontSize:14,fontWeight:600,color:tokens.text.strong,margin:'0 0 6px'}}>Nenhuma consulta ainda</p><p style={{fontSize:12,color:tokens.text.tertiary,margin:0}}>Inicie uma nova consulta pra registrar</p></div>
                  :consultas.map(c=>{
                    const ativa = consultaAberta?.id===c.id
                    const ehTele = !!(c.meet_link || c.sala_id)
                    const medInfo = mapaMedicos[c.medico_id]
                    const nomeMed = medInfo?.nome || ''
                    const corMed = medInfo?.cor || tokens.brand.primary
                    const primNome = nomeMed.split(' ')[0] || ''
                    return (
                    <div key={c.id} onClick={()=>setConsultaAberta(ativa?null:c)} style={{background:'white',border:'1.5px solid '+(ativa?tokens.brand.primary:'transparent'),borderRadius:12,padding:'14px 16px',cursor:'pointer'}}>
                      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6,gap:8}}>
                        <p style={{fontSize:12,fontWeight:700,color:ativa?tokens.brand.primary:tokens.text.strong,margin:0}}>{fmt(c.criado_em)} · {fmtH ? fmtH(c.criado_em) : new Date(c.criado_em).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</p>
                        <span style={{fontSize:9,fontWeight:700,color:ehTele?tokens.status.infoStrong:tokens.brand.primary,background:ehTele?tokens.status.infoBg:tokens.brand.primaryLighter,padding:'2px 7px',borderRadius:10,textTransform:'uppercase' as const,letterSpacing:'0.04em'}}>{ehTele?'Tele':'Consulta'}</span>
                      </div>
                      {primNome && (<div style={{display:'inline-flex' as const,alignItems:'center',gap:5,marginBottom:6}}><span style={{width:7,height:7,borderRadius:'50%',background:corMed,flexShrink:0}}/><span style={{fontSize:10,color:tokens.text.secondary,fontWeight:500}}>Dr(a). {primNome}</span></div>)}
                      <p style={{fontSize:12,color:tokens.text.strong,margin:'0 0 7px',lineHeight:1.5}}>{(c.subjetivo||'').substring(0,90)}{(c.subjetivo||'').length>90?'...':''}</p>
                      <div style={{display:'flex',gap:4,flexWrap:'wrap' as const}}>{(c.cids||[]).map((cid:any)=><span key={cid.codigo} style={{fontSize:10,color:tokens.brand.primary,background:tokens.brand.primaryLighter,padding:'1px 6px',borderRadius:4,fontFamily:'monospace' as const,fontWeight:700}}>{cid.codigo}</span>)}</div>
                    </div>
                    )
                  })}
                </div>
                <div>
                  {consultaAberta?(
                    <div style={{background:'white',borderRadius:16}}>
                      <div style={{padding:'18px 22px',borderBottom:`1px solid ${tokens.bg.hoverStrong}`,display:'flex',alignItems:'center',justifyContent:'space-between',gap:16,flexWrap:'wrap' as const}}>
                        <div>
                          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:4,flexWrap:'wrap' as const}}>
                            <p style={{fontSize:15,fontWeight:700,color:tokens.text.primary,margin:0,textTransform:'capitalize' as const}}>{fmtF(consultaAberta.criado_em)}</p>
                            <span style={{fontSize:10,fontWeight:700,color:(consultaAberta.meet_link||consultaAberta.sala_id)?tokens.status.infoStrong:tokens.brand.primary,background:(consultaAberta.meet_link||consultaAberta.sala_id)?tokens.status.infoBg:tokens.brand.primaryLighter,padding:'3px 10px',borderRadius:20,textTransform:'uppercase' as const,letterSpacing:'0.04em'}}>{(consultaAberta.meet_link||consultaAberta.sala_id)?'Teleconsulta':'Consulta'}</span>
                          </div>
                          {mapaMedicos[consultaAberta.medico_id] && (
                            <p style={{fontSize:12,color:tokens.text.secondary,margin:0,display:'flex',alignItems:'center',gap:6}}>
                              <span style={{width:10,height:10,borderRadius:'50%',background:mapaMedicos[consultaAberta.medico_id].cor,flexShrink:0}}/>
                              Dr(a). {mapaMedicos[consultaAberta.medico_id].nome}
                            </p>
                          )}
                        </div>
                        <div style={{display:'flex',gap:8}}>
<button onClick={()=>window.open('/api/pdf-prontuario?consulta_id='+consultaAberta.id+'&medico_id='+(consultaAberta.medico_id||''),'_blank')} title="Baixar PDF" style={{padding:'8px 12px',borderRadius:9,background:'white',color:tokens.text.strong,border:`1px solid ${tokens.border.default}`,fontSize:12,fontWeight:500,cursor:'pointer',display:'inline-flex',alignItems:'center',gap:5}}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                            PDF
                          </button>
                        </div>
                      </div>
                      <div style={{padding:20,display:'flex',flexDirection:'column' as const,gap:12}}>
                        {secoes.map(s=>(
                          <div key={s.key} style={{background:'white',borderRadius:16,overflow:'hidden' as const,border:`1px solid ${tokens.bg.hoverStrong}`}}>
                            <div style={{display:'flex',alignItems:'center',gap:10,padding:'14px 20px',background:s.bg}}>
                              <div style={{width:26,height:26,borderRadius:7,background:'white',color:s.cor,display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:700}}>{s.letra}</div>
                              <span style={{fontSize:12,fontWeight:700,textTransform:'uppercase' as const,letterSpacing:'0.06em',color:s.cor}}>{s.titulo}</span>
                            </div>
                            <div style={{padding:20}}>
                              <p style={{fontSize:14,color:tokens.text.primary,margin:0,lineHeight:1.7,whiteSpace:'pre-wrap' as const}}>
                                {consultaAberta[s.key] || <span style={{color:tokens.text.tertiary,fontStyle:'italic' as const}}>—</span>}
                              </p>
                            </div>
                          </div>
                        ))}

                        <HipotesesCard hipoteses={consultaAberta.hipoteses} />

                        {consultaAberta.cids && consultaAberta.cids.length > 0 && (
                          <div style={{background:'white',borderRadius:16,padding:20,border:`1px solid ${tokens.bg.hoverStrong}`}}>
                            <p style={{fontSize:11,fontWeight:700,color:tokens.text.secondary,margin:'0 0 12px',letterSpacing:'0.06em',textTransform:'uppercase' as const}}>CID-10 Sugeridos</p>
                            <div style={{display:'flex',gap:8,flexWrap:'wrap' as const}}>
                              {consultaAberta.cids.map((cid:any,i:number)=>(
                                <div key={i} style={{display:'flex',alignItems:'center',gap:8,background:tokens.bg.muted,borderRadius:10,padding:'8px 12px'}}>
                                  <span style={{fontFamily:'monospace' as const,fontSize:12,fontWeight:700,color:tokens.brand.primary,background:tokens.brand.primaryLighter,padding:'3px 8px',borderRadius:6}}>{cid.codigo}</span>
                                  <span style={{fontSize:13,color:tokens.text.strong}}>{cid.descricao}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ):<div style={{background:'white',border:`1px dashed ${tokens.border.default}`,borderRadius:16,padding:'60px 40px',textAlign:'center',minHeight:400,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}><div style={{width:56,height:56,borderRadius:14,background:tokens.brand.primaryLighter,display:'flex',alignItems:'center',justifyContent:'center',marginBottom:14,color:tokens.brand.primary}}><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg></div><p style={{fontSize:14,fontWeight:600,color:tokens.text.strong,margin:'0 0 4px'}}>Selecione uma consulta</p><p style={{fontSize:12,color:tokens.text.tertiary,margin:0}}>Clique em qualquer consulta na lista pra ver os detalhes</p></div>}
                </div>
              </div>
            )}
            {aba==='agendamentos'&&(
              <div>
                <div style={{display:'flex',justifyContent:'flex-end',marginBottom:16}}>
                  <button onClick={()=>setModalAg(true)} style={{padding:'8px 16px',borderRadius:8,border:'none',background:tokens.brand.primary,color:'white',fontSize:13,fontWeight:600,cursor:'pointer'}}>+ Novo agendamento</button>
                </div>
                {agendamentos.length===0?(
                  <div style={{background:'white',border:`1px dashed ${tokens.border.default}`,borderRadius:16,padding:40,textAlign:'center'}}>
                    <p style={{fontSize:14,fontWeight:600,color:tokens.text.strong,margin:'0 0 12px'}}>Nenhum agendamento</p>
                    <button onClick={()=>setModalAg(true)} style={{padding:'8px 20px',borderRadius:8,border:'none',background:tokens.brand.primary,color:'white',fontSize:13,fontWeight:600,cursor:'pointer'}}>Agendar agora</button>
                  </div>
                ):(
                  <div style={{display:'flex',flexDirection:'column',gap:10}}>
                    {agendamentos.map(ag=>{
                      const tc=TIPO_CORES[ag.tipo]||TIPO_CORES.consulta
                      const sc=STATUS_CORES[ag.status]||STATUS_CORES.agendado
                      const passado=new Date(ag.data_hora)<new Date()
                      return(
                        <div key={ag.id} style={{background:'white',borderRadius:16,padding:'16px 20px',display:'flex',gap:16,opacity:ag.status==='cancelado'?0.5:1}}>
                          <div style={{background:tc.bg,border:'1px solid '+tc.border,borderRadius:10,padding:'8px 12px',textAlign:'center',flexShrink:0,minWidth:56}}>
                            <p style={{fontSize:18,fontWeight:800,color:tc.text,margin:0,lineHeight:1}}>{new Date(ag.data_hora).getDate()}</p>
                            <p style={{fontSize:10,color:tc.text,margin:0,textTransform:'uppercase'}}>{new Date(ag.data_hora).toLocaleDateString('pt-BR',{month:'short'})}</p>
                            <p style={{fontSize:11,color:tc.text,margin:0}}>{fmtH(ag.data_hora)}</p>
                          </div>
                          <div style={{flex:1}}>
                            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                              <p style={{fontSize:14,fontWeight:700,color:tokens.text.primary,margin:0}}>{ag.motivo||'Consulta'}</p>
                              <span style={{fontSize:10,background:tc.bg,color:tc.text,padding:'1px 7px',borderRadius:20,border:'1px solid '+tc.border,fontWeight:600}}>{ag.tipo}</span>
                              <span style={{fontSize:10,background:sc.bg,color:sc.text,padding:'1px 7px',borderRadius:20,fontWeight:600}}>{ag.status}</span>
                            </div>
                            {ag.observacoes&&<p style={{fontSize:12,color:tokens.text.secondary,margin:'0 0 8px'}}>{ag.observacoes}</p>}
                            <div style={{display:'flex',gap:8}}>
                              {!passado&&ag.status==='agendado'&&<>
                                <button onClick={()=>atualizarAg(ag.id,'confirmado')} style={{fontSize:11,color:tokens.brand.primary,background:tokens.bg.hover,padding:'3px 10px',borderRadius:6,cursor:'pointer',fontWeight:600}}>Confirmar</button>
                                <button onClick={()=>atualizarAg(ag.id,'cancelado')} style={{fontSize:11,color:tokens.status.danger,background:tokens.status.dangerBg,border:`1px solid ${tokens.status.dangerLight}`,padding:'3px 10px',borderRadius:6,cursor:'pointer',fontWeight:600}}>Cancelar</button>
                              </>}
                              {passado&&ag.status!=='realizado'&&ag.status!=='cancelado'&&(
                                <button onClick={()=>atualizarAg(ag.id,'realizado')} style={{fontSize:11,color:tokens.text.secondary,background:tokens.bg.hoverStrong,padding:'3px 10px',borderRadius:6,cursor:'pointer',fontWeight:600}}>Marcar realizado</button>
                              )}
                            </div>
                          </div>
                          <button onClick={()=>deletarAg(ag.id)} style={{background:'none',border:'none',cursor:'pointer',color:tokens.border.strong}}>
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
              <div>
                <div style={{background:'white',borderRadius:16,padding:'20px 24px',marginBottom:20}}>
                  <h2 style={{fontSize:15,fontWeight:700,color:tokens.text.primary,margin:'0 0 14px'}}>Resumo clinico</h2>
                  {(paciente?.alergias||paciente?.comorbidades||paciente?.medicamentos_uso)?(
                    <div style={{display:'flex',flexDirection:'column',gap:10}}>
                      {paciente.alergias&&<div style={{background:tokens.status.dangerBg,border:`1px solid ${tokens.status.dangerLight}`,borderRadius:8,padding:'10px 14px'}}><p style={{fontSize:10,fontWeight:700,color:tokens.status.danger,margin:'0 0 3px',textTransform:'uppercase'}}>Alergias</p><p style={{fontSize:13,color:tokens.status.dangerHover,margin:0}}>{paciente.alergias}</p></div>}
                      {paciente.comorbidades&&<div style={{background:tokens.status.warningBgAlt,border:`1px solid ${tokens.status.warningLightAlt}`,borderRadius:8,padding:'10px 14px'}}><p style={{fontSize:10,fontWeight:700,color:tokens.status.warningAlt,margin:'0 0 3px',textTransform:'uppercase'}}>Comorbidades</p><p style={{fontSize:13,color:tokens.status.warningText,margin:0}}>{paciente.comorbidades}</p></div>}
                      {paciente.medicamentos_uso&&<div style={{background:tokens.bg.hover,borderRadius:8,padding:'10px 14px'}}><p style={{fontSize:10,fontWeight:700,color:tokens.brand.primary,margin:'0 0 3px',textTransform:'uppercase'}}>Medicamentos</p><p style={{fontSize:13,color:tokens.brand.primary,margin:0}}>{paciente.medicamentos_uso}</p></div>}
                    </div>
                  ):<p style={{fontSize:13,color:tokens.text.tertiary,margin:0}}>Nenhum dado clinico preenchido.</p>}
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:14}}>
                  {consultas.map((c,idx)=>(
                    <div key={c.id} style={{background:'white',borderRadius:12,overflow:'hidden'}}>
                      <div style={{padding:'10px 18px',background: 'transparent',borderBottom: 'none',display:'flex',justifyContent:'space-between'}}>
                        <p style={{fontSize:13,fontWeight:600,color:tokens.text.strong,margin:0}}>#{consultas.length-idx} {fmtF(c.criado_em)}</p>
                            {(c.meet_link || c.sala_id) && <span style={{fontSize:9,fontWeight:700,color:tokens.status.infoDark,background:tokens.status.infoBg,border:`1px solid ${tokens.status.infoLight}`,padding:'2px 7px',borderRadius:10}}>📹 Teleconsulta</span>}
                        <div style={{display:'flex',gap:4}}>{(c.cids||[]).map((cid:any)=><span key={cid.codigo} style={{fontSize:10,color:tokens.brand.primary,background:tokens.bg.hover,padding:'1px 6px',borderRadius:4,fontFamily:'monospace',fontWeight:700}}>{cid.codigo}</span>)}</div>
                      </div>
                      <div style={{padding:'14px 18px',display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                        {secoes.map(s=>(
                          <div key={s.key} style={{background:s.bg,border:'1px solid '+s.border,borderRadius:8,padding:'10px 12px'}}>
                            <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:5}}>
                              <div style={{width:20,height:20,borderRadius:5,background:s.cor,display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:800,color:'white'}}>{s.letra}</div>
                              <p style={{fontSize:11,fontWeight:700,color:tokens.text.strong,margin:0}}>{s.titulo}</p>
                            </div>
                            <p style={{fontSize:11,color:tokens.text.strong,margin:0,lineHeight:1.6,paddingLeft:27}}>{c[s.key]||'--'}</p>
                          </div>
                        ))}
                      </div>
                      {/* Hipoteses diagnosticas */}
                      {c.hipoteses && Array.isArray(c.hipoteses) && c.hipoteses.length > 0 && (
                        <div style={{padding:'14px 18px',borderTop:`1px solid ${tokens.bg.hoverStrong}`}}>
                          <HipotesesCard hipoteses={c.hipoteses} />
                        </div>
                      )}
                      {/* Transcrição colapsavel */}
                      {c.transcricao && (
                        <div style={{padding:'8px 18px',borderTop:`1px solid ${tokens.bg.hoverStrong}`}}>
                          <button onClick={() => {
                            const s = new Set(transcricoesAbertas)
                            s.has(c.id) ? s.delete(c.id) : s.add(c.id)
                            setTranscricoesAbertas(s)
                          }} style={{display:'flex',alignItems:'center',gap:5,background:'none',border:'none',cursor:'pointer',padding:0}}>
                            <span style={{fontSize:11,fontWeight:600,color:tokens.text.strong}}>📝 Transcrição</span>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={tokens.text.tertiary} strokeWidth="2" style={{transform:transcricoesAbertas.has(c.id)?'rotate(180deg)':'none',transition:'transform 0.2s'}}><polyline points="6 9 12 15 18 9"/></svg>
                          </button>
                          {transcricoesAbertas.has(c.id) && (
                            <div style={{marginTop:6,background:tokens.neutral.grayMist,borderRadius:7,padding:'8px 10px',fontSize:11,color:tokens.text.slate600,lineHeight:1.7,maxHeight:160,overflow:'auto',whiteSpace:'pre-wrap' as const}}>
                              {c.transcricao}
                            </div>
                          )}
                        </div>
                      )}
                      {/* Botoes */}
                      <div style={{padding:'8px 18px 12px',borderTop:`1px solid ${tokens.bg.hoverStrong}`,display:'flex',gap:8,alignItems:'center',flexWrap:'wrap' as const}}>
                        <a href={'/api/pdf-prontuario?consulta_id='+c.id+'&medico_id='+(c.medico_id||medico?.id)} target="_blank" rel="noreferrer"
                          style={{display:'flex',alignItems:'center',gap:4,padding:'5px 10px',borderRadius:6,background:tokens.brand.primaryLight,color:tokens.brand.primary,fontSize:12,fontWeight:600,textDecoration:'none'}}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>
                          PDF Prontuário
                        </a>
                        <BotaoMemed onClick={()=>setMemedAberto(true)} variant="compact" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
}
              {aba==='timeline'&&(
                <div>
                  <div style={{marginBottom:20}}>
                    <h2 style={{fontSize:15,fontWeight:700,color:tokens.text.primary,margin:'0 0 4px'}}>Linha do tempo clínica</h2>
                    <p style={{fontSize:12,color:tokens.text.tertiary,margin:0}}>{consultas.length} consulta{consultas.length!==1?'s':''} registrada{consultas.length!==1?'s':''}</p>
                  </div>
                  {consultas.length===0?(
                    <div style={{textAlign:'center',padding:'40px 20px',background:'white',borderRadius:16}}>
                      <p style={{fontSize:13,color:tokens.text.tertiary,margin:0}}>Nenhuma consulta registrada ainda</p>
                    </div>
                  ):(
                    <div style={{position:'relative'}}>
                      <div style={{position:'absolute',left:19,top:0,bottom:0,width:2,background:tokens.border.default}}/>
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
                                <div style={{width:40,height:40,borderRadius:'50%',background:isUltima?tokens.brand.primary:'white',border:isUltima?'none':`2px solid ${tokens.brand.primaryAccent}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,color:isUltima?'white':tokens.brand.primary}}>
                                  {consultas.length-i}
                                </div>
                              </div>
                              <div style={{flex:1,background:'white',borderRadius:12,padding:'14px 16px'}}>
                                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
                                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                                    <span style={{fontSize:13,fontWeight:700,color:tokens.text.primary}}>{dataFmt}</span>
                                    <span style={{fontSize:11,color:tokens.text.tertiary}}>{hora}</span>
                                    {isUltima&&<span style={{fontSize:10,fontWeight:700,color:tokens.brand.primary,background:tokens.brand.primaryLight,padding:'2px 8px',borderRadius:10}}>mais recente</span>}
                                  </div>
                                  <div style={{display:'flex',gap:6}}>
                                    <a href={'/api/pdf-prontuario?consulta_id='+c.id+'&medico_id='+(c.medico_id||medico?.id)} target="_blank" rel="noreferrer" style={{fontSize:11,color:tokens.brand.primary,background:tokens.brand.primaryLight,padding:'4px 10px',borderRadius:6,textDecoration:'none',fontWeight:600}}>PDF</a>
                                  </div>
                                </div>
                                {alertas.length>0&&(
                                  <div style={{background:tokens.status.dangerBg,border:`1px solid ${tokens.status.dangerLight}`,borderRadius:8,padding:'6px 10px',marginBottom:10,display:'flex',alignItems:'flex-start',gap:6}}>
                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={tokens.status.danger} strokeWidth="2" style={{flexShrink:0,marginTop:1}}><path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
                                    <p style={{fontSize:11,color:tokens.status.dangerHover,margin:0,lineHeight:1.4}}>{alertas.join(' · ')}</p>
                                  </div>
                                )}
                                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:cids.length>0?10:0}}>
                                  {c.subjetivo&&(
                                    <div>
                                      <p style={{fontSize:10,fontWeight:700,color:tokens.text.tertiary,textTransform:'uppercase',letterSpacing:'0.06em',margin:'0 0 3px'}}>Subjetivo</p>
                                      <p style={{fontSize:12,color:tokens.text.strong,margin:0,lineHeight:1.5}}>{(c.subjetivo||'').substring(0,120)}{c.subjetivo?.length>120?'...':''}</p>
                                    </div>
                                  )}
                                  {c.avaliacao&&(
                                    <div>
                                      <p style={{fontSize:10,fontWeight:700,color:tokens.text.tertiary,textTransform:'uppercase',letterSpacing:'0.06em',margin:'0 0 3px'}}>Avaliação</p>
                                      <p style={{fontSize:12,color:tokens.text.strong,margin:0,lineHeight:1.5}}>{(c.avaliacao||'').substring(0,120)}{c.avaliacao?.length>120?'...':''}</p>
                                    </div>
                                  )}
                                </div>
                                {cids.length>0&&(
                                  <div style={{display:'flex',gap:6,flexWrap:'wrap',marginTop:8}}>
                                    {cids.map((cid:any,j:number)=>(
                                      <span key={j} style={{fontSize:10,fontWeight:700,color:tokens.brand.primary,background:tokens.brand.primaryLight,padding:'2px 8px',borderRadius:10,fontFamily:'monospace'}}>{cid.codigo}</span>
                                    ))}
                                  </div>
                                )}
                                {i>0&&consultas[i-1]&&(
                                  <div style={{marginTop:10,paddingTop:10,borderTop:`1px solid ${tokens.bg.hover}`}}>
                                    <p style={{fontSize:10,color:tokens.text.tertiary,margin:'0 0 3px',fontStyle:'italic'}}>vs consulta anterior ({new Date(consultas[i-1].criado_em).toLocaleDateString('pt-BR',{day:'2-digit',month:'short'})})</p>
                                    {c.subjetivo&&consultas[i-1].subjetivo&&c.subjetivo.substring(0,50)===consultas[i-1].subjetivo.substring(0,50)&&(
                                      <p style={{fontSize:11,color:tokens.status.warningAlt,margin:0}}>↻ Queixa similar à consulta anterior</p>
                                    )}
                                    {cids.length>0&&consultas[i-1].cids?.some((prev:any)=>cids.find((cur:any)=>cur.codigo===prev.codigo))&&(
                                      <p style={{fontSize:11,color:tokens.status.danger,margin:0}}>⚠ CID recorrente detectado</p>
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
          <div style={{background:'white',borderRadius:16,width:'100%',maxWidth:440,padding:28}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20}}>
              <h3 style={{fontSize:16,fontWeight:700,color:tokens.text.primary,margin:0}}>Agendar consulta</h3>
              <button onClick={()=>setModalAg(false)} style={{background:'none',border:'none',cursor:'pointer',color:tokens.text.tertiary,fontSize:18,lineHeight:1}}>x</button>
            </div>
            <div style={{background:tokens.bg.hover,borderRadius:10,padding:'10px 14px',marginBottom:18}}>
              <p style={{fontSize:13,fontWeight:600,color:tokens.brand.primary,margin:'0 0 2px'}}>{paciente?.nome}</p>
              <p style={{fontSize:11,color:tokens.text.secondary,margin:0}}>{[paciente?.sexo,idadePac?idadePac+' anos':null].filter(Boolean).join(' · ')}</p>
            </div>
            <form onSubmit={salvarAg} style={{display:'flex',flexDirection:'column',gap:14}}>
              <div>
                <label style={{fontSize:12,fontWeight:600,color:tokens.text.strong,display:'block',marginBottom:6}}>Data e hora</label>
                <input type="datetime-local" required value={agForm.data_hora} onChange={e=>setAgForm(f=>({...f,data_hora:e.target.value}))} style={{width:'100%',padding:'10px 12px',fontSize:13,borderRadius:8}}/>
              </div>
              <div>
                <label style={{fontSize:12,fontWeight:600,color:tokens.text.strong,display:'block',marginBottom:6}}>Tipo</label>
                <select value={agForm.tipo} onChange={e=>setAgForm(f=>({...f,tipo:e.target.value}))} style={{width:'100%',padding:'10px 12px',fontSize:13,borderRadius:8}}>
                  <option value="consulta">Consulta</option>
                  <option value="retorno">Retorno</option>
                  <option value="exame">Exame</option>
                  <option value="urgencia">Urgencia</option>
                </select>
              </div>
              <div>
                <label style={{fontSize:12,fontWeight:600,color:tokens.text.strong,display:'block',marginBottom:6}}>Motivo</label>
                <input value={agForm.motivo} onChange={e=>setAgForm(f=>({...f,motivo:e.target.value}))} style={{width:'100%',padding:'10px 12px',fontSize:13,borderRadius:8}} placeholder="Cefaleia, retorno..."/>
              </div>
              <div>
                <label style={{fontSize:12,fontWeight:600,color:tokens.text.strong,display:'block',marginBottom:6}}>Observacoes</label>
                <textarea value={agForm.observacoes} onChange={e=>setAgForm(f=>({...f,observacoes:e.target.value}))} style={{width:'100%',padding:'10px 12px',fontSize:13,borderRadius:8,minHeight:64,resize:'vertical'}}/>
              </div>
              <button type="submit" disabled={salvandoAg} style={{padding:'12px',borderRadius:9,border:'none',background:tokens.brand.primary,color:'white',fontSize:14,fontWeight:700,cursor:'pointer'}}>{salvandoAg?'Salvando...':'Confirmar agendamento'}</button>
            </form>
          </div>
        </div>
      )}
      {aba==='financeiro' && (
        <div style={{display:'flex',flexDirection:'column' as const,gap:16}}>
          {/* Header com KPIs */}
          <div style={{background:'white',borderRadius:14,padding:22}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18}}>
              <div>
                <p style={{fontSize:15,fontWeight:700,color:tokens.text.primary,margin:0}}>Financeiro do paciente</p>
                <p style={{fontSize:12,color:tokens.text.secondary,margin:'2px 0 0'}}>Histórico de comandas e pagamentos</p>
              </div>
              <button onClick={criarNovaComanda} style={{padding:'10px 16px',borderRadius:10,border:'none',background:tokens.brand.primary,color:'white',fontSize:13,fontWeight:600,cursor:'pointer'}}>
                + Nova comanda
              </button>
            </div>

            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12}}>
              {(() => {
                const fechadas = comandasPaciente.filter((c:any) => c.status === 'fechada')
                const abertas = comandasPaciente.filter((c:any) => c.status === 'aberta')
                const totalPago = fechadas.reduce((acc:number, c:any) => acc + Number(c.total_liquido || c.total || 0), 0)
                const totalAberto = abertas.reduce((acc:number, c:any) => acc + Number(c.total_liquido || c.total || 0), 0)
                const ticketMedio = fechadas.length > 0 ? totalPago / fechadas.length : 0
                return (
                  <>
                    <div style={{padding:14,background:tokens.status.successBg,borderRadius:10}}>
                      <p style={{fontSize:10,color:tokens.status.success,margin:'0 0 4px',fontWeight:600,textTransform:'uppercase' as const,letterSpacing:'0.04em'}}>Total pago</p>
                      <p style={{fontSize:18,fontWeight:700,color:tokens.status.success,margin:0}}>R$ {totalPago.toFixed(2).replace('.', ',')}</p>
                    </div>
                    <div style={{padding:14,background:tokens.status.warningBg,borderRadius:10}}>
                      <p style={{fontSize:10,color:tokens.status.warning,margin:'0 0 4px',fontWeight:600,textTransform:'uppercase' as const,letterSpacing:'0.04em'}}>Em aberto</p>
                      <p style={{fontSize:18,fontWeight:700,color:tokens.status.warning,margin:0}}>R$ {totalAberto.toFixed(2).replace('.', ',')}</p>
                    </div>
                    <div style={{padding:14,background:tokens.bg.page,borderRadius:10}}>
                      <p style={{fontSize:10,color:tokens.text.secondary,margin:'0 0 4px',fontWeight:600,textTransform:'uppercase' as const,letterSpacing:'0.04em'}}>Comandas</p>
                      <p style={{fontSize:18,fontWeight:700,color:tokens.text.primary,margin:0}}>{comandasPaciente.length}</p>
                    </div>
                    <div style={{padding:14,background:tokens.bg.page,borderRadius:10}}>
                      <p style={{fontSize:10,color:tokens.text.secondary,margin:'0 0 4px',fontWeight:600,textTransform:'uppercase' as const,letterSpacing:'0.04em'}}>Ticket médio</p>
                      <p style={{fontSize:18,fontWeight:700,color:tokens.text.primary,margin:0}}>R$ {ticketMedio.toFixed(2).replace('.', ',')}</p>
                    </div>
                  </>
                )
              })()}
            </div>
          </div>

          {/* Lista de comandas */}
          <div style={{background:'white',borderRadius:14,padding:22}}>
            <p style={{fontSize:14,fontWeight:700,color:tokens.text.primary,margin:'0 0 14px'}}>Histórico de comandas</p>
            {carregandoComandas ? (
              <p style={{fontSize:13,color:tokens.text.tertiary,textAlign:'center' as const,padding:30,margin:0}}>Carregando...</p>
            ) : comandasPaciente.length === 0 ? (
              <p style={{fontSize:13,color:tokens.text.tertiary,textAlign:'center' as const,padding:30,margin:0}}>Nenhuma comanda ainda. Clique em "Nova comanda" pra criar.</p>
            ) : (
              <div style={{display:'flex',flexDirection:'column' as const,gap:8}}>
                {comandasPaciente.map((c:any) => {
                  const data = new Date(c.criada_em)
                  const dataFmt = data.toLocaleDateString('pt-BR') + ' às ' + data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                  const total = Number(c.total_liquido || c.total || 0)
                  const fechada = c.status === 'fechada'
                  const cancelada = c.status === 'cancelada'
                  return (
                    <div key={c.id} onClick={() => router.push('/comandas/' + c.id)} style={{
                      padding:14,background:tokens.bg.page,borderRadius:10,cursor:'pointer',
                      display:'flex',alignItems:'center',gap:12
                    }}>
                      <div style={{width:36,height:36,borderRadius:9,background:fechada?tokens.status.successBgAlt:cancelada?tokens.status.dangerBg:tokens.status.warningBg,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={fechada?tokens.status.success:cancelada?tokens.status.danger:tokens.status.warning} strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 10 12 15 7 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <p style={{fontSize:13,fontWeight:600,color:tokens.text.primary,margin:'0 0 2px'}}>Comanda #{c.id.substring(0,8)}</p>
                        <p style={{fontSize:11,color:tokens.text.tertiary,margin:0}}>{dataFmt}{c.medicos?.nome ? ' · ' + c.medicos.nome : ''}{c.forma_pagamento ? ' · ' + c.forma_pagamento : ''}</p>
                      </div>
                      <div style={{textAlign:'right' as const}}>
                        <p style={{fontSize:14,fontWeight:700,color:tokens.text.primary,margin:'0 0 2px'}}>R$ {total.toFixed(2).replace('.', ',')}</p>
                        <span style={{
                          fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:100,
                          background:fechada?tokens.status.successBgAlt:cancelada?tokens.status.dangerBg:tokens.status.warningBg,
                          color:fechada?tokens.status.success:cancelada?tokens.status.danger:tokens.status.warning,
                        }}>{fechada?'PAGO':cancelada?'CANCELADO':'EM ABERTO'}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal/overlay Memed */}
      {memedAberto && medicoLogado && paciente && (
        <MemedPrescricao
          medicoId={medicoLogado.id}
          paciente={{
            id: paciente.id,
            nome: paciente.nome,
            cpf: paciente.cpf,
            data_nascimento: paciente.data_nascimento,
            sexo: paciente.sexo,
            telefone: paciente.telefone,
            email: paciente.email,
            endereco: paciente.endereco,
          }}
          onClose={() => setMemedAberto(false)}
          onPrescricaoGerada={(dados) => {
            // Salva prescricao no banco
            fetch('/api/prescricoes', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                paciente_id: paciente.id,
                medico_id: paciente.medico_id,
                clinica_id: paciente.clinica_id || null,
                dados_memed: dados,
              }),
            }).then(() => carregarPrescricoes()).catch(err => console.error('Erro ao salvar prescricao:', err))
            setMemedAberto(false)
          }}
        />
      )}
      <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
    </div>
  )
}
