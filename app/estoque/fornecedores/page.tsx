'use client'

import { useEffect, useState } from 'react'
import { tokens } from '@/lib/design-tokens'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Skeleton } from '@/components/ui/Skeleton'
import { FadeIn } from '@/components/motion/FadeIn'
import { useToast } from '@/components/Toast'
import { SectionHeader } from '../_components/SectionHeader'
import { useClinicaId } from '@/lib/financeiro/clinica'
import { listarFornecedores, salvarFornecedor, inativarFornecedor } from '@/lib/estoque/queries'
import type { Fornecedor } from '@/lib/estoque/types'

export default function FornecedoresPage() {
  const { clinicaId, loading: loadingClinica } = useClinicaId()
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([])
  const [loading, setLoading] = useState(true)
  const [editando, setEditando] = useState<Fornecedor | null>(null)
  const [novoOpen, setNovoOpen] = useState(false)
  const { toast } = useToast()

  async function carregar() {
    if (!clinicaId) return
    setLoading(true)
    setFornecedores(await listarFornecedores(clinicaId))
    setLoading(false)
  }

  useEffect(() => { void carregar() /* eslint-disable-next-line */ }, [clinicaId, loadingClinica])

  async function remover(id: string) {
    if (!confirm('Inativar este fornecedor?')) return
    await inativarFornecedor(id)
    toast('Fornecedor inativado.', 'success')
    void carregar()
  }

  return (
    <FadeIn>
      <SectionHeader
        title="Fornecedores"
        description="Quem te vende os produtos. Vinculado a lotes pra rastreabilidade."
        action={<Button onClick={() => setNovoOpen(true)} leftIcon={<PlusIcon />}>Novo fornecedor</Button>}
      />

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[0, 1, 2].map((i) => <Skeleton key={i} height={68} style={{ borderRadius: tokens.radius['3xl'] }} />)}
        </div>
      ) : fornecedores.length === 0 ? (
        <Card variant="elevated">
          <div style={{ padding: '40px 20px', textAlign: 'center', color: tokens.text.tertiary, fontSize: 14 }}>
            Nenhum fornecedor ainda. Toca em "Novo fornecedor".
          </div>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {fornecedores.map((f) => (
            <Card key={f.id} variant="elevated" padding={16}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 600, color: tokens.text.primary, marginBottom: 4 }}>{f.nome}</div>
                  <div style={{ fontSize: 13, color: tokens.text.secondary, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                    {f.cnpj && <span>CNPJ {f.cnpj}</span>}
                    {f.telefone && <span>{f.telefone}</span>}
                    {f.email && <span>{f.email}</span>}
                  </div>
                  {f.observacoes && (
                    <div style={{ fontSize: 13, color: tokens.text.tertiary, marginTop: 8, lineHeight: 1.45 }}>
                      {f.observacoes}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Button size="sm" variant="secondary" onClick={() => setEditando(f)}>Editar</Button>
                  <Button size="sm" variant="ghost" onClick={() => remover(f.id)}>Inativar</Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <FornecedorModal
        open={novoOpen || !!editando}
        onClose={() => { setNovoOpen(false); setEditando(null) }}
        onSaved={() => { setNovoOpen(false); setEditando(null); toast('Fornecedor salvo.', 'success'); void carregar() }}
        clinicaId={clinicaId}
        editando={editando}
      />
    </FadeIn>
  )
}

function FornecedorModal({
  open, onClose, onSaved, clinicaId, editando,
}: { open: boolean; onClose: () => void; onSaved: () => void; clinicaId: string | null; editando: Fornecedor | null }) {
  const [form, setForm] = useState({ nome: '', cnpj: '', telefone: '', email: '', observacoes: '' })
  const [salvando, setSalvando] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    if (editando) {
      setForm({
        nome: editando.nome,
        cnpj: editando.cnpj || '',
        telefone: editando.telefone || '',
        email: editando.email || '',
        observacoes: editando.observacoes || '',
      })
    } else {
      setForm({ nome: '', cnpj: '', telefone: '', email: '', observacoes: '' })
    }
  }, [editando, open])

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (!clinicaId) return
    if (!form.nome.trim()) { toast('Nome é obrigatório.', 'error'); return }
    setSalvando(true)
    const f = await salvarFornecedor({
      id: editando?.id,
      clinica_id: clinicaId,
      nome: form.nome.trim(),
      cnpj: form.cnpj.trim() || null,
      telefone: form.telefone.trim() || null,
      email: form.email.trim() || null,
      observacoes: form.observacoes.trim() || null,
      ativo: true,
    })
    setSalvando(false)
    if (!f) { toast('Erro ao salvar.', 'error'); return }
    onSaved()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editando ? 'Editar fornecedor' : 'Novo fornecedor'}
      footer={<>
        <Button variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button onClick={salvar} loading={salvando}>Salvar</Button>
      </>}
    >
      <form onSubmit={salvar} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Input label="Nome" value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} required />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Input label="CNPJ" value={form.cnpj} onChange={(e) => setForm((f) => ({ ...f, cnpj: e.target.value }))} placeholder="00.000.000/0001-00" />
          <Input label="Telefone" value={form.telefone} onChange={(e) => setForm((f) => ({ ...f, telefone: e.target.value }))} placeholder="(11) 99999-9999" />
        </div>
        <Input label="Email" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="contato@fornecedor.com" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 13, fontWeight: 500, color: tokens.text.strong }}>Observações</label>
          <textarea
            value={form.observacoes}
            onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))}
            rows={3}
            placeholder="Condições comerciais, prazo de entrega, contato principal..."
            style={{
              padding: 12,
              border: `1px solid ${tokens.border.default}`,
              borderRadius: tokens.radius.lg,
              fontSize: 14,
              fontFamily: 'inherit',
              outline: 'none',
              resize: 'vertical',
              minHeight: 80,
            }}
          />
        </div>
      </form>
    </Modal>
  )
}

function PlusIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> }
