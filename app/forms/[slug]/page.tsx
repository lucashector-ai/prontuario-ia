'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { tokens } from '@/lib/design-tokens'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { FadeIn } from '@/components/motion/FadeIn'
import { buscarFormPorSlug, submeterForm } from '@/lib/crm/queries'
import type { CampoForm, CrmForm } from '@/lib/crm/types'

export default function FormPublicoPage() {
  const params = useParams<{ slug: string }>()
  const [form, setForm] = useState<CrmForm | null>(null)
  const [loading, setLoading] = useState(true)
  const [dados, setDados] = useState<Record<string, string>>({})
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  const [enviado, setEnviado] = useState(false)

  useEffect(() => {
    if (!params?.slug) return
    let alive = true
    buscarFormPorSlug(params.slug).then((f) => {
      if (alive) {
        setForm(f)
        setLoading(false)
      }
    })
    return () => { alive = false }
  }, [params?.slug])

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    if (!form) return
    setErro('')
    setEnviando(true)
    const res = await submeterForm(form.slug, dados)
    setEnviando(false)
    if (!res.ok) { setErro(res.error || 'Erro ao enviar.'); return }
    setEnviado(true)
  }

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: `radial-gradient(ellipse at top, ${tokens.brand.primaryLighter} 0%, transparent 60%), ${tokens.bg.page}`,
        padding: 24,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
      }}
    >
      <div style={{ width: '100%', maxWidth: 480 }}>
        {loading ? (
          <Card variant="elevated" padding={28}>
            <Skeleton width={140} height={14} style={{ marginBottom: 12 }} />
            <Skeleton width="80%" height={26} style={{ marginBottom: 8 }} />
            <Skeleton width="60%" height={14} style={{ marginBottom: 24 }} />
            <Skeleton height={50} style={{ marginBottom: 12, borderRadius: tokens.radius.lg }} />
            <Skeleton height={50} style={{ marginBottom: 12, borderRadius: tokens.radius.lg }} />
            <Skeleton height={50} style={{ marginBottom: 16, borderRadius: tokens.radius.lg }} />
            <Skeleton height={44} style={{ borderRadius: tokens.radius.lg }} />
          </Card>
        ) : !form ? (
          <Card variant="elevated" padding={28}>
            <h1 style={{ fontSize: 18, fontWeight: 600, color: tokens.text.primary, margin: 0 }}>
              Formulário não encontrado
            </h1>
            <p style={{ fontSize: 14, color: tokens.text.secondary, marginTop: 8 }}>
              Esse link pode ter sido desativado.
            </p>
          </Card>
        ) : enviado ? (
          <FadeIn>
            <Card variant="elevated" padding={32} style={{ textAlign: 'center' }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%',
                background: tokens.status.successBg, color: tokens.status.success,
                margin: '0 auto 16px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <h1 style={{ fontSize: 20, fontWeight: 600, color: tokens.text.primary, margin: 0, marginBottom: 8 }}>
                Tudo certo!
              </h1>
              <p style={{ fontSize: 14, color: tokens.text.secondary, margin: 0, lineHeight: 1.55 }}>
                {form.mensagem_sucesso}
              </p>
            </Card>
          </FadeIn>
        ) : (
          <FadeIn>
            <Card variant="elevated" padding={28}>
              <header style={{ marginBottom: 20 }}>
                <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: tokens.text.primary, letterSpacing: -0.3, lineHeight: 1.2 }}>
                  {form.titulo}
                </h1>
                {form.descricao && (
                  <p style={{ margin: '8px 0 0', fontSize: 14, color: tokens.text.secondary, lineHeight: 1.5 }}>
                    {form.descricao}
                  </p>
                )}
              </header>

              <form onSubmit={enviar} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {(form.campos as CampoForm[]).map((c) => (
                  <CampoRender
                    key={c.nome}
                    campo={c}
                    valor={dados[c.nome] || ''}
                    onChange={(v) => setDados((d) => ({ ...d, [c.nome]: v }))}
                  />
                ))}

                {erro && (
                  <div style={{ padding: 10, background: tokens.status.dangerBg, color: tokens.status.dangerDark, borderRadius: tokens.radius.md, fontSize: 13 }}>
                    {erro}
                  </div>
                )}

                <Button type="submit" loading={enviando} fullWidth size="lg">Enviar</Button>

                <div style={{ textAlign: 'center', fontSize: 11, color: tokens.text.tertiary, marginTop: 4 }}>
                  Powered by <strong style={{ fontWeight: 600, color: tokens.text.strong }}>Clinical 360</strong>
                </div>
              </form>
            </Card>
          </FadeIn>
        )}
      </div>
    </div>
  )
}

function CampoRender({ campo, valor, onChange }: { campo: CampoForm; valor: string; onChange: (v: string) => void }) {
  if (campo.tipo === 'textarea') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={{ fontSize: 13, fontWeight: 500, color: tokens.text.strong }}>
          {campo.label} {campo.obrigatorio && <span style={{ color: tokens.status.danger }}>*</span>}
        </label>
        <textarea
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          required={campo.obrigatorio}
          rows={3}
          style={{
            padding: 12,
            border: `1px solid ${tokens.border.default}`,
            borderRadius: tokens.radius.lg,
            fontSize: 14,
            fontFamily: 'inherit',
            outline: 'none',
            resize: 'vertical',
            minHeight: 80,
          }}
        />
      </div>
    )
  }
  if (campo.tipo === 'select') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={{ fontSize: 13, fontWeight: 500, color: tokens.text.strong }}>
          {campo.label} {campo.obrigatorio && <span style={{ color: tokens.status.danger }}>*</span>}
        </label>
        <select
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          required={campo.obrigatorio}
          style={{
            height: 42, padding: '0 12px',
            border: `1px solid ${tokens.border.default}`, borderRadius: tokens.radius.lg,
            fontSize: 14, background: tokens.bg.card, color: tokens.text.primary, outline: 'none',
          }}
        >
          <option value="">Selecione...</option>
          {(campo.opcoes || []).map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
    )
  }
  const tipo = campo.tipo === 'email' ? 'email' : campo.tipo === 'telefone' ? 'tel' : 'text'
  return (
    <Input
      label={campo.obrigatorio ? `${campo.label} *` : campo.label}
      type={tipo}
      value={valor}
      onChange={(e) => onChange(e.target.value)}
      required={campo.obrigatorio}
    />
  )
}
