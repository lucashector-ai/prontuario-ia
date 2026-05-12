'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { tokens } from '@/lib/design-tokens'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { Badge } from '@/components/ui/Badge'
import { FadeIn } from '@/components/motion/FadeIn'
import { PageHeader } from '../../_components/PageHeader'
import { EmptyState } from '../../_components/EmptyState'
import { buscarExame } from '@/lib/portal/queries'
import { formatDataLonga } from '@/lib/portal/format'
import type { Exame } from '@/lib/portal/types'

export default function ExameDetalhePage() {
  const params = useParams<{ id: string }>()
  const [exame, setExame] = useState<Exame | null>(null)
  const [loading, setLoading] = useState(true)
  const [explicando, setExplicando] = useState(false)
  const [explicacao, setExplicacao] = useState<string | null>(null)
  const [errExp, setErrExp] = useState('')

  useEffect(() => {
    if (!params?.id) return
    let alive = true
    setLoading(true)
    buscarExame(params.id).then((e) => {
      if (alive) {
        setExame(e)
        setLoading(false)
      }
    })
    return () => { alive = false }
  }, [params?.id])

  async function explicar() {
    if (!exame) return
    setExplicando(true)
    setErrExp('')
    try {
      const res = await fetch('/api/portal/explicar-exame', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exameId: exame.id,
          nome: exame.nome,
          resultado: exame.resultado_texto,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErrExp(data.error || 'Não consegui explicar agora.')
      } else {
        setExplicacao(data.explicacao || null)
      }
    } catch {
      setErrExp('Erro de conexão.')
    } finally {
      setExplicando(false)
    }
  }

  if (loading) {
    return (
      <div style={{ padding: '24px 20px', maxWidth: 760 }}>
        <Skeleton width={120} height={16} style={{ marginBottom: 16 }} />
        <Skeleton width="60%" height={32} style={{ marginBottom: 28 }} />
        <Skeleton height={200} style={{ borderRadius: tokens.radius['3xl'] }} />
      </div>
    )
  }

  if (!exame) {
    return (
      <div style={{ padding: '24px 20px', maxWidth: 760 }}>
        <BackLink />
        <EmptyState title="Exame não encontrado" />
      </div>
    )
  }

  return (
    <FadeIn>
      <div style={{ padding: '24px 20px', maxWidth: 760 }}>
        <BackLink />
        <PageHeader
          eyebrow="Exame"
          title={exame.nome || 'Exame'}
          description={`Realizado em ${formatDataLonga(exame.data_realizacao || exame.criado_em)}`}
        />

        {exame.laudo_url && (
          <Card variant="elevated" style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: tokens.text.primary, marginBottom: 4 }}>Laudo em PDF</div>
                <div style={{ fontSize: 13, color: tokens.text.tertiary }}>Abre em nova aba</div>
              </div>
              <a href={exame.laudo_url} target="_blank" rel="noopener noreferrer">
                <Button variant="secondary" rightIcon={<ExternalIcon />}>Abrir</Button>
              </a>
            </div>
          </Card>
        )}

        {exame.resultado_texto && (
          <Card variant="elevated" style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: tokens.text.tertiary, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 }}>
              Resultado
            </div>
            <div style={{ fontSize: 14, color: tokens.text.primary, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
              {exame.resultado_texto}
            </div>
          </Card>
        )}

        <Card style={{ background: tokens.brand.primaryLighter, border: `1px solid ${tokens.brand.primaryAccentSoft}` }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: tokens.brand.primary, color: tokens.text.inverse,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <SparklesIcon />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 15, fontWeight: 600, color: tokens.text.primary }}>Entenda em linguagem simples</span>
                <Badge variant="brand" size="sm">IA</Badge>
              </div>
              <div style={{ fontSize: 13, color: tokens.brand.primaryDarkText, lineHeight: 1.5 }}>
                A Clinical 360 traduz o resultado pra termos que qualquer pessoa entende — sem substituir a explicação do seu médico.
              </div>
            </div>
          </div>

          {explicacao ? (
            <div style={{ background: tokens.bg.card, padding: 16, borderRadius: tokens.radius.xl, fontSize: 14, color: tokens.text.primary, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
              {explicacao}
            </div>
          ) : (
            <>
              <Button onClick={explicar} loading={explicando} fullWidth>
                Explicar pra mim
              </Button>
              {errExp && (
                <div style={{ marginTop: 10, fontSize: 13, color: tokens.status.dangerDark }}>
                  {errExp}
                </div>
              )}
            </>
          )}
        </Card>
      </div>
    </FadeIn>
  )
}

function BackLink() {
  return (
    <Link
      href="/portal/exames"
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

function ExternalIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
}

function SparklesIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.6 4.5L18 9l-4.4 1.5L12 15l-1.6-4.5L6 9l4.4-1.5z"/><path d="M19 13l.7 1.7L21 15l-1.3.3L19 17l-.7-1.7L17 15l1.3-.3z"/><path d="M5 17l.7 1.7L7 19l-1.3.3L5 21l-.7-1.7L3 19l1.3-.3z"/></svg>
}
