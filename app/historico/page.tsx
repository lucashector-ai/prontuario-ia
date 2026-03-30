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
  const [busca, setBusca] = useState('')
  const [filtroTipo, setFiltroTipo] = useState<'todos'|'teleconsulta'|'presencial'>('todos')
  const [mostrarTranscricao, setMostrarTranscricao] = useState(false)
  const [editando, setEditando] = useState(false)
  const [editForm, setEditForm] = useState<any>({})
  const [salvando, setSalvando] = useState(false)
  const [enviandoWpp, setEnviandoWpp] = useState(false)
  const [wppOk, setWppOk] = useState<string|null>(null)
  const [deletando, setDeletando] = useState<string | null>(null)

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

  const enviarReceitaWpp = async () => {
    if (!selecionada || enviandoWpp) return
    setEnviandoWpp(true)
    try {
      // Busca telefone do paciente
      const { data: pac } = await supabase.from('pacientes').select('nome, telefone').eq('id', selecionada.paciente_id).single()
      if (!pac?.telefone) { alert('Paciente sem telefone cadastrado.'); setEnviandoWpp(false); return }
      const receita = selecionada.receita || selecionada.plano || ''
      const data = new Date(selecionada.criado_em).toLocaleDateString('pt-BR')
      const msg = 'Ola ' + (pac.nome?.split(' ')[0] || 'paciente') + '! Segue sua receita da consulta de ' + data + ':\n\n' +
        (receita || 'Consulte o medico para mais detalhes.') +
        '\n\nDr(a). ' + (medico?.nome || '') + ' — ' + (medico?.especialidade || '')
      await fetch('/api/whatsapp/enviar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telefone: pac.telefone, texto: msg, medico_id: medico?.id })
      })
      setWppOk(pac.nome)
      setTimeout(() => setWppOk(null), 4000)
    } catch (err) { console.error(err) }
    setEnviandoWpp(false)
  }

  const handleSelecionar = (c: any) => {
    setWppOk(null); setSelecionada(c); setEditando(false)
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


  const consultasFiltradas = consultas.filter((consulta) => {
    const q = busca.toLowerCase().trim()
    const campos = [consulta.pacientes?.nome, consulta.subjetivo, consulta.objetivo, consulta.avaliacao, consulta.plano, consulta.transcricao]
    const matchBusca = q === '' || campos.some((v: any) => v?.toLowerCase().includes(q)) || (Array.isArray(consulta.cids) && consulta.cids.some((cid: any) => (cid.codigo + ' ' + cid.descricao).toLowerCase().includes(q)))
    const matchTipo = filtroTipo === 'todos' || (filtroTipo === 'teleconsulta' && !!consulta.transcricao) || (filtroTipo === 'presencial' && !consulta.transcricao)
    return matchBusca && matchTipo
  })

  const fmt = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

  const secoes = [
    { key: 'subjetivo', titulo: 'S — Subjetivo', cor: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
    { key: 'objetivo',  titulo: 'O — Objetivo',  cor: '#0d9488', bg: '#f0fdfa', border: '#99f6e4' },
    { key: 'avaliacao', titulo: 'A — Avaliação',  cor: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' },
    { key: 'plano',     titulo: 'P — Plano',      cor: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
  ]


  return (
    <div style={{ display: 'flex', height: '100vh', background: '#f8fafb', overflow: 'hidden' }}>
      <Sidebar activeHref="/historico" />

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '16px 28px', borderBottom: '1px solid #e8eeed', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <h1 style={{ fontSize: 16, fontWeight: 700, color: '#0d1f1c', margin: 0 }}>Histórico de consultas</h1>
            <p style={{ fontSize: 12, color: '#8aa8a5', margin: 0 }}>{consultas.length} consultas registradas</p>
          </div>
          <a href="/" style={{ fontSize: 12, fontWeight: 600, color: '#16a34a', background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '7px 16px', borderRadius: 8, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
            Nova consulta
          </a>
        </div>

        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '300px 1fr', overflow: 'hidden' }}>
          {/* Lista */}
          <div style={{ borderRight: '1px solid #e8eeed', overflow: 'auto', background: 'white', padding: '12px 10px', display:'flex', flexDirection:'column', gap:0 }}>
          {/* Busca e filtros */}
          <div style={{ padding:'0 2px 10px', flexShrink:0 }}>
            <div style={{ position:'relative', marginBottom:8 }}>
              <svg style={{ position:'absolute', left:9, top:'50%', transform:'translateY(-50%)' }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por paciente, CID, sintoma..." style={{ width:'100%', padding:'8px 10px 8px 28px', fontSize:12, borderRadius:8, border:'1px solid #e5e7eb', background:'#f9fafb', outline:'none', color:'#374151' }}/>
            </div>
            <div style={{ display:'flex', gap:4 }}>
              {(['todos','teleconsulta','presencial'] as const).map(t => (
                <button key={t} onClick={() => setFiltroTipo(t)}
                  style={{ flex:1, padding:'5px 0', fontSize:11, fontWeight:600, borderRadius:6, border:'1px solid', cursor:'pointer',
                    background: filtroTipo === t ? '#16a34a' : 'white',
                    color: filtroTipo === t ? 'white' : '#6b7280',
                    borderColor: filtroTipo === t ? '#16a34a' : '#e5e7eb' }}>
                  {t === 'todos' ? 'Todos' : t === 'teleconsulta' ? '📹 Video' : '🏥 Presencial'}
                </button>
              ))}
            </div>
          </div>
            {carregando ? (
              <p style={{ fontSize: 13, color: '#8aa8a5', textAlign: 'center', padding: 32 }}>Carregando...</p>
            ) : consultas.length === 0 ? (
              <p style={{ fontSize: 13, color: '#8aa8a5', textAlign: 'center', padding: 32 }}>Nenhuma consulta registrada</p>
            ) : consultasFiltradas.length === 0 ? (
              <p style={{ fontSize: 12, color: '#8aa8a5', textAlign: 'center', padding: 32 }}>Nenhum resultado para "{busca}"</p>
            ) : consultasFiltradas.map(c => (
              <div key={c.id} onClick={() => handleSelecionar(c)} style={{
                padding: '12px', borderRadius: 10, marginBottom: 6, cursor: 'pointer',
                background: selecionada?.id === c.id ? '#f0fdf4' : 'white',
                border: `1px solid ${selecionada?.id === c.id ? '#bbf7d0' : '#e8eeed'}`,
                transition: 'all 0.15s', position: 'relative',
              }}>
                <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4 }}>
                <p style={{ fontSize: 11, color: '#8aa8a5', margin: 0, fontWeight: 500 }}>{fmt(c.criado_em)}</p>
                {c.transcricao && <span style={{ fontSize: 9, fontWeight: 700, color: '#1d4ed8', background: '#eff6ff', border: '1px solid #bfdbfe', padding: '1px 6px', borderRadius: 10 }}>📹 Teleconsulta</span>}
              </div>
                <p style={{ fontSize: 12, color: '#3d5452', margin: 0, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any, lineHeight: 1.5 }}>
                  {c.subjetivo?.substring(0, 90) || 'Consulta sem detalhes'}
                </p>
                {c.cids?.length > 0 && (
                  <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
                    {c.cids.slice(0, 3).map((cid: any, i: number) => (
                      <span key={i} style={{ fontSize: 10, color: '#16a34a', background: '#f0fdf4', padding: '1px 6px', borderRadius: 4, fontFamily: 'monospace', fontWeight: 700, border: '1px solid #bbf7d0' }}>{cid.codigo}</span>
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
                        <button onClick={handleSalvar} disabled={salvando} style={{ fontSize: 12, fontWeight: 600, color: 'white', background: '#16a34a', border: 'none', padding: '7px 16px', borderRadius: 8, cursor: 'pointer' }}>
                          {salvando ? 'Salvando...' : 'Salvar alterações'}
                        </button>
                        <button onClick={() => setEditando(false)} style={{ fontSize: 12, color: '#3d5452', background: 'white', border: '1px solid #e8eeed', padding: '7px 16px', borderRadius: 8, cursor: 'pointer' }}>
                          Cancelar
                        </button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => setEditando(true)} style={{ fontSize: 12, color: '#3d5452', background: 'white', border: '1px solid #e8eeed', padding: '7px 14px', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                          Editar
                        </button>
                        <button onClick={() => handleDeletar(selecionada.id)} style={{ fontSize: 12, color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', padding: '7px 14px', borderRadius: 8, cursor: 'pointer' }}>
                          Deletar
                        </button>
                            <a href={'/api/pdf-receita?consulta_id=' + selecionada.id + '&medico_id=' + medico?.id}
                              target="_blank" rel="noreferrer"
                              style={{ fontSize: 12, color: '#1d4ed8', background: '#eff6ff', border: '1px solid #bfdbfe', padding: '7px 14px', borderRadius: 8, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                              PDF Receita
                            </a>
                            {selecionada.paciente_id && (
                              <button onClick={enviarReceitaWpp} disabled={enviandoWpp}
                                style={{ fontSize:12, color:'#166534', background:'#f0fdf4', border:'1px solid #bbf7d0', padding:'7px 14px', borderRadius:8, cursor: enviandoWpp ? 'default' : 'pointer', display:'inline-flex', alignItems:'center', gap:5 }}>
                                {wppOk
                                  ? <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>Enviado!</>
                                  : enviandoWpp
                                  ? <><div style={{ width:12, height:12, borderRadius:'50%', border:'2px solid #bbf7d0', borderTopColor:'#16a34a', animation:'spin 0.8s linear infinite' }}/>Enviando...</>
                                  : <>
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                                    WhatsApp
                                  </>
                                }
                              </button>
                            )}
                      </>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {secoes.map(({ key, titulo, cor, bg, border }) => (
                    <div key={key} style={{ background: bg, border: `1px solid ${border}`, borderRadius: 10, padding: '14px 16px' }}>
                      <p style={{ fontSize: 11, fontWeight: 700, color: cor, margin: '0 0 8px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{titulo}</p>
                      {editando ? (
                        <textarea value={editForm[key] || ''}
                          onChange={e => setEditForm((f: any) => ({...f, [key]: e.target.value}))}
                          style={{ width: '100%', minHeight: 80, fontSize: 13, lineHeight: 1.6, padding: '8px', resize: 'vertical', borderRadius: 8, border: '1px solid #e8eeed', background: 'white', color: '#3d5452' }}/>
                      ) : (
                        <p style={{ fontSize: 13, color: '#3d5452', margin: 0, lineHeight: 1.7 }}>{(selecionada as any)[key] || '—'}</p>
                      )}
                    </div>
                  ))}

                  {selecionada.cids?.length > 0 && (
                    <div style={{ background: 'white', border: '1px solid #e8eeed', borderRadius: 10, padding: '14px 16px' }}>
                      <p style={{ fontSize: 10, fontWeight: 700, color: '#8aa8a5', margin: '0 0 10px', letterSpacing: '0.08em', textTransform: 'uppercase' }}>CID-10</p>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {selecionada.cids.map((cid: any, i: number) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '6px 12px' }}>
                            <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: '#16a34a' }}>{cid.codigo}</span>
                            <span style={{ fontSize: 12, color: '#3d5452' }}>{cid.descricao}</span>
                          </div>
              {/* Transcricao colapsavel */}
              {selecionada.transcricao && (
                <div style={{ marginTop:16 }}>
                  <button onClick={() => setMostrarTranscricao(!mostrarTranscricao)}
                    style={{ display:'flex', alignItems:'center', gap:6, background:'none', border:'none', cursor:'pointer', padding:0, marginBottom:8 }}>
                    <span style={{ fontSize:11, fontWeight:700, color:'#374151', textTransform:'uppercase', letterSpacing:'0.06em' }}>📝 Transcricao da consulta</span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" style={{ transform: mostrarTranscricao ? 'rotate(180deg)' : 'none', transition:'transform 0.2s' }}><polyline points="6 9 12 15 18 9"/></svg>
                  </button>
                  {mostrarTranscricao && (
                    <div style={{ background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:8, padding:'10px 12px', fontSize:12, color:'#475569', lineHeight:1.7, maxHeight:200, overflow:'auto', whiteSpace:'pre-wrap' }}>
                      {selecionada.transcricao}
                    </div>
                  )}
                </div>
              )}
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
                <div style={{ width: 56, height: 56, borderRadius: 16, background: '#f0fdf4', border: '1.5px solid #bbf7d0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="1.5"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: '#0d1f1c', margin: '0 0 4px' }}>Selecione uma consulta</p>
                  <p style={{ fontSize: 13, color: '#8aa8a5', margin: 0 }}>Clique em qualquer consulta na lista para ver os detalhes</p>
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
