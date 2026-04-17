'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { useToast } from '@/components/Toast'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Sidebar } from '@/components/Sidebar'

type Aba = 'conversas' | 'sofia' | 'equipe' | 'dashboard' | 'alertas' | 'campanha' | 'relatorio' | 'aderencia' | 'agenda' | 'nps' | 'configuracao' | 'transmissao'

export default function WhatsApp() {
  const router = useRouter()
  const { toast } = useToast()
  const [medico, setMedico] = useState<any>(null)
  const [alertas, setAlertas] = useState<any[]>([])
  const [inativos, setInativos] = useState<any[]>([])
  const [alertasNaoLidos, setAlertasNaoLidos] = useState(0)
  const [checkinEnviando, setCheckinEnviando] = useState(false)
  const [campanhas, setCampanhas] = useState<any[]>([])
  const [campanhaMsg, setCampanhaMsg] = useState('')
  const [campanhaEnviando, setCampanhaEnviando] = useState(false)
  const [relatorio, setRelatorio] = useState<any>(null)
  const [relatorioCarregando, setRelatorioCarregando] = useState(false)
  const [aderencias, setAderencias] = useState<any[]>([])
  const [aderenciaCarregando, setAderenciaCarregando] = useState(false)
  const [agenda24h, setAgenda24h] = useState<any[]>([])
  const [confirmacaoEnviando, setConfirmacaoEnviando] = useState(false)
  const [metricas, setMetricas] = useState<any>(null)
  const [npsData, setNpsData] = useState<any>(null)
  const [npsEnviando, setNpsEnviando] = useState(false)
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

  // listas de transmissao
  const [listas, setListas] = useState<any[]>([])
  const [novaLista, setNovaLista] = useState({ nome: '', descricao: '' })
  const [listaSelecionada, setListaSelecionada] = useState<any>(null)
  const [msgTransmissao, setMsgTransmissao] = useState('')
  const [enviandoTransmissao, setEnviandoTransmissao] = useState(false)
  const [gravandoAudio, setGravandoAudio] = useState(false)
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const [msgHover, setMsgHover] = useState<string | null>(null)
  const [msgMenu, setMsgMenu] = useState<string | null>(null)
  const [respondendoMsg, setRespondendoMsg] = useState<any>(null)
  const [menuAnexo, setMenuAnexo] = useState(false)

  // configuracao
  const [wizardPasso, setWizardPasso] = useState(1)
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
Ola! Sou a Sofia, assistente virtual da clinica. Como posso ajudar? 

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

  const iniciarAudio = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream)
      audioChunksRef.current = []
      mr.ondataavailable = e => audioChunksRef.current.push(e.data)
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        if (blob.size < 1000) return
        const form = new FormData()
        form.append('audio', blob, 'audio.webm')
        const res = await fetch('/api/transcrever', { method: 'POST', body: form })
        const data = await res.json()
        if (data.texto?.trim()) setMsg(prev => prev ? prev + ' ' + data.texto : data.texto)
        toast('Áudio transcrito! Revise e envie.')
      }
      mr.start()
      setMediaRecorder(mr)
      setGravandoAudio(true)
    } catch { toast('Erro ao acessar microfone', 'error') }
  }

  const pararAudio = () => {
    mediaRecorder?.stop()
    setMediaRecorder(null)
    setGravandoAudio(false)
  }

  const carregarMetricas = async () => {
    if (!medico) return
    const r = await fetch('/api/whatsapp-metricas?medico_id=' + medico.id)
    const d = await r.json()
    setMetricas(d)
  }

  const carregarNps = async () => {
    if (!medico) return
    const r = await fetch('/api/whatsapp-nps?medico_id=' + medico.id)
    const d = await r.json()
    setNpsData(d)
  }

  const carregarCampanhas = async () => {
    if (!medico) return
    const r = await fetch('/api/whatsapp-campanha?medico_id=' + medico.id)
    const d = await r.json()
    setCampanhas(d.campanhas || [])
  }

  const carregarAlertas = async () => {
    if (!medico) return
    const [ra, ri] = await Promise.all([
      fetch('/api/whatsapp-alertas?medico_id=' + medico.id + '&lido=false').then(r => r.json()),
      fetch('/api/whatsapp-checkin?medico_id=' + medico.id + '&dias=7').then(r => r.json()),
    ])
    setAlertas(ra.alertas || [])
    setAlertasNaoLidos((ra.alertas || []).length)
    setInativos(ri.inativos || [])
  }

  useEffect(() => { if (medico) { carregarAlertas(); carregarMetricas() } }, [medico])

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
    const aviso = 'Voce esta sendo transferido para atendimento humano com ' + nomeAtendente + '. Em breve entraremos em contato. '
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

  const [filtroNaoLidas, setFiltroNaoLidas] = useState(false)
  const conversasFiltradas = conversas.filter(c => {
    const buscaOk = nomeCv(c).toLowerCase().includes(busca.toLowerCase()) || c.telefone.includes(busca)
    const modoOk = filtroModo === 'todas' || c.modo === filtroModo
    const naoLidasOk = !filtroNaoLidas || c.naoLidas > 0
    return buscaOk && modoOk && naoLidasOk
  })

  const tabStyle = (t: Aba) => ({
    padding: '8px 14px', fontSize: 12, fontWeight: aba === t ? 700 : 500,
    color: aba === t ? '#6043C1' : '#6b7280', background: 'none', border: 'none',
    borderBottom: aba === t ? '2px solid #6043C1' : '2px solid transparent',
    cursor: 'pointer', whiteSpace: 'nowrap' as const, transition: 'all 0.15s'
  })

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#F9FAFC', overflow: 'hidden' }}>
      <Sidebar />
      <main style={{ flex: 1, display: 'flex', overflow: 'hidden', flexDirection: 'column', padding: '16px 16px 16px 0' }}>

        {/* Header */}
        <div style={{ background: 'transparent', borderBottom: 'none', padding: '0 24px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, paddingTop: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: '#ede9fb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="#6043C1"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              </div>
              <div>
                <h1 style={{ fontSize: 14, fontWeight: 800, color: '#111827', margin: 0 }}>WhatsApp IA</h1>
                <p style={{ fontSize: 10, color: config ? '#6043C1' : '#9ca3af', margin: 0 }}> {config ? config.phone_number || config.phone_number_id : 'Desconectado'}</p>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {totalNaoLidas > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: 'white', background: '#6043C1', padding: '2px 8px', borderRadius: 20 }}>{totalNaoLidas} novas</span>}
              {usuario && <span style={{ fontSize: 11, color: '#6b7280', background: '#f3f4f6', padding: '3px 10px', borderRadius: 20 }}> {usuario.nome}</span>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 0, marginTop: 8, overflowX: 'auto', borderBottom: '1px solid #f3f4f6', paddingBottom: 0 }}>
            {([
              { id: 'conversas', label: `Conversas${totalNaoLidas > 0 ? ` (${totalNaoLidas})` : ''}` },
              { id: 'dashboard', label: 'Dashboard' },
              { id: 'transmissao', label: 'Transmissão' },
              { id: 'campanha', label: 'Campanhas' },
              { id: 'alertas', label: `Alertas${alertasNaoLidos > 0 ? ` (${alertasNaoLidos})` : ''}` },
              { id: 'agenda', label: 'Confirmações' },
              { id: 'aderencia', label: 'Aderência' },
              { id: 'nps', label: 'NPS' },
              { id: 'relatorio', label: 'Relatório' },
              { id: 'sofia', label: 'Sofia IA' },
              { id: 'equipe', label: 'Equipe' },
              { id: 'configuracao', label: !config ? '⚠ Conectar' : 'Configuração' },
            ] as {id: Aba, label: string}[]).map(t => (
              <button key={t.id} style={{
                padding: '10px 14px', fontSize: 12,
                fontWeight: aba === t.id ? 700 : 500,
                color: t.id === 'configuracao' && !config ? '#d97706' : aba === t.id ? '#16a34a' : '#6b7280',
                background: 'none', border: 'none',
                borderBottom: aba === t.id ? '2px solid #16a34a' : '2px solid transparent',
                cursor: 'pointer', whiteSpace: 'nowrap' as const,
                flexShrink: 0,
              }} onClick={() => setAba(t.id)}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* ABA CONVERSAS */}
        {aba === 'conversas' && (
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden', gap: 16 }}>
            {/* Lista conversas */}
            <div style={{ width: 300, background: 'white', borderRight: 'none', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
              <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, background: '#f0f2f5', borderRadius: 8, padding: '6px 12px' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#667781" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
                    <input value={busca} onChange={e => setBusca(e.target.value)} style={{ flex: 1, border: 'none', outline: 'none', fontSize: 14, background: 'transparent', color: '#111', fontFamily: 'inherit' }} placeholder="Pesquisar ou começar uma nova conversa"/>
                  </div>
                  <button onClick={() => setNovaConversa(true)} title="Nova conversa" style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', background: 'none', color: '#54656f', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f0f2f5')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
                  </button>
                </div>
                <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
                  {[
                    { label: 'Tudo', active: filtroModo === 'todas' && !filtroNaoLidas, fn: () => { setFiltroModo('todas'); setFiltroNaoLidas(false) } },
                    { label: 'Não lidas', active: filtroNaoLidas, fn: () => setFiltroNaoLidas(!filtroNaoLidas) },
                    { label: 'Sofia IA', active: filtroModo === 'ia', fn: () => { setFiltroModo(filtroModo === 'ia' ? 'todas' : 'ia'); setFiltroNaoLidas(false) } },
                    { label: 'Humano', active: filtroModo === 'humano', fn: () => { setFiltroModo(filtroModo === 'humano' ? 'todas' : 'humano'); setFiltroNaoLidas(false) } },
                  ].map(f => (
                    <button key={f.label} onClick={f.fn} style={{ padding: '4px 12px', fontSize: 12, fontWeight: f.active ? 600 : 400, borderRadius: 20, border: 'none', background: f.active ? '#d1f4cc' : '#f0f2f5', color: f.active ? '#166534' : '#111827', cursor: 'pointer', whiteSpace: 'nowrap' as const, flexShrink: 0 }}>
                      {f.label}
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
                ) : conversasFiltradas.map(cv => (
                  <div key={cv.id} onClick={() => setAtiva(cv)}
                    style={{ padding: '10px 16px', cursor: 'pointer', background: ativa?.id === cv.id ? '#f0f2f5' : 'white', borderBottom: '1px solid #e9edef' }}
                    onMouseEnter={e => { if (ativa?.id !== cv.id) (e.currentTarget as HTMLElement).style.background = '#f5f6f6' }}
                    onMouseLeave={e => { if (ativa?.id !== cv.id) (e.currentTarget as HTMLElement).style.background = 'white' }}>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <div style={{ width: 49, height: 49, borderRadius: '50%', background: cv.modo === 'humano' ? '#cfd8dc' : '#b2dfdb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 400, color: 'white', flexShrink: 0 }}>
                        {ini(nomeCv(cv))}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 3 }}>
                          <p style={{ fontSize: 15, fontWeight: 400, color: '#111827', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{nomeCv(cv)}</p>
                          <span style={{ fontSize: 11, color: cv.naoLidas > 0 ? '#25d366' : '#667781', flexShrink: 0, marginLeft: 8 }}>{cv.ultima ? fmt(cv.ultima.criado_em) : ''}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <p style={{ fontSize: 13, color: '#667781', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, flex: 1 }}>
                            {cv.ultima?.tipo === 'enviada' && <svg style={{ display: 'inline', marginRight: 2, verticalAlign: 'middle' }} width="14" height="10" viewBox="0 0 16 11" fill="none"><path d="M1 5.5L5 9.5L15 1" stroke="#53bdeb" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M5 5.5L9 9.5L15 1" stroke="#53bdeb" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}{cv.ultima?.conteudo?.substring(0, 38) || ''}
                          </p>
                          {cv.naoLidas > 0 && (
                            <span style={{ fontSize: 11, fontWeight: 600, color: 'white', background: '#25d366', minWidth: 20, height: 20, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px', marginLeft: 8, flexShrink: 0 }}>{cv.naoLidas}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
            {ativa ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f0f2f5' }}>
                {/* Header conversa — estilo WhatsApp Web real */}
                <div style={{ background: 'white', borderBottom: '1px solid #e9edef', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: ativa.modo === 'humano' ? '#f0f2f5' : '#d1f4cc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 600, color: '#111827', flexShrink: 0 }}>{ini(nomeCv(ativa))}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 15, fontWeight: 500, color: '#111827', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{nomeCv(ativa)}</p>
                    <p style={{ fontSize: 12, color: '#667781', margin: 0 }}>
                      {ativa.modo === 'humano' ? 'Atendimento humano' + (ativa.atendente_nome ? ' · ' + ativa.atendente_nome : '') : 'Sofia IA · online'}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    {ativa.paciente_id && (
                      <a href={'/pacientes/' + ativa.paciente_id} style={{ fontSize: 12, color: '#54656f', background: '#f0f2f5', border: 'none', padding: '5px 12px', borderRadius: 20, textDecoration: 'none', fontWeight: 500 }}>Ver ficha</a>
                    )}
                    {ativa.modo === 'ia' ? (
                      <button onClick={assumirAtendimento} disabled={assumindo} style={{ fontSize: 12, fontWeight: 500, color: '#111827', background: '#f0f2f5', border: 'none', padding: '5px 14px', borderRadius: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                        {assumindo ? 'Assumindo...' : 'Assumir'}
                      </button>
                    ) : (
                      <button onClick={devolverParaIA} style={{ fontSize: 12, fontWeight: 500, color: '#111827', background: '#f0f2f5', border: 'none', padding: '5px 14px', borderRadius: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>
                        Devolver à IA
                      </button>
                    )}
                    <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#54656f', padding: 8, display: 'flex', borderRadius: '50%' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#f0f2f5')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
                    </button>
                    <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#54656f', padding: 8, display: 'flex', borderRadius: '50%' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#f0f2f5')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
                    </button>
                  </div>
                </div>

                {/* Banner modo humano */}
                {ativa.modo === 'humano' && (
                  <div style={{ background: '#fff8e6', borderBottom: '1px solid #f0e0a0', padding: '7px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#92400e" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                    <p style={{ fontSize: 12, color: '#92400e', margin: 0 }}>Atendimento manual ativo — Sofia IA pausada nesta conversa</p>
                  </div>
                )}

                {/* Mensagens */}
                <div style={{ flex: 1, overflow: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 4, background: '#e5ddd5', backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }}>
                  {mensagens.map((m, idx) => {
                    const rec = m.tipo === 'recebida'
                    const dataAtual = new Date(m.criado_em).toDateString()
                    const dataAnterior = idx > 0 ? new Date(mensagens[idx-1].criado_em).toDateString() : null
                    const mostraData = idx === 0 || dataAtual !== dataAnterior
                    const fmtData = (iso: string) => {
                      const d = new Date(iso)
                      const hoje = new Date()
                      const ontem = new Date(hoje); ontem.setDate(hoje.getDate() - 1)
                      if (d.toDateString() === hoje.toDateString()) return 'Hoje'
                      if (d.toDateString() === ontem.toDateString()) return 'Ontem'
                      return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
                    }
                    const remetente = m.metadata?.remetente
                    const isIA = m.metadata?.ia
                    const isSistema = m.metadata?.sistema
                    if (isSistema) return (
                      <div key={m.id} style={{ textAlign: 'center', margin: '4px 0' }}>
                        <span style={{ fontSize: 10, color: '#9ca3af', background: '#f3f4f6', padding: '3px 10px', borderRadius: 20 }}>{m.conteudo}</span>
                      </div>
                    )
                    return (
                      <div key={m.id + '_wrapper'}>
                        {mostraData && (
                          <div style={{ textAlign: 'center', margin: '12px 0 8px' }}>
                            <span style={{ fontSize: 11, color: '#667781', background: 'rgba(255,255,255,0.85)', padding: '4px 12px', borderRadius: 8, boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>{fmtData(m.criado_em)}</span>
                          </div>
                        )}
                      <div key={m.id}
                        style={{ display: 'flex', justifyContent: rec ? 'flex-start' : 'flex-end', marginBottom: 2, position: 'relative' as const }}
                        onMouseEnter={() => setMsgHover(String(m.id))}
                        onMouseLeave={() => { setMsgHover(null); setMsgMenu(null) }}>
                        <div style={{ maxWidth: '65%', padding: '7px 10px 6px 10px', borderRadius: rec ? '0px 10px 10px 10px' : '10px 10px 0px 10px', background: rec ? 'white' : (isIA ? '#d9fdd3' : '#d1e7ff'), boxShadow: '0 1px 2px rgba(0,0,0,0.15)', position: 'relative' as const }}>
                          {!rec && isIA && <p style={{ fontSize: 10, fontWeight: 700, color: '#16a34a', margin: '0 0 3px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Sofia IA</p>}
                          {!rec && !isIA && remetente && <p style={{ fontSize: 10, fontWeight: 700, color: '#2563eb', margin: '0 0 3px' }}>{remetente}</p>}
                          <p style={{ fontSize: 13, color: '#111827', margin: 0, lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: m.conteudo
                            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                            .replace(/\*(.*?)\*/g, '<em>$1</em>')
                            .replace(/---+/g, '<hr style="border:none;border-top:1px solid rgba(0,0,0,0.15);margin:4px 0"/>')
                            .split('\n').join('<br/>')
                          }} />
                          <p style={{ fontSize: 9, color: '#9ca3af', margin: '3px 0 0', textAlign: rec ? 'left' : 'right' }}>{fmtH(m.criado_em)}</p>
                        </div>
                        {/* Ações hover */}
                        {msgHover === String(m.id) && (
                          <div style={{ position: 'absolute' as const, top: 4, right: rec ? 'auto' : 4, left: rec ? 4 : 'auto', display: 'flex', gap: 2, zIndex: 10 }}>
                            <button onClick={() => setRespondendoMsg(m)} style={{ width: 26, height: 26, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.1)', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Responder">↩</button>
                            <button onClick={() => navigator.clipboard.writeText(m.conteudo)} style={{ width: 26, height: 26, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.1)', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Copiar">📋</button>
                            <button onClick={() => setMsgMenu(msgMenu === m.id ? null : m.id)} style={{ width: 26, height: 26, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.1)', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Mais">⌄</button>
                          </div>
                        )}
                        {/* Menu contexto */}
                        {msgMenu === String(m.id) && (
                          <div style={{ position: 'absolute' as const, top: 30, right: rec ? 'auto' : 4, left: rec ? 4 : 'auto', background: 'white', borderRadius: 8, boxShadow: '0 4px 20px rgba(0,0,0,0.15)', zIndex: 20, minWidth: 160, overflow: 'hidden' }}>
                            {[
                              { label: '↩ Responder', fn: () => { setRespondendoMsg(m); setMsgMenu(null) } },
                              { label: '📋 Copiar', fn: () => { navigator.clipboard.writeText(m.conteudo); setMsgMenu(null) } },
                              { label: '⭐ Favoritar', fn: () => setMsgMenu(null) },
                            ].map(item => (
                              <button key={item.label} onClick={item.fn} style={{ display: 'block', width: '100%', padding: '10px 14px', border: 'none', background: 'none', textAlign: 'left' as const, fontSize: 13, color: '#111827', cursor: 'pointer' }}
                                onMouseEnter={e => (e.currentTarget.style.background = '#f3f4f6')}
                                onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                                {item.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      </div>
                    )
                  })}
                  <div ref={endRef}/>
                </div>

                {/* Banner respondendo */}
                {respondendoMsg && (
                  <div style={{ background: '#f0f2f5', padding: '8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #e5e7eb' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 3, height: 36, background: '#25d366', borderRadius: 2, flexShrink: 0 }}/>
                      <div>
                        <p style={{ fontSize: 11, fontWeight: 700, color: '#16a34a', margin: 0 }}>Respondendo</p>
                        <p style={{ fontSize: 12, color: '#667781', margin: 0, maxWidth: 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{respondendoMsg.conteudo?.substring(0, 60)}</p>
                      </div>
                    </div>
                    <button onClick={() => setRespondendoMsg(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#667781', fontSize: 18, padding: 4 }}>✕</button>
                  </div>
                )}

                {/* Menu anexos */}
                {menuAnexo && (
                  <div style={{ background: '#f0f2f5', padding: '8px 16px 4px', display: 'flex', gap: 8 }}>
                    {[
                      { icon: '📄', label: 'Documento', color: '#7c3aed' },
                      { icon: '🖼️', label: 'Fotos', color: '#16a34a' },
                      { icon: '📷', label: 'Câmera', color: '#dc2626' },
                      { icon: '🎵', label: 'Áudio', color: '#d97706' },
                      { icon: '📊', label: 'Enquete', color: '#0891b2' },
                    ].map(item => (
                      <div key={item.label} style={{ display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 4 }}>
                        <button style={{ width: 44, height: 44, borderRadius: '50%', border: 'none', background: item.color, cursor: 'pointer', fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{item.icon}</button>
                        <span style={{ fontSize: 10, color: '#667781' }}>{item.label}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Input — estilo WhatsApp */}
                <div style={{ background: '#f0f2f5', borderTop: 'none', padding: '8px 12px', display: 'flex', gap: 8, alignItems: 'flex-end', flexShrink: 0 }}>
                  {/* Anexo */}
                  <button onClick={() => setMenuAnexo(!menuAnexo)} style={{ background: menuAnexo ? '#e9fbe9' : 'none', border: 'none', cursor: 'pointer', color: menuAnexo ? '#25d366' : '#54656f', padding: '8px 4px', display: 'flex', flexShrink: 0, borderRadius: '50%', transition: 'all 0.2s' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  </button>
                  {/* Emoji */}
                  <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#54656f', padding: '8px 4px', display: 'flex', flexShrink: 0 }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm5 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm2.5-5H6.5C6.78 9.5 9.13 8 12 8s5.22 1.5 5.5 3.5z"/></svg>
                  </button>
                  {/* Campo de texto */}
                  <div style={{ flex: 1, background: 'white', borderRadius: 24, padding: '8px 16px', display: 'flex', alignItems: 'flex-end', minHeight: 42, boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>
                    {gravandoAudio ? (
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#dc2626', animation: 'pulse 1s infinite' }}/>
                        <span style={{ fontSize: 13, color: '#dc2626', fontWeight: 500 }}>Gravando... clique no botão para parar</span>
                      </div>
                    ) : (
                      <textarea
                        value={msg}
                        onChange={e => setMsg(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar() } }}
                        style={{ flex: 1, border: 'none', outline: 'none', resize: 'none', fontSize: 14, lineHeight: 1.5, maxHeight: 100, background: 'transparent', fontFamily: 'inherit', color: '#111' }}
                        placeholder="Digite uma mensagem"
                        rows={1}
                      />
                    )}
                  </div>
                  {/* Enviar ou mic */}
                  {msg.trim() ? (
                    <button onClick={enviar} disabled={enviando}
                      style={{ width: 44, height: 44, borderRadius: '50%', border: 'none', background: '#25d366', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
                    </button>
                  ) : gravandoAudio ? (
                    <button onClick={pararAudio}
                      style={{ width: 44, height: 44, borderRadius: '50%', border: 'none', background: '#dc2626', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, animation: 'pulse 1s infinite' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>
                    </button>
                  ) : (
                    <button onClick={iniciarAudio}
                      style={{ width: 44, height: 44, borderRadius: '50%', border: 'none', background: '#54656f', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8"/></svg>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f2f5', flexDirection: 'column', gap: 16 }}>
                <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 175.216 175.552">
                    <path fill="#25D366" d="M87.184 25.227c-33.733 0-61.166 27.423-61.178 61.13a60.98 60.98 0 0 0 9.349 32.535l1.455 2.313-6.179 22.558 23.146-6.069 2.235 1.324c9.387 5.571 20.15 8.517 31.126 8.523h.023c33.707 0 61.14-27.426 61.153-61.135a60.75 60.75 0 0 0-17.895-43.251 60.75 60.75 0 0 0-43.235-17.928z"/>
                    <path fill="#fff" fillRule="evenodd" d="M68.772 55.603c-1.378-3.061-2.828-3.123-4.137-3.176l-3.524-.043c-1.226 0-3.218.46-4.902 2.3s-6.435 6.287-6.435 15.332 6.588 17.785 7.506 19.013 12.718 20.381 31.405 27.75c15.529 6.124 18.689 4.906 22.061 4.6s10.877-4.447 12.408-8.74 1.532-7.971 1.073-8.74-1.685-1.226-3.525-2.146-10.877-5.367-12.562-5.981-2.91-.919-4.137.921-4.746 5.979-5.819 7.206-2.144 1.381-3.984.462-7.76-2.861-14.784-9.124c-5.465-4.873-9.154-10.891-10.228-12.73s-.114-2.835.808-3.751c.825-.824 1.838-2.147 2.759-3.22s1.224-1.84 1.836-3.065.307-2.301-.153-3.22-4.032-10.011-5.666-13.647"/>
                  </svg>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: 20, fontWeight: 300, color: '#41525d', margin: '0 0 8px', letterSpacing: '-0.3px' }}>WhatsApp da Clínica</p>
                  <p style={{ fontSize: 13, color: '#667781', margin: '0 0 20px', maxWidth: 320, lineHeight: 1.5 }}>Selecione uma conversa para ler as mensagens ou inicie uma nova</p>
                  <button onClick={() => setNovaConversa(true)} style={{ fontSize: 13, color: '#075e54', background: 'rgba(255,255,255,0.8)', border: '1px solid #25d366', padding: '8px 20px', borderRadius: 20, cursor: 'pointer', fontWeight: 600 }}>+ Nova conversa</button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#aebac1" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                  <p style={{ fontSize: 11, color: '#aebac1', margin: 0 }}>Suas mensagens são criptografadas</p>
                </div>
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
                    <h2 style={{ fontSize: 14, fontWeight: 700, color: '#111827', margin: '0 0 2px' }}>Sofia IA  Assistente Virtual</h2>
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
                        <div key={c} style={{ display: 'flex', gap: 6 }}><span style={{ color: '#6043C1' }}></span><span style={{ fontSize: 11, color: '#374151' }}>{c}</span></div>
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
                        <p style={{ fontSize: 11, color: '#9ca3af', margin: 0 }}>{a.email}  {a.cargo}</p>
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

          {aba === 'alertas' && (
            <div style={{ flex: 1, overflow: 'auto', padding: 24, background: '#F9FAFC' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>Alertas e riscos</h2>
                  <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>Pacientes que precisam de atencao</p>
                </div>
                <button onClick={() => carregarAlertas()} style={{ fontSize: 12, color: '#6043C1', background: '#ede9fb', border: 'none', padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
                  Atualizar
                </button>
              </div>

              {/* Alertas de risco */}
              {alertas.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
                    Mensagens de risco ({alertas.length})
                  </p>
                  {alertas.map((a: any) => (
                    <div key={a.id} style={{ background: 'white', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', padding: 16, marginBottom: 10, borderLeft: '4px solid #dc2626' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                        <div>
                          <p style={{ fontSize: 14, fontWeight: 600, color: '#111827', margin: '0 0 2px' }}>
                            {a.pacientes?.nome || a.whatsapp_conversas?.nome_contato || 'Paciente'}
                          </p>
                          <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>
                            {new Date(a.criado_em).toLocaleString('pt-BR')}
                          </p>
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 600, background: '#fef2f2', color: '#dc2626', padding: '3px 10px', borderRadius: 20 }}>
                          {a.nivel}
                        </span>
                      </div>
                      <p style={{ fontSize: 13, color: '#374151', margin: '0 0 10px', background: '#fef2f2', padding: '8px 12px', borderRadius: 8 }}>
                        "{a.mensagem}"
                      </p>
                      <button onClick={async () => {
                        await fetch('/api/whatsapp-alertas', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: a.id, lido: true }) })
                        carregarAlertas()
                      }} style={{ fontSize: 12, color: '#6043C1', background: 'transparent', border: '1px solid #d4c9f7', padding: '4px 12px', borderRadius: 6, cursor: 'pointer' }}>
                        Marcar como lido
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Pacientes inativos */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
                    Sem contato ha +7 dias ({inativos.length})
                  </p>
                  {inativos.length > 0 && (
                    <button
                      disabled={checkinEnviando}
                      onClick={async () => {
                        setCheckinEnviando(true)
                        const r = await fetch('/api/whatsapp-checkin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ medico_id: medico?.id }) })
                        const d = await r.json()
                        toast(`Check-in enviado para ${d.enviados} pacientes!`)
                        setCheckinEnviando(false)
                        carregarAlertas()
                      }}
                      style={{ fontSize: 12, fontWeight: 600, color: 'white', background: checkinEnviando ? '#9ca3af' : '#6043C1', border: 'none', padding: '6px 14px', borderRadius: 8, cursor: checkinEnviando ? 'not-allowed' : 'pointer' }}>
                      {checkinEnviando ? 'Enviando...' : 'Enviar check-in para todos'}
                    </button>
                  )}
                </div>
                {inativos.length === 0 ? (
                  <div style={{ background: 'white', borderRadius: 12, padding: 24, textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
                    <p style={{ color: '#6b7280', fontSize: 14, margin: 0 }}>Nenhum paciente inativo nos ultimos 7 dias</p>
                  </div>
                ) : (
                  inativos.map((p: any) => {
                    const dias = Math.floor((Date.now() - new Date(p.ultimo_contato).getTime()) / (1000 * 60 * 60 * 24))
                    return (
                      <div key={p.id} style={{ background: 'white', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', padding: 14, marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                          <p style={{ fontSize: 14, fontWeight: 600, color: '#111827', margin: '0 0 2px' }}>{p.nome_contato}</p>
                          <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>{p.telefone} - Ultimo contato: {dias} dias atras</p>
                        </div>
                        <span style={{ fontSize: 11, background: '#fffbeb', color: '#d97706', padding: '3px 10px', borderRadius: 20, fontWeight: 600 }}>
                          {dias}d sem contato
                        </span>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )}


          {aba === 'campanha' && (
            <div style={{ flex: 1, overflow: 'auto', padding: 24, background: '#F9FAFC' }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>Campanhas</h2>
              <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 24px' }}>Envie mensagens personalizadas para seus pacientes</p>

              <div style={{ background: 'white', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', padding: 20, marginBottom: 24 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#374151', margin: '0 0 12px' }}>Nova campanha</p>
                <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 8px' }}>Use {"{{nome}}"} para personalizar com o nome do paciente</p>
                <textarea
                  value={campanhaMsg}
                  onChange={e => setCampanhaMsg(e.target.value)}
                  placeholder={"Oi {{nome}}! Temos uma novidade especial para voce..."}
                  rows={4}
                  style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13, resize: 'none', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                  <span style={{ fontSize: 12, color: '#9ca3af' }}>{campanhaMsg.length} caracteres</span>
                  <button
                    disabled={!campanhaMsg.trim() || campanhaEnviando}
                    onClick={async () => {
                      if (!campanhaMsg.trim()) return
                      setCampanhaEnviando(true)
                      const r = await fetch('/api/whatsapp-campanha', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ medico_id: medico?.id, mensagem: campanhaMsg }) })
                      const d = await r.json()
                      toast('Campanha enviada para ' + d.enviados + ' pacientes!')
                      setCampanhaMsg('')
                      setCampanhaEnviando(false)
                      fetch('/api/whatsapp-campanha?medico_id=' + medico?.id).then(r => r.json()).then(d => setCampanhas(d.campanhas || []))
                    }}
                    style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: !campanhaMsg.trim() || campanhaEnviando ? '#9ca3af' : '#6043C1', color: 'white', fontWeight: 600, fontSize: 13, cursor: !campanhaMsg.trim() || campanhaEnviando ? 'not-allowed' : 'pointer' }}>
                    {campanhaEnviando ? 'Enviando...' : 'Enviar campanha'}
                  </button>
                </div>
              </div>

              {campanhas.length > 0 && (
                <div>
                  <p style={{ fontSize: 12, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Campanhas anteriores</p>
                  {campanhas.map((c: any) => (
                    <div key={c.id} style={{ background: 'white', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', padding: 14, marginBottom: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontSize: 12, color: '#6b7280' }}>{new Date(c.criado_em).toLocaleDateString('pt-BR')}</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#6043C1' }}>{c.total_enviado}/{c.total_destino} enviados</span>
                      </div>
                      <p style={{ fontSize: 13, color: '#374151', margin: 0 }}>{c.mensagem.substring(0, 100)}{c.mensagem.length > 100 ? '...' : ''}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {aba === 'relatorio' && (
            <div style={{ flex: 1, overflow: 'auto', padding: 24, background: '#F9FAFC' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>Relatorio semanal</h2>
                  <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>Resumo da semana gerado por IA</p>
                </div>
                <button
                  disabled={relatorioCarregando}
                  onClick={async () => {
                    setRelatorioCarregando(true)
                    const r = await fetch('/api/whatsapp-relatorio', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ medico_id: medico?.id }) })
                    const d = await r.json()
                    setRelatorio(d.relatorio)
                    setRelatorioCarregando(false)
                  }}
                  style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: relatorioCarregando ? '#9ca3af' : '#6043C1', color: 'white', fontWeight: 600, fontSize: 13, cursor: relatorioCarregando ? 'not-allowed' : 'pointer' }}>
                  {relatorioCarregando ? 'Gerando...' : 'Gerar relatorio'}
                </button>
              </div>

              {relatorio && (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
                    {[
                      { label: 'Consultas na semana', valor: relatorio.consultas_semana, cor: '#6043C1' },
                      { label: 'Novos pacientes WPP', valor: relatorio.novos_pacientes_wpp, cor: '#0891b2' },
                      { label: 'Alertas pendentes', valor: relatorio.alertas_pendentes?.length || 0, cor: '#dc2626' },
                    ].map((item: any) => (
                      <div key={item.label} style={{ background: 'white', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', padding: 16, textAlign: 'center' }}>
                        <p style={{ fontSize: 28, fontWeight: 800, color: item.cor, margin: '0 0 4px' }}>{item.valor}</p>
                        <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>{item.label}</p>
                      </div>
                    ))}
                  </div>

                  <div style={{ background: 'white', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', padding: 20, marginBottom: 16 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: '#374151', margin: '0 0 12px' }}>Resumo IA</p>
                    <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.7, margin: 0, whiteSpace: 'pre-line' }}>{relatorio.resumo_ia}</p>
                  </div>

                  {relatorio.proximos_agendamentos?.length > 0 && (
                    <div style={{ background: 'white', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', padding: 20 }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: '#374151', margin: '0 0 12px' }}>Próximos agendamentos</p>
                      {relatorio.proximos_agendamentos.slice(0, 5).map((a: any, i: number) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: i < 4 ? '1px solid #f3f4f6' : 'none' }}>
                          <span style={{ fontSize: 13, color: '#111827' }}>{a.pacientes?.nome || 'Paciente'}</span>
                          <span style={{ fontSize: 12, color: '#6b7280' }}>{new Date(a.data_hora).toLocaleString('pt-BR')}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {!relatorio && !relatorioCarregando && (
                <div style={{ background: 'white', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', padding: 48, textAlign: 'center' }}>
                  <p style={{ fontSize: 32, margin: '0 0 12px' }}></p>
                  <p style={{ fontSize: 15, fontWeight: 600, color: '#111827', margin: '0 0 6px' }}>Relatorio semanal com IA</p>
                  <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>Clique em "Gerar relatorio" para ver o resumo da semana</p>
                </div>
              )}
            </div>
          )}


          {aba === 'aderencia' && (
            <div style={{ flex: 1, overflow: 'auto', padding: 24, background: '#F9FAFC' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>Score de Aderencia</h2>
                  <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>Acompanhamento do protocolo por paciente</p>
                </div>
                <button onClick={async () => {
                  setAderenciaCarregando(true)
                  const r = await fetch('/api/whatsapp-aderencia?medico_id=' + medico?.id)
                  const d = await r.json()
                  setAderencias(d.aderencia || [])
                  setAderenciaCarregando(false)
                }} style={{ fontSize: 12, color: '#6043C1', background: '#ede9fb', border: 'none', padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
                  {aderenciaCarregando ? 'Carregando...' : 'Carregar scores'}
                </button>
              </div>

              {aderencias.length === 0 ? (
                <div style={{ background: 'white', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', padding: 48, textAlign: 'center' }}>
                  <p style={{ fontSize: 32, margin: '0 0 12px' }}></p>
                  <p style={{ fontSize: 15, fontWeight: 600, color: '#111827', margin: '0 0 6px' }}>Score de aderencia</p>
                  <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>Clique em "Carregar scores" para ver o ranking de aderencia dos pacientes</p>
                </div>
              ) : (
                aderencias.map((a: any) => {
                  const cor = a.nivel === 'alto' ? '#16a34a' : a.nivel === 'medio' ? '#d97706' : '#dc2626'
                  const bgCor = a.nivel === 'alto' ? '#f0fdf4' : a.nivel === 'medio' ? '#fffbeb' : '#fef2f2'
                  return (
                    <div key={a.paciente_id} style={{ background: 'white', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', padding: 16, marginBottom: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <div>
                          <p style={{ fontSize: 14, fontWeight: 600, color: '#111827', margin: '0 0 2px' }}>{a.pacientes?.nome || a.paciente}</p>
                          <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>Presenca: {a.taxa_presenca}% | Ultimo contato: {a.dias_ultimo_contato}d atras</p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <p style={{ fontSize: 24, fontWeight: 800, color: cor, margin: '0 0 2px' }}>{a.score}</p>
                          <span style={{ fontSize: 11, fontWeight: 600, background: bgCor, color: cor, padding: '2px 8px', borderRadius: 20 }}>{a.nivel}</span>
                        </div>
                      </div>
                      <div style={{ background: '#f3f4f6', borderRadius: 4, height: 6, marginBottom: 10 }}>
                        <div style={{ background: cor, borderRadius: 4, height: 6, width: a.score + '%', transition: 'width 0.5s' }} />
                      </div>
                      {a.recomendacao && (
                        <p style={{ fontSize: 12, color: '#374151', background: '#f9fafb', padding: '8px 12px', borderRadius: 8, margin: 0 }}>{a.recomendacao}</p>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          )}

          {aba === 'agenda' && (
            <div style={{ flex: 1, overflow: 'auto', padding: 24, background: '#F9FAFC' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>Confirmacoes pendentes</h2>
                  <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>Consultas nas proximas 48h aguardando confirmacao</p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={async () => {
                    const r = await fetch('/api/whatsapp-confirmacao?medico_id=' + medico?.id)
                    const d = await r.json()
                    setAgenda24h(d.agendamentos || [])
                  }} style={{ fontSize: 12, color: '#6043C1', background: '#ede9fb', border: 'none', padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
                    Ver pendentes
                  </button>
                  <button
                    disabled={confirmacaoEnviando}
                    onClick={async () => {
                      setConfirmacaoEnviando(true)
                      const r = await fetch('/api/whatsapp-confirmacao', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ medico_id: medico?.id }) })
                      const d = await r.json()
                      toast('Confirmações enviadas para ' + d.enviados + ' pacientes!')
                      setConfirmacaoEnviando(false)
                    }}
                    style={{ fontSize: 12, fontWeight: 600, color: 'white', background: confirmacaoEnviando ? '#9ca3af' : '#6043C1', border: 'none', padding: '6px 14px', borderRadius: 8, cursor: confirmacaoEnviando ? 'not-allowed' : 'pointer' }}>
                    {confirmacaoEnviando ? 'Enviando...' : 'Enviar confirmacoes'}
                  </button>
                </div>
              </div>

              {agenda24h.length === 0 ? (
                <div style={{ background: 'white', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', padding: 48, textAlign: 'center' }}>
                  <p style={{ fontSize: 32, margin: '0 0 12px' }}></p>
                  <p style={{ fontSize: 15, fontWeight: 600, color: '#111827', margin: '0 0 6px' }}>Nenhuma consulta pendente</p>
                  <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>Clique em "Ver pendentes" para carregar os agendamentos</p>
                </div>
              ) : (
                agenda24h.map((a: any) => {
                  const statusCor = a.status === 'confirmacao_enviada' ? '#d97706' : '#6043C1'
                  const statusBg = a.status === 'confirmacao_enviada' ? '#fffbeb' : '#ede9fb'
                  return (
                    <div key={a.id} style={{ background: 'white', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', padding: 16, marginBottom: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <p style={{ fontSize: 14, fontWeight: 600, color: '#111827', margin: '0 0 4px' }}>{(a.pacientes as any)?.nome || 'Paciente'}</p>
                          <p style={{ fontSize: 13, color: '#374151', margin: '0 0 2px' }}>{a.motivo}</p>
                          <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>{new Date(a.data_hora).toLocaleString('pt-BR')}</p>
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 600, background: statusBg, color: statusCor, padding: '4px 12px', borderRadius: 20 }}>
                          {a.status === 'confirmacao_enviada' ? 'Aguardando' : 'Nao enviado'}
                        </span>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          )}


          {aba === 'dashboard' && (
            <div style={{ flex: 1, overflow: 'auto', padding: 24, background: '#F9FAFC' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>Dashboard WhatsApp</h2>
                  <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>Visão geral do atendimento via WhatsApp</p>
                </div>
                <button onClick={carregarMetricas} style={{ fontSize: 12, color: '#6043C1', background: '#ede9fb', border: 'none', padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
                  Atualizar
                </button>
              </div>

              {metricas && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
                    {[
                      { label: 'Total de conversas', valor: metricas.total_conversas, cor: '#6043C1', sub: metricas.novas_semana + ' novas esta semana' },
                      { label: 'Conversas ativas', valor: metricas.conversas_ativas, cor: '#0891b2', sub: 'Pacientes respondendo' },
                      { label: 'Alertas pendentes', valor: metricas.alertas_pendentes, cor: '#dc2626', sub: 'Precisam de atencao' },
                      { label: 'Pacientes inativos', valor: metricas.pacientes_inativos, cor: '#d97706', sub: 'Sem contato +7 dias' },
                      { label: 'Msgs enviadas/semana', valor: metricas.mensagens_semana?.enviadas || 0, cor: '#059669', sub: metricas.mensagens_semana?.recebidas + ' recebidas' },
                      { label: 'Taxa de resposta', valor: metricas.taxa_resposta + '%', cor: '#7c3aed', sub: 'Ultimos 7 dias' },
                    ].map((item: any) => (
                      <div key={item.label} style={{ background: 'white', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', padding: 16 }}>
                        <p style={{ fontSize: 26, fontWeight: 800, color: item.cor, margin: '0 0 4px' }}>{item.valor}</p>
                        <p style={{ fontSize: 12, fontWeight: 600, color: '#374151', margin: '0 0 2px' }}>{item.label}</p>
                        <p style={{ fontSize: 11, color: '#9ca3af', margin: 0 }}>{item.sub}</p>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div style={{ background: 'white', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', padding: 20 }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: '#374151', margin: '0 0 16px' }}>Acoes rapidas</p>
                      {[
                        { label: 'Ver alertas de risco', aba: 'alertas', cor: '#dc2626' },
                        { label: 'Enviar check-in', aba: 'alertas', cor: '#d97706' },
                        { label: 'Nova campanha', aba: 'campanha', cor: '#6043C1' },
                        { label: 'Gerar relatorio', aba: 'relatorio', cor: '#0891b2' },
                      ].map((item: any) => (
                        <button key={item.label} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', borderRadius: 8, border: 'none', background: '#f9fafb', cursor: 'pointer', fontSize: 13, color: item.cor, fontWeight: 600, marginBottom: 8 }}>
                          {item.label} 
                        </button>
                      ))}
                    </div>

                    <div style={{ background: 'white', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', padding: 20 }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: '#374151', margin: '0 0 16px' }}>Status do sistema</p>
                      {[
                        { label: 'Sofia IA', status: 'Ativa', cor: '#059669' },
                        { label: 'Onboarding', status: 'Ativo', cor: '#059669' },
                        { label: 'Audio (Whisper)', status: 'Ativo', cor: '#059669' },
                        { label: 'Alertas de risco', status: 'Monitorando', cor: '#6043C1' },
                      ].map((item: any) => (
                        <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                          <span style={{ fontSize: 13, color: '#374151' }}>{item.label}</span>
                          <span style={{ fontSize: 11, fontWeight: 600, color: item.cor, background: item.cor + '20', padding: '2px 8px', borderRadius: 20 }}>{item.status}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {!metricas && (
                <div style={{ background: 'white', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', padding: 48, textAlign: 'center' }}>
                  <p style={{ fontSize: 32, margin: '0 0 12px' }}></p>
                  <p style={{ fontSize: 14, color: '#6b7280', margin: 0 }}>Clique em "Atualizar" para carregar as metricas</p>
                </div>
              )}
            </div>
          )}

          {aba === 'nps' && (
            <div style={{ flex: 1, overflow: 'auto', padding: 24, background: '#F9FAFC' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>NPS - Satisfacao</h2>
                  <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>Pesquisa de satisfacao automatica pos-consulta</p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={carregarNps} style={{ fontSize: 12, color: '#6043C1', background: '#ede9fb', border: 'none', padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
                    Ver resultados
                  </button>
                  <button
                    disabled={npsEnviando}
                    onClick={async () => {
                      setNpsEnviando(true)
                      const r = await fetch('/api/whatsapp-nps', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ medico_id: medico?.id }) })
                      const d = await r.json()
                      alert('NPS enviado para ' + d.enviados + ' pacientes!')
                      setNpsEnviando(false)
                      carregarNps()
                    }}
                    style={{ fontSize: 12, fontWeight: 600, color: 'white', background: npsEnviando ? '#9ca3af' : '#6043C1', border: 'none', padding: '6px 14px', borderRadius: 8, cursor: npsEnviando ? 'not-allowed' : 'pointer' }}>
                    {npsEnviando ? 'Enviando...' : 'Enviar NPS hoje'}
                  </button>
                </div>
              </div>

              {npsData && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
                    {[
                      { label: 'NPS Score', valor: npsData.nps, cor: npsData.nps >= 50 ? '#059669' : npsData.nps >= 0 ? '#d97706' : '#dc2626' },
                      { label: 'Nota media', valor: npsData.media, cor: '#6043C1' },
                      { label: 'Promotores', valor: npsData.promotores, cor: '#059669' },
                      { label: 'Detratores', valor: npsData.detratores, cor: '#dc2626' },
                    ].map((item: any) => (
                      <div key={item.label} style={{ background: 'white', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', padding: 16, textAlign: 'center' }}>
                        <p style={{ fontSize: 28, fontWeight: 800, color: item.cor, margin: '0 0 4px' }}>{item.valor}</p>
                        <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>{item.label}</p>
                      </div>
                    ))}
                  </div>

                  {npsData.respostas?.length > 0 && (
                    <div style={{ background: 'white', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', padding: 20 }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: '#374151', margin: '0 0 12px' }}>Ultimas respostas</p>
                      {npsData.respostas.map((r: any, i: number) => {
                        const cor = r.nota >= 9 ? '#059669' : r.nota >= 7 ? '#d97706' : '#dc2626'
                        return (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: i < npsData.respostas.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                            <span style={{ fontSize: 13, color: '#374151' }}>{r.pacientes?.nome || 'Paciente'}</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontSize: 12, color: '#9ca3af' }}>{new Date(r.criado_em).toLocaleDateString('pt-BR')}</span>
                              <span style={{ fontSize: 18, fontWeight: 800, color: cor }}>{r.nota}</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </>
              )}

              {!npsData && (
                <div style={{ background: 'white', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', padding: 48, textAlign: 'center' }}>
                  <p style={{ fontSize: 32, margin: '0 0 12px' }}></p>
                  <p style={{ fontSize: 15, fontWeight: 600, color: '#111827', margin: '0 0 6px' }}>Pesquisa de satisfacao</p>
                  <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>Envie NPS automaticamente apos cada consulta</p>
                </div>
              )}
            </div>
          )}

        {aba === 'transmissao' && (
          <div style={{ flex: 1, overflow: 'auto', padding: 24, background: '#F9FAFC' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 20, height: '100%', alignContent: 'start' }}>

              {/* Lista de grupos */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ background: 'white', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', padding: 16 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#111827', margin: '0 0 12px' }}>Nova lista</p>
                  <input value={novaLista.nome} onChange={e => setNovaLista(l => ({ ...l, nome: e.target.value }))}
                    placeholder="Nome da lista (ex: Pós-cirúrgico)" style={{ width: '100%', padding: '8px 12px', fontSize: 13, border: '1.5px solid #e5e7eb', borderRadius: 8, marginBottom: 8, boxSizing: 'border-box' as const, outline: 'none' }} />
                  <input value={novaLista.descricao} onChange={e => setNovaLista(l => ({ ...l, descricao: e.target.value }))}
                    placeholder="Descrição opcional" style={{ width: '100%', padding: '8px 12px', fontSize: 13, border: '1.5px solid #e5e7eb', borderRadius: 8, marginBottom: 8, boxSizing: 'border-box' as const, outline: 'none' }} />
                  <button onClick={async () => {
                    if (!novaLista.nome.trim() || !medico) return
                    const { data } = await (await import('@/lib/supabase')).supabase
                      .from('listas_transmissao').insert({ medico_id: medico.id, nome: novaLista.nome, descricao: novaLista.descricao }).select().single()
                    if (data) { setListas(l => [...l, { ...data, total: 0 }]); setNovaLista({ nome: '', descricao: '' }); toast('Lista criada!') }
                  }} style={{ width: '100%', padding: '8px', borderRadius: 8, border: 'none', background: '#16a34a', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    + Criar lista
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {listas.length === 0 ? (
                    <div style={{ background: 'white', borderRadius: 12, padding: '24px', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
                      <p style={{ fontSize: 13, color: '#9ca3af', margin: 0 }}>Nenhuma lista criada</p>
                    </div>
                  ) : listas.map((l: any) => (
                    <div key={l.id} onClick={() => setListaSelecionada(l)}
                      style={{ background: listaSelecionada?.id === l.id ? '#f0fdf4' : 'white', border: `1px solid ${listaSelecionada?.id === l.id ? '#86efac' : '#e5e7eb'}`, borderRadius: 12, padding: '12px 14px', cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: '#111827', margin: 0 }}>{l.nome}</p>
                        <span style={{ fontSize: 11, color: '#16a34a', background: '#f0fdf4', padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>{l.total || 0} contatos</span>
                      </div>
                      {l.descricao && <p style={{ fontSize: 12, color: '#6b7280', margin: '3px 0 0' }}>{l.descricao}</p>}
                    </div>
                  ))}
                </div>
              </div>

              {/* Painel envio */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {!listaSelecionada ? (
                  <div style={{ background: 'white', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', padding: 48, textAlign: 'center' }}>
                    <p style={{ fontSize: 32, margin: '0 0 12px' }}>📢</p>
                    <p style={{ fontSize: 15, fontWeight: 600, color: '#111827', margin: '0 0 6px' }}>Listas de transmissão</p>
                    <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>Crie listas para enviar mensagens em massa para grupos de pacientes específicos — pós-cirúrgico, diabéticos, retorno, etc.</p>
                  </div>
                ) : (
                  <>
                    <div style={{ background: 'white', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', padding: 20 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                        <div>
                          <p style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: 0 }}>{listaSelecionada.nome}</p>
                          <p style={{ fontSize: 12, color: '#6b7280', margin: '2px 0 0' }}>{listaSelecionada.total || 0} contatos</p>
                        </div>
                        <button onClick={async () => {
                          if (!confirm('Excluir esta lista?')) return
                          await (await import('@/lib/supabase')).supabase.from('listas_transmissao').delete().eq('id', listaSelecionada.id)
                          setListas(l => l.filter(x => x.id !== listaSelecionada.id))
                          setListaSelecionada(null)
                          toast('Lista removida', 'info')
                        }} style={{ fontSize: 11, color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', padding: '4px 10px', borderRadius: 6, cursor: 'pointer' }}>
                          Excluir lista
                        </button>
                      </div>
                      <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 8px' }}>Use {'{{nome}}'} para personalizar</p>
                      <textarea value={msgTransmissao} onChange={e => setMsgTransmissao(e.target.value)}
                        placeholder="Olá {{nome}}, sua consulta de retorno está disponível..."
                        rows={4} style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13, resize: 'none', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' as const }} />
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                        <button disabled={!msgTransmissao.trim() || enviandoTransmissao} onClick={async () => {
                          if (!msgTransmissao.trim() || !listaSelecionada) return
                          setEnviandoTransmissao(true)
                          const r = await fetch('/api/whatsapp-campanha', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ medico_id: medico?.id, mensagem: msgTransmissao, lista_id: listaSelecionada.id }) })
                          const d = await r.json()
                          toast(`Transmissão enviada para ${d.enviados} contatos!`)
                          setMsgTransmissao('')
                          setEnviandoTransmissao(false)
                        }} style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: !msgTransmissao.trim() || enviandoTransmissao ? '#9ca3af' : '#16a34a', color: 'white', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                          {enviandoTransmissao ? 'Enviando...' : '📢 Enviar transmissão'}
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

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
                      <p style={{ fontSize: 11, color: '#6043C1', margin: 0 }}>{config.phone_number}  {config.nome_exibicao}</p>
                    </div>
                  </div>
                  <button onClick={async () => { await fetch('/api/whatsapp-config?medico_id=' + medico.id, { method: 'DELETE' }); setConfig(null) }} style={{ fontSize: 11, color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', padding: '4px 10px', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>Desconectar</button>
                </div>
              )}
              {!config && (
                <div style={{ background: 'white', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', borderRadius: 14, overflow: 'hidden', marginBottom: 18 }}>
                  <div style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6' }}>
                    <h2 style={{ fontSize: 14, fontWeight: 700, color: '#111827', margin: '0 0 2px' }}>Conectar WhatsApp Business</h2>
                    <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>Siga os passos abaixo para conectar o número da clínica</p>
                  </div>

                  {/* Steps indicator */}
                  <div style={{ display: 'flex', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid #f3f4f6', gap: 0 }}>
                    {[1,2,3].map((s, i) => (
                      <div key={s} style={{ display: 'flex', alignItems: 'center', flex: i < 2 ? 1 : 0 }}>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0,
                          background: wizardPasso > s ? '#16a34a' : wizardPasso === s ? '#16a34a' : '#f3f4f6',
                          color: wizardPasso >= s ? 'white' : '#9ca3af' }}>
                          {wizardPasso > s ? '✓' : s}
                        </div>
                        {i < 2 && <div style={{ flex: 1, height: 2, background: wizardPasso > s ? '#16a34a' : '#f3f4f6', margin: '0 6px' }} />}
                      </div>
                    ))}
                  </div>

                  <div style={{ padding: '20px' }}>
                    {wizardPasso === 1 && (
                      <div>
                        <p style={{ fontSize: 14, fontWeight: 700, color: '#111827', margin: '0 0 8px' }}>Passo 1 — Acesse o painel da Meta</p>
                        <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 16px', lineHeight: 1.6 }}>
                          Acesse <a href="https://developers.facebook.com" target="_blank" rel="noreferrer" style={{ color: '#16a34a', fontWeight: 600 }}>developers.facebook.com</a> e faça login com a conta que gerencia o número do WhatsApp Business.
                        </p>
                        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '12px 14px', marginBottom: 16 }}>
                          <p style={{ fontSize: 12, fontWeight: 700, color: '#166534', margin: '0 0 6px' }}>📌 Onde encontrar</p>
                          <p style={{ fontSize: 12, color: '#166534', margin: 0, lineHeight: 1.6 }}>
                            Meu Aplicativo → WhatsApp → Configuração da API → <strong>Identificação do número de telefone</strong>
                          </p>
                        </div>
                        <div style={{ background: '#f9fafb', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontFamily: 'monospace', fontSize: 12, color: '#374151' }}>
                          Ex: <strong>1030374870164992</strong>
                        </div>
                        <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Phone Number ID *</label>
                        <input required value={form.phone_number_id} onChange={e => setForm(f => ({ ...f, phone_number_id: e.target.value }))}
                          style={{ width: '100%', padding: '10px 12px', fontSize: 13, borderRadius: 8, border: '1.5px solid #e5e7eb', fontFamily: 'monospace', boxSizing: 'border-box' as const, outline: 'none' }}
                          placeholder="Cole o Phone Number ID aqui" />
                        <button onClick={() => { if (form.phone_number_id.trim()) setWizardPasso(2) }}
                          disabled={!form.phone_number_id.trim()}
                          style={{ width: '100%', marginTop: 16, padding: '10px', borderRadius: 9, border: 'none', background: form.phone_number_id.trim() ? '#16a34a' : '#e5e7eb', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                          Próximo →
                        </button>
                      </div>
                    )}

                    {wizardPasso === 2 && (
                      <div>
                        <p style={{ fontSize: 14, fontWeight: 700, color: '#111827', margin: '0 0 8px' }}>Passo 2 — Token de acesso permanente</p>
                        <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 16px', lineHeight: 1.6 }}>
                          Gere um token de acesso <strong>permanente</strong> (não o temporário de 24h).
                        </p>
                        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '12px 14px', marginBottom: 16 }}>
                          <p style={{ fontSize: 12, fontWeight: 700, color: '#92400e', margin: '0 0 6px' }}>⚠ Atenção</p>
                          <p style={{ fontSize: 12, color: '#92400e', margin: 0, lineHeight: 1.6 }}>
                            Use <strong>Sistema de Usuário</strong> no Business Manager para gerar um token que não expira. Tokens de usuário expiram e quebram a integração.
                          </p>
                        </div>
                        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '12px 14px', marginBottom: 16 }}>
                          <p style={{ fontSize: 12, fontWeight: 700, color: '#166534', margin: '0 0 6px' }}>📌 Onde encontrar</p>
                          <p style={{ fontSize: 12, color: '#166534', margin: 0, lineHeight: 1.6 }}>
                            Business Manager → Configurações → Usuários do sistema → Gerar token → Selecione seu app → <strong>whatsapp_business_messaging</strong>
                          </p>
                        </div>
                        <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Token permanente *</label>
                        <input required type="password" value={form.access_token} onChange={e => setForm(f => ({ ...f, access_token: e.target.value }))}
                          style={{ width: '100%', padding: '10px 12px', fontSize: 13, borderRadius: 8, border: '1.5px solid #e5e7eb', fontFamily: 'monospace', boxSizing: 'border-box' as const, outline: 'none' }}
                          placeholder="EAANoj..." />
                        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                          <button onClick={() => setWizardPasso(1)} style={{ flex: 1, padding: '10px', borderRadius: 9, border: '1px solid #e5e7eb', background: 'white', color: '#6b7280', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>← Voltar</button>
                          <button onClick={() => { if (form.access_token.trim()) setWizardPasso(3) }} disabled={!form.access_token.trim()}
                            style={{ flex: 2, padding: '10px', borderRadius: 9, border: 'none', background: form.access_token.trim() ? '#16a34a' : '#e5e7eb', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                            Próximo →
                          </button>
                        </div>
                      </div>
                    )}

                    {wizardPasso === 3 && (
                      <div>
                        <p style={{ fontSize: 14, fontWeight: 700, color: '#111827', margin: '0 0 8px' }}>Passo 3 — Finalizar conexão</p>
                        <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 16px', lineHeight: 1.6 }}>
                          Dê um nome para identificar este número na plataforma e clique em conectar.
                        </p>
                        <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Nome da clínica</label>
                        <input value={form.nome_exibicao} onChange={e => setForm(f => ({ ...f, nome_exibicao: e.target.value }))}
                          style={{ width: '100%', padding: '10px 12px', fontSize: 13, borderRadius: 8, border: '1.5px solid #e5e7eb', boxSizing: 'border-box' as const, outline: 'none', marginBottom: 16 }}
                          placeholder="Clínica Dr. Silva" />
                        {cfgMsg && <div style={{ background: cfgMsg.tipo === 'ok' ? '#f0fdf4' : '#fef2f2', border: '1px solid ' + (cfgMsg.tipo === 'ok' ? '#bbf7d0' : '#fecaca'), borderRadius: 8, padding: '8px 12px', marginBottom: 12 }}>
                          <p style={{ fontSize: 12, color: cfgMsg.tipo === 'ok' ? '#16a34a' : '#dc2626', margin: 0 }}>{cfgMsg.texto}</p>
                        </div>}
                        <div style={{ display: 'flex', gap: 10 }}>
                          <button onClick={() => setWizardPasso(2)} style={{ flex: 1, padding: '10px', borderRadius: 9, border: '1px solid #e5e7eb', background: 'white', color: '#6b7280', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>← Voltar</button>
                          <button onClick={(e: any) => { e.preventDefault(); salvarConfig(e) }} disabled={salvando}
                            style={{ flex: 2, padding: '10px', borderRadius: 9, border: 'none', background: '#16a34a', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                            {salvando ? 'Conectando...' : '✓ Conectar WhatsApp'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {config && (
                <div style={{ background: 'white', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', borderRadius: 14, overflow: 'hidden', marginBottom: 18 }}>
                  <div style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6' }}>
                    <h2 style={{ fontSize: 14, fontWeight: 700, color: '#111827', margin: '0 0 2px' }}>Atualizar credenciais</h2>
                  </div>
                  <form onSubmit={salvarConfig} style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Phone Number ID</label>
                      <input required value={form.phone_number_id} onChange={e => setForm(f => ({ ...f, phone_number_id: e.target.value }))} style={{ width: '100%', padding: '9px 12px', fontSize: 13, borderRadius: 8, border: '1.5px solid #e5e7eb', fontFamily: 'monospace', boxSizing: 'border-box' as const }} placeholder="1030374870164992"/>
                    </div>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Token permanente</label>
                      <input required type="password" value={form.access_token} onChange={e => setForm(f => ({ ...f, access_token: e.target.value }))} style={{ width: '100%', padding: '9px 12px', fontSize: 13, borderRadius: 8, border: '1.5px solid #e5e7eb', fontFamily: 'monospace', boxSizing: 'border-box' as const }} placeholder="EAANoj..."/>
                    </div>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Nome da clínica</label>
                      <input value={form.nome_exibicao} onChange={e => setForm(f => ({ ...f, nome_exibicao: e.target.value }))} style={{ width: '100%', padding: '9px 12px', fontSize: 13, borderRadius: 8, border: '1.5px solid #e5e7eb', boxSizing: 'border-box' as const }} placeholder="Clínica Dr. Silva"/>
                    </div>
                    {cfgMsg && <div style={{ background: cfgMsg.tipo === 'ok' ? '#f0fdf4' : '#fef2f2', border: '1px solid ' + (cfgMsg.tipo === 'ok' ? '#bbf7d0' : '#fecaca'), borderRadius: 8, padding: '8px 12px' }}><p style={{ fontSize: 12, color: cfgMsg.tipo === 'ok' ? '#16a34a' : '#dc2626', margin: 0 }}>{cfgMsg.texto}</p></div>}
                    <button type="submit" disabled={salvando} style={{ padding: '10px', borderRadius: 9, border: 'none', background: '#16a34a', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{salvando ? 'Salvando...' : 'Salvar alterações'}</button>
                  </form>
                </div>
              )}
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
