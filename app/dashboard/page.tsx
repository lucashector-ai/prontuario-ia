'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { LucideIcon } from 'lucide-react'
import {
  Stethoscope, UserPlus, Video, CircleCheck, Calendar, ChevronDown, ChevronLeft, ChevronRight, History, Download,
  ArrowRight, Check, Plus, ChartColumn, CalendarX, ExternalLink, PieChart,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { tokens } from '@/lib/design-tokens'
import { usePageHeader } from '@/components/shell/header-context'
import { Button, KpiCard, SegmentedControl, Icon, EmptyState } from '@/components/ui'

import { corConvenio, normalizarConvenio } from '@/lib/convenios'
const T = tokens
type Periodo = 'hoje' | 'semana' | 'mes' | 'ano'
type Comparacao = 'anterior' | 'ano_passado'
type Intervalo = { ini: Date; fim: Date }

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const MESES_CURTOS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

// Séries do gráfico (tons de roxo, do mais escuro ao mais claro)
const SERIES = [
  { id: 'presencial', label: 'Presencial', cor: 'oklch(0.45 0.19 285)' },
  { id: 'retorno', label: 'Retorno', cor: 'oklch(0.58 0.18 285)' },
  { id: 'tele', label: 'Teleconsulta', cor: 'oklch(0.72 0.12 285)' },
  { id: 'exame', label: 'Exames', cor: 'oklch(0.85 0.06 285)' },
] as const
type SerieId = typeof SERIES[number]['id']

const ANTERIOR: Record<Periodo, string> = { hoje: 'Dia anterior', semana: 'Semana anterior', mes: 'Mês anterior', ano: 'Ano anterior' }

// Cores dos convênios: fixas por operadora (lib/convenios) — iguais aos selos da lista de pacientes

// ── Datas ────────────────────────────────────────────────────────────────────

function intervaloDe(p: Periodo, ref: Date): Intervalo {
  const d = new Date(ref); d.setHours(0, 0, 0, 0)
  if (p === 'hoje') { const fim = new Date(d); fim.setDate(fim.getDate() + 1); return { ini: d, fim } }
  if (p === 'semana') {
    const ini = new Date(d); ini.setDate(ini.getDate() - ((ini.getDay() + 6) % 7)) // segunda
    const fim = new Date(ini); fim.setDate(fim.getDate() + 7)
    return { ini, fim }
  }
  if (p === 'mes') return { ini: new Date(d.getFullYear(), d.getMonth(), 1), fim: new Date(d.getFullYear(), d.getMonth() + 1, 1) }
  return { ini: new Date(d.getFullYear(), 0, 1), fim: new Date(d.getFullYear() + 1, 0, 1) }
}

function deslocar(p: Periodo, ref: Date, n: number): Date {
  const d = new Date(ref)
  if (p === 'hoje') d.setDate(d.getDate() + n)
  else if (p === 'semana') d.setDate(d.getDate() + 7 * n)
  else if (p === 'mes') d.setMonth(d.getMonth() + n, 1)
  else d.setFullYear(d.getFullYear() + n)
  return d
}

function intervaloComparacao(p: Periodo, ref: Date, c: Comparacao): Intervalo {
  if (c === 'anterior') return intervaloDe(p, deslocar(p, ref, -1))
  const r = new Date(ref); r.setFullYear(r.getFullYear() - 1)
  return intervaloDe(p, r)
}

function rotuloIntervalo(p: Periodo, ref: Date): string {
  const { ini, fim } = intervaloDe(p, ref)
  if (p === 'hoje') return ref.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' }).replace('.', '')
  if (p === 'semana') {
    const ult = new Date(fim); ult.setDate(ult.getDate() - 1)
    const m1 = MESES_CURTOS[ini.getMonth()].toLowerCase(), m2 = MESES_CURTOS[ult.getMonth()].toLowerCase()
    return `${ini.getDate()}${m1 !== m2 ? ' ' + m1 : ''} – ${ult.getDate()} ${m2} ${ult.getFullYear()}`
  }
  if (p === 'mes') return `${MESES[ref.getMonth()]} ${ref.getFullYear()}`
  return String(ref.getFullYear())
}

const iso = (d: Date) => d.toISOString()

function variacao(atual: number, anterior: number): { delta: string; tendencia: 'up' | 'down' | 'flat' } {
  if (atual === anterior) return { delta: '0%', tendencia: 'flat' }
  if (anterior === 0) return { delta: 'novo', tendencia: 'up' }
  const pct = Math.round(((atual - anterior) / anterior) * 100)
  return { delta: `${Math.abs(pct)}%`, tendencia: pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat' }
}

// ── Página ───────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const router = useRouter()
  const [medico, setMedico] = useState<any>(null)
  const [ehAdmin, setEhAdmin] = useState(false)
  const [medicos, setMedicos] = useState<{ id: string; nome: string }[]>([])
  const medicoIds = useMemo(() => medicos.map(m => m.id), [medicos])

  const [periodo, setPeriodo] = useState<Periodo>('mes')
  const [ref, setRef] = useState(() => new Date())
  const [comparacao, setComparacao] = useState<Comparacao>('anterior')
  const [aberto, setAberto] = useState<null | 'data' | 'cmp'>(null)
  const [carregando, setCarregando] = useState(true)
  const [gerandoRelatorio, setGerandoRelatorio] = useState(false)

  const [kpis, setKpis] = useState({ consultas: [0, 0], novos: [0, 0], tele: [0, 0], comparecimento: [null, null] as (number | null)[] })
  const [porMes, setPorMes] = useState<Record<SerieId, number>[]>([])
  const [proximos, setProximos] = useState<any[]>([])
  const [cids, setCids] = useState<{ codigo: string; descricao: string; n: number; antes: number }[]>([])
  const [convenios, setConvenios] = useState<{ label: string; n: number }[]>([])

  usePageHeader('Dashboard', ehAdmin
    ? `Visão geral dos atendimentos da sua clínica · ${medicos.length} médico${medicos.length === 1 ? '' : 's'}`
    : 'Visão geral dos seus atendimentos')

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
        setMedicos(meds || [])
        if (!meds?.length) setCarregando(false)
      })()
    } else {
      const medicoData = JSON.parse(m!)
      setMedico(medicoData)
      setMedicos([{ id: medicoData.id, nome: medicoData.nome }])
    }
  }, [router])

  useEffect(() => {
    if (medico && medicoIds.length > 0) carregarDados()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [medico, medicoIds, periodo, ref, comparacao])

  const carregarDados = async () => {
    setCarregando(true)
    const r = intervaloDe(periodo, ref)
    const p = intervaloComparacao(periodo, ref, comparacao)
    const agora = new Date()
    const ano = { ini: new Date(ref.getFullYear(), 0, 1), fim: new Date(ref.getFullYear() + 1, 0, 1) }

    const contar = (tabela: string, campo: string, i: Intervalo) =>
      supabase.from(tabela).select('*', { count: 'exact', head: true }).in('medico_id', medicoIds).gte(campo, iso(i.ini)).lt(campo, iso(i.fim))
    const agsPassados = (i: Intervalo) =>
      supabase.from('agendamentos').select('status').in('medico_id', medicoIds)
        .gte('data_hora', iso(i.ini)).lt('data_hora', iso(i.fim < agora ? i.fim : agora))

    const [cR, cP, nR, nP, tR, tP, aR, aP, anoR, proxR, cidR, cidP, convR] = await Promise.all([
      contar('consultas', 'criado_em', r), contar('consultas', 'criado_em', p),
      contar('pacientes', 'criado_em', r), contar('pacientes', 'criado_em', p),
      contar('teleconsultas', 'criado_em', r), contar('teleconsultas', 'criado_em', p),
      agsPassados(r), agsPassados(p),
      supabase.from('agendamentos').select('data_hora, tipo, status, meet_link').in('medico_id', medicoIds)
        .gte('data_hora', iso(ano.ini)).lt('data_hora', iso(ano.fim)),
      supabase.from('agendamentos').select('id, data_hora, tipo, status, meet_link, motivo, medico_id, pacientes:paciente_id(nome)')
        .in('medico_id', medicoIds).gte('data_hora', iso(new Date(agora.getTime() - 15 * 60000)))
        .neq('status', 'cancelado').order('data_hora').limit(5),
      supabase.from('consultas').select('cids').in('medico_id', medicoIds).gte('criado_em', iso(r.ini)).lt('criado_em', iso(r.fim)),
      supabase.from('consultas').select('cids').in('medico_id', medicoIds).gte('criado_em', iso(p.ini)).lt('criado_em', iso(p.fim)),
      supabase.from('agendamentos').select('status, pacientes:paciente_id(convenio)').in('medico_id', medicoIds)
        .gte('data_hora', iso(r.ini)).lt('data_hora', iso(r.fim)),
    ])

    const comparecimento = (rows: any[] | null) => {
      const validos = (rows || []).filter(a => a.status !== 'cancelado')
      if (!validos.length) return null
      const faltas = validos.filter(a => a.status === 'agendado').length
      return Math.round((1 - faltas / validos.length) * 100)
    }
    setKpis({
      consultas: [cR.count || 0, cP.count || 0],
      novos: [nR.count || 0, nP.count || 0],
      tele: [tR.count || 0, tP.count || 0],
      comparecimento: [comparecimento(aR.data), comparecimento(aP.data)],
    })

    // Atendimentos por mês (ano da data de referência), empilhados por tipo
    const meses: Record<SerieId, number>[] = Array.from({ length: 12 }, () => ({ presencial: 0, retorno: 0, tele: 0, exame: 0 }))
    ;(anoR.data || []).forEach((a: any) => {
      if (a.status === 'cancelado') return
      const m = new Date(a.data_hora).getMonth()
      const serie: SerieId = a.meet_link ? 'tele' : a.tipo === 'retorno' ? 'retorno' : a.tipo === 'exame' ? 'exame' : 'presencial'
      meses[m][serie]++
    })
    setPorMes(meses)

    setProximos(proxR.data || [])

    const contarCids = (rows: any[] | null) => {
      const mapa: Record<string, { codigo: string; descricao: string; n: number }> = {}
      ;(rows || []).forEach((c: any) => (c.cids || []).forEach((cid: any) => {
        if (!cid?.codigo) return
        mapa[cid.codigo] ??= { codigo: cid.codigo, descricao: cid.descricao || '', n: 0 }
        mapa[cid.codigo].n++
      }))
      return mapa
    }
    const atual = contarCids(cidR.data), antes = contarCids(cidP.data)
    setCids(Object.values(atual).sort((a, b) => b.n - a.n).slice(0, 5).map(c => ({ ...c, antes: antes[c.codigo]?.n || 0 })))

    const conv: Record<string, number> = {}
    ;(convR.data || []).forEach((a: any) => {
      if (a.status === 'cancelado') return
      const nome = normalizarConvenio(a.pacientes?.convenio)
      conv[nome] = (conv[nome] || 0) + 1
    })
    const ordenados = Object.entries(conv).sort((a, b) => b[1] - a[1])
    const top = ordenados.slice(0, 4).map(([label, n]) => ({ label, n }))
    const resto = ordenados.slice(4).reduce((s, [, n]) => s + n, 0)
    setConvenios(resto > 0 ? [...top, { label: 'Outros', n: resto }] : top)

    setCarregando(false)
  }

  const confirmar = async (id: string) => {
    await supabase.from('agendamentos').update({ status: 'confirmado' }).eq('id', id)
    setProximos(prev => prev.map(a => a.id === id ? { ...a, status: 'confirmado' } : a))
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

  if (!medico) return null

  const nomeComparacao = comparacao === 'anterior' ? ANTERIOR[periodo] : 'Ano passado'
  const textoComparacao = 'vs. ' + nomeComparacao.toLowerCase()
  const nomeMedico = (id: string) => medicos.find(m => m.id === id)?.nome

  const vC = variacao(kpis.consultas[0], kpis.consultas[1])
  const vN = variacao(kpis.novos[0], kpis.novos[1])
  const vT = variacao(kpis.tele[0], kpis.tele[1])
  const [comp, compAntes] = kpis.comparecimento
  const vComp = comp === null || compAntes === null
    ? { delta: comp === null ? '—' : 'novo', tendencia: 'flat' as const }
    : { delta: `${Math.abs(comp - compAntes)} p.p.`, tendencia: comp > compAntes ? 'up' as const : comp < compAntes ? 'down' as const : 'flat' as const }

  const semDados = !carregando && porMes.every(m => SERIES.every(s => m[s.id] === 0)) && proximos.length === 0 && cids.length === 0

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Barra de período */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <SegmentedControl<Periodo>
          options={[{ value: 'hoje', label: 'Hoje' }, { value: 'semana', label: 'Semana' }, { value: 'mes', label: 'Mês' }, { value: 'ano', label: 'Ano' }]}
          value={periodo}
          onChange={v => { setPeriodo(v); setRef(new Date()) }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <Popover
            aberto={aberto === 'data'}
            onFechar={() => setAberto(null)}
            gatilho={<BotaoFiltro icon={Calendar} onClick={() => setAberto(aberto === 'data' ? null : 'data')}>{rotuloIntervalo(periodo, ref)}</BotaoFiltro>}
            largura={260}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 4px 10px' }}>
              <PassoBtn icon={ChevronLeft} onClick={() => setRef(deslocar(periodo, ref, -1))} />
              <span style={{ fontSize: 13.5, fontWeight: 700 }}>{rotuloIntervalo(periodo, ref)}</span>
              <PassoBtn icon={ChevronRight} onClick={() => setRef(deslocar(periodo, ref, 1))} />
            </div>
            <div style={{ display: 'flex', gap: 6, paddingTop: 10, borderTop: `1px solid ${T.border.muted}`, flexWrap: 'wrap' }}>
              {[
                { label: periodo === 'hoje' ? 'Hoje' : periodo === 'semana' ? 'Esta semana' : periodo === 'mes' ? 'Este mês' : 'Este ano', fn: () => setRef(new Date()) },
                { label: periodo === 'hoje' ? 'Ontem' : periodo === 'semana' ? 'Semana passada' : periodo === 'mes' ? 'Mês passado' : 'Ano passado', fn: () => setRef(deslocar(periodo, new Date(), -1)) },
              ].map(pr => (
                <button key={pr.label} onClick={() => { pr.fn(); setAberto(null) }} style={chipPreset}>{pr.label}</button>
              ))}
            </div>
          </Popover>

          <span style={{ fontSize: 13, color: '#9A98A5' }}>comparado a</span>

          <Popover
            aberto={aberto === 'cmp'}
            onFechar={() => setAberto(null)}
            gatilho={<BotaoFiltro icon={History} onClick={() => setAberto(aberto === 'cmp' ? null : 'cmp')}>{nomeComparacao}</BotaoFiltro>}
            largura={240}
          >
            {([['anterior', ANTERIOR[periodo]], ['ano_passado', 'Mesmo período do ano passado']] as [Comparacao, string][]).map(([v, l]) => (
              <button key={v} onClick={() => { setComparacao(v); setAberto(null) }} style={itemPopover}
                onMouseEnter={e => e.currentTarget.style.background = T.bg.hover} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <span style={{ flex: 1, fontWeight: comparacao === v ? 600 : 500 }}>{l}</span>
                {comparacao === v && <Check size={15} color={T.brand.primary} />}
              </button>
            ))}
          </Popover>

          <Button icon={Download} onClick={gerarRelatorio} disabled={gerandoRelatorio}>
            {gerandoRelatorio ? 'Gerando…' : 'Relatório mensal'}
          </Button>
        </div>
      </div>

      {/* KPIs — 2 por linha no celular */}
      <style>{`@media (max-width: 759px) {
        .dash-kpis > div { flex: 1 1 calc(50% - 6px) !important; padding: 14px !important; }
        .dash-kpis > div > div:first-child > span:first-child { padding-top: 6px !important; font-size: 12.5px !important; white-space: normal !important; }
        .dash-kpis > div > div:nth-child(2) { font-size: 24px !important; margin-top: 10px !important; }
        .dash-kpis > div > div:nth-child(3) > span:last-child { display: none; }
      }`}</style>
      <div className="dash-kpis" style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        <KpiCard label="Consultas" icon={Stethoscope} cor={T.data.purple} valor={kpis.consultas[0]} {...vC} comparacao={textoComparacao} carregando={carregando} />
        <KpiCard label="Pacientes novos" icon={UserPlus} cor={T.data.pink} valor={kpis.novos[0]} {...vN} comparacao={textoComparacao} carregando={carregando} />
        <KpiCard label="Teleconsultas" icon={Video} cor={T.data.orange} valor={kpis.tele[0]} {...vT} comparacao={textoComparacao} carregando={carregando} />
        <KpiCard label="Comparecimento" icon={CircleCheck} cor={T.data.green} valor={comp === null ? '—' : `${comp}%`} delta={vComp.delta} tendencia={vComp.tendencia} comparacao={textoComparacao} carregando={carregando} />
      </div>

      {/* Atendimentos por mês */}
      <GraficoMeses dados={porMes} ano={ref.getFullYear()} carregando={carregando} vazio={semDados} onAgendar={() => router.push('/agenda?novo=1')} />

      {/* Linha inferior */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: 14 }}>
        <ProximosAgendamentos
          itens={proximos} carregando={carregando} nomeMedico={ehAdmin ? nomeMedico : undefined}
          onVerTodos={() => router.push('/agenda')}
          onAbrir={id => router.push('/agenda?ag=' + id)}
          onConfirmar={confirmar}
          onAgendar={() => router.push('/agenda?novo=1')}
        />
        <CidsFrequentes itens={cids} carregando={carregando} />
        <Convenios itens={convenios} carregando={carregando} />
      </div>
    </div>
  )
}

