'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Props = {
  pacienteId: string | null
  medicoId: string
}

export function SidebarContextoPaciente({ pacienteId, medicoId }: Props) {
  const [paciente, setPaciente] = useState<any>(null)
  const [consultas, setConsultas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [consultaAberta, setConsultaAberta] = useState<any>(null)

  useEffect(() => {
    if (!pacienteId) { setLoading(false); setPaciente(null); setConsultas([]); return }
    let cancelado = false
    ;(async () => {
      setLoading(true)
      const [{ data: p }, { data: cs }] = await Promise.all([
        supabase.from('pacientes').select('*').eq('id', pacienteId).single(),
        supabase.from('consultas').select('id, criado_em, hipoteses, cids, avaliacao, plano, receita').eq('paciente_id', pacienteId).order('criado_em', { ascending: false }).limit(5),
      ])
      if (cancelado) return
      setPaciente(p)
      setConsultas(cs || [])
      setLoading(false)
    })()
    return () => { cancelado = true }
  }, [pacienteId, medicoId])

  if (!pacienteId) {
    return (
      <div style={{ padding: 16, background: '#fafafa', borderRadius: 12, border: '1px dashed #e5e7eb', textAlign: 'center' as const }}>
        <p style={{ fontSize: 11, color: '#9ca3af', margin: 0, lineHeight: 1.6 }}>
          Vincule um paciente<br />
          para ver contexto clínico
        </p>
      </div>
    )
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{ background: 'white', borderRadius: 10, padding: 12, border: '1px solid #f3f4f6', height: 70 }}>
            <div style={{ height: 8, width: '40%', background: '#f3f4f6', borderRadius: 4, marginBottom: 8 }}/>
            <div style={{ height: 10, width: '70%', background: '#f3f4f6', borderRadius: 4 }}/>
          </div>
        ))}
      </div>
    )
  }

  const fmtData = (d: string) => new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
  const primeiraHipotese = (h: any) => {
    if (!h) return null
    if (Array.isArray(h) && h.length > 0) return h[0]?.descricao || h[0]?.titulo || (typeof h[0] === 'string' ? h[0] : null)
    if (typeof h === 'string') return h
    return null
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8 }}>

      {paciente?.medicamentos_uso && (
        <div style={{ background: 'white', borderRadius: 10, padding: '11px 13px', border: '1px solid #e5e7eb' }}>
          <p style={{ fontSize: 9, color: '#6043C1', letterSpacing: '0.05em', fontWeight: 700, margin: '0 0 6px', textTransform: 'uppercase' as const }}>Medicações em uso</p>
          <p style={{ fontSize: 12, color: '#374151', margin: 0, lineHeight: 1.5, whiteSpace: 'pre-wrap' as const }}>{paciente.medicamentos_uso}</p>
        </div>
      )}

      {paciente?.comorbidades && (
        <div style={{ background: 'white', borderRadius: 10, padding: '11px 13px', border: '1px solid #e5e7eb' }}>
          <p style={{ fontSize: 9, color: '#854f0B', letterSpacing: '0.05em', fontWeight: 700, margin: '0 0 6px', textTransform: 'uppercase' as const }}>Comorbidades</p>
          <p style={{ fontSize: 12, color: '#374151', margin: 0, lineHeight: 1.5, whiteSpace: 'pre-wrap' as const }}>{paciente.comorbidades}</p>
        </div>
      )}

      <div style={{ background: 'white', borderRadius: 10, padding: '11px 13px', border: '1px solid #e5e7eb' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <p style={{ fontSize: 9, color: '#6b7280', letterSpacing: '0.05em', fontWeight: 700, margin: 0, textTransform: 'uppercase' as const }}>Últimas consultas</p>
          {consultas.length > 0 && <span style={{ fontSize: 10, color: '#9ca3af' }}>{consultas.length}</span>}
        </div>
        {consultas.length === 0 ? (
          <p style={{ fontSize: 11, color: '#9ca3af', margin: 0, fontStyle: 'italic' as const }}>Primeira consulta</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 6 }}>
            {consultas.slice(0, 3).map(c => {
              const hip = primeiraHipotese(c.hipoteses)
              const cid = c.cids && Array.isArray(c.cids) && c.cids[0]
              return (
                <div key={c.id} onClick={() => setConsultaAberta(c)}
                  style={{ padding: '7px 9px', borderRadius: 6, cursor: 'pointer', borderLeft: '2px solid #6043C1', background: '#fafafa' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f3eefb')}
                  onMouseLeave={e => (e.currentTarget.style.background = '#fafafa')}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#6043C1' }}>{fmtData(c.criado_em)}</span>
                    {cid && <span style={{ fontSize: 9, fontFamily: 'monospace', fontWeight: 700, color: '#6043C1', background: '#ede9fb', padding: '1px 5px', borderRadius: 3 }}>{cid.codigo || cid}</span>}
                  </div>
                  {hip && <p style={{ fontSize: 11, color: '#6b7280', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{hip}</p>}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {consultaAberta && (
        <div onClick={() => setConsultaAberta(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 12, padding: 22, maxWidth: 540, width: '100%', maxHeight: '85vh', overflow: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#111827', margin: 0 }}>Consulta de {fmtData(consultaAberta.criado_em)}</p>
              <button onClick={() => setConsultaAberta(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#9ca3af' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            {consultaAberta.avaliacao && (
              <div style={{ marginBottom: 10 }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', margin: '0 0 4px', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>Avaliação</p>
                <p style={{ fontSize: 12, color: '#374151', margin: 0, lineHeight: 1.6, whiteSpace: 'pre-wrap' as const }}>{consultaAberta.avaliacao}</p>
              </div>
            )}
            {consultaAberta.plano && (
              <div style={{ marginBottom: 10 }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', margin: '0 0 4px', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>Plano</p>
                <p style={{ fontSize: 12, color: '#374151', margin: 0, lineHeight: 1.6, whiteSpace: 'pre-wrap' as const }}>{consultaAberta.plano}</p>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  )
}
