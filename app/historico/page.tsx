'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

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

  useEffect(() => {
    const m = localStorage.getItem('medico')
    if (!m) { router.push('/login'); return }
    const med = JSON.parse(m)
    setMedico(med)
    carregarConsultas(med.id)
  }, [router])

  const carregarConsultas = async (medicoId: string) => {
    const { data } = await supabase.from('consultas').select('*').eq('medico_id', medicoId).order('criado_em', { ascending: false })
    setConsultas(data || [])
    setCarregando(false)
  }

  const handleSelecionar = (c: any) => {
    setSelecionada(c); setEditando(false)
    setEditForm({ subjetivo: c.subjetivo, objetivo: c.objetivo, avaliacao: c.avaliacao, plano: c.plano })
  }

  const handleSalvarEdicao = async () => {
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
    if (!confirm('Tem certeza que deseja deletar esta consulta? Esta ação não pode ser desfeita.')) return
    setDeletando(id)
    await supabase.from('consultas').delete().eq('id', id)
    setConsultas(prev => prev.filter(c => c.id !== id))
    if (selecionada?.id === id) setSelecionada(null)
    setDeletando(null)
  }

  const fmt = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg)' }}>
      {/* Sidebar */}
      <aside style={{ width: 220, background: 'var(--bg2)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', padding: '20px 0', flexShrink: 0 }}>
        <div style={{ padding: '0 20px 24px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
            </div>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: 0 }}>MedIA</p>
          </div>
        </div>
        <nav style={{ padding: '16px 12px', flex: 1 }}>
          {[
            { label: 'Nova consulta', href: '/', active: false },
            { label: 'Histórico', href: '/historico', active: true },
            { label: 'Pacientes', href: '/pacientes', active: false },
          ].map(item => (
            <a key={item.href} href={item.href} style={{
              display: 'flex', alignItems: 'center', padding: '8px 10px', borderRadius: 8, marginBottom: 2,
              textDecoration: 'none', background: item.active ? 'rgba(99,102,241,0.15)' : 'transparent',
              color: item.active ? 'var(--accent2)' : 'var(--text2)', fontSize: 13, fontWeight: item.active ? 500 : 400,
              border: item.active ? '1px solid rgba(99,102,241,0.2)' : '1px solid transparent',
            }}>{item.label}</a>
          ))}
        </nav>
        <div style={{ padding: '12px', borderTop: '1px solid var(--border)' }}>
          <p style={{ fontSize: 12, color: 'var(--text2)', padding: '8px 10px', margin: 0 }}>{medico?.nome}</p>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', background: 'var(--bg2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', margin: 0 }}>Histórico de consultas</h1>
            <p style={{ fontSize: 12, color: 'var(--text3)', margin: 0 }}>{consultas.length} consultas registradas</p>
          </div>
          <a href="/" style={{ fontSize: 12, color: 'var(--text3)', border: '1px solid var(--border)', padding: '6px 14px', borderRadius: 8, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
            + Nova consulta
          </a>
        </div>

        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '280px 1fr', overflow: 'hidden' }}>
          {/* Lista */}
          <div style={{ borderRight: '1px solid var(--border)', overflow: 'auto', padding: 12 }}>
            {carregando ? (
              <p style={{ fontSize: 13, color: 'var(--text3)', textAlign: 'center', padding: 32 }}>Carregando...</p>
            ) : consultas.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--text3)', textAlign: 'center', padding: 32 }}>Nenhuma consulta</p>
            ) : consultas.map(c => (
              <div key={c.id} onClick={() => handleSelecionar(c)}
                style={{
                  padding: '12px', borderRadius: 10, marginBottom: 6, cursor: 'pointer',
                  background: selecionada?.id === c.id ? 'rgba(99,102,241,0.1)' : 'var(--bg2)',
                  border: `1px solid ${selecionada?.id === c.id ? 'rgba(99,102,241,0.3)' : 'var(--border)'}`,
                  transition: 'all 0.15s', position: 'relative'
                }}>
                <p style={{ fontSize: 11, color: 'var(--text3)', margin: '0 0 4px' }}>{fmt(c.criado_em)}</p>
                <p style={{ fontSize: 12, color: 'var(--text2)', margin: 0, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>
                  {c.subjetivo?.substring(0, 80) || 'Consulta sem detalhes'}
                </p>
                {c.cids?.length > 0 && (
                  <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
                    {c.cids.slice(0, 2).map((cid: any, i: number) => (
                      <span key={i} style={{ fontSize: 10, color: 'var(--accent2)', background: 'rgba(99,102,241,0.1)', padding: '1px 6px', borderRadius: 4, fontFamily: 'monospace' }}>{cid.codigo}</span>
                    ))}
                  </div>
                )}
                <button onClick={e => { e.stopPropagation(); handleDeletar(c.id) }}
                  disabled={deletando === c.id}
                  style={{
                    position: 'absolute', top: 8, right: 8, background: 'transparent', border: 'none',
                    color: 'var(--text3)', cursor: 'pointer', padding: 4, borderRadius: 6, fontSize: 12,
                    opacity: 0, transition: 'opacity 0.15s'
                  }}
                  className="delete-btn">
                  {deletando === c.id ? '...' : '✕'}
                </button>
              </div>
            ))}
          </div>

          {/* Detalhe */}
          <div style={{ overflow: 'auto', padding: 24 }}>
            {selecionada ? (
              <div style={{ maxWidth: 680 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                  <p style={{ fontSize: 13, color: 'var(--text3)', margin: 0 }}>Consulta de {fmt(selecionada.criado_em)}</p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {editando ? (
                      <>
                        <button onClick={handleSalvarEdicao} disabled={salvando}
                          style={{ fontSize: 12, color: 'white', background: 'var(--accent)', border: 'none', padding: '6px 14px', borderRadius: 8, cursor: 'pointer' }}>
                          {salvando ? 'Salvando...' : 'Salvar'}
                        </button>
                        <button onClick={() => setEditando(false)}
                          style={{ fontSize: 12, color: 'var(--text3)', background: 'transparent', border: '1px solid var(--border)', padding: '6px 14px', borderRadius: 8, cursor: 'pointer' }}>
                          Cancelar
                        </button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => setEditando(true)}
                          style={{ fontSize: 12, color: 'var(--text2)', background: 'transparent', border: '1px solid var(--border)', padding: '6px 14px', borderRadius: 8, cursor: 'pointer' }}>
                          Editar
                        </button>
                        <button onClick={() => handleDeletar(selecionada.id)}
                          style={{ fontSize: 12, color: '#ef4444', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', padding: '6px 14px', borderRadius: 8, cursor: 'pointer' }}>
                          Deletar
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[
                    { key: 'subjetivo', titulo: 'S — Subjetivo', accent: '#6366f1', bg: 'rgba(99,102,241,0.08)', border: 'rgba(99,102,241,0.2)' },
                    { key: 'objetivo',  titulo: 'O — Objetivo',  accent: '#10b981', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.2)' },
                    { key: 'avaliacao', titulo: 'A — Avaliação',  accent: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)' },
                    { key: 'plano',     titulo: 'P — Plano',      accent: '#ec4899', bg: 'rgba(236,72,153,0.08)', border: 'rgba(236,72,153,0.2)' },
                  ].map(({ key, titulo, accent, bg, border }) => (
                    <div key={key} style={{ background: bg, border: `1px solid ${border}`, borderRadius: 10, padding: '12px 14px' }}>
                      <p style={{ fontSize: 11, fontWeight: 700, color: accent, margin: '0 0 8px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{titulo}</p>
                      {editando ? (
                        <textarea value={editForm[key] || ''} onChange={e => setEditForm((f: any) => ({...f, [key]: e.target.value}))}
                          style={{ width: '100%', minHeight: 80, fontSize: 12, color: 'var(--text2)', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px', resize: 'vertical', lineHeight: 1.6 }}/>
                      ) : (
                        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', margin: 0, lineHeight: 1.7 }}>{(selecionada as any)[key] || '—'}</p>
                      )}
                    </div>
                  ))}

                  {selecionada.cids?.length > 0 && (
                    <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px' }}>
                      <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', margin: '0 0 8px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>CID-10</p>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {selecionada.cids.map((cid: any, i: number) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg2)', borderRadius: 8, padding: '6px 10px' }}>
                            <span style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 700, color: 'var(--accent2)' }}>{cid.codigo}</span>
                            <span style={{ fontSize: 11, color: 'var(--text3)' }}>{cid.descricao}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12 }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--bg3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" strokeWidth="1.5"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                </div>
                <p style={{ fontSize: 13, color: 'var(--text3)', margin: 0 }}>Selecione uma consulta para ver os detalhes</p>
              </div>
            )}
          </div>
        </div>
      </main>

      <style>{`.delete-btn { opacity: 0 !important; } div:hover > .delete-btn { opacity: 1 !important; }`}</style>
    </div>
  )
}
