'use client'

import { useEffect, useState } from 'react'
import { tokens } from '@/lib/design-tokens'
import { listarTemplatesClinica } from '@/lib/formularios/templates'
import type { Template } from '@/lib/formularios/types'
import { useToast } from '@/components/Toast'

type Props = {
  clinicaId: string
  medicoId?: string
  paciente: {
    id?: string
    nome: string
    telefone?: string | null
    email?: string | null
  }
  agendamentoId?: string
  onFechar: () => void
  onEnviado?: (url: string) => void
}

export default function ModalEnviarFormulario({ clinicaId, medicoId, paciente, agendamentoId, onFechar, onEnviado }: Props) {
  const { toast } = useToast()
  const [templates, setTemplates] = useState<Template[]>([])
  const [loadingTemplates, setLoadingTemplates] = useState(true)
  const [templateSelecionado, setTemplateSelecionado] = useState<Template | null>(null)
  const [gerando, setGerando] = useState(false)
  const [urlGerada, setUrlGerada] = useState<string | null>(null)

  useEffect(() => {
    listarTemplatesClinica(clinicaId).then(lista => {
      setTemplates(lista)
      setLoadingTemplates(false)
    })
  }, [clinicaId])

  async function gerarEnvio() {
    if (!templateSelecionado) return
    setGerando(true)
    try {
      const res = await fetch('/api/formularios/enviar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: templateSelecionado.id,
          clinicaId,
          medicoId,
          pacienteId: paciente.id,
          agendamentoId,
          nomePaciente: paciente.nome,
          telefone: paciente.telefone || undefined,
          email: paciente.email || undefined,
          origem: 'manual',
        }),
      })
      const data = await res.json()
      if (!data.sucesso) {
        toast(data.erro || 'Erro ao gerar link', 'error')
        return
      }
      setUrlGerada(data.url)
      if (onEnviado) onEnviado(data.url)
    } catch (e: any) {
      toast(e.message || 'Erro ao gerar link', 'error')
    } finally {
      setGerando(false)
    }
  }

  function copiar() {
    if (!urlGerada) return
    navigator.clipboard.writeText(urlGerada)
    toast('Link copiado!', 'success')
  }

  function enviarWhatsApp() {
    if (!urlGerada || !paciente.telefone) {
      toast('Paciente sem telefone cadastrado', 'error')
      return
    }
    const tel = paciente.telefone.replace(/\D/g, '')
    const telCompleto = tel.startsWith('55') ? tel : '55' + tel
    const msg = `Olá, ${paciente.nome.split(' ')[0]}! 👋\n\nAntes da sua consulta, peço que preencha esse formulário rápido. Vai me ajudar a te atender melhor:\n\n${urlGerada}\n\nLeva uns 3 minutos. Qualquer dúvida, é só me chamar!`
    window.open(`https://wa.me/${telCompleto}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  function enviarEmail() {
    if (!urlGerada || !paciente.email) {
      toast('Paciente sem email cadastrado', 'error')
      return
    }
    const assunto = `Formulário pré-consulta — ${templateSelecionado?.nome || 'consulta'}`
    const corpo = `Olá, ${paciente.nome.split(' ')[0]}!\n\nAntes da sua consulta, peço que preencha esse formulário rápido. Vai me ajudar a te atender melhor:\n\n${urlGerada}\n\nLeva uns 3 minutos. Qualquer dúvida, é só responder esse email.\n\nAté breve!`
    window.location.href = `mailto:${paciente.email}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 15, 20, 0.5)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        zIndex: 100,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onFechar() }}
    >
      <div style={{
        background: '#fff',
        borderRadius: 16,
        width: '100%',
        maxWidth: 520,
        maxHeight: '90vh',
        overflow: 'auto',
        padding: 32,
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, gap: 16 }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: tokens.text.primary, margin: 0, letterSpacing: '-0.01em' }}>
              {urlGerada ? 'Link gerado!' : 'Enviar formulário'}
            </h2>
            <p style={{ fontSize: 14, color: tokens.text.secondary, margin: '6px 0 0' }}>
              {urlGerada
                ? 'Copie o link ou envie direto pelo WhatsApp/email do paciente.'
                : `Pra: ${paciente.nome}`}
            </p>
          </div>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: tokens.text.tertiary }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>

        {!urlGerada ? (
          <>
            {/* Escolha do template */}
            {loadingTemplates ? (
              <div style={{ padding: 32, textAlign: 'center', color: tokens.text.tertiary, fontSize: 13 }}>
                Carregando formulários...
              </div>
            ) : templates.length === 0 ? (
              <div style={{
                padding: 24,
                background: tokens.bg.cardSubtle,
                borderRadius: 12,
                textAlign: 'center',
                color: tokens.text.secondary,
                fontSize: 14,
                lineHeight: 1.5,
              }}>
                Você ainda não tem nenhum formulário criado.<br/>
                Vai em <strong>Formulários</strong> no menu lateral e crie o primeiro.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                {templates.map(t => {
                  const ativo = templateSelecionado?.id === t.id
                  const numCampos = Array.isArray(t.campos) ? t.campos.length : 0
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTemplateSelecionado(t)}
                      style={{
                        textAlign: 'left',
                        padding: 14,
                        background: ativo ? tokens.brand.primaryLight : '#fff',
                        border: '1.5px solid ' + (ativo ? tokens.brand.primary : tokens.border.default),
                        borderRadius: 10,
                        cursor: 'pointer',
                        transition: 'all 0.12s',
                      }}
                    >
                      <div style={{ fontSize: 14, fontWeight: 600, color: tokens.text.primary, marginBottom: 2 }}>
                        {t.nome}
                      </div>
                      <div style={{ fontSize: 12, color: tokens.text.secondary }}>
                        {t.especialidade ? t.especialidade + ' · ' : ''}{numCampos} {numCampos === 1 ? 'pergunta' : 'perguntas'}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}

            {/* Botão gerar */}
            {templates.length > 0 && (
              <button
                type="button"
                onClick={gerarEnvio}
                disabled={!templateSelecionado || gerando}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: (!templateSelecionado || gerando) ? tokens.text.tertiary : tokens.brand.primary,
                  color: '#fff',
                  border: 'none',
                  borderRadius: 10,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: (!templateSelecionado || gerando) ? 'not-allowed' : 'pointer',
                }}
              >
                {gerando ? 'Gerando link...' : 'Gerar link do formulário'}
              </button>
            )}
          </>
        ) : (
          <>
            {/* URL gerada */}
            <div style={{
              padding: 14,
              background: tokens.bg.cardSubtle,
              borderRadius: 10,
              marginBottom: 16,
              fontFamily: 'monospace',
              fontSize: 13,
              color: tokens.text.primary,
              wordBreak: 'break-all',
            }}>
              {urlGerada}
            </div>

            <div style={{ fontSize: 12, color: tokens.text.tertiary, marginBottom: 16 }}>
              Link válido por 30 dias. Quando o paciente preencher, você é notificado.
            </div>

            {/* Ações */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button
                type="button"
                onClick={copiar}
                style={btnPrimario}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                Copiar link
              </button>

              {paciente.telefone && (
                <button type="button" onClick={enviarWhatsApp} style={btnSecundario}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  Enviar pelo WhatsApp
                </button>
              )}

              {paciente.email && (
                <button type="button" onClick={enviarEmail} style={btnSecundario}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                  Enviar por email
                </button>
              )}

              <button
                type="button"
                onClick={onFechar}
                style={{ ...btnSecundario, marginTop: 4, color: tokens.text.tertiary, border: 'none', background: 'transparent' }}
              >
                Fechar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

const btnPrimario: React.CSSProperties = {
  padding: '12px 16px',
  background: tokens.brand.primary,
  color: '#fff',
  border: 'none',
  borderRadius: 10,
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
}

const btnSecundario: React.CSSProperties = {
  padding: '12px 16px',
  background: '#fff',
  color: tokens.text.primary,
  border: '1px solid ' + tokens.border.default,
  borderRadius: 10,
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
}
