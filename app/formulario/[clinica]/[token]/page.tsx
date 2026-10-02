'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import type { LucideIcon } from 'lucide-react'
import { CircleAlert, CircleCheck, Link2Off, Send } from 'lucide-react'
import { tokens } from '@/lib/design-tokens'
import { Button, IconTile, ProgressBar } from '@/components/ui'
import { CascaPublica, Spinner, cartaoPublico } from '@/components/publico/CascaPublica'
import RenderizadorCampo from './RenderizadorCampo'

const T = tokens
import type { Campo } from '@/lib/formularios/types'

type Estado = 'loading' | 'preencher' | 'enviado' | 'erro' | 'ja_preenchido'

type DadosForm = {
  envio: { id: string; nome_paciente: string; expira_em: string }
  template: { id: string; nome: string; descricao: string | null; campos: Campo[] }
  clinica: { nome: string; logo_url: string | null }
  medico: { nome: string; especialidade: string | null } | null
}

export default function FormularioPublicoPage() {
  const params = useParams()
  const clinicaSlug = params.clinica as string
  const token = params.token as string

  const [estado, setEstado] = useState<Estado>('loading')
  const [mensagemErro, setMensagemErro] = useState<string>('')
  const [dados, setDados] = useState<DadosForm | null>(null)
  const [respostas, setRespostas] = useState<Record<string, any>>({})
  const [enviando, setEnviando] = useState(false)
  const [erroValidacao, setErroValidacao] = useState<string | null>(null)

  useEffect(() => {
    async function carregar() {
      try {
        const res = await fetch(`/api/formularios/buscar?token=${token}&clinica=${clinicaSlug}`)
        const data = await res.json()

        if (res.status === 409) {
          setEstado('ja_preenchido')
          return
        }
        if (!res.ok || data.erro) {
          setMensagemErro(data.erro || 'Link inválido')
          setEstado('erro')
          return
        }
        setDados(data as DadosForm)
        setEstado('preencher')
      } catch (e: any) {
        setMensagemErro(e.message || 'Erro ao carregar')
        setEstado('erro')
      }
    }
    carregar()
  }, [clinicaSlug, token])

  function atualizarResposta(campoId: string, valor: any) {
    setRespostas(prev => ({ ...prev, [campoId]: valor }))
    setErroValidacao(null)
  }

  async function enviar() {
    if (!dados) return
    setEnviando(true)
    setErroValidacao(null)
    try {
      const res = await fetch('/api/formularios/responder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, respostas }),
      })
      const data = await res.json()
      if (!data.sucesso) {
        setErroValidacao(data.erro || 'Erro ao enviar')
        setEnviando(false)
        return
      }
      setEstado('enviado')
    } catch (e: any) {
      setErroValidacao(e.message || 'Erro ao enviar')
      setEnviando(false)
    }
  }

  // Estados
  if (estado === 'loading') {
    return (
      <CascaPublica largura={640} rodape={false}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '64px 0', color: T.text.quaternary, fontSize: 13 }}>
          <Spinner tamanho={28} />
          Carregando formulário…
        </div>
      </CascaPublica>
    )
  }

  if (estado === 'erro') {
    return <TelaInfo icone={Link2Off} tom="erro" titulo="Link inválido" descricao={mensagemErro || 'Este link expirou ou não é mais válido.'} />
  }

  if (estado === 'ja_preenchido') {
    return <TelaInfo icone={CircleCheck} tom="ok" titulo="Formulário já preenchido" descricao="Esse formulário já foi respondido. Se precisar enviar de novo, peça ao seu médico um novo link." />
  }

  if (estado === 'enviado') {
    return <TelaInfo icone={CircleCheck} tom="ok" clinica={dados?.clinica} titulo="Respostas enviadas" descricao="Obrigado! Suas respostas foram enviadas com sucesso. Seu médico vai analisar antes da consulta." />
  }

  // Estado: preencher
  if (!dados) return null
  const totalCampos = dados.template.campos.length
  const totalPreenchidos = dados.template.campos.filter(c => {
    const v = respostas[c.id]
    return v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0)
  }).length
  const progresso = totalCampos ? Math.round((totalPreenchidos / totalCampos) * 100) : 0

  return (
    <CascaPublica clinica={dados.clinica} largura={640}>
      <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Cabeçalho do formulário */}
        <div style={{ ...cartaoPublico, padding: '22px 20px 18px' }}>
          {dados.medico && (
            <div style={{ fontSize: 12.5, color: T.text.quaternary, marginBottom: 6 }}>
              Dr(a). {dados.medico.nome}
              {dados.medico.especialidade && ' · ' + dados.medico.especialidade}
            </div>
          )}
          <h1 style={{ fontSize: 20, fontWeight: 700, color: T.text.primary, margin: 0, letterSpacing: '-.01em', lineHeight: 1.25 }}>
            {dados.template.nome}
          </h1>
          {dados.template.descricao && (
            <p style={{ fontSize: 14, color: T.text.secondary, margin: '8px 0 0', lineHeight: 1.5 }}>
              {dados.template.descricao}
            </p>
          )}
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <ProgressBar valor={progresso} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: T.text.quaternary }}>
              <span>{totalPreenchidos} de {totalCampos} preenchidas</span>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{progresso}%</span>
            </div>
          </div>
        </div>

        {/* Perguntas — uma por card */}
        {dados.template.campos.map((campo, idx) => (
          <div key={campo.id} style={{ background: T.bg.card, border: `1px solid ${T.border.default}`, borderRadius: T.radius['2xl'], padding: '18px 18px 20px' }}>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 14.5, fontWeight: 600, color: T.text.primary, display: 'flex', gap: 8, lineHeight: 1.4 }}>
                <span className="mono" style={{ color: T.text.tertiary, fontSize: 12.5, fontWeight: 500, paddingTop: 2, flexShrink: 0 }}>{String(idx + 1).padStart(2, '0')}</span>
                <span>
                  {campo.label}
                  {campo.obrigatorio && <span style={{ color: T.status.danger, marginLeft: 4 }}>*</span>}
                </span>
              </label>
              {campo.descricao && (
                <div style={{ fontSize: 13, color: T.text.quaternary, marginTop: 4, lineHeight: 1.45 }}>
                  {campo.descricao}
                </div>
              )}
            </div>
            <RenderizadorCampo
              campo={campo}
              valor={respostas[campo.id]}
              onChange={(v) => atualizarResposta(campo.id, v)}
            />
          </div>
        ))}

        {/* Erro de validação */}
        {erroValidacao && (
          <div role="alert" style={{
            display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px',
            background: T.status.dangerBg, borderRadius: T.radius.input,
            color: T.status.danger, fontSize: 13, fontWeight: 600, lineHeight: 1.45,
          }}>
            <CircleAlert size={16} strokeWidth={1.6} style={{ flexShrink: 0, marginTop: 1 }} />
            {erroValidacao}
          </div>
        )}

        {/* Enviar */}
        <Button size="lg" block icon={Send} onClick={enviar} disabled={enviando} style={{ marginTop: 4 }}>
          {enviando ? 'Enviando…' : 'Enviar respostas'}
        </Button>
      </div>
    </CascaPublica>
  )
}

function TelaInfo({ icone, tom, titulo, descricao, clinica }: {
  icone: LucideIcon
  tom: 'ok' | 'erro'
  titulo: string
  descricao?: string
  clinica?: { nome: string; logo_url: string | null } | null
}) {
  const ok = tom === 'ok'
  return (
    <CascaPublica clinica={clinica} largura={640}>
      <div style={{ ...cartaoPublico, maxWidth: 440, margin: '0 auto', padding: '34px 24px 30px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        <IconTile
          icon={icone}
          size={60}
          radius={18}
          color={ok ? T.status.success : T.status.danger}
          style={{ marginBottom: 10, background: ok ? T.status.successBg : T.status.dangerBg }}
        />
        <h2 style={{ fontSize: 20, fontWeight: 700, color: T.text.primary, margin: 0, letterSpacing: '-.01em' }}>
          {titulo}
        </h2>
        {descricao && (
          <p style={{ fontSize: 14, color: T.text.secondary, margin: 0, lineHeight: 1.55 }}>
            {descricao}
          </p>
        )}
      </div>
    </CascaPublica>
  )
}
