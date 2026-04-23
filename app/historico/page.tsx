'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const ACCENT = '#6043C1'
const ACCENT_LIGHT = '#ede9fb'
const BG = '#F5F5F5'
const CARD_RADIUS = 16

export default function Historico() {
  const router = useRouter()
  const [medico, setMedico] = useState<any>(null)
  const [consultas, setConsultas] = useState<any[]>([])
  const [carregando, setCarregando] = useState(true)
  const [selecionada, setSelecionada] = useState<any>(null)
  const [editando, setEditando] = useState(false)
  const [editForm, setEditForm] = useState<any>({})
  const [salvando, setSalvando] = useState(false)
  const [busca, setBusca] = useState('')
  const [toast, setToast] = useState<{tipo: string, texto: string} | null>(null)

  useEffect(() => {
    const ca = localStorage.getItem('clinica_admin')
    const m = ca || localStorage.getItem('medico')
    if (!m) { router.push('/login'); return }
    const med = JSON.parse(m)
    setMedico(med)
    carregar(med.id)
  }, [router])

  const carregar = async (id: string) => {
    const { data } = await supabase
      .from('consultas')
      .select('*')
      .eq('medico_id', id)
      .order('criado_em', { ascending: false })
    setConsultas(data || [])
    setCarregando(false)
  }

  const showToast = (tipo: string, texto: string) => {
    setToast({ tipo, texto })
    setTimeout(() => setToast(null), 3000)
  }

  const selecionar = (c: any) => {
    setSelecionada(c)
    setEditando(false)
    setEditForm({
      subjetivo: c.subjetivo || '',
      objetivo: c.objetivo || '',
      avaliacao: c.avaliacao || '',
      plano: c.plano || '',
    })
  }

  const salvar = async () => {
    if (!selecionada) return
    setSalvando(true)
    const { data, error } = await supabase
      .from('consultas')
      .update(editForm)
      .eq('id', selecionada.id)
      .select()
      .single()
    if (!error && data) {
      setSelecionada(data)
      setConsultas(prev => prev.map(c => c.id === data.id ? data : c))
      setEditando(false)
      showToast('ok', 'Alterações salvas')
    } else {
      showToast('erro', 'Erro ao salvar')
    }
    setSalvando(false)
  }

  const deletar = async (id: string) => {
    if (!confirm('Deletar esta consulta?')) return
    await supabase.from('consultas').delete().eq('id', id)
    setConsultas(prev => prev.filter(c => c.id !== id))
    if (selecionada && selecionada.id === id) setSelecionada(null)
    showToast('ok', 'Consulta removida')
  }

  const fmtCurto = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })

  const fmtLongo = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })

  const filtradas = consultas.filter(c => {
    if (!busca.trim()) return true
    const b = busca.toLowerCase()
    const campos = [c.subjetivo, c.avaliacao, c.plano].filter(Boolean).join(' ').toLowerCase()
    if (campos.includes(b)) return true
    if (c.cids) {
      return c.cids.some((cid: any) =>
        (cid.codigo || '').toLowerCase().includes(b) ||
        (cid.descricao || '').toLowerCase().includes(b)
      )
    }
    return false
  })

  const secoes = [
    { key: 'subjetivo', titulo: 'Subjetivo', letra: 'S', cor: '#2563eb', bg: '#eff6ff' },
    { key: 'objetivo', titulo: 'Objetivo', letra: 'O', cor: '#0d9488', bg: '#f0fdfa' },
    { key: 'avaliacao', titulo: 'Avaliação', letra: 'A', cor: '#d97706', bg: '#fffbeb' },
    { key: 'plano', titulo: 'Plano', letra: 'P', cor: ACCENT, bg: ACCENT_LIGHT },
  ]

  const abrirPdf = (tipo: string) => {
    if (!selecionada || !medico) return
    const url = '/api/pdf-' + tipo + '?consulta_id=' + selecionada.id + '&medico_id=' + medico.id
    window.open(url, '_blank')
  }

  return (
    <main style={{ height: '100%', overflow: 'auto', padding: 24, background: BG }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>Histórico de consultas</h1>
          <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>
            {filtradas.length}{busca ? ' de ' + consultas.length : ''} consulta{filtradas.length !== 1 ? 's' : ''} registrada{filtradas.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => router.push('/nova-consulta')}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '10px 18px', borderRadius: 10, border: 'none',
            background: ACCENT, color: 'white',
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          Nova consulta
        </button>
      </div>

      {toast && (
        <div style={{
          position: 'fixed', top: 24, right: 24, zIndex: 200,
          padding: '12px 20px', borderRadius: 10,
          background: toast.tipo === 'ok' ? '#ecfdf5' : '#fef2f2',
          color: toast.tipo === 'ok' ? '#065f46' : '#991b1b',
          fontSize: 13, fontWeight: 600,
          boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
        }}>
          {toast.texto}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 20, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{
            background: 'white', borderRadius: 12,
            padding: '10px 14px',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/>
              <path d="M21 21l-4.35-4.35"/>
            </svg>
            <input
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="CID, sintoma, conduta..."
              style={{ flex: 1, border: 'none', background: 'transparent', fontSize: 13, outline: 'none', color: '#374151' }}
            />
          </div>

          <div style={{
            background: 'white', borderRadius: CARD_RADIUS,
            padding: 10, display: 'flex', flexDirection: 'column', gap: 6,
            maxHeight: 'calc(100vh - 220px)', overflow: 'auto',
          }}>
            {carregando ? (
              <div style={{ padding: 40, display: 'flex', justifyContent: 'center' }}>
                <div style={{ width: 24, height: 24, border: '2px solid ' + ACCENT_LIGHT, borderTopColor: ACCENT, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}/>
              </div>
            ) : filtradas.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center' as const }}>
                <p style={{ fontSize: 13, color: '#9ca3af', margin: 0 }}>
                  {busca ? 'Nenhuma consulta encontrada' : 'Nenhuma consulta registrada'}
                </p>
              </div>
            ) : (
              filtradas.map((c: any) => {
                const ativa = selecionada && selecionada.id === c.id
                return (
                  <div
                    key={c.id}
                    onClick={() => selecionar(c)}
                    style={{
                      padding: 12, borderRadius: 10, cursor: 'pointer',
                      background: ativa ? ACCENT_LIGHT : 'transparent',
                      border: ativa ? '1.5px solid ' + ACCENT : '1.5px solid transparent',
                    }}
                  >
                    <p style={{ fontSize: 11, color: ativa ? ACCENT : '#9ca3af', margin: '0 0 4px', fontWeight: 600 }}>
                      {fmtCurto(c.criado_em)}
                    </p>
                    <p style={{ fontSize: 12, color: '#374151', margin: 0, lineHeight: 1.5 }}>
                      {(c.subjetivo || 'Consulta sem detalhes').substring(0, 100)}
                    </p>
                    {c.cids && c.cids.length > 0 && (
                      <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' as const }}>
                        {c.cids.slice(0, 3).map((cid: any, i: number) => (
                          <span key={i} style={{
                            fontSize: 10, color: ACCENT, background: 'white',
                            padding: '2px 7px', borderRadius: 5,
                            fontFamily: 'monospace', fontWeight: 700,
                          }}>
                            {cid.codigo}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>

        <div>
          {selecionada ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ background: 'white', borderRadius: CARD_RADIUS, padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' as const }}>
                  <div>
                    <p style={{ fontSize: 11, color: '#9ca3af', margin: '0 0 4px', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>
                      Consulta
                    </p>
                    <p style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: 0, textTransform: 'capitalize' as const }}>
                      {fmtLongo(selecionada.criado_em)}
                    </p>
                  </div>

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const }}>
                    {editando ? (
                      <>
                        <button
                          onClick={() => setEditando(false)}
                          disabled={salvando}
                          style={{
                            padding: '8px 16px', borderRadius: 9,
                            background: 'white', color: '#6b7280',
                            border: '1px solid #e5e7eb',
                            fontSize: 12, cursor: 'pointer',
                          }}
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={salvar}
                          disabled={salvando}
                          style={{
                            padding: '8px 16px', borderRadius: 9,
                            background: salvando ? '#9ca3af' : ACCENT,
                            color: 'white', border: 'none',
                            fontSize: 12, fontWeight: 700,
                            cursor: salvando ? 'not-allowed' : 'pointer',
                          }}
                        >
                          {salvando ? 'Salvando...' : 'Salvar alterações'}
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => abrirPdf('prontuario')}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 6,
                            padding: '8px 14px', borderRadius: 9,
                            background: ACCENT_LIGHT, color: ACCENT,
                            border: 'none',
                            fontSize: 12, fontWeight: 600, cursor: 'pointer',
                          }}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                            <polyline points="14 2 14 8 20 8"/>
                          </svg>
                          PDF prontuário
                        </button>
                        <button
                          onClick={() => abrirPdf('receita')}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 6,
                            padding: '8px 14px', borderRadius: 9,
                            background: '#eff6ff', color: '#1d4ed8',
                            border: '1px solid #bfdbfe',
                            fontSize: 12, fontWeight: 600, cursor: 'pointer',
                          }}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                            <polyline points="14 2 14 8 20 8"/>
                          </svg>
                          PDF receita
                        </button>
                        <button
                          onClick={() => setEditando(true)}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 6,
                            padding: '8px 14px', borderRadius: 9,
                            background: 'white', color: '#374151',
                            border: '1px solid #e5e7eb',
                            fontSize: 12, fontWeight: 500, cursor: 'pointer',
                          }}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                          </svg>
                          Editar
                        </button>
                        <button
                          onClick={() => deletar(selecionada.id)}
                          title="Deletar consulta"
                          style={{
                            padding: '8px 10px', borderRadius: 9,
                            background: '#fef2f2', color: '#dc2626',
                            border: '1px solid #fecaca',
                            cursor: 'pointer',
                            display: 'inline-flex', alignItems: 'center',
                          }}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                          </svg>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {secoes.map(s => (
                <div key={s.key} style={{ background: 'white', borderRadius: CARD_RADIUS, overflow: 'hidden' as const }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '14px 20px', background: s.bg,
                  }}>
                    <div style={{
                      width: 26, height: 26, borderRadius: 7,
                      background: 'white', color: s.cor,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 13, fontWeight: 700,
                    }}>
                      {s.letra}
                    </div>
                    <span style={{
                      fontSize: 12, fontWeight: 700,
                      textTransform: 'uppercase' as const, letterSpacing: '0.06em',
                      color: s.cor,
                    }}>
                      {s.titulo}
                    </span>
                  </div>
                  <div style={{ padding: 20 }}>
                    {editando ? (
                      <textarea
                        value={editForm[s.key] || ''}
                        onChange={e => setEditForm((f: any) => ({ ...f, [s.key]: e.target.value }))}
                        style={{
                          width: '100%', padding: '10px 14px', fontSize: 14,
                          borderRadius: 10, border: '1px solid #e5e7eb',
                          outline: 'none', fontFamily: 'inherit', color: '#111827',
                          background: 'white', boxSizing: 'border-box' as const,
                          minHeight: 100, resize: 'vertical' as const, lineHeight: 1.7,
                        }}
                      />
                    ) : (
                      <p style={{
                        fontSize: 14, color: '#111827', margin: 0,
                        lineHeight: 1.7, whiteSpace: 'pre-wrap' as const,
                      }}>
                        {selecionada[s.key] || '—'}
                      </p>
                    )}
                  </div>
                </div>
              ))}

              {selecionada.cids && selecionada.cids.length > 0 && (
                <div style={{ background: 'white', borderRadius: CARD_RADIUS, padding: 20 }}>
                  <p style={{
                    fontSize: 11, fontWeight: 700, color: '#6b7280', margin: '0 0 12px',
                    letterSpacing: '0.06em', textTransform: 'uppercase' as const,
                  }}>
                    CID-10 Sugeridos
                  </p>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const }}>
                    {selecionada.cids.map((cid: any, i: number) => (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        background: '#F9FAFB', borderRadius: 10,
                        padding: '8px 12px',
                      }}>
                        <span style={{
                          fontFamily: 'monospace', fontSize: 12, fontWeight: 700,
                          color: ACCENT, background: ACCENT_LIGHT,
                          padding: '3px 8px', borderRadius: 6,
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
          ) : (
            <div style={{
              background: 'white', borderRadius: CARD_RADIUS,
              padding: 60, textAlign: 'center' as const,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              minHeight: 400,
            }}>
              <div style={{
                width: 64, height: 64, borderRadius: 16,
                background: ACCENT_LIGHT, color: ACCENT,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 16,
              }}>
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                </svg>
              </div>
              <p style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: '0 0 6px' }}>
                {consultas.length === 0 ? 'Nenhuma consulta ainda' : 'Selecione uma consulta'}
              </p>
              <p style={{ fontSize: 13, color: '#9ca3af', margin: 0, maxWidth: 320 }}>
                {consultas.length === 0
                  ? 'Comece gravando sua primeira consulta — o prontuário é gerado automaticamente'
                  : 'Clique em qualquer consulta na lista pra ver os detalhes'}
              </p>
            </div>
          )}
        </div>
      </div>

      <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
    </main>
  )
}