// ── Peças da barra de filtros ────────────────────────────────────────────────

const chipPreset: React.CSSProperties = {
  padding: '5px 10px', borderRadius: 8, border: `1px solid ${T.border.default}`, background: '#fff',
  fontSize: 12, fontWeight: 500, color: T.text.muted, cursor: 'pointer', fontFamily: 'inherit',
}
const itemPopover: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 10px', borderRadius: 9, border: 'none',
  background: 'transparent', fontSize: 13, color: T.text.strong, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
}

function BotaoFiltro({ icon, children, onClick }: { icon: LucideIcon; children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 8, height: 36, padding: '0 12px', borderRadius: 10, whiteSpace: 'nowrap',
      border: `1px solid ${T.border.default}`, background: T.bg.page, fontSize: 13, fontWeight: 600, color: T.text.strong,
      cursor: 'pointer', fontFamily: 'inherit',
    }}
      onMouseEnter={e => e.currentTarget.style.background = T.bg.hoverStrong}
      onMouseLeave={e => e.currentTarget.style.background = T.bg.page}
    >
      <Icon icon={icon} size={15} color={T.text.secondary} />
      {children}
      <ChevronDown size={14} color={T.text.tertiary} />
    </button>
  )
}

function PassoBtn({ icon, onClick }: { icon: LucideIcon; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ width: 28, height: 28, borderRadius: 8, border: 'none', background: 'transparent', display: 'grid', placeItems: 'center', color: T.text.secondary, cursor: 'pointer' }}
      onMouseEnter={e => e.currentTarget.style.background = T.bg.hover} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
      <Icon icon={icon} size={15} />
    </button>
  )
}

