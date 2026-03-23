'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useGravador } from '@/lib/useGravador'
import { ProntuarioCard } from '@/components/ProntuarioCard'
import { ReceitaCard } from '@/components/ReceitaCard'

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

      <aside style={{
        width: 220, background: 'var(--bg2)', borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', padding: '20px 0', flexShrink: 0
      }}>
        <div style={{ padding: '0 20px 24px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8, background: 'var(--accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
              </svg>
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: 0 }}>MedIA</p>
              <p style={{ fontSize: 11, color: 'var(--text3)', margin: 0 }}>v1.0</p>
            </div>
          </div>
        </div>

        <nav style={{ padding: '16px 12px', flex: 1 }}>
          {([
            { label: 'Nova consulta', href: '/', active: true },
            { label: 'Histórico', href: '/historico', active: false },
            { label: 'Pacientes', href: '/pacientes', active: false },
          ] as const).map(item => (
            <a key={item.href} href={item.href} style={{
              display: 'flex', alignItems: 'center', padding: '8px 10px',
              borderRadius: 8, marginBottom: 2, textDecoration: 'none',
              background: item.active ? 'rgba(99,102,241,0.15)' : 'transparent',
              color: item.active ? 'var(--accent2)' : 'var(--text2)',
              fontSize: 13, fontWeight: item.active ? 500 : 400,
              border: item.active ? '1px solid rgba(99,102,241,0.2)' : '1px solid transparent',
            }}>{item.label}</a>
          ))}
        </nav>

        <div style={{ padding: '16px 12px', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px' }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%', background: 'rgba(99,102,241,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 600, color: 'var(--accent2)', flexShrink: 0
            }}>{iniciais}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{medico.nome}</p>
              <p style={{ fontSize: 11, color: 'var(--text3)', margin: 0 }}>{medico.especialidade || medico.crm}</p>
            </div>
          </div>
          <button
            onClick={() => { localStorage.removeItem('medico'); router.push('/login') }}
            style={{
              width: '100%', padding: '7px', borderRadius: 8, border: '1px solid var(--border)',
              background: 'transparent', color: 'var(--text3)', fontSize: 12, cursor: 'pointer', marginTop: 4,
            }}>
            Sair
          </button>
        </div>
      </aside>

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{
          padding: '16px 28px', borderBottom: '1px solid var(--border)',
          background: 'var(--bg2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0
        }}>
          <div>
            <h1 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', margin: 0 }}>Nova consulta</h1>
            <p style={{ fontSize: 12, color: 'var(--text3)', margin: 0 }}>
              {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {consultaSalva && (
              <span style={{ fontSize: 11, color: 'var(--green)', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', padding: '3px 10px', borderRadius: 20 }}>
                ✓ Salvo
              </span>
            )}
            {estado === 'pronto' && (
              <button onClick={handleNovo} style={{ fontSize: 12, color: 'var(--text2)', background: 'var(--bg3)', border: '1px solid var(--border)', padding: '6px 14px', borderRadius: 8, cursor: 'pointer' }}>
                Nova consulta
              </button>
            )}
          </div>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignContent: 'start' }}>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }}>
              <div style={{ marginBottom: 20, textAlign: 'center' }}>
                {!gravando ? (
                  <button onClick={handleIniciar} disabled={estado === 'processando'} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 10,
                    padding: '12px 28px', borderRadius: 50, border: 'none', cursor: 'pointer',
                    background: estado === 'processando' ? 'var(--bg3)' : 'var(--red)',
                    color: 'white', fontSize: 14, fontWeight: 600,
                    opacity: estado === 'processando' ? 0.5 : 1,
                  }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="8"/></svg>
                    Iniciar gravação
                  </button>
                ) : (
                  <button onClick={handleParar} className="animate-pulse-mic" style={{
                    display: 'inline-flex', alignItems: 'center', gap: 10,
                    padding: '12px 28px', borderRadius: 50,
                    border: '2px solid var(--red)', cursor: 'pointer',
                    background: 'rgba(239,68,68,0.1)', color: 'var(--red)', fontSize: 14, fontWeight: 600,
                  }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>
                    Parar gravação
                  </button>
                )}
              </div>

              {gravando && (
                <div style={{ textAlign: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: 'var(--red)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--red)', display: 'inline-block' }}/>
                    Gravando — fale normalmente com o paciente
                  </span>
                </div>
              )}
              {transcrevendo && (
                <div style={{ textAlign: 'center' }}>
                  <span style={{ fontSize: 11, color: 'var(--text3)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <svg className="spinner" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4"/>
                    </svg>
                    Transcrevendo...
                  </span>
                </div>
              )}
              {erro && (
                <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '8px 12px', marginTop: 8 }}>
                  <p style={{ fontSize: 12, color: 'var(--red)', margin: 0 }}>{erro}</p>
                </div>
              )}
            </div>

            <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 14, padding: 20, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Transcrição</span>
                {transcricao && <span style={{ fontSize: 11, color: 'var(--text3)' }}>{transcricao.split(' ').length} palavras</span>}
              </div>
              <div style={{ minHeight: 140, maxHeight: 220, overflow: 'auto' }}>
                {transcricao ? (
                  <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7, margin: 0 }}>{transcricao}</p>
                ) : (
                  <p style={{ fontSize: 13, color: 'var(--text3)', fontStyle: 'italic', margin: 0 }}>
                    {gravando ? 'Aguardando fala...' : 'A transcrição aparecerá aqui durante a gravação.'}
                  </p>
                )}
              </div>
            </div>

            {transcricao && estado !== 'gravando' && (
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={handleEstruturar} disabled={estado === 'processando'} style={{
                  flex: 1, padding: '11px', borderRadius: 10, border: 'none', cursor: 'pointer',
                  background: estado === 'processando' ? 'var(--bg3)' : 'var(--accent)',
                  color: 'white', fontSize: 13, fontWeight: 600,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                }}>
                  {estado === 'processando' ? (
                    <>
                      <svg className="spinner" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4"/>
                      </svg>
                      Gerando prontuário...
                    </>
                  ) : 'Gerar prontuário'}
                </button>
                <button onClick={handleNovo} style={{
                  padding: '11px 16px', borderRadius: 10, border: '1px solid var(--border)',
                  background: 'transparent', color: 'var(--text3)', fontSize: 13, cursor: 'pointer'
                }}>
                  Limpar
                </button>
              </div>
            )}

            {estado === 'erro' && (
              <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '10px 14px' }}>
                <p style={{ fontSize: 12, color: 'var(--red)', margin: 0 }}>Erro: {erroMsg}</p>
              </div>
            )}
          </div>

          <div>
            {estado === 'processando' && (
              <div style={{
                background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 14,
                padding: 48, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, minHeight: 300
              }}>
                <div style={{
                  width: 44, height: 44, borderRadius: '50%',
                  border: '2px solid var(--accent)', borderTopColor: 'transparent',
                  animation: 'spin 0.8s linear infinite'
                }}/>
                <p style={{ fontSize: 13, color: 'var(--text3)', margin: 0 }}>Analisando e estruturando prontuário...</p>
              </div>
            )}

            {estado === 'pronto' && prontuario && (
              <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }} className="animate-fade-in">
                <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', padding: '0 4px' }}>
                  {(['prontuario', 'receita'] as Aba[]).map(tab => (
                    <button key={tab} onClick={() => setAba(tab)} style={{
                      padding: '12px 16px', background: 'transparent', border: 'none', cursor: 'pointer',
                      fontSize: 13, fontWeight: aba === tab ? 600 : 400,
                      color: aba === tab ? 'var(--text)' : 'var(--text3)',
                      borderBottom: aba === tab ? '2px solid var(--accent)' : '2px solid transparent',
                      marginBottom: -1, textTransform: 'capitalize'
                    }}>
                      {tab === 'receita' && receita ? 'Receita ✓' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </button>
                  ))}
                </div>

                <div style={{ padding: 20 }}>
                  {aba === 'prontuario' && (
                    <>
                      <ProntuarioCard prontuario={prontuario} onCopiar={handleCopiar} nomeMedico={medico?.nome} crm={medico?.crm} />
                      <button onClick={handleGerarReceita} disabled={gerandoReceita} style={{
                        width: '100%', marginTop: 12, padding: '10px', borderRadius: 10,
                        border: '1px solid var(--border)', background: 'transparent',
                        color: 'var(--text2)', fontSize: 13, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      }}>
                        {gerandoReceita ? 'Gerando receita...' : '+ Gerar receita médica'}
                      </button>
                    </>
                  )}

                  {aba === 'receita' && receita && (
                    <ReceitaCard receita={receita} nomeMedico={medico?.nome} crm={medico?.crm} especialidade={medico?.especialidade} onImprimir={() => window.print()} />
                  )}

                  {aba === 'receita' && !receita && (
                    <div style={{ textAlign: 'center', padding: '32px 0' }}>
                      <p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 16 }}>Nenhuma receita gerada ainda</p>
                      <button onClick={handleGerarReceita} disabled={gerandoReceita} style={{
                        padding: '10px 24px', borderRadius: 10, border: 'none', cursor: 'pointer',
                        background: 'var(--accent)', color: 'white', fontSize: 13, fontWeight: 600,
                      }}>
                        {gerandoReceita ? 'Gerando...' : 'Gerar receita médica'}
                      </button>
                    </div>
                  )}

                  {copiado && <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--green)', marginTop: 8 }}>Copiado!</p>}
                </div>
              </div>
            )}

            {(estado === 'idle' || estado === 'gravando') && !prontuario && (
              <div style={{
                background: 'var(--bg2)', border: '1px dashed var(--border)', borderRadius: 14,
                padding: 48, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, minHeight: 300
              }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--bg3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" strokeWidth="1.5">
                    <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                  </svg>
                </div>
                <p style={{ fontSize: 13, color: 'var(--text3)', margin: 0, textAlign: 'center' }}>
                  O prontuário aparecerá aqui<br/>
                  <span style={{ opacity: 0.6, fontSize: 12 }}>após você gerar da transcrição</span>
                </p>
              </div>
            )}
          </div>

        </div>
      </main>
    </div>
  )
}
