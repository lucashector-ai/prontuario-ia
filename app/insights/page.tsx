'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Sidebar } from '@/components/Sidebar'

export default function InsightsPage() {
  const router = useRouter()
  const [medico, setMedico] = useState<any>(null)
  const [dados, setDados] = useState<any>(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    const m = localStorage.getItem('medico')
    if (!m) { router.push('/login'); return }
    const med = JSON.parse(m)
    setMedico(med)
    carregarInsights(med.id)
  }, [router])

  const carregarInsights = async (medicoId: string) => {
    setCarregando(true)
    const agora = new Date()
    const inicio90 = new Date(agora); inicio90.setDate(agora.getDate() - 90)
    const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1)
    const inicioMesAnterior = new Date(agora.getFullYear(), agora.getMonth() - 1, 1)
    const fimMesAnterior = new Date(agora.getFullYear(), agora.getMonth(), 0)

    const [
      { data: todasConsultas },
      { data: todosPacientes },
      { data: consultasMes },
      { data: consultasMesAnterior },
    ] = await Promise.all([
      supabase.from('consultas').select('id, criado_em, paciente_id, cids').eq('medico_id', medicoId).order('criado_em', { ascending: false }),
      supabase.from('pacientes').select('id, nome, criado_em').eq('medico_id', medicoId),
      supabase.from('consultas').select('id, paciente_id').eq('medico_id', medicoId).gte('criado_em', inicioMes.toISOString()),
      supabase.from('consultas').select('id').eq('medico_id', medicoId).gte('criado_em', inicioMesAnterior.toISOString()).lte('criado_em', fimMesAnterior.toISOString()),
    ])

    const consultas = todasConsultas || []
    const pacientes = todosPacientes || []

    const consultasPorPaciente: Record<string, number> = {}
    consultas.forEach(c => {
      if (c.paciente_id) consultasPorPaciente[c.paciente_id] = (consultasPorPaciente[c.paciente_id] || 0) + 1
    })
    const pacientesRetorno = Object.values(consultasPorPaciente).filter(n => n > 1).length
    const taxaRetorno = pacientes.length > 0 ? Math.round((pacientesRetorno / pacientes.length) * 100) : 0

    const consultasRecentes90 = new Set(
      consultas.filter(c => new Date(c.criado_em) >= inicio90).map(c => c.paciente_id).filter(Boolean)
    )
    const pacientesInativos = pacientes.filter(p => !consultasRecentes90.has(p.id))

    const cidMap: Record<string, { codigo: string; descricao: string; total: number }> = {}
    consultas.forEach(c => {
      (c.cids || []).forEach((cid: any) => {
        if (!cidMap[cid.codigo]) cidMap[cid.codigo] = { codigo: cid.codigo, descricao: cid.descricao, total: 0 }
        cidMap[cid.codigo].total++
      })
    })
    const topCids = Object.values(cidMap).sort((a, b) => b.total - a.total).slice(0, 6)

    const mesesMap: Record<string, number> = {}
    for (let i = 5; i >= 0; i--) {
      const d = new Date(agora.getFullYear(), agora.getMonth() - i, 1)
      const key = d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
      mesesMap[key] = 0
    }
    consultas.forEach(c => {
      const d = new Date(c.criado_em)
      const key = d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
      if (mesesMap[key] !== undefined) mesesMap[key]++
    })
    const porMes = Object.entries(mesesMap).map(([mes, total]) => ({ mes, total }))

    const totalMes = consultasMes?.length || 0
    const totalMesAnterior = consultasMesAnterior?.length || 0
    const crescimento = totalMesAnterior > 0 ? Math.round(((totalMes - totalMesAnterior) / totalMesAnterior) * 100) : totalMes > 0 ? 100 : 0
    const novosPacientesMes = pacientes.filter(p => new Date(p.criado_em) >= inicioMes).length
    const mediaPorMes = porMes.length > 0 ? Math.round(porMes.reduce((a, m) => a + m.total, 0) / porMes.length) : 0

    setDados({ totalConsultas: consultas.length, totalPacientes: pacientes.length, taxaRetorno, pacientesRetorno, pacientesInativos, topCids, porMes, totalMes, totalMesAnterior, crescimento, novosPacientesMes, mediaPorMes })
    setCarregando(false)
  }

  const maxMes = dados ? Math.max(...dados.porMes.map((m: any) => m.total), 1) : 1

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#F9FAFC', overflow: 'hidden' }}>
      <Sidebar />
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '0 28px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <h1 style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: 0 }}>Inteligência de negócio</h1>
            <p style={{ fontSize: 11, color: '#9ca3af', margin: 0 }}>Métricas e insights da sua clínica</p>
          </div>
          {medico && <button onClick={() => carregarInsights(medico.id)} style={{ fontSize: 12, color: '#6043C1', background: '#f0ebff', border: '1px solid #d4c9f7', padding: '6px 14px', borderRadius: 7, cursor: 'pointer', fontWeight: 600 }}>Atualizar</button>}
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: '0 24px 24px' }}>
          {carregando ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid #ede9fb', borderTopColor: '#6043C1', animation: 'spin 0.8s linear infinite' }}/>
            </div>
          ) : dados && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1100 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
                {[
                  { label: 'Consultas este mês', valor: dados.totalMes, sub: dados.crescimento >= 0 ? `+${dados.crescimento}% vs mês anterior` : `${dados.crescimento}% vs mês anterior`, cor: dados.crescimento >= 0 ? '#16a34a' : '#dc2626' },
                  { label: 'Taxa de retorno', valor: `${dados.taxaRetorno}%`, sub: `${dados.pacientesRetorno} de ${dados.totalPacientes} pacientes`, cor: '#6043C1' },
                  { label: 'Novos pacientes', valor: dados.novosPacientesMes, sub: 'cadastrados este mês', cor: '#2563eb' },
                  { label: 'Pacientes inativos', valor: dados.pacientesInativos.length, sub: 'sem consulta há 90+ dias', cor: dados.pacientesInativos.length > 0 ? '#d97706' : '#16a34a' },
                ].map(m => (
                  <div key={m.label} style={{ background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.07)', borderRadius: 14, padding: '18px 20px' }}>
                    <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 10px', fontWeight: 500 }}>{m.label}</p>
                    <p style={{ fontSize: 28, fontWeight: 800, color: '#111827', margin: '0 0 4px', lineHeight: 1 }}>{m.valor}</p>
                    <p style={{ fontSize: 11, color: m.cor, margin: 0, fontWeight: 600 }}>{m.sub}</p>
                  </div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div style={{ background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.07)', borderRadius: 14, padding: '20px 24px' }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>Consultas por mês</p>
                  <p style={{ fontSize: 11, color: '#9ca3af', margin: '0 0 20px' }}>Média: {dados.mediaPorMes}/mês</p>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: 140 }}>
                    {dados.porMes.map((m: any, i: number) => {
                      const altura = Math.max(maxMes > 0 ? (m.total / maxMes) * 120 : 0, m.total > 0 ? 8 : 4)
                      const isUltimo = i === dados.porMes.length - 1
                      return (
                        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                          {m.total > 0 && <span style={{ fontSize: 11, color: '#374151', fontWeight: 700 }}>{m.total}</span>}
                          <div style={{ width: '100%', height: `${altura}px`, borderRadius: '6px 6px 0 0', background: isUltimo ? '#6043C1' : '#d4c9f7' }}/>
                          <span style={{ fontSize: 10, color: '#9ca3af', textAlign: 'center' }}>{m.mes}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
                <div style={{ background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.07)', borderRadius: 14, padding: '20px 24px' }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>Diagnósticos mais frequentes</p>
                  <p style={{ fontSize: 11, color: '#9ca3af', margin: '0 0 16px' }}>CIDs registrados em todas as consultas</p>
                  {dados.topCids.length === 0 ? (
                    <p style={{ fontSize: 13, color: '#9ca3af', textAlign: 'center', padding: 24 }}>Nenhum CID registrado ainda</p>
                  ) : dados.topCids.map((cid: any) => {
                    const pct = Math.round((cid.total / (dados.topCids[0]?.total || 1)) * 100)
                    return (
                      <div key={cid.codigo} style={{ marginBottom: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                            <span style={{ fontFamily: 'monospace', fontSize: 10, fontWeight: 700, color: '#6043C1', background: '#f0ebff', padding: '1px 6px', borderRadius: 4, flexShrink: 0 }}>{cid.codigo}</span>
                            <span style={{ fontSize: 12, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cid.descricao}</span>
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 700, color: '#111827', marginLeft: 8 }}>{cid.total}x</span>
                        </div>
                        <div style={{ height: 5, background: '#f3f4f6', borderRadius: 4 }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: '#6043C1', borderRadius: 4 }}/>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
              {dados.pacientesInativos.length > 0 && (
                <div style={{ background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.07)', borderRadius: 14, overflow: 'hidden' }}>
                  <div style={{ padding: '16px 20px', borderBottom: '1px solid #f9fafb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 700, color: '#111827', margin: 0 }}>Pacientes inativos</p>
                      <p style={{ fontSize: 11, color: '#9ca3af', margin: '2px 0 0' }}>Sem consulta há mais de 90 dias — considere um follow-up</p>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#d97706', background: '#fffbeb', border: '1px solid #fde68a', padding: '3px 10px', borderRadius: 20 }}>{dados.pacientesInativos.length} pacientes</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0 }}>
                    {dados.pacientesInativos.slice(0, 9).map((p: any, i: number) => {
                      const iniciais = p.nome?.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase() || '??'
                      return (
                        <div key={p.id} onClick={() => router.push(`/pacientes/${p.id}`)} style={{ padding: '12px 20px', borderBottom: i < 6 ? '1px solid #f9fafb' : 'none', borderRight: (i + 1) % 3 !== 0 ? '1px solid #f9fafb' : 'none', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                          <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#f0ebff', color: '#6043C1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{iniciais}</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: 12, fontWeight: 600, color: '#111827', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nome}</p>
                            <p style={{ fontSize: 11, color: '#d97706', margin: 0 }}>Inativo há 90+ dias</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
              <div style={{ background: '#6043C1', borderRadius: 14, padding: '24px 28px', color: 'white' }}>
                <p style={{ fontSize: 14, fontWeight: 700, margin: '0 0 16px', opacity: 0.9 }}>Resumo geral</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}>
                  {[
                    { label: 'Total de consultas', valor: dados.totalConsultas },
                    { label: 'Total de pacientes', valor: dados.totalPacientes },
                    { label: 'Taxa de retorno', valor: `${dados.taxaRetorno}%` },
                    { label: 'Média consultas/mês', valor: dados.mediaPorMes },
                  ].map(r => (
                    <div key={r.label}>
                      <p style={{ fontSize: 24, fontWeight: 800, margin: '0 0 4px' }}>{r.valor}</p>
                      <p style={{ fontSize: 11, opacity: 0.7, margin: 0 }}>{r.label}</p>
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