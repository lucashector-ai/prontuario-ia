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
import { listarConsultas } from '@/lib/portal/queries'
import { formatDataLonga } from '@/lib/portal/format'
import type { Consulta } from '@/lib/portal/types'

export default function ConsultasPage() {
  const { session, loading: loadingSession } = usePortalSession()
  const [consultas, setConsultas] = useState<Consulta[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (loadingSession || !session) return
    let alive = true
    setLoading(true)
    listarConsultas(session.pacienteId).then((c) => {
      if (alive) {
        setConsultas(c)
        setLoading(false)
      }
    })
    return () => { alive = false }
  }, [session, loadingSession])

  return (
    <FadeIn>
      <div style={{ padding: '24px 20px', maxWidth: 760 }}>
        <PageHeader
          eyebrow="Consultas"
          title="Suas consultas"
          description="Resumos em linguagem clara, sem jargão médico."
        />

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[0, 1, 2].map((i) => <Skeleton key={i} height={88} style={{ borderRadius: tokens.radius['3xl'] }} />)}
          </div>
        ) : consultas.length === 0 ? (
          <EmptyState
            title="Você ainda não tem consultas registradas"
            description="Quando uma consulta for finalizada, o resumo aparece aqui."
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {consultas.map((c) => (
              <Link key={c.id} href={`/portal/consultas/${c.id}`} style={{ textDecoration: 'none' }}>
                <Card interactive>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 6 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: tokens.text.primary }}>
                      {formatDataLonga(c.data)}
                    </div>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={tokens.text.tertiary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                  </div>
                  <div style={{ fontSize: 13, color: tokens.text.secondary, lineHeight: 1.5 }}>
                    {(c.resumo && c.resumo.slice(0, 180)) || 'Resumo não disponível ainda.'}
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
