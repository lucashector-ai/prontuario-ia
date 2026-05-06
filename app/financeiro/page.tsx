'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { AppShell } from '@/components/AppShell'

type TabKey = 'visao' | 'movimentacoes' | 'pacotes' | 'comissoes' | 'relatorios'

export default function FinanceiroPage() {
  const router = useRouter()
  const [clinicaId, setClinicaId] = useState<string | null>(null)
  const [tab, setTab] = useState<TabKey>('visao')
  const [periodo, setPeriodo] = useState<'7' | '30' | '90' | '365'>('30')
  const [carregando, setCarregando] = useState(true)

  // KPIs
  const [receita, setReceita] = useState(0)
  const [despesa, setDespesa] = useState(0)
  const [pendente, setPendente] = useState(0)
  const [pendenteCount, setPendenteCount] = useState(0)
  const [receitaAnterior, setReceitaAnterior] = useState(0)
  const [despesaAnterior, setDespesaAnterior] = useState(0)

  // Movimentacoes recentes
  const [movRecentes, setMovRecentes] = useState<any[]>([])

  // Fluxo de caixa (chart)
  const [serieFluxo, setSerieFluxo] = useState<{ data: string; receita: number; despesa: number }[]>([])

  // Pacotes ativos
  const [pacotesAtivos, setPacotesAtivos] = useState<any[]>([])

  useEffect(() => {
    try {
      const ca = localStorage.getItem('clinica_admin')
      const med = localStorage.getItem('medico')
      let cid = null
      if (ca) cid = JSON.parse(ca).clinica_id
      else if (med) cid = JSON.parse(med).clinica_id
      if (!cid) { router.replace('/login'); return }
      setClinicaId(cid)
    } catch { router.replace('/login') }
  }, [router])

  useEffect(() => {
    if (!clinicaId) return
    carregar()
  }, [clinicaId, periodo])

  const carregar = async () => {
    if (!clinicaId) return
    setCarregando(true)

    const dias = parseInt(periodo)
    const dataInicio = new Date()
    dataInicio.setDate(dataInicio.getDate() - dias)
    const dataInicioStr = dataInicio.toISOString().substring(0, 10)

    const dataInicioAnterior = new Date()
    dataInicioAnterior.setDate(dataInicioAnterior.getDate() - (dias * 2))
    const dataInicioAnteriorStr = dataInicioAnterior.toISOString().substring(0, 10)

    const hoje = new Date().toISOString().substring(0, 10)

    const [movPeriodoR, movAnteriorR, pendentesR, recentesR, pacotesR] = await Promise.all([
      // Periodo atual
      supabase.from('financeiro_movimentacoes')
        .select('tipo, valor, status, data_movimentacao')
        .eq('clinica_id', clinicaId)
        .gte('data_movimentacao', dataInicioStr)
        .lte('data_movimentacao', hoje),
      // Periodo anterior (pra %)
      supabase.from('financeiro_movimentacoes')
        .select('tipo, valor')
        .eq('clinica_id', clinicaId)
        .gte('data_movimentacao', dataInicioAnteriorStr)
        .lt('data_movimentacao', dataInicioStr),
      // Pendentes
      supabase.from('financeiro_movimentacoes')
        .select('valor', { count: 'exact' })
        .eq('clinica_id', clinicaId)
        .eq('tipo', 'receita')
        .in('status', ['pendente', 'atrasado', 'parcial']),
      // Recentes (5)
      supabase.from('financeiro_movimentacoes')
        .select('*, pacientes:paciente_id(nome), medicos:medico_id(nome), categoria:categoria_id(nome, cor)')
        .eq('clinica_id', clinicaId)
        .order('data_movimentacao', { ascending: false })
        .order('criado_em', { ascending: false })
        .limit(5),
      // Pacotes ativos
      supabase.from('financeiro_pacotes')
        .select('*, pacientes:paciente_id(nome)')
        .eq('clinica_id', clinicaId)
        .eq('status', 'ativo')
        .order('criado_em', { ascending: false })
        .limit(3),
    ])

    const mov = movPeriodoR.data || []
    const movAnt = movAnteriorR.data || []

    // KPIs
    const rec = mov.filter((m: any) => m.tipo === 'receita' && m.status !== 'cancelado').reduce((s: number, m: any) => s + Number(m.valor), 0)
    const desp = mov.filter((m: any) => m.tipo === 'despesa' && m.status !== 'cancelado').reduce((s: number, m: any) => s + Number(m.valor), 0)
    setReceita(rec)
    setDespesa(desp)

    const recAnt = movAnt.filter((m: any) => m.tipo === 'receita').reduce((s: number, m: any) => s + Number(m.valor), 0)
    const despAnt = movAnt.filter((m: any) => m.tipo === 'despesa').reduce((s: number, m: any) => s + Number(m.valor), 0)
    setReceitaAnterior(recAnt)
    setDespesaAnterior(despAnt)

    const pendentes = pendentesR.data || []
    setPendente(pendentes.reduce((s: number, m: any) => s + Number(m.valor), 0))
    setPendenteCount(pendentesR.count || 0)

    // Serie diaria
    const porDia: Record<string, { receita: number; despesa: number }> = {}
    for (let i = dias - 1; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0, 0, 0, 0)
      const k = d.toISOString().substring(0, 10)
      porDia[k] = { receita: 0, despesa: 0 }
    }
    mov.forEach((m: any) => {
      const k = m.data_movimentacao
      if (k in porDia && m.status !== 'cancelado') {
        if (m.tipo === 'receita') porDia[k].receita += Number(m.valor)
        else porDia[k].despesa += Number(m.valor)
      }
    })
    setSerieFluxo(Object.entries(porDia).map(([data, v]) => ({ data, ...v })))

    setMovRecentes(recentesR.data || [])
    setPacotesAtivos(pacotesR.data || [])

    setCarregando(false)
  }

  const lucro = receita - despesa
  const lucroAnterior = receitaAnterior - despesaAnterior
  const pctReceita = receitaAnterior > 0 ? Math.round(((receita - receitaAnterior) / receitaAnterior) * 100) : null
  const pctDespesa = despesaAnterior > 0 ? Math.round(((despesa - despesaAnterior) / despesaAnterior) * 100) : null
  const pctLucro = lucroAnterior > 0 ? Math.round(((lucro - lucroAnterior) / lucroAnterior) * 100) : null

  return (
    <AppShell>
      <div style={{ padding: '28px 32px', minHeight: '100%' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', margin: '0 0 4px' }}>Financeiro</h1>
            <p style={{ fontSize: 13, color: '#737373', margin: 0 }}>Fluxo de caixa, pacotes e comissões</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={btnSecondary}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Exportar
            </button>
            <button style={btnPrimary} onClick={() => alert('Em breve no Patch 3')}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Nova movimentação
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'white', padding: 4, borderRadius: 11, width: 'fit-content' }}>
          {(['visao','movimentacoes','pacotes','comissoes','relatorios'] as TabKey[]).map(k => (
            <button key={k} onClick={() => setTab(k)} style={{
              padding: '8px 16px', borderRadius: 8, border: 'none',
              background: tab === k ? '#0a0a0a' : 'transparent',
              color: tab === k ? 'white' : '#525252',
              fontSize: 13, fontWeight: 600, cursor: 'pointer'
            }}>
              {k === 'visao' ? 'Visão geral' : k === 'movimentacoes' ? 'Movimentações' : k === 'pacotes' ? 'Pacotes' : k === 'comissoes' ? 'Comissões' : 'Relatórios'}
            </button>
          ))}
        </div>

        {/* Periodo */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 4, background: 'white', padding: 4, borderRadius: 9 }}>
            {([['7','7 dias'],['30','30 dias'],['90','3 meses'],['365','12 meses']] as [string,string][]).map(([k, label]) => (
              <button key={k} onClick={() => setPeriodo(k as any)} style={{
                padding: '6px 12px', borderRadius: 7, border: 'none',
                background: periodo === k ? '#f0ebff' : 'transparent',
                color: periodo === k ? '#6043C1' : '#525252',
                fontSize: 12, fontWeight: 600, cursor: 'pointer'
              }}>{label}</button>
            ))}
          </div>
        </div>

        {tab === 'visao' && (
          <>
            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 16 }}>
              <KPI label="Receita do período" valor={fmt(receita)} cor="#16a34a" sub={pctReceita !== null ? `${pctReceita >= 0 ? '+' : ''}${pctReceita}% vs período anterior` : 'sem comparativo'} subCor={pctReceita !== null && pctReceita >= 0 ? '#16a34a' : '#dc2626'} carregando={carregando}/>
              <KPI label="Despesas do período" valor={fmt(despesa)} cor="#dc2626" sub={pctDespesa !== null ? `${pctDespesa >= 0 ? '+' : ''}${pctDespesa}% vs período anterior` : 'sem comparativo'} subCor={pctDespesa !== null && pctDespesa <= 0 ? '#16a34a' : '#dc2626'} carregando={carregando}/>
              <KPI label="Lucro líquido" valor={fmt(lucro)} cor="#0a0a0a" sub={pctLucro !== null ? `${pctLucro >= 0 ? '+' : ''}${pctLucro}% vs período anterior` : 'sem comparativo'} subCor={pctLucro !== null && pctLucro >= 0 ? '#16a34a' : '#dc2626'} carregando={carregando}/>
              <KPI label="Pendente recebimento" valor={fmt(pendente)} cor="#d97706" sub={`${pendenteCount} ${pendenteCount === 1 ? 'transação' : 'transações'}`} carregando={carregando}/>
            </div>

            {/* Chart fluxo */}
            <div style={{ background: 'white', borderRadius: 14, padding: 22, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                <div>
                  <p style={{ fontSize: 15, fontWeight: 700, margin: '0 0 2px' }}>Fluxo de caixa</p>
                  <p style={{ fontSize: 11, color: '#9ca3af', margin: 0 }}>Últimos {periodo} dias</p>
                </div>
                <div style={{ display: 'flex', gap: 14, fontSize: 11 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 8, height: 8, background: '#16a34a', borderRadius: '50%' }}/>Receitas</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 8, height: 8, background: '#dc2626', borderRadius: '50%' }}/>Despesas</span>
                </div>
              </div>
              <ChartFluxo data={serieFluxo}/>
            </div>

            {/* Movimentacoes recentes */}
            <div style={{ background: 'white', borderRadius: 14, padding: 22, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <p style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Últimas movimentações</p>
                <button onClick={() => setTab('movimentacoes')} style={{ background: 'none', border: 'none', color: '#6043C1', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Ver todas →</button>
              </div>
              {movRecentes.length === 0 ? (
                <p style={{ fontSize: 13, color: '#9ca3af', textAlign: 'center', padding: '24px 0' }}>Nenhuma movimentação registrada ainda. Comece adicionando uma receita ou despesa.</p>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#fafafa' }}>
                      <th style={th}>Data</th>
                      <th style={th}>Descrição</th>
                      <th style={th}>Categoria</th>
                      <th style={th}>Status</th>
                      <th style={{ ...th, textAlign: 'right' }}>Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movRecentes.map((m: any, i: number) => (
                      <tr key={m.id}>
                        <td style={td}>{fmtData(m.data_movimentacao)}</td>
                        <td style={td}>
                          <strong>{m.descricao}</strong>
                          {m.pacientes?.nome && <div style={{ fontSize: 11, color: '#9ca3af' }}>{m.pacientes.nome}{m.medicos?.nome ? ` · ${m.medicos.nome}` : ''}</div>}
                        </td>
                        <td style={td}>{m.categoria?.nome ? <Pill cor={m.categoria.cor}>{m.categoria.nome}</Pill> : '-'}</td>
                        <td style={td}><PillStatus status={m.status}/></td>
                        <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: m.tipo === 'receita' ? '#16a34a' : '#dc2626' }}>
                          {m.tipo === 'receita' ? '+' : '-'} {fmt(Number(m.valor))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Pacotes ativos */}
            {pacotesAtivos.length > 0 && (
              <div style={{ background: 'white', borderRadius: 14, padding: 22 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <p style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Pacotes ativos</p>
                  <button onClick={() => setTab('pacotes')} style={{ background: 'none', border: 'none', color: '#6043C1', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Gerenciar →</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
                  {pacotesAtivos.map((p: any) => {
                    const pct = p.total_sessoes > 0 ? (p.sessoes_usadas / p.total_sessoes) * 100 : 0
                    return (
                      <div key={p.id} style={{ background: '#fafafa', borderRadius: 12, padding: 16, borderLeft: '3px solid #6043C1' }}>
                        <p style={{ fontSize: 14, fontWeight: 700, margin: '0 0 4px' }}>{p.pacientes?.nome || 'Paciente'}</p>
                        <p style={{ fontSize: 11, color: '#737373', margin: '0 0 10px' }}>{p.descricao}</p>
                        <div style={{ height: 6, background: '#e5e5e5', borderRadius: 100, overflow: 'hidden', marginBottom: 6 }}>
                          <div style={{ height: '100%', background: '#6043C1', borderRadius: 100, width: `${pct}%` }}/>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#737373', marginBottom: 6 }}>
                          <span>{p.sessoes_usadas} de {p.total_sessoes} sessões</span>
                          <span>{Math.round(pct)}%</span>
                        </div>
                        <p style={{ fontSize: 13, fontWeight: 700, color: '#16a34a', margin: 0 }}>{fmt(Number(p.valor_total))}</p>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {tab !== 'visao' && (
          <div style={{ background: 'white', borderRadius: 14, padding: 80, textAlign: 'center' as const }}>
            <p style={{ fontSize: 14, color: '#9ca3af' }}>Em breve no próximo patch.</p>
          </div>
        )}

      </div>
    </AppShell>
  )
}

// --- Helpers ---

function fmt(v: number) {
  return 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtData(s: string) {
  if (!s) return '-'
  const d = new Date(s + 'T00:00:00')
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function ChartFluxo({ data }: { data: { data: string; receita: number; despesa: number }[] }) {
  if (data.length === 0) return <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: 13 }}>Sem dados no período</div>

  const maxVal = Math.max(...data.flatMap(d => [d.receita, d.despesa]), 100)
  const w = 1000
  const h = 200
  const stepX = w / Math.max(data.length - 1, 1)

  const pathReceita = data.map((d, i) => {
    const x = i * stepX
    const y = h - (d.receita / maxVal) * h
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`
  }).join(' ')

  const pathDespesa = data.map((d, i) => {
    const x = i * stepX
    const y = h - (d.despesa / maxVal) * h
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`
  }).join(' ')

  const areaReceita = pathReceita + ` L ${(data.length-1) * stepX} ${h} L 0 ${h} Z`

  return (
    <div>
      <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: 'block' }}>
        <defs>
          <linearGradient id="gradReceita" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#16a34a" stopOpacity="0.2"/>
            <stop offset="100%" stopColor="#16a34a" stopOpacity="0"/>
          </linearGradient>
        </defs>
        <path d={areaReceita} fill="url(#gradReceita)"/>
        <path d={pathReceita} stroke="#16a34a" strokeWidth="2" fill="none"/>
        <path d={pathDespesa} stroke="#dc2626" strokeWidth="2" fill="none" strokeDasharray="4 3"/>
      </svg>
    </div>
  )
}

function KPI({ label, valor, cor, sub, subCor, carregando }: any) {
  if (carregando) {
    return (
      <div style={{ background: 'white', borderRadius: 14, padding: 18 }}>
        <div style={{ height: 11, width: '50%', background: '#f3f4f6', borderRadius: 4, marginBottom: 8 }}/>
        <div style={{ height: 28, width: '70%', background: '#e5e7eb', borderRadius: 4, marginBottom: 6 }}/>
        <div style={{ height: 10, width: '60%', background: '#f3f4f6', borderRadius: 4 }}/>
      </div>
    )
  }
  return (
    <div style={{ background: 'white', borderRadius: 14, padding: 18 }}>
      <p style={{ fontSize: 12, color: '#737373', margin: '0 0 6px' }}>{label}</p>
      <p style={{ fontSize: 26, fontWeight: 700, color: cor, letterSpacing: '-0.02em', margin: '0 0 4px' }}>{valor}</p>
      <p style={{ fontSize: 11, color: subCor || '#9ca3af', margin: 0 }}>{sub}</p>
    </div>
  )
}

function Pill({ children, cor }: { children: React.ReactNode; cor?: string }) {
  return (
    <span style={{
      display: 'inline-flex', padding: '3px 10px', borderRadius: 100,
      fontSize: 11, fontWeight: 600,
      background: cor ? cor + '22' : '#f3f4f6',
      color: cor || '#525252'
    }}>{children}</span>
  )
}

function PillStatus({ status }: { status: string }) {
  const map: Record<string, { bg: string; cor: string; label: string }> = {
    recebido: { bg: '#dcfce7', cor: '#15803d', label: 'Recebido' },
    pago: { bg: '#dcfce7', cor: '#15803d', label: 'Pago' },
    pendente: { bg: '#fef3c7', cor: '#a16207', label: 'Pendente' },
    atrasado: { bg: '#fee2e2', cor: '#b91c1c', label: 'Atrasado' },
    parcial: { bg: '#dbeafe', cor: '#1d4ed8', label: 'Parcial' },
    cancelado: { bg: '#f3f4f6', cor: '#737373', label: 'Cancelado' },
  }
  const s = map[status] || map.pendente
  return <span style={{ display: 'inline-flex', padding: '3px 10px', borderRadius: 100, fontSize: 11, fontWeight: 600, background: s.bg, color: s.cor }}>{s.label}</span>
}

const btnPrimary = { padding: '9px 16px', borderRadius: 9, border: 'none', background: '#6043C1', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 7 } as const
const btnSecondary = { padding: '9px 16px', borderRadius: 9, border: '1px solid #e5e5e5', background: 'white', color: '#404040', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 7 } as const
const th = { textAlign: 'left' as const, padding: '10px 12px', fontSize: 11, fontWeight: 700, color: '#737373', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }
const td = { padding: '12px', borderTop: '1px solid #f5f5f5', color: '#404040' }
