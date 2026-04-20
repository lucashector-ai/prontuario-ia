'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Sidebar } from '@/components/Sidebar'
export default function Dashboard() {
  const router = useRouter()
  const [medico, setMedico] = useState<any>(null)
  const [dados, setDados] = useState<any>(null)
  const [carregando, setCarregando] = useState(true)
  const [gerandoRelatorio, setGerandoRelatorio] = useState(false)
  const [periodo, setPeriodo] = useState<'semana' | 'mes' | 'ano'>('mes')

  useEffect(() => {
    const m = localStorage.getItem('medico')
    if (!m) { router.push('/login'); return }
    setMedico(JSON.parse(m))
  }, [router])

  useEffect(() => {
    if (medico) carregarDados()
  }, [medico, periodo])

  const gerarRelatorio = async () => {
    if (!medico) return
    setGerandoRelatorio(true)
    try {
      const res = await fetch('/api/pdf-relatorio-mensal', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ medico_id: medico.id }),
      })
      const html = await res.text()
      const win = window.open('', '_blank')
      if (win) { win.document.write(html); win.document.close() }
    } catch (e) { console.error(e) }
    finally { setGerandoRelatorio(false) }
  }

  const carregarDados = async () => {
    setCarregando(true)

    const intervalMap = { semana: '7 days', mes: '30 days', ano: '365 days' }
    const intervalo = intervalMap[periodo]
    const desde = new Date()
    if (periodo === 'semana') desde.setDate(desde.getDate() - 7)
    else if (periodo === 'mes') desde.setDate(desde.getDate() - 30)
    else desde.setFullYear(desde.getFullYear() - 1)

    const [
      { count: totalConsultas },
      { count: totalPacientes },
      { data: consultasRecentes },
      { data: todasConsultas },
      { data: agendamentos },
    ] = await Promise.all([
      supabase.from('consultas').select('*', { count: 'exact', head: true }).eq('medico_id', medico.id),
      supabase.from('pacientes').select('*', { count: 'exact', head: true }).eq('medico_id', medico.id),
      supabase.from('consultas').select('*').eq('medico_id', medico.id).gte('criado_em', desde.toISOString()).order('criado_em', { ascending: false }),
      supabase.from('consultas').select('cids, criado_em').eq('medico_id', medico.id),
      supabase.from('agendamentos').select('*').eq('medico_id', medico.id).gte('data_hora', new Date().toISOString()).order('data_hora').limit(5),
    ])

    // Processa CIDs
    const cidMap: Record<string, { codigo: string; descricao: string; total: number }> = {}
    todasConsultas?.forEach(c => {
      (c.cids || []).forEach((cid: any) => {
        const k = cid.codigo
        if (!cidMap[k]) cidMap[k] = { codigo: k, descricao: cid.descricao, total: 0 }
        cidMap[k].total++
      })
    })
    const topCids = Object.values(cidMap).sort((a, b) => b.total - a.total).slice(0, 8)

    // Consultas por dia (últimos 14 dias)
    const diasMap: Record<string, number> = {}
    const hoje = new Date()
    for (let i = 13; i >= 0; i--) {
      const d = new Date(hoje); d.setDate(hoje.getDate() - i)
      const key = d.toISOString().split('T')[0]
      diasMap[key] = 0
    }
    consultasRecentes?.forEach(c => {
      const key = c.criado_em.split('T')[0]
      if (diasMap[key] !== undefined) diasMap[key]++
    })
    const porDia = Object.entries(diasMap).map(([dia, total]) => ({ dia, total }))

    // Consultas período atual vs anterior
    const periodoAnterior = new Date(desde)
    const duracao = Date.now() - desde.getTime()
    periodoAnterior.setTime(periodoAnterior.getTime() - duracao)
    const { count: consultasAnterior } = await supabase.from('consultas').select('*', { count: 'exact', head: true }).eq('medico_id', medico.id).gte('criado_em', periodoAnterior.toISOString()).lt('criado_em', desde.toISOString())

    // Insights de negócio
    const inicio90 = new Date(); inicio90.setDate(inicio90.getDate() - 90)
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1)

    const consultasPorPaciente: Record<string, number> = {}
    todasConsultas?.forEach((c: any) => {
      if (c.paciente_id) consultasPorPaciente[c.paciente_id] = (consultasPorPaciente[c.paciente_id] || 0) + 1
    })
    const pacientesRetorno = Object.values(consultasPorPaciente).filter(n => n > 1).length
    const taxaRetorno = (todasConsultas?.length || 0) > 0 ? Math.round((pacientesRetorno / Math.max(totalPacientes || 1, 1)) * 100) : 0

    const consultasRecentes90 = new Set(
      todasConsultas?.filter((c: any) => new Date(c.criado_em) >= inicio90).map((c: any) => c.paciente_id).filter(Boolean)
    )
    const { data: todosPacientes } = await supabase.from('pacientes').select('id, criado_em').eq('medico_id', medico.id)
    const pacientesInativos = (todosPacientes || []).filter((p: any) => !consultasRecentes90.has(p.id)).length
    const novosPacientesMes = (todosPacientes || []).filter((p: any) => new Date(p.criado_em) >= inicioMes).length

    // Consultas por mês (6 meses)
    const mesesMap: Record<string, number> = {}
    for (let i = 5; i >= 0; i--) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1)
      const key = d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
      mesesMap[key] = 0
    }
    todasConsultas?.forEach((c: any) => {
      const key = new Date(c.criado_em).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
      if (mesesMap[key] !== undefined) mesesMap[key]++
    })
    const porMes = Object.entries(mesesMap).map(([mes, total]) => ({ mes, total }))

    // Calcula tempo médio de consulta (baseado em agendamentos com duração)
    const { data: agendamentosRealizados } = await supabase
      .from('agendamentos')
      .select('data_hora, duracao_minutos')
      .eq('medico_id', medico.id)
      .eq('status', 'realizado')
      .not('duracao_minutos', 'is', null)
      .limit(50)
    const tempoMedioConsulta = agendamentosRealizados?.length
      ? Math.round(agendamentosRealizados.reduce((a: number, ag: any) => a + (ag.duracao_minutos || 30), 0) / agendamentosRealizados.length)
      : null

    setDados({
      totalConsultas,
      totalPacientes,
      consultasPeriodo: consultasRecentes?.length || 0,
      consultasAnterior: consultasAnterior || 0,
      topCids,
      porDia,
      consultasRecentes: consultasRecentes?.slice(0, 5) || [],
      proximosAgendamentos: agendamentos || [],
      taxaRetorno,
      tempoMedioConsulta,
      pacientesRetorno,
      pacientesInativos,
      novosPacientesMes,
      porMes,
    })
    setCarregando(false)
  }

  const fmt = (s: string) => new Date(s).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
  const fmtFull = (s: string) => new Date(s).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  const variacao = dados ? (dados.consultasAnterior > 0 ? Math.round(((dados.consultasPeriodo - dados.consultasAnterior) / dados.consultasAnterior) * 100) : dados.consultasPeriodo > 0 ? 100 : 0) : 0

  const maxDia = dados ? Math.max(...dados.porDia.map((d: any) => d.total), 1) : 1

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#F9FAFC', overflow: 'hidden' }}>
      <Sidebar />
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ background: 'transparent', borderBottom: 'none', padding: '0 28px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <h1 style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: 0 }}>Dashboard</h1>
            <p style={{ fontSize: 11, color: '#9ca3af', margin: 0 }}>Visão geral da clínica</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <div style={{ display: 'flex', gap: 4, background: '#f3f4f6', borderRadius: 8, padding: 3 }}>
            {(['semana', 'mes', 'ano'] as const).map(p => (
              <button key={p} onClick={() => setPeriodo(p)} style={{
                padding: '5px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500,
                background: periodo === p ? 'white' : 'transparent',
                color: periodo === p ? '#111827' : '#6b7280',
                boxShadow: periodo === p ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              }}>
                {p === 'semana' ? '7 dias' : p === 'mes' ? '30 dias' : '12 meses'}
              </button>
            ))}
            </div>
            <button onClick={gerarRelatorio} disabled={gerandoRelatorio} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 14px', borderRadius: 7, border: '1px solid #e5e7eb', background: 'white', color: '#374151', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
              {gerandoRelatorio ? 'Gerando...' : 'Relatório mensal'}
            </button>
          </div>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
          {carregando ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid #ede9fb', borderTopColor: '#6043C1', animation: 'spin 0.8s linear infinite' }}/>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1200 }}>

              {/* Métricas principais */}
              <div className="grid-dash-metrics">
                {[
                  {
                    label: 'Total de consultas', valor: dados.totalConsultas || 0, icon: '📋',
                    sub: `${dados.consultasPeriodo} no período`, cor: '#2563eb', bg: '#eff6ff', border: '#bfdbfe'
                  },
                  {
                    label: 'Pacientes cadastrados', valor: dados.totalPacientes || 0, icon: '👥',
                    sub: 'total na clínica', cor: '#6043C1', bg: '#f3f0fd', border: '#d4c9f7'
                  },
                  {
                    label: 'Consultas no período', valor: dados.consultasPeriodo, icon: '📅',
                    sub: variacao >= 0 ? `+${variacao}% vs anterior` : `${variacao}% vs anterior`,
                    cor: variacao >= 0 ? '#6043C1' : '#dc2626',
                    bg: variacao >= 0 ? '#f3f0fd' : '#fef2f2',
                    border: variacao >= 0 ? '#d4c9f7' : '#fecaca'
                  },
                  {
                    label: 'CIDs registrados', valor: Object.keys(dados.topCids).length, icon: '🏷',
                    sub: 'diagnósticos únicos', cor: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe'
                  },
                  {
                    label: 'Tempo médio', valor: dados.tempoMedioConsulta ? `${dados.tempoMedioConsulta}min` : '--', icon: '⏱',
                    sub: 'por consulta no período', cor: '#0d9488', bg: '#f0fdfa', border: '#99f6e4'
                  },
                  {
                    label: 'Taxa de retorno', valor: dados.taxaRetorno ? `${dados.taxaRetorno}%` : '--', icon: '🔄',
                    sub: 'pacientes que voltaram', cor: '#d97706', bg: '#fffbeb', border: '#fde68a'
                  },
                ].map(m => (
                  <div key={m.label} style={{ background: 'white', borderRadius: 14, padding: '18px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                      <p style={{ fontSize: 12, color: '#6b7280', margin: 0, fontWeight: 500 }}>{m.label}</p>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: m.bg, border: `1px solid ${m.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>{m.icon}</div>
                    </div>
                    <p style={{ fontSize: 28, fontWeight: 800, color: '#111827', margin: '0 0 4px', lineHeight: 1 }}>{m.valor}</p>
                    <p style={{ fontSize: 11, color: m.cor, margin: 0, fontWeight: 600 }}>{m.sub}</p>
                  </div>
                ))}
              </div>

              <div className="grid-dash-main">

                {/* Gráfico de barras — consultas por dia */}
                <div style={{ background: 'white', borderRadius: 14, padding: '20px 24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 700, color: '#111827', margin: 0 }}>Consultas por dia</p>
                      <p style={{ fontSize: 11, color: '#9ca3af', margin: '2px 0 0' }}>Últimos 14 dias</p>
                    </div>
                    <span style={{ fontSize: 11, color: '#6043C1', background: '#f3f0fd', border: '1px solid #d4c9f7', padding: '3px 10px', borderRadius: 20, fontWeight: 600 }}>
                      {dados.porDia.reduce((a: number, d: any) => a + d.total, 0)} total
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 140 }}>
                    {dados.porDia.map((d: any, i: number) => {
                      const pct = maxDia > 0 ? (d.total / maxDia) : 0
                      const altura = Math.max(pct * 120, d.total > 0 ? 8 : 3)
                      const isToday = d.dia === new Date().toISOString().split('T')[0]
                      return (
                        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                          {d.total > 0 && (
                            <span style={{ fontSize: 9, color: '#6b7280', fontWeight: 600 }}>{d.total}</span>
                          )}
                          <div style={{ width: '100%', height: `${altura}px`, borderRadius: '4px 4px 0 0', background: isToday ? '#6043C1' : d.total > 0 ? '#b9a9ef' : '#f3f4f6', transition: 'height 0.3s' }}/>
                          {i % 3 === 0 && (
                            <span style={{ fontSize: 9, color: '#9ca3af', whiteSpace: 'nowrap', transform: 'rotate(-30deg)', transformOrigin: 'center' }}>
                              {fmt(d.dia)}
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 16, paddingTop: 12, borderTop: '1px solid #f3f4f6' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 10, height: 10, borderRadius: 2, background: '#6043C1' }}/>
                      <span style={{ fontSize: 11, color: '#6b7280' }}>Hoje</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 10, height: 10, borderRadius: 2, background: '#b9a9ef' }}/>
                      <span style={{ fontSize: 11, color: '#6b7280' }}>Com consultas</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 10, height: 10, borderRadius: 2, background: '#f3f4f6' }}/>
                      <span style={{ fontSize: 11, color: '#6b7280' }}>Sem consultas</span>
                    </div>
                  </div>
                </div>

                {/* Próximos agendamentos */}
                <div style={{ background: 'white', borderRadius: 14, overflow: 'hidden' }}>
                  <div style={{ padding: '16px 20px', borderBottom: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: '#111827', margin: 0 }}>Próximos agendamentos</p>
                    <a href="/pacientes" style={{ fontSize: 11, color: '#6043C1', textDecoration: 'none', fontWeight: 600 }}>Ver todos →</a>
                  </div>
                  {dados.proximosAgendamentos.length === 0 ? (
                    <div style={{ padding: '32px 20px', textAlign: 'center' }}>
                      <p style={{ fontSize: 13, color: '#9ca3af', margin: '0 0 12px' }}>Nenhum agendamento</p>
                      <a href="/agenda" style={{ fontSize: 12, color: '#6043C1', fontWeight: 600, textDecoration: 'none' }}>+ Agendar consulta</a>
                    </div>
                  ) : dados.proximosAgendamentos.map((ag: any, i: number) => (
                    <div key={ag.id} style={{ padding: '12px 20px', borderBottom: i < dados.proximosAgendamentos.length - 1 ? '1px solid #f9fafb' : 'none', display: 'flex', gap: 12, alignItems: 'center' }}>
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: '#f3f0fd', border: '1px solid #d4c9f7', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <p style={{ fontSize: 14, fontWeight: 800, color: '#6043C1', margin: 0, lineHeight: 1 }}>{new Date(ag.data_hora).getDate()}</p>
                        <p style={{ fontSize: 9, color: '#6043C1', margin: 0, textTransform: 'uppercase' }}>{new Date(ag.data_hora).toLocaleDateString('pt-BR', { month: 'short' })}</p>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 12, fontWeight: 600, color: '#111827', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ag.motivo || 'Consulta'}</p>
                        <p style={{ fontSize: 11, color: '#9ca3af', margin: '2px 0 0' }}>{new Date(ag.data_hora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                      <span style={{ fontSize: 10, color: ag.status === 'confirmado' ? '#6043C1' : '#2563eb', background: ag.status === 'confirmado' ? '#f3f0fd' : '#eff6ff', padding: '2px 8px', borderRadius: 20, fontWeight: 600, flexShrink: 0 }}>{ag.status}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid-dash-bottom">

                {/* CIDs mais frequentes */}
                <div style={{ background: 'white', borderRadius: 14, overflow: 'hidden' }}>
                  <div style={{ padding: '16px 20px', borderBottom: 'none' }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: '#111827', margin: 0 }}>CIDs mais frequentes</p>
                    <p style={{ fontSize: 11, color: '#9ca3af', margin: '2px 0 0' }}>Diagnósticos registrados no período</p>
                  </div>
                  {dados.topCids.length === 0 ? (
                    <div style={{ padding: '32px 20px', textAlign: 'center' }}>
                      <p style={{ fontSize: 13, color: '#9ca3af', margin: 0 }}>Nenhum CID registrado ainda</p>
                    </div>
                  ) : (
                    <div style={{ padding: '12px 0' }}>
                      {dados.topCids.map((cid: any, i: number) => {
                        const maxTotal = dados.topCids[0]?.total || 1
                        const pct = Math.round((cid.total / maxTotal) * 100)
                        const cores = ['#2563eb','#6043C1','#7c3aed','#d97706','#0d9488','#dc2626','#0891b2','#9333ea']
                        const cor = cores[i % cores.length]
                        return (
                          <div key={cid.codigo} style={{ padding: '10px 20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                                <span style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 700, color: cor, background: cor + '15', padding: '1px 7px', borderRadius: 5, flexShrink: 0 }}>{cid.codigo}</span>
                                <span style={{ fontSize: 12, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cid.descricao}</span>
                              </div>
                              <span style={{ fontSize: 12, fontWeight: 700, color: '#111827', marginLeft: 8, flexShrink: 0 }}>{cid.total}x</span>
                            </div>
                            <div style={{ height: 4, background: '#f3f4f6', borderRadius: 4, overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${pct}%`, background: cor, borderRadius: 4, transition: 'width 0.5s ease' }}/>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Últimas consultas */}
                <div style={{ background: 'white', borderRadius: 14, overflow: 'hidden' }}>
                  <div style={{ padding: '16px 20px', borderBottom: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: '#111827', margin: 0 }}>Últimas consultas</p>
                    <a href="/histórico" style={{ fontSize: 11, color: '#6043C1', textDecoration: 'none', fontWeight: 600 }}>Ver histórico →</a>
                  </div>
                  {dados.consultasRecentes.length === 0 ? (
                    <div style={{ padding: '32px 20px', textAlign: 'center' }}>
                      <p style={{ fontSize: 13, color: '#9ca3af', margin: '0 0 12px' }}>Nenhuma consulta no período</p>
                      <a href="/consulta" style={{ fontSize: 12, color: '#6043C1', fontWeight: 600, textDecoration: 'none' }}>+ Nova consulta</a>
                    </div>
                  ) : dados.consultasRecentes.map((c: any, i: number) => (
                    <div key={c.id} style={{ padding: '12px 20px', borderBottom: i < dados.consultasRecentes.length - 1 ? '1px solid #f9fafb' : 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 11, color: '#9ca3af', margin: '0 0 3px' }}>{fmtFull(c.criado_em)}</p>
                          <p style={{ fontSize: 12, color: '#374151', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {c.subjetivo?.substring(0, 60) || 'Consulta sem detalhes'}
                          </p>
                        </div>
                        <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
                          {(c.cids || []).slice(0, 2).map((cid: any) => (
                            <span key={cid.codigo} style={{ fontSize: 9, color: '#6043C1', background: '#f3f0fd', padding: '1px 5px', borderRadius: 4, fontFamily: 'monospace', fontWeight: 700, border: '1px solid #d4c9f7' }}>{cid.codigo}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}
        </div>
      </main>
      <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
    </div>
  )
}
