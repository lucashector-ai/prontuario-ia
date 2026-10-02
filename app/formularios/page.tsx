'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, FileText, Pencil, Trash2, Eye } from 'lucide-react'
import { tokens, tint } from '@/lib/design-tokens'
import {
  Tabs, Button, IconButton, SearchInput, SegmentedControl, Card, EmptyState, Drawer, Icon,
} from '@/components/ui'
import { usePageHeader } from '@/components/shell/header-context'
import { listarTemplatesClinica, deletarTemplate } from '@/lib/formularios/templates'
import type { Template, Campo } from '@/lib/formularios/types'
import { useToast } from '@/components/Toast'
import ModalNovoTemplate from './ModalNovoTemplate'
import ListaEnvios from './ListaEnvios'
import { TIPOS_FORMULARIO, tipoDoTemplate, normalizarBusca, type TipoFormulario } from './tipos'
import { confirmar } from '@/components/ui/dialogos'

const T = tokens

type Auth = {
  tipo: 'medico' | 'admin' | null
  clinicaId: string | null
  loading: boolean
}

type FiltroTipo = 'Todos' | TipoFormulario

export default function FormulariosPage() {
  const router = useRouter()
  const { toast } = useToast()
  usePageHeader('Formulários', 'Anamnese, consentimentos e pré-consulta')
  const [auth, setAuth] = useState<Auth>({ tipo: null, clinicaId: null, loading: true })
  const [templates, setTemplates] = useState<Template[]>([])
  const [loadingTemplates, setLoadingTemplates] = useState(true)
  const [busca, setBusca] = useState('')
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>('Todos')
  const [modalAberto, setModalAberto] = useState(false)
  const [aba, setAba] = useState<'modelos' | 'envios'>('modelos')
  const [previa, setPrevia] = useState<Template | null>(null)

  useEffect(() => {
    try {
      const rawMedico = localStorage.getItem('medico')
      const rawAdmin = localStorage.getItem('clinica_admin')

      if (rawMedico) {
        const m = JSON.parse(rawMedico)
        setAuth({ tipo: 'medico', clinicaId: m.clinica_id, loading: false })
        if (m.clinica_id) carregarTemplates(m.clinica_id)
      } else if (rawAdmin) {
        const a = JSON.parse(rawAdmin)
        setAuth({ tipo: 'admin', clinicaId: a.clinica_id, loading: false })
        if (a.clinica_id) carregarTemplates(a.clinica_id)
      } else {
        router.replace('/login')
      }
    } catch {
      router.replace('/login')
    }
  }, [router])

  async function carregarTemplates(clinicaId: string) {
    setLoadingTemplates(true)
    try {
      const lista = await listarTemplatesClinica(clinicaId)
      setTemplates(lista)
    } finally {
      setLoadingTemplates(false)
    }
  }

  async function handleDeletar(t: Template) {
    if (!(await confirmar({ titulo: `Excluir o formulário “${t.nome}”?`, mensagem: 'Essa ação não pode ser desfeita.', confirmar: 'Excluir', perigo: true }))) return
    const { erro } = await deletarTemplate(t.id)
    if (erro) {
      toast(erro, 'error')
    } else {
      toast('Formulário excluído.', 'success')
      if (previa?.id === t.id) setPrevia(null)
      if (auth.clinicaId) carregarTemplates(auth.clinicaId)
    }
  }

  // Tipos presentes nos dados (para o filtro segmentado)
  const tiposPresentes = useMemo(() => {
    const set = new Set(templates.map(tipoDoTemplate))
    return (Object.keys(TIPOS_FORMULARIO) as TipoFormulario[]).filter(k => set.has(k))
  }, [templates])

  if (auth.loading) {
    return (
      <div style={{ padding: 64, display: 'flex', justifyContent: 'center' }}>
        <Spinner />
      </div>
    )
  }

  const q = normalizarBusca(busca.trim())
  const templatesFiltrados = templates.filter(t =>
    (filtroTipo === 'Todos' || tipoDoTemplate(t) === filtroTipo) &&
    (!q || normalizarBusca(t.nome).includes(q) || normalizarBusca(t.especialidade || '').includes(q))
  )

  return (
    <div style={{ padding: 20 }}>
      <Tabs
        ativa={aba}
        onChange={(id) => setAba(id as 'modelos' | 'envios')}
        style={{ marginBottom: 16 }}
        tabs={[
          { id: 'modelos', label: 'Meus formulários' },
          { id: 'envios', label: 'Envios' },
        ]}
      />

      {aba === 'envios' && auth.clinicaId && (
        <ListaEnvios clinicaId={auth.clinicaId} />
      )}

      {aba === 'modelos' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Barra de ferramentas */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 240px', minWidth: 0 }}>
              <SearchInput value={busca} onChange={setBusca} placeholder="Buscar formulário" />
            </div>
            {tiposPresentes.length > 1 && (
              <div style={{ maxWidth: '100%', overflowX: 'auto', scrollbarWidth: 'none' }}>
                <SegmentedControl<FiltroTipo>
                  options={['Todos', ...tiposPresentes]}
                  value={filtroTipo}
                  onChange={setFiltroTipo}
                />
              </div>
            )}
            <Button icon={Plus} onClick={() => setModalAberto(true)}>Novo formulário</Button>
          </div>

          {/* Lista */}
          {loadingTemplates ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
              {[0, 1, 2].map(i => <div key={i} className="c360-skel" style={{ height: 168, borderRadius: 16 }} />)}
            </div>
          ) : templates.length === 0 ? (
            <Card padding={0}>
              <EmptyState
                icon={FileText}
                titulo="Nenhum formulário ainda"
                descricao="Crie seu primeiro formulário para enviar aos pacientes antes das consultas. Você pode começar a partir de modelos prontos."
                acao={<Button icon={Plus} onClick={() => setModalAberto(true)}>Criar primeiro formulário</Button>}
              />
            </Card>
          ) : templatesFiltrados.length === 0 ? (
            <EmptyState icon={FileText} titulo="Nenhum formulário encontrado" descricao="Tente outro termo ou tipo." />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
              {templatesFiltrados.map(t => (
                <CardTemplate
                  key={t.id}
                  template={t}
                  onVisualizar={() => setPrevia(t)}
                  onDeletar={() => handleDeletar(t)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {previa && (
        <DrawerPrevia
          template={previa}
          onClose={() => setPrevia(null)}
          onEditar={() => router.push('/formularios/' + previa.id)}
          onDeletar={() => handleDeletar(previa)}
        />
      )}

      {modalAberto && auth.clinicaId && (
        <ModalNovoTemplate
          clinicaId={auth.clinicaId}
          onFechar={() => setModalAberto(false)}
          onCriado={(id) => {
            setModalAberto(false)
            router.push('/formularios/' + id)
          }}
        />
      )}
    </div>
  )
}

function Spinner() {
  return (
    <>
      <div style={{
        width: 28, height: 28, border: '2.5px solid ' + T.brand.primaryLight, borderTopColor: T.brand.primary,
        borderRadius: '50%', animation: 'spin 0.8s linear infinite',
      }} />
      <style>{'@keyframes spin { to { transform: rotate(360deg) } }'}</style>
    </>
  )
}

function formatarDataCurta(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch {
    return ''
  }
}

function CardTemplate({ template, onVisualizar, onDeletar }: { template: Template; onVisualizar: () => void; onDeletar: () => void }) {
  const numCampos = Array.isArray(template.campos) ? template.campos.length : 0
  const tipo = tipoDoTemplate(template)
  const { cor, icon } = TIPOS_FORMULARIO[tipo]

  return (
    <Card onClick={onVisualizar} padding={16} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <span style={{ width: 40, height: 40, borderRadius: 12, display: 'grid', placeItems: 'center', background: tint(cor, 0.12), color: cor, flexShrink: 0 }}>
          <Icon icon={icon} size={18} />
        </span>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 99, background: tint(cor, 0.12), color: cor }}>{tipo}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
        <span style={{ fontSize: 14.5, fontWeight: 700, color: T.text.primary }}>{template.nome}</span>
        <span style={{ fontSize: 12.5, color: T.text.quaternary }}>
          {numCampos} {numCampos === 1 ? 'pergunta' : 'perguntas'}
          {template.especialidade ? ' · ' + template.especialidade : ''}
        </span>
        {template.descricao && (
          <span style={{ fontSize: 12.5, color: T.text.secondary, lineHeight: 1.4, marginTop: 4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {template.descricao}
          </span>
        )}
      </div>
      <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: 6, paddingTop: 10, borderTop: `1px solid ${T.border.muted}` }}>
        <span style={{ flex: 1, fontSize: 11.5, color: T.text.tertiary }}>
          {template.criado_em ? 'Criado em ' + formatarDataCurta(template.criado_em) : ''}
        </span>
        <IconButton
          icon={Trash2}
          size={30}
          aria-label="Excluir"
          title="Excluir"
          onClick={(e) => { e.stopPropagation(); onDeletar() }}
        />
        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onVisualizar() }}>Visualizar</Button>
      </div>
    </Card>
  )
}

// ── Drawer de pré-visualização ────────────────────────────────────────────────

function DrawerPrevia({ template, onClose, onEditar, onDeletar }: {
  template: Template
  onClose: () => void
  onEditar: () => void
  onDeletar: () => void
}) {
  const campos: Campo[] = Array.isArray(template.campos) ? template.campos : []
  const tipo = tipoDoTemplate(template)
  return (
    <Drawer
      titulo={<span style={{ fontSize: 13, fontWeight: 600, color: T.text.quaternary }}>Pré-visualização</span>}
      onClose={onClose}
      rodape={
        <>
          <Button variant="danger" icon={Trash2} onClick={onDeletar}>Excluir</Button>
          <Button icon={Pencil} onClick={onEditar} style={{ flex: 1 }}>Editar</Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: T.text.primary }}>{template.nome}</span>
          <span style={{ fontSize: 12.5, color: T.text.quaternary }}>
            {tipo} · {campos.length} {campos.length === 1 ? 'pergunta' : 'perguntas'}
            {template.especialidade ? ' · ' + template.especialidade : ''}
          </span>
        </div>
        {campos.length === 0 ? (
          <EmptyState icon={Eye} titulo="Sem perguntas" descricao="Abra o editor para adicionar as perguntas deste formulário." />
        ) : campos.map((c, i) => (
          <div key={c.id || i} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: T.text.primary }}>
              {i + 1}. {c.label}{c.obrigatorio && <span style={{ color: T.status.danger }}> *</span>}
            </span>
            {c.descricao && <span style={{ fontSize: 12, color: T.text.quaternary, marginTop: -4 }}>{c.descricao}</span>}
            <PreviaCampo campo={c} />
          </div>
        ))}
      </div>
    </Drawer>
  )
}

function PreviaCampo({ campo }: { campo: Campo }) {
  const caixa = (h: number) => (
    <div style={{ height: h, borderRadius: 10, border: `1px solid ${T.border.default}`, background: T.bg.cardSubtle }} />
  )
  const opcoes = (lista: string[]) => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {lista.map((o, i) => (
        <span key={i} style={{ padding: '6px 11px', borderRadius: 9, border: `1px solid ${T.border.default}`, fontSize: 12.5, color: T.text.muted }}>{o}</span>
      ))}
    </div>
  )
  switch (campo.tipo) {
    case 'textarea': return caixa(76)
    case 'select':
    case 'multipla': return opcoes(campo.opcoes || [])
    case 'sim_nao': return opcoes(['Sim', 'Não'])
    case 'escala': {
      const min = campo.min ?? 0, max = campo.max ?? 10, passo = campo.passo || 1
      const nums: string[] = []
      for (let n = min; n <= max && nums.length < 21; n += passo) nums.push(String(n))
      return opcoes(nums)
    }
    default: return caixa(38)
  }
}
