'use client'

import { useEffect, useState } from 'react'
import { tokens } from '@/lib/design-tokens'
import { listarTemplatesGlobais, criarTemplate } from '@/lib/formularios/templates'
import type { Template, Campo } from '@/lib/formularios/types'
import { useToast } from '@/components/Toast'

type Props = {
  clinicaId: string
  onFechar: () => void
  onCriado: (id: string) => void
}

type Etapa = 'escolha' | 'detalhes'

export default function ModalNovoTemplate({ clinicaId, onFechar, onCriado }: Props) {
  const { toast } = useToast()
  const [etapa, setEtapa] = useState<Etapa>('escolha')
  const [globais, setGlobais] = useState<Template[]>([])
  const [loadingGlobais, setLoadingGlobais] = useState(true)
  const [baseSelecionada, setBaseSelecionada] = useState<Template | null>(null)

  const [nome, setNome] = useState('')
  const [especialidade, setEspecialidade] = useState('')
  const [descricao, setDescricao] = useState('')
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    listarTemplatesGlobais().then(lista => {
      setGlobais(lista)
      setLoadingGlobais(false)
    })
  }, [])

  function escolherEmBranco() {
    setBaseSelecionada(null)
    setNome('')
    setEspecialidade('')
    setDescricao('')
    setEtapa('detalhes')
  }

  function escolherModelo(t: Template) {
    setBaseSelecionada(t)
    setNome(t.nome + ' (cópia)')
    setEspecialidade(t.especialidade || '')
    setDescricao(t.descricao || '')
    setEtapa('detalhes')
  }

  async function salvar() {
    if (!nome.trim()) {
      toast('Dê um nome ao formulário', 'error')
      return
    }
    setSalvando(true)
    try {
      const campos: Campo[] = baseSelecionada
        ? JSON.parse(JSON.stringify(baseSelecionada.campos || []))
        : []
      
      const { template, erro } = await criarTemplate({
        clinicaId,
        nome: nome.trim(),
        especialidade: especialidade.trim() || null,
        descricao: descricao.trim() || null,
        campos,
      })
      
      if (erro || !template) {
        toast(erro || 'Erro ao criar', 'error')
        return
      }
      onCriado(template.id)
    } finally {
      setSalvando(false)
    }
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
        zIndex: 50,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onFechar() }}
    >
      <div style={{
        background: '#fff',
        borderRadius: 16,
        width: '100%',
        maxWidth: etapa === 'escolha' ? 720 : 520,
        maxHeight: '90vh',
        overflow: 'auto',
        padding: 32,
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, gap: 16 }}>
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: tokens.text.primary, margin: 0, letterSpacing: '-0.01em' }}>
              {etapa === 'escolha' ? 'Como você quer começar?' : 'Detalhes do formulário'}
            </h2>
            <p style={{ fontSize: 14, color: tokens.text.secondary, margin: '6px 0 0' }}>
              {etapa === 'escolha'
                ? 'Parta do zero ou use um modelo pronto como base.'
                : 'Você poderá adicionar e editar perguntas no próximo passo.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: tokens.text.tertiary }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {etapa === 'escolha' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Opção: começar do zero */}
            <button
              type="button"
              onClick={escolherEmBranco}
              style={{
                textAlign: 'left',
                padding: 16,
                background: tokens.brand.primaryLight,
                border: '1.5px solid ' + tokens.brand.primary,
                borderRadius: 12,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 14,
              }}
            >
              <div style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: tokens.brand.primary,
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: tokens.text.primary }}>
                  Começar do zero
                </div>
                <div style={{ fontSize: 13, color: tokens.text.secondary, marginTop: 2 }}>
                  Crie um formulário totalmente personalizado.
                </div>
              </div>
            </button>

            {/* Separador */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '4px 0' }}>
              <div style={{ flex: 1, height: 1, background: tokens.border.subtle }} />
              <div style={{ fontSize: 12, fontWeight: 600, color: tokens.text.tertiary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Ou use um modelo
              </div>
              <div style={{ flex: 1, height: 1, background: tokens.border.subtle }} />
            </div>

            {/* Lista de templates globais */}
            {loadingGlobais ? (
              <div style={{ padding: 32, textAlign: 'center', color: tokens.text.tertiary, fontSize: 13 }}>
                Carregando modelos...
              </div>
            ) : globais.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: tokens.text.tertiary, fontSize: 13 }}>
                Nenhum modelo disponível.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
                {globais.map(t => {
                  const numCampos = Array.isArray(t.campos) ? t.campos.length : 0
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => escolherModelo(t)}
                      style={{
                        textAlign: 'left',
                        padding: 14,
                        background: '#fff',
                        border: '1px solid ' + tokens.border.default,
                        borderRadius: 10,
                        cursor: 'pointer',
                        transition: 'all 0.12s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = tokens.brand.primary
                        e.currentTarget.style.background = tokens.brand.primaryLight
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = tokens.border.default
                        e.currentTarget.style.background = '#fff'
                      }}
                    >
                      <div style={{ fontSize: 14, fontWeight: 600, color: tokens.text.primary, marginBottom: 2 }}>
                        {t.nome}
                      </div>
                      <div style={{ fontSize: 12, color: tokens.text.secondary, marginBottom: 6 }}>
                        {t.especialidade}
                      </div>
                      <div style={{ fontSize: 11, color: tokens.text.tertiary, fontWeight: 500 }}>
                        {numCampos} perguntas
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        ) : (
          /* Etapa: detalhes */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {baseSelecionada && (
              <div style={{
                padding: 12,
                background: tokens.brand.primaryLight,
                borderRadius: 10,
                fontSize: 13,
                color: tokens.brand.primary,
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Baseado no modelo &quot;{baseSelecionada.nome}&quot;
              </div>
            )}

            <Field label="Nome do formulário" required>
              <input
                type="text"
                value={nome}
                onChange={e => setNome(e.target.value)}
                placeholder="Ex: Triagem pré-consulta"
                autoFocus
                style={inputStyle}
              />
            </Field>

            <Field label="Especialidade (opcional)">
              <input
                type="text"
                value={especialidade}
                onChange={e => setEspecialidade(e.target.value)}
                placeholder="Ex: Dermatologia"
                style={inputStyle}
              />
            </Field>

            <Field label="Descrição interna (opcional)" hint="Visível só pra equipe da clínica. Ajuda a lembrar pra que serve.">
              <textarea
                value={descricao}
                onChange={e => setDescricao(e.target.value)}
                placeholder="Ex: Triagem inicial pra avaliação estética"
                rows={3}
                style={{ ...inputStyle, fontFamily: 'inherit', resize: 'vertical' }}
              />
            </Field>

            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button
                type="button"
                onClick={() => setEtapa('escolha')}
                disabled={salvando}
                style={{
                  padding: '12px 18px',
                  background: '#fff',
                  border: '1px solid ' + tokens.border.default,
                  borderRadius: 10,
                  fontSize: 14,
                  fontWeight: 600,
                  color: tokens.text.secondary,
                  cursor: salvando ? 'wait' : 'pointer',
                }}
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={salvar}
                disabled={salvando || !nome.trim()}
                style={{
                  flex: 1,
                  padding: '12px 18px',
                  background: (!nome.trim() || salvando) ? tokens.text.tertiary : tokens.brand.primary,
                  border: 'none',
                  borderRadius: 10,
                  fontSize: 14,
                  fontWeight: 600,
                  color: '#fff',
                  cursor: (!nome.trim() || salvando) ? 'not-allowed' : 'pointer',
                }}
              >
                {salvando ? 'Criando...' : 'Criar e continuar'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '11px 14px',
  fontSize: 14,
  color: tokens.text.primary,
  border: '1px solid ' + tokens.border.default,
  borderRadius: 10,
  background: '#fff',
  outline: 'none',
  boxSizing: 'border-box',
}

function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ marginBottom: 6 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: tokens.text.primary, display: 'block' }}>
          {label} {required && <span style={{ color: '#EF4444' }}>*</span>}
        </label>
        {hint && (
          <div style={{ fontSize: 12, color: tokens.text.tertiary, marginTop: 2 }}>
            {hint}
          </div>
        )}
      </div>
      {children}
    </div>
  )
}
