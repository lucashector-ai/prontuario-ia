'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { tokens } from '@/lib/design-tokens'
import RenderizadorCampo from './RenderizadorCampo'
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
    return <TelaInfo icone="⏳" titulo="Carregando..." />
  }

  if (estado === 'erro') {
    return <TelaInfo icone="erro" titulo="Link inválido" descricao={mensagemErro || 'Este link expirou ou não é mais válido.'} />
  }

  if (estado === 'ja_preenchido') {
    return <TelaInfo icone="ok" titulo="Formulário já preenchido" descricao="Esse formulário já foi respondido. Se precisar enviar de novo, peça ao seu médico um novo link." />
  }

  if (estado === 'enviado') {
    return <TelaInfo icone="ok" titulo="Respostas enviadas!" descricao="Obrigado! Suas respostas foram enviadas com sucesso. Seu médico vai analisar antes da consulta." />
  }

  // Estado: preencher
  if (!dados) return null
  const totalCampos = dados.template.campos.length
  const totalPreenchidos = dados.template.campos.filter(c => {
    const v = respostas[c.id]
    return v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0)
  }).length

  return (
    <div style={{ minHeight: '100vh', background: tokens.bg.page, padding: '24px 16px 80px' }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: 24, textAlign: 'center' }}>
          <div style={{
            width: 56,
            height: 56,
            margin: '0 auto 16px',
            background: tokens.brand.primary,
            color: '#fff',
            borderRadius: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: '-0.01em',
          }}>
            {dados.clinica.nome.charAt(0).toUpperCase()}
          </div>
          <div style={{ fontSize: 13, color: tokens.text.tertiary, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            {dados.clinica.nome}
          </div>
          {dados.medico && (
            <div style={{ fontSize: 14, color: tokens.text.secondary, marginTop: 4 }}>
              Dr(a). {dados.medico.nome}
              {dados.medico.especialidade && ' · ' + dados.medico.especialidade}
            </div>
          )}
        </div>

        {/* Card do formulário */}
        <div style={{
          background: '#fff',
          borderRadius: 18,
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          overflow: 'hidden',
        }}>
          {/* Header do card */}
          <div style={{ padding: '28px 24px 20px', borderBottom: '1px solid ' + tokens.border.subtle }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: tokens.text.primary, margin: 0, letterSpacing: '-0.01em' }}>
              {dados.template.nome}
            </h1>
            {dados.template.descricao && (
              <p style={{ fontSize: 14, color: tokens.text.secondary, margin: '8px 0 0', lineHeight: 1.5 }}>
                {dados.template.descricao}
              </p>
            )}
            <div style={{ marginTop: 16 }}>
              <div style={{
                height: 4,
                background: tokens.bg.cardSubtle,
                borderRadius: 100,
                overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%',
                  width: `${Math.round((totalPreenchidos / totalCampos) * 100)}%`,
                  background: tokens.brand.primary,
                  transition: 'width 0.3s',
                }} />
              </div>
              <div style={{ fontSize: 12, color: tokens.text.tertiary, marginTop: 8 }}>
                {totalPreenchidos} de {totalCampos} preenchidas
              </div>
            </div>
          </div>

          {/* Campos */}
          <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 24 }}>
            {dados.template.campos.map((campo, idx) => (
              <div key={campo.id}>
                <div style={{ marginBottom: 8 }}>
                  <label style={{ fontSize: 14, fontWeight: 600, color: tokens.text.primary, display: 'block' }}>
                    <span style={{ color: tokens.text.tertiary, marginRight: 6 }}>{idx + 1}.</span>
                    {campo.label}
                    {campo.obrigatorio && <span style={{ color: '#EF4444', marginLeft: 4 }}>*</span>}
                  </label>
                  {campo.descricao && (
                    <div style={{ fontSize: 13, color: tokens.text.tertiary, marginTop: 4 }}>
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
          </div>

          {/* Erro de validação */}
          {erroValidacao && (
            <div style={{
              margin: '0 24px 16px',
              padding: 12,
              background: '#FEF2F2',
              border: '1px solid #FECACA',
              borderRadius: 10,
              color: '#991B1B',
              fontSize: 13,
              fontWeight: 500,
            }}>
              {erroValidacao}
            </div>
          )}

          {/* Submit */}
          <div style={{ padding: '0 24px 24px' }}>
            <button
              type="button"
              onClick={enviar}
              disabled={enviando}
              style={{
                width: '100%',
                padding: '14px',
                background: enviando ? tokens.text.tertiary : tokens.brand.primary,
                color: '#fff',
                border: 'none',
                borderRadius: 12,
                fontSize: 15,
                fontWeight: 600,
                cursor: enviando ? 'not-allowed' : 'pointer',
              }}
            >
              {enviando ? 'Enviando...' : 'Enviar respostas'}
            </button>
          </div>
        </div>

        {/* Rodapé */}
        <div style={{ textAlign: 'center', marginTop: 24, fontSize: 12, color: tokens.text.tertiary }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 6 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            Suas respostas são protegidas
          </div>
          Powered by <span style={{ fontWeight: 600, color: tokens.text.secondary }}>Clinical 360</span>
        </div>
      </div>
    </div>
  )
}

function TelaInfo({ icone, titulo, descricao }: { icone: 'ok' | 'erro' | string; titulo: string; descricao?: string }) {
  const cores = {
    ok: { bg: '#D1FAE5', fg: '#059669' },
    erro: { bg: '#FEE2E2', fg: '#DC2626' },
  }
  const c = icone === 'ok' ? cores.ok : icone === 'erro' ? cores.erro : { bg: tokens.brand.primaryLight, fg: tokens.brand.primary }

  return (
    <div style={{ minHeight: '100vh', background: tokens.bg.page, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ maxWidth: 420, width: '100%', textAlign: 'center' }}>
        <div style={{
          width: 64,
          height: 64,
          margin: '0 auto 20px',
          background: c.bg,
          color: c.fg,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          {icone === 'ok' ? (
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
          ) : icone === 'erro' ? (
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
          ) : (
            <div style={{ width: 28, height: 28, border: '3px solid ' + tokens.brand.primaryLight, borderTopColor: tokens.brand.primary, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          )}
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: tokens.text.primary, margin: '0 0 12px', letterSpacing: '-0.01em' }}>
          {titulo}
        </h2>
        {descricao && (
          <p style={{ fontSize: 15, color: tokens.text.secondary, margin: 0, lineHeight: 1.5 }}>
            {descricao}
          </p>
        )}
        <style>{'@keyframes spin { to { transform: rotate(360deg) } }'}</style>
      </div>
    </div>
  )
}
