'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useGravador } from '@/lib/useGravador'
import { ProntuarioCard } from '@/components/ProntuarioCard'
import { ReceitaCard } from '@/components/ReceitaCard'
import { Sidebar } from '@/components/Sidebar'

type Estado = 'idle' | 'gravando' | 'processando' | 'pronto' | 'erro'
type Aba = 'prontuario' | 'receita'

export default function Home() {
  const router = useRouter()
  const [medico, setMedico] = useState<any>(null)
  const [transcricao, setTranscricao] = useState('')
  const [prontuario, setProntuario] = useState<any>(null)
  const [receita, setReceita] = useState<any>(null)
  const [estado, setEstado] = useState<Estado>('idle')
  const [gerandoReceita, setGerandoReceita] = useState(false)
  const [erroMsg, setErroMsg] = useState('')
  const [aba, setAba] = useState<Aba>('prontuario')
  const [consultaSalva, setConsultaSalva] = useState(false)
  const [copiado, setCopiado] = useState(false)

  useEffect(() => {
    const m = localStorage.getItem('medico')
    if (!m) { router.push('/login'); return }
    setMedico(JSON.parse(m))
  }, [router])

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
        body: JSON.stringify({ medico_id: medico.id, transcricao, ...p }),
      })
      setConsultaSalva(true)
    } catch (e) { console.error(e) }
  }

  const handleGerarReceita = async () => {
    if (!prontuario) return
    setGerandoReceita(true)
    try {
      const res = await fetch('/api/receita', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prontuario }),
      })
      const data = await res.json()
      if (data.receita) { setReceita(data.receita); setAba('receita') }
    } catch (e) { console.error(e) }
    finally { setGerandoReceita(false) }
  }

  const handleCopiar = () => {
    if (!prontuario) return
    const t = [
      `PRONTURIO  -  ${new Date().toLocaleDateString('pt-BR')}`,
      medico ? `${medico.nome} | ${medico.crm}` : '', '',
      'SUBJETIVO', prontuario.subjetivo, '',
      'OBJETIVO', prontuario.objetivo, '',
      'AVALIACAO', prontuario.avaliacao, '',
      'PLANO', prontuario.plano, '',
      'CID-10', ...(prontuario.cids||[]).map((c:any) => `${c.codigo}  -  ${c.descricao}`),
    ].join('\n')
    navigator.clipboard.writeText(t)
    setCopiado(true); setTimeout(() => setCopiado(false), 2000)
  }

  const handleNovo = () => {
    limpar(); setTranscricao(''); setProntuario(null); setReceita(null)
    setEstado('idle'); setErroMsg(''); setConsultaSalva(false)
  }

  if (!medico) return null

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#F9FAFC' }}>
      <Sidebar activeHref="/" />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '20px 20px 20px 0' }}>
        {/* Top header */}
        <div style={{ background: 'white', borderBottom: '1px solid #e5e7eb', padding: '0 32px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h1 style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: 0 }}>Nova consulta</h1>
            <span style={{ fontSize: 12, color: '#9ca3af', background: '#f3f4f6', padding: '2px 8px', borderRadius: 5 }}>
              {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {consultaSalva && (
              <span style={{ fontSize: 12, color: '#6043C1', background: '#f0fdf4', border: '1px solid #ede9fb', padding: '3px 10px', borderRadius: 20, fontWeight: 500 }}>
                 Salvo
              </span>
            )}
            {estado === 'pronto' && (
              <button onClick={handleNovo} style={{ fontSize: 12, fontWeight: 500, color: '#374151', background: 'white', border: '1px solid #e5e7eb', padding: '6px 14px', borderRadius: 7, cursor: 'pointer' }}>
                + Nova consulta
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'grid', gridTemplateColumns: '1fr 1fr' }}>

          {/* Left  -  Gravacao + Transcricao */}
          <div style={{ borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'white' }}>

            {/* Gravacao section */}
            <div style={{ padding: '28px 32px', borderBottom: '1px solid #f3f4f6' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#111827', margin: '0 0 2px' }}>Gravacao da consulta</p>
                  <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>Fale normalmente. A transcricao e gerada em tempo real.</p>
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
                    Iniciar gravacao
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

                {transcricao && estado !== 'gravando' && (
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
                        Gerar prontuario
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

            {/* Transcricao section */}
            <div style={{ flex: 1, padding: '24px 32px', overflow: 'auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#111827', margin: 0 }}>Transcricao</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {transcricao && (
                    <span style={{ fontSize: 11, color: '#9ca3af', background: '#f3f4f6', padding: '2px 8px', borderRadius: 5 }}>
                      {transcricao.split(' ').length} palavras
                    </span>
                  )}
                  {transcricao && (
                    <button onClick={handleNovo} style={{ fontSize: 11, color: '#6b7280', background: 'none', border: '1px solid #e5e7eb', padding: '2px 8px', borderRadius: 5, cursor: 'pointer' }}>
                      Limpar
                    </button>
                  )}
                </div>
              </div>
              {transcricao ? (
                <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.8, margin: 0 }}>{transcricao}</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 160, gap: 10 }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5">
                    <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/>
                    <path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8"/>
                  </svg>
                  <p style={{ fontSize: 13, color: '#9ca3af', margin: 0, textAlign: 'center' }}>
                    {gravando ? 'Aguardando fala...' : 'Inicie a gravacao para comecar'}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Right  -  Prontuario / Receita */}
          <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#f9fafb' }}>

            {estado === 'processando' && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, background: 'white' }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', border: '3px solid #ede9fb', borderTopColor: '#6043C1', animation: 'spin 0.8s linear infinite' }}/>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: '#111827', margin: '0 0 4px' }}>Analisando consulta</p>
                  <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>Estruturando prontuario SOAP com IA...</p>
                </div>
              </div>
            )}

            {estado === 'pronto' && prontuario && (
              <div className="fade-in" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'white', borderLeft: '1px solid #e5e7eb' }}>
                {/* Tab bar */}
                <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', padding: '0 20px', background: 'white', flexShrink: 0 }}>
                  {(['prontuario', 'receita'] as Aba[]).map(tab => (
                    <button key={tab} onClick={() => setAba(tab)} style={{
                      padding: '14px 16px', background: 'transparent', border: 'none', cursor: 'pointer',
                      fontSize: 13, fontWeight: aba === tab ? 600 : 400,
                      color: aba === tab ? '#111827' : '#6b7280',
                      borderBottom: aba === tab ? '2px solid #6043C1' : '2px solid transparent',
                      marginBottom: -1,
                    }}>
                      {tab === 'prontuario' ? 'Prontuario' : `Receita${receita ? ' ' : ''}`}
                    </button>
                  ))}
                </div>

                <div style={{ flex: 1, overflow: 'auto', padding: '24px' }}>
                  {aba === 'prontuario' && (
                    <>
                      <ProntuarioCard prontuario={prontuario} onCopiar={handleCopiar} nomeMedico={medico?.nome} crm={medico?.crm} />
                      <button onClick={handleGerarReceita} disabled={gerandoReceita} style={{
                        width: '100%', marginTop: 12, padding: '10px', borderRadius: 8,
                        border: '1px dashed #d1d5db', background: '#f9fafb',
                        color: '#6b7280', fontSize: 12, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, fontWeight: 500,
                      }}>
                        {gerandoReceita ? (
                          <><svg className="spinner" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M2 12h4M18 12h4"/></svg>Gerando receita...</>
                        ) : (
                          <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>Gerar receita medica</>
                        )}
                      </button>
                      {copiado && <p style={{ textAlign: 'center', fontSize: 12, color: '#6043C1', marginTop: 8, fontWeight: 500 }}> Copiado!</p>}
                    </>
                  )}
                  {aba === 'receita' && receita && (
                    <ReceitaCard receita={receita} nomeMedico={medico?.nome} crm={medico?.crm} especialidade={medico?.especialidade} onImprimir={() => window.print()} />
                  )}
                  {aba === 'receita' && !receita && (
                    <div style={{ textAlign: 'center', padding: '60px 24px' }}>
                      <div style={{ width: 48, height: 48, borderRadius: 12, background: '#f0fdf4', border: '1px solid #ede9fb', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6043C1" strokeWidth="1.5"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                      </div>
                      <p style={{ fontSize: 14, fontWeight: 600, color: '#111827', margin: '0 0 6px' }}>Gerar receita medica</p>
                      <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 20px' }}>Extraida automaticamente do prontuario gerado.</p>
                      <button onClick={handleGerarReceita} style={{ padding: '9px 22px', borderRadius: 8, border: 'none', background: '#6043C1', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                        Gerar receita
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {(estado === 'idle' || estado === 'gravando') && !prontuario && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 48, background: 'white' }}>
                <div style={{ width: 56, height: 56, borderRadius: 14, background: '#f0fdf4', border: '1.5px solid #ede9fb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#6043C1" strokeWidth="1.5">
                    <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                  </svg>
                </div>
                <div style={{ textAlign: 'center', maxWidth: 300 }}>
                  <p style={{ fontSize: 15, fontWeight: 600, color: '#111827', margin: '0 0 8px' }}>Prontuario estruturado por IA</p>
                  <p style={{ fontSize: 13, color: '#6b7280', margin: 0, lineHeight: 1.6 }}>
                    Grave a consulta ao lado. O prontuario SOAP, CIDs sugeridos e receita medica serao gerados automaticamente.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                  {['Prontuario SOAP', 'CID-10 automatico', 'Receita medica', 'Salvo no banco'].map(f => (
                    <span key={f} style={{ fontSize: 11, color: '#6043C1', background: '#f0fdf4', border: '1px solid #ede9fb', padding: '3px 10px', borderRadius: 20, fontWeight: 500 }}>{f}</span>
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
