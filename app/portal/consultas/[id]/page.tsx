'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { tokens } from '@/lib/design-tokens'
import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { FadeIn } from '@/components/motion/FadeIn'
import { PageHeader } from '../../_components/PageHeader'
import { EmptyState } from '../../_components/EmptyState'
import { buscarConsulta } from '@/lib/portal/queries'
import { formatDataLonga } from '@/lib/portal/format'
import type { Consulta } from '@/lib/portal/types'

export default function ConsultaDetalhePage() {
  const params = useParams<{ id: string }>()
  const [consulta, setConsulta] = useState<Consulta | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!params?.id) return
    let alive = true
    setLoading(true)
    buscarConsulta(params.id).then((c) => {
      if (alive) {
        setConsulta(c)
        setLoading(false)
      }
    })
    return () => { alive = false }
  }, [params?.id])

  if (loading) {
    return (
      <div style={{ padding: '24px 20px', maxWidth: 760 }}>
        <Skeleton width={120} height={16} style={{ marginBottom: 16 }} />
        <Skeleton width="60%" height={32} style={{ marginBottom: 28 }} />
        <Skeleton height={160} style={{ marginBottom: 12, borderRadius: tokens.radius['3xl'] }} />
        <Skeleton height={120} style={{ borderRadius: tokens.radius['3xl'] }} />
      </div>
    )
  }

  if (!consulta) {
    return (
      <div style={{ padding: '24px 20px', maxWidth: 760 }}>
        <BackLink />
        <EmptyState title="Consulta não encontrada" description="Talvez ela tenha sido removida." />
      </div>
    )
  }

  return (
    <FadeIn>
      <div style={{ padding: '24px 20px', maxWidth: 760 }}>
        <BackLink />
        <PageHeader
          eyebrow="Consulta"
          title={formatDataLonga(consulta.data)}
          description="O que foi conversado e definido nessa consulta."
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Section titulo="Resumo da consulta" texto={consulta.resumo} />
          <Section titulo="Hipóteses & diagnósticos" texto={consulta.hipoteses} />
          <Section titulo="Conduta e orientações" texto={consulta.conduta} />
          <Section titulo="Outras observações" texto={consulta.observacoes} />
        </div>
      </div>
    </FadeIn>
  )
}

function BackLink() {
  return (
    <Link
      href="/portal/consultas"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        marginBottom: 12,
        fontSize: 13, fontWeight: 500,
        color: tokens.brand.primary, textDecoration: 'none',
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
      Voltar
    </Link>
  )
}

function Section({ titulo, texto }: { titulo: string; texto: string | null | undefined }) {
  if (!texto) return null
  return (
    <Card variant="elevated">
      <div style={{ fontSize: 12, fontWeight: 600, color: tokens.text.tertiary, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 }}>
        {titulo}
      </div>
      <div style={{ fontSize: 15, color: tokens.text.primary, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
        {texto}
      </div>
    </Card>
  )
}
