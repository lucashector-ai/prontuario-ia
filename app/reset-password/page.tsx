'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LockKeyhole, CircleCheck } from 'lucide-react'
import { supabase, supabaseAuth } from '@/lib/supabase'
import { tokens } from '@/lib/design-tokens'
import { TelaAcesso } from '@/components/TelaAcesso'
import { Field, Input, Button } from '@/components/ui'

export default function ResetPasswordPage() {
  const [senha, setSenha] = useState('')
  const [confirma, setConfirma] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [ok, setOk] = useState(false)
  const router = useRouter()

  async function salvar() {
    if (senha.length < 6) return setErro('Senha deve ter pelo menos 6 caracteres')
    if (senha !== confirma) return setErro('Senhas nao coincidem')
    setLoading(true)
    const { error } = await supabaseAuth.auth.updateUser({ password: senha })
    setLoading(false)
    if (error) setErro(error.message)
    else { setOk(true); setTimeout(() => router.push('/dashboard'), 2000) }
  }

  if (ok) {
    return (
      <TelaAcesso
        titulo="Senha alterada"
        descricao="Redirecionando…"
        icone={<CircleCheck size={22} strokeWidth={1.6} />}
        tomIcone="success"
      />
    )
  }

  return (
    <TelaAcesso
      titulo="Nova senha"
      descricao="Digite sua nova senha abaixo."
      icone={<LockKeyhole size={22} strokeWidth={1.6} />}
    >
      <Field label="Nova senha">
        <Input type="password" placeholder="Mínimo de 6 caracteres" value={senha} autoFocus
          onChange={e => setSenha(e.target.value)} style={{ minHeight: 44 }} />
      </Field>
      <Field label="Confirmar nova senha">
        <Input type="password" placeholder="Repita a senha" value={confirma}
          onChange={e => setConfirma(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && salvar()} style={{ minHeight: 44 }} />
      </Field>
      {erro && <p style={{ fontSize: 13, color: tokens.status.danger, margin: 0 }}>{erro}</p>}
      <Button size="lg" block onClick={salvar} disabled={loading}>
        {loading ? 'Salvando…' : 'Salvar nova senha'}
      </Button>
    </TelaAcesso>
  )
}
