'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export function BuscaGlobal({ medicoId }: { medicoId: string }) {
  const [aberto, setAberto] = useState(false)
  const [query, setQuery] = useState('')
  const [resultados, setResultados] = useState<any>({ pacientes: [], consultas: [], agendamentos: [] })
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setAberto(true)
        setTimeout(() => inputRef.current?.focus(), 50)
      }
      if (e.key === 'Escape') setAberto(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    if (!query.trim() || query.length < 2) { setResultados({ pacientes: [], consultas: [], agendamentos: [] }); return }
    const t = setTimeout(buscar, 300)
    return () => clearTimeout(t)
  }, [query])

  async function buscar() {
    setLoading(true)
    const q = query.trim()
    const [{ data: pacientes }, { data: agendamentos }] = await Promise.all([
      supabase.from('pacientes').select('id, nome, telefone, email').eq('medico_id', medicoId).ilike('nome', '%' + q + '%').limit(5),
      supabase.from('agendamentos').select('id, data_hora, motivo').eq('medico_id', medicoId).ilike('motivo', '%' + q + '%').limit(3),
    ])
    setResultados({ pacientes: pacientes || [], agendamentos: agendamentos || [] })
    setLoading(false)
  }

  function navegar(href: string) {
    router.push(href)
    setAberto(false)
    setQuery('')
  }

  if (!aberto) return (
    <button onClick={() => { setAberto(true); setTimeout(() => inputRef.current?.focus(), 50) }}
      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', borderRadius: 8, border: '1px solid #e5e7eb', background: 'white', cursor: 'pointer', color: '#9ca3af', fontSize: 13 }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
      Buscar...
      <span style={{ fontSize: 11, color: '#d1d5db', marginLeft: 4 }}>⌘K</span>
    </button>
  )

  return (
    <>
      <div onClick={() => setAberto(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100 }} />
      <div style={{ position: 'fixed', top: '15%', left: '50%', transform: 'translateX(-50%)', width: '90%', maxWidth: 560, background: 'white', borderRadius: 16, zIndex: 101, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderBottom: '1px solid #f0f0f0' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Buscar pacientes, agendamentos..." autoFocus
            style={{ flex: 1, border: 'none', outline: 'none', fontSize: 15, color: '#111827' }} />
          {loading && <div style={{ width: 16, height: 16, border: '2px solid #1F9D5C', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />}
          <button onClick={() => setAberto(false)} style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: 6, padding: '2px 8px', fontSize: 12, color: '#9ca3af', cursor: 'pointer' }}>Esc</button>
        </div>
        <div style={{ maxHeight: 400, overflow: 'auto', padding: 8 }}>
          {resultados.pacientes.length === 0 && resultados.agendamentos?.length === 0 && query.length >= 2 && !loading && (
            <p style={{ textAlign: 'center', color: '#9ca3af', fontSize: 14, padding: 24 }}>Nenhum resultado encontrado</p>
          )}
          {resultados.pacientes.length > 0 && (
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', letterSpacing: '0.06em', textTransform: 'uppercase', padding: '6px 8px 4px' }}>Pacientes</p>
              {resultados.pacientes.map((p: any) => (
                <button key={p.id} onClick={() => navegar('/pacientes/' + p.id)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '8px', borderRadius: 8, border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left' }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#1F9D5C', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                    {p.nome?.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#111827', margin: 0 }}>{p.nome}</p>
                    <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>{p.telefone || p.email || ''}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
          {resultados.agendamentos?.length > 0 && (
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', letterSpacing: '0.06em', textTransform: 'uppercase', padding: '6px 8px 4px' }}>Agendamentos</p>
              {resultados.agendamentos.map((a: any) => (
                <button key={a.id} onClick={() => navegar('/agenda')}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '8px', borderRadius: 8, border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left' }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: '#f0ebff', color: '#1F9D5C', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  </div>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#111827', margin: 0 }}>{a.motivo}</p>
                    <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>{new Date(a.data_hora).toLocaleDateString('pt-BR')}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
          {query.length < 2 && (
            <p style={{ textAlign: 'center', color: '#d1d5db', fontSize: 13, padding: 20 }}>Digite ao menos 2 caracteres para buscar</p>
          )}
        </div>
        <style>{"@keyframes spin { to { transform: rotate(360deg) } }"}</style>
      </div>
    </>
  )
}
