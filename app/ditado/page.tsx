'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useGravador } from '@/lib/useGravador'
import { useToast } from '@/components/Toast'

const ACCENT = '#6043C1'
const ACCENT_LIGHT = '#ede9fb'
const BG = '#F5F5F5'
const CARD_RADIUS = 16

export default function Ditado() {
  const router = useRouter()
  const { toast } = useToast()
  const [medico, setMedico] = useState<any>(null)
  const [transcricao, setTranscricao] = useState('')
  const [prontuario, setProntuario] = useState<any>(null)
  const [processando, setProcessando] = useState(false)
  const [copiado, setCopiado] = useState<string | null>(null)
  const [textoDireto, setTextoDireto] = useState('')
  const [modo, setModo] = useState<'gravar' | 'digitar'>('gravar')

  useEffect(() => {
    const ca_ = localStorage.getItem('clinica_admin')
    const m = ca_ || localStorage.getItem('medico')
    if (!m) { router.push('/login'); return }
    setMedico(JSON.parse(m))
  }, [router])

  const handleNovoTexto = useCallback((t: string) => setTranscricao(t), [])
  const { gravando, transcrevendo, iniciarGravacao, pararGravacao, limpar, erro } = useGravador(handleNovoTexto)

  const textoFinal = modo === 'gravar' ? transcricao : textoDireto

  const handleEstruturar = async () => {
    if (!textoFinal.trim() || textoFinal.trim().length < 20) {
      toast('Digite ou grave pelo menos algumas frases', 'error')
      return
    }
    setProcessando(true)
    try {
      const res = await fetch('/api/estruturar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcricao: textoFinal, especialidade: medico?.especialidade || '' }),
      })
      const data = await res.json()
      if (data.prontuario) {
        setProntuario(data.prontuario)
        toast('Prontuário estruturado!')
      } else throw new Error(data.error)
    } catch (e: any) {
      toast(e.message || 'Erro ao estruturar', 'error')
    } finally {
      setProcessando(false)
    }
  }

  const copiar = (campo: string, valor: string) => {
    navigator.clipboard.writeText(valor)
    setCopiado(campo)
    setTimeout(() => setCopiado(null), 2000)
  }

  const copiarTudo = () => {
    if (!prontuario) return
    const t = [
      `PRONTUÁRIO — ${new Date().toLocaleDateString('pt-BR')}`,
      medico ? `${medico.nome} | ${medico.crm || ''}` : '', '',
      'SUBJETIVO', prontuario.subjetivo, '',
      'OBJETIVO', prontuario.objetivo, '',
      'AVALIAÇÃO', prontuario.avaliacao, '',
      'PLANO', prontuario.plano, '',
      ...(prontuario.cids || []).map((c: any) => `${c.codigo} — ${c.descricao}`),
    ].join('\n')
    navigator.clipboard.writeText(t)
    toast('Prontuário completo copiado!')
  }

  const reiniciar = () => {
    limpar(); setTranscricao(''); setTextoDireto(''); setProntuario(null)
  }

  if (!medico) return null

  const campos = [
    { key: 'subjetivo', label: 'Subjetivo', cor: '#2563eb', bg: '#eff6ff' },
    { key: 'objetivo', label: 'Objetivo', cor: ACCENT, bg: ACCENT_LIGHT },
    { key: 'avaliacao', label: 'Avaliação', cor: '#d97706', bg: '#fffbeb' },
    { key: 'plano', label: 'Plano', cor: '#059669', bg: '#f0fdf4' },
  ]

  return (
    <main style={{ height: '100%', overflow: 'auto', padding: 24, background: BG }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, gap: 16, flexWrap: 'wrap' as const }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>Ditado livre</h1>
          <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>Dite ou escreva livremente — a IA estrutura em SOAP com CIDs sugeridos</p>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {/* Toggle modo */}
          <div style={{ display: 'flex', background: 'white', borderRadius: 10, padding: 4 }}>
            {(['gravar', 'digitar'] as const).map(m => (
              <button key={m} onClick={() => setModo(m)} style={{
                padding: '8px 16px', borderRadius: 7, border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: 600,
                background: modo === m ? ACCENT_LIGHT : 'transparent',
                color: modo === m ? ACCENT : '#6b7280',
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}>
                {m === 'gravar' ? (
                  <>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/>
                      <path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8"/>
                    </svg>
                    Gravar
                  </>
                ) : (
                  <>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                    Digitar
                  </>
                )}
              </button>
            ))}
          </div>

          {prontuario && (
            <>
              <button onClick={copiarTudo} style={{
                padding: '8px 16px', borderRadius: 10, border: 'none',
                background: ACCENT, color: 'white',
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                  <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                </svg>
                Copiar tudo
              </button>
              <button onClick={reiniciar} style={{
                padding: '8px 16px', borderRadius: 10,
                background: 'white', color: '#374151', border: '1px solid #e5e7eb',
                fontSize: 12, fontWeight: 500, cursor: 'pointer',
              }}>
                Novo ditado
              </button>
            </>
          )}
        </div>
      </div>

      {/* Grid — 2 colunas quando tem prontuário, 1 coluna (100%) quando não */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: prontuario ? '1fr 1fr' : '1fr',
        gap: 20,
        width: '100%',
      }}>

        {/* Coluna esquerda — entrada (gravação ou texto) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: 'white', borderRadius: CARD_RADIUS, overflow: 'hidden' }}>
            {modo === 'gravar' ? (
              <div style={{ padding: 28 }}>
                {/* Estado da gravação */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
                  {!gravando ? (
                    <button
                      onClick={async () => { limpar(); setTranscricao(''); await iniciarGravacao() }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '12px 24px', borderRadius: 12,
                        border: 'none', background: '#dc2626', color: 'white',
                        fontSize: 14, fontWeight: 700, cursor: 'pointer',
                        boxShadow: '0 2px 8px rgba(220,38,38,0.2)',
                      }}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/>
                        <path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8"/>
                      </svg>
                      Iniciar gravação
                    </button>
                  ) : (
                    <button
                      onClick={() => pararGravacao()}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '12px 24px', borderRadius: 12,
                        border: '2px solid #dc2626', background: '#fef2f2',
                        color: '#dc2626', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <rect x="4" y="4" width="16" height="16" rx="3"/>
                      </svg>
                      Parar gravação
                    </button>
                  )}
                  {gravando && (
                    <span style={{
                      fontSize: 12, fontWeight: 700, color: '#dc2626',
                      background: '#fef2f2', border: '1px solid #fecaca',
                      padding: '4px 12px', borderRadius: 20,
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                    }}>
                      <span style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: '#dc2626', animation: 'pulse 1.2s infinite',
                      }}/>
                      GRAVANDO
                    </span>
                  )}
                  {transcrevendo && (
                    <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 500 }}>
                      Transcrevendo áudio...
                    </span>
                  )}
                </div>

                {/* Área do texto transcrito */}
                {transcricao ? (
                  <div style={{
                    padding: 20, background: '#F9FAFB', borderRadius: 12,
                    minHeight: 200, maxHeight: 500, overflow: 'auto',
                  }}>
                    <p style={{
                      fontSize: 14, color: '#111827', lineHeight: 1.8,
                      margin: 0, whiteSpace: 'pre-wrap' as const,
                    }}>
                      {transcricao}
                    </p>
                  </div>
                ) : (
                  <div style={{
                    padding: 40, background: '#F9FAFB', borderRadius: 12,
                    minHeight: 200, display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', textAlign: 'center' as const,
                  }}>
                    <div style={{
                      width: 56, height: 56, borderRadius: 14,
                      background: 'white', color: '#9ca3af',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      marginBottom: 14,
                    }}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/>
                        <path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8"/>
                      </svg>
                    </div>
                    <p style={{ fontSize: 14, fontWeight: 600, color: '#374151', margin: '0 0 4px' }}>
                      {gravando ? 'Aguardando fala...' : 'Pronto pra começar'}
                    </p>
                    <p style={{ fontSize: 12, color: '#9ca3af', margin: 0, maxWidth: 340 }}>
                      {gravando
                        ? 'Fale naturalmente. Sua fala aparece aqui conforme você grava.'
                        : 'Clique em "Iniciar gravação" e dite o prontuário livremente.'}
                    </p>
                  </div>
                )}

                {erro && (
                  <div style={{
                    marginTop: 14, padding: '10px 14px',
                    background: '#fef2f2', border: '1px solid #fecaca',
                    borderRadius: 10, fontSize: 12, color: '#991b1b',
                  }}>
                    {erro}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ padding: 0 }}>
                <textarea
                  value={textoDireto}
                  onChange={e => setTextoDireto(e.target.value)}
                  placeholder="Digite o relato da consulta livremente...&#10;&#10;A IA vai estruturar em formato SOAP (Subjetivo, Objetivo, Avaliação, Plano) e sugerir CIDs."
                  style={{
                    width: '100%', minHeight: 340, padding: 28,
                    fontSize: 14, color: '#111827', lineHeight: 1.8,
                    border: 'none', outline: 'none',
                    resize: 'vertical' as const,
                    fontFamily: 'inherit', boxSizing: 'border-box' as const,
                  }}
                />
              </div>
            )}
          </div>

          {/* Botão estruturar */}
          {textoFinal.trim().length >= 20 && !gravando && (
            <button
              onClick={handleEstruturar}
              disabled={processando}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                padding: 14, borderRadius: 12, border: 'none',
                background: processando ? '#9ca3af' : ACCENT,
                color: 'white', fontSize: 14, fontWeight: 700,
                cursor: processando ? 'not-allowed' : 'pointer',
              }}
            >
              {processando ? (
                <>
                  <svg style={{ animation: 'spin 0.8s linear infinite' }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M21 12a9 9 0 11-6.219-8.56"/>
                  </svg>
                  Estruturando prontuário...
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="9" y1="13" x2="15" y2="13"/>
                    <line x1="9" y1="17" x2="15" y2="17"/>
                  </svg>
                  Estruturar prontuário
                </>
              )}
            </button>
          )}
        </div>

        {/* Coluna direita — prontuário estruturado (só aparece após processar) */}
        {prontuario && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {campos.map(campo => prontuario[campo.key] && (
              <div key={campo.key} style={{ background: 'white', borderRadius: CARD_RADIUS, overflow: 'hidden' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '14px 20px', background: campo.bg,
                }}>
                  <span style={{
                    fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const,
                    letterSpacing: '0.06em', color: campo.cor,
                  }}>
                    {campo.label}
                  </span>
                  <button
                    onClick={() => copiar(campo.key, prontuario[campo.key])}
                    style={{
                      fontSize: 11, fontWeight: 600,
                      color: copiado === campo.key ? '#059669' : campo.cor,
                      background: 'white',
                      padding: '5px 12px', borderRadius: 7,
                      border: 'none', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 5,
                    }}
                  >
                    {copiado === campo.key ? (
                      <>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                        Copiado
                      </>
                    ) : 'Copiar'}
                  </button>
                </div>
                <p style={{
                  fontSize: 14, color: '#111827', lineHeight: 1.8,
                  margin: 0, padding: 20, whiteSpace: 'pre-wrap' as const,
                }}>
                  {prontuario[campo.key]}
                </p>
              </div>
            ))}

            {prontuario.cids?.length > 0 && (
              <div style={{ background: 'white', borderRadius: CARD_RADIUS, padding: 20 }}>
                <p style={{
                  fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const,
                  letterSpacing: '0.06em', color: '#6b7280', margin: '0 0 12px',
                }}>
                  CID-10 Sugeridos
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {prontuario.cids.map((cid: any) => (
                    <div key={cid.codigo} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '8px 12px', background: '#F9FAFB', borderRadius: 10,
                    }}>
                      <span style={{
                        fontFamily: 'monospace', fontSize: 12, fontWeight: 700,
                        color: ACCENT, background: ACCENT_LIGHT,
                        padding: '3px 8px', borderRadius: 6,
                        flexShrink: 0,
                      }}>
                        {cid.codigo}
                      </span>
                      <span style={{ fontSize: 13, color: '#374151' }}>{cid.descricao}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes pulse {
          0%, 100% { opacity: 1 }
          50% { opacity: 0.4 }
        }
      `}</style>
    </main>
  )
}
