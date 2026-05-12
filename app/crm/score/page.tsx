'use client'

import { useEffect, useMemo, useState } from 'react'
import { tokens } from '@/lib/design-tokens'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/Skeleton'
import { Badge } from '@/components/ui/Badge'
import { FadeIn } from '@/components/motion/FadeIn'
import { useClinicaId } from '@/lib/financeiro/clinica'
import { calcularScorePacientes, type ScorePaciente } from '@/lib/crm/queries'
import { moeda } from '@/lib/financeiro/format'
import { formatRelativo } from '@/lib/portal/format'

export default function ScorePacientesPage() {
  const { clinicaId, loading: loadingClinica } = useClinicaId()
  const [scores, setScores] = useState<ScorePaciente[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')

  useEffect(() => {
    if (loadingClinica || !clinicaId) return
    let alive = true
    setLoading(true)
    calcularScorePacientes(clinicaId).then((s) => {
      if (alive) {
        setScores(s)
        setLoading(false)
      }
    })
    return () => { alive = false }
  }, [clinicaId, loadingClinica])

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    if (!q) return scores
    return scores.filter((s) => s.nome.toLowerCase().includes(q))
  }, [scores, busca])

  const maxTotal = Math.max(1, ...scores.map((s) => s.total))

  // Categoriza por engajamento
  const stats = useMemo(() => {
    let vip = 0   // top 10% por total
    let ativo = 0 // total > 0 e ultima visita < 90 dias
    let dormente = 0 // ultima visita > 90 dias
    let nunca = 0 // sem nenhuma consulta
    const cutoffVip = scores.length > 0 ? scores[Math.floor(scores.length * 0.1)]?.total || Infinity : 0

    for (const s of scores) {
      if (s.consultas === 0) nunca++
      else if (s.total >= cutoffVip && cutoffVip > 0) vip++
      else if (s.ultimaVisita && (Date.now() - new Date(s.ultimaVisita).getTime()) / 86_400_000 <= 90) ativo++
      else dormente++
    }
    return { vip, ativo, dormente, nunca }
  }, [scores])

  return (
    <FadeIn>
      <div style={{ marginBottom: 24 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: tokens.brand.primary, letterSpacing: 0.6, textTransform: 'uppercase' }}>CRM</span>
        <h1 style={{ margin: '8px 0 0', fontSize: 28, fontWeight: 700, letterSpacing: -0.5, color: tokens.text.primary }}>Score de pacientes</h1>
        <p style={{ margin: '4px 0 0', fontSize: 14, color: tokens.text.secondary }}>
          Ordenado por receita gerada. VIPs no topo. Calculado em tempo real a partir do financeiro.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 16 }}>
        <MiniStat label="VIPs" valor={stats.vip} cor={tokens.brand.primary} />
        <MiniStat label="Ativos" valor={stats.ativo} cor={tokens.status.success} />
        <MiniStat label="Dormentes" valor={stats.dormente} cor={tokens.status.warning} />
        <MiniStat label="Nunca atendidos" valor={stats.nunca} cor={tokens.text.tertiary} />
      </div>

      <Card variant="elevated" padding={16} style={{ marginBottom: 16 }}>
        <Input label="Buscar paciente" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome" />
      </Card>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} height={64} style={{ borderRadius: tokens.radius['2xl'] }} />)}
        </div>
      ) : filtrados.length === 0 ? (
        <Card variant="elevated">
          <div style={{ padding: '40px 20px', textAlign: 'center', color: tokens.text.tertiary, fontSize: 14 }}>
            Nenhum paciente encontrado.
          </div>
        </Card>
      ) : (
        <Card variant="elevated" padding={0}>
          {filtrados.map((s, i) => {
            const w = (s.total / maxTotal) * 100
            const dias = s.ultimaVisita ? Math.floor((Date.now() - new Date(s.ultimaVisita).getTime()) / 86_400_000) : null
            const tag = s.consultas === 0
              ? { label: 'Sem visita', variant: 'neutral' as const }
              : dias !== null && dias > 180
              ? { label: 'Dormente', variant: 'warning' as const }
              : i < Math.max(1, Math.floor(scores.length * 0.1))
              ? { label: 'VIP', variant: 'brand' as const }
              : { label: 'Ativo', variant: 'success' as const }
            return (
              <div key={s.pacienteId} style={{ padding: '14px 20px', borderTop: i === 0 ? 'none' : `1px solid ${tokens.border.subtle}` }}>
                <div style={{ display: 'grid', gridTemplateColumns: '32px 1fr auto', gap: 12, alignItems: 'center', marginBottom: 8 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: 8,
                    background: tag.variant === 'brand' ? tokens.brand.primary : tokens.brand.primaryLighter,
                    color: tag.variant === 'brand' ? tokens.text.inverse : tokens.brand.primary,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 600, flexShrink: 0,
                  }}>{i + 1}</div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: tokens.text.primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.nome}</span>
                      <Badge size="sm" variant={tag.variant}>{tag.label}</Badge>
                    </div>
                    <div style={{ fontSize: 12, color: tokens.text.tertiary, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      <span>{s.consultas} consulta{s.consultas === 1 ? '' : 's'}</span>
                      <span>Ticket médio: <strong style={{ color: tokens.text.strong, fontWeight: 500 }}>{moeda(s.ticketMedio)}</strong></span>
                      <span>{s.ultimaVisita ? `Última: ${formatRelativo(s.ultimaVisita)}` : 'Nunca atendida'}</span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: tokens.text.primary }}>{moeda(s.total)}</div>
                  </div>
                </div>
                <div style={{ height: 4, background: tokens.bg.cardSubtle, borderRadius: 999, overflow: 'hidden', marginLeft: 44 }}>
                  <div style={{
                    width: `${w}%`, height: '100%',
                    background: `linear-gradient(90deg, ${tokens.brand.primary}, ${tokens.brand.primaryDarker})`,
                    transition: 'width 320ms ease',
                  }} />
                </div>
              </div>
            )
          })}
        </Card>
      )}
    </FadeIn>
  )
}

function MiniStat({ label, valor, cor }: { label: string; valor: number; cor: string }) {
  return (
    <Card variant="elevated" padding={14}>
      <div style={{ fontSize: 11, fontWeight: 600, color: tokens.text.tertiary, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: cor }}>{valor}</div>
    </Card>
  )
}
