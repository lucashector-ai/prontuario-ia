'use client'

import { useEffect, useState } from 'react'
import { tokens } from '@/lib/design-tokens'
import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { Badge } from '@/components/ui/Badge'
import { FadeIn } from '@/components/motion/FadeIn'
import { PageHeader } from '../_components/PageHeader'
import { EmptyState } from '../_components/EmptyState'
import { usePortalSession } from '@/lib/portal/session'
import { listarProtocolos } from '@/lib/portal/queries'
import { formatDataLonga } from '@/lib/portal/format'
import type { PortalProtocolo } from '@/lib/portal/types'

const STATUS_META: Record<PortalProtocolo['status'], { label: string; variant: 'success' | 'warning' | 'neutral' | 'brand' }> = {
  ativo:      { label: 'Em andamento', variant: 'brand' },
  pausado:    { label: 'Pausado',      variant: 'warning' },
  concluido:  { label: 'Concluído',    variant: 'success' },
  cancelado:  { label: 'Cancelado',    variant: 'neutral' },
}

export default function ProtocolosPage() {
  const { session, loading: loadingSession } = usePortalSession()
  const [protocolos, setProtocolos] = useState<PortalProtocolo[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (loadingSession || !session) return
    let alive = true
    setLoading(true)
    listarProtocolos(session.pacienteId).then((p) => {
      if (alive) {
        setProtocolos(p)
        setLoading(false)
      }
    })
    return () => { alive = false }
  }, [session, loadingSession])

  return (
    <FadeIn>
      <div style={{ padding: '24px 20px', maxWidth: 760 }}>
        <PageHeader
          eyebrow="Protocolos"
          title="Seu plano de tratamento"
          description="Acompanhe progresso, próximos passos e datas dos seus protocolos ativos."
        />

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[0, 1].map((i) => <Skeleton key={i} height={160} style={{ borderRadius: tokens.radius['3xl'] }} />)}
          </div>
        ) : protocolos.length === 0 ? (
          <EmptyState
            title="Nenhum protocolo ativo"
            description="Quando o médico definir um plano de tratamento, ele vai aparecer aqui com progresso visual."
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {protocolos.map((p) => (
              <Card key={p.id} variant="elevated">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 17, fontWeight: 600, color: tokens.text.primary, marginBottom: 4 }}>{p.nome}</div>
                    {p.descricao && (
                      <div style={{ fontSize: 13, color: tokens.text.secondary, lineHeight: 1.45, maxWidth: 480 }}>
                        {p.descricao}
                      </div>
                    )}
                  </div>
                  <Badge variant={STATUS_META[p.status].variant} size="sm">{STATUS_META[p.status].label}</Badge>
                </div>

                <div style={{ marginBottom: 12, marginTop: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: tokens.text.tertiary, marginBottom: 6 }}>
                    <span>Progresso</span>
                    <span style={{ fontWeight: 600, color: tokens.text.strong }}>{p.progresso_percentual}%</span>
                  </div>
                  <div style={{ height: 8, background: tokens.bg.cardSubtle, borderRadius: 999, overflow: 'hidden' }}>
                    <div style={{
                      width: `${Math.min(100, Math.max(0, p.progresso_percentual))}%`,
                      height: '100%',
                      background: `linear-gradient(90deg, ${tokens.brand.primary}, ${tokens.brand.primaryDarker})`,
                      borderRadius: 999,
                      transition: 'width 400ms ease',
                    }} />
                  </div>
                </div>

                {p.proximo_passo && (
                  <div style={{
                    padding: 12,
                    background: tokens.brand.primaryLighter,
                    borderRadius: tokens.radius.xl,
                    marginBottom: 10,
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: tokens.brand.primaryDarkText, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>
                      Próximo passo
                    </div>
                    <div style={{ fontSize: 14, color: tokens.text.primary, lineHeight: 1.45 }}>
                      {p.proximo_passo}
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', gap: 16, fontSize: 12, color: tokens.text.tertiary }}>
                  <span>Início: <strong style={{ color: tokens.text.strong, fontWeight: 500 }}>{formatDataLonga(p.iniciado_em)}</strong></span>
                  {p.termina_em && (
                    <span>Término previsto: <strong style={{ color: tokens.text.strong, fontWeight: 500 }}>{formatDataLonga(p.termina_em)}</strong></span>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </FadeIn>
  )
}
