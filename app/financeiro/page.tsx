'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts'
import { useAuth } from '@/lib/useAuth'
import { tokens } from '@/lib/design-tokens'
import { obterDashboard } from '@/lib/financeiro/dashboard'
import { obterSaldos, type ResumoSaldos } from '@/lib/financeiro/contas'
import { listarUnidades } from '@/lib/financeiro/unidades'
import type { DashboardFinanceiro, InsightFinanceiro, ItemTipo, Unidade } from '@/lib/financeiro/types'
import { PageHeader, Card } from '@/components/ui'

const brl = (v: number) =>
  'R$ ' + (Number(v) || 0).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')
const brlCompact = (v: number) => {
  const n = Number(v) || 0
  if (Math.abs(n) >= 1000) return `${n < 0 ? '-' : ''}${(Math.abs(n) / 1000).toFixed(0)}k`
  return String(Math.round(n))
}
const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

function delta(atual: number, anterior: number): { texto: string; positivo: boolean } | null {
  if (!anterior) return null
  const pct = ((atual - anterior) / Math.abs(anterior)) * 100
  if (!isFinite(pct) || Math.abs(pct) < 0.5) return null
  return { texto: `${pct > 0 ? '+' : ''}${pct.toFixed(0)}% vs mês anterior`, positivo: pct >= 0 }
}

const CAT_LABEL: Record<ItemTipo, string> = {
  consulta: 'Consultas', procedimento: 'Procedimentos', exame: 'Exames',
  produto: 'Produtos', pacote: 'Pacotes', outro: 'Outros',
}
const CAT_CORES = ['#6043C1', '#8B5CF6', '#B9A9EF', '#A7F3D0', '#FBBF24', '#94A3B8']

