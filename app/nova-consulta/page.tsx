'use client'

import { useState, useCallback, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useGravador } from '@/lib/useGravador'
import { useToast } from '@/components/Toast'
import { supabase } from '@/lib/supabase'
import { ProntuarioCard } from '@/components/ProntuarioCard'
import { PacienteBanner } from '@/components/PacienteBanner'
import { PreConsultaCard } from '@/components/PreConsultaCard'
import { HistoricoRapido } from '@/components/HistoricoRapido'
import { MemedPrescricao } from '@/components/MemedPrescricao'
import { BotaoMemed } from '@/components/BotaoMemed'
import { SidebarContextoPaciente } from '@/components/SidebarContextoPaciente'
import { ModalSelecionarPaciente } from '@/components/ModalSelecionarPaciente'

type Estado = 'idle' | 'gravando' | 'processando' | 'pronto' | 'erro'
type Aba = 'prontuario' | 'receita' | 'resumo' | 'documentos'

function SearchParamsReader({ onParams }: { onParams: (pid: string | null, pnome: string | null, ptel: string | null) => void }) {
  const searchParams = useSearchParams()
  useEffect(() => {
    onParams(searchParams.get('paciente_id'), searchParams.get('paciente_nome'), searchParams.get('paciente_tel'))
  }, [searchParams, onParams])
  return null
}

export default function Home() {
  const router = useRouter()
  const { toast } = useToast()
  const [medico, setMedico] = useState<any>(null)
  const [transcricao, setTranscricao] = useState('')
  const [prontuario, setProntuario] = useState<any>(null)
  const [estado, setEstado] = useState<Estado>('idle')
  const [erroMsg, setErroMsg] = useState('')
  const [aba, setAba] = useState<Aba>('prontuario')
  const [consultaSalva, setConsultaSalva] = useState(false)
  const [copiloto, setCopiloto] = useState<any>(null)
  const [resumoPaciente, setResumoPaciente] = useState('')
  const [gerandoResumo, setGerandoResumo] = useState(false)
  const [exames, setExames] = useState<any>(null)
  const [atestado, setAtestado] = useState<any>(null)
  const [gerandoDoc, setGerandoDoc] = useState(false)
  const [diasAtestado, setDiasAtestado] = useState(1)
  const [modoPerfeita, setModoPerfeita] = useState(false)
  const [sugestoes, setSugestoes] = useState<string[]>([])
  const [alertasRT, setAlertasRT] = useState<string[]>([])
  const [focoConsulta, setFocoConsulta] = useState('')
  const [carregandoSugestoes, setCarregandoSugestoes] = useState(false)
  const [modalPaciente, setModalPaciente] = useState(false)
  const [pacientes, setPacientes] = useState<any[]>([])
  const [pacienteSelecionado, setPacienteSelecionado] = useState<any>(null)
  const [memedAberto, setMemedAberto] = useState(false)
  const [buscaPaciente, setBuscaPaciente] = useState('')
  const [buscaInputFocada, setBuscaInputFocada] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)

  useEffect(() => {
    (async () => {
      const ca_ = localStorage.getItem('clinica_admin')
      const m = ca_ || localStorage.getItem('medico')
      if (!m) { router.push('/login'); return }
      const med = JSON.parse(m)
      if (ca_ && med.clinica_id) {
        const { data: medicos } = await supabase
          .from('medicos').select('*')
          .eq('clinica_id', med.clinica_id)
          .order('criado_em', { ascending: true }).limit(1)
        if (medicos && medicos.length > 0) {
          setMedico(medicos[0])
        } else {
          setMedico(med)
        }
      } else {
        setMedico(med)
      }
      let url = ''
      if (ca_) {
        const admin = JSON.parse(ca_)
        if (admin.clinica_id) url = '/api/pacientes?clinica_id=' + admin.clinica_id
      } else if (med.clinica_id) {
        url = '/api/pacientes?clinica_id=' + med.clinica_id
      } else {
        url = '/api/pacientes?medico_id=' + med.id
      }
      try {
        const r = await fetch(url)
        const data = await r.json()
        const lista = Array.isArray(data) ? data : (data?.pacientes || data?.data || [])
        setPacientes(lista)
      } catch (err) {
        console.error('[nova-consulta] erro carregando pacientes:', err)
        setPacientes([])
      }
    })()
  }, [router])

  const handleSearchParams = useCallback((pid: string | null, pnome: string | null, ptel: string | null) => {
    if (pid && pnome) {
      setPacienteSelecionado({ id: pid, nome: pnome, telefone: ptel || '' })
      setModalPaciente(false)
    }
  }, [])

  const handleNovoTexto = useCallback((t: string) => setTranscricao(t), [])
  const { gravando, transcrevendo, iniciarGravacao, pararGravacao, pausarGravacao, gravandoPausado, limpar, erro } = useGravador(handleNovoTexto)

  const handleIniciar = async () => {
    limpar(); setProntuario(null)
    setConsultaSalva(false); setEstado('gravando')
    await iniciarGravacao()
  }

  const handleParar = async () => {
    pararGravacao()
    setTimeout(() => {
      if (transcricao && transcricao.trim().length > 10) {
        handleEstruturar()
      } else {
        setEstado('idle')
      }
    }, 500)
  }

  const handleEstruturar = async () => {
    if (!transcricao.trim()) return
    setEstado('processando'); setErroMsg('')
    try {
      const res = await fetch('/api/estruturar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcricao }),
      })
      const data = await res.json()
      if (data.prontuario) {
        setProntuario(data.prontuario); setEstado('pronto'); setAba('prontuario')
        salvarConsulta(data.prontuario)
      } else throw new Error(data.error)
    } catch (e: any) { setEstado('erro'); setErroMsg(e.message) }
  }

  const salvarConsulta = async (p: any) => {
    if (!medico) return
    try {
      await fetch('/api/consultas', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ medico_id: medico.id, transcricao, paciente_id: pacienteSelecionado?.id || null, ...p }),
      })
      setConsultaSalva(true)
      toast('Consulta salva com sucesso!')
    if (p.paciente_id) {
      fetch('/api/copiloto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paciente_id: p.paciente_id, medico_id: medico.id, prontuario_atual: p })
      }).then(r => r.json()).then(d => setCopiloto(d)).catch(() => {})
    }
    } catch (e) { console.error(e) }
  }

