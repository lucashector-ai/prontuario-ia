'use client'

import { useState, useCallback, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useGravador } from '@/lib/useGravador'
import { useToast } from '@/components/Toast'
import { supabase } from '@/lib/supabase'
import { ProntuarioCard } from '@/components/ProntuarioCard'
import { ReceitaCard } from '@/components/ReceitaCard'
import { PacienteBanner } from '@/components/PacienteBanner'
import { PreConsultaCard } from '@/components/PreConsultaCard'
import { HistoricoRapido } from '@/components/HistoricoRapido'

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
  const [receita, setReceita] = useState<any>(null)
  const [estado, setEstado] = useState<Estado>('idle')
  const [gerandoReceita, setGerandoReceita] = useState(false)
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
  const [modalPaciente, setModalPaciente] = useState(true)
  const [pacientes, setPacientes] = useState<any[]>([])
  const [pacienteSelecionado, setPacienteSelecionado] = useState<any>(null)
  const [buscaPaciente, setBuscaPaciente] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)

  useEffect(() => {
    const ca_ = localStorage.getItem('clinica_admin')
    const m = ca_ || localStorage.getItem('medico')
    if (!m) { router.push('/login'); return }
    const med = JSON.parse(m)
    setMedico(med)
    supabase.from('pacientes').select('id, nome, telefone').eq('medico_id', med.id).order('nome').then(({ data }) => {
      setPacientes(data || [])
      // params lidos pelo SearchParamsReader abaixo
    })
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
    limpar(); setProntuario(null); setReceita(null)
    setConsultaSalva(false); setEstado('gravando')
    await iniciarGravacao()
  }

  const handleParar = () => { pararGravacao(); setEstado('idle') }

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

  const handleGerarReceita = async () => {
    if (!prontuario) return
    setGerandoReceita(true)
    setErroMsg('')
    try {
      const res = await fetch('/api/receita', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prontuario, paciente_id: pacienteSelecionado?.id || null, medico_id: medico?.id || null }),
      })
      const data = await res.json()
      if (data.receita) {
        setReceita(data.receita)
        setAba('receita')
        if (data.receita.alertas_interacao?.length > 0) {
          data.receita.alertas_interacao.forEach((alerta: string) => toast(alerta, 'error'))
        }
      } else throw new Error(data.error || 'Erro ao gerar receita')
    } catch (e: any) {
      toast(e.message || 'Erro ao gerar receita', 'error')
    }
    finally { setGerandoReceita(false) }
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
    limpar(); setTranscricao(''); setProntuario(null); setReceita(null)
    setEstado('idle'); setErroMsg(''); setConsultaSalva(false)
    setPacienteSelecionado(null); setBuscaPaciente(''); setModalPaciente(true)
  }

  if (!medico) return null

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#F5F5F5' }}>
      <Suspense fallback={null}>
        <SearchParamsReader onParams={handleSearchParams} />
      </Suspense>

      {/* Modal seleção de paciente */}
      {modalPaciente && !prontuario && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: 16, padding: '32px', width: 440 }}>
            <div style={{ marginBottom: 24 }}>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: '#111827', margin: '0 0 6px' }}>Nova consulta</h2>
              <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>Vincule a um paciente ou inicie uma consulta avulsa.</p>
            </div>

            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: '#374151', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Selecionar paciente</p>
              <input
                value={buscaPaciente}
                onChange={e => setBuscaPaciente(e.target.value)}
                placeholder="Buscar por nome..."
                style={{ width: '100%', padding: '9px 12px', fontSize: 13, borderRadius: 8, outline: 'none', boxSizing: 'border-box' }}
              />
              {buscaPaciente && (
                <div style={{ marginTop: 4, borderRadius: 8, overflow: 'hidden', maxHeight: 200, overflowY: 'auto' }}>
                  {pacientes.filter(p => p.nome.toLowerCase().includes(buscaPaciente.toLowerCase())).length === 0 ? (
                    <p style={{ fontSize: 12, color: '#9ca3af', padding: '12px 14px', margin: 0 }}>Nenhum paciente encontrado</p>
                  ) : pacientes.filter(p => p.nome.toLowerCase().includes(buscaPaciente.toLowerCase())).map(p => (
                    <div key={p.id}
                      onClick={() => { setPacienteSelecionado(p); setBuscaPaciente(''); setModalPaciente(false) }}
                      style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #F5F5F5', background: 'white' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#F5F5F5')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'white')}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: '#111827' }}>{p.nome}</p>
                      {p.telefone && <p style={{ margin: 0, fontSize: 11, color: '#9ca3af' }}>{p.telefone}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
              <a href="/pacientes" style={{ fontSize: 12, color: '#6043C1', fontWeight: 600, textDecoration: 'none' }}>+ Novo paciente</a>
            </div>

            <div style={{ borderTop: '1px solid #f3f4f6', marginTop: 20, paddingTop: 20, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setModalPaciente(false)}
                style={{ padding: '9px 18px', borderRadius: 8, background: 'white', color: '#6b7280', fontSize: 13, cursor: 'pointer', fontWeight: 500 }}>
                Consulta avulsa
              </button>
              <button
                onClick={() => { if (pacienteSelecionado) setModalPaciente(false) }}
                disabled={!pacienteSelecionado}
                style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: pacienteSelecionado ? '#6043C1' : '#e5e7eb', color: pacienteSelecionado ? 'white' : '#9ca3af', fontSize: 13, cursor: pacienteSelecionado ? 'pointer' : 'default', fontWeight: 600 }} title={!pacienteSelecionado ? 'Busque e selecione um paciente acima' : ''}>
                Iniciar consulta
              </button>
            </div>
            {!pacienteSelecionado && (
              <p style={{ fontSize: 11, color: '#9ca3af', margin: '8px 0 0', textAlign: 'right' }}>
                Busque um paciente acima ou clique em <strong>Consulta avulsa</strong>
              </p>
            )}
          </div>
        </div>
      )}

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 24 }}>
        {/* Top header */}
        <div style={{ padding: '0 4px 20px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexShrink: 0 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>Nova consulta</h1>
            <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>
              Grave e a IA gera prontuário SOAP, receita, exames e mais — {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {consultaSalva && (
              <span style={{ fontSize: 12, color: '#6043C1', background: '#f0fdf4', padding: '3px 10px', borderRadius: 20, fontWeight: 500 }}>
                 Salvo
              </span>
            )}
            
            <button onClick={() => setModoPerfeita(m => !m)} style={{
              fontSize: 12, fontWeight: 600,
              color: modoPerfeita ? '#6043C1' : '#6b7280',
              background: modoPerfeita ? '#f0ebff' : 'white',
              border: modoPerfeita ? '1px solid #b9a9ef' : '1px solid #e5e7eb',
              padding: '6px 12px', borderRadius: 7, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 5
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
              </svg>
              {modoPerfeita ? 'Modo perfeita ativo' : 'Modo perfeita'}
            </button>
            {estado === 'pronto' && (
              <button onClick={handleNovo} style={{ fontSize: 12, fontWeight: 500, color: '#374151', background: 'white', padding: '6px 14px', borderRadius: 7, cursor: 'pointer' }}>
                + Nova consulta
              </button>
            )}
          </div>
        </div>

        {/* Content */}
          <div className="grid-consulta">

          {/* Left  -  Gravação + Transcrição */}
          <div style={{ borderRight: 'none', borderRadius: 16, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'white' }}>

            {/* Gravação section */}
            <div style={{ padding: '28px 32px', borderBottom: '1px solid #f3f4f6' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#111827', margin: '0 0 2px' }}>Gravação da consulta</p>
                  <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>Fale normalmente. A transcrição é gerada em tempo real.</p>
                </div>
                {gravando && (
                  <span className="pulse-record" style={{ fontSize: 11, color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', padding: '3px 10px', borderRadius: 20, fontWeight: 600 }}>
                     REC
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {!gravando ? (
                  <button onClick={handleIniciar} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '9px 20px', borderRadius: 8, border: 'none', cursor: 'pointer',
                    background: '#dc2626', color: 'white', fontSize: 13, fontWeight: 600,
                  }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/>
                      <path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8"/>
                    </svg>
                    Iniciar gravação
                  </button>
                ) : (
                  <>
                  <button onClick={pausarGravacao} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 8, border: '1.5px solid ' + (gravandoPausado ? '#d97706' : '#475569'), background: gravandoPausado ? '#451a03' : '#1e293b', color: gravandoPausado ? '#fbbf24' : '#94a3b8', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{gravandoPausado ? 'RETOMAR' : 'PAUSAR'}</button>
                  <button onClick={handleParar} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '9px 20px', borderRadius: 8,
                    border: '1.5px solid #dc2626', cursor: 'pointer',
                    background: '#fef2f2', color: '#dc2626', fontSize: 13, fontWeight: 600,
                  }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <rect x="4" y="4" width="16" height="16" rx="2"/>
                    </svg>
                    Parar
                  </button>
                  </>
                )}

                {transcrevendo && (
                  <span style={{ fontSize: 12, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <svg className="spinner" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6043C1" strokeWidth="2.5">
                      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M2 12h4M18 12h4"/>
                    </svg>
                    Transcrevendo...
                  </span>
                )}

                {transcricao && (estado === 'idle' || estado === 'processando') && (
                  <button onClick={handleEstruturar} style={{
                    marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 7,
                    padding: '9px 18px', borderRadius: 8, border: 'none', cursor: 'pointer',
                    background: '#6043C1', color: 'white', fontSize: 13, fontWeight: 600,
                  }}>
                    {estado === 'processando' ? (
                      <>
                        <svg className="spinner" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M2 12h4M18 12h4"/></svg>
                        Gerando...
                      </>
                    ) : (
                      <>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                        Gerar prontuário
                      </>
                    )}
                  </button>
                )}
              </div>

              {erro && (
                <div style={{ marginTop: 12, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 12px' }}>
                  <p style={{ fontSize: 12, color: '#dc2626', margin: 0 }}>{erro}</p>
                </div>
              )}
              {estado === 'erro' && erroMsg && (
                <div style={{ marginTop: 12, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 12px' }}>
                  <p style={{ fontSize: 12, color: '#dc2626', margin: 0 }}>Erro: {erroMsg}</p>
                </div>
              )}
            </div>

            {/* Transcrição section */}
            <div style={{ flex: 1, padding: '24px 32px', overflow: 'auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#111827', margin: 0 }}>Transcrição</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {transcricao && (
                    <span style={{ fontSize: 11, color: '#9ca3af', background: '#f3f4f6', padding: '2px 8px', borderRadius: 5 }}>
                      {transcricao.split(' ').length} palavras
                    </span>
                  )}
                  {transcricao && (
                    <button onClick={handleNovo} style={{ fontSize: 11, color: '#6b7280', background: 'none', padding: '2px 8px', borderRadius: 5, cursor: 'pointer' }}>
                      Limpar
                    </button>
                  )}
                </div>
              </div>
              {modoPerfeita && estado === 'gravando' && (
                <div style={{ marginBottom: 16, background: '#f0ebff', borderRadius: 10, padding: '12px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6043C1" strokeWidth="2.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#6043C1', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>
                      Copiloto em tempo real {carregandoSugestoes ? '...' : ''}
                    </span>
                  </div>
                  {focoConsulta && (
                    <p style={{ fontSize: 12, color: '#4c1d95', margin: '0 0 10px', fontStyle: 'italic', lineHeight: 1.5 }}>
                      Foco: {focoConsulta}
                    </p>
                  )}
                  {alertasRT.length > 0 && alertasRT.map((a, i) => (
                    <div key={i} style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '6px 10px', marginBottom: 6, fontSize: 12, color: '#b91c1c', display: 'flex', gap: 6 }}>
                      <span>⚠</span>{a}
                    </div>
                  ))}
                  {sugestoes.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 5 }}>
                      {sugestoes.map((s, i) => (
                        <div key={i} style={{ background: 'white', borderRadius: 6, padding: '7px 10px', fontSize: 12, color: '#3C3489', display: 'flex', alignItems: 'center', gap: 7, cursor: 'default' }}>
                          <span style={{ width: 16, height: 16, borderRadius: '50%', background: '#6043C1', color: 'white', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</span>
                          {s}
                        </div>
                      ))}
                    </div>
                  )}
                  {sugestoes.length === 0 && !carregandoSugestoes && (
                    <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>Aguardando transcrição para gerar sugestões...</p>
                  )}
                </div>
              )}
              {transcricao ? (
                <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.8, margin: 0 }}>{transcricao}</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 160, gap: 10 }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5">
                    <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/>
                    <path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8"/>
                  </svg>
                  <p style={{ fontSize: 13, color: '#9ca3af', margin: 0, textAlign: 'center' }}>
                    {gravando ? 'Aguardando fala...' : 'Inicie a gravação para comecar'}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Right  -  Prontuario / Receita */}
          <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#F5F5F5' }}>

            {estado === 'processando' && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, background: 'white' }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', border: '3px solid #ede9fb', borderTopColor: '#6043C1', animation: 'spin 0.8s linear infinite' }}/>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: '#111827', margin: '0 0 4px' }}>Analisando consulta</p>
                  <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>Estruturando prontuário SOAP com IA...</p>
                </div>
              </div>
            )}

            {estado === 'pronto' && prontuario && (
              <div className="fade-in" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'white', borderLeft: '1px solid #e5e7eb' }}>
                {/* Tab bar */}
                <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', padding: '0 20px', background: 'white', flexShrink: 0 }}>
                  {(['prontuario', 'receita', 'resumo', 'documentos'] as Aba[]).map(tab => (
                    <button key={tab} onClick={() => setAba(tab)} style={{
                      padding: '14px 16px', background: 'transparent', border: 'none', cursor: 'pointer',
                      fontSize: 13, fontWeight: aba === tab ? 600 : 400,
                      color: aba === tab ? '#111827' : '#6b7280',
                      borderBottom: aba === tab ? '2px solid #6043C1' : '2px solid transparent',
                      marginBottom: -1,
                    }}>
                      {tab === 'prontuario' ? 'Prontuário' : tab === 'receita' ? 'Receita' : tab === 'resumo' ? 'Resumo' : 'Documentos'}
                    </button>
                  ))}
                </div>

                <div style={{ flex: 1, overflow: 'auto', padding: '24px' }}>
                  {aba === 'prontuario' && (
                    <>
                      <ProntuarioCard prontuario={prontuario} onCopiar={handleCopiar} nomeMedico={medico?.nome} crm={medico?.crm} insights={copiloto?.insights} padroes={copiloto?.padroes} totalConsultas={copiloto?.total_consultas} />
                      <button onClick={handleGerarReceita} disabled={gerandoReceita} style={{
                        width: '100%', marginTop: 12, padding: '10px', borderRadius: 8,
                        border: '1px dashed #d1d5db', background: '#F5F5F5',
                        color: '#6b7280', fontSize: 12, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, fontWeight: 500,
                      }}>
                        {gerandoReceita ? (
                          <><svg className="spinner" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M2 12h4M18 12h4"/></svg>Gerando receita...</>
                        ) : (
                          <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>Gerar receita médica</>
                        )}
                      </button>
                                    </>
                  )}
                  {aba === 'receita' && receita && (
                    <ReceitaCard receita={receita} nomeMedico={medico?.nome} crm={medico?.crm} especialidade={medico?.especialidade} onImprimir={() => window.print()} />
                  )}
                  {aba === 'receita' && !receita && (
                    <div style={{ textAlign: 'center', padding: '60px 24px' }}>
                      <div style={{ width: 48, height: 48, borderRadius: 12, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6043C1" strokeWidth="1.5"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                      </div>
                      <p style={{ fontSize: 14, fontWeight: 600, color: '#111827', margin: '0 0 6px' }}>Gerar receita médica</p>
                      <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 20px' }}>Extraida automaticamente do prontuario gerado.</p>
                      <button onClick={handleGerarReceita} style={{ padding: '9px 22px', borderRadius: 8, border: 'none', background: '#6043C1', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                        Gerar receita
                      </button>
                    </div>
                  )}
                  {aba === 'resumo' && (
                    <div>
                      {!resumoPaciente ? (
                        <div style={{ textAlign: 'center', padding: '60px 24px' }}>
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
                              <button onClick={() => enviarWhatsApp('resumo', resumoPaciente)} style={{ fontSize: 11, color: 'white', background: '#25d366', border: 'none', padding: '5px 10px', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                                <svg width="11" height="11" viewBox="0 0 175 176" fill="white"><path d="M87.2 25.2c-33.7 0-61.2 27.4-61.2 61.1a60.9 60.9 0 009.4 32.5l1.4 2.3-6.2 22.6 23.1-6.1 2.2 1.3c9.4 5.6 20.2 8.5 31.1 8.5h.1c33.7 0 61.1-27.4 61.2-61.1a60.8 60.8 0 00-17.9-43.3 60.8 60.8 0 00-43.2-17.9z"/><path fill="#25d366" d="M68.8 55.6c-1.4-3.1-2.8-3.1-4.1-3.2l-3.5-.1c-1.2 0-3.2.5-4.9 2.3s-6.4 6.3-6.4 15.3 6.6 17.8 7.5 19 12.7 20.4 31.4 27.8c15.5 6.1 18.7 4.9 22.1 4.6s10.9-4.4 12.4-8.7 1.5-8 1.1-8.7-1.7-1.2-3.5-2.1-10.9-5.4-12.6-6-2.9-.9-4.1.9-4.7 6-5.8 7.2-2.1 1.4-4 .5-7.8-2.9-14.8-9.1c-5.5-4.9-9.2-10.9-10.2-12.7s-.1-2.8.8-3.8c.8-.8 1.8-2.1 2.8-3.2s1.2-1.8 1.8-3.1.3-2.3-.2-3.2-4-10-5.7-13.6z"/></svg>
                                Enviar WA
                              </button>
                            </div>
                          </div>
                          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: '16px 18px' }}>
                            <p style={{ fontSize: 13, color: '#166534', lineHeight: 1.8, margin: 0, whiteSpace: 'pre-wrap' }}>{resumoPaciente}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {aba === 'documentos' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      <div style={{ background: 'white', borderRadius: 12, padding: '16px' }}>
                        <p style={{ fontSize: 13, fontWeight: 700, color: '#111827', margin: '0 0 12px' }}>Pedido de exames</p>
                        {!exames ? (
                          <button onClick={handleGerarExames} disabled={gerandoDoc} style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px dashed #d1d5db', background: '#F5F5F5', color: '#6b7280', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
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
                                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: e.urgencia === 'urgente' ? '#fef2f2' : '#f0fdf4', color: e.urgencia === 'urgente' ? '#dc2626' : '#16a34a', border: `1px solid ${e.urgencia === 'urgente' ? '#fecaca' : '#bbf7d0'}` }}>{e.urgencia}</span>
                              </div>
                            ))}
                            {exames.observacoes && <p style={{ fontSize: 12, color: '#6b7280', marginTop: 10, fontStyle: 'italic' }}>{exames.observacoes}</p>}
                            <button onClick={()=>{
                              const linhas = (exames.exames||[]).map((e:any) => '• ' + e.nome + ' (' + e.urgencia + '): ' + e.indicacao).join('\n')
                              const txt = 'Pedido de Exames:\n\n' + linhas + (exames.observacoes ? '\n\n' + exames.observacoes : '')
                              enviarWhatsApp('exames', txt)
                            }} style={{marginTop:10,padding:'7px 14px',borderRadius:7,border:'none',background:'#25d366',color:'white',fontSize:12,fontWeight:600,cursor:'pointer'}}>
                              📱 Enviar pelo WhatsApp
                            </button>
                          </div>
                        )}
                      </div>
                      <div style={{ background: 'white', borderRadius: 12, padding: '16px' }}>
                        <p style={{ fontSize: 13, fontWeight: 700, color: '#111827', margin: '0 0 12px' }}>Atestado médico</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                          <label style={{ fontSize: 12, color: '#6b7280' }}>Dias de afastamento:</label>
                          <input type="number" min={1} max={30} value={diasAtestado} onChange={e => setDiasAtestado(Number(e.target.value))}
                            style={{ width: 60, padding: '5px 8px', borderRadius: 6, fontSize: 13, textAlign: 'center' }} />
                        </div>
                        {!atestado ? (
                          <button onClick={handleGerarAtestado} disabled={gerandoDoc} style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px dashed #d1d5db', background: '#F5F5F5', color: '#6b7280', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                            {gerandoDoc ? 'Gerando...' : 'Gerar atestado'}
                          </button>
                        ) : (
                          <div>
                            <div style={{ background: '#F5F5F5', borderRadius: 8, padding: '12px', marginBottom: 12, fontSize: 13, color: '#374151', lineHeight: 1.7 }}>
                              <p><strong>Paciente:</strong> {atestado.cid ? `CID ${atestado.cid}` : 'conforme avaliação médica'}</p>
                              <p><strong>Afastamento:</strong> {atestado.dias} dia{atestado.dias > 1 ? 's' : ''}</p>
                              {atestado.motivo && <p><strong>Motivo:</strong> {atestado.motivo}</p>}
                            </div>
                            <button onClick={imprimirAtestado} style={{ width: '100%', padding: '9px', borderRadius: 8, background: '#6043C1', color: 'white', border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6v-8z"/></svg>
                              Imprimir atestado
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {(estado === 'idle' || estado === 'gravando') && !prontuario && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 48, background: 'white' }}>
                <div style={{ width: 56, height: 56, borderRadius: 14, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#6043C1" strokeWidth="1.5">
                    <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                  </svg>
                </div>
                <div style={{ textAlign: 'center', maxWidth: 300 }}>
                  <p style={{ fontSize: 15, fontWeight: 600, color: '#111827', margin: '0 0 8px' }}>Prontuário estruturado por IA</p>
                  <p style={{ fontSize: 13, color: '#6b7280', margin: 0, lineHeight: 1.6 }}>
                    Grave a consulta ao lado. O prontuário SOAP, CIDs sugeridos e receita médica serao gerados automaticamente.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                  {['Prontuário SOAP', 'CID-10 automático', 'Receita médica', 'Salvo no banco'].map(f => (
                    <span key={f} style={{ fontSize: 11, color: '#6043C1', background: '#f0fdf4', padding: '3px 10px', borderRadius: 20, fontWeight: 500 }}>{f}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
