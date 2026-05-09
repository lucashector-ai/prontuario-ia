'use client'

import { useEffect, useState, useMemo, useRef } from 'react'
import * as XLSX from 'xlsx'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { tokens } from '@/lib/design-tokens'

type TabKey = 'visao' | 'movimentacoes' | 'pacotes' | 'cobrancas' | 'comissoes' | 'relatorios' | 'configuracoes'

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

  // Saldos por conta (visao geral)
  const [saldosContas, setSaldosContas] = useState<any[]>([])

  // Movimentacoes (tab completa)
  const [todasMov, setTodasMov] = useState<any[]>([])
  const [carregandoMov, setCarregandoMov] = useState(false)

  // Pacotes (tab completa)
  const [todosPacotes, setTodosPacotes] = useState<any[]>([])
  const [carregandoPac, setCarregandoPac] = useState(false)
  const [filtroPacStatus, setFiltroPacStatus] = useState<'ativo' | 'concluido' | 'cancelado' | 'todos'>('ativo')
  const [modalPacOpen, setModalPacOpen] = useState(false)

  // Comissoes (tab)
  const [comissoesData, setComissoesData] = useState<any[]>([])
  const [carregandoCom, setCarregandoCom] = useState(false)

  // Relatorios (tab)
  const [relatoriosData, setRelatoriosData] = useState<any>(null)
  const [carregandoRel, setCarregandoRel] = useState(false)

  // Cobrancas (tab)
  const [cobrancasData, setCobrancasData] = useState<any[]>([])
  const [carregandoCob, setCarregandoCob] = useState(false)
  const [filtroCobAtraso, setFiltroCobAtraso] = useState<'todos' | '0-7' | '8-30' | '30+'>('todos')

  // Configuracoes (tab)
  const [configSubtab, setConfigSubtab] = useState<'categorias' | 'contas' | 'recorrentes'>('categorias')
  const [todasCategorias, setTodasCategorias] = useState<any[]>([])
  const [modalCatOpen, setModalCatOpen] = useState(false)
  const [editandoCat, setEditandoCat] = useState<any>(null)
  const [recorrentes, setRecorrentes] = useState<any[]>([])
  const [modalRecOpen, setModalRecOpen] = useState(false)
  const [todasContas, setTodasContas] = useState<any[]>([])
  const [modalContaOpen, setModalContaOpen] = useState(false)
  const [editandoConta, setEditandoConta] = useState<any>(null)
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

  useEffect(() => {
    if (tab === 'comissoes' && clinicaId) carregarComissoes()
  }, [tab, clinicaId, periodo])

  useEffect(() => {
    if (tab === 'relatorios' && clinicaId) carregarRelatorios()
  }, [tab, clinicaId, periodo])

  useEffect(() => {
    if (tab === 'cobrancas' && clinicaId) carregarCobrancas()
  }, [tab, clinicaId, filtroCobAtraso])

  useEffect(() => {
    if (tab === 'configuracoes' && clinicaId) {
      carregarTodasCategorias()
      carregarRecorrentes()
      carregarTodasContas()
    }
  }, [tab, clinicaId])

  const carregarCobrancas = async () => {
    if (!clinicaId) return
    setCarregandoCob(true)
    const { data } = await supabase.from('financeiro_movimentacoes')
      .select('*, pacientes:paciente_id(nome, telefone), medicos:medico_id(nome), categoria:categoria_id(nome)')
      .eq('clinica_id', clinicaId)
      .eq('tipo', 'receita')
      .in('status', ['pendente', 'atrasado', 'parcial'])
      .order('data_movimentacao', { ascending: true })
      .limit(200)
    
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)
    const enriched = (data || []).map((m: any) => {
      const dataMov = new Date((m.data_vencimento || m.data_movimentacao) + 'T00:00:00')
      const diasAtraso = Math.floor((hoje.getTime() - dataMov.getTime()) / (1000 * 60 * 60 * 24))
      return { ...m, diasAtraso }
    }).filter((m: any) => {
      if (filtroCobAtraso === 'todos') return true
      if (filtroCobAtraso === '0-7') return m.diasAtraso >= 0 && m.diasAtraso <= 7
      if (filtroCobAtraso === '8-30') return m.diasAtraso >= 8 && m.diasAtraso <= 30
      if (filtroCobAtraso === '30+') return m.diasAtraso > 30
      return true
    })
    setCobrancasData(enriched)
    setCarregandoCob(false)
  }

  const marcarRecebido = async (movId: string) => {
    if (!confirm('Marcar como recebido?')) return
    await supabase.from('financeiro_movimentacoes')
      .update({ status: 'recebido', data_pagamento: new Date().toISOString().substring(0, 10) })
      .eq('id', movId)
    carregarCobrancas()
    carregar()
  }

  const cobrarViaWA = (mov: any) => {
    const tel = mov.pacientes?.telefone?.replace(/\D/g, '')
    if (!tel) { alert('Paciente sem telefone cadastrado'); return }
    const valor = Number(mov.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
    const desc = mov.descricao || 'consulta'
    const msg = `Olá ${mov.pacientes?.nome?.split(' ')[0] || ''}, tudo bem? Identificamos que sua ${desc} (R$ ${valor}) ainda está pendente de pagamento. Você poderia regularizar quando puder? Qualquer dúvida estou à disposição. Obrigado!`
    const url = 'https://wa.me/55' + tel + '?text=' + encodeURIComponent(msg)
    window.open(url, '_blank')
  }

  const carregarTodasCategorias = async () => {
    if (!clinicaId) return
    const { data } = await supabase.from('financeiro_categorias')
      .select('*').eq('clinica_id', clinicaId).order('tipo').order('nome')
    setTodasCategorias(data || [])
  }

  const carregarRecorrentes = async () => {
    if (!clinicaId) return
    const { data } = await supabase.from('financeiro_movimentacoes')
      .select('*, categoria:categoria_id(nome, cor)')
      .eq('clinica_id', clinicaId).eq('recorrente', true)
      .is('recorrencia_origem_id', null)
      .order('criado_em', { ascending: false }).limit(100)
    setRecorrentes(data || [])
  }

  const desativarCategoria = async (cat: any) => {
    if (!confirm('Desativar categoria "' + cat.nome + '"? Movimentações antigas continuam vinculadas.')) return
    await supabase.from('financeiro_categorias').update({ ativo: false }).eq('id', cat.id)
    carregarTodasCategorias()
    carregarListas()
  }

  const carregarTodasContas = async () => {
    if (!clinicaId) return
    const { data } = await supabase.from('financeiro_contas')
      .select('*').eq('clinica_id', clinicaId).order('tipo').order('nome')

    // Calcula saldo atual de cada conta (saldo_inicial + receitas - despesas)
    const ids = (data || []).map((c: any) => c.id)
    if (ids.length === 0) { setTodasContas([]); return }

    const { data: movs } = await supabase.from('financeiro_movimentacoes')
      .select('conta_id, tipo, valor, status')
      .eq('clinica_id', clinicaId)
      .in('conta_id', ids)
      .neq('status', 'cancelado')

    const enriched = (data || []).map((c: any) => {
      const movsConta = (movs || []).filter((m: any) => m.conta_id === c.id)
      const receitas = movsConta.filter((m: any) => m.tipo === 'receita' && (m.status === 'recebido' || m.status === 'pago')).reduce((s: number, m: any) => s + Number(m.valor), 0)
      const despesas = movsConta.filter((m: any) => m.tipo === 'despesa' && (m.status === 'pago')).reduce((s: number, m: any) => s + Number(m.valor), 0)
      const saldo = Number(c.saldo_inicial || 0) + receitas - despesas
      return { ...c, saldoAtual: saldo, totalReceitas: receitas, totalDespesas: despesas }
    })
    setTodasContas(enriched)
  }

  const desativarConta = async (conta: any) => {
    if (!confirm('Desativar conta "' + conta.nome + '"? Movimentações antigas continuam vinculadas.')) return
    await supabase.from('financeiro_contas').update({ ativo: false }).eq('id', conta.id)
    carregarTodasContas()
    carregarListas()
  }

  const carregarRelatorios = async () => {
    if (!clinicaId) return
    setCarregandoRel(true)

    const dias = parseInt(periodo)
    const dataInicio = new Date()
    dataInicio.setDate(dataInicio.getDate() - dias)
    const dataInicioStr = dataInicio.toISOString().substring(0, 10)
    const hoje = new Date().toISOString().substring(0, 10)

    const dataInicioAnterior = new Date()
    dataInicioAnterior.setDate(dataInicioAnterior.getDate() - (dias * 2))
    const dataInicioAntStr = dataInicioAnterior.toISOString().substring(0, 10)

    // Busca medicos pra resolver IDs
    const { data: meds } = await supabase.from('medicos').select('id, nome').eq('clinica_id', clinicaId)
    const medicoIds = (meds || []).map((m: any) => m.id)

    // Busca categorias e movimentacoes do periodo
    const [movR, movAntR, catR, agendR] = await Promise.all([
      supabase.from('financeiro_movimentacoes')
        .select('tipo, valor, status, categoria_id, medico_id')
        .eq('clinica_id', clinicaId)
        .gte('data_movimentacao', dataInicioStr)
        .lte('data_movimentacao', hoje)
        .neq('status', 'cancelado'),
      supabase.from('financeiro_movimentacoes')
        .select('tipo, valor')
        .eq('clinica_id', clinicaId)
        .gte('data_movimentacao', dataInicioAntStr)
        .lt('data_movimentacao', dataInicioStr)
        .neq('status', 'cancelado'),
      supabase.from('financeiro_categorias').select('id, nome, tipo, cor').eq('clinica_id', clinicaId).eq('ativo', true),
      // Procedimentos top: busca via agendamentos vinculados a movimentacoes (simplificacao: agrupa por descricao da mov)
      medicoIds.length > 0
        ? supabase.from('agendamentos').select('procedimento_id, status, procedimentos:procedimento_id(nome, valor)')
            .in('medico_id', medicoIds).eq('status', 'realizado')
            .gte('data_hora', dataInicioStr).lte('data_hora', hoje + 'T23:59:59')
        : Promise.resolve({ data: [] }),
    ])

    const mov = movR.data || []
    const movAnt = movAntR.data || []
    const cats = catR.data || []
    const agend = agendR.data || []

    // 1. DRE
    const receita = mov.filter((m: any) => m.tipo === 'receita').reduce((s: number, m: any) => s + Number(m.valor), 0)
    const despesa = mov.filter((m: any) => m.tipo === 'despesa').reduce((s: number, m: any) => s + Number(m.valor), 0)
    const lucro = receita - despesa
    const margem = receita > 0 ? (lucro / receita) * 100 : 0

    const recAnt = movAnt.filter((m: any) => m.tipo === 'receita').reduce((s: number, m: any) => s + Number(m.valor), 0)
    const despAnt = movAnt.filter((m: any) => m.tipo === 'despesa').reduce((s: number, m: any) => s + Number(m.valor), 0)
    const lucroAnt = recAnt - despAnt
    const pctLucro = lucroAnt !== 0 ? Math.round(((lucro - lucroAnt) / Math.abs(lucroAnt)) * 100) : null

    // 2. Receitas por categoria
    const receitasCat: any = {}
    mov.filter((m: any) => m.tipo === 'receita').forEach((m: any) => {
      const cat = cats.find((c: any) => c.id === m.categoria_id)
      const key = cat?.nome || 'Sem categoria'
      if (!receitasCat[key]) receitasCat[key] = { total: 0, qtd: 0, cor: cat?.cor || tokens.text.tertiary }
      receitasCat[key].total += Number(m.valor)
      receitasCat[key].qtd += 1
    })
    const receitasPorCat = Object.entries(receitasCat).map(([nome, v]: any) => ({ nome, total: v.total, qtd: v.qtd, cor: v.cor }))
      .sort((a: any, b: any) => b.total - a.total)

    // 3. Despesas por categoria
    const despesasCat: any = {}
    mov.filter((m: any) => m.tipo === 'despesa').forEach((m: any) => {
      const cat = cats.find((c: any) => c.id === m.categoria_id)
      const key = cat?.nome || 'Sem categoria'
      if (!despesasCat[key]) despesasCat[key] = { total: 0, qtd: 0, cor: cat?.cor || tokens.text.tertiary }
      despesasCat[key].total += Number(m.valor)
      despesasCat[key].qtd += 1
    })
    const despesasPorCat = Object.entries(despesasCat).map(([nome, v]: any) => ({ nome, total: v.total, qtd: v.qtd, cor: v.cor }))
      .sort((a: any, b: any) => b.total - a.total)

    // 4. Receitas por medico
    const recPorMed: any = {}
    mov.filter((m: any) => m.tipo === 'receita' && m.medico_id).forEach((m: any) => {
      const med = meds?.find((x: any) => x.id === m.medico_id)
      const key = med?.nome || 'Sem médico'
      if (!recPorMed[key]) recPorMed[key] = { total: 0, qtd: 0 }
      recPorMed[key].total += Number(m.valor)
      recPorMed[key].qtd += 1
    })
    const receitasPorMed = Object.entries(recPorMed).map(([nome, v]: any) => ({ nome, total: v.total, qtd: v.qtd }))
      .sort((a: any, b: any) => b.total - a.total)

    // 5. Top procedimentos (via agendamentos realizados)
    const topProc: any = {}
    agend.forEach((a: any) => {
      const proc = a.procedimentos
      if (!proc?.nome) return
      if (!topProc[proc.nome]) topProc[proc.nome] = { qtd: 0, total: 0 }
      topProc[proc.nome].qtd += 1
      topProc[proc.nome].total += Number(proc.valor || 0)
    })
    const topProcedimentos = Object.entries(topProc).map(([nome, v]: any) => ({
      nome, qtd: v.qtd, total: v.total, ticket: v.qtd > 0 ? v.total / v.qtd : 0
    })).sort((a: any, b: any) => b.qtd - a.qtd)

    setRelatoriosData({
      dre: { receita, despesa, lucro, margem, pctLucro },
      receitasPorCat,
      despesasPorCat,
      receitasPorMed,
      topProcedimentos,
      periodo: { inicio: dataInicioStr, fim: hoje, dias }
    })
    setCarregandoRel(false)
  }

  const exportarRelatoriosExcel = () => {
    if (!relatoriosData) return
    const wb = XLSX.utils.book_new()

    // Aba 1: DRE
    const dreData = [
      ['DRE Simplificado'],
      ['Período', `${relatoriosData.periodo.dias} dias`],
      [],
      ['Receita Total', relatoriosData.dre.receita],
      ['Despesa Total', relatoriosData.dre.despesa],
      ['Lucro Líquido', relatoriosData.dre.lucro],
      ['Margem (%)', relatoriosData.dre.margem.toFixed(2)],
    ]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(dreData), 'DRE')

    // Aba 2: Receitas por Categoria
    const recCatData = [['Categoria', 'Quantidade', 'Total (R$)']]
    relatoriosData.receitasPorCat.forEach((r: any) => recCatData.push([r.nome, r.qtd, r.total]))
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(recCatData), 'Receitas por Categoria')

    // Aba 3: Despesas por Categoria
    const despCatData = [['Categoria', 'Quantidade', 'Total (R$)']]
    relatoriosData.despesasPorCat.forEach((r: any) => despCatData.push([r.nome, r.qtd, r.total]))
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(despCatData), 'Despesas por Categoria')

    // Aba 4: Receitas por Medico
    const recMedData = [['Médico', 'Consultas', 'Receita Gerada (R$)']]
    relatoriosData.receitasPorMed.forEach((r: any) => recMedData.push([r.nome, r.qtd, r.total]))
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(recMedData), 'Receitas por Médico')

    // Aba 5: Top Procedimentos
    const procData = [['Procedimento', 'Quantidade', 'Receita (R$)', 'Ticket Médio (R$)']]
    relatoriosData.topProcedimentos.forEach((p: any) => procData.push([p.nome, p.qtd, p.total, p.ticket]))
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(procData), 'Top Procedimentos')

    XLSX.writeFile(wb, `relatorios-financeiro-${new Date().toISOString().substring(0, 10)}.xlsx`)
  }

  const carregarComissoes = async () => {
    if (!clinicaId) return
    setCarregandoCom(true)

    const dias = parseInt(periodo)
    const dataInicio = new Date()
    dataInicio.setDate(dataInicio.getDate() - dias)
    const dataInicioStr = dataInicio.toISOString().substring(0, 10)
    const hoje = new Date().toISOString().substring(0, 10)

    // Busca medicos da clinica + configs de comissao + receitas do periodo
    const [medsR, configsR, receitasR] = await Promise.all([
      supabase.from('medicos').select('id, nome').eq('clinica_id', clinicaId).eq('cargo', 'medico').eq('ativo', true).order('nome'),
      supabase.from('financeiro_comissoes_config').select('*').eq('clinica_id', clinicaId).eq('ativo', true),
      supabase.from('financeiro_movimentacoes')
        .select('medico_id, valor, status')
        .eq('clinica_id', clinicaId).eq('tipo', 'receita')
        .gte('data_movimentacao', dataInicioStr).lte('data_movimentacao', hoje)
        .neq('status', 'cancelado'),
    ])

    const meds = medsR.data || []
    const configs = configsR.data || []
    const receitas = receitasR.data || []

    // Conta consultas realizadas (movimentacoes vinculadas a agendamento)
    // Pra simplificar agora, conta por medico_id
    const dados = meds.map((m: any) => {
      const config = configs.find((c: any) => c.medico_id === m.id)
      const recebidas = receitas.filter((r: any) => r.medico_id === m.id && (r.status === 'recebido' || r.status === 'pago'))
      const totalRecebido = recebidas.reduce((s: number, r: any) => s + Number(r.valor), 0)
      const consultas = recebidas.length

      let comissao = 0
      let label = 'Sem configuração'
      if (config) {
        if (config.tipo === 'percentual') {
          comissao = (totalRecebido * Number(config.valor)) / 100
          label = `${config.valor}% sobre receita`
        } else if (config.tipo === 'fixo_consulta') {
          comissao = consultas * Number(config.valor)
          label = `${fmt(Number(config.valor))} por consulta`
        } else if (config.tipo === 'fixo_mensal') {
          comissao = Number(config.valor)
          label = `${fmt(Number(config.valor))} fixo/mês`
        }
      }
      return { medico: m, config, consultas, totalRecebido, comissao, label }
    }).sort((a: any, b: any) => b.comissao - a.comissao)

    setComissoesData(dados)
    setCarregandoCom(false)
  }

  const marcarComissaoPaga = async (medico: any, valor: number, label: string) => {
    if (!clinicaId) return
    if (!confirm(`Confirmar pagamento de ${fmt(valor)} de comissão para ${medico.nome}?`)) return

    // Busca categoria "Comissao"
    const { data: cat } = await supabase.from('financeiro_categorias')
      .select('id').eq('clinica_id', clinicaId).eq('tipo', 'despesa').eq('ativo', true).ilike('nome', '%Comiss%').maybeSingle()

    const { error } = await supabase.from('financeiro_movimentacoes').insert({
      clinica_id: clinicaId,
      tipo: 'despesa',
      valor,
      descricao: `Comissão ${medico.nome} (${label})`,
      data_movimentacao: new Date().toISOString().substring(0, 10),
      categoria_id: cat?.id || null,
      status: 'pago',
      medico_id: medico.id,
      metodo_pagamento: 'pix',
    })

    if (error) { alert('Erro: ' + error.message); return }
    alert('Comissão registrada como paga.')
    carregarComissoes()
    carregar()
  }

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

    // Primeiro busca medicos da clinica
    const { data: meds } = await supabase.from('medicos')
      .select('id, nome').eq('clinica_id', clinicaId).eq('cargo', 'medico').eq('ativo', true).order('nome')

    const medicoIds = (meds || []).map((m: any) => m.id)

    // Depois pacientes filtrados pelos medicos da clinica
    const [catR, contR, pacR] = await Promise.all([
      supabase.from('financeiro_categorias').select('*').eq('clinica_id', clinicaId).eq('ativo', true).order('nome'),
      supabase.from('financeiro_contas').select('*').eq('clinica_id', clinicaId).eq('ativo', true).order('nome'),
      medicoIds.length > 0
        ? supabase.from('pacientes').select('id, nome').in('medico_id', medicoIds).order('nome')
        : Promise.resolve({ data: [] }),
    ])

    setCategorias(catR.data || [])
    setContas(contR.data || [])
    setPacientesLista(pacR.data || [])
    setMedicosLista(meds || [])
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

    // Saldos por conta (somente se tem contas ativas)
    const { data: contasAtivas } = await supabase.from('financeiro_contas')
      .select('*').eq('clinica_id', clinicaId).eq('ativo', true).order('nome')

    if (contasAtivas && contasAtivas.length > 0) {
      const idsContas = contasAtivas.map((c: any) => c.id)
      const { data: movsAll } = await supabase.from('financeiro_movimentacoes')
        .select('conta_id, tipo, valor, status')
        .eq('clinica_id', clinicaId)
        .in('conta_id', idsContas)
        .neq('status', 'cancelado')

      const enriched = contasAtivas.map((c: any) => {
        const movsConta = (movsAll || []).filter((m: any) => m.conta_id === c.id)
        const rec = movsConta.filter((m: any) => m.tipo === 'receita' && (m.status === 'recebido' || m.status === 'pago')).reduce((s: number, m: any) => s + Number(m.valor), 0)
        const desp = movsConta.filter((m: any) => m.tipo === 'despesa' && m.status === 'pago').reduce((s: number, m: any) => s + Number(m.valor), 0)
        return { ...c, saldoAtual: Number(c.saldo_inicial || 0) + rec - desp }
      })
      setSaldosContas(enriched)
    } else {
      setSaldosContas([])
    }

    setCarregando(false)
  }

  const lucro = receita - despesa
  const lucroAnterior = receitaAnterior - despesaAnterior
  const pctReceita = receitaAnterior > 0 ? Math.round(((receita - receitaAnterior) / receitaAnterior) * 100) : null
  const pctDespesa = despesaAnterior > 0 ? Math.round(((despesa - despesaAnterior) / despesaAnterior) * 100) : null
  const pctLucro = lucroAnterior > 0 ? Math.round(((lucro - lucroAnterior) / lucroAnterior) * 100) : null

  return (
      <div style={{ padding: '28px 32px', minHeight: '100%', background: tokens.bg.page }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', margin: '0 0 4px' }}>Financeiro</h1>
            <p style={{ fontSize: 13, color: tokens.text.quaternary, margin: 0 }}>Fluxo de caixa, pacotes e comissões</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setTab('configuracoes')} title="Configurações" style={{ ...btnSecondary, padding: '9px 11px' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
            </button>
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
          {(['visao','movimentacoes','pacotes','cobrancas','comissoes','relatorios'] as TabKey[]).map(k => (
            <button key={k} onClick={() => setTab(k)} style={{
              padding: '8px 16px', borderRadius: 8, border: 'none',
              background: tab === k ? tokens.neutral[900] : 'transparent',
              color: tab === k ? 'white' : tokens.text.muted,
              fontSize: 13, fontWeight: 600, cursor: 'pointer'
            }}>
              {k === 'visao' ? 'Visão geral' : k === 'movimentacoes' ? 'Movimentações' : k === 'pacotes' ? 'Pacotes' : k === 'cobrancas' ? 'Cobranças' : k === 'comissoes' ? 'Comissões' : k === 'relatorios' ? 'Relatórios' : 'Configurações'}
            </button>
          ))}
        </div>

        {/* Periodo */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 4, background: 'white', padding: 4, borderRadius: 9 }}>
            {([['7','7 dias'],['30','30 dias'],['90','3 meses'],['365','12 meses']] as [string,string][]).map(([k, label]) => (
              <button key={k} onClick={() => setPeriodo(k as any)} style={{
                padding: '6px 12px', borderRadius: 7, border: 'none',
                background: periodo === k ? tokens.brand.primaryLight : 'transparent',
                color: periodo === k ? tokens.brand.primary : tokens.text.muted,
                fontSize: 12, fontWeight: 600, cursor: 'pointer'
              }}>{label}</button>
            ))}
          </div>
        </div>

        {tab === 'visao' && (
          <>
            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 16 }}>
              <KPI label="Receita do período" valor={fmt(receita)} cor={tokens.status.success} sub={pctReceita !== null ? `${pctReceita >= 0 ? '+' : ''}${pctReceita}% vs período anterior` : 'sem comparativo'} subCor={pctReceita !== null && pctReceita >= 0 ? tokens.status.success : tokens.status.danger} carregando={carregando}/>
              <KPI label="Despesas do período" valor={fmt(despesa)} cor={tokens.status.danger} sub={pctDespesa !== null ? `${pctDespesa >= 0 ? '+' : ''}${pctDespesa}% vs período anterior` : 'sem comparativo'} subCor={pctDespesa !== null && pctDespesa <= 0 ? tokens.status.success : tokens.status.danger} carregando={carregando}/>
              <KPI label="Lucro líquido" valor={fmt(lucro)} cor={tokens.neutral[900]} sub={pctLucro !== null ? `${pctLucro >= 0 ? '+' : ''}${pctLucro}% vs período anterior` : 'sem comparativo'} subCor={pctLucro !== null && pctLucro >= 0 ? tokens.status.success : tokens.status.danger} carregando={carregando}/>
              <KPI label="Pendente recebimento" valor={fmt(pendente)} cor={tokens.status.warningAlt} sub={`${pendenteCount} ${pendenteCount === 1 ? 'transação' : 'transações'}`} carregando={carregando}/>
            </div>

            {/* Saldo por conta */}
            {saldosContas.length > 0 && (
              <div style={{ background: 'white', borderRadius: 14, padding: 22, marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <div>
                    <p style={{ fontSize: 15, fontWeight: 700, margin: '0 0 2px' }}>Saldo por conta</p>
                    <p style={{ fontSize: 11, color: tokens.text.tertiary, margin: 0 }}>Total: {fmt(saldosContas.reduce((s: number, c: any) => s + c.saldoAtual, 0))}</p>
                  </div>
                  <button onClick={() => setTab('configuracoes')} style={{ background: 'none', border: 'none', color: tokens.brand.primary, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Gerenciar →</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
                  {saldosContas.map((c: any) => (
                    <div key={c.id} style={{ padding: 14, background: tokens.bg.page, borderRadius: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
                      <IconeContaTipo tipo={c.tipo}/>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 11, color: tokens.text.quaternary, margin: 0, overflow: 'hidden' as const, textOverflow: 'ellipsis' as const, whiteSpace: 'nowrap' as const }}>{c.nome}</p>
                        <p style={{ fontSize: 16, fontWeight: 700, color: c.saldoAtual >= 0 ? tokens.neutral[900] : tokens.status.danger, margin: '2px 0 0', letterSpacing: '-0.01em' }}>{fmt(c.saldoAtual)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Chart fluxo */}
            <div style={{ background: 'white', borderRadius: 14, padding: 22, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                <div>
                  <p style={{ fontSize: 15, fontWeight: 700, margin: '0 0 2px' }}>Fluxo de caixa</p>
                  <p style={{ fontSize: 11, color: tokens.text.tertiary, margin: 0 }}>Últimos {periodo} dias</p>
                </div>
                <div style={{ display: 'flex', gap: 14, fontSize: 11 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 8, height: 8, background: tokens.status.success, borderRadius: '50%' }}/>Receitas</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 8, height: 8, background: tokens.status.danger, borderRadius: '50%' }}/>Despesas</span>
                </div>
              </div>
              <ChartFluxo data={serieFluxo}/>
            </div>

            {/* Movimentacoes recentes */}
            <div style={{ background: 'white', borderRadius: 14, padding: 22, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <p style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Últimas movimentações</p>
                <button onClick={() => setTab('movimentacoes')} style={{ background: 'none', border: 'none', color: tokens.brand.primary, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Ver todas →</button>
              </div>
              {movRecentes.length === 0 ? (
                <p style={{ fontSize: 13, color: tokens.text.tertiary, textAlign: 'center', padding: '24px 0' }}>Nenhuma movimentação registrada ainda. Comece adicionando uma receita ou despesa.</p>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: tokens.bg.page }}>
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
                          {m.pacientes?.nome && <div style={{ fontSize: 11, color: tokens.text.tertiary }}>{m.pacientes.nome}{m.medicos?.nome ? ` · ${m.medicos.nome}` : ''}</div>}
                        </td>
                        <td style={td}>{m.categoria?.nome ? <Pill cor={m.categoria.cor}>{m.categoria.nome}</Pill> : '-'}</td>
                        <td style={td}><PillStatus status={m.status}/></td>
                        <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: m.tipo === 'receita' ? tokens.status.success : tokens.status.danger }}>
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
                  <button onClick={() => setTab('pacotes')} style={{ background: 'none', border: 'none', color: tokens.brand.primary, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Gerenciar →</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
                  {pacotesAtivos.map((p: any) => {
                    const pct = p.total_sessoes > 0 ? (p.sessoes_usadas / p.total_sessoes) * 100 : 0
                    return (
                      <div key={p.id} style={{ background: tokens.bg.page, borderRadius: 12, padding: 16, borderLeft: `3px solid ${tokens.brand.primary}` }}>
                        <p style={{ fontSize: 14, fontWeight: 700, margin: '0 0 4px' }}>{p.pacientes?.nome || 'Paciente'}</p>
                        <p style={{ fontSize: 11, color: tokens.text.quaternary, margin: '0 0 10px' }}>{p.descricao}</p>
                        <div style={{ height: 6, background: tokens.neutral[200], borderRadius: 100, overflow: 'hidden', marginBottom: 6 }}>
                          <div style={{ height: '100%', background: tokens.brand.primary, borderRadius: 100, width: `${pct}%` }}/>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: tokens.text.quaternary, marginBottom: 6 }}>
                          <span>{p.sessoes_usadas} de {p.total_sessoes} sessões</span>
                          <span>{Math.round(pct)}%</span>
                        </div>
                        <p style={{ fontSize: 13, fontWeight: 700, color: tokens.status.success, margin: 0 }}>{fmt(Number(p.valor_total))}</p>
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
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={tokens.text.tertiary} strokeWidth="2" style={{ position: 'absolute' as const, left: 12, top: '50%', transform: 'translateY(-50%)' }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input
                  type="text" placeholder="Buscar por descrição, paciente ou médico..."
                  value={filtroBusca} onChange={e => setFiltroBusca(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px 9px 34px', borderRadius: 8, border: `1px solid ${tokens.neutral[200]}`, fontSize: 13, outline: 'none' }}
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
                <div style={{ textAlign: 'center' as const, padding: 40, color: tokens.text.tertiary, fontSize: 13 }}>Carregando...</div>
              ) : movFiltradas.length === 0 ? (
                <div style={{ textAlign: 'center' as const, padding: 60 }}>
                  <p style={{ fontSize: 14, color: tokens.text.muted, margin: '0 0 6px', fontWeight: 600 }}>Nenhuma movimentação encontrada</p>
                  <p style={{ fontSize: 13, color: tokens.text.tertiary, margin: '0 0 16px' }}>Comece adicionando uma receita ou despesa.</p>
                  <button style={btnPrimary} onClick={abrirNovaMov}>+ Nova movimentação</button>
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' as const, fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: tokens.bg.page }}>
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
                          {m.pacientes?.nome && <div style={{ fontSize: 11, color: tokens.text.tertiary }}>{m.pacientes.nome}{m.medicos?.nome ? ` · ${m.medicos.nome}` : ''}</div>}
                        </td>
                        <td style={td}>{m.categoria?.nome ? <Pill cor={m.categoria.cor}>{m.categoria.nome}</Pill> : '-'}</td>
                        <td style={td}>{m.metodo_pagamento ? <span style={{ fontSize: 11, color: tokens.text.muted, textTransform: 'capitalize' as const }}>{m.metodo_pagamento.replace('_', ' ')}</span> : '-'}</td>
                        <td style={td}><PillStatus status={m.status}/></td>
                        <td style={{ ...td, textAlign: 'right' as const, fontWeight: 700, color: m.tipo === 'receita' ? tokens.status.success : tokens.status.danger }}>
                          {m.tipo === 'receita' ? '+' : '-'} {fmt(Number(m.valor))}
                        </td>
                        <td style={td}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={tokens.text.tertiary} strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
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
                    background: filtroPacStatus === k ? tokens.brand.primaryLight : 'transparent',
                    color: filtroPacStatus === k ? tokens.brand.primary : tokens.text.muted,
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
              <div style={{ background: 'white', borderRadius: 14, padding: 60, textAlign: 'center' as const, color: tokens.text.tertiary, fontSize: 13 }}>Carregando...</div>
            ) : todosPacotes.length === 0 ? (
              <div style={{ background: 'white', borderRadius: 14, padding: 60, textAlign: 'center' as const }}>
                <p style={{ fontSize: 14, color: tokens.text.muted, margin: '0 0 6px', fontWeight: 600 }}>Nenhum pacote {filtroPacStatus === 'ativo' ? 'ativo' : filtroPacStatus === 'concluido' ? 'concluído' : 'encontrado'}</p>
                <p style={{ fontSize: 13, color: tokens.text.tertiary, margin: '0 0 16px' }}>Crie pacotes de sessões para fisioterapia, nutrição, psicoterapia.</p>
                <button onClick={() => setModalPacOpen(true)} style={btnPrimary}>+ Novo pacote</button>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>
                {todosPacotes.map((p: any) => {
                  const pct = p.total_sessoes > 0 ? (p.sessoes_usadas / p.total_sessoes) * 100 : 0
                  const statusCor = p.status === 'ativo' ? tokens.status.success : p.status === 'concluido' ? tokens.brand.primary : tokens.text.tertiary
                  return (
                    <div key={p.id} style={{ background: 'white', borderRadius: 14, padding: 22 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                        <div>
                          <p style={{ fontSize: 15, fontWeight: 700, margin: '0 0 4px', letterSpacing: '-0.01em' }}>{p.pacientes?.nome || 'Paciente'}</p>
                          <p style={{ fontSize: 12, color: tokens.text.quaternary, margin: 0 }}>{p.descricao}</p>
                        </div>
                        <span style={{ fontSize: 10, fontWeight: 700, background: statusCor + '22', color: statusCor, padding: '3px 9px', borderRadius: 100, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>{p.status}</span>
                      </div>

                      {/* Progresso */}
                      <div style={{ height: 8, background: tokens.bg.hoverStrong, borderRadius: 100, overflow: 'hidden', marginBottom: 6 }}>
                        <div style={{ height: '100%', background: tokens.brand.primary, borderRadius: 100, width: `${pct}%`, transition: 'width 0.3s' as const }}/>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: tokens.text.muted, marginBottom: 14 }}>
                        <span style={{ fontWeight: 600 }}>{p.sessoes_usadas} de {p.total_sessoes} sessões</span>
                        <span>{Math.round(pct)}%</span>
                      </div>

                      {/* Valores */}
                      <div style={{ borderTop: `1px solid ${tokens.bg.hover}`, paddingTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div>
                          <p style={{ fontSize: 10, color: tokens.text.tertiary, textTransform: 'uppercase' as const, letterSpacing: '0.05em', margin: '0 0 2px' }}>Total</p>
                          <p style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>{fmt(Number(p.valor_total))}</p>
                        </div>
                        <div>
                          <p style={{ fontSize: 10, color: tokens.text.tertiary, textTransform: 'uppercase' as const, letterSpacing: '0.05em', margin: '0 0 2px' }}>Recebido</p>
                          <p style={{ fontSize: 14, fontWeight: 700, color: tokens.status.success, margin: 0 }}>{fmt(Number(p.valor_pago))}</p>
                        </div>
                      </div>

                      {p.status === 'ativo' && p.valor_pago < p.valor_total && (
                        <div style={{ marginTop: 10, padding: '8px 10px', background: tokens.status.warningLightSoft, borderRadius: 8, fontSize: 11, color: tokens.status.warningAmberStrong, fontWeight: 600 }}>
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

        {tab === 'comissoes' && (
          <>
            <div style={{ background: tokens.brand.primaryLight, border: `1px solid ${tokens.brand.primaryAccentLight}`, borderRadius: 12, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={tokens.brand.primary} strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
              <p style={{ fontSize: 13, color: tokens.neutral[700], margin: 0, lineHeight: 1.5 }}>
                Comissões são calculadas com base nas receitas <strong>recebidas</strong> do período.
                Configure tipo e valor em <a href="/admin" style={{ color: tokens.brand.primary, textDecoration: 'underline', fontWeight: 600 }}>Painel admin → Comissões</a>.
              </p>
            </div>

            {carregandoCom ? (
              <div style={{ background: 'white', borderRadius: 14, padding: 60, textAlign: 'center' as const, color: tokens.text.tertiary, fontSize: 13 }}>Carregando...</div>
            ) : comissoesData.length === 0 ? (
              <div style={{ background: 'white', borderRadius: 14, padding: 60, textAlign: 'center' as const }}>
                <p style={{ fontSize: 14, color: tokens.text.muted, fontWeight: 600 }}>Nenhum médico cadastrado</p>
                <p style={{ fontSize: 13, color: tokens.text.tertiary }}>Adicione médicos no Painel admin.</p>
              </div>
            ) : (
              <>
                <div style={{ background: 'white', borderRadius: 14, padding: 22, marginBottom: 14 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' as const, fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: tokens.bg.page }}>
                        <th style={th}>Médico</th>
                        <th style={th}>Configuração</th>
                        <th style={{ ...th, textAlign: 'center' as const }}>Consultas</th>
                        <th style={{ ...th, textAlign: 'right' as const }}>Receita gerada</th>
                        <th style={{ ...th, textAlign: 'right' as const }}>Comissão</th>
                        <th style={th}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {comissoesData.map((d: any) => (
                        <tr key={d.medico.id}>
                          <td style={td}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div style={{ width: 32, height: 32, borderRadius: '50%', background: tokens.brand.primaryLight, color: tokens.brand.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>
                                {d.medico.nome.split(' ').slice(0, 2).map((n: string) => n[0]).join('').toUpperCase()}
                              </div>
                              <strong>{d.medico.nome}</strong>
                            </div>
                          </td>
                          <td style={td}>
                            {d.config ? (
                              <span style={{ fontSize: 12, color: tokens.text.muted }}>{d.label}</span>
                            ) : (
                              <span style={{ fontSize: 11, color: tokens.status.warningAmberStrong, background: tokens.status.warningLightSoft, padding: '3px 9px', borderRadius: 100, fontWeight: 600 }}>Sem configuração</span>
                            )}
                          </td>
                          <td style={{ ...td, textAlign: 'center' as const }}>{d.consultas}</td>
                          <td style={{ ...td, textAlign: 'right' as const, fontWeight: 600 }}>{fmt(d.totalRecebido)}</td>
                          <td style={{ ...td, textAlign: 'right' as const, fontWeight: 700, color: tokens.brand.primary }}>
                            {d.comissao > 0 ? fmt(d.comissao) : '-'}
                          </td>
                          <td style={{ ...td, textAlign: 'right' as const }}>
                            {d.comissao > 0 && d.config && (
                              <button onClick={() => marcarComissaoPaga(d.medico, d.comissao, d.label)} style={{ ...btnSecondary, padding: '5px 10px', fontSize: 11 }}>
                                Marcar pago
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={4} style={{ ...td, fontWeight: 700, fontSize: 13, color: tokens.text.muted, textAlign: 'right' as const, borderTop: `2px solid ${tokens.neutral[200]}` }}>Total a pagar:</td>
                        <td style={{ ...td, fontWeight: 700, fontSize: 16, color: tokens.brand.primary, textAlign: 'right' as const, borderTop: `2px solid ${tokens.neutral[200]}` }}>
                          {fmt(comissoesData.reduce((s: number, d: any) => s + d.comissao, 0))}
                        </td>
                        <td style={{ ...td, borderTop: `2px solid ${tokens.neutral[200]}` }}></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </>
            )}
          </>
        )}

        {tab === 'cobrancas' && (
          <>
            {/* Header com filtros */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' as const }}>
              <div style={{ display: 'flex', gap: 4, background: 'white', padding: 4, borderRadius: 9 }}>
                {([['todos', 'Todos'], ['0-7', 'Vence em 7d'], ['8-30', '8-30 dias atraso'], ['30+', 'Mais de 30d']] as const).map(([k, label]) => (
                  <button key={k} onClick={() => setFiltroCobAtraso(k as any)} style={{
                    padding: '6px 12px', borderRadius: 7, border: 'none',
                    background: filtroCobAtraso === k ? tokens.brand.primaryLight : 'transparent',
                    color: filtroCobAtraso === k ? tokens.brand.primary : tokens.text.muted,
                    fontSize: 12, fontWeight: 600, cursor: 'pointer'
                  }}>{label}</button>
                ))}
              </div>
              <div style={{ marginLeft: 'auto', fontSize: 13, color: tokens.text.muted }}>
                <strong style={{ color: tokens.status.danger }}>{cobrancasData.length}</strong> {cobrancasData.length === 1 ? 'cobrança' : 'cobranças'} · 
                Total: <strong>{fmt(cobrancasData.reduce((s: number, m: any) => s + Number(m.valor), 0))}</strong>
              </div>
            </div>

            {/* Tabela de cobrancas */}
            <div style={{ background: 'white', borderRadius: 14, padding: 22 }}>
              {carregandoCob ? (
                <div style={{ textAlign: 'center' as const, padding: 40, color: tokens.text.tertiary, fontSize: 13 }}>Carregando...</div>
              ) : cobrancasData.length === 0 ? (
                <div style={{ textAlign: 'center' as const, padding: 60 }}>
                  <p style={{ fontSize: 14, color: tokens.text.muted, fontWeight: 600, margin: '0 0 6px' }}>Nenhuma cobrança pendente</p>
                  <p style={{ fontSize: 13, color: tokens.text.tertiary, margin: 0 }}>Tudo em dia!</p>
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' as const, fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: tokens.bg.page }}>
                      <th style={th}>Paciente</th>
                      <th style={th}>Descrição</th>
                      <th style={th}>Vencimento</th>
                      <th style={{ ...th, textAlign: 'center' as const }}>Atraso</th>
                      <th style={{ ...th, textAlign: 'right' as const }}>Valor</th>
                      <th style={{ ...th, textAlign: 'right' as const, width: 240 }}>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cobrancasData.map((m: any) => (
                      <tr key={m.id}>
                        <td style={td}>
                          <strong>{m.pacientes?.nome || 'Sem paciente'}</strong>
                          {m.pacientes?.telefone && <div style={{ fontSize: 11, color: tokens.text.tertiary }}>{m.pacientes.telefone}</div>}
                        </td>
                        <td style={td}>
                          <div>{m.descricao}</div>
                          {m.medicos?.nome && <div style={{ fontSize: 11, color: tokens.text.tertiary }}>{m.medicos.nome}</div>}
                        </td>
                        <td style={td}>{fmtData(m.data_vencimento || m.data_movimentacao)}</td>
                        <td style={{ ...td, textAlign: 'center' as const }}>
                          {m.diasAtraso > 0 ? (
                            <span style={{ fontSize: 11, fontWeight: 700, color: m.diasAtraso > 30 ? tokens.status.danger : tokens.status.warningAmberStrong, background: m.diasAtraso > 30 ? tokens.status.dangerBgAlt : tokens.status.warningLightSoft, padding: '3px 9px', borderRadius: 100 }}>
                              {m.diasAtraso}d
                            </span>
                          ) : (
                            <span style={{ fontSize: 11, color: tokens.text.tertiary }}>{m.diasAtraso === 0 ? 'Hoje' : Math.abs(m.diasAtraso) + 'd'}</span>
                          )}
                        </td>
                        <td style={{ ...td, textAlign: 'right' as const, fontWeight: 700, color: tokens.neutral[900] }}>{fmt(Number(m.valor))}</td>
                        <td style={{ ...td, textAlign: 'right' as const }}>
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                            {m.pacientes?.telefone && (
                              <button onClick={() => cobrarViaWA(m)} title="Cobrar via WhatsApp" style={{
                                padding: '6px 10px', borderRadius: 7, border: 'none', background: tokens.whatsapp.greenLight,
                                color: 'white', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                                display: 'inline-flex', alignItems: 'center', gap: 5
                              }}>
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981z"/></svg>
                                WA
                              </button>
                            )}
                            <button onClick={() => marcarRecebido(m.id)} style={{
                              padding: '6px 10px', borderRadius: 7, border: `1px solid ${tokens.neutral[200]}`, background: 'white',
                              color: tokens.status.successHover, fontSize: 11, fontWeight: 600, cursor: 'pointer'
                            }}>✓ Recebido</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

        {tab === 'configuracoes' && (
          <>
            {/* Subtabs */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 16, background: 'white', padding: 4, borderRadius: 9, width: 'fit-content' }}>
              {([['categorias', 'Categorias'], ['contas', 'Contas'], ['recorrentes', 'Despesas recorrentes']] as const).map(([k, label]) => (
                <button key={k} onClick={() => setConfigSubtab(k as any)} style={{
                  padding: '7px 14px', borderRadius: 7, border: 'none',
                  background: configSubtab === k ? tokens.neutral[900] : 'transparent',
                  color: configSubtab === k ? 'white' : tokens.text.muted,
                  fontSize: 12, fontWeight: 600, cursor: 'pointer'
                }}>{label}</button>
              ))}
            </div>

            {configSubtab === 'categorias' && (
              <div style={{ background: 'white', borderRadius: 14, padding: 22 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div>
                    <p style={{ fontSize: 15, fontWeight: 700, margin: '0 0 2px' }}>Categorias financeiras</p>
                    <p style={{ fontSize: 12, color: tokens.text.quaternary, margin: 0 }}>Personalize as categorias usadas em receitas e despesas</p>
                  </div>
                  <button onClick={() => { setEditandoCat(null); setModalCatOpen(true) }} style={btnPrimary}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Nova categoria
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
                  {(['receita', 'despesa'] as const).map(tipo => {
                    const cats = todasCategorias.filter((c: any) => c.tipo === tipo)
                    return (
                      <div key={tipo}>
                        <p style={{ fontSize: 11, color: tokens.text.tertiary, textTransform: 'uppercase' as const, letterSpacing: '0.06em', fontWeight: 700, marginBottom: 10 }}>
                          {tipo === 'receita' ? '↗ Receitas' : '↙ Despesas'} ({cats.length})
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 6 }}>
                          {cats.map((c: any) => (
                            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: c.ativo ? tokens.bg.page : tokens.bg.hover, borderRadius: 9, opacity: c.ativo ? 1 : 0.5 }}>
                              <span style={{ width: 10, height: 10, borderRadius: '50%', background: c.cor, flexShrink: 0 }}/>
                              <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{c.nome}</span>
                              {c.ativo && (
                                <>
                                  <button onClick={() => { setEditandoCat(c); setModalCatOpen(true) }} title="Editar" style={iconBtn}>
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={tokens.text.muted} strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                  </button>
                                  <button onClick={() => desativarCategoria(c)} title="Desativar" style={iconBtn}>
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={tokens.status.danger} strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                                  </button>
                                </>
                              )}
                              {!c.ativo && <span style={{ fontSize: 10, color: tokens.text.tertiary }}>desativada</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {configSubtab === 'contas' && (
              <div style={{ background: 'white', borderRadius: 14, padding: 22 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div>
                    <p style={{ fontSize: 15, fontWeight: 700, margin: '0 0 2px' }}>Contas bancárias</p>
                    <p style={{ fontSize: 12, color: tokens.text.quaternary, margin: 0 }}>Caixa, bancos e cartões. Saldo de cada um separado.</p>
                  </div>
                  <button onClick={() => { setEditandoConta(null); setModalContaOpen(true) }} style={btnPrimary}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Nova conta
                  </button>
                </div>

                {todasContas.length === 0 ? (
                  <div style={{ textAlign: 'center' as const, padding: 60 }}>
                    <p style={{ fontSize: 14, color: tokens.text.muted, fontWeight: 600, margin: '0 0 6px' }}>Nenhuma conta cadastrada</p>
                    <p style={{ fontSize: 13, color: tokens.text.tertiary, margin: 0 }}>Crie contas para separar caixa, bancos e cartões.</p>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
                    {todasContas.map((c: any) => {
                      const tipoLabel: any = { caixa: 'Caixa', banco: 'Banco', cartao_credito: 'Cartão', outras: 'Outras' }
                      return (
                        <div key={c.id} style={{ background: c.ativo ? tokens.bg.page : tokens.bg.hover, borderRadius: 12, padding: 16, opacity: c.ativo ? 1 : 0.5 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <IconeContaTipo tipo={c.tipo}/>
                              <div>
                                <p style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>{c.nome}</p>
                                <p style={{ fontSize: 11, color: tokens.text.tertiary, margin: 0 }}>{tipoLabel[c.tipo]}</p>
                              </div>
                            </div>
                            {c.ativo && (
                              <div style={{ display: 'flex', gap: 4 }}>
                                <button onClick={() => { setEditandoConta(c); setModalContaOpen(true) }} title="Editar" style={iconBtn}>
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={tokens.text.muted} strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                </button>
                                <button onClick={() => desativarConta(c)} title="Desativar" style={iconBtn}>
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={tokens.status.danger} strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                                </button>
                              </div>
                            )}
                          </div>
                          <div style={{ borderTop: '1px solid #eee', paddingTop: 10, marginTop: 4 }}>
                            <p style={{ fontSize: 10, color: tokens.text.tertiary, textTransform: 'uppercase' as const, letterSpacing: '0.05em', margin: 0, fontWeight: 600 }}>Saldo atual</p>
                            <p style={{ fontSize: 22, fontWeight: 700, color: c.saldoAtual >= 0 ? tokens.neutral[900] : tokens.status.danger, margin: '2px 0 8px', letterSpacing: '-0.02em' }}>{fmt(c.saldoAtual)}</p>
                            <div style={{ display: 'flex', gap: 12, fontSize: 11, color: tokens.text.quaternary }}>
                              <span>↗ <span style={{ color: tokens.status.success, fontWeight: 600 }}>{fmt(c.totalReceitas)}</span></span>
                              <span>↙ <span style={{ color: tokens.status.danger, fontWeight: 600 }}>{fmt(c.totalDespesas)}</span></span>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {configSubtab === 'recorrentes' && (
              <div style={{ background: 'white', borderRadius: 14, padding: 22 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div>
                    <p style={{ fontSize: 15, fontWeight: 700, margin: '0 0 2px' }}>Despesas recorrentes</p>
                    <p style={{ fontSize: 12, color: tokens.text.quaternary, margin: 0 }}>Crie 1 vez e o sistema gera as próximas automaticamente</p>
                  </div>
                  <button onClick={() => setModalRecOpen(true)} style={btnPrimary}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Nova recorrente
                  </button>
                </div>

                {recorrentes.length === 0 ? (
                  <div style={{ textAlign: 'center' as const, padding: 60 }}>
                    <p style={{ fontSize: 14, color: tokens.text.muted, fontWeight: 600, margin: '0 0 6px' }}>Nenhuma despesa recorrente</p>
                    <p style={{ fontSize: 13, color: tokens.text.tertiary, margin: '0 0 16px' }}>Cadastre aluguel, internet, salários e outras despesas mensais.</p>
                    <button onClick={() => setModalRecOpen(true)} style={btnPrimary}>+ Nova recorrente</button>
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' as const, fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: tokens.bg.page }}>
                        <th style={th}>Descrição</th>
                        <th style={th}>Categoria</th>
                        <th style={{ ...th, textAlign: 'right' as const }}>Valor</th>
                        <th style={th}>Início</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recorrentes.map((r: any) => (
                        <tr key={r.id}>
                          <td style={td}><strong>{r.descricao}</strong></td>
                          <td style={td}>{r.categoria?.nome || '-'}</td>
                          <td style={{ ...td, textAlign: 'right' as const, fontWeight: 700, color: tokens.status.danger }}>{fmt(Number(r.valor))}</td>
                          <td style={td}>{fmtData(r.data_movimentacao)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </>
        )}

        {modalContaOpen && clinicaId && (
          <ModalConta
            clinicaId={clinicaId}
            conta={editandoConta}
            onClose={() => { setModalContaOpen(false); setEditandoConta(null) }}
            onSaved={() => {
              setModalContaOpen(false); setEditandoConta(null)
              carregarTodasContas(); carregarListas()
            }}
          />
        )}

        {modalCatOpen && clinicaId && (
          <ModalCategoria
            clinicaId={clinicaId}
            categoria={editandoCat}
            onClose={() => { setModalCatOpen(false); setEditandoCat(null) }}
            onSaved={() => {
              setModalCatOpen(false); setEditandoCat(null)
              carregarTodasCategorias(); carregarListas()
            }}
          />
        )}

        {modalRecOpen && clinicaId && (
          <ModalRecorrente
            clinicaId={clinicaId}
            categorias={todasCategorias.filter((c: any) => c.tipo === 'despesa' && c.ativo)}
            onClose={() => setModalRecOpen(false)}
            onSaved={() => { setModalRecOpen(false); carregarRecorrentes(); carregar() }}
          />
        )}

        {tab === 'relatorios' && (
          <>
            {/* Header com botao exportar tudo */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <p style={{ fontSize: 13, color: tokens.text.quaternary, margin: 0 }}>5 relatórios essenciais — período: últimos {periodo} dias</p>
              <button onClick={exportarRelatoriosExcel} disabled={!relatoriosData} style={btnPrimary}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Exportar Excel (5 abas)
              </button>
            </div>

            {carregandoRel ? (
              <div style={{ background: 'white', borderRadius: 14, padding: 60, textAlign: 'center' as const, color: tokens.text.tertiary, fontSize: 13 }}>Carregando relatórios...</div>
            ) : !relatoriosData ? null : (
              <>
                {/* 1. DRE Simplificado */}
                <div style={{ background: 'white', borderRadius: 14, padding: 22, marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <div>
                      <p style={{ fontSize: 11, color: tokens.text.tertiary, textTransform: 'uppercase' as const, letterSpacing: '0.06em', margin: 0, fontWeight: 700 }}>1. DRE Simplificado</p>
                      <p style={{ fontSize: 16, fontWeight: 700, margin: '4px 0 0', letterSpacing: '-0.01em' }}>Demonstrativo de resultados</p>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
                    <div style={{ padding: 16, background: tokens.bg.page, borderRadius: 10 }}>
                      <p style={{ fontSize: 11, color: tokens.text.quaternary, margin: '0 0 4px' }}>Receita</p>
                      <p style={{ fontSize: 22, fontWeight: 700, color: tokens.status.success, margin: 0, letterSpacing: '-0.02em' }}>{fmt(relatoriosData.dre.receita)}</p>
                    </div>
                    <div style={{ padding: 16, background: tokens.bg.page, borderRadius: 10 }}>
                      <p style={{ fontSize: 11, color: tokens.text.quaternary, margin: '0 0 4px' }}>Despesa</p>
                      <p style={{ fontSize: 22, fontWeight: 700, color: tokens.status.danger, margin: 0, letterSpacing: '-0.02em' }}>{fmt(relatoriosData.dre.despesa)}</p>
                    </div>
                    <div style={{ padding: 16, background: tokens.bg.page, borderRadius: 10 }}>
                      <p style={{ fontSize: 11, color: tokens.text.quaternary, margin: '0 0 4px' }}>Lucro líquido</p>
                      <p style={{ fontSize: 22, fontWeight: 700, color: relatoriosData.dre.lucro >= 0 ? tokens.neutral[900] : tokens.status.danger, margin: 0, letterSpacing: '-0.02em' }}>{fmt(relatoriosData.dre.lucro)}</p>
                      {relatoriosData.dre.pctLucro !== null && (
                        <p style={{ fontSize: 11, color: relatoriosData.dre.pctLucro >= 0 ? tokens.status.success : tokens.status.danger, margin: '4px 0 0', fontWeight: 600 }}>
                          {relatoriosData.dre.pctLucro >= 0 ? '+' : ''}{relatoriosData.dre.pctLucro}% vs período anterior
                        </p>
                      )}
                    </div>
                    <div style={{ padding: 16, background: tokens.brand.primaryLight, borderRadius: 10 }}>
                      <p style={{ fontSize: 11, color: tokens.text.quaternary, margin: '0 0 4px' }}>Margem de lucro</p>
                      <p style={{ fontSize: 22, fontWeight: 700, color: tokens.brand.primary, margin: 0, letterSpacing: '-0.02em' }}>{relatoriosData.dre.margem.toFixed(1)}%</p>
                    </div>
                  </div>
                </div>

                {/* 2. Receitas por Categoria */}
                <div style={{ background: 'white', borderRadius: 14, padding: 22, marginBottom: 14 }}>
                  <p style={{ fontSize: 11, color: tokens.text.tertiary, textTransform: 'uppercase' as const, letterSpacing: '0.06em', margin: 0, fontWeight: 700 }}>2. Receitas por Categoria</p>
                  <p style={{ fontSize: 16, fontWeight: 700, margin: '4px 0 16px', letterSpacing: '-0.01em' }}>De onde vem o dinheiro</p>
                  {relatoriosData.receitasPorCat.length === 0 ? (
                    <p style={{ fontSize: 13, color: tokens.text.tertiary, textAlign: 'center' as const, padding: 20 }}>Sem receitas no período</p>
                  ) : (
                    <BarChart data={relatoriosData.receitasPorCat} total={relatoriosData.dre.receita}/>
                  )}
                </div>

                {/* 3. Receitas por Médico */}
                <div style={{ background: 'white', borderRadius: 14, padding: 22, marginBottom: 14 }}>
                  <p style={{ fontSize: 11, color: tokens.text.tertiary, textTransform: 'uppercase' as const, letterSpacing: '0.06em', margin: 0, fontWeight: 700 }}>3. Receitas por Médico</p>
                  <p style={{ fontSize: 16, fontWeight: 700, margin: '4px 0 16px', letterSpacing: '-0.01em' }}>Performance da equipe</p>
                  {relatoriosData.receitasPorMed.length === 0 ? (
                    <p style={{ fontSize: 13, color: tokens.text.tertiary, textAlign: 'center' as const, padding: 20 }}>Sem receitas vinculadas a médicos no período</p>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' as const, fontSize: 13 }}>
                      <thead>
                        <tr style={{ background: tokens.bg.page }}>
                          <th style={th}>Médico</th>
                          <th style={{ ...th, textAlign: 'center' as const }}>Consultas</th>
                          <th style={{ ...th, textAlign: 'right' as const }}>Receita gerada</th>
                          <th style={{ ...th, textAlign: 'right' as const }}>Ticket médio</th>
                        </tr>
                      </thead>
                      <tbody>
                        {relatoriosData.receitasPorMed.map((r: any, i: number) => (
                          <tr key={i}>
                            <td style={td}><strong>{r.nome}</strong></td>
                            <td style={{ ...td, textAlign: 'center' as const }}>{r.qtd}</td>
                            <td style={{ ...td, textAlign: 'right' as const, fontWeight: 700, color: tokens.status.success }}>{fmt(r.total)}</td>
                            <td style={{ ...td, textAlign: 'right' as const, color: tokens.text.muted }}>{fmt(r.qtd > 0 ? r.total / r.qtd : 0)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* 4. Despesas por Categoria */}
                <div style={{ background: 'white', borderRadius: 14, padding: 22, marginBottom: 14 }}>
                  <p style={{ fontSize: 11, color: tokens.text.tertiary, textTransform: 'uppercase' as const, letterSpacing: '0.06em', margin: 0, fontWeight: 700 }}>4. Despesas por Categoria</p>
                  <p style={{ fontSize: 16, fontWeight: 700, margin: '4px 0 16px', letterSpacing: '-0.01em' }}>Pra onde vai o dinheiro</p>
                  {relatoriosData.despesasPorCat.length === 0 ? (
                    <p style={{ fontSize: 13, color: tokens.text.tertiary, textAlign: 'center' as const, padding: 20 }}>Sem despesas no período</p>
                  ) : (
                    <BarChart data={relatoriosData.despesasPorCat} total={relatoriosData.dre.despesa} corBase={tokens.status.danger}/>
                  )}
                </div>

                {/* 5. Top Procedimentos */}
                <div style={{ background: 'white', borderRadius: 14, padding: 22, marginBottom: 14 }}>
                  <p style={{ fontSize: 11, color: tokens.text.tertiary, textTransform: 'uppercase' as const, letterSpacing: '0.06em', margin: 0, fontWeight: 700 }}>5. Top Procedimentos</p>
                  <p style={{ fontSize: 16, fontWeight: 700, margin: '4px 0 16px', letterSpacing: '-0.01em' }}>Mais realizados no período</p>
                  {relatoriosData.topProcedimentos.length === 0 ? (
                    <p style={{ fontSize: 13, color: tokens.text.tertiary, textAlign: 'center' as const, padding: 20 }}>Sem agendamentos com procedimento vinculado realizados no período</p>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' as const, fontSize: 13 }}>
                      <thead>
                        <tr style={{ background: tokens.bg.page }}>
                          <th style={th}>Procedimento</th>
                          <th style={{ ...th, textAlign: 'center' as const }}>Vezes realizado</th>
                          <th style={{ ...th, textAlign: 'right' as const }}>Receita total</th>
                          <th style={{ ...th, textAlign: 'right' as const }}>Ticket médio</th>
                        </tr>
                      </thead>
                      <tbody>
                        {relatoriosData.topProcedimentos.map((p: any, i: number) => (
                          <tr key={i}>
                            <td style={td}><strong>{p.nome}</strong></td>
                            <td style={{ ...td, textAlign: 'center' as const, fontWeight: 700 }}>{p.qtd}</td>
                            <td style={{ ...td, textAlign: 'right' as const, fontWeight: 700, color: tokens.status.success }}>{fmt(p.total)}</td>
                            <td style={{ ...td, textAlign: 'right' as const, color: tokens.text.muted }}>{fmt(p.ticket)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </>
            )}
          </>
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
  if (data.length === 0) return <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: tokens.text.tertiary, fontSize: 13 }}>Sem dados no período</div>

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
            <stop offset="0%" stopColor={tokens.status.success} stopOpacity="0.2"/>
            <stop offset="100%" stopColor={tokens.status.success} stopOpacity="0"/>
          </linearGradient>
        </defs>
        <path d={areaReceita} fill="url(#gradReceita)"/>
        <path d={pathReceita} stroke={tokens.status.success} strokeWidth="2" fill="none"/>
        <path d={pathDespesa} stroke={tokens.status.danger} strokeWidth="2" fill="none" strokeDasharray="4 3"/>
      </svg>
    </div>
  )
}

function KPI({ label, valor, cor, sub, subCor, carregando }: any) {
  if (carregando) {
    return (
      <div style={{ background: 'white', borderRadius: 14, padding: 18 }}>
        <div style={{ height: 11, width: '50%', background: tokens.bg.hoverStrong, borderRadius: 4, marginBottom: 8 }}/>
        <div style={{ height: 28, width: '70%', background: tokens.border.default, borderRadius: 4, marginBottom: 6 }}/>
        <div style={{ height: 10, width: '60%', background: tokens.bg.hoverStrong, borderRadius: 4 }}/>
      </div>
    )
  }
  return (
    <div style={{ background: 'white', borderRadius: 14, padding: 18 }}>
      <p style={{ fontSize: 12, color: tokens.text.quaternary, margin: '0 0 6px' }}>{label}</p>
      <p style={{ fontSize: 26, fontWeight: 700, color: cor, letterSpacing: '-0.02em', margin: '0 0 4px' }}>{valor}</p>
      <p style={{ fontSize: 11, color: subCor || tokens.text.tertiary, margin: 0 }}>{sub}</p>
    </div>
  )
}

function Pill({ children, cor }: { children: React.ReactNode; cor?: string }) {
  return (
    <span style={{
      display: 'inline-flex', padding: '3px 10px', borderRadius: 100,
      fontSize: 11, fontWeight: 600,
      background: cor ? cor + '22' : tokens.bg.hoverStrong,
      color: cor || tokens.text.muted
    }}>{children}</span>
  )
}

function PillStatus({ status }: { status: string }) {
  const map: Record<string, { bg: string; cor: string; label: string }> = {
    recebido: { bg: tokens.status.successBgAlt, cor: tokens.status.successHover, label: 'Recebido' },
    pago: { bg: tokens.status.successBgAlt, cor: tokens.status.successHover, label: 'Pago' },
    pendente: { bg: tokens.status.warningLightSoft, cor: tokens.status.warningAmberStrong, label: 'Pendente' },
    atrasado: { bg: tokens.status.dangerBgAlt, cor: tokens.status.dangerHover, label: 'Atrasado' },
    parcial: { bg: tokens.status.infoLighter, cor: tokens.status.infoDark, label: 'Parcial' },
    cancelado: { bg: tokens.bg.hoverStrong, cor: tokens.text.quaternary, label: 'Cancelado' },
  }
  const s = map[status] || map.pendente
  return <span style={{ display: 'inline-flex', padding: '3px 10px', borderRadius: 100, fontSize: 11, fontWeight: 600, background: s.bg, color: s.cor }}>{s.label}</span>
}

const btnPrimary = { padding: '9px 16px', borderRadius: 9, border: 'none', background: tokens.brand.primary, color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 7 } as const
const btnSecondary = { padding: '9px 16px', borderRadius: 9, border: `1px solid ${tokens.neutral[200]}`, background: 'white', color: tokens.neutral[700], fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 7 } as const
const th = { textAlign: 'left' as const, padding: '10px 12px', fontSize: 11, fontWeight: 700, color: tokens.text.quaternary, textTransform: 'uppercase' as const, letterSpacing: '0.06em' }
const td = { padding: '12px', borderTop: `1px solid ${tokens.bg.hover}`, color: tokens.neutral[700] }
const iconBtn = { background: 'transparent', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' } as const
const selectStyle = { padding: '9px 12px', borderRadius: 8, border: `1px solid ${tokens.neutral[200]}`, fontSize: 13, outline: 'none', background: 'white', cursor: 'pointer' } as const

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
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={tokens.text.quaternary} strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* Tipo */}
        <div style={{ display: 'flex', gap: 4, background: tokens.bg.hover, padding: 4, borderRadius: 9, marginBottom: 16 }}>
          <button onClick={() => setTipo('receita')} style={{ flex: 1, padding: '8px', borderRadius: 7, border: 'none', background: tipo === 'receita' ? 'white' : 'transparent', color: tipo === 'receita' ? tokens.status.success : tokens.text.muted, fontSize: 13, fontWeight: 600, cursor: 'pointer', boxShadow: tipo === 'receita' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none' }}>↗ Receita</button>
          <button onClick={() => setTipo('despesa')} style={{ flex: 1, padding: '8px', borderRadius: 7, border: 'none', background: tipo === 'despesa' ? 'white' : 'transparent', color: tipo === 'despesa' ? tokens.status.danger : tokens.text.muted, fontSize: 13, fontWeight: 600, cursor: 'pointer', boxShadow: tipo === 'despesa' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none' }}>↙ Despesa</button>
        </div>

        {/* Descrição */}
        <FormField label="Descrição *">
          <input type="text" value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Ex: Consulta Maria Silva" style={inputStyle} autoFocus/>
        </FormField>

        {/* Valor */}
        <FormField label="Valor *">
          <div style={{ position: 'relative' as const }}>
            <span style={{ position: 'absolute' as const, left: 12, top: '50%', transform: 'translateY(-50%)', color: tokens.text.tertiary, fontSize: 13 }}>R$</span>
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
        <button onClick={() => setMaisOpcoes(!maisOpcoes)} style={{ background: 'none', border: 'none', color: tokens.brand.primary, fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: '8px 0', marginTop: 8, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
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

        {erro && <div style={{ background: tokens.status.dangerBgAlt, color: tokens.status.dangerHover, padding: '10px 12px', borderRadius: 8, fontSize: 13, marginTop: 8, marginBottom: 8 }}>{erro}</div>}

        <div style={{ display: 'flex', gap: 10, marginTop: 18, justifyContent: editando ? 'space-between' : 'flex-end' }}>
          {editando && status !== 'cancelado' && (
            <button onClick={cancelar} disabled={salvando} style={{ ...btnSecondary, color: tokens.status.danger, borderColor: tokens.status.dangerLight }}>Cancelar movimentação</button>
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
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: tokens.text.muted, marginBottom: 5 }}>{label}</label>
      {children}
    </div>
  )
}

const inputStyle = { width: '100%', padding: '9px 12px', borderRadius: 8, border: `1px solid ${tokens.neutral[200]}`, fontSize: 13, outline: 'none', boxSizing: 'border-box' as const, background: 'white' } as const


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
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={tokens.text.quaternary} strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
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
              <span style={{ position: 'absolute' as const, left: 12, top: '50%', transform: 'translateY(-50%)', color: tokens.text.tertiary, fontSize: 13 }}>R$</span>
              <input type="text" value={valorTotal} onChange={e => setValorTotal(e.target.value.replace(/[^0-9,]/g, ''))} placeholder="0,00" style={{ ...inputStyle, paddingLeft: 38 }}/>
            </div>
          </FormField>
        </div>

        {valorNum > 0 && sessoesNum > 0 && (
          <p style={{ fontSize: 11, color: tokens.brand.primary, margin: '-8px 0 12px', fontWeight: 500 }}>
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
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: tokens.text.muted, marginBottom: 5 }}>Forma de pagamento *</label>
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
              <p style={{ fontSize: 11, color: tokens.brand.primary, margin: '-8px 0 12px', fontWeight: 500 }}>
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
          <p style={{ fontSize: 12, color: tokens.text.quaternary, margin: '0 0 14px', padding: 10, background: tokens.bg.hover, borderRadius: 8 }}>
            ℹ️ A cada sessão realizada, será cobrado {valorNum > 0 && sessoesNum > 0 ? fmt(valorPorSessao) : 'o valor por sessão'}.
          </p>
        )}

        <FormField label="Observações">
          <textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={2} style={{ ...inputStyle, resize: 'vertical' as const, fontFamily: 'inherit' }}/>
        </FormField>

        {erro && <div style={{ background: tokens.status.dangerBgAlt, color: tokens.status.dangerHover, padding: '10px 12px', borderRadius: 8, fontSize: 13, marginTop: 8, marginBottom: 8 }}>{erro}</div>}

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
  background: ativo ? tokens.neutral[900] : tokens.bg.hover,
  color: ativo ? 'white' : tokens.text.muted,
  fontSize: 12, fontWeight: 600 as const, cursor: 'pointer'
})


// ============================================
// COMPONENTE: BarChart simples horizontal
// ============================================

function BarChart({ data, total, corBase = tokens.brand.primary }: { data: any[]; total: number; corBase?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 10 }}>
      {data.map((d: any, i: number) => {
        const pct = total > 0 ? (d.total / total) * 100 : 0
        const cor = d.cor || corBase
        return (
          <div key={i}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: tokens.neutral[700] }}>{d.nome}</span>
              <span style={{ fontSize: 12, color: tokens.text.quaternary, fontWeight: 500 }}>
                <strong style={{ color: tokens.neutral[900] }}>{'R$ ' + d.total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                <span style={{ marginLeft: 8, color: tokens.text.tertiary }}>{d.qtd} {d.qtd === 1 ? 'transação' : 'transações'}</span>
                <span style={{ marginLeft: 8, color: cor, fontWeight: 700 }}>{pct.toFixed(0)}%</span>
              </span>
            </div>
            <div style={{ height: 8, background: tokens.bg.hoverStrong, borderRadius: 100, overflow: 'hidden' }}>
              <div style={{ height: '100%', background: cor, borderRadius: 100, width: pct + '%', transition: 'width 0.4s' as const }}/>
            </div>
          </div>
        )
      })}
    </div>
  )
}


// ============================================
// MODAL: Nova/Editar Categoria
// ============================================

function ModalCategoria({ clinicaId, categoria, onClose, onSaved }: any) {
  const editando = !!categoria
  const [nome, setNome] = useState(categoria?.nome || '')
  const [tipo, setTipo] = useState<'receita' | 'despesa'>(categoria?.tipo || 'receita')
  const [cor, setCor] = useState(categoria?.cor || tokens.brand.primary)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  const cores = [tokens.brand.primary, tokens.status.infoTeal, tokens.status.danger, tokens.status.warningAmber, tokens.neutral.zinc500, tokens.status.infoCyan, tokens.appointment.retorno.dot, tokens.accent.lime, tokens.external.pinkAccent, tokens.text.muted]

  const salvar = async () => {
    setErro('')
    if (!nome.trim()) { setErro('Nome é obrigatório'); return }
    setSalvando(true)
    let res
    if (editando) {
      res = await supabase.from('financeiro_categorias').update({ nome: nome.trim(), tipo, cor }).eq('id', categoria.id)
    } else {
      res = await supabase.from('financeiro_categorias').insert({ clinica_id: clinicaId, nome: nome.trim(), tipo, cor, ativo: true })
    }
    setSalvando(false)
    if (res.error) { setErro('Erro: ' + res.error.message); return }
    onSaved()
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 16, width: '100%', maxWidth: 440, padding: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>{editando ? 'Editar categoria' : 'Nova categoria'}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={tokens.text.quaternary} strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <FormField label="Nome">
          <input type="text" value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Materiais cirúrgicos" style={inputStyle} autoFocus/>
        </FormField>

        <FormField label="Tipo">
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="button" onClick={() => setTipo('receita')} style={{
              flex: 1, padding: '9px', borderRadius: 8, border: 'none',
              background: tipo === 'receita' ? tokens.status.successBgAlt : tokens.bg.hover,
              color: tipo === 'receita' ? tokens.status.successHover : tokens.text.muted,
              fontSize: 12, fontWeight: 600, cursor: 'pointer'
            }}>↗ Receita</button>
            <button type="button" onClick={() => setTipo('despesa')} style={{
              flex: 1, padding: '9px', borderRadius: 8, border: 'none',
              background: tipo === 'despesa' ? tokens.status.dangerBgAlt : tokens.bg.hover,
              color: tipo === 'despesa' ? tokens.status.dangerHover : tokens.text.muted,
              fontSize: 12, fontWeight: 600, cursor: 'pointer'
            }}>↙ Despesa</button>
          </div>
        </FormField>

        <FormField label="Cor">
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const }}>
            {cores.map(c => (
              <button key={c} type="button" onClick={() => setCor(c)} style={{
                width: 32, height: 32, borderRadius: 8, background: c, cursor: 'pointer',
                border: cor === c ? `3px solid ${tokens.neutral[900]}` : '1px solid transparent'
              }}/>
            ))}
          </div>
        </FormField>

        {erro && <div style={{ background: tokens.status.dangerBgAlt, color: tokens.status.dangerHover, padding: '10px 12px', borderRadius: 8, fontSize: 13, marginBottom: 8 }}>{erro}</div>}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
          <button onClick={onClose} disabled={salvando} style={btnSecondary}>Cancelar</button>
          <button onClick={salvar} disabled={salvando} style={btnPrimary}>{salvando ? 'Salvando...' : (editando ? 'Salvar' : 'Criar')}</button>
        </div>
      </div>
    </div>
  )
}


// ============================================
// MODAL: Nova Despesa Recorrente
// ============================================

function ModalRecorrente({ clinicaId, categorias, onClose, onSaved }: any) {
  const [descricao, setDescricao] = useState('')
  const [valor, setValor] = useState('')
  const [categoriaId, setCategoriaId] = useState('')
  const [primeiroVencimento, setPrimeiroVencimento] = useState(new Date().toISOString().substring(0, 10))
  const [meses, setMeses] = useState('12')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  const valorNum = parseFloat(valor.replace(',', '.')) || 0
  const mesesNum = parseInt(meses) || 0
  const totalAcumulado = valorNum * mesesNum

  const salvar = async () => {
    setErro('')
    if (!descricao.trim()) { setErro('Descrição é obrigatória'); return }
    if (valorNum <= 0) { setErro('Valor deve ser maior que zero'); return }
    if (mesesNum < 1 || mesesNum > 60) { setErro('Meses deve ser entre 1 e 60'); return }

    setSalvando(true)

    // Cria primeira movimentacao com flag recorrente
    const { data: origem, error: errOrigem } = await supabase.from('financeiro_movimentacoes').insert({
      clinica_id: clinicaId, tipo: 'despesa', valor: valorNum, descricao: descricao.trim(),
      data_movimentacao: primeiroVencimento, data_vencimento: primeiroVencimento,
      categoria_id: categoriaId || null, status: 'pendente', recorrente: true,
    }).select().single()

    if (errOrigem) { setErro('Erro: ' + errOrigem.message); setSalvando(false); return }

    // Cria N-1 movimentacoes futuras vinculadas a origem
    if (mesesNum > 1) {
      const inserts = []
      const dataInicial = new Date(primeiroVencimento + 'T00:00:00')
      for (let i = 1; i < mesesNum; i++) {
        const dataParcela = new Date(dataInicial)
        dataParcela.setMonth(dataParcela.getMonth() + i)
        inserts.push({
          clinica_id: clinicaId, tipo: 'despesa', valor: valorNum,
          descricao: descricao.trim() + ' (' + (i + 1) + '/' + mesesNum + ')',
          data_movimentacao: dataParcela.toISOString().substring(0, 10),
          data_vencimento: dataParcela.toISOString().substring(0, 10),
          categoria_id: categoriaId || null, status: 'pendente', recorrente: true,
          recorrencia_origem_id: origem.id,
        })
      }
      await supabase.from('financeiro_movimentacoes').insert(inserts)
    }

    setSalvando(false)
    onSaved()
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 16, width: '100%', maxWidth: 480, maxHeight: '90vh', overflow: 'auto' as const, padding: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>Nova despesa recorrente</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={tokens.text.quaternary} strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <p style={{ fontSize: 12, color: tokens.text.quaternary, margin: '-12px 0 18px' }}>Cadastre 1 vez. O sistema gera as próximas N parcelas automaticamente.</p>

        <FormField label="Descrição">
          <input type="text" value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Ex: Aluguel sala 2" style={inputStyle} autoFocus/>
        </FormField>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <FormField label="Valor mensal">
            <div style={{ position: 'relative' as const }}>
              <span style={{ position: 'absolute' as const, left: 12, top: '50%', transform: 'translateY(-50%)', color: tokens.text.tertiary, fontSize: 13 }}>R$</span>
              <input type="text" value={valor} onChange={e => setValor(e.target.value.replace(/[^0-9,]/g, ''))} placeholder="0,00" style={{ ...inputStyle, paddingLeft: 38 }}/>
            </div>
          </FormField>
          <FormField label="Repetir por (meses)">
            <input type="number" min="1" max="60" value={meses} onChange={e => setMeses(e.target.value)} style={inputStyle}/>
          </FormField>
        </div>

        <FormField label="Categoria">
          <select value={categoriaId} onChange={e => setCategoriaId(e.target.value)} style={inputStyle}>
            <option value="">Sem categoria</option>
            {categorias.map((c: any) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </FormField>

        <FormField label="Primeiro vencimento">
          <input type="date" value={primeiroVencimento} onChange={e => setPrimeiroVencimento(e.target.value)} style={inputStyle}/>
        </FormField>

        {valorNum > 0 && mesesNum > 0 && (
          <div style={{ background: tokens.status.warningLightSoft, color: tokens.status.warningText, padding: '10px 12px', borderRadius: 8, fontSize: 12, marginBottom: 12, fontWeight: 500 }}>
            ℹ Total acumulado: <strong>R$ {totalAcumulado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong> em {mesesNum} {mesesNum === 1 ? 'mês' : 'meses'}
          </div>
        )}

        {erro && <div style={{ background: tokens.status.dangerBgAlt, color: tokens.status.dangerHover, padding: '10px 12px', borderRadius: 8, fontSize: 13, marginBottom: 8 }}>{erro}</div>}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
          <button onClick={onClose} disabled={salvando} style={btnSecondary}>Cancelar</button>
          <button onClick={salvar} disabled={salvando} style={btnPrimary}>{salvando ? 'Criando...' : 'Criar recorrente'}</button>
        </div>
      </div>
    </div>
  )
}


// ============================================
// MODAL: Nova/Editar Conta Bancária
// ============================================

function ModalConta({ clinicaId, conta, onClose, onSaved }: any) {
  const editando = !!conta
  const [nome, setNome] = useState(conta?.nome || '')
  const [tipo, setTipo] = useState<'caixa' | 'banco' | 'cartao_credito' | 'outras'>(conta?.tipo || 'banco')
  const [bancoSelecionado, setBancoSelecionado] = useState('')
  const [saldoInicial, setSaldoInicial] = useState(conta?.saldo_inicial ? String(conta.saldo_inicial).replace('.', ',') : '0,00')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  const salvar = async () => {
    setErro('')
    if (!nome.trim()) { setErro('Nome é obrigatório'); return }
    const saldoNum = parseFloat(saldoInicial.replace(',', '.')) || 0
    setSalvando(true)
    let res
    if (editando) {
      res = await supabase.from('financeiro_contas').update({ nome: nome.trim(), tipo, saldo_inicial: saldoNum }).eq('id', conta.id)
    } else {
      res = await supabase.from('financeiro_contas').insert({ clinica_id: clinicaId, nome: nome.trim(), tipo, saldo_inicial: saldoNum, ativo: true })
    }
    setSalvando(false)
    if (res.error) { setErro('Erro: ' + res.error.message); return }
    onSaved()
  }

  const tipos: any[] = [
    { v: 'caixa', l: '💵 Caixa', d: 'Dinheiro físico' },
    { v: 'banco', l: '🏦 Banco', d: 'Conta corrente' },
    { v: 'cartao_credito', l: '💳 Cartão crédito', d: 'Faturas' },
    { v: 'outras', l: '📁 Outras', d: 'Outros tipos' },
  ]

  return (
    <div onClick={onClose} style={{ position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 16, width: '100%', maxWidth: 460, padding: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>{editando ? 'Editar conta' : 'Nova conta'}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={tokens.text.quaternary} strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <FormField label="Tipo">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
            {tipos.map(o => (
              <button key={o.v} type="button" onClick={() => setTipo(o.v)} style={{
                padding: '10px 12px', borderRadius: 8, border: 'none',
                background: tipo === o.v ? tokens.neutral[900] : tokens.bg.hover,
                color: tipo === o.v ? 'white' : tokens.text.muted,
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
                textAlign: 'left' as const
              }}>
                <div>{o.l}</div>
                <div style={{ fontSize: 10, opacity: 0.7, marginTop: 2 }}>{o.d}</div>
              </button>
            ))}
          </div>
        </FormField>

        {(tipo === 'banco' || tipo === 'cartao_credito') && (
          <FormField label={tipo === 'banco' ? 'Banco' : 'Bandeira/Banco emissor'}>
            <select value={bancoSelecionado} onChange={e => {
              const v = e.target.value
              setBancoSelecionado(v)
              if (v && v !== 'Outro' && !nome) setNome(v)
            }} style={inputStyle}>
              <option value="">Selecione...</option>
              {BANCOS_BR.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </FormField>
        )}

        <FormField label="Nome da conta">
          <input type="text" value={nome} onChange={e => setNome(e.target.value)} placeholder={tipo === 'caixa' ? 'Ex: Caixa principal' : tipo === 'banco' ? 'Ex: Itaú Corrente PJ' : tipo === 'cartao_credito' ? 'Ex: Nubank empresarial' : 'Ex: Carteira'} style={inputStyle}/>
        </FormField>

        <FormField label="Saldo inicial">
          <div style={{ position: 'relative' as const }}>
            <span style={{ position: 'absolute' as const, left: 12, top: '50%', transform: 'translateY(-50%)', color: tokens.text.tertiary, fontSize: 13 }}>R$</span>
            <input type="text" value={saldoInicial} onChange={e => setSaldoInicial(e.target.value.replace(/[^0-9,-]/g, ''))} style={{ ...inputStyle, paddingLeft: 38 }}/>
          </div>
          <p style={{ fontSize: 11, color: tokens.text.tertiary, margin: '5px 0 0' }}>Saldo no momento de cadastro. Pode ser negativo (ex: cartão).</p>
        </FormField>

        {erro && <div style={{ background: tokens.status.dangerBgAlt, color: tokens.status.dangerHover, padding: '10px 12px', borderRadius: 8, fontSize: 13, marginBottom: 8 }}>{erro}</div>}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
          <button onClick={onClose} disabled={salvando} style={btnSecondary}>Cancelar</button>
          <button onClick={salvar} disabled={salvando} style={btnPrimary}>{salvando ? 'Salvando...' : (editando ? 'Salvar' : 'Criar')}</button>
        </div>
      </div>
    </div>
  )
}


// ============================================
// COMPONENTE: Icone do tipo de conta
// ============================================

function IconeContaTipo({ tipo }: { tipo: string }) {
  const cor = tipo === 'caixa' ? tokens.status.success : tipo === 'banco' ? tokens.status.infoCyan : tipo === 'cartao_credito' ? tokens.brand.primary : tokens.text.quaternary
  const bg = tipo === 'caixa' ? tokens.status.successBgAlt : tipo === 'banco' ? tokens.status.infoCyanBg : tipo === 'cartao_credito' ? tokens.brand.primaryLight : tokens.bg.hoverStrong

  let svg = null
  if (tipo === 'caixa') {
    svg = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={cor} strokeWidth="2"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M6 12h.01M18 12h.01"/></svg>
  } else if (tipo === 'banco') {
    svg = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={cor} strokeWidth="2"><line x1="3" y1="21" x2="21" y2="21"/><line x1="3" y1="10" x2="21" y2="10"/><polyline points="5 6 12 3 19 6"/><line x1="4" y1="10" x2="4" y2="21"/><line x1="20" y1="10" x2="20" y2="21"/><line x1="8" y1="14" x2="8" y2="17"/><line x1="12" y1="14" x2="12" y2="17"/><line x1="16" y1="14" x2="16" y2="17"/></svg>
  } else if (tipo === 'cartao_credito') {
    svg = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={cor} strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
  } else {
    svg = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={cor} strokeWidth="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
  }

  return (
    <div style={{ width: 36, height: 36, borderRadius: 9, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      {svg}
    </div>
  )
}

// Lista de bancos brasileiros (top 25)
const BANCOS_BR = [
  'Itaú', 'Bradesco', 'Santander', 'Banco do Brasil', 'Caixa Econômica',
  'Nubank', 'Inter', 'C6 Bank', 'BTG Pactual', 'Sicredi', 'Sicoob',
  'Banrisul', 'Original', 'Safra', 'Pan', 'Will Bank', 'Mercado Pago',
  'PicPay', 'Next', 'Neon', 'Modal', 'BRB', 'Daycoval', 'XP Investimentos', 'Outro'
]
