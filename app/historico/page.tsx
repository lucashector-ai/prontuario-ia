'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Sidebar } from '@/components/Sidebar'

export default function Historico() {
  const router = useRouter()
  const [medico, setMedico] = useState<any>(null)
  const [consultas, setConsultas] = useState<any[]>([])
  const [carregando, setCarregando] = useState(true)
  const [selecionada, setSelecionada] = useState<any>(null)
  const [editando, setEditando] = useState(false)
  const [editForm, setEditForm] = useState<any>({})
  const [salvando, setSalvando] = useState(false)
  const [deletando, setDeletando] = useState<string | null>(null)
  const [busca, setBusca] = useState('')

  useEffect(() => {
    const m = localStorage.getItem('medico')
    if (!m) { router.push('/login'); return }
    const med = JSON.parse(m)
    setMedico(med)
    carregarConsultas(med.id)
  }, [router])

  const carregarConsultas = async (id: string) => {
    const { data } = await supabase.from('consultas').select('*').eq('medico_id', id).order('criado_em', { ascending: false })
    setConsultas(data || [])
    setCarregando(false)
  }

  const handleSelecionar = (c: any) => {
    setSelecionada(c); setEditando(false)
    setEditForm({ subjetivo: c.subjetivo, objetivo: c.objetivo, avaliacao: c.avaliacao, plano: c.plano, receita: c.receita })
  }

  const handleSalvar = async () => {
    if (!selecionada) return
    setSalvando(true)
    const { data, error } = await supabase.from('consultas').update(editForm).eq('id', selecionada.id).select().single()
    if (!error && data) {
      setSelecionada(data)
      setConsultas(prev => prev.map(c => c.id === data.id ? data : c))
      setEditando(false)
    }
    setSalvando(false)
  }

  const handleDeletar = async (id: string) => {
    if (!confirm('Deletar esta consulta? Esta ação não pode ser desfeita.')) return
    setDeletando(id)
    await supabase.from('consultas').delete().eq('id', id)
    setConsultas(prev => prev.filter(c => c.id !== id))
    if (selecionada?.id === id) setSelecionada(null)
    setDeletando(null)
  }

  const fmt = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  const consultasFiltradas = consultas.filter(c => {
    if (!busca.trim()) return true
    const b = busca.toLowerCase()
    return (
      c.subjetivo?.toLowerCase().includes(b) ||
      c.avaliacao?.toLowerCase().includes(b) ||
      c.plano?.toLowerCase().includes(b) ||
      (c.cids || []).some((cid: any) => cid.codigo?.toLowerCase().includes(b) || cid.descricao?.toLowerCase().includes(b))
    )
  })

  const secoes = [
    { key: 'subjetivo', titulo: 'S — Subjetivo', cor: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
    { key: 'objetivo',  titulo: 'O — Objetivo',  cor: '#0d9488', bg: '#f0fdfa', border: '#99f6e4' },
    { key: 'avaliacao', titulo: 'A — Avaliação',  cor: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' },
    { key: 'plano',     titulo: 'P — Plano',      cor: '#1F9D5C', bg: '#E8F7EF', border: '#A7E0BF' },
  ]

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#F5F5F5', overflow: 'hidden' }}>
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 24, gap: 0, background: '#F5F5F5' }}>
        {/* Header */}
        <div style={{ padding: '16px 24px 12px', borderBottom: 'none', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <h1 style={{ fontSize: 16, fontWeight: 700, color: '#0d1f1c', margin: 0 }}>Histórico de consultas</h1>
            <p style={{ fontSize: 12, color: '#8aa8a5', margin: 0 }}>{consultasFiltradas.length}{busca ? ` de ${consultas.length}` : ''} consultas registradas</p>
          </div>
          <a href="/consulta" style={{ fontSize: 12, fontWeight: 600, color: '#1F9D5C', background: '#E8F7EF', padding: '7px 16px', borderRadius: 8, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
            Nova consulta
          </a>
        </div>

        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '300px 1fr', overflow: 'hidden', borderRadius: 12 }}>
          {/* Lista */}
          <div style={{ borderRight: 'none', overflow: 'auto', background: 'white', padding: '12px 10px', borderRadius: 12, height: '100%' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #f3f4f6', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#F5F5F5', borderRadius: 8, padding: '7px 12px' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
            <input
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar por CID, sintoma, conduta..."
              style={{ flex: 1, border: 'none', background: 'transparent', fontSize: 12, outline: 'none', color: '#374151' }}
            />
            {busca && <span onClick={() => setBusca('')} style={{ cursor: 'pointer', color: '#9ca3af', fontSize: 16, lineHeight: 1 }}>×</span>}
          </div>
        </div>
        {carregando ? (
              <p style={{ fontSize: 13, color: '#8aa8a5', textAlign: 'center', padding: 24 }}>Carregando...</p>
            ) : consultas.length === 0 ? (
              <p style={{ fontSize: 13, color: '#8aa8a5', textAlign: 'center', padding: 24 }}>Nenhuma consulta registrada</p>
            ) : consultasFiltradas.map(c => (
              <div key={c.id} onClick={() => handleSelecionar(c)} style={{
                padding: '12px', borderRadius: 10, marginBottom: 6, cursor: 'pointer',
                background: selecionada?.id === c.id ? '#E8F7EF' : 'white',
                border: `1px solid ${selecionada?.id === c.id ? '#A7E0BF' : '#e8eeed'}`,
                transition: 'all 0.15s', position: 'relative',
              }}>
                <p style={{ fontSize: 11, color: '#8aa8a5', margin: '0 0 4px', fontWeight: 500 }}>{fmt(c.criado_em)}</p>
                <p style={{ fontSize: 12, color: '#3d5452', margin: 0, overflow: 'hidden', borderRadius: 12, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any, lineHeight: 1.5 }}>
                  {c.subjetivo?.substring(0, 90) || 'Consulta sem detalhes'}
                </p>
                {c.cids?.length > 0 && (
                  <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
                    {c.cids.slice(0, 3).map((cid: any, i: number) => (
                      <span key={i} style={{ fontSize: 10, color: '#1F9D5C', background: '#E8F7EF', padding: '1px 6px', borderRadius: 4, fontFamily: 'monospace', fontWeight: 700 }}>{cid.codigo}</span>
                    ))}
                  </div>
                )}
                <button onClick={e => { e.stopPropagation(); handleDeletar(c.id) }} disabled={deletando === c.id}
                  className="del-btn"
                  style={{ position: 'absolute', top: 8, right: 8, background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', cursor: 'pointer', padding: '2px 7px', borderRadius: 6, fontSize: 11, opacity: 0, transition: 'opacity 0.15s' }}>
                  {deletando === c.id ? '...' : '✕'}
                </button>
              </div>
            ))}
          </div>

          {/* Detalhe */}
          <div style={{ overflow: 'auto', padding: 28 }}>
            {selecionada ? (
              <div style={{ maxWidth: 700 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                  <p style={{ fontSize: 13, color: '#8aa8a5', margin: 0 }}>Consulta de {fmt(selecionada.criado_em)}</p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {editando ? (
                      <>
                        <button onClick={handleSalvar} disabled={salvando} style={{ fontSize: 12, fontWeight: 600, color: 'white', background: '#1F9D5C', border: 'none', padding: '7px 16px', borderRadius: 8, cursor: 'pointer' }}>
                          {salvando ? 'Salvando...' : 'Salvar alterações'}
                        </button>
                        <button onClick={() => setEditando(false)} style={{ fontSize: 12, color: '#3d5452', background: '#F5F5F5', padding: '7px 16px', borderRadius: 8, cursor: 'pointer' }}>
                          Cancelar
                        </button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => setEditando(true)} style={{ fontSize: 12, color: '#3d5452', background: 'white', padding: '7px 14px', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                          Editar
                        </button>
                        <button onClick={() => handleDeletar(selecionada.id)} style={{ fontSize: 12, color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', padding: '7px 14px', borderRadius: 8, cursor: 'pointer' }}>
                          Deletar
                        </button>
                            <a href={'/api/pdf-prontuario?consulta_id=' + selecionada.id + '&medico_id=' + medico?.id}
                              target="_blank" rel="noreferrer"
                              style={{display:'inline-flex',alignItems:'center',gap:4,padding:'6px 12px',borderRadius:6,background:'#f0ebff',color:'#1F9D5C',fontSize:12,fontWeight:600,textDecoration:'none',marginRight:8}}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>
                              PDF Prontuário
                            </a>
                            <a href={'/api/pdf-receita?consulta_id=' + selecionada.id + '&medico_id=' + medico?.id}
                              target="_blank" rel="noreferrer"
                              style={{ fontSize: 12, color: '#1d4ed8', background: '#eff6ff', border: '1px solid #bfdbfe', padding: '7px 14px', borderRadius: 8, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                              PDF Receita
                            </a>
                      </>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {secoes.map(({ key, titulo, cor, bg, border }) => (
                    <div key={key} style={{ background: bg, borderRadius: 10, padding: '14px 16px' }}>
                      <p style={{ fontSize: 11, fontWeight: 700, color: cor, margin: '0 0 8px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{titulo}</p>
                      {editando ? (
                        <textarea value={editForm[key] || ''}
                          onChange={e => setEditForm((f: any) => ({...f, [key]: e.target.value}))}
                          style={{ width: '100%', minHeight: 80, fontSize: 13, lineHeight: 1.6, padding: '8px', resize: 'vertical', borderRadius: 8, background: 'white', color: '#3d5452' }}/>
                      ) : (
                        <p style={{ fontSize: 13, color: '#3d5452', margin: 0, lineHeight: 1.7 }}>{(selecionada as any)[key] || '—'}</p>
                      )}
                    </div>
                  ))}

                  {selecionada.cids?.length > 0 && (
                    <div style={{ background: '#F5F5F5', borderRadius: 10, padding: '14px 16px' }}>
                      <p style={{ fontSize: 10, fontWeight: 700, color: '#8aa8a5', margin: '0 0 10px', letterSpacing: '0.08em', textTransform: 'uppercase' }}>CID-10</p>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {selecionada.cids.map((cid: any, i: number) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#E8F7EF', borderRadius: 8, padding: '6px 12px' }}>
                            <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: '#1F9D5C' }}>{cid.codigo}</span>
                            <span style={{ fontSize: 12, color: '#3d5452' }}>{cid.descricao}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
                <div style={{ width: 56, height: 56, borderRadius: 16, background: '#E8F7EF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#1F9D5C" strokeWidth="1.5"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: '#0d1f1c', margin: '0 0 4px' }}>{consultas.length === 0 ? 'Nenhuma consulta ainda' : 'Selecione uma consulta'}</p>
                  {consultas.length === 0 && (
                    <a href="/nova-consulta" style={{ display: 'inline-block', marginTop: 16, padding: '9px 20px', borderRadius: 8, background: '#1F9D5C', color: 'white', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>+ Nova consulta</a>
                  )}
                  <p style={{ fontSize: 13, color: '#8aa8a5', margin: 0 }}>{consultas.length === 0 ? 'Comece gravando sua primeira consulta' : 'Clique em qualquer consulta na lista para ver os detalhes'}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      <style>{`.del-btn { opacity: 0 !important; } div:hover > .del-btn { opacity: 1 !important; }`}</style>
    </div>
  )
}
