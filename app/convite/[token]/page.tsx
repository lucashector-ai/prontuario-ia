'use client'
/** Convite da equipe: a pessoa abre o link, vê a clínica e cria a própria senha. */
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Eye, EyeOff, UserPlus, CircleAlert } from 'lucide-react'
import { tokens as T } from '@/lib/design-tokens'
import { TelaAcesso } from '@/components/TelaAcesso'
import { Button, Field, Input } from '@/components/ui'
import { SenhaStrength, senhaEhForte } from '@/components/SenhaStrength'
import { guardarToken } from '@/lib/sessao'
import { NOME_CARGO } from '@/lib/cargos'
import { primeiroNome } from '@/lib/nome'

export default function ConvitePage() {
  const { token } = useParams<{ token: string }>()
  const router = useRouter()
  const [dados, setDados] = useState<{ nome: string; email: string; cargo: string; clinica: string | null } | null>(null)
  const [erro, setErro] = useState('')
  const [senha, setSenha] = useState('')
  const [confirma, setConfirma] = useState('')
  const [ver, setVer] = useState(false)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    fetch('/api/convite?token=' + encodeURIComponent(token)).then(async r => {
      const j = await r.json()
      if (!r.ok) setErro(j.error || 'Convite inválido.')
      else setDados(j)
    }).catch(() => setErro('Sem conexão com a internet. Confira e tente de novo.'))
  }, [token])

  async function criar() {
    setErro('')
    if (!senhaEhForte(senha)) return setErro('A senha ainda não atende aos critérios abaixo.')
    if (senha !== confirma) return setErro('As senhas não são iguais.')
    setSalvando(true)
    try {
      const r = await fetch('/api/convite', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, senha }) })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error)
      guardarToken(j.token)
      localStorage.setItem('medico', JSON.stringify(j.medico))
      if (j.clinica) localStorage.setItem('clinica', JSON.stringify(j.clinica))
      localStorage.removeItem('clinica_admin')
      router.replace('/onboarding')
    } catch (e: any) { setErro(e.message || 'Não foi possível criar a senha.') } finally { setSalvando(false) }
  }

  if (!dados) {
    return (
      <TelaAcesso titulo={erro ? 'Convite indisponível' : 'Abrindo o convite…'} descricao={erro || 'Só um instante.'}
        icone={<CircleAlert size={22} strokeWidth={1.6} />} tomIcone={erro ? 'danger' : undefined}>
        {erro && <Button block onClick={() => router.push('/login')}>Ir para o login</Button>}
      </TelaAcesso>
    )
  }

  return (
    <TelaAcesso
      titulo={`Olá, ${primeiroNome(dados.nome, '')}!`}
      descricao={`${dados.clinica || 'A clínica'} convidou você para o Clinical 360 como ${(NOME_CARGO[dados.cargo] || 'Médico').toLowerCase()}. Crie sua senha para entrar.`}
      icone={<UserPlus size={22} strokeWidth={1.6} />}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field label="Seu email (login)"><Input value={dados.email} disabled style={{ minHeight: 44 }} /></Field>
        <Field label="Crie uma senha">
          <div style={{ position: 'relative' }}>
            <Input type={ver ? 'text' : 'password'} value={senha} onChange={e => setSenha(e.target.value)} autoComplete="new-password" autoFocus style={{ minHeight: 44, paddingRight: 42 }} />
            <button type="button" onClick={() => setVer(v => !v)} aria-label={ver ? 'Ocultar senha' : 'Mostrar senha'} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: T.text.tertiary, display: 'flex' }}>
              {ver ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <SenhaStrength senha={senha} />
        </Field>
        <Field label="Repita a senha">
          <Input type={ver ? 'text' : 'password'} value={confirma} onChange={e => setConfirma(e.target.value)} autoComplete="new-password" style={{ minHeight: 44 }} onKeyDown={e => { if (e.key === 'Enter') criar() }} />
        </Field>
        {erro && <div style={{ padding: '10px 12px', borderRadius: 12, background: T.status.dangerBg, color: T.status.danger, fontSize: 13 }}>{erro}</div>}
        <Button size="lg" block onClick={criar} disabled={salvando}>{salvando ? 'Entrando…' : 'Criar senha e entrar'}</Button>
      </div>
    </TelaAcesso>
  )
}
