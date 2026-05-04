'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { SetupChecklist } from '@/components/SetupChecklist'

type Periodo = 'semana' | 'mes' | 'ano'

export default function Dashboard() {
  const router = useRouter()
  const [medico, setMedico] = useState<any>(null)
  const [ehAdmin, setEhAdmin] = useState(false)
  const [medicoIds, setMedicoIds] = useState<string[]>([])
  const [carregando, setCarregando] = useState(true)
  const [periodo, setPeriodo] = useState<Periodo>('mes')
  const [gerandoRelatorio, setGerandoRelatorio] = useState(false)

  // KPIs
  const [consultasHoje, setConsultasHoje] = useState(0)
  const [consultasOntem, setConsultasOntem] = useState(0)
  const [noShowRate, setNoShowRate] = useState<number | null>(null)
  const [pacientesAtivos, setPacientesAtivos] = useState(0)
  const [pacientesRisco, setPacientesRisco] = useState(0)

  // Listas e gráficos
  const [consultasPorDia, setConsultasPorDia] = useState<any[]>([])
  const [topCIDs, setTopCIDs] = useState<any[]>([])
  const [proximosAgendamentos, setProximosAgendamentos] = useState<any[]>([])
  const [confirmacoesPendentes, setConfirmacoesPendentes] = useState<any[]>([])
  const [ultimasConsultas, setUltimasConsultas] = useState<any[]>([])
  const [comparativoMedicos, setComparativoMedicos] = useState<any[]>([])

  useEffect(() => {
    const ca = localStorage.getItem('clinica_admin')
    const m = localStorage.getItem('medico')
    if (!ca && !m) { router.push('/login'); return }
    if (ca) {
      const adminData = JSON.parse(ca)
      setEhAdmin(true)
      setMedico(adminData)
      ;(async () => {
        const { data: meds } = await supabase
          .from('medicos').select('id, nome').eq('clinica_id', adminData.clinica_id || adminData.id).eq('cargo', 'medico').eq('ativo', true)
        setMedicoIds((meds || []).map((x: any) => x.id))
      })()
    } else {
      const medicoData = JSON.parse(m!)
      setMedico(medicoData)
      setMedicoIds([medicoData.id])
    }
  }, [router])

  useEffect(() => {
    if (medico && medicoIds.length > 0) carregarDados()
  }, [medico, medicoIds, periodo])

  const carregarDados = async () => {
    setCarregando(true)

    const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
    const amanha = new Date(hoje); amanha.setDate(amanha.getDate() + 1)
    const ontem = new Date(hoje); ontem.setDate(ontem.getDate() - 1)
    const desde = new Date()
    if (periodo === 'semana') desde.setDate(desde.getDate() - 7)
    else if (periodo === 'mes') desde.setDate(desde.getDate() - 30)
    else desde.setFullYear(desde.getFullYear() - 1)

    const seisMesesAtras = new Date(); seisMesesAtras.setMonth(seisMesesAtras.getMonth() - 6)
    const noventaDiasAtras = new Date(); noventaDiasAtras.setDate(noventaDiasAtras.getDate() - 90)

    // KPI 1: Consultas hoje + ontem
    const { count: hojeCount } = await supabase.from('consultas').select('*', { count: 'exact', head: true })
      .in('medico_id', medicoIds).gte('criado_em', hoje.toISOString()).lt('criado_em', amanha.toISOString())
    const { count: ontemCount } = await supabase.from('consultas').select('*', { count: 'exact', head: true })
      .in('medico_id', medicoIds).gte('criado_em', ontem.toISOString()).lt('criado_em', hoje.toISOString())
    setConsultasHoje(hojeCount || 0)
    setConsultasOntem(ontemCount || 0)

    // KPI 2: No-show rate (fallback: agendados passados que ainda estão "agendado")
    const trintaDiasAtras = new Date(); trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30)
    const { data: agPassados } = await supabase.from('agendamentos').select('status, data_hora')
      .in('medico_id', medicoIds).gte('data_hora', trintaDiasAtras.toISOString()).lt('data_hora', new Date().toISOString())
    if (agPassados && agPassados.length > 0) {
      const noShow = agPassados.filter(a => a.status === 'agendado').length
      setNoShowRate(Math.round((noShow / agPassados.length) * 100))
    } else {
      setNoShowRate(null)
    }

    // KPI 3: Pacientes ativos (com consulta nos últimos 6m)
    const { data: ativos } = await supabase.from('consultas').select('paciente_id')
      .in('medico_id', medicoIds).gte('criado_em', seisMesesAtras.toISOString())
    const idsAtivos = new Set((ativos || []).map((c: any) => c.paciente_id).filter(Boolean))
    setPacientesAtivos(idsAtivos.size)

    // KPI 4: Pacientes em risco (com comorbidade crônica e sem consulta há 90+ dias)
    const { data: pacientesClinica } = await supabase.from('pacientes').select('id, nome, comorbidades')
      .in('medico_id', medicoIds)
    const cronicos = (pacientesClinica || []).filter((p: any) => 
      p.comorbidades && p.comorbidades.length > 5
    )
    const { data: consultasRecentes90 } = await supabase.from('consultas').select('paciente_id')
      .in('medico_id', medicoIds).gte('criado_em', noventaDiasAtras.toISOString())
    const idsRecentes = new Set((consultasRecentes90 || []).map((c: any) => c.paciente_id).filter(Boolean))
    const emRisco = cronicos.filter((p: any) => !idsRecentes.has(p.id))
    setPacientesRisco(emRisco.length)

    // Consultas por dia (últimos 14 dias)
    const { data: cons14 } = await supabase.from('consultas').select('criado_em')
      .in('medico_id', medicoIds).gte('criado_em', new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString())
    const porDia: Record<string, number> = {}
    for (let i = 13; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0, 0, 0, 0)
      const k = d.toISOString().substring(0, 10)
      porDia[k] = 0
    }
    ;(cons14 || []).forEach((c: any) => {
      const k = new Date(c.criado_em).toISOString().substring(0, 10)
      if (k in porDia) porDia[k]++
    })
    setConsultasPorDia(Object.entries(porDia).map(([data, total]) => ({ data, total })))

    // Top CIDs (últimos 30 dias)
    const { data: consComCid } = await supabase.from('consultas').select('cids')
      .in('medico_id', medicoIds).gte('criado_em', desde.toISOString())
    const cidMap: Record<string, { codigo: string; descricao: string; total: number }> = {}
    ;(consComCid || []).forEach((c: any) => {
      ;(c.cids || []).forEach((cid: any) => {
        const k = cid.codigo
        if (!k) return
        if (!cidMap[k]) cidMap[k] = { codigo: k, descricao: cid.descricao || '', total: 0 }
        cidMap[k].total++
      })
    })
    setTopCIDs(Object.values(cidMap).sort((a, b) => b.total - a.total).slice(0, 5))

    // Próximos agendamentos
    const { data: prox } = await supabase.from('agendamentos').select('*, pacientes:paciente_id(nome)')
      .in('medico_id', medicoIds).gte('data_hora', new Date().toISOString())
      .order('data_hora').limit(8)
    setProximosAgendamentos(prox || [])

    // Confirmações pendentes (próximas 48h, status agendado)
    const em48h = new Date(); em48h.setHours(em48h.getHours() + 48)
    const { data: pendentes } = await supabase.from('agendamentos').select('*, pacientes:paciente_id(nome)')
      .in('medico_id', medicoIds).eq('status', 'agendado')
      .gte('data_hora', new Date().toISOString()).lt('data_hora', em48h.toISOString())
      .order('data_hora').limit(5)
    setConfirmacoesPendentes(pendentes || [])

    // Últimas consultas
    const { data: ultimas } = await supabase.from('consultas').select('id, criado_em, avaliacao, cids, paciente_id, pacientes:paciente_id(nome)')
      .in('medico_id', medicoIds).order('criado_em', { ascending: false }).limit(6)
    setUltimasConsultas(ultimas || [])

    // Comparativo médicos (só admin com 2+ médicos)
    if (ehAdmin && medicoIds.length > 1) {
      const { data: medsInfo } = await supabase.from('medicos').select('id, nome').in('id', medicoIds)
      const stats = await Promise.all((medsInfo || []).map(async (m: any) => {
        const { count: nConsultas } = await supabase.from('consultas').select('*', { count: 'exact', head: true })
          .eq('medico_id', m.id).gte('criado_em', desde.toISOString())
        const { count: nPacientes } = await supabase.from('pacientes').select('*', { count: 'exact', head: true })
          .eq('medico_id', m.id)
        return { id: m.id, nome: m.nome, consultas: nConsultas || 0, pacientes: nPacientes || 0 }
      }))
      setComparativoMedicos(stats.sort((a, b) => b.consultas - a.consultas))
    } else {
      setComparativoMedicos([])
    }

    setCarregando(false)
  }

  const gerarRelatorio = async () => {
    if (!medico) return
    setGerandoRelatorio(true)
    try {
      const res = await fetch('/api/relatorio-mensal?medico_id=' + (medicoIds[0] || medico.id))
      if (res.ok) {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a'); a.href = url; a.download = 'relatorio-mensal.pdf'; a.click()
      }
    } finally { setGerandoRelatorio(false) }
  }

  const fmtData = (d: string) => new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
  const fmtHora = (d: string) => new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const maxConsultasDia = Math.max(...consultasPorDia.map(c => c.total), 1)

  if (!medico) return null

  return (
    <div style={{ padding: '24px 28px', background: '#fafafa', minHeight: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>Dashboard</h1>
            <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>
              {ehAdmin ? `${medicoIds.length} médico${medicoIds.length > 1 ? 's' : ''} na clínica` : 'Visão pessoal'}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ display: 'flex', background: 'white', borderRadius: 8, border: '1px solid #e5e7eb', padding: 2 }}>
              {(['semana', 'mes', 'ano'] as Periodo[]).map(p => (
                <button key={p} onClick={() => setPeriodo(p)} style={{
                  padding: '6px 14px', borderRadius: 6, cursor: 'pointer',
                  background: periodo === p ? '#6043C1' : 'transparent',
                  color: periodo === p ? 'white' : '#6b7280',
                  fontSize: 12, fontWeight: 500
                }}>
                  {p === 'semana' ? '7 dias' : p === 'mes' ? '30 dias' : '12 meses'}
                </button>
              ))}
            </div>
            <button onClick={gerarRelatorio} disabled={gerandoRelatorio} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, background: 'white', border: '1px solid #e5e7eb', color: '#374151', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
              {gerandoRelatorio ? 'Gerando...' : 'Relatório mensal'}
            </button>
          </div>
        </div>

        <SetupChecklist />

        {/* LINHA 1: KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 16 }}>
          <Card titulo="Consultas hoje" valor={consultasHoje} subtitulo={
            consultasHoje > consultasOntem ? `+${consultasHoje - consultasOntem} vs ontem` :
            consultasHoje < consultasOntem ? `${consultasHoje - consultasOntem} vs ontem` :
            'Igual a ontem'
          } cor={consultasHoje >= consultasOntem ? '#16a34a' : '#dc2626'} />

          <Card titulo="Taxa de no-show" valor={noShowRate === null ? '--' : noShowRate + '%'}
            subtitulo={noShowRate === null ? 'sem dados últimos 30 dias' : noShowRate > 20 ? 'acima do esperado' : 'dentro do esperado'}
            cor={noShowRate === null ? '#9ca3af' : noShowRate > 20 ? '#dc2626' : '#16a34a'} />

          <Card titulo="Pacientes ativos" valor={pacientesAtivos}
            subtitulo="com consulta últimos 6 meses" cor="#6043C1" />

          <Card titulo="Pacientes em risco" valor={pacientesRisco}
            subtitulo={pacientesRisco > 0 ? 'crônicos sem retorno >90d' : 'todos acompanhados'}
            cor={pacientesRisco > 0 ? '#d97706' : '#16a34a'} />
        </div>

        {/* LINHA 2: Gráficos e listas */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
          {/* ESQUERDA */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Consultas por dia */}
            <div style={{ background: 'white', borderRadius: 14, padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: '#111827', margin: '0 0 2px' }}>Consultas por dia</p>
                  <p style={{ fontSize: 11, color: '#9ca3af', margin: 0 }}>Últimos 14 dias</p>
                </div>
                <span style={{ fontSize: 11, color: '#6043C1', background: '#f0ebff', padding: '3px 9px', borderRadius: 12, fontWeight: 600 }}>
                  {consultasPorDia.reduce((sum, c) => sum + c.total, 0)} total
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 120 }}>
                {consultasPorDia.map((d, i) => {
                  const altura = (d.total / maxConsultasDia) * 100
                  const ehHoje = d.data === new Date().toISOString().substring(0, 10)
                  return (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontSize: 10, color: '#6b7280', fontWeight: 600, height: 14 }}>
                        {d.total > 0 ? d.total : ''}
                      </span>
                      <div style={{ width: '100%', height: `${Math.max(altura, 4)}%`, background: ehHoje ? '#6043C1' : d.total > 0 ? '#c4b5fd' : '#f3f4f6', borderRadius: 4, transition: 'all 0.3s', minHeight: 4 }}/>
                    </div>
                  )
                })}
              </div>
              <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                {consultasPorDia.map((d, i) => {
                  const dt = new Date(d.data)
                  return (
                    <div key={i} style={{ flex: 1, fontSize: 9, color: '#9ca3af', textAlign: 'center' }}>
                      {i % 2 === 0 ? `${dt.getDate()}/${dt.getMonth() + 1}` : ''}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Top CIDs */}
            <div style={{ background: 'white', borderRadius: 14, padding: 20 }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#111827', margin: '0 0 14px' }}>CIDs mais frequentes</p>
              {topCIDs.length === 0 ? (
                <p style={{ fontSize: 12, color: '#9ca3af', margin: 0, textAlign: 'center', padding: '20px 0' }}>Sem dados no período</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {topCIDs.map((c, i) => {
                    const max = topCIDs[0].total
                    const pct = (c.total / max) * 100
                    return (
                      <div key={i}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: 12, color: '#374151' }}>
                            <strong style={{ color: '#6043C1', fontWeight: 700 }}>{c.codigo}</strong> {c.descricao && <span style={{ color: '#6b7280' }}>· {c.descricao}</span>}
                          </span>
                          <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 600 }}>{c.total}</span>
                        </div>
                        <div style={{ height: 6, background: '#f3f4f6', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: '#6043C1', borderRadius: 3 }}/>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* DIREITA */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Próximos agendamentos */}
            <div style={{ background: 'white', borderRadius: 14, padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#111827', margin: 0 }}>Próximos agendamentos</p>
                <button onClick={() => router.push('/agenda')} style={{ fontSize: 11, color: '#6043C1', background: 'none', cursor: 'pointer', fontWeight: 600 }}>Ver todos →</button>
              </div>
              {proximosAgendamentos.length === 0 ? (
                <p style={{ fontSize: 12, color: '#9ca3af', margin: 0, textAlign: 'center', padding: '20px 0' }}>Sem agendamentos</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {proximosAgendamentos.slice(0, 5).map((a, i) => {
                    const ehOnline = !!a.meet_link
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i < 4 ? '1px solid #f3f4f6' : 'none' }}>
                        <div style={{ width: 38, height: 38, borderRadius: 8, background: '#f0ebff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: '#6043C1', lineHeight: 1 }}>{new Date(a.data_hora).getDate()}</span>
                          <span style={{ fontSize: 8, color: '#6043C1', textTransform: 'uppercase', fontWeight: 600, marginTop: 1 }}>{new Date(a.data_hora).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}</span>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 12, fontWeight: 600, color: '#111827', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.pacientes?.nome || a.motivo || 'Consulta'}</p>
                          <p style={{ fontSize: 11, color: '#6b7280', margin: '2px 0 0' }}>
                            {fmtHora(a.data_hora)}
                            {ehOnline && <span style={{ color: '#16a34a', marginLeft: 6 }}>● Online</span>}
                            {!ehOnline && <span style={{ color: '#9ca3af', marginLeft: 6 }}>● Presencial</span>}
                          </p>
                        </div>
                        <span style={{ fontSize: 10, color: a.status === 'confirmado' ? '#16a34a' : '#6b7280', background: a.status === 'confirmado' ? '#f0fdf4' : '#f3f4f6', padding: '3px 7px', borderRadius: 10, fontWeight: 600 }}>{a.status}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Confirmações pendentes */}
            {confirmacoesPendentes.length > 0 && (
              <div style={{ background: '#fffbeb', borderRadius: 14, padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#b45309" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#92400e', margin: 0 }}>Confirmações pendentes ({confirmacoesPendentes.length})</p>
                </div>
                <p style={{ fontSize: 11, color: '#92400e', margin: '0 0 12px', opacity: 0.8 }}>Pacientes que ainda não confirmaram consulta nas próximas 48h</p>
                {confirmacoesPendentes.map((p, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: i < confirmacoesPendentes.length - 1 ? '1px solid #fde68a' : 'none' }}>
                    <span style={{ fontSize: 12, color: '#78350f', fontWeight: 500 }}>{p.pacientes?.nome || 'Paciente'}</span>
                    <span style={{ fontSize: 11, color: '#92400e' }}>{fmtData(p.data_hora)} {fmtHora(p.data_hora)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* LINHA 3: Comparativo médicos (só admin) */}
        {comparativoMedicos.length > 0 && (
          <div style={{ background: 'white', borderRadius: 14, padding: 20, marginBottom: 16 }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: '#111827', margin: '0 0 14px' }}>Comparativo entre médicos</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
              {comparativoMedicos.map((m, i) => (
                <div key={i} style={{ background: '#fafafa', borderRadius: 10, padding: 14 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: '#111827', margin: '0 0 8px' }}>{m.nome}</p>
                  <div style={{ display: 'flex', gap: 14 }}>
                    <div>
                      <p style={{ fontSize: 18, fontWeight: 700, color: '#6043C1', margin: 0, lineHeight: 1 }}>{m.consultas}</p>
                      <p style={{ fontSize: 10, color: '#6b7280', margin: '2px 0 0' }}>consultas</p>
                    </div>
                    <div>
                      <p style={{ fontSize: 18, fontWeight: 700, color: '#16a34a', margin: 0, lineHeight: 1 }}>{m.pacientes}</p>
                      <p style={{ fontSize: 10, color: '#6b7280', margin: '2px 0 0' }}>pacientes</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* LINHA 4: Últimas consultas */}
        <div style={{ background: 'white', borderRadius: 14, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: '#111827', margin: 0 }}>Últimas consultas</p>
            <button onClick={() => router.push('/historico')} style={{ fontSize: 11, color: '#6043C1', background: 'none', cursor: 'pointer', fontWeight: 600 }}>Ver histórico →</button>
          </div>
          {ultimasConsultas.length === 0 ? (
            <p style={{ fontSize: 12, color: '#9ca3af', margin: 0, textAlign: 'center', padding: '20px 0' }}>Sem consultas registradas</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {ultimasConsultas.map((c, i) => (
                <div key={c.id} onClick={() => router.push('/pacientes/' + c.paciente_id)}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '12px 0', borderBottom: i < ultimasConsultas.length - 1 ? '1px solid #f3f4f6' : 'none', cursor: 'pointer' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 3 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: '#111827', margin: 0 }}>{c.pacientes?.nome || 'Paciente'}</p>
                      <p style={{ fontSize: 11, color: '#9ca3af', margin: 0 }}>{fmtData(c.criado_em)} {fmtHora(c.criado_em)}</p>
                    </div>
                    <p style={{ fontSize: 12, color: '#6b7280', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 600 }}>
                      {c.avaliacao || 'Sem avaliação registrada'}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0, marginLeft: 12 }}>
                    {(c.cids || []).slice(0, 2).map((cid: any, j: number) => (
                      <span key={j} style={{ fontSize: 10, color: '#6043C1', background: '#f0ebff', padding: '2px 7px', borderRadius: 10, fontWeight: 600 }}>{cid.codigo}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
    </div>
  )
}

function Card({ titulo, valor, subtitulo, cor }: { titulo: string; valor: any; subtitulo: string; cor: string }) {
  return (
    <div style={{ background: 'white', borderRadius: 14, padding: 18 }}>
      <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 6px' }}>{titulo}</p>
      <p style={{ fontSize: 28, fontWeight: 700, color: '#111827', margin: '0 0 4px', letterSpacing: '-0.02em', lineHeight: 1 }}>{valor}</p>
      <p style={{ fontSize: 11, color: cor, margin: 0, fontWeight: 500 }}>{subtitulo}</p>
    </div>
  )
}
