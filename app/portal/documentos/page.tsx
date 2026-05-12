'use client'

import { useEffect, useMemo, useState } from 'react'
import { tokens } from '@/lib/design-tokens'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Tabs } from '@/components/ui/Tabs'
import { Skeleton } from '@/components/ui/Skeleton'
import { FadeIn } from '@/components/motion/FadeIn'
import { PageHeader } from '../_components/PageHeader'
import { EmptyState } from '../_components/EmptyState'
import { usePortalSession } from '@/lib/portal/session'
import { listarDocumentos } from '@/lib/portal/queries'
import { formatDataLonga } from '@/lib/portal/format'
import type { PortalDocumento } from '@/lib/portal/types'

const TIPO_LABEL: Record<PortalDocumento['tipo'], string> = {
  atestado: 'Atestado',
  receita: 'Receita',
  exame_laudo: 'Laudo',
  recibo: 'Recibo',
  outro: 'Outro',
}

const TIPO_VARIANT: Record<PortalDocumento['tipo'], 'brand' | 'info' | 'success' | 'warning' | 'neutral'> = {
  atestado: 'warning',
  receita: 'success',
  exame_laudo: 'info',
  recibo: 'brand',
  outro: 'neutral',
}

export default function DocumentosPage() {
  const { session, loading: loadingSession } = usePortalSession()
  const [docs, setDocs] = useState<PortalDocumento[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<'todos' | PortalDocumento['tipo']>('todos')

  useEffect(() => {
    if (loadingSession || !session) return
    let alive = true
    setLoading(true)
    listarDocumentos(session.pacienteId).then((d) => {
      if (alive) {
        setDocs(d)
        setLoading(false)
      }
    })
    return () => { alive = false }
  }, [session, loadingSession])

  const filtrados = useMemo(() => {
    if (filtro === 'todos') return docs
    return docs.filter((d) => d.tipo === filtro)
  }, [docs, filtro])

  const tabs = [
    { value: 'todos',       label: 'Todos',    badge: docs.length },
    { value: 'receita',     label: 'Receitas' },
    { value: 'exame_laudo', label: 'Laudos' },
    { value: 'atestado',    label: 'Atestados' },
    { value: 'recibo',      label: 'Recibos' },
  ]

  return (
    <FadeIn>
      <div style={{ padding: '24px 20px', maxWidth: 760 }}>
        <PageHeader
          eyebrow="Documentos"
          title="Todos os seus arquivos"
          description="Atestados, laudos, receitas e recibos — sempre acessíveis."
        />

        <div style={{ marginBottom: 20, overflowX: 'auto' }}>
          <Tabs items={tabs} value={filtro} onChange={(v) => setFiltro(v as typeof filtro)} />
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[0, 1, 2].map((i) => <Skeleton key={i} height={72} style={{ borderRadius: tokens.radius['3xl'] }} />)}
          </div>
        ) : filtrados.length === 0 ? (
          <EmptyState
            title="Nada por aqui ainda"
            description="Documentos enviados pela clínica aparecem nessa página, organizados por tipo."
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtrados.map((d) => (
              <a key={d.id} href={d.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                <Card interactive padding={14}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{
                      width: 40, height: 48,
                      background: tokens.brand.primaryLighter,
                      color: tokens.brand.primary,
                      borderRadius: tokens.radius.md,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <PdfIcon />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <Badge variant={TIPO_VARIANT[d.tipo]} size="sm">{TIPO_LABEL[d.tipo]}</Badge>
                        {d.assinado_em && <Badge variant="success" size="sm" dot>Assinado</Badge>}
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: tokens.text.primary, marginBottom: 2 }}>{d.titulo}</div>
                      <div style={{ fontSize: 12, color: tokens.text.tertiary }}>{formatDataLonga(d.criado_em)}</div>
                    </div>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={tokens.text.tertiary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                      <polyline points="15 3 21 3 21 9"/>
                      <line x1="10" y1="14" x2="21" y2="3"/>
                    </svg>
                  </div>
                </Card>
              </a>
            ))}
          </div>
        )}
      </div>
    </FadeIn>
  )
}

function PdfIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
    </svg>
  )
}
