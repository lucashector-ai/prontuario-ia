'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Props = {
  pacienteId: string | null
  medicoId: string
  onTrocar?: () => void
}

export function PacienteBanner({ pacienteId, medicoId, onTrocar }: Props) {
  const [paciente, setPaciente] = useState<any>(null)
  const [ultimaConsulta, setUltimaConsulta] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!pacienteId) { setLoading(false); return }
    let cancelado = false
    ;(async () => {
      setLoading(true)
      const [{ data: p }, { data: ultConsultas }] = await Promise.all([
        supabase.from('pacientes').select('*').eq('id', pacienteId).single(),
        supabase.from('consultas').select('criado_em, cids').eq('paciente_id', pacienteId).eq('medico_id', medicoId).order('criado_em', { ascending: false }).limit(1),
      ])
      if (cancelado) return
      setPaciente(p)
      setUltimaConsulta(ultConsultas?.[0] || null)
      setLoading(false)
    })()
    return () => { cancelado = true }
  }, [pacienteId, medicoId])

  if (!pacienteId) {
    return (
      <div style={{ padding: '14px 24px', background: '#fffbeb', borderBottom: '1px solid #fde68a', display: 'flex', alignItems: 'center', gap: 10 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#b45309" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <p style={{ margin: 0, fontSize: 12, color: '#92400e', fontWeight: 500 }}>
          Consulta avulsa — não vinculada a um paciente. {onTrocar && <button onClick={onTrocar} style={{ background: 'none', border: 'none', color: '#1F9D5C', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline', fontSize: 12, padding: 0 }}>Vincular paciente</button>}
        </p>
      </div>
    )
  }

  if (loading) {
    return (
      <div style={{ padding: '16px 24px', background: 'white', borderBottom: '1px solid #f3f4f6', height: 68, display: 'flex', alignItems: 'center' }}>
        <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#f3f4f6' }}/>
        <div style={{ marginLeft: 12, flex: 1 }}>
          <div style={{ height: 12, width: 140, background: '#f3f4f6', borderRadius: 4, marginBottom: 6 }}/>
          <div style={{ height: 10, width: 200, background: '#f3f4f6', borderRadius: 4 }}/>
        </div>
      </div>
    )
  }

  if (!paciente) return null

  const calcIdade = (nasc: string) => {
    if (!nasc) return null
    const d = new Date(nasc)
    if (isNaN(d.getTime())) return null
    const diff = Date.now() - d.getTime()
    return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000))
  }

  const idade = calcIdade(paciente.data_nascimento)
  const alergias = paciente.alergias ? (Array.isArray(paciente.alergias) ? paciente.alergias : String(paciente.alergias).split(',').map((s: string) => s.trim()).filter(Boolean)) : []
  const cidsCronicos = paciente.cids_cronicos ? (Array.isArray(paciente.cids_cronicos) ? paciente.cids_cronicos : []) : []
  const ultimaCidStr = ultimaConsulta?.criado_em ? new Date(ultimaConsulta.criado_em).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) : null

  const iniciais = paciente.nome?.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase() || '?'

  return (
    <div style={{ padding: '14px 24px', background: 'white', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: 14 }}>
      {/* Avatar */}
      <div style={{
        width: 48, height: 48, borderRadius: '50%', flexShrink: 0,
        background: paciente.foto_url ? `url(${paciente.foto_url}) center/cover` : '#E8F7EF',
        border: '2px solid #A7E0BF',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 15, fontWeight: 700, color: '#1F9D5C',
      }}>
        {!paciente.foto_url && iniciais}
      </div>

      {/* Nome + dados básicos */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 3 }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {paciente.nome}
          </h2>
          {paciente.genero && (
            <span style={{ fontSize: 11, color: '#6b7280', background: '#f3f4f6', padding: '1px 7px', borderRadius: 10, fontWeight: 500 }}>
              {paciente.genero}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11, color: '#6b7280', flexWrap: 'wrap' }}>
          {idade !== null && <span>{idade} anos</span>}
          {paciente.telefone && <><span>·</span><span>{paciente.telefone}</span></>}
          {paciente.convenio && <><span>·</span><span>{paciente.convenio}</span></>}
          {ultimaCidStr && <><span>·</span><span>Última consulta: {ultimaCidStr}</span></>}
        </div>
      </div>

      {/* Tags críticas (alergias) */}
      {alergias.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '5px 10px', flexShrink: 0 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          <span style={{ fontSize: 11, color: '#991b1b', fontWeight: 700 }}>
            Alergias: {alergias.slice(0, 2).join(', ')}{alergias.length > 2 ? ` +${alergias.length - 2}` : ''}
          </span>
        </div>
      )}

      {/* CIDs crônicos */}
      {cidsCronicos.length > 0 && (
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          {cidsCronicos.slice(0, 3).map((c: any, i: number) => (
            <span key={i} title={c.descricao || c.codigo || c}
              style={{ fontSize: 10, fontFamily: 'monospace', fontWeight: 700, background: '#E8F7EF', color: '#1F9D5C', padding: '3px 7px', borderRadius: 5 }}>
              {c.codigo || c}
            </span>
          ))}
          {cidsCronicos.length > 3 && <span style={{ fontSize: 10, color: '#9ca3af', alignSelf: 'center' }}>+{cidsCronicos.length - 3}</span>}
        </div>
      )}

      {onTrocar && (
        <button onClick={onTrocar} title="Trocar paciente"
          style={{ width: 32, height: 32, borderRadius: 8, background: 'white', color: '#6b7280', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15"/></svg>
        </button>
      )}
    </div>
  )
}
