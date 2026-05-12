'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { tokens } from '@/lib/design-tokens'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { FadeIn } from '@/components/motion/FadeIn'
import { useToast } from '@/components/Toast'
import { buscarProduto, listarLotesDoProduto, salvarLote, listarFornecedores } from '@/lib/estoque/queries'
import { CATEGORIA_LABEL, UNIDADE_LABEL, type Produto, type Lote, type Fornecedor } from '@/lib/estoque/types'
import { statusValidade, labelValidade } from '@/lib/estoque/vencimento'
import { moeda } from '@/lib/financeiro/format'

const STATUS_VARIANT: Record<NonNullable<ReturnType<typeof statusValidade>>, 'success' | 'warning' | 'danger' | 'neutral'> = {
  ok: 'success',
  atencao: 'warning',
  critico: 'danger',
  vencido: 'danger',
}

export default function ProdutoDetalhePage() {
  const params = useParams<{ id: string }>()
  const [produto, setProduto] = useState<Produto | null>(null)
  const [lotes, setLotes] = useState<Lote[]>([])
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([])
  const [loading, setLoading] = useState(true)
  const [novoLoteOpen, setNovoLoteOpen] = useState(false)
  const { toast } = useToast()

  async function carregar() {
    if (!params?.id) return
    setLoading(true)
    const p = await buscarProduto(params.id)
    setProduto(p)
    if (p) {
      const [l, f] = await Promise.all([
        listarLotesDoProduto(p.id),
        listarFornecedores(p.clinica_id),
      ])
      setLotes(l)
      setFornecedores(f)
    }
    setLoading(false)
  }

  useEffect(() => { void carregar() /* eslint-disable-next-line */ }, [params?.id])

  if (loading) {
    return (
      <FadeIn>
        <Skeleton width={120} height={16} style={{ marginBottom: 16 }} />
        <Skeleton width="60%" height={28} style={{ marginBottom: 16 }} />
        <Skeleton height={200} style={{ borderRadius: tokens.radius['3xl'], marginBottom: 16 }} />
        <Skeleton height={140} style={{ borderRadius: tokens.radius['3xl'] }} />
      </FadeIn>
    )
  }

  if (!produto) {
    return (
      <div>
        <Link href="/estoque" style={{ color: tokens.brand.primary, textDecoration: 'none', fontSize: 13, fontWeight: 500 }}>← Voltar</Link>
        <Card variant="elevated" style={{ marginTop: 16 }}>
          <div style={{ padding: '40px 20px', textAlign: 'center', color: tokens.text.tertiary }}>
            Produto não encontrado.
          </div>
        </Card>
      </div>
    )
  }

  return (
    <FadeIn>
      <Link href="/estoque" style={{ color: tokens.brand.primary, textDecoration: 'none', fontSize: 13, fontWeight: 500 }}>← Voltar</Link>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, marginTop: 16, alignItems: 'flex-start' }}>
        <Card padding={16} style={{ flex: '1 1 280px', maxWidth: 360 }}>
          <div style={{
            width: '100%', aspectRatio: '4 / 3',
            background: produto.foto_url ? `url(${produto.foto_url}) center/cover` : tokens.bg.cardSubtle,
            borderRadius: tokens.radius.xl,
            marginBottom: 14,
          }} />
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            <Badge size="sm" variant="brand">{CATEGORIA_LABEL[produto.categoria]}</Badge>
            <Badge size="sm">{UNIDADE_LABEL[produto.unidade]}</Badge>
          </div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: tokens.text.primary, letterSpacing: -0.3, lineHeight: 1.2 }}>
            {produto.nome}
          </h1>
          {produto.marca && <div style={{ fontSize: 13, color: tokens.text.tertiary, marginTop: 4 }}>{produto.marca}</div>}
        </Card>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, flex: '2 1 380px', minWidth: 0 }}>
          <Card variant="elevated">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 16 }}>
              <Stat label="Estoque atual" valor={`${produto.estoque_atual} ${UNIDADE_LABEL[produto.unidade]}`} />
              <Stat label="Estoque mínimo" valor={produto.estoque_minimo > 0 ? `${produto.estoque_minimo} ${UNIDADE_LABEL[produto.unidade]}` : '—'} />
              <Stat label="Custo unitário" valor={moeda(produto.custo_unitario)} />
              <Stat label="Preço de venda" valor={produto.preco_venda != null ? moeda(produto.preco_venda) : '—'} />
              {produto.preco_venda != null && produto.custo_unitario > 0 && (
                <Stat
                  label="Margem teórica"
                  valor={`${(((produto.preco_venda - produto.custo_unitario) / produto.preco_venda) * 100).toFixed(1)}%`}
                />
              )}
            </div>
          </Card>

          <Card variant="elevated" padding={0}>
            <div style={{ padding: '16px 20px', borderBottom: `1px solid ${tokens.border.subtle}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: tokens.text.primary }}>Lotes</h2>
              <Button size="sm" onClick={() => setNovoLoteOpen(true)} leftIcon={<PlusIcon />}>Novo lote</Button>
            </div>
            {lotes.length === 0 ? (
              <div style={{ padding: '32px 20px', textAlign: 'center', color: tokens.text.tertiary, fontSize: 14 }}>
                Sem lotes cadastrados. Adicione um pra rastreabilidade.
              </div>
            ) : (
              <div>
                {lotes.map((l, i) => <LoteRow key={l.id} lote={l} unidade={UNIDADE_LABEL[produto.unidade]} primeiro={i === 0} />)}
              </div>
            )}
          </Card>
        </div>
      </div>

      <NovoLoteModal
        open={novoLoteOpen}
        onClose={() => setNovoLoteOpen(false)}
        onSaved={() => { setNovoLoteOpen(false); toast('Lote registrado e estoque atualizado.', 'success'); void carregar() }}
        produtoId={produto.id}
        fornecedores={fornecedores}
      />
    </FadeIn>
  )
}

function LoteRow({ lote, unidade, primeiro }: { lote: Lote; unidade: string; primeiro: boolean }) {
  const status = statusValidade(lote.validade)
  return (
    <div style={{
      padding: '14px 20px',
      display: 'grid',
      gridTemplateColumns: '1fr auto',
      gap: 8,
      borderTop: primeiro ? 'none' : `1px solid ${tokens.border.subtle}`,
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: tokens.text.primary, fontFamily: 'ui-monospace, SF Mono, monospace' }}>{lote.numero_lote}</span>
          {status && <Badge size="sm" variant={STATUS_VARIANT[status]} dot>{labelValidade(lote.validade)}</Badge>}
        </div>
        <div style={{ fontSize: 12, color: tokens.text.tertiary }}>
          {lote.fornecedor?.nome ? `${lote.fornecedor.nome} · ` : ''}
          {lote.data_compra ? `Comprado em ${new Date(lote.data_compra).toLocaleDateString('pt-BR')}` : 'Sem data de compra'}
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: tokens.text.primary }}>
          {lote.quantidade_atual} {unidade}
        </div>
        <div style={{ fontSize: 11, color: tokens.text.tertiary }}>
          de {lote.quantidade_inicial}
        </div>
      </div>
    </div>
  )
}

function Stat({ label, valor }: { label: string; valor: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 600, color: tokens.text.tertiary, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 600, color: tokens.text.primary }}>{valor}</div>
    </div>
  )
}

function NovoLoteModal({ open, onClose, onSaved, produtoId, fornecedores }: { open: boolean; onClose: () => void; onSaved: () => void; produtoId: string; fornecedores: Fornecedor[] }) {
  const [form, setForm] = useState({ numero: '', validade: '', quantidade: '0', precoCompra: '', dataCompra: '', fornecedorId: '' })
  const [salvando, setSalvando] = useState(false)
  const { toast } = useToast()

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (!form.numero.trim() || Number(form.quantidade) <= 0) {
      toast('Número do lote e quantidade são obrigatórios.', 'error')
      return
    }
    setSalvando(true)
    const qty = Number(form.quantidade)
    const lote = await salvarLote({
      produto_id: produtoId,
      numero_lote: form.numero.trim(),
      validade: form.validade || null,
      quantidade_inicial: qty,
      quantidade_atual: qty,
      preco_compra: form.precoCompra ? Number(form.precoCompra.replace(',', '.')) : null,
      data_compra: form.dataCompra || null,
      fornecedor_id: form.fornecedorId || null,
      ativo: true,
    })
    setSalvando(false)
    if (!lote) { toast('Não consegui salvar.', 'error'); return }
    setForm({ numero: '', validade: '', quantidade: '0', precoCompra: '', dataCompra: '', fornecedorId: '' })
    onSaved()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Novo lote"
      description="Ao salvar, a quantidade entra automaticamente no estoque do produto."
      footer={<>
        <Button variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button onClick={salvar} loading={salvando}>Salvar lote</Button>
      </>}
    >
      <form onSubmit={salvar} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Input label="Número do lote" value={form.numero} onChange={(e) => setForm((f) => ({ ...f, numero: e.target.value }))} required />
          <Input label="Validade" type="date" value={form.validade} onChange={(e) => setForm((f) => ({ ...f, validade: e.target.value }))} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <Input label="Quantidade" value={form.quantidade} onChange={(e) => setForm((f) => ({ ...f, quantidade: e.target.value }))} inputMode="decimal" required />
          <Input label="Preço de compra" value={form.precoCompra} onChange={(e) => setForm((f) => ({ ...f, precoCompra: e.target.value }))} inputMode="decimal" />
          <Input label="Data compra" type="date" value={form.dataCompra} onChange={(e) => setForm((f) => ({ ...f, dataCompra: e.target.value }))} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 13, fontWeight: 500, color: tokens.text.strong }}>Fornecedor</label>
          <select
            value={form.fornecedorId}
            onChange={(e) => setForm((f) => ({ ...f, fornecedorId: e.target.value }))}
            style={{
              height: 42, padding: '0 12px',
              border: `1px solid ${tokens.border.default}`, borderRadius: tokens.radius.lg,
              fontSize: 14, background: tokens.bg.card, color: tokens.text.primary,
            }}
          >
            <option value="">— Sem fornecedor —</option>
            {fornecedores.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </select>
        </div>
      </form>
    </Modal>
  )
}

function PlusIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> }
