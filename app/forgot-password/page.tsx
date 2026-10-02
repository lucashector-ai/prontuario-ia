'use client'
import { useState } from 'react'
import Link from 'next/link'
import { KeyRound, MailCheck, ArrowLeft } from 'lucide-react'
import { tokens } from '@/lib/design-tokens'
import { TelaAcesso } from '@/components/TelaAcesso'
import { Field, Input, Button } from '@/components/ui'

const linkVoltar: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, justifyContent: 'center',
  color: tokens.brand.primary, fontSize: 13.5, fontWeight: 600, textDecoration: 'none',
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [enviado, setEnviado] = useState(false)
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)

  async function enviar() {
    if (!email) return setErro('Digite seu email')
    setLoading(true); setErro('')
    try {
      const res = await fetch('/api/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (data.ok) setEnviado(true)
      else setErro(data.error || 'Email nao encontrado')
    } catch { setErro('Erro de conexao') }
    finally { setLoading(false) }
  }

  if (enviado) {
    return (
      <TelaAcesso
        titulo="E-mail enviado"
        descricao="Verifique sua caixa de entrada e a pasta de spam para redefinir sua senha."
        icone={<MailCheck size={22} strokeWidth={1.6} />}
        tomIcone="success"
      >
        <Link href="/login" style={linkVoltar}><ArrowLeft size={15} strokeWidth={1.6} /> Voltar ao login</Link>
      </TelaAcesso>
    )
  }

  return (
    <TelaAcesso
      titulo="Recuperar senha"
      descricao="Enviaremos um link de recuperação para o seu e-mail."
      icone={<KeyRound size={22} strokeWidth={1.6} />}
      rodape={<Link href="/login" style={linkVoltar}><ArrowLeft size={15} strokeWidth={1.6} /> Voltar ao login</Link>}
    >
      <Field label="E-mail">
        <Input type="email" placeholder="seu@email.com" value={email} autoFocus
          onChange={e => setEmail(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && enviar()}
          style={{ minHeight: 44 }} />
      </Field>
      {erro && <p style={{ fontSize: 13, color: tokens.status.danger, margin: 0 }}>{erro}</p>}
      <Button size="lg" block onClick={enviar} disabled={loading}>
        {loading ? 'Enviando…' : 'Enviar link de recuperação'}
      </Button>
    </TelaAcesso>
  )
}
