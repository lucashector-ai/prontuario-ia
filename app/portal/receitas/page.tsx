'use client'

import { useEffect, useState } from 'react'
import { tokens } from '@/lib/design-tokens'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { Badge } from '@/components/ui/Badge'
import { FadeIn } from '@/components/motion/FadeIn'
import { PageHeader } from '../_components/PageHeader'
import { EmptyState } from '../_components/EmptyState'
import { useToast } from '@/components/Toast'
import { usePortalSession } from '@/lib/portal/session'
import { listarPrescricoes } from '@/lib/portal/queries'
import { formatDataLonga } from '@/lib/portal/format'
import type { Prescricao } from '@/lib/portal/types'

export default function ReceitasPage() {
  const { session, loading: loadingSession } = usePortalSession()
  const [prescricoes, setPrescricoes] = useState<Prescricao[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    if (loadingSession || !session) return
    let alive = true
    setLoading(true)
    listarPrescricoes(session.pacienteId).then((p) => {
      if (alive) {
        setPrescricoes(p)
        setLoading(false)
      }
    })
    return () => { alive = false }
  }, [session, loadingSession])

  function reenviar(_id: string, canal: 'email' | 'whatsapp') {
    // TODO Sprint 3/4: integrar com Memed + WhatsApp Business API
    toast(`Reenvio via ${canal === 'email' ? 'email' : 'WhatsApp'} solicitado.`, 'info')
  }

  return (
    <FadeIn>
      <div style={{ padding: '24px 20px', maxWidth: 760 }}>
        <PageHeader
          eyebrow="Receitas"
          title="Suas prescrições"
          description="Receitas digitais válidas — você pode reenviar pra você mesmo a qualquer hora."
        />

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[0, 1].map((i) => <Skeleton key={i} height={120} style={{ borderRadius: tokens.radius['3xl'] }} />)}
          </div>
        ) : prescricoes.length === 0 ? (
          <EmptyState
            title="Nenhuma receita ainda"
            description="Quando o médico prescrever algo, a receita digital fica disponível aqui."
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {prescricoes.map((p) => (
              <Card key={p.id} variant="elevated">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: tokens.text.primary, marginBottom: 4 }}>
                      Prescrição
                    </div>
                    <div style={{ fontSize: 13, color: tokens.text.tertiary }}>
                      {formatDataLonga(p.criado_em)}
                    </div>
                  </div>
                  <Badge variant="success" size="sm" dot>Válida</Badge>
                </div>

                {p.conteudo && (
                  <div style={{
                    fontSize: 13,
                    color: tokens.text.strong,
                    lineHeight: 1.55,
                    padding: 12,
                    background: tokens.bg.cardSubtle,
                    borderRadius: tokens.radius.lg,
                    marginBottom: 12,
                    whiteSpace: 'pre-wrap',
                  }}>
                    {p.conteudo.length > 280 ? p.conteudo.slice(0, 280) + '...' : p.conteudo}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Button size="sm" variant="secondary" onClick={() => reenviar(p.id, 'email')}>Reenviar por email</Button>
                  <Button size="sm" variant="secondary" onClick={() => reenviar(p.id, 'whatsapp')}>Reenviar no WhatsApp</Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </FadeIn>
  )
}
