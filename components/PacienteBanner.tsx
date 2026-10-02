'use client'

import { useEffect, useState } from 'react'
import { UserRoundX } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { tokens } from '@/lib/design-tokens'
import { Avatar, Icon } from '@/components/ui'

import { normalizarConvenio } from '@/lib/convenios'
const T = tokens

type Props = {
  pacienteId: string | null
  medicoId: string
  onTrocar?: () => void
  acoes?: React.ReactNode
}

const barra = (borda: string): React.CSSProperties => ({
  background: T.bg.card, border: `1px solid ${borda}`, borderRadius: 18, padding: '14px 16px',
  display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
})

const linkAcao: React.CSSProperties = {
  background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit',
  fontSize: 12.5, fontWeight: 600, color: T.brand.primary,
}

/** Barra do paciente da nova consulta (avulsa ou vinculada). */
export function PacienteBanner({ pacienteId, medicoId, onTrocar, acoes }: Props) {
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

  const blocoAcoes = acoes ? <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginLeft: 'auto' }}>{acoes}</div> : null

  if (!pacienteId) {
    return (
      <div style={barra(T.status.warningOrangePeach)}>
        <span style={{ width: 42, height: 42, borderRadius: 13, background: T.status.warningBg, color: T.status.warning, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          <Icon icon={UserRoundX} size={19} />
        </span>
        <div style={{ flex: 1, minWidth: 200, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 14.5, fontWeight: 700, color: T.text.primary }}>Consulta avulsa</span>
          <span style={{ fontSize: 12.5, color: T.text.quaternary, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            Não vinculada a um paciente.
            {onTrocar && <button onClick={onTrocar} style={linkAcao}>Vincular paciente</button>}
          </span>
        </div>
        {blocoAcoes}
      </div>
    )
  }

  if (loading) {
    return (
      <div style={barra(T.border.default)}>
        <div className="c360-skel" style={{ width: 42, height: 42, borderRadius: '50%' }} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div className="c360-skel" style={{ height: 13, width: 160, borderRadius: 6 }} />
          <div className="c360-skel" style={{ height: 11, width: 240, borderRadius: 6 }} />
        </div>
        {blocoAcoes}
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
  const cidsCronicos = paciente.cids_cronicos ? (Array.isArray(paciente.cids_cronicos) ? paciente.cids_cronicos : []) : []
  const ultimaStr = ultimaConsulta?.criado_em ? new Date(ultimaConsulta.criado_em).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) : null
  const meta = [
    idade !== null ? idade + ' anos' : null,
    paciente.genero || null,
    paciente.telefone || null,
    paciente.convenio ? normalizarConvenio(paciente.convenio) : null,
    ultimaStr ? 'última consulta ' + ultimaStr : null,
  ].filter(Boolean).join(' · ')

  return (
    <div style={barra(T.border.default)}>
      <Avatar nome={paciente.nome} src={paciente.foto_url} size={42} />
      <div style={{ flex: 1, minWidth: 200, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span style={{ fontSize: 14.5, fontWeight: 700, color: T.text.primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{paciente.nome}</span>
          {cidsCronicos.slice(0, 3).map((c: any, i: number) => (
            <span key={i} className="mono" title={c.descricao || c.codigo || c}
              style={{ fontSize: 11, fontWeight: 500, background: T.brand.primarySubtle, color: T.brand.primary, padding: '2px 6px', borderRadius: 6, flexShrink: 0 }}>
              {c.codigo || c}
            </span>
          ))}
          {cidsCronicos.length > 3 && <span style={{ fontSize: 11, color: T.text.tertiary }}>+{cidsCronicos.length - 3}</span>}
        </span>
        <span style={{ fontSize: 12.5, color: T.text.quaternary, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {meta}{meta && onTrocar ? ' ·' : ''}
          {onTrocar && <button onClick={onTrocar} style={linkAcao}>Trocar</button>}
        </span>
      </div>
      {blocoAcoes}
    </div>
  )
}
