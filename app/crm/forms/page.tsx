'use client'

import { useEffect, useState } from 'react'
import { tokens } from '@/lib/design-tokens'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { FadeIn } from '@/components/motion/FadeIn'
import { useToast } from '@/components/Toast'
import { useClinicaId } from '@/lib/financeiro/clinica'
import { listarForms, salvarForm, inativarForm } from '@/lib/crm/queries'
import type { CampoForm, CrmForm } from '@/lib/crm/types'

export default function FormsPage() {
  const { clinicaId, loading: loadingClinica } = useClinicaId()
  const [forms, setForms] = useState<CrmForm[]>([])
  const [loading, setLoading] = useState(true)
  const [novoOpen, setNovoOpen] = useState(false)
  const [verEmbed, setVerEmbed] = useState<CrmForm | null>(null)
  const { toast } = useToast()

  async function carregar() {
    if (!clinicaId) return
    setLoading(true)
    setForms(await listarForms(clinicaId))
    setLoading(false)
  }

  useEffect(() => { void carregar() /* eslint-disable-next-line */ }, [clinicaId, loadingClinica])

  async function remover(f: CrmForm) {
    if (!confirm(`Inativar o formulário "${f.titulo}"?`)) return
    await inativarForm(f.id)
    toast('Inativado.', 'success')
    void carregar()
  }

  return (
    <FadeIn>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
        <div>
          <span style={{ fontSize: 12, fontWeight: 600, color: tokens.brand.primary, letterSpacing: 0.6, textTransform: 'uppercase' }}>CRM</span>
          <h1 style={{ margin: '8px 0 0', fontSize: 28, fontWeight: 700, letterSpacing: -0.5, color: tokens.text.primary }}>Formulários</h1>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: tokens.text.secondary }}>
            Forms embedáveis pra captura de lead. Cada submissão vira lead automaticamente em "Novo".
          </p>
        </div>
        <Button onClick={() => setNovoOpen(true)} leftIcon={<PlusIcon />}>Novo formulário</Button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[0, 1].map((i) => <Skeleton key={i} height={100} style={{ borderRadius: tokens.radius['3xl'] }} />)}
        </div>
      ) : forms.length === 0 ? (
        <Card variant="elevated">
          <div style={{ padding: '40px 20px', textAlign: 'center', color: tokens.text.tertiary, fontSize: 14 }}>
            Nenhum formulário ainda.
          </div>
        </Card>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12 }}>
          {forms.map((f) => (
            <Card key={f.id} variant="elevated">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 16, fontWeight: 600, color: tokens.text.primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.titulo}</div>
                  <div style={{ fontSize: 12, color: tokens.text.tertiary, marginTop: 2 }}>/forms/{f.slug}</div>
                </div>
                {!f.ativo && <Badge size="sm">Inativo</Badge>}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: tokens.text.secondary, marginBottom: 12 }}>
                <span>{(f.campos as CampoForm[]).length} campo{(f.campos as CampoForm[]).length === 1 ? '' : 's'}</span>
                <span><strong style={{ color: tokens.text.primary, fontWeight: 600 }}>{f.total_submissoes}</strong> submissões</span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button size="sm" variant="secondary" onClick={() => setVerEmbed(f)} fullWidth>Embed code</Button>
                <Button size="sm" variant="ghost" onClick={() => remover(f)}>Inativar</Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <NovoFormModal
        open={novoOpen}
        onClose={() => setNovoOpen(false)}
        onSaved={() => { setNovoOpen(false); toast('Formulário criado.', 'success'); void carregar() }}
        clinicaId={clinicaId}
      />

      {verEmbed && <EmbedModal form={verEmbed} onClose={() => setVerEmbed(null)} />}
    </FadeIn>
  )
}

