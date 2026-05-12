'use client'

import { useEffect, useMemo, useState } from 'react'
import { tokens } from '@/lib/design-tokens'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/Skeleton'
import { Badge } from '@/components/ui/Badge'
import { FadeIn } from '@/components/motion/FadeIn'
import { useClinicaId } from '@/lib/financeiro/clinica'
import { listarMovimentacoes } from '@/lib/financeiro/queries'
import type { Movimentacao } from '@/lib/financeiro/types'
import { dataBR, moeda } from '@/lib/financeiro/format'

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'neutral' | 'info'> = {
  pago: 'success',
  recebido: 'success',
  pendente: 'warning',
  previsto: 'info',
  atrasado: 'danger',
  cancelado: 'neutral',
}

export default function MovimentacoesPage() {
  const { clinicaId, loading: loadingClinica } = useClinicaId()
  const [movs, setMovs] = useState<Movimentacao[]>([])
  const [loading, setLoading] = useState(true)
  const [tipo, setTipo] = useState<'todos' | 'receita' | 'despesa'>('todos')
  const [status, setStatus] = useState<'todos' | 'pago' | 'pendente' | 'cancelado'>('todos')
  const [busca, setBusca] = useState('')

  useEffect(() => {
    if (loadingClinica || !clinicaId) return
    let alive = true
    setLoading(true)
    listarMovimentacoes(clinicaId, { tipo, status, limit: 200 }).then((m) => {
      if (alive) {
        setMovs(m)
        setLoading(false)
      }
    })
    return () => { alive = false }
  }, [clinicaId, tipo, status, loadingClinica])

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    if (!q) return movs
    return movs.filter((m) =>
      [m.descricao, m.categoria?.nome, m.pacientes?.nome, m.medicos?.nome]
        .filter(Boolean)
        .some((s) => String(s).toLowerCase().includes(q)),
    )
  }, [movs, busca])

  return (
    <FadeIn>
      <div style={{ marginBottom: 20 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: tokens.brand.primary, letterSpacing: 0.6, textTransform: 'uppercase' }}>Financeiro</span>
        <h1 style={{ margin: '8px 0 0', fontSize: 28, fontWeight: 700, letterSpacing: -0.5, color: tokens.text.primary }}>Movimentações</h1>
      </div>

      <Card variant="elevated" padding={16} style={{ marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, alignItems: 'end' }}>
          <Input label="Buscar" placeholder="Descrição, paciente, médico..." value={busca} onChange={(e) => setBusca(e.target.value)} />
          <FilterChips
            label="Tipo"
            value={tipo}
            onChange={(v) => setTipo(v as typeof tipo)}
            options={[{ v: 'todos', l: 'Todos' }, { v: 'receita', l: 'Receitas' }, { v: 'despesa', l: 'Despesas' }]}
          />
          <FilterChips
            label="Status"
            value={status}
            onChange={(v) => setStatus(v as typeof status)}
            options={[{ v: 'todos', l: 'Todos' }, { v: 'pago', l: 'Pago' }, { v: 'pendente', l: 'Pendente' }, { v: 'cancelado', l: 'Cancelado' }]}
          />
        </div>
      </Card>

      <Card variant="elevated" padding={0}>
        {loading ? (
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} height={44} />)}
          </div>
        ) : filtrados.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: tokens.text.tertiary, fontSize: 14 }}>
            Nenhuma movimentação encontrada com esses filtros.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ background: tokens.bg.muted, textAlign: 'left' }}>
                  <Th>Data</Th>
                  <Th>Descrição</Th>
                  <Th>Categoria</Th>
                  <Th>Vínculo</Th>
                  <Th align="right">Valor</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((m) => {
                  const receita = m.tipo === 'receita'
                  return (
                    <tr key={m.id} style={{ borderTop: `1px solid ${tokens.border.subtle}` }}>
                      <Td muted>{dataBR(m.data_movimentacao)}</Td>
                      <Td>{m.descricao || (receita ? 'Receita' : 'Despesa')}</Td>
                      <Td muted>
                        {m.categoria?.nome ? (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 6,
                            padding: '3px 8px', borderRadius: 999,
                            background: m.categoria.cor ? `${m.categoria.cor}1A` : tokens.bg.cardSubtle,
                            color: m.categoria.cor || tokens.text.strong,
                            fontSize: 12, fontWeight: 500,
                          }}>
                            {m.categoria.nome}
                          </span>
                        ) : '—'}
                      </Td>
                      <Td muted>{m.pacientes?.nome || m.medicos?.nome || '—'}</Td>
                      <Td align="right">
                        <strong style={{
                          color: receita ? tokens.status.successDark : tokens.status.dangerDark,
                          fontWeight: 600,
                        }}>
                          {receita ? '+' : '−'} {moeda(m.valor)}
                        </strong>
                      </Td>
                      <Td>
                        <Badge variant={STATUS_VARIANT[m.status] || 'neutral'} size="sm" dot>
                          {m.status}
                        </Badge>
                      </Td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </FadeIn>
  )
}

function Th({ children, align }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <th style={{
      padding: '12px 16px',
      fontSize: 11,
      fontWeight: 600,
      color: tokens.text.tertiary,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      textAlign: align || 'left',
      whiteSpace: 'nowrap',
    }}>{children}</th>
  )
}

function Td({ children, align, muted }: { children: React.ReactNode; align?: 'left' | 'right'; muted?: boolean }) {
  return (
    <td style={{
      padding: '14px 16px',
      color: muted ? tokens.text.secondary : tokens.text.primary,
      textAlign: align || 'left',
      verticalAlign: 'middle',
    }}>{children}</td>
  )
}

function FilterChips({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { v: string; l: string }[] }) {
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 500, color: tokens.text.strong, marginBottom: 6 }}>{label}</div>
      <div style={{ display: 'inline-flex', gap: 2, padding: 3, background: tokens.bg.cardSubtle, borderRadius: tokens.radius.lg }}>
        {options.map((o) => {
          const active = o.v === value
          return (
            <button
              key={o.v}
              type="button"
              onClick={() => onChange(o.v)}
              style={{
                padding: '6px 10px',
                fontSize: 13,
                fontWeight: active ? 600 : 500,
                color: active ? tokens.text.primary : tokens.text.secondary,
                background: active ? tokens.bg.card : 'transparent',
                border: 'none',
                borderRadius: tokens.radius.md,
                cursor: 'pointer',
                boxShadow: active ? tokens.shadow.sm : 'none',
              }}
            >
              {o.l}
            </button>
          )
        })}
      </div>
    </div>
  )
}
