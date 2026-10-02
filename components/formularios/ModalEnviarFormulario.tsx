'use client'

import { useEffect, useState } from 'react'
import { Copy, Globe, Link2, Mail, MessageCircle } from 'lucide-react'
import { tokens } from '@/lib/design-tokens'
import { Modal, ModalAcoes, Button, IconButton, Icon } from '@/components/ui'
import { listarTemplatesClinica } from '@/lib/formularios/templates'
import type { Template } from '@/lib/formularios/types'
import { useToast } from '@/components/Toast'

const T = tokens

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
    <Modal titulo={urlGerada ? 'Link gerado' : 'Enviar formulário'} onClose={onFechar} largura={520}>
      <p style={{ fontSize: 13, color: T.text.quaternary, margin: '-6px 0 16px', lineHeight: 1.45 }}>
        {urlGerada
          ? 'Copie o link ou envie direto pelo WhatsApp/e-mail do paciente.'
          : `Para: ${paciente.nome}`}
      </p>

      {!urlGerada ? (
        <>
          {/* Escolha do template */}
          {loadingTemplates ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[0, 1, 2].map(i => <div key={i} className="c360-skel" style={{ height: 58, borderRadius: 12 }} />)}
            </div>
          ) : templates.length === 0 ? (
            <div style={{
              padding: 20, background: T.bg.cardSubtle, border: `1px solid ${T.border.default}`, borderRadius: 14,
              textAlign: 'center', color: T.text.secondary, fontSize: 13.5, lineHeight: 1.5,
            }}>
              Você ainda não tem nenhum formulário criado.<br />
              Vá em <strong>Formulários</strong> no menu lateral e crie o primeiro.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {templates.map(t => {
                const ativo = templateSelecionado?.id === t.id
                const numCampos = Array.isArray(t.campos) ? t.campos.length : 0
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTemplateSelecionado(t)}
                    style={{
                      textAlign: 'left', padding: '11px 12px', display: 'flex', alignItems: 'center', gap: 10,
                      background: ativo ? T.brand.primarySoftBg : '#fff',
                      border: '1.5px solid ' + (ativo ? T.brand.primary : T.border.default),
                      borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.12s',
                    }}
                  >
                    <span style={{
                      width: 16, height: 16, borderRadius: '50%', flexShrink: 0, display: 'grid', placeItems: 'center',
                      border: `1.5px solid ${ativo ? T.brand.primary : '#C3C1CC'}`,
                    }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: ativo ? T.brand.primary : 'transparent' }} />
                    </span>
                    <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <span style={{ fontSize: 13.5, fontWeight: 600, color: T.text.primary }}>{t.nome}</span>
                      <span style={{ fontSize: 12, color: T.text.quaternary }}>
                        {t.especialidade ? t.especialidade + ' · ' : ''}{numCampos} {numCampos === 1 ? 'pergunta' : 'perguntas'}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          )}

          {/* Botão gerar */}
          {templates.length > 0 && (
            <ModalAcoes>
              <Button variant="secondary" onClick={onFechar}>Cancelar</Button>
              <Button icon={Link2} onClick={gerarEnvio} disabled={!templateSelecionado || gerando}>
                {gerando ? 'Gerando link...' : 'Gerar link do formulário'}
              </Button>
            </ModalAcoes>
          )}
        </>
      ) : (
        <>
          {/* URL gerada */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, minHeight: 40, padding: '8px 6px 8px 12px', borderRadius: 11,
            background: T.bg.page, border: `1px solid ${T.border.default}`, marginBottom: 10,
          }}>
            <Icon icon={Globe} size={14} color={T.text.tertiary} />
            <span className="mono" style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: T.text.muted, wordBreak: 'break-all' }}>{urlGerada}</span>
            <IconButton icon={Copy} size={30} onClick={copiar} aria-label="Copiar link" title="Copiar link" />
          </div>

          <div style={{ fontSize: 12, color: T.text.quaternary, marginBottom: 16 }}>
            Link válido por 30 dias. Quando o paciente preencher, você é notificado.
          </div>

          {/* Ações */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Button icon={Copy} size="lg" block onClick={copiar}>Copiar link</Button>

            {paciente.telefone && (
              <Button variant="secondary" size="lg" block icon={MessageCircle} onClick={enviarWhatsApp}>
                Enviar pelo WhatsApp
              </Button>
            )}

            {paciente.email && (
              <Button variant="secondary" size="lg" block icon={Mail} onClick={enviarEmail}>
                Enviar por e-mail
              </Button>
            )}

            <Button variant="ghost" block onClick={onFechar} style={{ color: T.text.secondary, marginTop: 4 }}>
              Fechar
            </Button>
          </div>
        </>
      )}
    </Modal>
  )
}
