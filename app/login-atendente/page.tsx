'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MessageCircle } from 'lucide-react'
import { tokens } from '@/lib/design-tokens'
import { TelaAcesso } from '@/components/TelaAcesso'
import { Field, Input, Button } from '@/components/ui'
import { guardarToken } from '@/lib/sessao'

export default function LoginAtendente() {
  const router = useRouter()
  const [form, setForm] = useState({ email: '', senha: '' })
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setErro('')
    try {
      const res = await fetch('/api/atendentes/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })
      const data = await res.json()
      if (data.atendente) {
        guardarToken(data.token)
        localStorage.setItem('atendente', JSON.stringify(data.atendente))
        localStorage.setItem('medico', JSON.stringify({
          id: data.atendente.medico_id,
          nome: data.atendente.nome,
          cargo: data.atendente.cargo,
          is_atendente: true
        }))
        // Seta cookie para middleware proteger rotas
        document.cookie = 'is_atendente=true; path=/; max-age=86400'
        document.cookie = 'medico_id=' + data.atendente.medico_id + '; path=/; max-age=86400'
        // O WhatsApp antigo foi desativado — a equipe de atendimento usa o Chat novo
        router.push('/chat')
      } else {
        setErro(data.error || 'Email ou senha incorretos')
      }
    } catch { setErro('Erro de conexão') }
    finally { setLoading(false) }
  }

  return (
    <TelaAcesso
      titulo="Entrar no Chat"
      descricao="Acesso da equipe de atendimento"
      icone={<MessageCircle size={22} strokeWidth={1.6} />}
      rodape={<>É médico? <a href="/login" style={{ color: tokens.brand.primary, textDecoration: 'none', fontWeight: 600 }}>Acesso médico</a></>}
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field label="E-mail">
          <Input
            type="email" required value={form.email} autoFocus
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            placeholder="seu@email.com"
            style={{ minHeight: 44 }}
          />
        </Field>
        <Field label="Senha">
          <Input
            type="password" required value={form.senha}
            onChange={e => setForm(f => ({ ...f, senha: e.target.value }))}
            placeholder="••••••••"
            style={{ minHeight: 44 }}
          />
        </Field>
        {erro && <p style={{ fontSize: 13, color: tokens.status.danger, margin: 0, textAlign: 'center' }}>{erro}</p>}
        <Button type="submit" size="lg" block disabled={loading} style={{ marginTop: 4 }}>
          {loading ? 'Entrando…' : 'Entrar'}
        </Button>
      </form>
    </TelaAcesso>
  )
}
