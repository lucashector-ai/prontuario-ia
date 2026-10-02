'use client'

import { useEffect, useState } from 'react'
import { Plus, Check, ArrowLeft } from 'lucide-react'
import { tokens, tint } from '@/lib/design-tokens'
import { Modal, Button, Field, Input, Textarea, Icon, Overline } from '@/components/ui'
import { TIPOS_FORMULARIO, tipoDoTemplate } from './tipos'
import { listarTemplatesGlobais, criarTemplate } from '@/lib/formularios/templates'
import type { Template, Campo } from '@/lib/formularios/types'
import { useToast } from '@/components/Toast'

type Props = {
  clinicaId: string
  onFechar: () => void
  onCriado: (id: string) => void
}

type Etapa = 'escolha' | 'detalhes'

const T = tokens

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
    <Modal
      titulo={etapa === 'escolha' ? 'Novo formulário' : 'Detalhes do formulário'}
      onClose={onFechar}
      largura={etapa === 'escolha' ? 640 : 520}
      rodape={etapa === 'detalhes' ? (
        <>
          <Button variant="secondary" icon={ArrowLeft} onClick={() => setEtapa('escolha')} disabled={salvando}>Voltar</Button>
          <Button onClick={salvar} disabled={salvando || !nome.trim()}>
            {salvando ? 'Criando...' : 'Criar e continuar'}
          </Button>
        </>
      ) : undefined}
    >
      <p style={{ fontSize: 13, color: T.text.quaternary, margin: '-6px 0 16px', lineHeight: 1.45 }}>
        {etapa === 'escolha'
          ? 'Parta do zero ou use um modelo pronto como base.'
          : 'Você poderá adicionar e editar perguntas no próximo passo.'}
      </p>

      {etapa === 'escolha' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Opção: começar do zero */}
          <OpcaoCard onClick={escolherEmBranco} destaque>
            <span style={{ width: 40, height: 40, borderRadius: 12, background: T.brand.primary, color: '#fff', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <Icon icon={Plus} size={18} />
            </span>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: T.text.primary }}>Começar do zero</span>
              <span style={{ fontSize: 12.5, color: T.text.quaternary }}>Crie um formulário totalmente personalizado.</span>
            </span>
          </OpcaoCard>

          <Overline style={{ marginTop: 6 }}>Ou use um modelo</Overline>

          {/* Lista de templates globais */}
          {loadingGlobais ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 8 }}>
              {[0, 1, 2, 3].map(i => <div key={i} className="c360-skel" style={{ height: 64, borderRadius: 12 }} />)}
            </div>
          ) : globais.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: T.text.tertiary, fontSize: 13 }}>
              Nenhum modelo disponível.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 8 }}>
              {globais.map(t => {
                const numCampos = Array.isArray(t.campos) ? t.campos.length : 0
                const { cor, icon } = TIPOS_FORMULARIO[tipoDoTemplate(t)]
                return (
                  <OpcaoCard key={t.id} onClick={() => escolherModelo(t)}>
                    <span style={{ width: 34, height: 34, borderRadius: 10, background: tint(cor, 0.12), color: cor, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                      <Icon icon={icon} size={16} />
                    </span>
                    <span style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
                      <span style={{ fontSize: 13.5, fontWeight: 600, color: T.text.primary }}>{t.nome}</span>
                      <span style={{ fontSize: 12, color: T.text.quaternary }}>
                        {numCampos} perguntas{t.especialidade ? ' · ' + t.especialidade : ''}
                      </span>
                    </span>
                  </OpcaoCard>
                )
              })}
            </div>
          )}
        </div>
      ) : (
        /* Etapa: detalhes */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {baseSelecionada && (
            <div style={{
              padding: '10px 12px', background: T.brand.primarySubtle, borderRadius: 12, fontSize: 13,
              color: T.brand.primary, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <Icon icon={Check} size={14} />
              Baseado no modelo &quot;{baseSelecionada.nome}&quot;
            </div>
          )}

          <Field label="Nome do formulário *">
            <Input
              type="text"
              value={nome}
              onChange={e => setNome(e.target.value)}
              placeholder="Ex.: Anamnese dermatológica"
              autoFocus
            />
          </Field>

          <Field label="Especialidade (opcional)">
            <Input
              type="text"
              value={especialidade}
              onChange={e => setEspecialidade(e.target.value)}
              placeholder="Ex.: Dermatologia"
            />
          </Field>

          <Field label="Descrição interna (opcional)" hint="Visível só para a equipe da clínica. Ajuda a lembrar para que serve.">
            <Textarea
              value={descricao}
              onChange={e => setDescricao(e.target.value)}
              placeholder="Ex.: Triagem inicial para avaliação estética"
              rows={3}
            />
          </Field>
        </div>
      )}
    </Modal>
  )
}

/** Opção clicável do modal (começar do zero / modelo). Seleção = borda roxa + fundo lilás. */
function OpcaoCard({ children, onClick, destaque }: { children: React.ReactNode; onClick: () => void; destaque?: boolean }) {
  const [h, setH] = useState(false)
  const on = destaque || h
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        textAlign: 'left', padding: 12, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
        fontFamily: 'inherit', borderRadius: 14, width: '100%', boxSizing: 'border-box',
        border: `1.5px solid ${on ? T.brand.primary : T.border.default}`,
        background: on ? T.brand.primarySoftBg : '#fff',
        transition: 'border-color .15s, background .15s',
      }}
    >
      {children}
    </button>
  )
}
