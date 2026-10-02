'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LockKeyhole, Eye, EyeOff } from 'lucide-react'
import { SenhaStrength, senhaEhForte } from '@/components/SenhaStrength'
import { tokens } from '@/lib/design-tokens'
import { TelaAcesso } from '@/components/TelaAcesso'
import { Field, Input, Button } from '@/components/ui'

import { primeiroNome } from '@/lib/nome'
const T = tokens

export default function TrocarSenhaObrigatoria() {
  const router = useRouter()
  const [medico, setMedico] = useState<any>(null)
  const [senha, setSenha] = useState('')
  const [confirma, setConfirma] = useState('')
  const [showSenha, setShowSenha] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    const m = localStorage.getItem('medico')
    if (!m) { router.push('/login'); return }
    const med = JSON.parse(m)
    if (!med.senha_provisoria) {
      router.push('/onboarding')
      return
    }
    setMedico(med)
  }, [router])

  const salvar = async () => {
    setErro(null)
    if (!senhaEhForte(senha)) return setErro('Senha não atende aos critérios de segurança')
    if (senha !== confirma) return setErro('Senhas não coincidem')

    setSalvando(true)
    try {
      const res = await fetch('/api/trocar-senha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ medico_id: medico.id, senha_nova: senha }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      // Atualiza localStorage com flag desligada
      const novoMedico = { ...medico, senha_provisoria: false }
      localStorage.setItem('medico', JSON.stringify(novoMedico))
      router.push('/onboarding')
    } catch (e: any) {
      setErro(e.message || 'Erro ao salvar')
    } finally {
      setSalvando(false)
    }
  }

  if (!medico) return null

  const naoConfere = !!confirma && senha !== confirma

  return (
    <TelaAcesso
      largura={440}
      titulo="Crie sua senha"
      descricao={`Olá, ${primeiroNome(medico.nome)}! Defina uma senha forte para substituir a provisória.`}
      icone={<LockKeyhole size={22} strokeWidth={1.6} />}
    >
      {erro && (
        <div style={{ background: T.status.dangerBg, color: T.status.danger, padding: '10px 12px', borderRadius: 12, fontSize: 13 }}>
          {erro}
        </div>
      )}

      <Field label="Nova senha">
        <div style={{ position: 'relative' }}>
          <Input
            type={showSenha ? 'text' : 'password'}
            value={senha}
            onChange={e => setSenha(e.target.value)}
            placeholder="Crie uma senha forte"
            autoFocus
            style={{ minHeight: 44, paddingRight: 40 }}
          />
          <button type="button" onClick={() => setShowSenha(s => !s)}
            aria-label={showSenha ? 'Ocultar senha' : 'Mostrar senha'}
            style={{
              position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer', color: T.text.tertiary,
              padding: 0, display: 'flex', alignItems: 'center',
            }}>
            {showSenha ? <EyeOff size={16} strokeWidth={1.6} /> : <Eye size={16} strokeWidth={1.6} />}
          </button>
        </div>
        <SenhaStrength senha={senha} />
      </Field>

      <Field label="Confirmar senha">
        <Input
          type={showSenha ? 'text' : 'password'}
          value={confirma}
          onChange={e => setConfirma(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && salvar()}
          placeholder="Repita a senha"
          style={{ minHeight: 44, ...(naoConfere ? { borderColor: T.status.dangerLightAlt } : {}) }}
        />
        {naoConfere && <span style={{ fontSize: 12, color: T.status.danger }}>Senhas não coincidem</span>}
      </Field>

      <Button size="lg" block onClick={salvar} disabled={salvando}>
        {salvando ? 'Salvando…' : 'Criar senha e continuar'}
      </Button>
    </TelaAcesso>
  )
}
