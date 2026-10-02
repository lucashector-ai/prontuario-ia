'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { MailCheck, Check, Copy, ArrowRight, Wrench } from 'lucide-react'
import { tokens } from '@/lib/design-tokens'
import { TelaAcesso } from '@/components/TelaAcesso'
import { Button } from '@/components/ui'

const T = tokens

function Content() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [copiado, setCopiado] = useState(false)

  const token = searchParams?.get('token') || ''
  const tipo = searchParams?.get('tipo') || 'medico'
  const email = searchParams?.get('email') || ''

  const linkVerificar = typeof window !== 'undefined'
    ? `${window.location.origin}/verificar-email?token=${token}&tipo=${tipo}`
    : ''

  useEffect(() => {
    if (!token) router.push('/login')
  }, [token, router])

  const copiarLink = () => {
    navigator.clipboard.writeText(linkVerificar)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  const irAgora = () => {
    router.push(`/verificar-email?token=${token}&tipo=${tipo}`)
  }

  return (
    <TelaAcesso
      largura={460}
      titulo="Conta criada"
      descricao={<>Enviamos um link de confirmação para <strong style={{ color: T.text.primary, fontWeight: 600, wordBreak: 'break-all' }}>{email}</strong></>}
      icone={<MailCheck size={22} strokeWidth={1.6} />}
      tomIcone="success"
      rodape="O link expira em 48 horas"
    >
      <div style={{ background: T.status.warningBg, borderRadius: 12, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: T.status.warning }}>
          <Wrench size={13} strokeWidth={1.6} /> Modo desenvolvimento
        </div>
        <p style={{ fontSize: 12.5, color: T.text.muted, margin: 0, lineHeight: 1.55 }}>
          Ainda estamos integrando o envio de e-mail. Por enquanto, use o link abaixo para confirmar sua conta.
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            readOnly
            value={linkVerificar}
            className="mono"
            style={{
              flex: 1, minWidth: 0, height: 32, padding: '0 10px', fontSize: 11,
              border: `1px solid ${T.border.default}`, borderRadius: 9,
              background: '#fff', color: T.text.secondary, outline: 'none',
            }}
          />
          <Button size="sm" variant="secondary" icon={copiado ? Check : Copy} onClick={copiarLink}
            style={copiado ? { color: T.status.success } : undefined}>
            {copiado ? 'Copiado' : 'Copiar'}
          </Button>
        </div>
      </div>

      <Button size="lg" block iconRight={ArrowRight} onClick={irAgora}>
        Confirmar conta agora
      </Button>
    </TelaAcesso>
  )
}

export default function CadastroSucesso() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100dvh', background: tokens.bg.page }} />}>
      <Content />
    </Suspense>
  )
}
