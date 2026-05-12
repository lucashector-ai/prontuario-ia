'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { tokens } from '@/lib/design-tokens'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { FadeIn } from '@/components/motion/FadeIn'
import { requestMagicLink, verifyMagicLink, readPortalSession } from '@/lib/portal/session'

type Step = 'email' | 'token' | 'verifying'

export default function PortalLoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginInner />
    </Suspense>
  )
}

function LoginFallback() {
  return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: tokens.bg.page }}>
      <div style={{ color: tokens.text.tertiary, fontSize: 14 }}>Carregando...</div>
    </div>
  )
}

function LoginInner() {
  const router = useRouter()
  const search = useSearchParams()
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  useEffect(() => {
    if (readPortalSession()) {
      router.replace('/portal')
      return
    }
    const qEmail = search?.get('email')
    const qToken = search?.get('token')
    if (qEmail && qToken) {
      setEmail(qEmail)
      setToken(qToken)
      setStep('verifying')
      void doVerify(qEmail, qToken)
    }
  }, [router, search])

  async function doSendLink(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setInfo('')
    setLoading(true)
    try {
      await requestMagicLink(email)
      setStep('token')
      setInfo('Enviamos um link de acesso pro seu email. Cole o código abaixo se preferir.')
    } catch (err: any) {
      setError(err.message || 'Não consegui enviar agora.')
    } finally {
      setLoading(false)
    }
  }

  async function doVerify(emailArg?: string, tokenArg?: string) {
    setError('')
    setLoading(true)
    try {
      const sess = await verifyMagicLink(emailArg || email, tokenArg || token)
      if (sess) {
        router.replace('/portal')
      } else {
        setError('Código inválido ou expirado.')
        setStep('token')
      }
    } catch {
      setError('Não consegui validar agora.')
      setStep('token')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: `radial-gradient(circle at 20% 0%, ${tokens.brand.primaryLighter} 0%, transparent 50%), radial-gradient(circle at 80% 100%, ${tokens.brand.primaryAccentLight} 0%, transparent 50%), ${tokens.bg.page}`,
        padding: 24,
      }}
    >
      <FadeIn style={{ width: '100%', maxWidth: 420 }}>
        <Card variant="elevated" padding={32}>
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div
              aria-hidden
              style={{
                width: 52, height: 52, borderRadius: 16,
                background: tokens.brand.primary,
                color: tokens.text.inverse,
                margin: '0 auto 16px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 22, fontWeight: 700,
              }}
            >
              C
            </div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: tokens.text.primary, letterSpacing: -0.3 }}>
              Portal do paciente
            </h1>
            <p style={{ margin: '6px 0 0', fontSize: 14, color: tokens.text.secondary, lineHeight: 1.5 }}>
              {step === 'email'
                ? 'Entre com seu email cadastrado na clínica.'
                : 'Cole o código de 6 dígitos que enviamos pra você.'}
            </p>
          </div>

          {step === 'email' && (
            <form onSubmit={doSendLink} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Input
                label="Email"
                type="email"
                placeholder="voce@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                autoComplete="email"
                error={error}
              />
              <Button type="submit" loading={loading} fullWidth size="lg">
                Enviar link de acesso
              </Button>
            </form>
          )}

          {step === 'token' && (
            <form onSubmit={(e) => { e.preventDefault(); doVerify() }} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {info && (
                <div style={{ padding: 12, background: tokens.brand.primaryLighter, borderRadius: tokens.radius.lg, fontSize: 13, color: tokens.brand.primaryDarkText, lineHeight: 1.45 }}>
                  {info}
                </div>
              )}
              <Input
                label="Código"
                placeholder="000000"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                required
                autoFocus
                inputMode="numeric"
                maxLength={6}
                style={{ letterSpacing: 6, textAlign: 'center', fontSize: 18, fontWeight: 600 }}
                error={error}
              />
              <Button type="submit" loading={loading} fullWidth size="lg">
                Entrar
              </Button>
              <button
                type="button"
                onClick={() => { setStep('email'); setError(''); setInfo(''); setToken('') }}
                style={{ background: 'transparent', border: 'none', color: tokens.text.tertiary, fontSize: 13, cursor: 'pointer', padding: 8 }}
              >
                Usar outro email
              </button>
            </form>
          )}

          {step === 'verifying' && (
            <div style={{ textAlign: 'center', padding: '20px 0', color: tokens.text.secondary, fontSize: 14 }}>
              Validando seu acesso...
            </div>
          )}
        </Card>

        <p style={{ marginTop: 16, textAlign: 'center', fontSize: 12, color: tokens.text.tertiary, lineHeight: 1.5 }}>
          Sua privacidade é protegida. Mais detalhes em{' '}
          <a href="/privacidade" style={{ color: tokens.brand.primary, textDecoration: 'none', fontWeight: 500 }}>Privacidade</a>.
        </p>
      </FadeIn>
    </div>
  )
}