function Popover({ aberto, onFechar, gatilho, children, largura }: {
  aberto: boolean; onFechar: () => void; gatilho: React.ReactNode; children: React.ReactNode; largura: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!aberto) return
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onFechar() }
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onFechar() }
    document.addEventListener('mousedown', h); window.addEventListener('keydown', k)
    return () => { document.removeEventListener('mousedown', h); window.removeEventListener('keydown', k) }
  }, [aberto, onFechar])
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {gatilho}
      {aberto && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: largura, background: '#fff', zIndex: 50,
          border: `1px solid ${T.border.default}`, borderRadius: 14, boxShadow: T.shadow.lg, padding: 8,
        }}>{children}</div>
      )}
    </div>
  )
}

// ── Seções ───────────────────────────────────────────────────────────────────

const secao: React.CSSProperties = { border: `1px solid ${T.border.default}`, borderRadius: 16, padding: 18, display: 'flex', flexDirection: 'column', background: '#fff', minWidth: 0 }
const h2: React.CSSProperties = { margin: 0, fontSize: 16, fontWeight: 700, letterSpacing: '-.01em', color: T.text.primary }

function GraficoMeses({ dados, ano, carregando, vazio, onAgendar }: {
  dados: Record<SerieId, number>[]; ano: number; carregando: boolean; vazio: boolean; onAgendar: () => void
}) {
  const [hover, setHover] = useState<number | null>(null)
  const totais = dados.map(m => SERIES.reduce((s, x) => s + m[x.id], 0))
  const max = Math.max(...totais, 1)
  const mesAtual = new Date().getFullYear() === ano ? new Date().getMonth() : 11
  return (
    <section style={{ ...secao, padding: '18px 18px 14px', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <h2 style={h2}>Atendimentos por mês <span style={{ fontWeight: 500, color: T.text.tertiary, fontSize: 13 }}>· {ano}</span></h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          {SERIES.map(s => (
            <span key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: T.text.secondary }}>
              <span style={{ width: 8, height: 8, borderRadius: 3, background: s.cor }} />{s.label}
            </span>
          ))}
        </div>
      </div>

      {carregando ? (
        <div style={{ height: 220, display: 'flex', alignItems: 'flex-end', gap: 6, paddingBottom: 26 }}>
          {[40, 55, 48, 62, 70, 58, 66, 74, 80, 30, 20, 15].map((h, i) => (
            <div key={i} style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
              <div className="c360-skel" style={{ width: '100%', maxWidth: 36, height: `${h}%`, borderRadius: 8 }} />
            </div>
          ))}
        </div>
      ) : vazio ? (
        <div style={{ minHeight: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed #E4E2EA', borderRadius: 14, padding: '8px 0' }}>
          <div>
            <EmptyState icon={ChartColumn} titulo="Ainda não há atendimentos"
              descricao="Assim que você registrar consultas, a evolução mês a mês aparece aqui."
              acao={<Button size="sm" icon={Plus} onClick={onAgendar}>Agendar primeira consulta</Button>} />
          </div>
        </div>
      ) : (
        <div style={{ height: 220, position: 'relative', display: 'flex', gap: 6 }} onMouseLeave={() => setHover(null)}>
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 27, borderTop: `1px solid ${T.border.default}`, pointerEvents: 'none' }} />
          {dados.map((m, i) => {
            const tot = totais[i]
            const futuro = i > mesAtual
            const on = hover === i && !futuro && tot > 0
            const algumHover = hover !== null
            return (
              <div key={i} onMouseEnter={() => setHover(i)} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, position: 'relative' }}>
                <div style={{ flex: 1, width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', gap: 6, paddingBottom: 1 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, lineHeight: 1, color: on ? T.text.primary : T.text.tertiary }}>{futuro || tot === 0 ? '' : tot}</span>
                  <div style={{
                    width: '100%', maxWidth: 36, height: futuro || tot === 0 ? 6 : `${(tot / max) * 88}%`,
                    display: 'flex', flexDirection: 'column-reverse', borderRadius: 8, overflow: 'hidden', gap: 2,
                    opacity: futuro ? 0.6 : algumHover && !on ? 0.5 : 1, transition: 'opacity .15s, height .4s',
                  }}>
                    {futuro || tot === 0
                      ? <div style={{ height: '100%', background: T.border.default }} />
                      : SERIES.map(s => m[s.id] > 0 && (
                        <div key={s.id} style={{ height: `calc(${(m[s.id] / tot) * 100}% - 2px)`, minHeight: 3, background: s.cor, flexShrink: 0 }} />
                      ))}
                  </div>
                </div>
                <span style={{ fontSize: 12, color: on || i === mesAtual ? T.text.primary : T.text.tertiary, fontWeight: on || i === mesAtual ? 700 : 500 }}>{MESES_CURTOS[i]}</span>
                {on && (
                  <div style={{
                    position: 'absolute', top: 6, zIndex: 3, ...(i < 8 ? { left: 'calc(50% + 28px)' } : { right: 'calc(50% + 28px)' }),
                    background: T.night[800], color: '#fff', borderRadius: 12, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 9,
                    minWidth: 160, boxShadow: '0 12px 28px -8px rgba(28,27,34,.4)', pointerEvents: 'none',
                  }}>
                    <div style={{ fontSize: 11.5, color: T.text.tertiary }}>{MESES[i]} {ano} · {tot} atendimentos</div>
                    {SERIES.map(s => (
                      <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                        <span style={{ width: 8, height: 8, borderRadius: 3, background: s.cor }} />
                        <span style={{ flex: 1, fontSize: 12, color: '#C3C1CC' }}>{s.label}</span>
                        <span style={{ fontSize: 13, fontWeight: 700 }}>{m[s.id]}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

function ProximosAgendamentos({ itens, carregando, nomeMedico, onVerTodos, onAbrir, onConfirmar, onAgendar }: {
  itens: any[]; carregando: boolean; nomeMedico?: (id: string) => string | undefined
  onVerTodos: () => void; onAbrir: (id: string) => void; onConfirmar: (id: string) => void; onAgendar: () => void
}) {
  const [hover, setHover] = useState<number | null>(null)
  const agora = Date.now()
  const TIPO: Record<string, string> = { consulta: 'Consulta', retorno: 'Retorno', exame: 'Exame', urgencia: 'Urgência' }
  const COR: Record<string, string> = { consulta: T.data.purple, retorno: T.data.pink, exame: T.data.green, urgencia: T.status.danger }
  return (
    <section style={{ ...secao, gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <h2 style={h2}>Próximos agendamentos</h2>
        <button onClick={onVerTodos} style={{ display: 'flex', alignItems: 'center', gap: 3, border: 'none', background: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 600, color: T.brand.primary, fontFamily: 'inherit' }}>
          Ver todos<ArrowRight size={13} />
        </button>
      </div>
      {carregando ? [0, 1, 2, 3].map(i => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderTop: i ? `1px solid ${T.border.muted}` : 'none' }}>
          <span className="c360-skel" style={{ width: 40, height: 14, borderRadius: 5 }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span className="c360-skel" style={{ width: '55%', height: 12, borderRadius: 5 }} />
            <span className="c360-skel" style={{ width: '35%', height: 10, borderRadius: 5 }} />
          </div>
          <span className="c360-skel" style={{ width: 70, height: 20, borderRadius: 99 }} />
        </div>
      )) : itens.length === 0 ? (
        <EmptyState icon={CalendarX} titulo="Nenhum agendamento por aqui"
          descricao="Quando pacientes marcarem consultas, elas aparecem nesta lista."
          acao={<Button size="sm" icon={Plus} onClick={onAgendar}>Agendar consulta</Button>} />
      ) : itens.map((a, i) => {
        const dt = new Date(a.data_hora)
        const min = Math.round((dt.getTime() - agora) / 60000)
        const proxima = i === 0 && min <= 60
        const online = !!a.meet_link
        const st = online ? { l: 'Online', c: T.brand.primary, b: '#F1EEFC' }
          : a.status === 'confirmado' ? { l: 'Confirmado', c: T.status.success, b: T.status.successBg }
          : a.status === 'realizado' ? { l: 'Realizado', c: T.text.secondary, b: T.border.muted }
          : { l: 'Aguardando', c: '#8A6A1F', b: '#FBF3DF' }
        const hv = hover === i
        const hojeOuNao = dt.toDateString() === new Date().toDateString()
          ? '' : dt.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }).replace('.', '') + ' · '
        const medicoNome = nomeMedico?.(a.medico_id)
        return (
          <div key={a.id} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
            style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: 10, margin: '0 -10px', borderRadius: 12,
              background: hv || proxima ? (proxima ? T.brand.primarySoftBg : T.bg.page) : 'transparent',
              boxShadow: i > 0 && !hv ? `inset 0 1px 0 ${T.border.muted}` : 'none', transition: 'background .15s',
            }}>
            <div style={{ width: 56, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span className="mono" style={{ fontSize: 12.5, color: proxima ? T.brand.primary : T.text.strong, fontWeight: proxima ? 700 : 500 }}>
                {dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </span>
              {proxima && <span style={{ fontSize: 10.5, fontWeight: 700, color: T.brand.primary, whiteSpace: 'nowrap' }}>{min <= 0 ? 'agora' : `em ${min} min`}</span>}
            </div>
            <span style={{ width: 3, height: 30, borderRadius: 2, flexShrink: 0, background: online ? T.data.orange : COR[a.tipo] || T.data.purple }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.pacientes?.nome || a.motivo || 'Paciente'}</div>
              <div style={{ fontSize: 12, color: T.text.quaternary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {hojeOuNao}{online ? 'Teleconsulta' : TIPO[a.tipo] || 'Consulta'}{medicoNome ? ` · ${medicoNome}` : ''}
              </div>
            </div>
            {hv ? (
              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                {online && <AcaoBtn icon={Video} texto="Entrar" primaria onClick={() => window.open(a.meet_link, '_blank')} />}
                {!online && a.status === 'agendado' && <AcaoBtn icon={Check} texto="Confirmar" sucesso onClick={() => onConfirmar(a.id)} />}
                <AcaoBtn icon={ExternalLink} titulo="Abrir na agenda" onClick={() => onAbrir(a.id)} />
              </div>
            ) : (
              <span style={{ flexShrink: 0, fontSize: 11.5, fontWeight: 600, padding: '3px 9px', borderRadius: 99, color: st.c, background: st.b }}>{st.l}</span>
            )}
          </div>
        )
      })}
    </section>
  )
}

function AcaoBtn({ icon, texto, titulo, onClick, primaria, sucesso }: {
  icon: LucideIcon; texto?: string; titulo?: string; onClick: () => void; primaria?: boolean; sucesso?: boolean
}) {
  const [c, b, bd] = primaria ? ['#fff', T.brand.primary, T.brand.primary] : sucesso ? [T.status.success, T.status.successBg, T.status.successBg] : [T.text.muted, '#fff', T.border.default]
  return (
    <button title={titulo || texto} onClick={onClick} style={{
      height: 30, minWidth: 30, padding: texto ? '0 10px' : 0, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center',
      gap: 6, fontSize: 12, fontWeight: 600, color: c, background: b, border: `1px solid ${bd}`, cursor: 'pointer', fontFamily: 'inherit',
    }}>
      <Icon icon={icon} size={15} />{texto}
    </button>
  )
}

function CidsFrequentes({ itens, carregando }: { itens: { codigo: string; descricao: string; n: number; antes: number }[]; carregando: boolean }) {
  const max = Math.max(...itens.map(c => c.n), 1)
  return (
    <section style={{ ...secao, gap: 16 }}>
      <h2 style={h2}>CIDs mais frequentes</h2>
      {carregando ? [0, 1, 2, 3].map(i => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span className="c360-skel" style={{ width: '70%', height: 12, borderRadius: 5 }} />
          <span className="c360-skel" style={{ height: 8, borderRadius: 99 }} />
        </div>
      )) : itens.length === 0 ? (
        <EmptyState icon={Stethoscope} titulo="Sem diagnósticos registrados" descricao="Os CIDs mais frequentes aparecem depois das primeiras consultas." />
      ) : itens.map((c, i) => {
        const d = c.antes === 0 ? null : Math.round(((c.n - c.antes) / c.antes) * 100)
        return (
          <div key={c.codigo} style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5 }}>
              <span className="mono" style={{ fontSize: 11.5, color: T.text.secondary, background: T.bg.hover, padding: '2px 6px', borderRadius: 6 }}>{c.codigo}</span>
              <span style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: T.text.strong }}>{c.descricao || '—'}</span>
              <span style={{ fontWeight: 700 }}>{c.n}</span>
              {d !== null && d !== 0 && (
                <span style={{ fontSize: 12, fontWeight: 600, color: d > 0 ? T.status.success : T.status.danger }}>{d > 0 ? '+' : ''}{d}%</span>
              )}
            </div>
            <div style={{ height: 8, borderRadius: 99, background: T.border.muted, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${(c.n / max) * 100}%`, borderRadius: 99, background: T.brand.primary, opacity: 1 - i * 0.15, transition: 'width .4s' }} />
            </div>
          </div>
        )
      })}
    </section>
  )
}

function Convenios({ itens, carregando }: { itens: { label: string; n: number }[]; carregando: boolean }) {
  const [hover, setHover] = useState<number | null>(null)
  const total = itens.reduce((s, x) => s + x.n, 0)
  const R = 48, C = 2 * Math.PI * R
  let acumulado = 0
  const fatias = itens.map((it, i) => {
    const frac = total ? it.n / total : 0
    const f = { ...it, cor: corConvenio(it.label === 'Outros' ? 'Outro' : it.label), dash: `${Math.max(frac * C - 3, 0)} ${C}`, off: -acumulado * C, pct: Math.round(frac * 100) }
    acumulado += frac
    return f
  })
  const ativo = hover !== null ? fatias[hover] : null
  return (
    <section style={{ ...secao, gap: 18 }}>
      <h2 style={h2}>Atendimentos por convênio</h2>
      {carregando ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ width: 132, height: 132, borderRadius: '50%', border: '16px solid #F3F2F6', flexShrink: 0 }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[0, 1, 2, 3].map(i => <span key={i} className="c360-skel" style={{ height: 12, borderRadius: 5 }} />)}
          </div>
        </div>
      ) : total === 0 ? (
        <EmptyState icon={PieChart} titulo="Sem atendimentos no período" descricao="A divisão por convênio aparece quando houver consultas agendadas." />
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 22, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', width: 140, height: 140, flexShrink: 0, margin: '0 auto' }}>
            <svg viewBox="0 0 120 120" width="140" height="140" style={{ display: 'block', transform: 'rotate(-90deg)', overflow: 'visible' }}>
              <circle cx="60" cy="60" r={R} fill="none" stroke={T.border.muted} strokeWidth="14" />
              {fatias.map((f, i) => (
                <circle key={f.label} cx="60" cy="60" r={R} fill="none" stroke={f.cor}
                  strokeWidth={hover === i ? 18 : 14} strokeDasharray={f.dash} strokeDashoffset={f.off}
                  opacity={hover !== null && hover !== i ? 0.35 : 1}
                  onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
                  style={{ cursor: 'pointer', transition: 'stroke-width .2s, opacity .2s' }} />
              ))}
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center', pointerEvents: 'none' }}>
              <div>
                <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-.03em', lineHeight: 1 }}>{ativo ? `${ativo.pct}%` : total}</div>
                <div style={{ fontSize: 11.5, color: T.text.quaternary, marginTop: 4 }}>{ativo ? ativo.label : 'atendimentos'}</div>
              </div>
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 150, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {fatias.map((f, i) => (
              <div key={f.label} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} style={{
                display: 'flex', alignItems: 'center', gap: 9, padding: '6px 8px', borderRadius: 9, fontSize: 13,
                background: hover === i ? T.bg.page : 'transparent', transition: 'background .15s',
              }}>
                <span style={{ width: 8, height: 8, borderRadius: 3, flexShrink: 0, background: f.cor }} />
                <span style={{ flex: 1, minWidth: 0, color: T.text.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.label}</span>
                <span style={{ fontWeight: 700 }}>{f.n}</span>
                <span style={{ width: 34, textAlign: 'right', fontSize: 12, color: T.text.quaternary }}>{f.pct}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
