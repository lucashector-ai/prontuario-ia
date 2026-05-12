'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { tokens } from '@/lib/design-tokens'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { Tabs } from '@/components/ui/Tabs'
import { FadeIn } from '@/components/motion/FadeIn'
import { SectionHeader } from '../_components/SectionHeader'
import { useClinicaId } from '@/lib/financeiro/clinica'
import { listarLotesDaClinica } from '@/lib/estoque/queries'
import { statusValidade, labelValidade, diasAteValidade } from '@/lib/estoque/vencimento'
import { CATEGORIA_LABEL, UNIDADE_LABEL, type Lote } from '@/lib/estoque/types'
import { moeda } from '@/lib/financeiro/format'

const STATUS_VARIANT: Record<'ok' | 'atencao' | 'critico' | 'vencido', 'success' | 'warning' | 'danger'> = {
  ok: 'success',
  atencao: 'warning',
  critico: 'danger',
  vencido: 'danger',
}

export default function LotesPage() {
  const { clinicaId, loading: loadingClinica } = useClinicaId()
  const [lotes, setLotes] = useState<Lote[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<'todos' | 'vencidos' | 'criticos' | 'atencao'>('todos')

  useEffect(() => {
    if (loadingClinica || !clinicaId) return
    let alive = true
    setLoading(true)
    listarLotesDaClinica(clinicaId).then((l) => {
      if (alive) {
        setLotes(l)
        setLoading(false)
      }
    })
    return () => { alive = false }
  }, [clinicaId, loadingClinica])

  const stats = useMemo(() => {
    const s = { vencidos: 0, criticos: 0, atencao: 0, ok: 0 }
    for (const l of lotes) {
      const st = statusValidade(l.validade)
      if (st === 'vencido') s.vencidos++
      else if (st === 'critico') s.criticos++
      else if (st === 'atencao') s.atencao++
      else if (st === 'ok') s.ok++
    }
    return s
  }, [lotes])

  const filtrados = useMemo(() => {
    if (filtro === 'todos') return lotes
    return lotes.filter((l) => {
      const st = statusValidade(l.validade)
      if (filtro === 'vencidos') return st === 'vencido'
      if (filtro === 'criticos') return st === 'critico'
      if (filtro === 'atencao') return st === 'atencao'
      return true
    })
  }, [lotes, filtro])

  // Ordena: vencido → critico → atencao → ok → sem validade
  const ordenados = useMemo(() => {
    const rank: Record<string, number> = { vencido: 0, critico: 1, atencao: 2, ok: 3, sem: 4 }
    return [...filtrados].sort((a, b) => {
      const ra = rank[statusValidade(a.validade) || 'sem']
      const rb = rank[statusValidade(b.validade) || 'sem']
      if (ra !== rb) return ra - rb
      const da = diasAteValidade(a.validade) ?? Infinity
      const db = diasAteValidade(b.validade) ?? Infinity
      return da - db
    })
  }, [filtrados])

  return (
    <FadeIn>
      <SectionHeader
        title="Lotes"
        description="Rastreabilidade ANVISA + alertas de vencimento."
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 16 }}>
        <MiniStat label="Vencidos"      valor={stats.vencidos} variant="danger" />
        <MiniStat label="< 30 dias"     valor={stats.criticos} variant="danger" />
        <MiniStat label="< 90 dias"     valor={stats.atencao}  variant="warning" />
        <MiniStat label="OK"            valor={stats.ok}       variant="success" />
      </div>

      <div style={{ marginBottom: 16 }}>
        <Tabs
          items={[
            { value: 'todos',    label: 'Todos',       badge: lotes.length },
            { value: 'vencidos', label: 'Vencidos',    badge: stats.vencidos },
            { value: 'criticos', label: '< 30 dias',   badge: stats.criticos },
            { value: 'atencao',  label: '< 90 dias',   badge: stats.atencao },
          ]}
          value={filtro}
          onChange={(v) => setFiltro(v as typeof filtro)}
        />
      </div>

      <Card variant="elevated" padding={0}>
        {loading ? (
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[0, 1, 2].map((i) => <Skeleton key={i} height={56} />)}
          </div>
        ) : ordenados.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: tokens.text.tertiary, fontSize: 14 }}>
            Nenhum lote nessa categoria.
          </div>
        ) : (
          <div>
            {ordenados.map((l, i) => {
              const status = statusValidade(l.validade)
              return (
                <Link key={l.id} href={`/estoque/${l.produto?.id}`} style={{ textDecoration: 'none' }}>
                  <div style={{
                    padding: '14px 20px',
                    display: 'grid',
                    gridTemplateColumns: '1fr auto',
                    gap: 10,
                    alignItems: 'center',
                    borderTop: i === 0 ? 'none' : `1px solid ${tokens.border.subtle}`,
                    cursor: 'pointer',
                    transition: 'background 120ms ease',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = tokens.bg.hover}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: tokens.text.primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {l.produto?.nome || 'Produto'}
                        </span>
                        {l.produto?.categoria && <Badge size="sm">{CATEGORIA_LABEL[l.produto.categoria]}</Badge>}
                        {status && <Badge size="sm" variant={STATUS_VARIANT[status]} dot>{labelValidade(l.validade)}</Badge>}
                      </div>
                      <div style={{ fontSize: 12, color: tokens.text.tertiary, fontFamily: 'ui-monospace, SF Mono, monospace' }}>
                        Lote {l.numero_lote} {l.fornecedor?.nome ? `· ${l.fornecedor.nome}` : ''}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: tokens.text.primary }}>
                        {l.quantidade_atual} {l.produto?.unidade && UNIDADE_LABEL[l.produto.unidade]}
                      </div>
                      {l.preco_compra != null && (
                        <div style={{ fontSize: 11, color: tokens.text.tertiary }}>{moeda(l.preco_compra)}</div>
                      )}
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </Card>
    </FadeIn>
  )
}

function MiniStat({ label, valor, variant }: { label: string; valor: number; variant: 'success' | 'warning' | 'danger' }) {
  const color = variant === 'danger' ? tokens.status.danger : variant === 'warning' ? tokens.status.warning : tokens.status.success
  const bg = variant === 'danger' ? tokens.status.dangerBg : variant === 'warning' ? tokens.status.warningBg : tokens.status.successBg
  return (
    <Card padding={14} style={{ background: bg, border: 'none' }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: tokens.text.tertiary, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color }}>{valor}</div>
    </Card>
  )
}
