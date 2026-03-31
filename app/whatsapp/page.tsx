'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Sidebar } from '@/components/Sidebar'

type Aba = 'conversas' | 'sofia' | 'configuracao' | 'equipe'

export default function WhatsApp() {
  const router = useRouter()
  const [medico, setMedico] = useState<any>(null)
  const [usuario, setUsuario] = useState<any>(null) // medico ou atendente logado
  const [aba, setAba] = useState<Aba>('conversas')

  // conversas
  const [conversas, setConversas] = useState<any[]>([])
  const [ativa, setAtiva] = useState<any>(null)
  const [mensagens, setMensagens] = useState<any[]>([])
  const [msg, setMsg] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [busca, setBusca] = useState('')
  const [filtroModo, setFiltroModo] = useState<'todas'|'ia'|'humano'>('todas')
  const endRef = useRef<HTMLDivElement>(null)

  // nova conversa
  const [novaConversa, setNovaConversa] = useState(false)
  const [novoTel, setNovoTel] = useState('')
  const [novaMsgTexto, setNovaMsgTexto] = useState('')
  const [iniciando, setIniciando] = useState(false)

  // assumir atendimento
  const [assumindo, setAssumindo] = useState(false)

  // configuracao
  const [config, setConfig] = useState<any>(null)
  const [form, setForm] = useState({ phone_number_id: '', access_token: '', nome_exibicao: '' })
  const [salvando, setSalvando] = useState(false)
  const [cfgMsg, setCfgMsg] = useState<{ tipo: 'ok'|'erro'; texto: string }|null>(null)

  // sofia
  const [sofiaPrompt, setSofiaPrompt] = useState('')
  const [sofiaAtivo, setSofiaAtivo] = useState(true)
  const [salvandoSofia, setSalvandoSofia] = useState(false)
  const [sofiaMsg, setSofiaMsg] = useState('')

  // equipe
  const [atendentes, setAtendentes] = useState<any[]>([])
  const [novoAtendente, setNovoAtendente] = useState({ nome: '', email: '', senha: '', cargo: 'Atendente' })
  const [salvandoAt, setSalvandoAt] = useState(false)
  const [atMsg, setAtMsg] = useState<{ tipo: 'ok'|'erro'; texto: string }|null>(null)

  const WEBHOOK_URL = 'https://prontuario-ia-five.vercel.app/api/whatsapp'
  const VERIFY_TOKEN = 'media_whatsapp_2026'

  const PROMPT_DEFAULT = `Voce e Sofia, assistente virtual da clinica. Seja simpatica, objetiva e profissional. Responda SEMPRE em portugues.

FLUXO DE ATENDIMENTO:
1. Na primeira mensagem, envie boas-vindas e o menu principal
2. Guie o paciente pelas opcoes numeradas
3. Nunca fique sem responder - sempre ofeca uma proxima acao

MENU PRINCIPAL (envie quando paciente iniciar ou digitar "menu"):
Ola! Sou a Sofia, assistente virtual da clinica. Como posso ajudar? 😊

*1* - Agendar consulta
*2* - Ver meus agendamentos
*3* - Cancelar/remarcar consulta
*4* - Duvidas sobre a clinica
*5* - Falar com atendente

REGRAS:
- Para opcao 1: pergunte nome completo, depois sugira horarios disponiveis
- Para opcao 2: informe os agendamentos cadastrados do paciente
- Para opcao 3: pergunte qual consulta deseja cancelar/remarcar
- Para opcao 4: responda sobre horarios (seg-sex 8h-18h), endereco e convenios
- Para opcao 5: avise que um atendente entrara em contato e inclua [HUMANO]
- NUNCA de diagnosticos ou orientacoes medicas
- Para emergencias: "Ligue 192 (SAMU) ou va ao pronto-socorro"
- Se nao entender: repita o menu`

  useEffect(() => {
    const m = localStorage.getItem('medico')
    const a = localStorage.getItem('atendente')
    if (!m) { router.push('/login'); return }
    const med = JSON.parse(m); setMedico(med)
    setUsuario(a ? JSON.parse(a) : med)
    carregarConfig(med.id)
    carregarSofia(med.id)
    carregarAtendentes(med.id)
  }, [router])

  useEffect(() => {
    if (!medico) return
    carregarConversas()
    // Realtime subscription
    const channel = supabase.channel('whatsapp-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_mensagens' }, () => {
        carregarConversas()
        if (ativa) carregarMsgs(ativa.id)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_conversas' }, () => {
        carregarConversas()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [medico])

  useEffect(() => { if (ativa) carregarMsgs(ativa.id) }, [ativa])
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [mensagens])

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
    const nomeRemetente = usuario?.nome || medico?.nome
    const { data: nova } = await supabase.from('whatsapp_mensagens').insert({
      conversa_id: ativa.id, tipo: 'enviada', conteudo: texto,
      metadata: { manual: true, remetente: nomeRemetente }
    }).select().single()
    if (nova) setMensagens(p => [...p, nova])
    await fetch('/api/whatsapp/enviar', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telefone: ativa.telefone, texto, medico_id: medico.id })
    })
    setEnviando(false)
  }

  const assumirAtendimento = async () => {
    if (!ativa) return
    setAssumindo(true)
    const nomeAtendente = usuario?.nome || medico?.nome
    await supabase.from('whatsapp_conversas').update({
      modo: 'humano', atendente_nome: nomeAtendente
    }).eq('id', ativa.id)
    setAtiva({ ...ativa, modo: 'humano', atendente_nome: nomeAtendente })
    // Avisa o paciente
    const aviso = 'Voce esta sendo transferido para atendimento humano com ' + nomeAtendente + '. Em breve entraremos em contato. 😊'
    await fetch('/api/whatsapp/enviar', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telefone: ativa.telefone, texto: aviso, medico_id: medico.id })
    })
    await supabase.from('whatsapp_mensagens').insert({ conversa_id: ativa.id, tipo: 'enviada', conteudo: aviso, metadata: { sistema: true } })
    await carregarConversas()
    setAssumindo(false)
  }

  const devolverParaIA = async () => {
    if (!ativa) return
    await supabase.from('whatsapp_conversas').update({ modo: 'ia', atendente_nome: null }).eq('id', ativa.id)
    setAtiva({ ...ativa, modo: 'ia', atendente_nome: null })
    await carregarConversas()
  }

  const iniciarConversa = async () => {
    if (!novoTel.trim() || !novaMsgTexto.trim()) return
    setIniciando(true)
    const tel = novoTel.replace(/D/g, '')
    // Cria conversa
    const { data: conv } = await supabase.from('whatsapp_conversas').insert({
      telefone: tel, nome_contato: tel, medico_id: medico.id, status: 'ativa', modo: 'humano'
    }).select().single()
    if (conv) {
      await supabase.from('whatsapp_mensagens').insert({ conversa_id: conv.id, tipo: 'enviada', conteudo: novaMsgTexto, metadata: { manual: true, remetente: usuario?.nome } })
      await fetch('/api/whatsapp/enviar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telefone: tel, texto: novaMsgTexto, medico_id: medico.id })
      })
      await carregarConversas()
      setAtiva(conv)
    }
    setNovoTel(''); setNovaMsgTexto(''); setNovaConversa(false); setIniciando(false)
  }

  const carregarConfig = async (id: string) => {
    const { data } = await supabase.from('whatsapp_config').select('*').eq('medico_id', id).single()
    if (data) { setConfig(data); setForm(f => ({ ...f, nome_exibicao: data.nome_exibicao || '' })) }
  }

  const salvarConfig = async (e: React.FormEvent) => {
    e.preventDefault(); setSalvando(true); setCfgMsg(null)
    try {
      const r = await fetch('/api/whatsapp-config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ medico_id: medico.id, ...form }) })
      const d = await r.json()
      if (d.error) setCfgMsg({ tipo: 'erro', texto: d.error })
      else { setConfig(d.config); setCfgMsg({ tipo: 'ok', texto: 'Conectado! Numero: ' + d.meta?.phone }); setForm(f => ({ ...f, access_token: '', phone_number_id: '' })) }
    } catch (err: any) { setCfgMsg({ tipo: 'erro', texto: err.message }) }
    setSalvando(false)
  }

  const carregarSofia = async (id: string) => {
    const { data } = await supabase.from('whatsapp_config').select('sofia_prompt, sofia_ativo').eq('medico_id', id).single()
    if (data) { setSofiaPrompt(data.sofia_prompt || ''); setSofiaAtivo(data.sofia_ativo !== false) }
  }

  const salvarSofia = async () => {
    setSalvandoSofia(true)
    await supabase.from('whatsapp_config').update({ sofia_prompt: sofiaPrompt, sofia_ativo: sofiaAtivo }).eq('medico_id', medico.id)
    setSofiaMsg('Salvo!'); setTimeout(() => setSofiaMsg(''), 2000); setSalvandoSofia(false)
  }

  const carregarAtendentes = async (id: string) => {
    const r = await fetch('/api/atendentes?medico_id=' + id)
    const d = await r.json()
    setAtendentes(d.atendentes || [])
  }

  const adicionarAtendente = async (e: React.FormEvent) => {
    e.preventDefault(); setSalvandoAt(true); setAtMsg(null)
    const r = await fetch('/api/atendentes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ medico_id: medico.id, ...novoAtendente }) })
    const d = await r.json()
    if (d.error) setAtMsg({ tipo: 'erro', texto: d.error })
    else { setAtMsg({ tipo: 'ok', texto: novoAtendente.nome + ' adicionado!' }); setNovoAtendente({ nome: '', email: '', senha: '', cargo: 'Atendente' }); carregarAtendentes(medico.id) }
    setSalvandoAt(false)
  }

  const removerAtendente = async (id: string) => {
    await fetch('/api/atendentes?id=' + id, { method: 'DELETE' })
    carregarAtendentes(medico.id)
  }

  const fmt = (iso: string) => { const d = new Date(iso); return d.toDateString() === new Date().toDateString() ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) }
  const fmtH = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const nomeCv = (c: any) => c.nome_contato || c.telefone
  const ini = (n: string) => n?.split(' ').map((x: string) => x[0]).slice(0, 2).join('').toUpperCase() || '?'
  const totalNaoLidas = conversas.reduce((a, c) => a + c.naoLidas, 0)

  const conversasFiltradas = conversas.filter(c => {
    const buscaOk = nomeCv(c).toLowerCase().includes(busca.toLowerCase()) || c.telefone.includes(busca)
    const modoOk = filtroModo === 'todas' || c.modo === filtroModo
    return buscaOk && modoOk
  })

  const tabStyle = (t: Aba) => ({
    padding: '8px 14px', fontSize: 12, fontWeight: aba === t ? 700 : 500,
    color: aba === t ? '#6043C1' : '#6b7280', background: 'none', border: 'none',
    borderBottom: aba === t ? '2px solid #6043C1' : '2px solid transparent',
    cursor: 'pointer', whiteSpace: 'nowrap' as const, transition: 'all 0.15s'
  })

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#f9fafb', overflow: 'hidden' }}>
      <Sidebar activeHref="/whatsapp" />
      <main style={{ flex: 1, display: 'flex', overflow: 'hidden', flexDirection: 'column' }}>

        {/* Header */}
        <div style={{ background: 'transparent', borderBottom: 'none', padding: '0 24px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, paddingTop: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: '#ede9fb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="#6043C1"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              </div>
              <div>
                <h1 style={{ fontSize: 14, fontWeight: 800, color: '#111827', margin: 0 }}>WhatsApp IA</h1>
                <p style={{ fontSize: 10, color: config ? '#6043C1' : '#9ca3af', margin: 0 }}>● {config ? config.phone_number || config.phone_number_id : 'Desconectado'}</p>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {totalNaoLidas > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: 'white', background: '#6043C1', padding: '2px 8px', borderRadius: 20 }}>{totalNaoLidas} novas</span>}
              {usuario && <span style={{ fontSize: 11, color: '#6b7280', background: '#f3f4f6', padding: '3px 10px', borderRadius: 20 }}>👤 {usuario.nome}</span>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 0, marginTop: 8 }}>
            <button style={tabStyle('conversas')} onClick={() => setAba('conversas')}>💬 Conversas {totalNaoLidas > 0 && <span style={{ background: '#6043C1', color: 'white', borderRadius: 10, padding: '1px 5px', fontSize: 10, marginLeft: 3 }}>{totalNaoLidas}</span>}</button>
            <button style={tabStyle('sofia')} onClick={() => setAba('sofia')}>🤖 Sofia IA</button>
            <button style={tabStyle('equipe')} onClick={() => setAba('equipe')}>👥 Equipe</button>
            <button style={tabStyle('configuracao')} onClick={() => setAba('configuracao')}>⚙️ Configuracao</button>
          </div>
        </div>

        {/* ABA CONVERSAS */}
        {aba === 'conversas' && (
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            {/* Lista conversas */}
            <div style={{ width: 300, background: 'white', borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
              <div style={{ padding: '10px 12px', borderBottom: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input value={busca} onChange={e => setBusca(e.target.value)} style={{ flex: 1, padding: '7px 10px', fontSize: 12, borderRadius: 7, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', background: '#f9fafb', outline: 'none' }} placeholder="Buscar..."/>
                  <button onClick={() => setNovaConversa(true)} title="Nova conversa" style={{ width: 34, height: 34, borderRadius: 7, border: 'none', background: '#6043C1', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
                  </button>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {(['todas','ia','humano'] as const).map(f => (
                    <button key={f} onClick={() => setFiltroModo(f)} style={{ flex: 1, padding: '4px 0', fontSize: 10, fontWeight: filtroModo === f ? 700 : 400, borderRadius: 5, border: '1px solid ' + (filtroModo === f ? '#6043C1' : '#e5e7eb'), background: filtroModo === f ? '#F9FAFC' : 'white', color: filtroModo === f ? '#6043C1' : '#9ca3af', cursor: 'pointer' }}>
                      {f === 'todas' ? 'Todas' : f === 'ia' ? '🤖 IA' : '👤 Humano'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Modal nova conversa */}
              {novaConversa && (
                <div style={{ padding: '12px', borderBottom: 'none', background: '#F9FAFC' }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: '#6043C1', margin: '0 0 8px' }}>Nova conversa</p>
                  <input value={novoTel} onChange={e => setNovoTel(e.target.value)} style={{ width: '100%', padding: '7px 10px', fontSize: 12, borderRadius: 7, border: '1px solid #d4c9f7', marginBottom: 6, outline: 'none' }} placeholder="Numero (ex: 5511999887766)"/>
                  <input value={novaMsgTexto} onChange={e => setNovaMsgTexto(e.target.value)} style={{ width: '100%', padding: '7px 10px', fontSize: 12, borderRadius: 7, border: '1px solid #d4c9f7', marginBottom: 8, outline: 'none' }} placeholder="Primeira mensagem..."/>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={iniciarConversa} disabled={iniciando || !novoTel || !novaMsgTexto} style={{ flex: 1, padding: '7px', fontSize: 11, fontWeight: 700, borderRadius: 7, border: 'none', background: '#6043C1', color: 'white', cursor: 'pointer' }}>{iniciando ? 'Enviando...' : 'Iniciar'}</button>
                    <button onClick={() => { setNovaConversa(false); setNovoTel(''); setNovaMsgTexto('') }} style={{ padding: '7px 12px', fontSize: 11, borderRadius: 7, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', background: 'white', cursor: 'pointer', color: '#6b7280' }}>Cancelar</button>
                  </div>
                </div>
              )}

              <div style={{ flex: 1, overflow: 'auto' }}>
                {conversasFiltradas.length === 0 ? (
                  <div style={{ padding: '28px 16px', textAlign: 'center' }}>
                    <p style={{ fontSize: 12, color: '#9ca3af', margin: '0 0 4px' }}>Nenhuma conversa</p>
                    <p style={{ fontSize: 11, color: '#d1d5db', margin: 0 }}>Use + para iniciar uma nova</p>
                  </div>
                ) : conversasFiltradas.map(c => (
                  <div key={c.id} onClick={() => setAtiva(c)} style={{ padding: '9px 12px', borderBottom: '1px solid #f9fafb', cursor: 'pointer', background: ativa?.id === c.id ? '#F9FAFC' : 'white', borderLeft: ativa?.id === c.id ? '3px solid #6043C1' : '3px solid transparent' }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <div style={{ position: 'relative', flexShrink: 0 }}>
                        <div style={{ width: 34, height: 34, borderRadius: '50%', background: ativa?.id === c.id ? '#ede9fb' : '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: ativa?.id === c.id ? '#6043C1' : '#6b7280' }}>{ini(nomeCv(c))}</div>
                        <span style={{ position: 'absolute', bottom: 0, right: 0, width: 10, height: 10, borderRadius: '50%', background: c.modo === 'humano' ? '#f59e0b' : '#6043C1', border: '1.5px solid white' }}/>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 1 }}>
                          <p style={{ fontSize: 12, fontWeight: c.naoLidas > 0 ? 700 : 500, color: '#111827', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nomeCv(c)}</p>
                          <span style={{ fontSize: 9, color: '#9ca3af', flexShrink: 0, marginLeft: 4 }}>{c.ultima ? fmt(c.ultima.criado_em) : ''}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <p style={{ fontSize: 11, color: '#9ca3af', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{c.ultima?.tipo === 'enviada' && '✓ '}{c.ultima?.conteudo?.substring(0, 32) || ''}</p>
                          <div style={{ display: 'flex', gap: 3, marginLeft: 4, flexShrink: 0 }}>
                            {c.naoLidas > 0 && <span style={{ fontSize: 9, fontWeight: 700, color: 'white', background: '#6043C1', width: 15, height: 15, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{c.naoLidas}</span>}
                            {c.modo === 'humano' && <span style={{ fontSize: 8, color: '#92400e', background: '#fef3c7', padding: '1px 4px', borderRadius: 4, fontWeight: 700 }}>👤</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Area de chat */}
            {ativa ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f0f2f5' }}>
                {/* Header conversa */}
                <div style={{ background: 'transparent', borderBottom: 'none', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                  <div style={{ position: 'relative' }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#ede9fb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#6043C1' }}>{ini(nomeCv(ativa))}</div>
                    <span style={{ position: 'absolute', bottom: 0, right: 0, width: 11, height: 11, borderRadius: '50%', background: ativa.modo === 'humano' ? '#f59e0b' : '#6043C1', border: '2px solid white' }}/>
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: '#111827', margin: 0 }}>{nomeCv(ativa)}</p>
                    <p style={{ fontSize: 11, color: '#9ca3af', margin: 0 }}>
                      {ativa.telefone} · {ativa.modo === 'humano' ? '👤 Humano' + (ativa.atendente_nome ? ' — ' + ativa.atendente_nome : '') : '🤖 Sofia IA'}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {ativa.paciente_id && <a href={'/pacientes/' + ativa.paciente_id} style={{ fontSize: 11, color: '#6043C1', background: '#F9FAFC', border: '1px solid #d4c9f7', padding: '4px 10px', borderRadius: 6, textDecoration: 'none', fontWeight: 600 }}>Ver ficha</a>}
                    {ativa.modo === 'ia' ? (
                      <button onClick={assumirAtendimento} disabled={assumindo} style={{ fontSize: 11, fontWeight: 700, color: '#92400e', background: '#fffbeb', border: '1px solid #fde68a', padding: '4px 12px', borderRadius: 6, cursor: 'pointer' }}>
                        {assumindo ? 'Assumindo...' : '👤 Assumir atendimento'}
                      </button>
                    ) : (
                      <button onClick={devolverParaIA} style={{ fontSize: 11, fontWeight: 700, color: '#6043C1', background: '#F9FAFC', border: '1px solid #d4c9f7', padding: '4px 12px', borderRadius: 6, cursor: 'pointer' }}>
                        🤖 Devolver para IA
                      </button>
                    )}
                  </div>
                </div>

                {/* Banner modo humano */}
                {ativa.modo === 'humano' && (
                  <div style={{ background: '#fffbeb', borderBottom: '1px solid #fde68a', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14 }}>👤</span>
                    <p style={{ fontSize: 12, color: '#92400e', margin: 0 }}>Atendimento humano ativo{ativa.atendente_nome ? ' — ' + ativa.atendente_nome : ''}. A Sofia IA esta pausada nesta conversa.</p>
                  </div>
                )}

                {/* Mensagens */}
                <div style={{ flex: 1, overflow: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {mensagens.map(m => {
                    const rec = m.tipo === 'recebida'
                    const remetente = m.metadata?.remetente
                    const isIA = m.metadata?.ia
                    const isSistema = m.metadata?.sistema
                    if (isSistema) return (
                      <div key={m.id} style={{ textAlign: 'center', margin: '4px 0' }}>
                        <span style={{ fontSize: 10, color: '#9ca3af', background: '#f3f4f6', padding: '3px 10px', borderRadius: 20 }}>{m.conteudo}</span>
                      </div>
                    )
                    return (
                      <div key={m.id} style={{ display: 'flex', justifyContent: rec ? 'flex-start' : 'flex-end' }}>
                        <div style={{ maxWidth: '68%', padding: '7px 11px', borderRadius: rec ? '4px 10px 10px 10px' : '10px 4px 10px 10px', background: rec ? 'white' : (isIA ? '#ede9fb' : '#dbeafe'), border: rec ? '1px solid #e5e7eb' : (isIA ? '1px solid #d4c9f7' : '1px solid #bfdbfe') }}>
                          {(isIA || remetente) && <p style={{ fontSize: 9, color: isIA ? '#6043C1' : '#2563eb', fontWeight: 700, margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{isIA ? 'Sofia IA' : remetente}</p>}
                          <p style={{ fontSize: 12, color: '#111827', margin: 0, lineHeight: 1.5, whiteSpace: 'pre-line' }}>{m.conteudo}</p>
                          <p style={{ fontSize: 9, color: '#9ca3af', margin: '3px 0 0', textAlign: rec ? 'left' : 'right' }}>{fmtH(m.criado_em)}</p>
                        </div>
                      </div>
                    )
                  })}
                  <div ref={endRef}/>
                </div>

                {/* Input */}
                <div style={{ background: 'white', borderTop: '1px solid #e5e7eb', padding: '10px 14px', display: 'flex', gap: 8, alignItems: 'flex-end', flexShrink: 0 }}>
                  <textarea value={msg} onChange={e => setMsg(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar() } }} style={{ flex: 1, padding: '9px 12px', fontSize: 12, borderRadius: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', resize: 'none', minHeight: 40, maxHeight: 100, lineHeight: 1.5, outline: 'none' }} placeholder="Mensagem... (Enter para enviar)"/>
                  <button onClick={enviar} disabled={!msg.trim() || enviando} style={{ width: 40, height: 40, borderRadius: '50%', border: 'none', background: msg.trim() ? '#6043C1' : '#e5e7eb', cursor: msg.trim() ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f2f5', flexDirection: 'column', gap: 12 }}>
                <div style={{ width: 56, height: 56, borderRadius: 14, background: '#ede9fb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="#6043C1"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                </div>
                <p style={{ fontSize: 14, fontWeight: 600, color: '#374151', margin: 0 }}>Selecione uma conversa</p>
                <button onClick={() => setNovaConversa(true)} style={{ fontSize: 12, color: '#6043C1', background: '#F9FAFC', border: '1px solid #d4c9f7', padding: '7px 16px', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>+ Nova conversa</button>
              </div>
            )}
          </div>
        )}

        {/* ABA SOFIA */}
        {aba === 'sofia' && (
          <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
            <div style={{ maxWidth: 720 }}>
              <div style={{ background: 'white', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', borderRadius: 14, overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <h2 style={{ fontSize: 14, fontWeight: 700, color: '#111827', margin: '0 0 2px' }}>Sofia IA — Assistente Virtual</h2>
                    <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>Configure como a IA se comporta em todas as conversas</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, color: sofiaAtivo ? '#6043C1' : '#9ca3af', fontWeight: 600 }}>{sofiaAtivo ? 'Ativa' : 'Pausada'}</span>
                    <button onClick={() => setSofiaAtivo(!sofiaAtivo)} style={{ width: 40, height: 22, borderRadius: 11, border: 'none', background: sofiaAtivo ? '#6043C1' : '#d1d5db', cursor: 'pointer', position: 'relative' }}>
                      <span style={{ position: 'absolute', top: 2, left: sofiaAtivo ? 18 : 2, width: 18, height: 18, borderRadius: '50%', background: 'white', transition: 'left .2s' }}/>
                    </button>
                  </div>
                </div>
                <div style={{ padding: '18px 20px' }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Instrucoes da Sofia</label>
                  <p style={{ fontSize: 11, color: '#9ca3af', margin: '0 0 10px' }}>Define personalidade, fluxo e regras. Quanto mais detalhado, melhor.</p>
                  <textarea value={sofiaPrompt || PROMPT_DEFAULT} onChange={e => setSofiaPrompt(e.target.value)} style={{ width: '100%', minHeight: 360, padding: '12px', fontSize: 12, borderRadius: 9, border: '1.5px solid #e5e7eb', resize: 'vertical', lineHeight: 1.7, fontFamily: 'monospace' }}/>
                  <div style={{ background: '#F9FAFC', border: '1px solid #d4c9f7', borderRadius: 9, padding: '10px 14px', margin: '14px 0' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                      {['Responde 24h automaticamente','Agenda consultas no sistema','Envia horarios disponiveis','Reconhece pacientes cadastrados','Escalona para humano quando pedido','Segue fluxo de menu configurado'].map(c => (
                        <div key={c} style={{ display: 'flex', gap: 6 }}><span style={{ color: '#6043C1' }}>✓</span><span style={{ fontSize: 11, color: '#374151' }}>{c}</span></div>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={salvarSofia} disabled={salvandoSofia} style={{ padding: '9px 20px', borderRadius: 9, border: 'none', background: '#6043C1', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{salvandoSofia ? 'Salvando...' : 'Salvar'}</button>
                    <button onClick={() => setSofiaPrompt(PROMPT_DEFAULT)} style={{ padding: '9px 14px', borderRadius: 9, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', background: 'white', color: '#6b7280', fontSize: 12, cursor: 'pointer' }}>Restaurar padrao</button>
                    {sofiaMsg && <span style={{ fontSize: 12, color: '#6043C1', fontWeight: 600, alignSelf: 'center' }}>{sofiaMsg}</span>}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ABA EQUIPE */}
        {aba === 'equipe' && (
          <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
            <div style={{ maxWidth: 680 }}>
              <div style={{ background: 'white', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', borderRadius: 14, overflow: 'hidden', marginBottom: 20 }}>
                <div style={{ padding: '14px 20px', borderBottom: 'none' }}>
                  <h2 style={{ fontSize: 14, fontWeight: 700, color: '#111827', margin: '0 0 2px' }}>Equipe de atendimento</h2>
                  <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>Atendentes podem acessar a plataforma e responder conversas com o proprio nome</p>
                </div>
                <div style={{ padding: '16px 20px' }}>
                  {atendentes.length === 0 ? (
                    <p style={{ fontSize: 13, color: '#9ca3af', margin: '8px 0' }}>Nenhum atendente cadastrado ainda</p>
                  ) : atendentes.map(a => (
                    <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid #f9fafb' }}>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#2563eb' }}>{ini(a.nome)}</div>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: '#111827', margin: 0 }}>{a.nome}</p>
                        <p style={{ fontSize: 11, color: '#9ca3af', margin: 0 }}>{a.email} · {a.cargo}</p>
                      </div>
                      <button onClick={() => removerAtendente(a.id)} style={{ fontSize: 11, color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', padding: '4px 10px', borderRadius: 6, cursor: 'pointer' }}>Remover</button>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ background: 'white', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', borderRadius: 14, overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: 'none' }}>
                  <h2 style={{ fontSize: 14, fontWeight: 700, color: '#111827', margin: 0 }}>Adicionar atendente</h2>
                </div>
                <form onSubmit={adicionarAtendente} style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Nome *</label>
                      <input required value={novoAtendente.nome} onChange={e => setNovoAtendente(a => ({ ...a, nome: e.target.value }))} style={{ width: '100%', padding: '8px 10px', fontSize: 13, borderRadius: 7, border: '1.5px solid #e5e7eb' }} placeholder="Maria Silva"/>
                    </div>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Cargo</label>
                      <input value={novoAtendente.cargo} onChange={e => setNovoAtendente(a => ({ ...a, cargo: e.target.value }))} style={{ width: '100%', padding: '8px 10px', fontSize: 13, borderRadius: 7, border: '1.5px solid #e5e7eb' }} placeholder="Atendente"/>
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Email *</label>
                    <input required type="email" value={novoAtendente.email} onChange={e => setNovoAtendente(a => ({ ...a, email: e.target.value }))} style={{ width: '100%', padding: '8px 10px', fontSize: 13, borderRadius: 7, border: '1.5px solid #e5e7eb' }} placeholder="maria@clinica.com"/>
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Senha *</label>
                    <input required type="password" value={novoAtendente.senha} onChange={e => setNovoAtendente(a => ({ ...a, senha: e.target.value }))} style={{ width: '100%', padding: '8px 10px', fontSize: 13, borderRadius: 7, border: '1.5px solid #e5e7eb' }} placeholder="Senha de acesso"/>
                  </div>
                  {atMsg && <div style={{ background: atMsg.tipo === 'ok' ? '#F9FAFC' : '#fef2f2', border: '1px solid ' + (atMsg.tipo === 'ok' ? '#d4c9f7' : '#fecaca'), borderRadius: 8, padding: '8px 12px' }}><p style={{ fontSize: 12, color: atMsg.tipo === 'ok' ? '#6043C1' : '#dc2626', margin: 0 }}>{atMsg.texto}</p></div>}
                  <button type="submit" disabled={salvandoAt} style={{ padding: '10px', borderRadius: 9, border: 'none', background: '#6043C1', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{salvandoAt ? 'Adicionando...' : 'Adicionar atendente'}</button>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* ABA CONFIGURACAO */}
        {aba === 'configuracao' && (
          <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
            <div style={{ maxWidth: 680 }}>
              {config && (
                <div style={{ background: '#F9FAFC', border: '1px solid #d4c9f7', borderRadius: 12, padding: '12px 16px', marginBottom: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 30, height: 30, borderRadius: 7, background: '#6043C1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                    </div>
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 700, color: '#6043C1', margin: 0 }}>WhatsApp conectado</p>
                      <p style={{ fontSize: 11, color: '#6043C1', margin: 0 }}>{config.phone_number} · {config.nome_exibicao}</p>
                    </div>
                  </div>
                  <button onClick={async () => { await fetch('/api/whatsapp-config?medico_id=' + medico.id, { method: 'DELETE' }); setConfig(null) }} style={{ fontSize: 11, color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', padding: '4px 10px', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>Desconectar</button>
                </div>
              )}
              <div style={{ background: 'white', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', borderRadius: 14, overflow: 'hidden', marginBottom: 18 }}>
                <div style={{ padding: '14px 20px', borderBottom: 'none' }}>
                  <h2 style={{ fontSize: 14, fontWeight: 700, color: '#111827', margin: '0 0 2px' }}>{config ? 'Atualizar' : 'Conectar'} numero WhatsApp</h2>
                  <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>Cada clinica usa seu proprio numero oficial</p>
                </div>
                <form onSubmit={salvarConfig} style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Phone Number ID *</label>
                    <input required value={form.phone_number_id} onChange={e => setForm(f => ({ ...f, phone_number_id: e.target.value }))} style={{ width: '100%', padding: '9px 12px', fontSize: 13, borderRadius: 8, border: '1.5px solid #e5e7eb', fontFamily: 'monospace' }} placeholder="1030374870164992"/>
                    <p style={{ fontSize: 10, color: '#9ca3af', margin: '3px 0 0' }}>Meta → WhatsApp → Configuracao da API → Identificacao do numero de telefone</p>
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Token de acesso permanente *</label>
                    <input required type="password" value={form.access_token} onChange={e => setForm(f => ({ ...f, access_token: e.target.value }))} style={{ width: '100%', padding: '9px 12px', fontSize: 13, borderRadius: 8, border: '1.5px solid #e5e7eb', fontFamily: 'monospace' }} placeholder="EAANoj..."/>
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Nome da clinica</label>
                    <input value={form.nome_exibicao} onChange={e => setForm(f => ({ ...f, nome_exibicao: e.target.value }))} style={{ width: '100%', padding: '9px 12px', fontSize: 13, borderRadius: 8, border: '1.5px solid #e5e7eb' }} placeholder="Clinica Dr. Silva"/>
                  </div>
                  {cfgMsg && <div style={{ background: cfgMsg.tipo === 'ok' ? '#F9FAFC' : '#fef2f2', border: '1px solid ' + (cfgMsg.tipo === 'ok' ? '#d4c9f7' : '#fecaca'), borderRadius: 8, padding: '8px 12px' }}><p style={{ fontSize: 12, color: cfgMsg.tipo === 'ok' ? '#6043C1' : '#dc2626', margin: 0 }}>{cfgMsg.texto}</p></div>}
                  <button type="submit" disabled={salvando} style={{ padding: '10px', borderRadius: 9, border: 'none', background: '#6043C1', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{salvando ? 'Validando...' : config ? 'Atualizar' : 'Conectar WhatsApp'}</button>
                </form>
              </div>
              <div style={{ background: 'white', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', borderRadius: 14, overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: 'none' }}>
                  <h2 style={{ fontSize: 14, fontWeight: 700, color: '#111827', margin: '0 0 2px' }}>Webhook Meta</h2>
                </div>
                <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[{ label: 'URL do callback', valor: WEBHOOK_URL }, { label: 'Token de verificacao', valor: VERIFY_TOKEN }].map(item => (
                    <div key={item.label}>
                      <p style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{item.label}</p>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <code style={{ flex: 1, padding: '7px 10px', background: '#f9fafb', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', borderRadius: 6, fontSize: 12, fontFamily: 'monospace', color: '#374151' }}>{item.valor}</code>
                        <button onClick={() => navigator.clipboard.writeText(item.valor)} style={{ padding: '6px 10px', background: 'white', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', borderRadius: 6, fontSize: 11, color: '#6b7280', cursor: 'pointer' }}>Copiar</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
                      }
