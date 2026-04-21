'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useGravador } from '@/lib/useGravador'
import { Sidebar } from '@/components/Sidebar'
import { useToast } from '@/components/Toast'

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
    const m = localStorage.getItem('medico')
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
      medico ? `${medico.nome} | ${medico.crm}` : '', '',
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
    { key: 'subjetivo', label: 'Subjetivo', cor: '#2563eb' },
    { key: 'objetivo', label: 'Objetivo', cor: '#1F9D5C' },
    { key: 'avaliacao', label: 'Avaliação', cor: '#d97706' },
    { key: 'plano', label: 'Plano', cor: '#059669' },
  ]

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#F5F5F5', overflow: 'hidden' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ background: 'white', borderBottom: '1px solid #e5e7eb', padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <h1 style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: 0 }}>Ditado livre</h1>
            <p style={{ fontSize: 11, color: '#9ca3af', margin: 0 }}>Dite ou escreva — a IA estrutura o prontuário</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {prontuario && (
              <>
                <button onClick={copiarTudo} style={{ fontSize: 12, color: '#1F9D5C', background: '#E8F7EF', padding: '6px 14px', borderRadius: 7, cursor: 'pointer', fontWeight: 600 }}>
                  Copiar tudo
                </button>
                <button onClick={reiniciar} style={{ fontSize: 12, color: '#6b7280', background: 'white', padding: '6px 14px', borderRadius: 7, cursor: 'pointer' }}>
                  Novo ditado
                </button>
              </>
            )}
          </div>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '24px', paddingTop: 28, display: 'grid', gridTemplateColumns: prontuario ? '1fr 1fr' : '1fr', gap: 20, maxWidth: 1200, width: '100%', margin: '0 auto' }}>

          {/* Coluna esquerda — entrada */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Toggle modo */}
            <div style={{ display: 'flex', background: '#f3f4f6', borderRadius: 8, padding: 3, width: 'fit-content' }}>
              {(['gravar', 'digitar'] as const).map(m => (
                <button key={m} onClick={() => setModo(m)} style={{
                  padding: '6px 16px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500,
                  background: modo === m ? 'white' : 'transparent',
                  color: modo === m ? '#111827' : '#6b7280',
                  boxShadow: modo === m ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                }}>
                  {m === 'gravar' ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8"/></svg>
                      Gravar
                    </span>
                  ) : (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      Digitar
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Área de entrada */}
            <div style={{ background: 'white', borderRadius: 12, overflow: 'hidden' }}>
              {modo === 'gravar' ? (
                <div style={{ padding: 24 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                    {!gravando ? (
                      <button onClick={async () => { limpar(); setTranscricao(''); await iniciarGravacao() }} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 20px', borderRadius: 8, border: 'none', background: '#dc2626', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8"/></svg>
                        Iniciar gravação
                      </button>
                    ) : (
                      <button onClick={() => pararGravacao()} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 20px', borderRadius: 8, border: '1.5px solid #dc2626', background: '#fef2f2', color: '#dc2626', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>
                        Parar
                      </button>
                    )}
                    {transcrevendo && <span style={{ fontSize: 12, color: '#6b7280' }}>Transcrevendo...</span>}
                    {gravando && <span style={{ fontSize: 11, color: '#dc2626', fontWeight: 600, background: '#fef2f2', border: '1px solid #fecaca', padding: '2px 8px', borderRadius: 20 }}>● REC</span>}
                  </div>
                  {transcricao ? (
                    <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.8, margin: 0 }}>{transcricao}</p>
                  ) : (
                    <p style={{ fontSize: 13, color: '#9ca3af', margin: 0 }}>
                      {gravando ? 'Aguardando fala...' : 'Pressione gravar e dite o prontuário livremente.'}
                    </p>
                  )}
                  {erro && <p style={{ fontSize: 12, color: '#dc2626', marginTop: 12 }}>{erro}</p>}
                </div>
              ) : (
                <textarea
                  value={textoDireto}
                  onChange={e => setTextoDireto(e.target.value)}
                  placeholder="Digite o relato da consulta livremente... A IA vai estruturar em formato SOAP."
                  style={{ width: '100%', minHeight: 240, padding: 24, fontSize: 13, color: '#374151', lineHeight: 1.8, border: 'none', outline: 'none', resize: 'vertical', fontFamily: 'inherit' }}
                />
              )}
            </div>

            {/* Botão estruturar */}
            {textoFinal.trim().length >= 20 && !gravando && (
              <button onClick={handleEstruturar} disabled={processando} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '11px', borderRadius: 9, border: 'none', background: '#1F9D5C', color: 'white', fontSize: 14, fontWeight: 700, cursor: processando ? 'default' : 'pointer', opacity: processando ? 0.7 : 1 }}>
                {processando ? (
                  <><svg style={{ animation: 'spin 0.8s linear infinite' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M2 12h4M18 12h4"/></svg>Estruturando...</>
                ) : (
                  <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>Estruturar prontuário</>
                )}
              </button>
            )}
          </div>

          {/* Coluna direita — prontuário estruturado */}
          {prontuario && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {campos.map(campo => prontuario[campo.key] && (
                <div key={campo.key} style={{ background: 'white', borderRadius: 10, overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid #f3f4f6' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.06em', color: campo.cor }}>{campo.label}</span>
                    <button onClick={() => copiar(campo.key, prontuario[campo.key])} style={{ fontSize: 11, color: copiado === campo.key ? '#059669' : '#9ca3af', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}>
                      {copiado === campo.key ? '✓ Copiado' : 'Copiar'}
                    </button>
                  </div>
                  <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.7, margin: 0, padding: '12px 14px' }}>{prontuario[campo.key]}</p>
                </div>
              ))}
              {prontuario.cids?.length > 0 && (
                <div style={{ background: 'white', borderRadius: 10, padding: '12px 14px' }}>
                  <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.06em', color: '#6b7280', margin: '0 0 8px' }}>CID-10</p>
                  {prontuario.cids.map((cid: any) => (
                    <div key={cid.codigo} style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: '#1F9D5C', background: '#E8F7EF', padding: '1px 6px', borderRadius: 4 }}>{cid.codigo}</span>
                      <span style={{ fontSize: 12, color: '#374151' }}>{cid.descricao}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
    </div>
  )
}