function NovoFormModal({ open, onClose, onSaved, clinicaId }: { open: boolean; onClose: () => void; onSaved: () => void; clinicaId: string | null }) {
  const [form, setForm] = useState({ slug: '', titulo: '', descricao: '' })
  const [campos, setCampos] = useState<CampoForm[]>([
    { nome: 'nome', label: 'Nome completo', tipo: 'texto', obrigatorio: true },
    { nome: 'telefone', label: 'WhatsApp', tipo: 'telefone', obrigatorio: true },
    { nome: 'email', label: 'Email', tipo: 'email', obrigatorio: false },
    { nome: 'interesse', label: 'No que tem interesse?', tipo: 'textarea', obrigatorio: false },
  ])
  const [salvando, setSalvando] = useState(false)
  const { toast } = useToast()

  function addCampo() {
    setCampos((c) => [...c, { nome: `campo_${c.length + 1}`, label: 'Novo campo', tipo: 'texto', obrigatorio: false }])
  }
  function rmCampo(i: number) {
    setCampos((c) => c.filter((_, idx) => idx !== i))
  }
  function updateCampo(i: number, patch: Partial<CampoForm>) {
    setCampos((c) => c.map((cf, idx) => idx === i ? { ...cf, ...patch } : cf))
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (!clinicaId) return
    const slug = form.slug.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '')
    if (!slug || !form.titulo.trim() || campos.length === 0) {
      toast('Slug, título e pelo menos um campo são obrigatórios.', 'error'); return
    }
    setSalvando(true)
    const f = await salvarForm({
      clinica_id: clinicaId,
      slug,
      titulo: form.titulo.trim(),
      descricao: form.descricao.trim() || null,
      campos: campos as any,
      ativo: true,
      mensagem_sucesso: 'Recebemos seus dados. Em breve entraremos em contato.',
    })
    setSalvando(false)
    if (!f) { toast('Erro (slug já existe?).', 'error'); return }
    setForm({ slug: '', titulo: '', descricao: '' })
    onSaved()
  }

  return (
    <Modal
      open={open} onClose={onClose}
      title="Novo formulário"
      size="lg"
      footer={<>
        <Button variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button onClick={salvar} loading={salvando}>Criar</Button>
      </>}
    >
      <form onSubmit={salvar} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 12 }}>
          <Input label="Slug" value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} placeholder="agendamento-botox" required hint="URL: /forms/[slug]" />
          <Input label="Título" value={form.titulo} onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))} placeholder="Agendar avaliação de Botox" required />
        </div>
        <Input label="Descrição (opcional)" value={form.descricao} onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))} placeholder="Preencha e entraremos em contato em até 24h." />

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: tokens.text.strong }}>Campos</div>
            <Button size="sm" variant="secondary" onClick={addCampo}>+ Adicionar</Button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {campos.map((c, i) => (
              <div key={i} style={{
                display: 'grid', gridTemplateColumns: '1.5fr 2fr 1fr auto auto',
                gap: 8, alignItems: 'center',
                padding: 10, background: tokens.bg.cardSubtle, borderRadius: tokens.radius.lg,
              }}>
                <input
                  value={c.nome}
                  onChange={(e) => updateCampo(i, { nome: e.target.value })}
                  placeholder="nome_tecnico"
                  style={inpStyle}
                />
                <input
                  value={c.label}
                  onChange={(e) => updateCampo(i, { label: e.target.value })}
                  placeholder="Label visível"
                  style={inpStyle}
                />
                <select
                  value={c.tipo}
                  onChange={(e) => updateCampo(i, { tipo: e.target.value as CampoForm['tipo'] })}
                  style={{ ...inpStyle, padding: '0 8px' }}
                >
                  <option value="texto">Texto</option>
                  <option value="email">Email</option>
                  <option value="telefone">Telefone</option>
                  <option value="textarea">Textarea</option>
                  <option value="select">Select</option>
                </select>
                <label style={{ fontSize: 11, color: tokens.text.tertiary, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <input type="checkbox" checked={c.obrigatorio} onChange={(e) => updateCampo(i, { obrigatorio: e.target.checked })} />
                  Obrig.
                </label>
                <button type="button" onClick={() => rmCampo(i)} aria-label="Remover" style={{ background: 'transparent', border: 'none', color: tokens.status.danger, cursor: 'pointer', padding: 4 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      </form>
    </Modal>
  )
}

const inpStyle: React.CSSProperties = {
  height: 36,
  padding: '0 10px',
  border: `1px solid ${tokens.border.default}`,
  borderRadius: tokens.radius.md,
  fontSize: 13,
  background: tokens.bg.card,
  color: tokens.text.primary,
  outline: 'none',
  fontFamily: 'inherit',
}

function EmbedModal({ form, onClose }: { form: CrmForm; onClose: () => void }) {
  const { toast } = useToast()
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://clinical360.vercel.app'
  const publicUrl = `${baseUrl}/forms/${form.slug}`
  const iframeCode = `<iframe src="${publicUrl}" width="100%" height="600" frameborder="0" style="border-radius:16px;max-width:520px"></iframe>`

  function copiar(s: string, label: string) {
    navigator.clipboard?.writeText(s)
    toast(`${label} copiado.`, 'success')
  }

  return (
    <Modal
      open={true} onClose={onClose}
      title="Embed deste formulário"
      description="Cola o HTML em qualquer site (Wix, WordPress, landing page). O envio cria um lead automático em 'Novo'."
      size="lg"
      footer={<Button onClick={onClose}>Fechar</Button>}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: tokens.text.tertiary, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 }}>URL pública</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={publicUrl} readOnly style={{ ...inpStyle, flex: 1, height: 40, fontSize: 13 }} />
            <Button size="sm" variant="secondary" onClick={() => copiar(publicUrl, 'URL')}>Copiar</Button>
            <a href={publicUrl} target="_blank" rel="noopener noreferrer">
              <Button size="sm">Abrir</Button>
            </a>
          </div>
        </div>

        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: tokens.text.tertiary, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 }}>Código iframe</div>
          <textarea
            value={iframeCode}
            readOnly
            rows={3}
            style={{ ...inpStyle, width: '100%', height: 'auto', padding: 10, fontFamily: 'ui-monospace, SF Mono, monospace', fontSize: 12, resize: 'vertical' }}
          />
          <div style={{ marginTop: 8 }}>
            <Button size="sm" variant="secondary" onClick={() => copiar(iframeCode, 'HTML')}>Copiar HTML</Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

function PlusIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> }
