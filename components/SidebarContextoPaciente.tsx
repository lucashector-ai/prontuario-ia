'use client'

import React, { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Pill, TriangleAlert, FileText } from 'lucide-react'
import { tokens } from '@/lib/design-tokens'
import { Icon, Modal, Overline } from '@/components/ui'

const T = tokens

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
      <div style={{ padding: 16, background: T.bg.page, borderRadius: 12, border: `1px dashed ${T.border.strong}`, textAlign: 'center' }}>
        <p style={{ fontSize: 12.5, color: T.text.tertiary, margin: 0, lineHeight: 1.5 }}>
          Vincule um paciente<br />
          para ver contexto clínico
        </p>
      </div>
    )
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="c360-skel" style={{ height: 10, width: '40%', borderRadius: 5 }} />
            <div className="c360-skel" style={{ height: 12, width: '80%', borderRadius: 5 }} />
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

  const alergiasArr = paciente?.alergias ? (Array.isArray(paciente.alergias) ? paciente.alergias : String(paciente.alergias).split(',').map((a: string) => a.trim()).filter(Boolean)) : []
  const comorbidadesArr = paciente?.comorbidades ? (Array.isArray(paciente.comorbidades) ? paciente.comorbidades : String(paciente.comorbidades).split(',').map((c: string) => c.trim()).filter(Boolean)) : []
  const medicacoesArr = paciente?.medicamentos_uso ? String(paciente.medicamentos_uso).split('\n').map((m: string) => m.trim()).filter(Boolean) : []
  const totalConsultas = consultas.length

  const construirResumo = () => {
    const partes: string[] = []
    if (comorbidadesArr.length > 0) {
      partes.push(comorbidadesArr.length === 1 ? comorbidadesArr[0] : comorbidadesArr.slice(0, 2).join(' e ') + (comorbidadesArr.length > 2 ? ' entre outros' : ''))
    }
    if (medicacoesArr.length > 0) {
      partes.push('em uso de ' + medicacoesArr.length + ' medicaç' + (medicacoesArr.length === 1 ? 'ão' : 'ões'))
    }
    if (totalConsultas > 0) {
      const ultima = consultas[0]
      const dias = Math.floor((Date.now() - new Date(ultima.criado_em).getTime()) / (1000 * 60 * 60 * 24))
      if (dias === 0) partes.push('última consulta hoje')
      else if (dias === 1) partes.push('última consulta ontem')
      else if (dias < 30) partes.push('última consulta há ' + dias + ' dias')
      else partes.push('última consulta em ' + fmtData(ultima.criado_em))
    }
    if (partes.length === 0) return 'Primeira consulta. Sem histórico clínico cadastrado.'
    return partes.join(', ').replace(/^./, c => c.toUpperCase()) + '.'
  }

  const secao: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 8 }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      <div style={secao}>
        <Overline>Resumo IA</Overline>
        <p style={{ fontSize: 13, color: T.text.strong, margin: 0, lineHeight: 1.55 }}>{construirResumo()}</p>
      </div>

      {(alergiasArr.length > 0 || comorbidadesArr.length > 0) && (
        <div style={secao}>
          <Overline>Alertas</Overline>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {alergiasArr.map((a: string, i: number) => (
              <span key={'al-' + i} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, padding: '4px 9px', borderRadius: 8, background: T.status.dangerBg, color: T.status.danger }}>
                <Icon icon={TriangleAlert} size={12} />Alergia: {a}
              </span>
            ))}
            {comorbidadesArr.map((c: string, i: number) => (
              <span key={'co-' + i} style={{ fontSize: 12, fontWeight: 600, padding: '4px 9px', borderRadius: 8, background: T.status.warningBg, color: T.status.warning }}>
                {c}
              </span>
            ))}
          </div>
        </div>
      )}

      {medicacoesArr.length > 0 && (
        <div style={secao}>
          <Overline>Medicações ativas</Overline>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {medicacoesArr.map((m: string, i: number) => {
              const partes = m.replace(/^[•\-\*]\s*/, '').split(/\s*[\-\—]\s*/)
              const nome = partes[0]
              const posologia = partes.slice(1).join(' - ')
              return (
                <div key={i} style={{ display: 'flex', gap: 8, padding: '8px 10px', borderRadius: 10, background: T.bg.page }}>
                  <Icon icon={Pill} size={14} color={T.brand.primary} style={{ marginTop: 2 }} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: T.text.strong }}>{nome}</span>
                    {posologia && <span style={{ fontSize: 11.5, color: T.text.secondary, lineHeight: 1.4 }}>{posologia}</span>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div style={secao}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Overline>Últimas consultas</Overline>
          {consultas.length > 0 && <span style={{ fontSize: 11.5, color: T.text.tertiary }}>{consultas.length}</span>}
        </div>
        {consultas.length === 0 ? (
          <p style={{ fontSize: 12.5, color: T.text.tertiary, margin: 0 }}>Primeira consulta</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {consultas.slice(0, 3).map(c => {
              const hip = primeiraHipotese(c.hipoteses)
              const cid = c.cids && Array.isArray(c.cids) && c.cids[0]
              return (
                <button key={c.id} type="button" onClick={() => setConsultaAberta(c)}
                  style={{ all: 'unset', cursor: 'pointer', boxSizing: 'border-box', width: '100%', display: 'flex', flexDirection: 'column', gap: 2, padding: '8px 10px', borderRadius: 10, border: `1px solid ${T.border.default}`, transition: 'background .15s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = T.bg.hover)}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: T.text.primary }}>{fmtData(c.criado_em)}</span>
                    {cid && <span className="mono" style={{ fontSize: 10.5, fontWeight: 500, color: T.brand.primary, background: T.brand.primarySubtle, padding: '1px 5px', borderRadius: 5 }}>{cid.codigo || cid}</span>}
                  </span>
                  {hip && <span style={{ fontSize: 11.5, color: T.text.secondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{hip}</span>}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {consultaAberta && (
        <Modal titulo={'Consulta de ' + fmtData(consultaAberta.criado_em)} onClose={() => setConsultaAberta(null)} largura={540}>
          {!consultaAberta.avaliacao && !consultaAberta.plano && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: T.text.tertiary }}>
              <Icon icon={FileText} size={14} />Sem avaliação ou plano registrados.
            </div>
          )}
          {consultaAberta.avaliacao && (
            <div style={{ marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Overline>Avaliação</Overline>
              <p style={{ fontSize: 13.5, color: T.text.strong, margin: 0, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{consultaAberta.avaliacao}</p>
            </div>
          )}
          {consultaAberta.plano && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Overline>Plano</Overline>
              <p style={{ fontSize: 13.5, color: T.text.strong, margin: 0, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{consultaAberta.plano}</p>
            </div>
          )}
        </Modal>
      )}

    </div>
  )
}
