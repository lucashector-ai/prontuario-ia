'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { SetupChecklist } from '@/components/SetupChecklist'
import { tokens } from '@/lib/design-tokens'
import { PageHeader, MetricCard, Button } from '@/components/ui'

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
    const trintaDiasAtras = new Date(); trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30)
    const em48h = new Date(); em48h.setHours(em48h.getHours() + 48)
    const agora = new Date()

    // OTIMIZADO: 11 queries em 1 round-trip (Promise.all)
    const [
      hojeR, ontemR, agPassadosR, ativosR, pacClinR, recentes90R,
      cons14R, consCidR, proxR, pendentesR, ultimasR
    ] = await Promise.all([
      supabase.from('consultas').select('*', { count: 'exact', head: true })
        .in('medico_id', medicoIds).gte('criado_em', hoje.toISOString()).lt('criado_em', amanha.toISOString()),
      supabase.from('consultas').select('*', { count: 'exact', head: true })
        .in('medico_id', medicoIds).gte('criado_em', ontem.toISOString()).lt('criado_em', hoje.toISOString()),
      supabase.from('agendamentos').select('status, data_hora')
        .in('medico_id', medicoIds).gte('data_hora', trintaDiasAtras.toISOString()).lt('data_hora', agora.toISOString()),
      supabase.from('consultas').select('paciente_id')
        .in('medico_id', medicoIds).gte('criado_em', seisMesesAtras.toISOString()),
      supabase.from('pacientes').select('id, nome, comorbidades').in('medico_id', medicoIds),
      supabase.from('consultas').select('paciente_id')
        .in('medico_id', medicoIds).gte('criado_em', noventaDiasAtras.toISOString()),
      supabase.from('consultas').select('criado_em')
        .in('medico_id', medicoIds).gte('criado_em', new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()),
      supabase.from('consultas').select('cids')
        .in('medico_id', medicoIds).gte('criado_em', desde.toISOString()),
      supabase.from('agendamentos').select('*, pacientes:paciente_id(nome)')
        .in('medico_id', medicoIds).gte('data_hora', agora.toISOString())
        .order('data_hora').limit(8),
      supabase.from('agendamentos').select('*, pacientes:paciente_id(nome)')
        .in('medico_id', medicoIds).eq('status', 'agendado')
        .gte('data_hora', agora.toISOString()).lt('data_hora', em48h.toISOString())
        .order('data_hora').limit(5),
      supabase.from('consultas').select('id, criado_em, avaliacao, cids, paciente_id, pacientes:paciente_id(nome)')
        .in('medico_id', medicoIds).order('criado_em', { ascending: false }).limit(6),
    ])

    setConsultasHoje(hojeR.count || 0)
    setConsultasOntem(ontemR.count || 0)

    const agPassados = agPassadosR.data || []
    if (agPassados.length > 0) {
      const noShow = agPassados.filter((a: any) => a.status === 'agendado').length
      setNoShowRate(Math.round((noShow / agPassados.length) * 100))
    } else { setNoShowRate(null) }

    const idsAtivos = new Set((ativosR.data || []).map((c: any) => c.paciente_id).filter(Boolean))
    setPacientesAtivos(idsAtivos.size)

    const cronicos = (pacClinR.data || []).filter((p: any) => p.comorbidades && p.comorbidades.length > 5)
    const idsRecentes = new Set((recentes90R.data || []).map((c: any) => c.paciente_id).filter(Boolean))
    setPacientesRisco(cronicos.filter((p: any) => !idsRecentes.has(p.id)).length)

    const porDia: Record<string, number> = {}
    for (let i = 13; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0, 0, 0, 0)
      porDia[d.toISOString().substring(0, 10)] = 0
    }
    ;(cons14R.data || []).forEach((c: any) => {
      const k = new Date(c.criado_em).toISOString().substring(0, 10)
      if (k in porDia) porDia[k]++
    })
    setConsultasPorDia(Object.entries(porDia).map(([data, total]) => ({ data, total })))

    const cidMap: Record<string, { codigo: string; descricao: string; total: number }> = {}
    ;(consCidR.data || []).forEach((c: any) => {
      ;(c.cids || []).forEach((cid: any) => {
        const k = cid.codigo
        if (!k) return
        if (!cidMap[k]) cidMap[k] = { codigo: k, descricao: cid.descricao || '', total: 0 }
        cidMap[k].total++
      })
    })
    setTopCIDs(Object.values(cidMap).sort((a, b) => b.total - a.total).slice(0, 5))

    setProximosAgendamentos(proxR.data || [])
    setConfirmacoesPendentes(pendentesR.data || [])
    setUltimasConsultas(ultimasR.data || [])

    if (ehAdmin && medicoIds.length > 1) {
      const { data: medsInfo } = await supabase.from('medicos').select('id, nome').in('id', medicoIds)
      const stats = await Promise.all((medsInfo || []).map(async (m: any) => {
        const [c, p] = await Promise.all([
          supabase.from('consultas').select('*', { count: 'exact', head: true }).eq('medico_id', m.id).gte('criado_em', desde.toISOString()),
          supabase.from('pacientes').select('*', { count: 'exact', head: true }).eq('medico_id', m.id),
        ])
        return { id: m.id, nome: m.nome, consultas: c.count || 0, pacientes: p.count || 0 }
      }))
      setComparativoMedicos(stats.sort((a: any, b: any) => b.consultas - a.consultas))
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
    <div style={{ padding: '24px 28px', background: 'transparent', minHeight: '100%' }}>
        <PageHeader
          titulo="Dashboard"
          descricao={ehAdmin ? `${medicoIds.length} médico${medicoIds.length > 1 ? 's' : ''} na clínica` : 'Visão pessoal'}
          acao={
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ display: 'flex', background: 'white', borderRadius: 8, border: `1px solid ${tokens.border.default}`, padding: 2 }}>
                {(['semana', 'mes', 'ano'] as Periodo[]).map(p => (
                  <button key={p} onClick={() => setPeriodo(p)} style={{
                    padding: '6px 14px', borderRadius: 6, cursor: 'pointer', border: 'none',
                    background: periodo === p ? tokens.brand.primary : 'transparent',
                    color: periodo === p ? 'white' : tokens.text.secondary,
                    fontSize: 12, fontWeight: 500
                  }}>
                    {p === 'semana' ? '7 dias' : p === 'mes' ? '30 dias' : '12 meses'}
                  </button>
                ))}
              </div>
              <Button variant="secondary" size="sm" onClick={gerarRelatorio} disabled={gerandoRelatorio}>
                {gerandoRelatorio ? 'Gerando...' : 'Relatório mensal'}
              </Button>
            </div>
          }
        />

        <style>{`
          @media (max-width: 768px) {
            .dash-kpis-grid {
              grid-template-columns: 1fr 1fr !important;
            }
          }
        `}</style>
        <SetupChecklist />

        {/* LINHA 1: KPIs */}
        <div className="dash-kpis-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 16 }}>
          {carregando ? (
            <>
              <CardSkeleton/><CardSkeleton/><CardSkeleton/><CardSkeleton/>
            </>
          ) : (
            <>
              <MetricCard label="Consultas hoje" valor={consultasHoje}
                delta={consultasHoje > consultasOntem ? `+${consultasHoje - consultasOntem} vs ontem` :
                  consultasHoje < consultasOntem ? `${consultasHoje - consultasOntem} vs ontem` : 'Igual a ontem'}
                deltaTone={consultasHoje >= consultasOntem ? 'success' : 'danger'} />

              <MetricCard label="Taxa de no-show" valor={noShowRate === null ? '--' : noShowRate + '%'}
                delta={noShowRate === null ? 'sem dados últimos 30 dias' : noShowRate > 20 ? 'acima do esperado' : 'dentro do esperado'}
                deltaTone={noShowRate === null ? 'neutral' : noShowRate > 20 ? 'danger' : 'success'} />

              <MetricCard label="Pacientes ativos" valor={pacientesAtivos}
                sublabel="com consulta últimos 6 meses" />

              <MetricCard label="Pacientes em risco" valor={pacientesRisco}
                sublabel={pacientesRisco > 0 ? 'crônicos sem retorno >90d' : 'todos acompanhados'} />
            </>
          )}
        </div>

        {/* LINHA 2: Gráficos e listas */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
          {/* ESQUERDA */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Consultas por dia */}
            <div style={{ background: 'white', borderRadius: 14, padding: 20, border: `1px solid ${tokens.border.subtle}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: tokens.text.primary, margin: '0 0 2px' }}>Consultas por dia</p>
                  <p style={{ fontSize: 11, color: tokens.text.tertiary, margin: 0 }}>Últimos 14 dias</p>
                </div>
                <span style={{ fontSize: 11, color: tokens.brand.primary, background: tokens.brand.primaryLight, padding: '3px 9px', borderRadius: 12, fontWeight: 600 }}>
                  {consultasPorDia.reduce((sum, c) => sum + c.total, 0)} total
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 120 }}>
                {consultasPorDia.map((d, i) => {
                  const altura = (d.total / maxConsultasDia) * 100
                  const ehHoje = d.data === new Date().toISOString().substring(0, 10)
                  return (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontSize: 10, color: tokens.text.secondary, fontWeight: 600, height: 14 }}>
                        {d.total > 0 ? d.total : ''}
                      </span>
                      <div style={{ width: '100%', height: `${Math.max(altura, 4)}%`, background: ehHoje ? tokens.brand.primary : d.total > 0 ? tokens.accent.violetSoft : tokens.bg.hoverStrong, borderRadius: 4, transition: 'all 0.3s', minHeight: 4 }}/>
                    </div>
                  )
                })}
              </div>
              <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                {consultasPorDia.map((d, i) => {
                  const dt = new Date(d.data)
                  return (
                    <div key={i} style={{ flex: 1, fontSize: 9, color: tokens.text.tertiary, textAlign: 'center' }}>
                      {i % 2 === 0 ? `${dt.getDate()}/${dt.getMonth() + 1}` : ''}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Top CIDs */}
            <div style={{ background: 'white', borderRadius: 14, padding: 20, border: `1px solid ${tokens.border.subtle}` }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: tokens.text.primary, margin: '0 0 14px' }}>CIDs mais frequentes</p>
              {carregando ? (
                <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 12 }}>
                  {[0,1,2].map(i => (
                    <div key={i}>
                      <div style={{ marginBottom: 6 }}><Skeleton width={'70%'} height={11} radius={3}/></div>
                      <Skeleton width={'100%'} height={6} radius={3}/>
                    </div>
                  ))}
                </div>
              ) : topCIDs.length === 0 ? (
                <p style={{ fontSize: 12, color: tokens.text.tertiary, margin: 0, textAlign: 'center', padding: '20px 0' }}>Sem dados no período</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {topCIDs.map((c, i) => {
                    const max = topCIDs[0].total
                    const pct = (c.total / max) * 100
                    return (
                      <div key={i}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: 12, color: tokens.text.strong }}>
                            <strong style={{ color: tokens.brand.primary, fontWeight: 700 }}>{c.codigo}</strong> {c.descricao && <span style={{ color: tokens.text.secondary }}>· {c.descricao}</span>}
                          </span>
                          <span style={{ fontSize: 11, color: tokens.text.secondary, fontWeight: 600 }}>{c.total}</span>
                        </div>
                        <div style={{ height: 6, background: tokens.bg.hoverStrong, borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: tokens.brand.primary, borderRadius: 3 }}/>
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
            <div style={{ background: 'white', borderRadius: 14, padding: 20, border: `1px solid ${tokens.border.subtle}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: tokens.text.primary, margin: 0 }}>Próximos agendamentos</p>
                <button onClick={() => router.push('/agenda')} style={{ fontSize: 11, color: tokens.brand.primary, background: 'none', cursor: 'pointer', fontWeight: 600 }}>Ver todos →</button>
              </div>
              {carregando ? (
                <div>{[0,1,2].map(i => <ListaItemSkeleton key={i}/>)}</div>
              ) : proximosAgendamentos.length === 0 ? (
                <p style={{ fontSize: 12, color: tokens.text.tertiary, margin: 0, textAlign: 'center', padding: '20px 0' }}>Sem agendamentos</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {proximosAgendamentos.slice(0, 5).map((a, i) => {
                    const ehOnline = !!a.meet_link
                    return (
                      <div key={i} onClick={() => router.push('/agenda?ag=' + a.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i < 4 ? `1px solid ${tokens.bg.hoverStrong}` : 'none', cursor: 'pointer', borderRadius: 6, transition: 'background 0.15s' }} onMouseEnter={e => e.currentTarget.style.background = tokens.bg.page} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <div style={{ width: 38, height: 38, borderRadius: 8, background: tokens.brand.primaryLight, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: tokens.brand.primary, lineHeight: 1 }}>{new Date(a.data_hora).getDate()}</span>
                          <span style={{ fontSize: 8, color: tokens.brand.primary, textTransform: 'uppercase', fontWeight: 600, marginTop: 1 }}>{new Date(a.data_hora).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}</span>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 12, fontWeight: 600, color: tokens.text.primary, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.pacientes?.nome || a.motivo || 'Consulta'}</p>
                          <p style={{ fontSize: 11, color: tokens.text.secondary, margin: '2px 0 0' }}>
                            {fmtHora(a.data_hora)}
                            {ehOnline && <span style={{ color: tokens.status.success, marginLeft: 6 }}>● Online</span>}
                            {!ehOnline && <span style={{ color: tokens.text.tertiary, marginLeft: 6 }}>● Presencial</span>}
                          </p>
                        </div>
                        <span style={{ fontSize: 10, color: a.status === 'confirmado' ? tokens.status.success : tokens.text.secondary, background: a.status === 'confirmado' ? tokens.status.successBg : tokens.bg.hoverStrong, padding: '3px 7px', borderRadius: 10, fontWeight: 600 }}>{a.status}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Confirmações pendentes */}
            {confirmacoesPendentes.length > 0 && (
              <div style={{ background: tokens.status.warningBgAlt, borderRadius: 14, padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={tokens.status.warningStrong} strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  <p style={{ fontSize: 13, fontWeight: 700, color: tokens.status.warningText, margin: 0 }}>Confirmações pendentes ({confirmacoesPendentes.length})</p>
                </div>
                <p style={{ fontSize: 11, color: tokens.status.warningText, margin: '0 0 12px', opacity: 0.8 }}>Pacientes que ainda não confirmaram consulta nas próximas 48h</p>
                {confirmacoesPendentes.map((p, i) => (
                  <div key={i} onClick={() => router.push('/agenda?ag=' + p.id)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: i < confirmacoesPendentes.length - 1 ? `1px solid ${tokens.status.warningLightAlt}` : 'none', cursor: 'pointer', borderRadius: 6, transition: 'background 0.15s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(217,119,6,0.08)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <span style={{ fontSize: 12, color: tokens.status.warningTextDark, fontWeight: 500 }}>{p.pacientes?.nome || 'Paciente'}</span>
                    <span style={{ fontSize: 11, color: tokens.status.warningText }}>{fmtData(p.data_hora)} {fmtHora(p.data_hora)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* LINHA 3: Comparativo médicos (só admin) */}
        {comparativoMedicos.length > 0 && (
          <div style={{ background: 'white', borderRadius: 14, padding: 20, marginBottom: 16, border: `1px solid ${tokens.border.subtle}` }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: tokens.text.primary, margin: '0 0 14px' }}>Comparativo entre médicos</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
              {comparativoMedicos.map((m, i) => (
                <div key={i} style={{ background: tokens.bg.hover, borderRadius: 10, padding: 14 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: tokens.text.primary, margin: '0 0 8px' }}>{m.nome}</p>
                  <div style={{ display: 'flex', gap: 14 }}>
                    <div>
                      <p style={{ fontSize: 18, fontWeight: 700, color: tokens.brand.primary, margin: 0, lineHeight: 1 }}>{m.consultas}</p>
                      <p style={{ fontSize: 10, color: tokens.text.secondary, margin: '2px 0 0' }}>consultas</p>
                    </div>
                    <div>
                      <p style={{ fontSize: 18, fontWeight: 700, color: tokens.status.success, margin: 0, lineHeight: 1 }}>{m.pacientes}</p>
                      <p style={{ fontSize: 10, color: tokens.text.secondary, margin: '2px 0 0' }}>pacientes</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* LINHA 4: Últimas consultas */}
        <div style={{ background: 'white', borderRadius: 14, padding: 20, border: `1px solid ${tokens.border.subtle}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: tokens.text.primary, margin: 0 }}>Últimas consultas</p>
            <button onClick={() => router.push('/historico')} style={{ fontSize: 11, color: tokens.brand.primary, background: 'none', cursor: 'pointer', fontWeight: 600 }}>Ver histórico →</button>
          </div>
          {carregando ? (
            <div>{[0,1,2,3].map(i => <ListaItemSkeleton key={i}/>)}</div>
          ) : ultimasConsultas.length === 0 ? (
            <p style={{ fontSize: 12, color: tokens.text.tertiary, margin: 0, textAlign: 'center', padding: '20px 0' }}>Sem consultas registradas</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {ultimasConsultas.map((c, i) => (
                <div key={c.id} onClick={() => router.push('/pacientes/' + c.paciente_id)}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '12px 0', borderBottom: i < ultimasConsultas.length - 1 ? `1px solid ${tokens.bg.hoverStrong}` : 'none', cursor: 'pointer' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 3 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: tokens.text.primary, margin: 0 }}>{c.pacientes?.nome || 'Paciente'}</p>
                      <p style={{ fontSize: 11, color: tokens.text.tertiary, margin: 0 }}>{fmtData(c.criado_em)} {fmtHora(c.criado_em)}</p>
                    </div>
                    <p style={{ fontSize: 12, color: tokens.text.secondary, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 600 }}>
                      {c.avaliacao || 'Sem avaliação registrada'}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0, marginLeft: 12 }}>
                    {(c.cids || []).slice(0, 2).map((cid: any, j: number) => (
                      <span key={j} style={{ fontSize: 10, color: tokens.brand.primary, background: tokens.brand.primaryLight, padding: '2px 7px', borderRadius: 10, fontWeight: 600 }}>{cid.codigo}</span>
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

function CardSkeleton() {
  return (
    <div style={{ background: 'white', borderRadius: 14, padding: 18, border: `1px solid ${tokens.border.subtle}` }}>
      <Skeleton width={90} height={11} radius={3}/>
      <div style={{ marginTop: 8 }}><Skeleton width={70} height={28} radius={4}/></div>
      <div style={{ marginTop: 6 }}><Skeleton width={120} height={10} radius={3}/></div>
    </div>
  )
}

function ListaItemSkeleton() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0' }}>
      <Skeleton width={38} height={38} radius={8}/>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' as const, gap: 4 }}>
        <Skeleton width={'60%'} height={11} radius={3}/>
        <Skeleton width={'40%'} height={9} radius={3}/>
      </div>
      <Skeleton width={60} height={16} radius={10}/>
    </div>
  )
}

function Skeleton({ width, height, radius = 4 }: { width: number | string; height: number; radius?: number }) {
  return (
    <div style={{
      width, height, borderRadius: radius,
      background: `linear-gradient(90deg, ${tokens.bg.hoverStrong} 0%, ${tokens.border.default} 50%, ${tokens.bg.hoverStrong} 100%)`,
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.4s ease-in-out infinite' as const,
      display: 'inline-block'
    }}/>
  )
}

