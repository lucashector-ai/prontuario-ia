'use client'

import { useEffect, useState, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

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

  // Movimentacoes (tab completa)
  const [todasMov, setTodasMov] = useState<any[]>([])
  const [carregandoMov, setCarregandoMov] = useState(false)

  // Pacotes (tab completa)
  const [todosPacotes, setTodosPacotes] = useState<any[]>([])
  const [carregandoPac, setCarregandoPac] = useState(false)
  const [filtroPacStatus, setFiltroPacStatus] = useState<'ativo' | 'concluido' | 'cancelado' | 'todos'>('ativo')
  const [modalPacOpen, setModalPacOpen] = useState(false)
  const [filtroBusca, setFiltroBusca] = useState('')
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'receita' | 'despesa'>('todos')
  const [filtroStatus, setFiltroStatus] = useState<string>('todos')

  // Modal nova movimentacao
  const [modalOpen, setModalOpen] = useState(false)
  const [editandoMov, setEditandoMov] = useState<any>(null)
  const [categorias, setCategorias] = useState<any[]>([])
  const [contas, setContas] = useState<any[]>([])
  const [pacientesLista, setPacientesLista] = useState<any[]>([])
  const [medicosLista, setMedicosLista] = useState<any[]>([])

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
    carregarListas()
  }, [clinicaId, periodo])

  useEffect(() => {
    if (tab === 'movimentacoes' && clinicaId) carregarMovimentacoes()
  }, [tab, clinicaId, filtroTipo, filtroStatus])

  useEffect(() => {
    if (tab === 'pacotes' && clinicaId) carregarPacotes()
  }, [tab, clinicaId, filtroPacStatus])

  const carregarPacotes = async () => {
    if (!clinicaId) return
    setCarregandoPac(true)
    let q = supabase.from('financeiro_pacotes')
      .select('*, pacientes:paciente_id(nome), medicos:medico_id(nome)')
      .eq('clinica_id', clinicaId)
      .order('criado_em', { ascending: false })
      .limit(100)
    if (filtroPacStatus !== 'todos') q = q.eq('status', filtroPacStatus)
    const { data } = await q
    setTodosPacotes(data || [])
    setCarregandoPac(false)
  }

  const carregarListas = async () => {
    if (!clinicaId) return
    const [catR, contR, pacR, medR] = await Promise.all([
      supabase.from('financeiro_categorias').select('*').eq('clinica_id', clinicaId).eq('ativo', true).order('nome'),
      supabase.from('financeiro_contas').select('*').eq('clinica_id', clinicaId).eq('ativo', true).order('nome'),
      supabase.from('pacientes').select('id, nome').order('nome'),
      supabase.from('medicos').select('id, nome').eq('clinica_id', clinicaId).eq('cargo', 'medico').eq('ativo', true).order('nome'),
    ])
    setCategorias(catR.data || [])
    setContas(contR.data || [])
    setPacientesLista(pacR.data || [])
    setMedicosLista(medR.data || [])
  }

  const carregarMovimentacoes = async () => {
    if (!clinicaId) return
    setCarregandoMov(true)
    let q = supabase.from('financeiro_movimentacoes')
      .select('*, pacientes:paciente_id(nome), medicos:medico_id(nome), categoria:categoria_id(nome, cor)')
      .eq('clinica_id', clinicaId)
      .order('data_movimentacao', { ascending: false })
      .order('criado_em', { ascending: false })
      .limit(100)
    if (filtroTipo !== 'todos') q = q.eq('tipo', filtroTipo)
    if (filtroStatus !== 'todos') q = q.eq('status', filtroStatus)
    const { data } = await q
    setTodasMov(data || [])
    setCarregandoMov(false)
  }

  const movFiltradas = useMemo(() => {
    if (!filtroBusca) return todasMov
    const q = filtroBusca.toLowerCase()
    return todasMov.filter((m: any) =>
      m.descricao?.toLowerCase().includes(q) ||
      m.pacientes?.nome?.toLowerCase().includes(q) ||
      m.medicos?.nome?.toLowerCase().includes(q)
    )
  }, [todasMov, filtroBusca])

  const abrirNovaMov = () => { setEditandoMov(null); setModalOpen(true) }
  const editarMov = (m: any) => { setEditandoMov(m); setModalOpen(true) }
  const fecharModal = () => { setModalOpen(false); setEditandoMov(null) }

  const onSalvouMov = () => {
    fecharModal()
    carregar()
    carregarMovimentacoes()
  }

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
      <div style={{ padding: '28px 32px', minHeight: '100%', background: '#F5F5F5' }}>

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
            <button style={btnPrimary} onClick={abrirNovaMov}>
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

        {tab === 'movimentacoes' && (
          <>
            {/* Filtros */}
            <div style={{ background: 'white', borderRadius: 14, padding: 14, marginBottom: 16, display: 'flex', gap: 10, flexWrap: 'wrap' as const, alignItems: 'center' }}>
              <div style={{ flex: '1 1 240px', position: 'relative' as const }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" style={{ position: 'absolute' as const, left: 12, top: '50%', transform: 'translateY(-50%)' }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input
                  type="text" placeholder="Buscar por descrição, paciente ou médico..."
                  value={filtroBusca} onChange={e => setFiltroBusca(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px 9px 34px', borderRadius: 8, border: '1px solid #e5e5e5', fontSize: 13, outline: 'none' }}
                />
              </div>
              <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value as any)} style={selectStyle}>
                <option value="todos">Todos os tipos</option>
                <option value="receita">Receitas</option>
                <option value="despesa">Despesas</option>
              </select>
              <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)} style={selectStyle}>
                <option value="todos">Todos os status</option>
                <option value="recebido">Recebido</option>
                <option value="pago">Pago</option>
                <option value="pendente">Pendente</option>
                <option value="atrasado">Atrasado</option>
                <option value="parcial">Parcial</option>
                <option value="cancelado">Cancelado</option>
              </select>
            </div>

            {/* Tabela */}
            <div style={{ background: 'white', borderRadius: 14, padding: 22 }}>
              {carregandoMov ? (
                <div style={{ textAlign: 'center' as const, padding: 40, color: '#9ca3af', fontSize: 13 }}>Carregando...</div>
              ) : movFiltradas.length === 0 ? (
                <div style={{ textAlign: 'center' as const, padding: 60 }}>
                  <p style={{ fontSize: 14, color: '#525252', margin: '0 0 6px', fontWeight: 600 }}>Nenhuma movimentação encontrada</p>
                  <p style={{ fontSize: 13, color: '#9ca3af', margin: '0 0 16px' }}>Comece adicionando uma receita ou despesa.</p>
                  <button style={btnPrimary} onClick={abrirNovaMov}>+ Nova movimentação</button>
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' as const, fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#fafafa' }}>
                      <th style={th}>Data</th>
                      <th style={th}>Descrição</th>
                      <th style={th}>Categoria</th>
                      <th style={th}>Pagamento</th>
                      <th style={th}>Status</th>
                      <th style={{ ...th, textAlign: 'right' as const }}>Valor</th>
                      <th style={{ ...th, width: 50 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {movFiltradas.map((m: any) => (
                      <tr key={m.id} style={{ cursor: 'pointer' }} onClick={() => editarMov(m)}>
                        <td style={td}>{fmtData(m.data_movimentacao)}</td>
                        <td style={td}>
                          <strong>{m.descricao}</strong>
                          {m.pacientes?.nome && <div style={{ fontSize: 11, color: '#9ca3af' }}>{m.pacientes.nome}{m.medicos?.nome ? ` · ${m.medicos.nome}` : ''}</div>}
                        </td>
                        <td style={td}>{m.categoria?.nome ? <Pill cor={m.categoria.cor}>{m.categoria.nome}</Pill> : '-'}</td>
                        <td style={td}>{m.metodo_pagamento ? <span style={{ fontSize: 11, color: '#525252', textTransform: 'capitalize' as const }}>{m.metodo_pagamento.replace('_', ' ')}</span> : '-'}</td>
                        <td style={td}><PillStatus status={m.status}/></td>
                        <td style={{ ...td, textAlign: 'right' as const, fontWeight: 700, color: m.tipo === 'receita' ? '#16a34a' : '#dc2626' }}>
                          {m.tipo === 'receita' ? '+' : '-'} {fmt(Number(m.valor))}
                        </td>
                        <td style={td}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

        {tab === 'pacotes' && (
          <>
            {/* Filtros + Botao Novo */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' as const }}>
              <div style={{ display: 'flex', gap: 4, background: 'white', padding: 4, borderRadius: 9 }}>
                {([['ativo', 'Ativos'], ['concluido', 'Concluídos'], ['cancelado', 'Cancelados'], ['todos', 'Todos']] as const).map(([k, label]) => (
                  <button key={k} onClick={() => setFiltroPacStatus(k as any)} style={{
                    padding: '6px 12px', borderRadius: 7, border: 'none',
                    background: filtroPacStatus === k ? '#f0ebff' : 'transparent',
                    color: filtroPacStatus === k ? '#6043C1' : '#525252',
                    fontSize: 12, fontWeight: 600, cursor: 'pointer'
                  }}>{label}</button>
                ))}
              </div>
              <button onClick={() => setModalPacOpen(true)} style={{ ...btnPrimary, marginLeft: 'auto' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Novo pacote
              </button>
            </div>

            {/* Lista pacotes */}
            {carregandoPac ? (
              <div style={{ background: 'white', borderRadius: 14, padding: 60, textAlign: 'center' as const, color: '#9ca3af', fontSize: 13 }}>Carregando...</div>
            ) : todosPacotes.length === 0 ? (
              <div style={{ background: 'white', borderRadius: 14, padding: 60, textAlign: 'center' as const }}>
                <p style={{ fontSize: 14, color: '#525252', margin: '0 0 6px', fontWeight: 600 }}>Nenhum pacote {filtroPacStatus === 'ativo' ? 'ativo' : filtroPacStatus === 'concluido' ? 'concluído' : 'encontrado'}</p>
                <p style={{ fontSize: 13, color: '#9ca3af', margin: '0 0 16px' }}>Crie pacotes de sessões para fisioterapia, nutrição, psicoterapia.</p>
                <button onClick={() => setModalPacOpen(true)} style={btnPrimary}>+ Novo pacote</button>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>
                {todosPacotes.map((p: any) => {
                  const pct = p.total_sessoes > 0 ? (p.sessoes_usadas / p.total_sessoes) * 100 : 0
                  const statusCor = p.status === 'ativo' ? '#16a34a' : p.status === 'concluido' ? '#6043C1' : '#9ca3af'
                  return (
                    <div key={p.id} style={{ background: 'white', borderRadius: 14, padding: 22 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                        <div>
                          <p style={{ fontSize: 15, fontWeight: 700, margin: '0 0 4px', letterSpacing: '-0.01em' }}>{p.pacientes?.nome || 'Paciente'}</p>
                          <p style={{ fontSize: 12, color: '#737373', margin: 0 }}>{p.descricao}</p>
                        </div>
                        <span style={{ fontSize: 10, fontWeight: 700, background: statusCor + '22', color: statusCor, padding: '3px 9px', borderRadius: 100, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>{p.status}</span>
                      </div>

                      {/* Progresso */}
                      <div style={{ height: 8, background: '#f3f4f6', borderRadius: 100, overflow: 'hidden', marginBottom: 6 }}>
                        <div style={{ height: '100%', background: '#6043C1', borderRadius: 100, width: `${pct}%`, transition: 'width 0.3s' as const }}/>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#525252', marginBottom: 14 }}>
                        <span style={{ fontWeight: 600 }}>{p.sessoes_usadas} de {p.total_sessoes} sessões</span>
                        <span>{Math.round(pct)}%</span>
                      </div>

                      {/* Valores */}
                      <div style={{ borderTop: '1px solid #f5f5f5', paddingTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div>
                          <p style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase' as const, letterSpacing: '0.05em', margin: '0 0 2px' }}>Total</p>
                          <p style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>{fmt(Number(p.valor_total))}</p>
                        </div>
                        <div>
                          <p style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase' as const, letterSpacing: '0.05em', margin: '0 0 2px' }}>Recebido</p>
                          <p style={{ fontSize: 14, fontWeight: 700, color: '#16a34a', margin: 0 }}>{fmt(Number(p.valor_pago))}</p>
                        </div>
                      </div>

                      {p.status === 'ativo' && p.valor_pago < p.valor_total && (
                        <div style={{ marginTop: 10, padding: '8px 10px', background: '#fef3c7', borderRadius: 8, fontSize: 11, color: '#a16207', fontWeight: 600 }}>
                          ⏳ Falta receber {fmt(Number(p.valor_total) - Number(p.valor_pago))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {(tab === 'comissoes' || tab === 'relatorios') && (
          <div style={{ background: 'white', borderRadius: 14, padding: 80, textAlign: 'center' as const }}>
            <p style={{ fontSize: 14, color: '#9ca3af' }}>Em breve no próximo patch.</p>
          </div>
        )}

        {modalPacOpen && (
          <ModalNovoPacote
            clinicaId={clinicaId!}
            pacientes={pacientesLista}
            medicos={medicosLista}
            onClose={() => setModalPacOpen(false)}
            onSaved={() => {
              setModalPacOpen(false)
              carregarPacotes()
              carregar()
            }}
          />
        )}

        {modalOpen && (
          <ModalMovimentacao
            clinicaId={clinicaId!}
            mov={editandoMov}
            categorias={categorias}
            contas={contas}
            pacientes={pacientesLista}
            medicos={medicosLista}
            onClose={fecharModal}
            onSaved={onSalvouMov}
          />
        )}

      </div>
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
const selectStyle = { padding: '9px 12px', borderRadius: 8, border: '1px solid #e5e5e5', fontSize: 13, outline: 'none', background: 'white', cursor: 'pointer' } as const

// ============================================
// MODAL: Nova/Editar Movimentacao
// ============================================

function ModalMovimentacao({ clinicaId, mov, categorias, contas, pacientes, medicos, onClose, onSaved }: any) {
  const editando = !!mov
  const [tipo, setTipo] = useState<'receita' | 'despesa'>(mov?.tipo || 'receita')
  const [descricao, setDescricao] = useState(mov?.descricao || '')
  const [valor, setValor] = useState(mov?.valor ? String(mov.valor).replace('.', ',') : '')
  const [data, setData] = useState(mov?.data_movimentacao || new Date().toISOString().substring(0, 10))
  const [categoriaId, setCategoriaId] = useState(mov?.categoria_id || '')
  const [contaId, setContaId] = useState(mov?.conta_id || '')
  const [metodoPag, setMetodoPag] = useState(mov?.metodo_pagamento || '')
  const [status, setStatus] = useState(mov?.status || 'recebido')
  const [pacienteId, setPacienteId] = useState(mov?.paciente_id || '')
  const [medicoId, setMedicoId] = useState(mov?.medico_id || '')
  const [observacoes, setObservacoes] = useState(mov?.observacoes || '')
  const [maisOpcoes, setMaisOpcoes] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  const categoriasFiltradas = categorias.filter((c: any) => c.tipo === tipo)

  const salvar = async () => {
    setErro('')
    if (!descricao.trim()) { setErro('Descrição é obrigatória'); return }
    const valorNum = parseFloat(valor.replace(',', '.'))
    if (isNaN(valorNum) || valorNum <= 0) { setErro('Valor deve ser maior que zero'); return }

    setSalvando(true)
    const payload: any = {
      clinica_id: clinicaId,
      tipo, descricao: descricao.trim(), valor: valorNum,
      data_movimentacao: data,
      categoria_id: categoriaId || null,
      conta_id: contaId || null,
      metodo_pagamento: metodoPag || null,
      status,
      paciente_id: pacienteId || null,
      medico_id: medicoId || null,
      observacoes: observacoes.trim() || null,
    }

    let res
    if (editando) {
      res = await supabase.from('financeiro_movimentacoes').update({ ...payload, atualizado_em: new Date().toISOString() }).eq('id', mov.id)
    } else {
      res = await supabase.from('financeiro_movimentacoes').insert(payload)
    }
    setSalvando(false)
    if (res.error) { setErro('Erro ao salvar: ' + res.error.message); return }
    onSaved()
  }

  const cancelar = async () => {
    if (!confirm('Cancelar essa movimentação? Ela ficará marcada como cancelada mas não será deletada.')) return
    setSalvando(true)
    await supabase.from('financeiro_movimentacoes').update({ status: 'cancelado' }).eq('id', mov.id)
    setSalvando(false)
    onSaved()
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 16, width: '100%', maxWidth: 540, maxHeight: '90vh', overflow: 'auto' as const, padding: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>{editando ? 'Editar movimentação' : 'Nova movimentação'}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#737373" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* Tipo */}
        <div style={{ display: 'flex', gap: 4, background: '#f5f5f5', padding: 4, borderRadius: 9, marginBottom: 16 }}>
          <button onClick={() => setTipo('receita')} style={{ flex: 1, padding: '8px', borderRadius: 7, border: 'none', background: tipo === 'receita' ? 'white' : 'transparent', color: tipo === 'receita' ? '#16a34a' : '#525252', fontSize: 13, fontWeight: 600, cursor: 'pointer', boxShadow: tipo === 'receita' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none' }}>↗ Receita</button>
          <button onClick={() => setTipo('despesa')} style={{ flex: 1, padding: '8px', borderRadius: 7, border: 'none', background: tipo === 'despesa' ? 'white' : 'transparent', color: tipo === 'despesa' ? '#dc2626' : '#525252', fontSize: 13, fontWeight: 600, cursor: 'pointer', boxShadow: tipo === 'despesa' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none' }}>↙ Despesa</button>
        </div>

        {/* Descrição */}
        <FormField label="Descrição *">
          <input type="text" value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Ex: Consulta Maria Silva" style={inputStyle} autoFocus/>
        </FormField>

        {/* Valor */}
        <FormField label="Valor *">
          <div style={{ position: 'relative' as const }}>
            <span style={{ position: 'absolute' as const, left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', fontSize: 13 }}>R$</span>
            <input type="text" value={valor} onChange={e => setValor(e.target.value.replace(/[^0-9,]/g, ''))} placeholder="0,00" style={{ ...inputStyle, paddingLeft: 38 }}/>
          </div>
        </FormField>

        {/* Categoria + Data */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <FormField label="Categoria">
            <select value={categoriaId} onChange={e => setCategoriaId(e.target.value)} style={inputStyle}>
              <option value="">Sem categoria</option>
              {categoriasFiltradas.map((c: any) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </FormField>
          <FormField label="Data">
            <input type="date" value={data} onChange={e => setData(e.target.value)} style={inputStyle}/>
          </FormField>
        </div>

        {/* Mais opcoes */}
        <button onClick={() => setMaisOpcoes(!maisOpcoes)} style={{ background: 'none', border: 'none', color: '#6043C1', fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: '8px 0', marginTop: 8, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
          {maisOpcoes ? '▼' : '▶'} Mais opções
        </button>

        {maisOpcoes && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <FormField label="Forma de pagamento">
                <select value={metodoPag} onChange={e => setMetodoPag(e.target.value)} style={inputStyle}>
                  <option value="">Não informado</option>
                  <option value="pix">PIX</option>
                  <option value="cartao_credito">Cartão de crédito</option>
                  <option value="cartao_debito">Cartão de débito</option>
                  <option value="dinheiro">Dinheiro</option>
                  <option value="transferencia">Transferência</option>
                  <option value="boleto">Boleto</option>
                  <option value="outro">Outro</option>
                </select>
              </FormField>
              <FormField label="Status">
                <select value={status} onChange={e => setStatus(e.target.value)} style={inputStyle}>
                  <option value="recebido">{tipo === 'receita' ? 'Recebido' : 'Pago'}</option>
                  <option value="pendente">Pendente</option>
                  <option value="atrasado">Atrasado</option>
                  <option value="parcial">Parcial</option>
                </select>
              </FormField>
            </div>

            {tipo === 'receita' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <FormField label="Paciente">
                  <select value={pacienteId} onChange={e => setPacienteId(e.target.value)} style={inputStyle}>
                    <option value="">Nenhum</option>
                    {pacientes.map((p: any) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                  </select>
                </FormField>
                <FormField label="Médico">
                  <select value={medicoId} onChange={e => setMedicoId(e.target.value)} style={inputStyle}>
                    <option value="">Nenhum</option>
                    {medicos.map((m: any) => <option key={m.id} value={m.id}>{m.nome}</option>)}
                  </select>
                </FormField>
              </div>
            )}

            <FormField label="Observações">
              <textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical' as const, fontFamily: 'inherit' }}/>
            </FormField>
          </>
        )}

        {erro && <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '10px 12px', borderRadius: 8, fontSize: 13, marginTop: 8, marginBottom: 8 }}>{erro}</div>}

        <div style={{ display: 'flex', gap: 10, marginTop: 18, justifyContent: editando ? 'space-between' : 'flex-end' }}>
          {editando && status !== 'cancelado' && (
            <button onClick={cancelar} disabled={salvando} style={{ ...btnSecondary, color: '#dc2626', borderColor: '#fecaca' }}>Cancelar movimentação</button>
          )}
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} disabled={salvando} style={btnSecondary}>Fechar</button>
            <button onClick={salvar} disabled={salvando} style={btnPrimary}>{salvando ? 'Salvando...' : (editando ? 'Salvar alterações' : 'Adicionar')}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#525252', marginBottom: 5 }}>{label}</label>
      {children}
    </div>
  )
}

const inputStyle = { width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #e5e5e5', fontSize: 13, outline: 'none', boxSizing: 'border-box' as const, background: 'white' } as const


// ============================================
// MODAL: Novo Pacote de Sessoes
// ============================================

function ModalNovoPacote({ clinicaId, pacientes, medicos, onClose, onSaved }: any) {
  const [pacienteId, setPacienteId] = useState('')
  const [medicoId, setMedicoId] = useState('')
  const [descricao, setDescricao] = useState('')
  const [totalSessoes, setTotalSessoes] = useState('10')
  const [valorTotal, setValorTotal] = useState('')
  const [formaPag, setFormaPag] = useState<'a_vista' | 'parcelado' | 'por_sessao'>('a_vista')
  const [parcelas, setParcelas] = useState('3')
  const [primeiroVencimento, setPrimeiroVencimento] = useState(new Date().toISOString().substring(0, 10))
  const [observacoes, setObservacoes] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  const valorNum = parseFloat(valorTotal.replace(',', '.')) || 0
  const sessoesNum = parseInt(totalSessoes) || 0
  const valorPorSessao = sessoesNum > 0 ? valorNum / sessoesNum : 0
  const parcelasNum = parseInt(parcelas) || 1
  const valorParcela = parcelasNum > 0 ? valorNum / parcelasNum : 0

  const salvar = async () => {
    setErro('')
    if (!pacienteId) { setErro('Selecione um paciente'); return }
    if (!descricao.trim()) { setErro('Descrição é obrigatória'); return }
    if (sessoesNum <= 0) { setErro('Total de sessões deve ser maior que zero'); return }
    if (valorNum <= 0) { setErro('Valor deve ser maior que zero'); return }

    setSalvando(true)

    // 1. Cria pacote
    const { data: pacote, error: errP } = await supabase.from('financeiro_pacotes').insert({
      clinica_id: clinicaId,
      paciente_id: pacienteId,
      medico_id: medicoId || null,
      descricao: descricao.trim(),
      total_sessoes: sessoesNum,
      sessoes_usadas: 0,
      valor_total: valorNum,
      valor_pago: formaPag === 'a_vista' ? valorNum : 0,
      forma_pagamento: formaPag,
      parcelas_total: formaPag === 'parcelado' ? parcelasNum : 1,
      observacoes: observacoes.trim() || null,
      status: 'ativo',
    }).select().single()

    if (errP) { setErro('Erro ao criar pacote: ' + errP.message); setSalvando(false); return }

    // 2. Busca categoria "Pacote de sessões" (ou primeira receita)
    const { data: catC } = await supabase.from('financeiro_categorias')
      .select('id').eq('clinica_id', clinicaId).eq('tipo', 'receita').eq('ativo', true).ilike('nome', '%Pacote%').maybeSingle()
    const { data: cats } = await supabase.from('financeiro_categorias')
      .select('id').eq('clinica_id', clinicaId).eq('tipo', 'receita').eq('ativo', true).limit(1)
    const categoriaId = catC?.id || cats?.[0]?.id || null

    const pacNome = pacientes.find((p: any) => p.id === pacienteId)?.nome || ''
    const descBase = `${descricao.trim()} - ${pacNome}`

    // 3. Cria movimentações conforme forma pagamento
    if (formaPag === 'a_vista') {
      // 1 movimentação recebida
      await supabase.from('financeiro_movimentacoes').insert({
        clinica_id: clinicaId,
        tipo: 'receita',
        valor: valorNum,
        descricao: descBase,
        data_movimentacao: primeiroVencimento,
        categoria_id: categoriaId,
        status: 'recebido',
        paciente_id: pacienteId,
        medico_id: medicoId || null,
        pacote_id: pacote.id,
      })
    } else if (formaPag === 'parcelado') {
      // N movimentações pendentes
      const inserts = []
      const dataInicial = new Date(primeiroVencimento + 'T00:00:00')
      for (let i = 0; i < parcelasNum; i++) {
        const dataParcela = new Date(dataInicial)
        dataParcela.setMonth(dataParcela.getMonth() + i)
        inserts.push({
          clinica_id: clinicaId,
          tipo: 'receita',
          valor: valorParcela,
          descricao: `${descBase} (${i + 1}/${parcelasNum})`,
          data_movimentacao: dataParcela.toISOString().substring(0, 10),
          data_vencimento: dataParcela.toISOString().substring(0, 10),
          categoria_id: categoriaId,
          status: 'pendente',
          paciente_id: pacienteId,
          medico_id: medicoId || null,
          pacote_id: pacote.id,
          parcelas_total: parcelasNum,
          parcela_atual: i + 1,
        })
      }
      await supabase.from('financeiro_movimentacoes').insert(inserts)
    }
    // 'por_sessao' não cria movimentação ainda; vai criar a cada consulta realizada

    setSalvando(false)
    onSaved()
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 16, width: '100%', maxWidth: 540, maxHeight: '90vh', overflow: 'auto' as const, padding: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>Novo pacote de sessões</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#737373" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <FormField label="Paciente *">
          <select value={pacienteId} onChange={e => setPacienteId(e.target.value)} style={inputStyle}>
            <option value="">Selecione...</option>
            {pacientes.map((p: any) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
        </FormField>

        <FormField label="Descrição *">
          <input type="text" value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Ex: 10 sessões de fisioterapia" style={inputStyle}/>
        </FormField>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <FormField label="Total de sessões *">
            <input type="number" min="1" value={totalSessoes} onChange={e => setTotalSessoes(e.target.value)} style={inputStyle}/>
          </FormField>
          <FormField label="Valor total *">
            <div style={{ position: 'relative' as const }}>
              <span style={{ position: 'absolute' as const, left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', fontSize: 13 }}>R$</span>
              <input type="text" value={valorTotal} onChange={e => setValorTotal(e.target.value.replace(/[^0-9,]/g, ''))} placeholder="0,00" style={{ ...inputStyle, paddingLeft: 38 }}/>
            </div>
          </FormField>
        </div>

        {valorNum > 0 && sessoesNum > 0 && (
          <p style={{ fontSize: 11, color: '#6043C1', margin: '-8px 0 12px', fontWeight: 500 }}>
            💡 Valor por sessão: {fmt(valorPorSessao)}
          </p>
        )}

        <FormField label="Médico responsável">
          <select value={medicoId} onChange={e => setMedicoId(e.target.value)} style={inputStyle}>
            <option value="">Sem médico específico</option>
            {medicos.map((m: any) => <option key={m.id} value={m.id}>{m.nome}</option>)}
          </select>
        </FormField>

        {/* Forma pagamento */}
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#525252', marginBottom: 5 }}>Forma de pagamento *</label>
        <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
          <button type="button" onClick={() => setFormaPag('a_vista')} style={pillBtn(formaPag === 'a_vista')}>À vista</button>
          <button type="button" onClick={() => setFormaPag('parcelado')} style={pillBtn(formaPag === 'parcelado')}>Parcelado</button>
          <button type="button" onClick={() => setFormaPag('por_sessao')} style={pillBtn(formaPag === 'por_sessao')}>Por sessão</button>
        </div>

        {formaPag === 'parcelado' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
              <FormField label="Número de parcelas">
                <input type="number" min="2" max="24" value={parcelas} onChange={e => setParcelas(e.target.value)} style={inputStyle}/>
              </FormField>
              <FormField label="Primeiro vencimento">
                <input type="date" value={primeiroVencimento} onChange={e => setPrimeiroVencimento(e.target.value)} style={inputStyle}/>
              </FormField>
            </div>
            {valorNum > 0 && parcelasNum > 0 && (
              <p style={{ fontSize: 11, color: '#6043C1', margin: '-8px 0 12px', fontWeight: 500 }}>
                💡 {parcelasNum}x de {fmt(valorParcela)} (mensal)
              </p>
            )}
          </>
        )}

        {formaPag === 'a_vista' && (
          <FormField label="Data do recebimento">
            <input type="date" value={primeiroVencimento} onChange={e => setPrimeiroVencimento(e.target.value)} style={inputStyle}/>
          </FormField>
        )}

        {formaPag === 'por_sessao' && (
          <p style={{ fontSize: 12, color: '#737373', margin: '0 0 14px', padding: 10, background: '#f5f5f5', borderRadius: 8 }}>
            ℹ️ A cada sessão realizada, será cobrado {valorNum > 0 && sessoesNum > 0 ? fmt(valorPorSessao) : 'o valor por sessão'}.
          </p>
        )}

        <FormField label="Observações">
          <textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={2} style={{ ...inputStyle, resize: 'vertical' as const, fontFamily: 'inherit' }}/>
        </FormField>

        {erro && <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '10px 12px', borderRadius: 8, fontSize: 13, marginTop: 8, marginBottom: 8 }}>{erro}</div>}

        <div style={{ display: 'flex', gap: 10, marginTop: 18, justifyContent: 'flex-end' }}>
          <button onClick={onClose} disabled={salvando} style={btnSecondary}>Cancelar</button>
          <button onClick={salvar} disabled={salvando} style={btnPrimary}>{salvando ? 'Criando...' : 'Criar pacote'}</button>
        </div>
      </div>
    </div>
  )
}

const pillBtn = (ativo: boolean) => ({
  flex: 1, padding: '9px', borderRadius: 7, border: 'none',
  background: ativo ? '#0a0a0a' : '#f5f5f5',
  color: ativo ? 'white' : '#525252',
  fontSize: 12, fontWeight: 600 as const, cursor: 'pointer'
})
