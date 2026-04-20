'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Props = {
  pacienteId: string | null
  medicoId: string
}

export function PreConsultaCard({ pacienteId, medicoId }: Props) {
  const [preConsulta, setPreConsulta] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [expandido, setExpandido] = useState(true)

  useEffect(() => {
    if (!pacienteId) { setLoading(false); return }
    let cancelado = false
    ;(async () => {
      setLoading(true)
      // Busca última pré-consulta do paciente nos últimos 7 dias
      const seteDiasAtras = new Date()
      seteDiasAtras.setDate(seteDiasAtras.getDate() - 7)
      const { data } = await supabase
        .from('pre_consultas')
        .select('*')
        .eq('paciente_id', pacienteId)
        .eq('medico_id', medicoId)
        .gte('criado_em', seteDiasAtras.toISOString())
        .order('criado_em', { ascending: false })
        .limit(1)
      if (cancelado) return
      setPreConsulta(data?.[0] || null)
      setLoading(false)
    })()
    return () => { cancelado = true }
  }, [pacienteId, medicoId])

  if (loading || !preConsulta) return null

  const respostas = preConsulta.respostas || preConsulta.conteudo || {}
  const dataFmt = new Date(preConsulta.criado_em).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

  return (
    <div style={{ margin: '16px 24px 0', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, overflow: 'hidden' }}>
      <button onClick={() => setExpandido(!expandido)}
        style={{ width: '100%', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="white" stroke="none">
            <path d="M20.52 3.45c-2.14-2.11-5.04-3.45-8.12-3.45C6.37 0 1.45 4.92 1.45 11c0 1.95.5 3.85 1.45 5.55L1 23l6.6-1.73c1.6.9 3.5 1.36 5.4 1.36 6.03 0 10.95-4.92 10.95-11 0-2.96-1.14-5.76-3.43-8.18z"/>
          </svg>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#14532d' }}>Pré-consulta Sofia</p>
            <span style={{ fontSize: 10, fontWeight: 600, color: '#16a34a', background: 'white', padding: '1px 7px', borderRadius: 10 }}>WhatsApp</span>
          </div>
          <p style={{ margin: '2px 0 0', fontSize: 11, color: '#15803d' }}>Respostas coletadas em {dataFmt}</p>
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#15803d" strokeWidth="2"
          style={{ transform: expandido ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {expandido && (
        <div style={{ padding: '0 16px 16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
          {Object.entries(respostas).map(([pergunta, resposta]) => {
            if (!resposta || typeof resposta !== 'string') return null
            return (
              <div key={pergunta} style={{ background: 'white', borderRadius: 8, padding: '10px 12px', border: '1px solid #d1fae5' }}>
                <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                  {formatarChave(pergunta)}
                </p>
                <p style={{ margin: 0, fontSize: 13, color: '#111827', lineHeight: 1.5 }}>
                  {resposta}
                </p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function formatarChave(k: string): string {
  // converte snake_case/camelCase em texto amigável
  return k
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .trim()
    .replace(/^./, c => c.toUpperCase())
}
