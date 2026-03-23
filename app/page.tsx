'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useGravador } from '@/lib/useGravador'
import { ProntuarioCard } from '@/components/ProntuarioCard'
import { ReceitaCard } from '@/components/ReceitaCard'

type Estado = 'idle' | 'gravando' | 'processando' | 'pronto' | 'erro'
type Aba = 'prontuario' | 'receita'

function SidebarIcon({ children, active, href, label }: { children: React.ReactNode, active?: boolean, href: string, label: string }) {
  return (
    <a href={href} title={label} style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      width: 40, height: 40, borderRadius: 10, textDecoration: 'none',
      background: active ? 'rgba(22,163,74,0.2)' : 'transparent',
      color: active ? '#4ade80' : 'rgba(163,184,181,0.7)',
      transition: 'all 0.15s', marginBottom: 4,
      border: active ? '1px solid rgba(22,163,74,0.3)' : '1px solid transparent',
    }}
    onMouseOver={e => { if (!active) { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#a3b8b5' } }}
    onMouseOut={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(163,184,181,0.7)' } }}>
      {children}
    </a>
  )
}

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
  const { gravando, transcrevendo, iniciarGravacao, pararGravacao, limpar, erro } = useGravador(handleNovoTexto)

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
      `PRONTUÁRIO — ${new Date().toLocaleDateString('pt-BR')}`,
      medico ? `${medico.nome} | ${medico.crm}` : '', '',
      'SUBJETIVO', prontuario.subjetivo, '',
      'OBJETIVO', prontuario.objetivo, '',
      'AVALIAÇÃO', prontuario.avaliacao, '',
      'PLANO', prontuario.plano, '',
      'CID-10', ...(prontuario.cids||[]).map((c:any) => `${c.codigo} — ${c.descricao}`),
    ].join('\n')
    navigator.clipboard.writeText(t)
    setCopiado(true); setTimeout(() => setCopiado(false), 2000)
  }

  const handleNovo = () => {
    limpar(); setTranscricao(''); setProntuario(null); setReceita(null)
    setEstado('idle'); setErroMsg(''); setConsultaSalva(false)
  }

  if (!medico) return null
  const iniciais = medico.nome?.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg)', overflow: 'hidden' }}>

      {/* Sidebar estreita estilo Linear */}
      <aside style={{
        width: 64, background: 'var(--sidebar)', display: 'flex', flexDirection: 'column',
        alignItems: 'center', padding: '16px 0', flexShrink: 0, borderRight: '1px solid rgba(255,255,255,0.06)'
      }}>
        {/* Logo */}
        <div style={{ marginBottom: 24 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, background: 'var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
            </svg>
          </div>
        </div>

        {/* Nav icons */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <SidebarIcon href="/" active label="Nova consulta">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14"/>
            </svg>
          </SidebarIcon>
          <SidebarIcon href="/historico" label="Histórico">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          </SidebarIcon>
          <SidebarIcon href="/pacientes" label="Pacientes">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
            </svg>
          </SidebarIcon>
        </div>

        {/* Avatar */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => { localStorage.removeItem('medico'); router.push('/login') }}
            title="Sair"
            style={{
              width: 36, height: 36, borderRadius: '50%', background: 'rgba(22,163,74,0.25)',
              border: '1.5px solid rgba(22,163,74,0.4)', color: '#4ade80',
              fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex',
              alignItems: 'center', justifyContent: 'center'
            }}>
            {iniciais}
          </button>
        </div>
      </aside>

      {/* Painel esquerdo — navegação secundária */}
      <div style={{
        width: 240, background: 'var(--bg2)', borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', flexShrink: 0
      }}>
        {/* Header do painel */}
        <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid var(--border)' }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', margin: '0 0 2px' }}>MedIA</p>
          <p style={{ fontSize: 11, color: 'var(--text3)', margin: 0 }}>Prontuário inteligente</p>
        </div>

        {/* Info do médico */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10, background: 'var(--accent-light)',
              border: '1.5px solid var(--accent-border)', display: 'flex',
              alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: 'var(--accent2)', flexShrink: 0
            }}>{iniciais}</div>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{medico.nome}</p>
              <p style={{ fontSize: 11, color: 'var(--text3)', margin: 0 }}>{medico.especialidade || 'Médico'}</p>
            </div>
          </div>
        </div>

        {/* Status da consulta */}
        <div style={{ padding: '16px 20px', flex: 1 }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 12px' }}>Consulta atual</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[
              { label: 'Gravação', done: estado !== 'idle' || !!transcricao, active: gravando },
              { label: 'Transcrição', done: !!transcricao, active: transcrevendo },
              { label: 'Prontuário', done: estado === 'pronto', active: estado === 'processando' },
              { label: 'Receita', done: !!receita, active: gerandoReceita },
            ].map(({ label, done, active }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                  background: done ? 'var(--accent-light)' : active ? '#fef9c3' : 'var(--bg3)',
                  border: `1.5px solid ${done ? 'var(--accent-border)' : active ? '#fde68a' : 'var(--border)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  {done ? (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="3"><path d="M20 6L9 17l-5-5"/></svg>
                  ) : active ? (
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#f59e0b' }}/>
                  ) : null}
                </div>
                <span style={{ fontSize: 12, color: done ? 'var(--text2)' : active ? 'var(--text2)' : 'var(--text3)', fontWeight: done || active ? 500 : 400 }}>{label}</span>
              </div>
            ))}
          </div>

          {consultaSalva && (
            <div style={{ marginTop: 16, background: 'var(--accent-light)', border: '1px solid var(--accent-border)', borderRadius: 8, padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
              <span style={{ fontSize: 11, color: 'var(--accent2)', fontWeight: 500 }}>Consulta salva com sucesso</span>
            </div>
          )}
        </div>

        {/* Botão nova consulta */}
        {estado === 'pronto' && (
          <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)' }}>
            <button onClick={handleNovo} style={{
              width: '100%', padding: '9px', borderRadius: 8,
              background: 'var(--bg3)', border: '1px solid var(--border)',
              color: 'var(--text2)', fontSize: 12, fontWeight: 500, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
              Nova consulta
            </button>
          </div>
        )}
      </div>

      {/* Conteúdo principal */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg)' }}>
        {/* Top bar */}
        <div style={{
          padding: '14px 28px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'var(--bg)', flexShrink: 0
        }}>
          <div>
            <h1 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Nova consulta</h1>
            <p style={{ fontSize: 11, color: 'var(--text3)', margin: 0 }}>
              {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {transcricao && estado !== 'gravando' && estado !== 'processando' && (
              <button onClick={handleEstruturar} style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: 'var(--accent)', color: 'white', fontSize: 12, fontWeight: 600,
              }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                </svg>
                Gerar prontuário
              </button>
            )}
          </div>
        </div>

        {/* Grid de conteúdo */}
        <div style={{ flex: 1, overflow: 'auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>

          {/* Coluna gravação + transcrição */}
          <div style={{ borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>

            {/* Área de gravação */}
            <div style={{ padding: '28px', borderBottom: '1px solid var(--border)' }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 16px' }}>Gravação</p>

              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                {!gravando ? (
                  <button onClick={handleIniciar} disabled={estado === 'processando'}
                    className="animate-pulse-mic"
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 10,
                      padding: '14px 32px', borderRadius: 50,
                      border: 'none', cursor: 'pointer',
                      background: estado === 'processando' ? 'var(--bg3)' : 'var(--red)',
                      color: 'white', fontSize: 14, fontWeight: 700,
                      opacity: estado === 'processando' ? 0.5 : 1,
                    }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/>
                      <path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8"/>
                    </svg>
                    Iniciar gravação
                  </button>
                ) : (
                  <button onClick={handleParar} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 10,
                    padding: '14px 32px', borderRadius: 50,
                    border: '2px solid var(--red)', cursor: 'pointer',
                    background: 'var(--red-light)', color: 'var(--red)', fontSize: 14, fontWeight: 700,
                  }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <rect x="4" y="4" width="16" height="16" rx="3"/>
                    </svg>
                    Parar gravação
                  </button>
                )}

                {gravando && (
                  <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                      {[1,2,3,4,5].map(i => (
                        <div key={i} style={{
                          width: 3, borderRadius: 3,
                          background: 'var(--red)',
                          height: `${8 + Math.random() * 16}px`,
                          opacity: 0.7 + Math.random() * 0.3,
                          animation: `pulse-mic ${0.5 + i * 0.15}s ease-in-out infinite alternate`
                        }}/>
                      ))}
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--red)', fontWeight: 500 }}>Gravando...</span>
                  </div>
                )}

                {transcrevendo && (
                  <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <svg className="spinner" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5">
                      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4"/>
                    </svg>
                    <span style={{ fontSize: 12, color: 'var(--accent2)', fontWeight: 500 }}>Transcrevendo...</span>
                  </div>
                )}
              </div>

              {erro && (
                <div style={{ background: 'var(--red-light)', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 12px' }}>
                  <p style={{ fontSize: 12, color: 'var(--red)', margin: 0 }}>{erro}</p>
                </div>
              )}
            </div>

            {/* Transcrição */}
            <div style={{ flex: 1, padding: '24px 28px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.08em', textTransform: 'uppercase', margin: 0 }}>Transcrição</p>
                {transcricao && (
                  <span style={{ fontSize: 11, color: 'var(--text3)', background: 'var(--bg2)', padding: '2px 8px', borderRadius: 6, border: '1px solid var(--border)' }}>
                    {transcricao.split(' ').length} palavras
                  </span>
                )}
              </div>
              <div style={{ flex: 1, overflow: 'auto', maxHeight: 280 }}>
                {transcricao ? (
                  <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.75, margin: 0 }}>{transcricao}</p>
                ) : (
                  <p style={{ fontSize: 13, color: 'var(--text3)', fontStyle: 'italic', margin: 0 }}>
                    {gravando ? 'Aguardando fala...' : 'A transcrição aparecerá aqui automaticamente durante a gravação.'}
                  </p>
                )}
              </div>
            </div>

            {estado === 'erro' && (
              <div style={{ padding: '0 28px 20px' }}>
                <div style={{ background: 'var(--red-light)', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px' }}>
                  <p style={{ fontSize: 12, color: 'var(--red)', margin: 0 }}>Erro: {erroMsg}</p>
                </div>
              </div>
            )}
          </div>

          {/* Coluna prontuário/receita */}
          <div style={{ display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
            {estado === 'processando' && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 48 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: '50%',
                  border: '3px solid var(--accent-border)',
                  borderTopColor: 'var(--accent)',
                  animation: 'spin 0.8s linear infinite'
                }}/>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: '0 0 4px' }}>Analisando consulta</p>
                  <p style={{ fontSize: 12, color: 'var(--text3)', margin: 0 }}>Estruturando prontuário com IA...</p>
                </div>
              </div>
            )}

            {estado === 'pronto' && prontuario && (
              <div className="animate-fade-in" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                {/* Abas */}
                <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', padding: '0 8px', background: 'var(--bg)', flexShrink: 0 }}>
                  {(['prontuario', 'receita'] as Aba[]).map(tab => (
                    <button key={tab} onClick={() => setAba(tab)} style={{
                      padding: '12px 14px', background: 'transparent', border: 'none', cursor: 'pointer',
                      fontSize: 13, fontWeight: aba === tab ? 600 : 400,
                      color: aba === tab ? 'var(--text)' : 'var(--text3)',
                      borderBottom: aba === tab ? '2px solid var(--accent)' : '2px solid transparent',
                      marginBottom: -1,
                    }}>
                      {tab === 'prontuario' ? 'Prontuário' : `Receita${receita ? ' ✓' : ''}`}
                    </button>
                  ))}
                </div>

                <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>
                  {aba === 'prontuario' && (
                    <>
                      <ProntuarioCard prontuario={prontuario} onCopiar={handleCopiar} nomeMedico={medico?.nome} crm={medico?.crm} />
                      <button onClick={handleGerarReceita} disabled={gerandoReceita} style={{
                        width: '100%', marginTop: 12, padding: '10px', borderRadius: 8,
                        border: '1px dashed var(--border2)', background: 'var(--bg2)',
                        color: 'var(--text3)', fontSize: 12, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                        fontWeight: 500,
                      }}>
                        {gerandoReceita ? (
                          <>
                            <svg className="spinner" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M2 12h4M18 12h4"/></svg>
                            Gerando receita...
                          </>
                        ) : (
                          <>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
                            Gerar receita médica
                          </>
                        )}
                      </button>
                      {copiado && <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--accent)', marginTop: 8, fontWeight: 500 }}>✓ Copiado!</p>}
                    </>
                  )}

                  {aba === 'receita' && receita && (
                    <ReceitaCard receita={receita} nomeMedico={medico?.nome} crm={medico?.crm} especialidade={medico?.especialidade} onImprimir={() => window.print()} />
                  )}

                  {aba === 'receita' && !receita && (
                    <div style={{ textAlign: 'center', padding: '48px 24px' }}>
                      <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--bg2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" strokeWidth="1.5"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                      </div>
                      <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: '0 0 6px' }}>Gerar receita médica</p>
                      <p style={{ fontSize: 13, color: 'var(--text3)', margin: '0 0 20px' }}>A IA vai extrair os medicamentos do prontuário e gerar a receita formatada.</p>
                      <button onClick={handleGerarReceita} disabled={gerandoReceita} style={{
                        padding: '10px 24px', borderRadius: 8, border: 'none', cursor: 'pointer',
                        background: 'var(--accent)', color: 'white', fontSize: 13, fontWeight: 600,
                      }}>
                        {gerandoReceita ? 'Gerando...' : 'Gerar receita'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {(estado === 'idle' || estado === 'gravando') && !prontuario && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 48 }}>
                <div style={{
                  width: 56, height: 56, borderRadius: 16, background: 'var(--accent-light)',
                  border: '1.5px solid var(--accent-border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5">
                    <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                  </svg>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: '0 0 6px' }}>Prontuário estruturado por IA</p>
                  <p style={{ fontSize: 13, color: 'var(--text3)', margin: 0, maxWidth: 280 }}>
                    Grave a consulta ao lado. O prontuário SOAP, CIDs e receita serão gerados automaticamente.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
