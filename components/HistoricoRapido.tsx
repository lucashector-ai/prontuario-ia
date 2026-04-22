'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Props = {
  pacienteId: string | null
  medicoId: string
}

export function HistoricoRapido({ pacienteId, medicoId }: Props) {
  const router = useRouter()
  const [consultas, setConsultas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [expandidas, setExpandidas] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!pacienteId) { setLoading(false); return }
    let cancelado = false
    ;(async () => {
      setLoading(true)
      const { data } = await supabase
        .from('consultas')
        .select('id, criado_em, subjetivo, avaliacao, cids')
        .eq('paciente_id', pacienteId)
        .eq('medico_id', medicoId)
        .order('criado_em', { ascending: false })
        .limit(3)
      if (cancelado) return
      setConsultas(data || [])
      setLoading(false)
    })()
    return () => { cancelado = true }
  }, [pacienteId, medicoId])

  if (!pacienteId || loading) return null
  if (consultas.length === 0) {
    return (
      <div style={{ padding: '20px 24px', margin: '0 24px 20px', background: '#F5F5F5', borderRadius: 10, textAlign: 'center' }}>
        <p style={{ margin: 0, fontSize: 12, color: '#9ca3af' }}>Este é o primeiro atendimento com este paciente.</p>
      </div>
    )
  }

  const toggle = (id: string) => {
    setExpandidas(prev => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id); else n.add(id)
      return n
    })
  }

  return (
    <div style={{ margin: '16px 24px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Histórico recente ({consultas.length})
        </p>
        <button onClick={() => router.push(`/historico?paciente_id=${pacienteId}`)}
          style={{ background: 'none', border: 'none', fontSize: 11, color: '#6043C1', fontWeight: 600, cursor: 'pointer' }}>
          Ver histórico completo →
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {consultas.map(c => {
          const expandida = expandidas.has(c.id)
          const data = new Date(c.criado_em).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
          const horario = new Date(c.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
          const cids = c.cids || []
          return (
            <div key={c.id} style={{ background: 'white', borderRadius: 8, overflow: 'hidden' }}>
              <button onClick={() => toggle(c.id)}
                style={{ width: '100%', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#6043C1', background: '#ede9fb', padding: '3px 8px', borderRadius: 6, flexShrink: 0 }}>
                  {data}
                </div>
                <p style={{ flex: 1, margin: 0, fontSize: 12, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.avaliacao?.substring(0, 80) || c.subjetivo?.substring(0, 80) || 'Consulta'}
                </p>
                {cids.length > 0 && (
                  <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
                    {cids.slice(0, 2).map((cid: any, i: number) => (
                      <span key={i} style={{ fontSize: 9, fontFamily: 'monospace', fontWeight: 700, color: '#6043C1', background: '#ede9fb', padding: '2px 5px', borderRadius: 4 }}>
                        {cid.codigo}
                      </span>
                    ))}
                  </div>
                )}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"
                  style={{ transform: expandida ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s', flexShrink: 0 }}>
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </button>

              {expandida && (
                <div style={{ padding: '0 14px 14px', fontSize: 12, color: '#4b5563', lineHeight: 1.6, borderTop: '1px solid #F5F5F5' }}>
                  <p style={{ margin: '10px 0 2px', fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Queixa</p>
                  <p style={{ margin: 0 }}>{c.subjetivo || '—'}</p>
                  <p style={{ margin: '10px 0 2px', fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Avaliação</p>
                  <p style={{ margin: 0 }}>{c.avaliacao || '—'}</p>
                  <p style={{ margin: '8px 0 0', fontSize: 10, color: '#9ca3af' }}>{horario}</p>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
