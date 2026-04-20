'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

type AbaConfig = 'dashboard'|'sofia'|'alertas'|'campanha'|'relatorio'|'configuracao'

export default function ConfigPanel({ medico, onClose }: { medico: any, onClose: ()=>void }) {
  const [aba, setAba] = useState<AbaConfig>('dashboard')
  const [metricas, setMetricas] = useState<any>(null)
  const [sofiaInstrucoes, setSofiaInstrucoes] = useState('')
  const [sofiaAtiva, setSofiaAtiva] = useState(true)
  const [salvandoSofia, setSalvandoSofia] = useState(false)
  const [alertas, setAlertas] = useState<any[]>([])
  const [checkinEnviando, setCheckinEnviando] = useState(false)
  const [campanhaMsg, setCampanhaMsg] = useState('')
  const [campanhaEnviando, setCampanhaEnviando] = useState(false)
  const [relatorio, setRelatorio] = useState<any>(null)
  const [relatorioCarregando, setRelatorioCarregando] = useState(false)
  const [config, setConfig] = useState<any>(null)
  const [configForm, setConfigForm] = useState({phone_number_id:'', token:'', nome_clinica:''})
  const [salvandoConfig, setSalvandoConfig] = useState(false)
  const [transmissaoMsg, setTransmissaoMsg] = useState('')
  const [followupEnviando, setFollowupEnviando] = useState(false)
  const [transmissaoEnviando, setTransmissaoEnviando] = useState(false)

  useEffect(() => {
    if (!medico) return
    carregarMetricas()
    carregarAlertas()
    carregarSofia()
    carregarConfig()
    carregarRelatorio()
  }, [medico])

  const carregarMetricas = async () => {
    const { data } = await supabase.from('whatsapp_mensagens')
      .select('tipo, criado_em')
      .gte('criado_em', new Date(Date.now() - 7*24*60*60*1000).toISOString())
    if (!data) return
    const enviadas = data.filter((m:any) => m.tipo === 'enviada').length
    const recebidas = data.filter((m:any) => m.tipo === 'recebida').length
    const { data: convs } = await supabase.from('whatsapp_conversas').select('modo').eq('medico_id', medico.id)
    setMetricas({
      enviadas, recebidas,
      total: (convs||[]).length,
      ia: (convs||[]).filter((c:any) => c.modo === 'ia').length,
      humano: (convs||[]).filter((c:any) => c.modo === 'humano').length,
      taxa: recebidas > 0 ? Math.round((enviadas/recebidas)*100) : 0
    })
  }

  const carregarAlertas = async () => {
    const limite = new Date(Date.now() - 7*24*60*60*1000).toISOString()
    const { data } = await supabase.from('whatsapp_conversas')
      .select('*, pacientes(nome)')
      .eq('medico_id', medico.id)
      .lt('ultimo_contato', limite)
    setAlertas(data || [])
  }

  const carregarSofia = async () => {
    const { data } = await supabase.from('whatsapp_config').select('sofia_instrucoes, sofia_ativa').eq('medico_id', medico.id).single()
    if (data) { setSofiaInstrucoes(data.sofia_instrucoes || ''); setSofiaAtiva(data.sofia_ativa !== false) }
  }

  const carregarConfig = async () => {
    const { data } = await supabase.from('whatsapp_config').select('*').eq('medico_id', medico.id).single()
    if (data) { setConfig(data); setConfigForm({ phone_number_id: data.phone_number_id||'', token: data.token ? data.token.substring(0,8)+'...' : '', nome_clinica: data.nome_exibicao||'' }) }
  }

  const carregarRelatorio = async () => {
    setRelatorioCarregando(true)
    const { data } = await supabase.from('whatsapp_mensagens')
      .select('tipo, criado_em, conteudo')
      .gte('criado_em', new Date(Date.now() - 30*24*60*60*1000).toISOString())
      .order('criado_em', { ascending: true })
    if (data) {
      const porDia: Record<string, {enviadas:number, recebidas:number}> = {}
      data.forEach((m:any) => {
        const dia = m.criado_em.substring(0, 10)
        if (!porDia[dia]) porDia[dia] = {enviadas:0, recebidas:0}
        porDia[dia][m.tipo === 'enviada' ? 'enviadas' : 'recebidas']++
      })
      setRelatorio(porDia)
    }
    setRelatorioCarregando(false)
  }

  const salvarSofia = async () => {
    setSalvandoSofia(true)
    await supabase.from('whatsapp_config').update({ sofia_instrucoes: sofiaInstrucoes, sofia_ativa: sofiaAtiva }).eq('medico_id', medico.id)
    setSalvandoSofia(false)
    alert('Sofia atualizada!')
  }

  const salvarConfig = async () => {
    setSalvandoConfig(true)
    const updates: any = { nome_exibicao: configForm.nome_clinica }
    if (!configForm.phone_number_id.includes('...')) updates.phone_number_id = configForm.phone_number_id
    if (!configForm.token.includes('...')) updates.token = configForm.token
    await supabase.from('whatsapp_config').update(updates).eq('medico_id', medico.id)
    setSalvandoConfig(false)
    alert('Configurações salvas!')
  }

  const enviarCheckin = async () => {
    setCheckinEnviando(true)
    await fetch('/api/whatsapp/checkin', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ medico_id: medico.id }) })
    setCheckinEnviando(false)
    alert('Check-in enviado!')
  }

  const enviarTransmissao = async () => {
    if (!transmissaoMsg.trim()) return
    setTransmissaoEnviando(true)
    const { data: convs } = await supabase.from('whatsapp_conversas').select('telefone').eq('medico_id', medico.id)
    for (const conv of (convs||[])) {
      await fetch('/api/whatsapp/enviar', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ telefone: conv.telefone, texto: transmissaoMsg, medico_id: medico.id }) })
    }
    setTransmissaoEnviando(false)
    setTransmissaoMsg('')
    alert(`Mensagem enviada para ${(convs||[]).length} contatos!`)
  }

  const tabs: {id: AbaConfig, label: string}[] = [
    {id:'dashboard', label:'📊 Dashboard'},
    {id:'sofia', label:'🤖 Sofia IA'},
    {id:'alertas', label:'🔔 Alertas'},
    {id:'campanha', label:'📢 Campanhas'},
    {id:'relatorio', label:'📈 Relatório'},
    {id:'configuracao', label:'⚙️ Configuração'},
  ]

  const s = {padding:'10px 14px',borderRadius:8,border:'1px solid #e5e7eb',fontSize:13,outline:'none',width:'100%',fontFamily:'inherit',color:'#111827',background:'white'}
  const btn = (cor='#6043C1') => ({padding:'10px 20px',borderRadius:8,border:'none',background:cor,color:'white',fontSize:13,fontWeight:600,cursor:'pointer'})

  return (
    <div style={{position:'fixed',inset:0,zIndex:200,display:'flex'}}>
      <div style={{position:'absolute',inset:0,background:'rgba(0,0,0,0.4)'}} onClick={onClose}/>
      <div style={{position:'relative',width:860,maxWidth:'96vw',background:'white',marginLeft:'auto',display:'flex',flexDirection:'column',height:'100vh'}}>
        
        {/* Header */}
        <div style={{padding:'16px 24px',borderBottom:'1px solid #e5e7eb',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0,background:'white'}}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <div style={{width:32,height:32,borderRadius:'50%',background:'#d9fdd3',display:'flex',alignItems:'center',justifyContent:'center'}}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#00a884"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            </div>
            <h2 style={{fontSize:17,fontWeight:700,color:'#111827',margin:0}}>Central WhatsApp</h2>
          </div>
          <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',fontSize:22,color:'#6b7280',lineHeight:1,padding:'4px 8px'}}>×</button>
        </div>

        {/* Tabs */}
        <div style={{display:'flex',borderBottom:'1px solid #e5e7eb',overflowX:'auto',flexShrink:0}}>
          {tabs.map(t => (
            <button key={t.id} onClick={()=>setAba(t.id)} style={{padding:'12px 16px',background:'none',border:'none',borderBottom:aba===t.id?'2px solid #00a884':'2px solid transparent',color:aba===t.id?'#00a884':'#6b7280',fontSize:13,fontWeight:aba===t.id?600:400,cursor:'pointer',whiteSpace:'nowrap',flexShrink:0}}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Conteúdo */}
        <div style={{flex:1,overflowY:'auto',padding:24}}>

          {/* DASHBOARD */}
          {aba==='dashboard'&&(
            <div>
              <h3 style={{fontSize:16,fontWeight:700,color:'#111827',margin:'0 0 20px'}}>Visão geral do atendimento</h3>
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16,marginBottom:24}}>
                {[
                  {label:'Total conversas',val:metricas?.total||0,cor:'#6043C1'},
                  {label:'Sofia IA',val:metricas?.ia||0,cor:'#00a884'},
                  {label:'Atendimento humano',val:metricas?.humano||0,cor:'#f59e0b'},
                  {label:'Msgs enviadas (7d)',val:metricas?.enviadas||0,cor:'#3b82f6'},
                  {label:'Msgs recebidas (7d)',val:metricas?.recebidas||0,cor:'#8b5cf6'},
                  {label:'Taxa de resposta',val:(metricas?.taxa||0)+'%',cor:'#10b981'},
                ].map(m => (
                  <div key={m.label} style={{background:'#EAECEF',borderRadius:12,padding:'16px 20px',border:'1px solid #e5e7eb'}}>
                    <p style={{fontSize:11,color:'#6b7280',margin:'0 0 8px',textTransform:'uppercase',letterSpacing:'0.05em'}}>{m.label}</p>
                    <p style={{fontSize:28,fontWeight:800,color:m.cor,margin:0}}>{m.val}</p>
                  </div>
                ))}
              </div>
              <div style={{display:'flex',gap:12}}>
                <button onClick={carregarMetricas} style={btn('#6043C1')}>Atualizar métricas</button>
                <button onClick={enviarCheckin} disabled={checkinEnviando} style={btn('#00a884')}>{checkinEnviando?'Enviando...':'Enviar check-in aos pacientes'}</button>
                <button onClick={async()=>{
                  setFollowupEnviando(true)
                  const res = await fetch(`/api/followup?medico_id=${medico.id}`)
                  const d = await res.json()
                  setFollowupEnviando(false)
                  alert(d.error ? 'Erro: '+d.error : `Follow-up enviado para ${d.enviados} paciente(s)!`)
                }} disabled={followupEnviando} style={btn('#8b5cf6')}>{followupEnviando?'Enviando...':'📩 Follow-up 3 dias pós-consulta'}</button>
              </div>
            </div>
          )}

          {/* SOFIA IA */}
          {aba==='sofia'&&(
            <div>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20}}>
                <h3 style={{fontSize:16,fontWeight:700,color:'#111827',margin:0}}>Sofia IA — Assistente Virtual</h3>
                <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer'}}>
                  <span style={{fontSize:13,color:'#6b7280'}}>Sofia {sofiaAtiva?'ativa':'pausada'}</span>
                  <div onClick={()=>setSofiaAtiva(v=>!v)} style={{width:44,height:24,borderRadius:12,background:sofiaAtiva?'#00a884':'#d1d5db',cursor:'pointer',position:'relative',transition:'background 0.2s'}}>
                    <div style={{position:'absolute',width:20,height:20,borderRadius:'50%',background:'white',top:2,left:sofiaAtiva?22:2,transition:'left 0.2s'}}/>
                  </div>
                </label>
              </div>
              <p style={{fontSize:13,color:'#6b7280',margin:'0 0 12px'}}>Personalize a personalidade e regras da Sofia. Quanto mais detalhado, melhor o atendimento.</p>
              <textarea value={sofiaInstrucoes} onChange={e=>setSofiaInstrucoes(e.target.value)} rows={14}
                style={{...s,resize:'vertical',lineHeight:1.6,fontFamily:'monospace',fontSize:12}}
                placeholder="Ex: Você é Sofia, assistente da Clínica São Lucas..."/>
              <div style={{display:'flex',gap:10,marginTop:16}}>
                <button onClick={salvarSofia} disabled={salvandoSofia} style={btn('#00a884')}>{salvandoSofia?'Salvando...':'Salvar instruções'}</button>
                <button onClick={()=>setSofiaInstrucoes('')} style={btn('#6b7280')}>Limpar</button>
              </div>
            </div>
          )}

          {/* ALERTAS */}
          {aba==='alertas'&&(
            <div>
              <h3 style={{fontSize:16,fontWeight:700,color:'#111827',margin:'0 0 20px'}}>Pacientes sem contato há +7 dias</h3>
              {alertas.length===0?(
                <div style={{textAlign:'center',padding:40,color:'#6b7280',fontSize:14}}>✅ Nenhum paciente inativo</div>
              ):alertas.map((a:any)=>(
                <div key={a.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 16px',background:'#fef9f0',borderRadius:10,border:'1px solid #fed7aa',marginBottom:8}}>
                  <div>
                    <p style={{fontSize:14,fontWeight:600,color:'#111827',margin:0}}>{a.nome_contato||a.telefone}</p>
                    <p style={{fontSize:12,color:'#6b7280',margin:0}}>Último contato: {a.ultimo_contato?new Date(a.ultimo_contato).toLocaleDateString('pt-BR'):'Nunca'}</p>
                  </div>
                  <button onClick={async()=>{
                    await fetch('/api/whatsapp/enviar',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({telefone:a.telefone,texto:'Olá! Tudo bem? Sentimos sua falta na clínica. Posso ajudar com algo?',medico_id:medico.id})})
                    alert('Mensagem enviada!')
                  }} style={{...btn('#00a884'),padding:'6px 14px',fontSize:12}}>Enviar mensagem</button>
                </div>
              ))}
              <button onClick={carregarAlertas} style={{...btn('#6b7280'),marginTop:16}}>Atualizar</button>
            </div>
          )}

          {/* CAMPANHAS */}
          {aba==='campanha'&&(
            <div>
              <h3 style={{fontSize:16,fontWeight:700,color:'#111827',margin:'0 0 8px'}}>Transmissão em massa</h3>
              <p style={{fontSize:13,color:'#6b7280',margin:'0 0 20px'}}>Envie uma mensagem para todos os contatos ativos no WhatsApp</p>
              <textarea value={transmissaoMsg} onChange={e=>setTransmissaoMsg(e.target.value)} rows={6}
                style={{...s,resize:'vertical',marginBottom:16}}
                placeholder="Digite a mensagem que será enviada para todos os contatos..."/>
              <div style={{background:'#fef9f0',borderRadius:8,padding:'12px 16px',marginBottom:16,border:'1px solid #fed7aa'}}>
                <p style={{fontSize:12,color:'#92400e',margin:0}}>⚠️ Esta mensagem será enviada para TODOS os contatos. Use com responsabilidade.</p>
              </div>
              <button onClick={enviarTransmissao} disabled={transmissaoEnviando||!transmissaoMsg.trim()} style={btn('#f59e0b')}>
                {transmissaoEnviando?'Enviando...':'📢 Enviar para todos os contatos'}
              </button>
            </div>
          )}

          {/* RELATÓRIO */}
          {aba==='relatorio'&&(
            <div>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20}}>
                <h3 style={{fontSize:16,fontWeight:700,color:'#111827',margin:0}}>Relatório últimos 30 dias</h3>
                <button onClick={carregarRelatorio} style={btn('#6043C1')}>{relatorioCarregando?'Carregando...':'Atualizar'}</button>
              </div>
              {relatorio&&(
                <div>
                  <div style={{background:'#EAECEF',borderRadius:10,border:'1px solid #e5e7eb',overflow:'hidden'}}>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',padding:'10px 16px',borderBottom:'1px solid #e5e7eb',background:'#f3f4f6'}}>
                      <span style={{fontSize:11,fontWeight:700,color:'#6b7280',textTransform:'uppercase'}}>Data</span>
                      <span style={{fontSize:11,fontWeight:700,color:'#6b7280',textTransform:'uppercase'}}>Enviadas</span>
                      <span style={{fontSize:11,fontWeight:700,color:'#6b7280',textTransform:'uppercase'}}>Recebidas</span>
                    </div>
                    {Object.entries(relatorio).sort(([a],[b])=>b.localeCompare(a)).slice(0,30).map(([dia, vals]:any)=>(
                      <div key={dia} style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',padding:'10px 16px',borderBottom:'1px solid #f0f0f0'}}>
                        <span style={{fontSize:13,color:'#374151'}}>{new Date(dia+'T12:00:00').toLocaleDateString('pt-BR',{weekday:'short',day:'2-digit',month:'short'})}</span>
                        <span style={{fontSize:13,color:'#00a884',fontWeight:600}}>{vals.enviadas}</span>
                        <span style={{fontSize:13,color:'#6043C1',fontWeight:600}}>{vals.recebidas}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {!relatorio&&!relatorioCarregando&&<p style={{color:'#6b7280',fontSize:13}}>Clique em Atualizar para carregar o relatório</p>}
            </div>
          )}

          {/* CONFIGURAÇÃO */}
          {aba==='configuracao'&&(
            <div>
              <div style={{background:config?'#f0fdf4':'#fef9f0',borderRadius:10,padding:'14px 18px',marginBottom:24,border:`1px solid ${config?'#86efac':'#fed7aa'}`}}>
                <p style={{fontSize:14,fontWeight:600,color:config?'#166534':'#92400e',margin:0}}>
                  {config?`✅ WhatsApp conectado — ${config.phone_number||config.phone_number_id}`:'⚠️ WhatsApp não configurado'}
                </p>
              </div>
              <h3 style={{fontSize:15,fontWeight:700,color:'#111827',margin:'0 0 16px'}}>Credenciais da API</h3>
              <div style={{display:'flex',flexDirection:'column',gap:14,maxWidth:500}}>
                <div>
                  <label style={{fontSize:12,fontWeight:600,color:'#374151',display:'block',marginBottom:6}}>Phone Number ID</label>
                  <input value={configForm.phone_number_id} onChange={e=>setConfigForm(p=>({...p,phone_number_id:e.target.value}))} style={s} placeholder="Ex: 1030374870164992"/>
                </div>
                <div>
                  <label style={{fontSize:12,fontWeight:600,color:'#374151',display:'block',marginBottom:6}}>Token permanente</label>
                  <input value={configForm.token} onChange={e=>setConfigForm(p=>({...p,token:e.target.value}))} style={s} placeholder="EAANoj..."/>
                </div>
                <div>
                  <label style={{fontSize:12,fontWeight:600,color:'#374151',display:'block',marginBottom:6}}>Nome da clínica</label>
                  <input value={configForm.nome_clinica} onChange={e=>setConfigForm(p=>({...p,nome_clinica:e.target.value}))} style={s} placeholder="Clínica São Lucas"/>
                </div>
                <button onClick={salvarConfig} disabled={salvandoConfig} style={btn('#00a884')}>{salvandoConfig?'Salvando...':'Salvar configurações'}</button>
              </div>
              <div style={{marginTop:24,padding:'14px 18px',background:'#EAECEF',borderRadius:10,border:'1px solid #e5e7eb'}}>
                <p style={{fontSize:12,fontWeight:700,color:'#374151',margin:'0 0 12px',textTransform:'uppercase',letterSpacing:'0.05em'}}>Webhooks Meta</p>
                {[
                  {nome:'WhatsApp 📱', url:'https://prontuario-ia-five.vercel.app/api/whatsapp'},
                  {nome:'Instagram 📸', url:'https://prontuario-ia-five.vercel.app/api/instagram'},
                  {nome:'Messenger 💬', url:'https://prontuario-ia-five.vercel.app/api/messenger'},
                ].map(w=>(
                  <div key={w.nome} style={{marginBottom:12}}>
                    <p style={{fontSize:11,color:'#6b7280',margin:'0 0 4px',fontWeight:600}}>{w.nome}</p>
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      <code style={{fontSize:11,background:'#f3f4f6',padding:'6px 10px',borderRadius:6,flex:1,wordBreak:'break-all'}}>{w.url}</code>
                      <button onClick={()=>navigator.clipboard.writeText(w.url)} style={{...btn('#6b7280'),padding:'6px 10px',fontSize:11,flexShrink:0}}>Copiar</button>
                    </div>
                  </div>
                ))}
                <div style={{marginTop:8}}>
                  <p style={{fontSize:11,color:'#6b7280',margin:'0 0 4px',fontWeight:600}}>Token de verificação (todos os canais)</p>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <code style={{fontSize:12,background:'#f3f4f6',padding:'6px 10px',borderRadius:6,flex:1}}>media_whatsapp_2026</code>
                    <button onClick={()=>navigator.clipboard.writeText('media_whatsapp_2026')} style={{...btn('#6b7280'),padding:'6px 10px',fontSize:11}}>Copiar</button>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