export default function FinanceiroPage() {
  const router = useRouter()
  const { usuario } = useAuth()
  const clinicaId = usuario?.clinica_id || null

  const [d, setD] = useState<DashboardFinanceiro | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [insights, setInsights] = useState<InsightFinanceiro[] | null>(null)
  const [unidades, setUnidades] = useState<Unidade[]>([])
  const [unidadeSel, setUnidadeSel] = useState('')
  const [saldos, setSaldos] = useState<ResumoSaldos | null>(null)

  useEffect(() => {
    if (!clinicaId) return
    listarUnidades(clinicaId, true).then(({ data }) => setUnidades(data || []))
    obterSaldos(clinicaId).then(({ data }) => setSaldos(data))
  }, [clinicaId])

  useEffect(() => {
    if (!clinicaId) return
    setCarregando(true)
    setInsights(null)
    obterDashboard(clinicaId, unidadeSel || null).then(({ data }) => {
      setD(data)
      setCarregando(false)
      if (data) {
        fetch('/api/financeiro/insights', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })
          .then((r) => r.json())
          .then((j) => setInsights(j.insights || []))
          .catch(() => setInsights([]))
      }
    })
  }, [clinicaId, unidadeSel])

  const kpis = useMemo(() => {
    if (!d) return []
    return [
      { label: 'Faturamento do mês', valor: d.faturamentoMes, delta: delta(d.faturamentoMes, d.faturamentoMesAnterior) },
      { label: 'Recebido no mês', valor: d.recebidoMes, delta: delta(d.recebidoMes, d.recebidoMesAnterior) },
      { label: 'Lucro do mês', valor: d.lucroMes, delta: delta(d.lucroMes, d.lucroMesAnterior), destaque: true },
      { label: 'A receber', valor: d.aReceber, delta: null },
      { label: 'A pagar', valor: d.aPagar, delta: null, negativo: true },
      { label: 'Inadimplência', valor: d.inadimplencia, delta: null, negativo: true },
      { label: 'Ticket médio', valor: d.ticketMedio, delta: null },
      { label: 'Faturamento hoje', valor: d.faturamentoHoje, delta: null },
    ]
  }, [d])

  const serie = (d?.serie || []).map((p) => ({ ...p, label: ddmm(p.data) }))
  const tickInterval = Math.max(0, Math.floor(serie.length / 9))

  return (
    <div style={{ padding: 24 }}>
      <PageHeader
        titulo="Financeiro"
        descricao="Acompanhe receita, recebimentos e saúde financeira da clínica."
      />

      {unidades.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <select
            value={unidadeSel}
            onChange={(e) => setUnidadeSel(e.target.value)}
            style={{
              padding: '8px 12px', borderRadius: 9, border: `1px solid ${tokens.border.default}`,
              fontSize: 13, fontWeight: 600, background: tokens.bg.card, color: tokens.text.primary, outline: 'none',
            }}
          >
            <option value="">Todas as unidades (consolidado)</option>
            {unidades.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
          </select>
        </div>
      )}

      {/* Cockpit de insights */}
      <div style={{
        background: `linear-gradient(180deg, ${tokens.brand.primarySoftBg}, ${tokens.bg.card})`,
        border: `1px solid ${tokens.border.subtle}`, borderRadius: 16, padding: 18, marginBottom: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={tokens.brand.primary} strokeWidth="2">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
          <span style={{ fontSize: 12, fontWeight: 700, color: tokens.brand.primary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Leitura inteligente
          </span>
        </div>
        {insights === null ? (
          <p style={{ fontSize: 13, color: tokens.text.tertiary, margin: 0 }}>Analisando os números...</p>
        ) : insights.length === 0 ? (
          <p style={{ fontSize: 13, color: tokens.text.tertiary, margin: 0 }}>Sem leitura disponível no momento.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {insights.map((ins, i) => {
              const cor = ins.tom === 'positivo' ? tokens.status.success
                : ins.tom === 'alerta' ? tokens.status.danger : tokens.text.tertiary
              return (
                <div key={i} style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
                  <span style={{ width: 7, height: 7, borderRadius: 99, background: cor, marginTop: 6, flexShrink: 0 }} />
                  <span style={{ fontSize: 13.5, color: tokens.text.strong, lineHeight: 1.5 }}>{ins.texto}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 16 }}>
        {kpis.map((k) => (
          <Card key={k.label} style={{ borderRadius: 14, padding: '16px 18px' }}>
            <p style={{ fontSize: 12.5, color: tokens.text.secondary, margin: 0 }}>{k.label}</p>
            <p style={{
              fontSize: 25, fontWeight: 600, margin: '7px 0 0', fontVariantNumeric: 'tabular-nums',
              color: (k as any).negativo && k.valor > 0 ? tokens.status.danger
                : (k as any).destaque ? tokens.brand.primary : tokens.text.primary,
            }}>
              {carregando ? '—' : brl(k.valor)}
            </p>
            {k.delta && (
              <p style={{
                fontSize: 11, fontWeight: 600, margin: '4px 0 0',
                color: k.delta.positivo ? tokens.status.success : tokens.status.danger,
              }}>{k.delta.texto}</p>
            )}
          </Card>
        ))}
      </div>

      {/* Fluxo de caixa */}
      <Card style={{ marginBottom: 16 }}>
        <p style={{ fontSize: 14, fontWeight: 700, color: tokens.text.primary, margin: '0 0 2px' }}>Fluxo de caixa</p>
        <p style={{ fontSize: 12, color: tokens.text.tertiary, margin: '0 0 14px' }}>
          Realizado dos últimos 30 dias e projeção dos próximos 45 — inclui despesas recorrentes.
        </p>
        {d && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, marginBottom: 12 }}>
            {[
              ['Entradas previstas (45d)', d.projecao.entradasPrevistas, tokens.status.success],
              ['Saídas previstas (45d)', d.projecao.saidasPrevistas, tokens.status.danger],
              ['Saldo projetado do período', d.projecao.saldoFinal, d.projecao.saldoFinal >= 0 ? tokens.brand.primary : tokens.status.danger],
            ].map(([label, valor, cor]) => (
              <div key={label as string}>
                <p style={{ fontSize: 11, color: tokens.text.tertiary, margin: 0 }}>{label}</p>
                <p style={{ fontSize: 16, fontWeight: 700, color: cor as string, margin: '2px 0 0', fontVariantNumeric: 'tabular-nums' }}>
                  {brl(valor as number)}
                </p>
              </div>
            ))}
          </div>
        )}
        <div style={{ width: '100%', height: 300 }}>
          {serie.length > 0 && (
            <ResponsiveContainer>
              <ComposedChart data={serie} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
                <CartesianGrid stroke={tokens.border.subtle} vertical={false} />
                <XAxis dataKey="label" interval={tickInterval} tick={{ fontSize: 10, fill: tokens.text.tertiary }} tickLine={false} axisLine={{ stroke: tokens.border.default }} />
                <YAxis tickFormatter={brlCompact} tick={{ fontSize: 10, fill: tokens.text.tertiary }} tickLine={false} axisLine={false} width={42} />
                <Tooltip
                  formatter={(v: any, n: any) => [brl(Number(v)), LEGENDAS[n] || n]}
                  labelFormatter={(l) => `Dia ${l}`}
                  contentStyle={{ fontSize: 12, borderRadius: 10, border: `1px solid ${tokens.border.default}` }}
                />
                <Bar dataKey="entradas" stackId="real" fill={tokens.status.success} radius={[3, 3, 0, 0]} maxBarSize={14} />
                <Bar dataKey="saidas" stackId="real" fill={tokens.status.danger} radius={[3, 3, 0, 0]} maxBarSize={14} />
                <Bar dataKey="entradasPrevistas" stackId="prev" fill={tokens.status.successLight} radius={[3, 3, 0, 0]} maxBarSize={14} />
                <Bar dataKey="saidasPrevistas" stackId="prev" fill={tokens.status.dangerLight} radius={[3, 3, 0, 0]} maxBarSize={14} />
                <Line type="monotone" dataKey="saldo" stroke={tokens.brand.primary} strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 10 }}>
          {[
            ['Entradas', tokens.status.success], ['Saídas', tokens.status.danger],
            ['Entradas previstas', tokens.status.successLight], ['Saídas previstas', tokens.status.dangerLight],
            ['Saldo acumulado', tokens.brand.primary],
          ].map(([txt, cor]) => (
            <span key={txt} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: tokens.text.secondary }}>
              <span style={{ width: 9, height: 9, borderRadius: 3, background: cor }} />{txt}
            </span>
          ))}
        </div>
      </Card>

      {/* Painéis a receber / a pagar / categorias */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
        <Painel
          titulo="A receber"
          onVerTodas={() => router.push('/financeiro/recebimentos')}
          cor={tokens.status.success}
          linhas={d ? [
            ['Inadimplência', d.painelReceber.inadimplencia],
            ['Para hoje', d.painelReceber.paraHoje],
            ['Para este mês', d.painelReceber.esteMes],
            ['Para este ano', d.painelReceber.esteAno],
            ['Recebido no mês', d.painelReceber.recebidoMes],
            ['Recebido no ano', d.painelReceber.recebidoAno],
          ] : []}
        />
        <Painel
          titulo="A pagar"
          cor={tokens.status.danger}
          onVerTodas={() => router.push('/financeiro/despesas')}
          linhas={d ? [
            ['Em atraso', d.painelPagar.emAtraso],
            ['Para hoje', d.painelPagar.paraHoje],
            ['Para este mês', d.painelPagar.esteMes],
            ['Para este ano', d.painelPagar.esteAno],
            ['Pago no mês', d.painelPagar.pagoMes],
            ['Pago no ano', d.painelPagar.pagoAno],
          ] : []}
        />
        <div style={painelCard}>
          <p style={{ fontSize: 14, fontWeight: 700, color: tokens.text.primary, margin: '0 0 12px' }}>
            Receita por categoria
          </p>
          {d && d.categorias.length > 0 ? (
            <>
              <div style={{ width: '100%', height: 150 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={d.categorias} dataKey="valor" nameKey="tipo" cx="50%" cy="50%" innerRadius={38} outerRadius={62} paddingAngle={2}>
                      {d.categorias.map((c, i) => <Cell key={c.tipo} fill={CAT_CORES[i % CAT_CORES.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: any, n: any) => [brl(Number(v)), CAT_LABEL[n as ItemTipo] || n]} contentStyle={{ fontSize: 12, borderRadius: 10 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                {d.categorias.map((c, i) => (
                  <div key={c.tipo} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12 }}>
                    <span style={{ width: 9, height: 9, borderRadius: 3, background: CAT_CORES[i % CAT_CORES.length] }} />
                    <span style={{ flex: 1, color: tokens.text.secondary }}>{CAT_LABEL[c.tipo] || c.tipo}</span>
                    <span style={{ fontWeight: 600, color: tokens.text.primary, fontVariantNumeric: 'tabular-nums' }}>{brl(c.valor)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p style={{ fontSize: 12.5, color: tokens.text.tertiary, margin: 0 }}>
              Sem receita categorizada neste mês.
            </p>
          )}
        </div>

        {/* Contas financeiras */}
        <div style={painelCard}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: tokens.text.primary, margin: 0 }}>Contas financeiras</p>
            <button onClick={() => router.push('/financeiro/contas')} style={{
              background: 'none', border: 'none', color: tokens.brand.primary,
              fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0,
            }}>Ver todas →</button>
          </div>
          {!saldos || saldos.contas.length === 0 ? (
            <p style={{ fontSize: 12.5, color: tokens.text.tertiary, margin: 0 }}>
              Nenhuma conta cadastrada.
            </p>
          ) : (
            <>
              {saldos.contas.slice(0, 5).map((c) => (
                <div key={c.id} style={{
                  display: 'flex', justifyContent: 'space-between', padding: '8px 0',
                  borderBottom: `1px solid ${tokens.border.subtle}`, fontSize: 13,
                }}>
                  <span style={{ color: tokens.text.secondary }}>{c.nome}</span>
                  <span style={{
                    fontWeight: 600, fontVariantNumeric: 'tabular-nums',
                    color: c.saldoAtual < 0 ? tokens.status.danger : tokens.text.primary,
                  }}>
                    {'R$ ' + (c.saldoAtual).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
                  </span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 10, fontSize: 13 }}>
                <span style={{ fontWeight: 700, color: tokens.text.primary }}>Saldo total</span>
                <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: tokens.brand.primary }}>
                  {'R$ ' + (saldos.total).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Navegação */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 16 }}>
        {[
          ['Contas', '/financeiro/contas'],
          ['Contas a receber', '/financeiro/recebimentos'],
          ['Contas a pagar', '/financeiro/despesas'],
          ['Repasse médico', '/financeiro/repasses'],
          ['Margem por procedimento', '/financeiro/margem'],
          ['CRM financeiro', '/financeiro/pacientes'],
          ['Cofre financeiro', '/financeiro/saude'],
          ['Assistente financeiro', '/financeiro/assistente'],
          ['Relatórios', '/financeiro/relatorios'],
          ['Conciliação bancária', '/financeiro/conciliacao'],
          ['Importar planilha', '/financeiro/importar'],
          ['Auditoria', '/financeiro/auditoria'],
          ['Configurações', '/financeiro/configuracoes'],
        ].map(([label, rota]) => (
          <button key={rota} onClick={() => router.push(rota)} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
            minWidth: 220, padding: '15px 18px', borderRadius: 14,
            background: tokens.bg.card, border: `1px solid ${tokens.border.subtle}`, cursor: 'pointer',
          }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: tokens.text.primary }}>{label}</span>
            <span style={{ fontSize: 16, color: tokens.brand.primary }}>→</span>
          </button>
        ))}
      </div>
    </div>
  )
}

const LEGENDAS: Record<string, string> = {
  entradas: 'Entradas', saidas: 'Saídas',
  entradasPrevistas: 'Entradas previstas', saidasPrevistas: 'Saídas previstas',
  saldo: 'Saldo acumulado',
}

function Painel({ titulo, cor, linhas, onVerTodas, rodape }: {
  titulo: string
  cor: string
  linhas: [string, number][]
  onVerTodas?: () => void
  rodape?: string
}) {
  const brlL = (v: number) =>
    'R$ ' + (Number(v) || 0).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return (
    <div style={painelCard}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <p style={{ fontSize: 14, fontWeight: 700, color: tokens.text.primary, margin: 0 }}>{titulo}</p>
        {onVerTodas && (
          <button onClick={onVerTodas} style={{
            background: 'none', border: 'none', color: tokens.brand.primary,
            fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0,
          }}>Ver todas →</button>
        )}
      </div>
      <div>
        {linhas.map(([label, valor]) => (
          <div key={label} style={{
            display: 'flex', justifyContent: 'space-between', padding: '8px 0',
            borderBottom: `1px solid ${tokens.border.subtle}`, fontSize: 13,
          }}>
            <span style={{ color: tokens.text.secondary }}>{label}</span>
            <span style={{ fontWeight: 600, color: cor, fontVariantNumeric: 'tabular-nums' }}>{brlL(valor)}</span>
          </div>
        ))}
      </div>
      {rodape && (
        <p style={{ fontSize: 11, color: tokens.text.tertiary, margin: '10px 0 0' }}>{rodape}</p>
      )}
    </div>
  )
}

const painelCard: React.CSSProperties = {
  background: tokens.bg.card, border: `1px solid ${tokens.border.subtle}`,
  borderRadius: 16, padding: 18,
}