const handleCopiar = () => {
    if (!prontuario) return
    const t = [
      `PRONTUÁRIO  -  ${new Date().toLocaleDateString('pt-BR')}`,
      medico ? `${medico.nome} | ${medico.crm}` : '', '',
      'SUBJETIVO', prontuario.subjetivo, '',
      'OBJETIVO', prontuario.objetivo, '',
      'AVALIAÇÃO', prontuario.avaliacao, '',
      'PLANO', prontuario.plano, '',
      'CID-10', ...(prontuario.cids||[]).map((c:any) => `${c.codigo}  -  ${c.descricao}`),
    ].join('\n')
    navigator.clipboard.writeText(t)
    toast('Prontuário copiado!')
  }

  const handleGerarResumo = async () => {
    if (!prontuario) return
    setGerandoResumo(true)
    try {
      const res = await fetch('/api/resumo-paciente', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prontuario, medico })
      })
      const data = await res.json()
      if (data.resumo) { setResumoPaciente(data.resumo); setAba('resumo') }
    } catch (e) { console.error(e) }
    finally { setGerandoResumo(false) }
  }

  const handleGerarExames = async () => {
    if (!prontuario) return
    setGerandoDoc(true)
    try {
      const res = await fetch('/api/documentos', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: 'exames', prontuario, medico })
      })
      const data = await res.json()
      if (data.exames) { setExames(data); setAba('documentos') }
    } catch (e) { console.error(e) }
    finally { setGerandoDoc(false) }
  }

  const handleGerarAtestado = async () => {
    if (!prontuario) return
    setGerandoDoc(true)
    try {
      const res = await fetch('/api/documentos', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: 'atestado', prontuario, medico, paciente: null })
      })
      const data = await res.json()
      if (data.dias !== undefined) { setAtestado({ ...data, dias: diasAtestado }); setAba('documentos') }
    } catch (e) { console.error(e) }
    finally { setGerandoDoc(false) }
  }

  const imprimirAtestado = async () => {
    if (!atestado || !medico) return
    const res = await fetch('/api/pdf-atestado', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ medico, paciente: null, atestado })
    })
    const html = await res.text()
    const win = window.open('', '_blank')
    if (win) { win.document.write(html); win.document.close(); setTimeout(() => win.print(), 500) }
  }

  const buscarSugestoes = async (texto: string) => {
    if (!texto || texto.trim().length < 50 || carregandoSugestoes) return
    setCarregandoSugestoes(true)
    try {
      const res = await fetch('/api/sugestoes-consulta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcricao: texto, especialidade: medico?.especialidade || '' })
      })
      const data = await res.json()
      if (data.sugestoes) setSugestoes(data.sugestoes)
      if (data.alertas) setAlertasRT(data.alertas)
      if (data.foco) setFocoConsulta(data.foco)
    } catch (e) { console.error(e) }
    finally { setCarregandoSugestoes(false) }
  }

  // Dispara sugestoes quando transcricao muda (com debounce)
  useEffect(() => {
    if (!modoPerfeita || !transcricao || transcricao.trim().length < 50) return
    const timer = setTimeout(() => buscarSugestoes(transcricao), 3000)
    return () => clearTimeout(timer)
  }, [transcricao, modoPerfeita])

  const enviarWhatsApp = async (tipo: string, conteudo: string) => {
    if (!pacienteSelecionado?.telefone) { alert('Paciente sem telefone'); return }
    const tel = pacienteSelecionado.telefone.replace(/[^0-9]/g, '')
    const telWpp = tel.startsWith('55') ? tel : '55' + tel
    const m = localStorage.getItem('medico')
    const med = m ? JSON.parse(m) : null
    await fetch('/api/whatsapp/enviar', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({telefone:telWpp,texto:conteudo,medico_id:med?.id})})
    alert('Enviado pelo WhatsApp!')
  }

  const handleNovo = () => {
    limpar(); setTranscricao(''); setProntuario(null)
    setEstado('idle'); setErroMsg(''); setConsultaSalva(false)
    setPacienteSelecionado(null); setBuscaPaciente(''); setModalPaciente(true)
  }

  if (!medico) return null

  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 0, overflow: 'hidden', background: '#F5F5F5' }}>
      <Suspense fallback={null}>
        <SearchParamsReader onParams={handleSearchParams} />
      </Suspense>

      {/* Modal seleção de paciente */}
      {modalPaciente && (
        <ModalSelecionarPaciente
          pacientes={pacientes}
          onSelecionar={(p) => { setPacienteSelecionado(p); setModalPaciente(false) }}
          onFechar={() => setModalPaciente(false)}
          titulo={pacienteSelecionado ? 'Trocar paciente' : 'Selecionar paciente'}
        />
      )}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '14px 20px 18px', minWidth: 0 }}>
        {/* Top header - PacienteBanner com acoes integradas */}
        <div style={{ padding: '0 0 10px', flexShrink: 0 }}>
          <PacienteBanner
            pacienteId={pacienteSelecionado?.id || null}
            medicoId={medico?.id || ''}
            onTrocar={() => setModalPaciente(true)}
            acoes={
              <>
                {consultaSalva && (
                  <span style={{ fontSize: 11, color: '#16a34a', background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '4px 9px', borderRadius: 20, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    Salvo
                  </span>
                )}
                <button onClick={() => setModoPerfeita(m => !m)} style={{
                  fontSize: 12, fontWeight: 600,
                  color: modoPerfeita ? '#6043C1' : '#6b7280',
                  background: modoPerfeita ? '#f0ebff' : 'white',
                  border: modoPerfeita ? '1px solid #b9a9ef' : '1px solid #e5e7eb',
                  padding: '7px 12px', borderRadius: 8, cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' as const
                }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
                  </svg>
                  {modoPerfeita ? 'Modo perfeita ativo' : 'Modo perfeita'}
                </button>
                <BotaoMemed onClick={() => setMemedAberto(true)} variant="primary" disabled={!pacienteSelecionado} disabledReason="Selecione um paciente primeiro" />
                {estado === 'pronto' && (
                  <button onClick={handleNovo} style={{ fontSize: 12, fontWeight: 500, color: '#6b7280', background: 'white', border: '1px solid #e5e7eb', padding: '7px 12px', borderRadius: 8, cursor: 'pointer', whiteSpace: 'nowrap' as const }}>
                    + Nova
                  </button>
                )}
              </>
            }
          />
        </div>

        {/* Content */}
        <div style={{ display: 'grid', gridTemplateColumns: pacienteSelecionado ? '340px 1fr' : '1fr', gap: 12, flex: 1, minHeight: 0 }}>

          {/* SIDEBAR - Contexto do paciente (isolado) */}
          {pacienteSelecionado && medico && (
            <div style={{ background: 'white', borderRadius: 14, border: '1px solid #f0f0f0', padding: '14px 14px 16px', overflow: 'auto', minHeight: 0, maxHeight: '100%', alignSelf: 'stretch' as const }}>
              <p style={{ fontSize: 9, color: '#9ca3af', letterSpacing: '0.06em', fontWeight: 700, margin: '0 0 10px', textTransform: 'uppercase' as const }}>Contexto do paciente</p>
              <SidebarContextoPaciente pacienteId={pacienteSelecionado.id} medicoId={medico.id} />
            </div>
          )}

          {/* AREA PRINCIPAL - card unico que muda por estado */}
          <div style={{ background: 'white', borderRadius: 14, border: '1px solid #f0f0f0', display: 'flex', flexDirection: 'column' as const, overflow: 'hidden', minHeight: 0 }}>

            {estado === 'idle' && !prontuario && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center', gap: 18, padding: 32, overflow: 'auto', minHeight: 0 }}>
                <div style={{ width: 64, height: 64, borderRadius: 16, background: '#fef2f2', border: '1px solid #fecaca', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="1.8">
                    <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/>
                    <path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8"/>
                  </svg>
                </div>
                <div style={{ textAlign: 'center' as const, maxWidth: 380 }}>
                  <p style={{ fontSize: 17, fontWeight: 700, color: '#111827', margin: '0 0 6px' }}>Pronto para iniciar a consulta?</p>
                  <p style={{ fontSize: 13, color: '#6b7280', margin: 0, lineHeight: 1.6 }}>
                    Fale normalmente durante a consulta. A IA vai transcrever em tempo real e gerar prontuário SOAP, CIDs, receita e mais ao final.
                  </p>
                </div>
                <button onClick={handleIniciar} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 9,
                  padding: '12px 28px', borderRadius: 10, border: 'none', cursor: 'pointer',
                  background: '#dc2626', color: 'white', fontSize: 14, fontWeight: 600
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/>
                    <path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8"/>
                  </svg>
                  Iniciar gravação
                </button>
                {transcricao && (
                  <button onClick={handleEstruturar} style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid #6043C1', background: 'white', color: '#6043C1', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    Tenho transcrição salva — gerar prontuário
                  </button>
                )}
              </div>
            )}

            {estado === 'gravando' && !prontuario && (
              <>
                <div style={{ padding: '16px 24px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#dc2626', animation: 'pulse 1.5s ease-in-out infinite' as const }}/>
                    <p style={{ fontSize: 13, fontWeight: 700, color: '#dc2626', margin: 0, letterSpacing: '0.04em' as const }}>GRAVANDO</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {transcrevendo && (
                      <span style={{ fontSize: 11, color: '#9ca3af' }}>Transcrevendo...</span>
                    )}
                    {transcricao && (
                      <span style={{ fontSize: 11, color: '#9ca3af', background: '#f3f4f6', padding: '3px 9px', borderRadius: 12, fontVariantNumeric: 'tabular-nums' as const }}>
                        {transcricao.split(' ').filter(Boolean).length} palavras
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px', background: '#fafafa' }}>
                  {transcricao ? (
                    <p style={{ fontSize: 14, color: '#1f2937', lineHeight: 1.8, margin: 0, whiteSpace: 'pre-wrap' as const }}>{transcricao}</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, opacity: 0.5 }}>
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5">
                        <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/>
                        <path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8"/>
                      </svg>
                      <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>Aguardando fala do paciente...</p>
                    </div>
                  )}
                </div>

                {modoPerfeita && (sugestoes.length > 0 || focoConsulta || alertasRT.length > 0) && (
                  <div style={{ padding: '14px 22px', background: '#f0ebff', borderTop: '1px solid #e0d4ff', flexShrink: 0, maxHeight: 200, overflow: 'auto' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6043C1" strokeWidth="2.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#6043C1', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>Sugestão IA</span>
                    </div>
                    {focoConsulta && (
                      <p style={{ fontSize: 12, color: '#3C3489', margin: '0 0 6px', lineHeight: 1.5 }}>
                        <strong style={{ fontWeight: 600 }}>Foco:</strong> {focoConsulta}
                      </p>
                    )}
                    {alertasRT.map((a, i) => (
                      <p key={i} style={{ fontSize: 12, color: '#b91c1c', margin: i === 0 ? 0 : '6px 0 0', lineHeight: 1.5 }}>⚠ {a}</p>
                    ))}
                    {sugestoes.slice(0, 3).map((sug, i) => (
                      <p key={i} style={{ fontSize: 12, color: '#3C3489', margin: '6px 0 0', lineHeight: 1.5 }}>{sug}</p>
                    ))}
                  </div>
                )}

                <div style={{ padding: '14px 24px', borderTop: '1px solid #f3f4f6', display: 'flex', gap: 10, flexShrink: 0 }}>
                  <button onClick={pausarGravacao} style={{ flex: 1, padding: '11px', borderRadius: 9, border: '1px solid ' + (gravandoPausado ? '#d97706' : '#fecaca'), background: gravandoPausado ? '#fffbeb' : 'white', color: gravandoPausado ? '#d97706' : '#dc2626', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    {gravandoPausado ? 'Retomar' : 'Pausar'}
                  </button>
                  <button onClick={handleParar} style={{ flex: 2, padding: '11px', borderRadius: 9, border: 'none', background: '#6043C1', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>
                    Encerrar e gerar prontuário
                  </button>
                </div>
              </>
            )}

            {estado === 'processando' && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32, overflow: 'auto', minHeight: 0 }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', border: '3px solid #ede9fb', borderTopColor: '#6043C1', animation: 'spin 0.8s linear infinite' as const }}/>
                <div style={{ textAlign: 'center' as const }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: '#111827', margin: '0 0 4px' }}>Analisando consulta</p>
                  <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>Estruturando prontuário SOAP com IA...</p>
                </div>
              </div>
            )}

            {estado === 'erro' && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 32, overflow: 'auto', minHeight: 0 }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: '#fef2f2', border: '1px solid #fecaca', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                </div>
                <div style={{ textAlign: 'center' as const }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: '#111827', margin: '0 0 4px' }}>Erro ao processar</p>
                  <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>{erroMsg || 'Tente novamente.'}</p>
                </div>
                <button onClick={handleNovo} style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid #e5e7eb', background: 'white', color: '#374151', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
                  Recomeçar
                </button>
              </div>
            )}

            {estado === 'pronto' && prontuario && (
              <>
                <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', padding: '0 20px', flexShrink: 0 }}>
                  {(['prontuario', 'receita', 'resumo', 'documentos'] as Aba[]).map(tab => (
                    <button key={tab} onClick={() => setAba(tab)} style={{
                      padding: '14px 16px', background: 'transparent', border: 'none', cursor: 'pointer',
                      fontSize: 13, fontWeight: aba === tab ? 600 : 400,
                      color: aba === tab ? '#111827' : '#6b7280',
                      borderBottom: aba === tab ? '2px solid #6043C1' : '2px solid transparent',
                      marginBottom: -1
                    }}>
                      {tab === 'prontuario' ? 'Prontuário' : tab === 'receita' ? 'Receita' : tab === 'resumo' ? 'Resumo' : 'Documentos'}
                    </button>
                  ))}
                </div>

                <div style={{ flex: 1, overflow: 'auto', padding: '24px' }}>
                  {aba === 'prontuario' && (
                    <ProntuarioCard prontuario={prontuario} onCopiar={handleCopiar} nomeMedico={medico?.nome} crm={medico?.crm} insights={copiloto?.insights} padroes={copiloto?.padroes} totalConsultas={copiloto?.total_consultas} />
                  )}
                  {aba === 'receita' && (
                    <div style={{ textAlign: 'center' as const, padding: '60px 24px' }}>
                      <div style={{ width: 56, height: 56, borderRadius: 14, background: '#f0fdfa', border: '1px solid #99f6e4', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                        <img src="/memed-logo.svg" alt="Memed" width={28} height={28} />
                      </div>
                      <p style={{ fontSize: 14, fontWeight: 600, color: '#111827', margin: '0 0 6px' }}>Prescrição digital</p>
                      <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 20px', maxWidth: 320, marginLeft: 'auto', marginRight: 'auto' }}>Crie receitas com validade legal ICP-Brasil e envio direto pra farmácia, via Memed.</p>
                      <BotaoMemed onClick={() => setMemedAberto(true)} disabled={!pacienteSelecionado} disabledReason="Selecione um paciente primeiro" />
                    </div>
                  )}
                  {aba === 'resumo' && (
                    <div>
                      {!resumoPaciente ? (
                        <div style={{ textAlign: 'center' as const, padding: '60px 24px' }}>
                          <div style={{ width: 48, height: 48, borderRadius: 12, background: '#f0fdf4', border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="1.5"><path d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z"/></svg>
                          </div>
                          <p style={{ fontSize: 14, fontWeight: 600, color: '#111827', margin: '0 0 6px' }}>Resumo para o paciente</p>
                          <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 20px' }}>Explica a consulta em linguagem simples e acolhedora.</p>
                          <button onClick={handleGerarResumo} disabled={gerandoResumo} style={{ padding: '9px 22px', borderRadius: 8, border: 'none', background: '#16a34a', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                            {gerandoResumo ? 'Gerando...' : 'Gerar resumo'}
                          </button>
                        </div>
                      ) : (
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <p style={{ fontSize: 13, fontWeight: 700, color: '#111827', margin: 0 }}>Resumo para o paciente</p>
                            <div style={{ display: 'flex', gap: 8 }}>
                              <button onClick={() => { navigator.clipboard.writeText(resumoPaciente) }} style={{ fontSize: 11, color: '#6b7280', background: '#f3f4f6', border: 'none', padding: '5px 10px', borderRadius: 6, cursor: 'pointer' }}>Copiar</button>
                              <button onClick={() => setResumoPaciente('')} style={{ fontSize: 11, color: '#6b7280', background: '#f3f4f6', border: 'none', padding: '5px 10px', borderRadius: 6, cursor: 'pointer' }}>Regenerar</button>
                              <button onClick={() => enviarWhatsApp('resumo', resumoPaciente)} style={{ fontSize: 11, color: 'white', background: '#25d366', border: 'none', padding: '5px 10px', borderRadius: 6, cursor: 'pointer' }}>Enviar WA</button>
                            </div>
                          </div>
                          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: '16px 18px' }}>
                            <p style={{ fontSize: 13, color: '#166534', lineHeight: 1.8, margin: 0, whiteSpace: 'pre-wrap' as const }}>{resumoPaciente}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {aba === 'documentos' && (
                    <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 16 }}>
                      <div style={{ background: 'white', borderRadius: 12, padding: '16px', border: '1px solid #f0f0f0' }}>
                        <p style={{ fontSize: 13, fontWeight: 700, color: '#111827', margin: '0 0 12px' }}>Pedido de exames</p>
                        {!exames ? (
                          <button onClick={handleGerarExames} disabled={gerandoDoc} style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px dashed #d1d5db', background: '#F5F5F5', color: '#6b7280', fontSize: 12, cursor: 'pointer' }}>
                            {gerandoDoc ? 'Gerando...' : 'Gerar pedido de exames'}
                          </button>
                        ) : (
                          <div>
                            {exames.exames?.map((e: any, i: number) => (
                              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '8px 0', borderBottom: '1px solid #F5F5F5' }}>
                                <div>
                                  <p style={{ fontSize: 13, fontWeight: 600, color: '#111827', margin: 0 }}>{e.nome}</p>
                                  <p style={{ fontSize: 11, color: '#9ca3af', margin: '2px 0 0' }}>{e.indicacao}</p>
                                </div>
                                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: e.urgencia === 'urgente' ? '#fef2f2' : '#f0fdf4', color: e.urgencia === 'urgente' ? '#dc2626' : '#16a34a' }}>{e.urgencia}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div style={{ background: 'white', borderRadius: 12, padding: '16px', border: '1px solid #f0f0f0' }}>
                        <p style={{ fontSize: 13, fontWeight: 700, color: '#111827', margin: '0 0 12px' }}>Atestado médico</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                          <label style={{ fontSize: 12, color: '#6b7280' }}>Dias:</label>
                          <input type="number" min={1} max={30} value={diasAtestado} onChange={e => setDiasAtestado(Number(e.target.value))} style={{ width: 60, padding: '5px 8px', borderRadius: 6, fontSize: 13, textAlign: 'center' as const }} />
                        </div>
                        {!atestado ? (
                          <button onClick={handleGerarAtestado} disabled={gerandoDoc} style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px dashed #d1d5db', background: '#F5F5F5', color: '#6b7280', fontSize: 12, cursor: 'pointer' }}>
                            {gerandoDoc ? 'Gerando...' : 'Gerar atestado'}
                          </button>
                        ) : (
                          <button onClick={imprimirAtestado} style={{ width: '100%', padding: '9px', borderRadius: 8, background: '#6043C1', color: 'white', border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                            Imprimir atestado
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

          </div>
        </div>
      </div>
      {memedAberto && medico && pacienteSelecionado && (
        <MemedPrescricao
          medicoId={medico.id}
          paciente={{
            id: pacienteSelecionado.id,
            nome: pacienteSelecionado.nome,
            cpf: pacienteSelecionado.cpf,
            data_nascimento: pacienteSelecionado.data_nascimento,
            sexo: pacienteSelecionado.sexo,
            telefone: pacienteSelecionado.telefone,
            email: pacienteSelecionado.email,
            endereco: pacienteSelecionado.endereco,
          }}
          onClose={() => setMemedAberto(false)}
          onPrescricaoGerada={(dados) => {
            console.log('Prescricao gerada:', dados)
            setMemedAberto(false)
          }}
        />
      )}
    </div>
  )
}
