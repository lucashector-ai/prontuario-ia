'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Sidebar } from '@/components/Sidebar'

type Aba = 'conversas' | 'sofia' | 'configuracao'

export default function WhatsApp() {
  const router = useRouter()
  const [medico, setMedico] = useState<any>(null)
  const [aba, setAba] = useState<Aba>('conversas')

  // --- conversas ---
  const [conversas, setConversas] = useState<any[]>([])
  const [ativa, setAtiva] = useState<any>(null)
  const [mensagens, setMensagens] = useState<any[]>([])
  const [msg, setMsg] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [busca, setBusca] = useState('')
  const endRef = useRef<HTMLDivElement>(null)

  // --- configuracao ---
  const [config, setConfig] = useState<any>(null)
  const [form, setForm] = useState({ phone_number_id: '', access_token: '', nome_exibicao: '' })
  const [salvando, setSalvando] = useState(false)
  const [cfgMsg, setCfgMsg] = useState<{ tipo: 'ok'|'erro'; texto: string }|null>(null)

  // --- sofia ---
  const [sofiaPrompt, setSofiaPrompt] = useState('')
  const [sofiaAtivo, setSofiaAtivo] = useState(true)
  const [salvandoSofia, setSalvandoSofia] = useState(false)
  const [sofiaMsg, setSofiaMsg] = useState('')

  const WEBHOOK_URL = 'https://prontuario-ia-five.vercel.app/api/whatsapp'
  const VERIFY_TOKEN = 'media_whatsapp_2026'

  useEffect(() => {
    const m = localStorage.getItem('medico')
    if (!m) { router.push('/login'); return }
    const med = JSON.parse(m); setMedico(med)
    carregarConfig(med.id)
    carregarSofia(med.id)
  }, [router])

  useEffect(() => {
    if (!medico) return
    carregarConversas()
    const t = setInterval(carregarConversas, 5000)
    return () => clearInterval(t)
  }, [medico])

  useEffect(() => { if (ativa) carregarMsgs(ativa.id) }, [ativa])
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [mensagens])

  const carregarConversas = async () => {
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
  }

  const carregarMsgs = async (id: string) => {
    const { data } = await supabase.from('whatsapp_mensagens').select('*').eq('conversa_id', id).order('criado_em', { ascending: true })
    setMensagens(data || [])
    await supabase.from('whatsapp_mensagens').update({ lida: true }).eq('conversa_id', id).eq('tipo', 'recebida')
  }

  const enviar = async () => {
    if (!msg.trim() || !ativa || enviando) return
    setEnviando(true)
    const texto = msg.trim(); setMsg('')
    const { data: nova } = await supabase.from('whatsapp_mensagens').insert({ conversa_id: ativa.id, tipo: 'enviada', conteudo: texto, metadata: { manual: true } }).select().single()
    if (nova) setMensagens(p => [...p, nova])
    await fetch('/api/whatsapp/enviar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ telefone: ativa.telefone, texto, medico_id: medico.id }) })
    setEnviando(false)
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
    } catch (e: any) { setCfgMsg({ tipo: 'erro', texto: e.message }) }
    finally { setSalvando(false) }
  }

  const removerConfig = async () => {
    if (!confirm('Desconectar WhatsApp?')) return
    await fetch('/api/whatsapp-config?medico_id=' + medico.id, { method: 'DELETE' })
    setConfig(null); setCfgMsg({ tipo: 'ok', texto: 'Desconectado.' })
  }

  const carregarSofia = async (id: string) => {
    const { data } = await supabase.from('whatsapp_config').select('sofia_prompt, sofia_ativo').eq('medico_id', id).single()
    if (data) { setSofiaPrompt(data.sofia_prompt || ''); setSofiaAtivo(data.sofia_ativo !== false) }
  }

  const salvarSofia = async () => {
    setSalvandoSofia(true)
    await supabase.from('whatsapp_config').update({ sofia_prompt: sofiaPrompt, sofia_ativo: sofiaAtivo }).eq('medico_id', medico.id)
    setSofiaMsg('Salvo!'); setTimeout(() => setSofiaMsg(''), 2000)
    setSalvandoSofia(false)
  }

  const fmt = (iso: string) => { const d = new Date(iso); return d.toDateString() === new Date().toDateString() ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) }
  const fmtH = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const nome = (c: any) => c.nome_contato || c.telefone
  const ini = (n: string) => n?.split(' ').map((x: string) => x[0]).slice(0, 2).join('').toUpperCase() || '?'
  const filtradas = conversas.filter(c => nome(c).toLowerCase().includes(busca.toLowerCase()))
  const totalNaoLidas = conversas.reduce((a, c) => a + c.naoLidas, 0)

  const tabStyle = (t: Aba) => ({
    padding: '8px 16px', fontSize: 12, fontWeight: aba === t ? 700 : 500,
    color: aba === t ? '#16a34a' : '#6b7280', background: 'none', border: 'none',
    borderBottom: aba === t ? '2px solid #16a34a' : '2px solid transparent',
    cursor: 'pointer', whiteSpace: 'nowrap' as const
  })

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
- Para opcao 5: avise que um atendente entrara em contato em breve
- NUNCA de diagnosticos ou orientacoes medicas
- Para emergencias: "Ligue 192 (SAMU) ou va ao pronto-socorro mais proximo"
- Se nao entender: repita o menu principal`

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#f9fafb', overflow: 'hidden' }}>
      <Sidebar activeHref="/whatsapp" />
      <main style={{ flex: 1, display: 'flex', overflow: 'hidden', flexDirection: 'column' }}>

        {/* Header com abas */}
        <div style={{ background: 'white', borderBottom: '1px solid #e5e7eb', padding: '0 24px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, paddingTop: 16, paddingBottom: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="#16a34a"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              </div>
              <div>
                <h1 style={{ fontSize: 15, fontWeight: 800, color: '#111827', margin: 0, letterSpacing: '-0.2px' }}>WhatsApp IA</h1>
                <p style={{ fontSize: 11, color: config ? '#16a34a' : '#9ca3af', margin: 0 }}>{config ? '● ' + (config.phone_number || config.phone_number_id) : '● Desconectado'}</p>
              </div>
            </div>
            {totalNaoLidas > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: 'white', background: '#16a34a', padding: '2px 9px', borderRadius: 20 }}>{totalNaoLidas} novas</span>}
          </div>
          <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
            <button style={tabStyle('conversas')} onClick={() => setAba('conversas')}>💬 Conversas {totalNaoLidas > 0 && <span style={{ background: '#16a34a', color: 'white', borderRadius: 10, padding: '1px 6px', fontSize: 10, marginLeft: 4 }}>{totalNaoLidas}</span>}</button>
            <button style={tabStyle('sofia')} onClick={() => setAba('sofia')}>🤖 Sofia IA</button>
            <button style={tabStyle('configuracao')} onClick={() => setAba('configuracao')}>⚙️ Configuracao</button>
          </div>
        </div>

        {/* ABA CONVERSAS */}
        {aba === 'conversas' && (
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            <div style={{ width: 300, background: 'white', borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
              <div style={{ padding: '12px 14px', borderBottom: '1px solid #f3f4f6' }}>
                <input value={busca} onChange={e => setBusca(e.target.value)} style={{ width: '100%', padding: '7px 10px', fontSize: 12, borderRadius: 7, border: '1px solid #e5e7eb', background: '#f9fafb' }} placeholder="Buscar conversa..."/>
              </div>
              <div style={{ flex: 1, overflow: 'auto' }}>
                {filtradas.length === 0 ? (
                  <div style={{ padding: '32px 16px', textAlign: 'center' }}>
                    <p style={{ fontSize: 13, color: '#9ca3af', margin: '0 0 6px' }}>Nenhuma conversa</p>
                    <p style={{ fontSize: 11, color: '#d1d5db', margin: 0, lineHeight: 1.6 }}>As mensagens aparecerao aqui quando pacientes enviarem para o numero da clinica</p>
                  </div>
                ) : filtradas.map(c => (
                  <div key={c.id} onClick={() => setAtiva(c)} style={{ padding: '10px 14px', borderBottom: '1px solid #f9fafb', cursor: 'pointer', background: ativa?.id === c.id ? '#f0fdf4' : 'white', borderLeft: ativa?.id === c.id ? '3px solid #16a34a' : '3px solid transparent' }}>
                    <div style={{ display: 'flex', gap: 9 }}>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: ativa?.id === c.id ? '#dcfce7' : '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: ativa?.id === c.id ? '#16a34a' : '#6b7280', flexShrink: 0 }}>{ini(nome(c))}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                          <p style={{ fontSize: 12, fontWeight: c.naoLidas > 0 ? 700 : 500, color: '#111827', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nome(c)}</p>
                          <span style={{ fontSize: 10, color: '#9ca3af', flexShrink: 0, marginLeft: 4 }}>{c.ultima ? fmt(c.ultima.criado_em) : ''}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <p style={{ fontSize: 11, color: '#9ca3af', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{c.ultima?.tipo === 'enviada' && '✓ '}{c.ultima?.conteudo?.substring(0, 38) || ''}</p>
                          {c.naoLidas > 0 && <span style={{ fontSize: 9, fontWeight: 700, color: 'white', background: '#16a34a', width: 16, height: 16, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginLeft: 4 }}>{c.naoLidas}</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {ativa ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f0f2f5' }}>
                <div style={{ background: 'white', borderBottom: '1px solid #e5e7eb', padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#16a34a' }}>{ini(nome(ativa))}</div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: '#111827', margin: 0 }}>{nome(ativa)}</p>
                    <p style={{ fontSize: 11, color: '#9ca3af', margin: 0 }}>{ativa.telefone}{ativa.paciente_id ? ' · Paciente cadastrado' : ''}</p>
                  </div>
                  {ativa.paciente_id && <a href={'/pacientes/' + ativa.paciente_id} style={{ fontSize: 11, color: '#16a34a', background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '4px 10px', borderRadius: 6, textDecoration: 'none', fontWeight: 600 }}>Ver ficha</a>}
                </div>
                <div style={{ flex: 1, overflow: 'auto', padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {mensagens.map(m => {
                    const rec = m.tipo === 'recebida'
                    return (
                      <div key={m.id} style={{ display: 'flex', justifyContent: rec ? 'flex-start' : 'flex-end' }}>
                        <div style={{ maxWidth: '68%', padding: '7px 11px', borderRadius: rec ? '4px 10px 10px 10px' : '10px 4px 10px 10px', background: rec ? 'white' : '#dcfce7', border: rec ? '1px solid #e5e7eb' : '1px solid #bbf7d0' }}>
                          {m.metadata?.ia && <p style={{ fontSize: 9, color: '#16a34a', fontWeight: 700, margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Sofia IA</p>}
                          <p style={{ fontSize: 12, color: '#111827', margin: 0, lineHeight: 1.5, whiteSpace: 'pre-line' }}>{m.conteudo}</p>
                          <p style={{ fontSize: 9, color: '#9ca3af', margin: '3px 0 0', textAlign: rec ? 'left' : 'right' }}>{fmtH(m.criado_em)}</p>
                        </div>
                      </div>
                    )
                  })}
                  <div ref={endRef}/>
                </div>
                <div style={{ background: 'white', borderTop: '1px solid #e5e7eb', padding: '10px 14px', display: 'flex', gap: 8, alignItems: 'flex-end', flexShrink: 0 }}>
                  <textarea value={msg} onChange={e => setMsg(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar() } }} style={{ flex: 1, padding: '9px 12px', fontSize: 12, borderRadius: 20, border: '1px solid #e5e7eb', resize: 'none', minHeight: 40, maxHeight: 100, lineHeight: 1.5, outline: 'none' }} placeholder="Mensagem... (Enter para enviar)"/>
                  <button onClick={enviar} disabled={!msg.trim() || enviando} style={{ width: 40, height: 40, borderRadius: '50%', border: 'none', background: msg.trim() ? '#16a34a' : '#e5e7eb', cursor: msg.trim() ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f2f5', flexDirection: 'column', gap: 12 }}>
                <div style={{ width: 56, height: 56, borderRadius: 14, background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="#16a34a"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                </div>
                <p style={{ fontSize: 14, fontWeight: 600, color: '#374151', margin: 0 }}>Selecione uma conversa</p>
                <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>ou configure a Sofia IA na aba ao lado</p>
              </div>
            )}
          </div>
        )}

        {/* ABA SOFIA IA */}
        {aba === 'sofia' && (
          <div style={{ flex: 1, overflow: 'auto', padding: 28 }}>
            <div style={{ maxWidth: 720 }}>
              <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 14, overflow: 'hidden', marginBottom: 20 }}>
                <div style={{ padding: '16px 22px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <h2 style={{ fontSize: 14, fontWeight: 700, color: '#111827', margin: '0 0 2px' }}>Sofia IA — Assistente Virtual</h2>
                    <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>Configure como a IA vai se comportar nas conversas</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 12, color: sofiaAtivo ? '#16a34a' : '#9ca3af', fontWeight: 600 }}>{sofiaAtivo ? 'Ativa' : 'Pausada'}</span>
                    <button onClick={() => setSofiaAtivo(!sofiaAtivo)} style={{ width: 42, height: 24, borderRadius: 12, border: 'none', background: sofiaAtivo ? '#16a34a' : '#d1d5db', cursor: 'pointer', position: 'relative', transition: 'background .2s', flexShrink: 0 }}>
                      <span style={{ position: 'absolute', top: 2, left: sofiaAtivo ? 20 : 2, width: 20, height: 20, borderRadius: '50%', background: 'white', transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}/>
                    </button>
                  </div>
                </div>
                <div style={{ padding: '20px 22px' }}>
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 8 }}>Instrucoes da Sofia</label>
                    <p style={{ fontSize: 11, color: '#9ca3af', margin: '0 0 10px', lineHeight: 1.5 }}>Define a personalidade, o fluxo de atendimento e como a IA deve responder. Quanto mais detalhado, melhor.</p>
                    <textarea value={sofiaPrompt || PROMPT_DEFAULT} onChange={e => setSofiaPrompt(e.target.value)}
                      style={{ width: '100%', minHeight: 380, padding: '12px 14px', fontSize: 12, borderRadius: 9, border: '1.5px solid #e5e7eb', resize: 'vertical', lineHeight: 1.7, fontFamily: 'monospace', color: '#374151' }}/>
                  </div>
                  <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 9, padding: '12px 16px', marginBottom: 16 }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: '#166534', margin: '0 0 6px' }}>Capacidades da Sofia</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                      {['Responde automaticamente 24h', 'Agenda consultas no sistema', 'Envia horarios disponiveis', 'Reconhece pacientes cadastrados', 'Escalona para humano quando pedido', 'Segue o fluxo de menu configurado'].map(cap => (
                        <div key={cap} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ color: '#16a34a', fontSize: 14 }}>✓</span>
                          <span style={{ fontSize: 11, color: '#374151' }}>{cap}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button onClick={salvarSofia} disabled={salvandoSofia} style={{ padding: '10px 24px', borderRadius: 9, border: 'none', background: '#16a34a', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                      {salvandoSofia ? 'Salvando...' : 'Salvar configuracoes'}
                    </button>
                    <button onClick={() => setSofiaPrompt(PROMPT_DEFAULT)} style={{ padding: '10px 16px', borderRadius: 9, border: '1px solid #e5e7eb', background: 'white', color: '#6b7280', fontSize: 12, cursor: 'pointer' }}>Restaurar padrao</button>
                    {sofiaMsg && <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 600 }}>{sofiaMsg}</span>}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ABA CONFIGURACAO */}
        {aba === 'configuracao' && (
          <div style={{ flex: 1, overflow: 'auto', padding: 28 }}>
            <div style={{ maxWidth: 680 }}>
              {config && (
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: '14px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                    </div>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 700, color: '#166534', margin: 0 }}>WhatsApp conectado</p>
                      <p style={{ fontSize: 12, color: '#16a34a', margin: 0 }}>{config.phone_number || config.phone_number_id} · {config.nome_exibicao}</p>
                    </div>
                  </div>
                  <button onClick={removerConfig} style={{ fontSize: 12, color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', padding: '5px 12px', borderRadius: 7, cursor: 'pointer', fontWeight: 600 }}>Desconectar</button>
                </div>
              )}
              <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 14, overflow: 'hidden', marginBottom: 20 }}>
                <div style={{ padding: '16px 22px', borderBottom: '1px solid #f3f4f6' }}>
                  <h2 style={{ fontSize: 14, fontWeight: 700, color: '#111827', margin: '0 0 2px' }}>{config ? 'Atualizar' : 'Conectar'} numero WhatsApp</h2>
                  <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>Cada clinica usa seu proprio numero oficial do WhatsApp Business</p>
                </div>
                <form onSubmit={salvarConfig} style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>Phone Number ID *</label>
                    <input required value={form.phone_number_id} onChange={e => setForm(f => ({ ...f, phone_number_id: e.target.value }))} style={{ width: '100%', padding: '9px 12px', fontSize: 13, borderRadius: 8, border: '1.5px solid #e5e7eb', fontFamily: 'monospace' }} placeholder="2271401213668054"/>
                    <p style={{ fontSize: 11, color: '#9ca3af', margin: '4px 0 0' }}>Meta for Developers → WhatsApp → Configuracao da API</p>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>Token de acesso permanente *</label>
                    <input required type="password" value={form.access_token} onChange={e => setForm(f => ({ ...f, access_token: e.target.value }))} style={{ width: '100%', padding: '9px 12px', fontSize: 13, borderRadius: 8, border: '1.5px solid #e5e7eb', fontFamily: 'monospace' }} placeholder="EAANoj..."/>
                    <p style={{ fontSize: 11, color: '#9ca3af', margin: '4px 0 0' }}>Meta Business Manager → Usuarios do sistema → Gerar token permanente</p>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>Nome de exibicao da clinica</label>
                    <input value={form.nome_exibicao} onChange={e => setForm(f => ({ ...f, nome_exibicao: e.target.value }))} style={{ width: '100%', padding: '9px 12px', fontSize: 13, borderRadius: 8, border: '1.5px solid #e5e7eb' }} placeholder="Clinica Dr. Silva"/>
                  </div>
                  {cfgMsg && <div style={{ background: cfgMsg.tipo === 'ok' ? '#f0fdf4' : '#fef2f2', border: '1px solid ' + (cfgMsg.tipo === 'ok' ? '#bbf7d0' : '#fecaca'), borderRadius: 9, padding: '9px 14px' }}><p style={{ fontSize: 12, color: cfgMsg.tipo === 'ok' ? '#166534' : '#dc2626', margin: 0 }}>{cfgMsg.texto}</p></div>}
                  <button type="submit" disabled={salvando} style={{ padding: '10px', borderRadius: 9, border: 'none', background: '#16a34a', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{salvando ? 'Validando...' : config ? 'Atualizar conexao' : 'Conectar WhatsApp'}</button>
                </form>
              </div>
              <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 14, overflow: 'hidden' }}>
                <div style={{ padding: '16px 22px', borderBottom: '1px solid #f3f4f6' }}>
                  <h2 style={{ fontSize: 14, fontWeight: 700, color: '#111827', margin: '0 0 2px' }}>Webhook</h2>
                  <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>Configure no Meta para receber mensagens</p>
                </div>
                <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {[{ label: 'URL do callback', valor: WEBHOOK_URL }, { label: 'Token de verificacao', valor: VERIFY_TOKEN }].map(item => (
                    <div key={item.label}>
                      <p style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', margin: '0 0 5px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{item.label}</p>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <code style={{ flex: 1, padding: '8px 12px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 7, fontSize: 12, color: '#374151', fontFamily: 'monospace' }}>{item.valor}</code>
                        <button onClick={() => navigator.clipboard.writeText(item.valor)} style={{ padding: '7px 12px', background: 'white', border: '1px solid #e5e7eb', borderRadius: 7, fontSize: 11, color: '#6b7280', cursor: 'pointer', fontWeight: 600, flexShrink: 0 }}>Copiar</button>
                      </div>
                    </div>
                  ))}
                  <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 9, padding: '10px 14px', marginTop: 4 }}>
                    <p style={{ fontSize: 12, color: '#92400e', margin: 0, lineHeight: 1.5 }}>No painel Meta → WhatsApp → Configuracao → Webhook → Editar. Cole a URL e o token, clique Verificar e depois ative o campo <strong>messages</strong>.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
