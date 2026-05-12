'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { tokens } from '@/lib/design-tokens'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { FadeIn } from '@/components/motion/FadeIn'
import { PageHeader } from '../_components/PageHeader'
import { EmptyState } from '../_components/EmptyState'
import { usePortalSession } from '@/lib/portal/session'
import { montarTimeline, type TimelineEvent } from '@/lib/portal/queries'
import { formatDataLonga } from '@/lib/portal/format'

const TIPO_META: Record<TimelineEvent['tipo'], { label: string; cor: string; bg: string }> = {
  consulta:    { label: 'Consulta',     cor: tokens.brand.primary,       bg: tokens.brand.primaryLighter },
  exame:       { label: 'Exame',        cor: tokens.status.infoSkyStrong, bg: tokens.status.infoSkyBgSoft },
  prescricao:  { label: 'Prescrição',   cor: tokens.status.successDark,   bg: tokens.status.successBg },
  documento:   { label: 'Documento',    cor: tokens.text.strong,          bg: tokens.bg.cardSubtle },
  agendamento: { label: 'Agendamento',  cor: tokens.brand.primaryDarkText, bg: tokens.brand.primaryLighter },
}

export default function TimelinePage() {
  const { session, loading: loadingSession } = usePortalSession()
  const [eventos, setEventos] = useState<TimelineEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (loadingSession || !session) return
    let alive = true
    setLoading(true)
    montarTimeline(session.pacienteId).then((evs) => {
      if (alive) {
        setEventos(evs)
        setLoading(false)
      }
    })
    return () => { alive = false }
  }, [session, loadingSession])

  return (
    <FadeIn>
      <div style={{ padding: '24px 20px', maxWidth: 760 }}>
        <PageHeader
          eyebrow="Jornada"
          title="Sua linha do tempo"
          description="Tudo que aconteceu — consultas, exames, prescrições, documentos — ordenado do mais recente."
        />

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} style={{ display: 'flex', gap: 14 }}>
                <Skeleton circle width={36} height={36} />
                <div style={{ flex: 1 }}>
                  <Skeleton width="40%" height={14} style={{ marginBottom: 8 }} />
                  <Skeleton height={64} style={{ borderRadius: tokens.radius['2xl'] }} />
                </div>
              </div>
            ))}
          </div>
        ) : eventos.length === 0 ? (
          <EmptyState
            title="Sua jornada começa aqui"
            description="Conforme você consultar, fizer exames e receber prescrições, tudo vai aparecer nesta linha do tempo."
          />
        ) : (
          <div style={{ position: 'relative' }}>
            <div
              aria-hidden
              style={{
                position: 'absolute',
                left: 17,
                top: 8,
                bottom: 8,
                width: 2,
                background: `linear-gradient(to bottom, ${tokens.border.default} 0%, transparent 100%)`,
              }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {eventos.map((e, idx) => (
                <TimelineRow key={e.id} evento={e} index={idx} />
              ))}
            </div>
          </div>
        )}
      </div>
    </FadeIn>
  )
}

function TimelineRow({ evento, index }: { evento: TimelineEvent; index: number }) {
  const meta = TIPO_META[evento.tipo]
  const content = (
    <Card variant="elevated" padding={16} interactive={!!evento.link}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 4 }}>
        <Badge size="sm" style={{ background: meta.bg, color: meta.cor }}>{meta.label}</Badge>
        <span style={{ fontSize: 12, color: tokens.text.tertiary }}>{formatDataLonga(evento.data)}</span>
      </div>
      <div style={{ fontSize: 16, fontWeight: 600, color: tokens.text.primary, marginTop: 4, lineHeight: 1.3 }}>
        {evento.titulo}
      </div>
      {evento.descricao && (
        <div style={{ fontSize: 13, color: tokens.text.secondary, marginTop: 6, lineHeight: 1.5 }}>
          {evento.descricao.length > 140 ? evento.descricao.slice(0, 140) + '...' : evento.descricao}
        </div>
      )}
    </Card>
  )

  return (
    <FadeIn delay={Math.min(0.05 * index, 0.4)}>
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
        <div
          aria-hidden
          style={{
            width: 36, height: 36, borderRadius: '50%',
            background: tokens.bg.card,
            border: `2px solid ${meta.cor}`,
            color: meta.cor,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
            zIndex: 1,
            position: 'relative',
          }}
        >
          <TipoIcon tipo={evento.tipo} />
        </div>
        <div style={{ flex: 1 }}>
          {evento.link ? (
            <Link href={evento.link} style={{ textDecoration: 'none' }}>{content}</Link>
          ) : (
            content
          )}
        </div>
      </div>
    </FadeIn>
  )
}

function TipoIcon({ tipo }: { tipo: TimelineEvent['tipo'] }) {
  const sp = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none' as const, stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  switch (tipo) {
    case 'consulta':    return <svg {...sp}><path d="M6 2v6a4 4 0 0 0 8 0V2"/><path d="M14 12v2a4 4 0 0 0 8 0v-1"/><circle cx="22" cy="9" r="2"/></svg>
    case 'exame':       return <svg {...sp}><path d="M9 3v6l-5 9a3 3 0 0 0 3 5h10a3 3 0 0 0 3-5l-5-9V3"/><path d="M7 3h10"/></svg>
    case 'prescricao':  return <svg {...sp}><rect x="2" y="9" width="20" height="6" rx="3" transform="rotate(45 12 12)"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
    case 'documento':   return <svg {...sp}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
    case 'agendamento': return <svg {...sp}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
  }
}
