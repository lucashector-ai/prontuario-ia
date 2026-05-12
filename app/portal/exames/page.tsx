'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { tokens } from '@/lib/design-tokens'
import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { FadeIn } from '@/components/motion/FadeIn'
import { PageHeader } from '../_components/PageHeader'
import { EmptyState } from '../_components/EmptyState'
import { usePortalSession } from '@/lib/portal/session'
import { listarExames } from '@/lib/portal/queries'
import { formatDataLonga } from '@/lib/portal/format'
import type { Exame } from '@/lib/portal/types'

export default function ExamesPage() {
  const { session, loading: loadingSession } = usePortalSession()
  const [exames, setExames] = useState<Exame[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (loadingSession || !session) return
    let alive = true
    setLoading(true)
    listarExames(session.pacienteId).then((e) => {
      if (alive) {
        setExames(e)
        setLoading(false)
      }
    })
    return () => { alive = false }
  }, [session, loadingSession])

  return (
    <FadeIn>
      <div style={{ padding: '24px 20px', maxWidth: 760 }}>
        <PageHeader
          eyebrow="Exames"
          title="Seus exames"
          description="Resultados com explicação em linguagem simples, sem termo técnico."
        />

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[0, 1].map((i) => <Skeleton key={i} height={80} style={{ borderRadius: tokens.radius['3xl'] }} />)}
          </div>
        ) : exames.length === 0 ? (
          <EmptyState
            title="Nenhum exame ainda"
            description="Quando a clínica anexar um exame ou laudo, aparece aqui com uma explicação acessível."
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {exames.map((e) => (
              <Link key={e.id} href={`/portal/exames/${e.id}`} style={{ textDecoration: 'none' }}>
                <Card interactive>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 15, fontWeight: 600, color: tokens.text.primary, marginBottom: 4 }}>
                        {e.nome || 'Exame'}
                      </div>
                      <div style={{ fontSize: 13, color: tokens.text.tertiary }}>
                        {formatDataLonga(e.data_realizacao || e.criado_em)}
                      </div>
                    </div>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={tokens.text.tertiary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </FadeIn>
  )
}
