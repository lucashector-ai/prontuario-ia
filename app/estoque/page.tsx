'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { tokens } from '@/lib/design-tokens'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { FadeIn } from '@/components/motion/FadeIn'
import { useToast } from '@/components/Toast'
import { SectionHeader } from './_components/SectionHeader'
import { useClinicaId } from '@/lib/financeiro/clinica'
import { listarProdutos, salvarProduto } from '@/lib/estoque/queries'
import { CATEGORIAS, UNIDADES, CATEGORIA_LABEL, UNIDADE_LABEL, type Categoria, type Produto } from '@/lib/estoque/types'
import { moeda } from '@/lib/financeiro/format'

export default function ProdutosPage() {
  const { clinicaId, loading: loadingClinica } = useClinicaId()
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [catFilter, setCatFilter] = useState<'todos' | Categoria>('todos')
  const [novoOpen, setNovoOpen] = useState(false)
  const { toast } = useToast()

  async function carregar() {
    if (!clinicaId) return
    setLoading(true)
    const list = await listarProdutos(clinicaId)
    setProdutos(list)
    setLoading(false)
  }

  useEffect(() => { void carregar() /* eslint-disable-next-line */ }, [clinicaId, loadingClinica])

  const filtrados = useMemo(() => {
    let arr = produtos
    if (catFilter !== 'todos') arr = arr.filter((p) => p.categoria === catFilter)
    const q = busca.trim().toLowerCase()
    if (q) arr = arr.filter((p) => p.nome.toLowerCase().includes(q) || (p.marca && p.marca.toLowerCase().includes(q)))
    return arr
  }, [produtos, busca, catFilter])

  const baixoEstoque = produtos.filter((p) => p.estoque_atual <= p.estoque_minimo && p.estoque_minimo > 0).length

  return (
    <FadeIn>
      <SectionHeader
        title="Produtos"
        description="Peptídeos, toxinas, preenchedores, medicamentos e descartáveis."
        action={<Button onClick={() => setNovoOpen(true)} leftIcon={<PlusIcon />}>Novo produto</Button>}
      />

      {baixoEstoque > 0 && (
        <Card style={{ background: tokens.status.warningBg, border: `1px solid ${tokens.status.warningLight}`, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: tokens.status.warningTextDark, fontSize: 13 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            <span><strong style={{ fontWeight: 600 }}>{baixoEstoque} produto{baixoEstoque > 1 ? 's' : ''}</strong> com estoque abaixo do mínimo.</span>
          </div>
        </Card>
      )}

      <Card variant="elevated" padding={16} style={{ marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, alignItems: 'end' }}>
          <Input label="Buscar" placeholder="Nome ou marca" value={busca} onChange={(e) => setBusca(e.target.value)} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: tokens.text.strong, marginBottom: 6 }}>Categoria</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              <CatChip label="Todas" value="todos" current={catFilter} onClick={setCatFilter as any} />
              {CATEGORIAS.map((c) => (
                <CatChip key={c} label={CATEGORIA_LABEL[c]} value={c} current={catFilter} onClick={setCatFilter as any} />
              ))}
            </div>
          </div>
        </div>
      </Card>

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} height={160} style={{ borderRadius: tokens.radius['3xl'] }} />)}
        </div>
      ) : filtrados.length === 0 ? (
        <Card variant="elevated">
          <div style={{ padding: '40px 20px', textAlign: 'center', color: tokens.text.tertiary, fontSize: 14 }}>
            {produtos.length === 0
              ? 'Nenhum produto cadastrado ainda. Toca em "Novo produto".'
              : 'Nada bate com esses filtros.'}
          </div>
        </Card>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
          {filtrados.map((p) => <ProdutoCard key={p.id} produto={p} />)}
        </div>
      )}

      <NovoProdutoModal
        open={novoOpen}
        onClose={() => setNovoOpen(false)}
        onSaved={(p) => { setNovoOpen(false); toast(`"${p.nome}" cadastrado.`, 'success'); void carregar() }}
        clinicaId={clinicaId}
      />
    </FadeIn>
  )
}

function ProdutoCard({ produto }: { produto: Produto }) {
  const baixo = produto.estoque_minimo > 0 && produto.estoque_atual <= produto.estoque_minimo
  return (
    <Link href={`/estoque/${produto.id}`} style={{ textDecoration: 'none' }}>
      <Card interactive padding={14}>
        <div style={{
          width: '100%', aspectRatio: '4 / 3',
          background: produto.foto_url ? `url(${produto.foto_url}) center/cover` : tokens.bg.cardSubtle,
          borderRadius: tokens.radius.xl,
          marginBottom: 12,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: tokens.text.tertiary,
        }}>
          {!produto.foto_url && <BoxIcon />}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
          <Badge size="sm">{CATEGORIA_LABEL[produto.categoria]}</Badge>
          {baixo && <Badge size="sm" variant="warning" dot>Baixo</Badge>}
        </div>
        <div style={{ fontSize: 15, fontWeight: 600, color: tokens.text.primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {produto.nome}
        </div>
        {produto.marca && (
          <div style={{ fontSize: 12, color: tokens.text.tertiary, marginBottom: 8 }}>{produto.marca}</div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 6 }}>
          <span style={{ fontSize: 13, color: tokens.text.secondary }}>
            <strong style={{ color: tokens.text.primary, fontWeight: 600 }}>{produto.estoque_atual}</strong>{' '}
            {UNIDADE_LABEL[produto.unidade]}
          </span>
          {produto.preco_venda != null && (
            <span style={{ fontSize: 13, fontWeight: 600, color: tokens.text.strong }}>{moeda(produto.preco_venda)}</span>
          )}
        </div>
      </Card>
    </Link>
  )
}

function CatChip({ label, value, current, onClick }: { label: string; value: string; current: string; onClick: (v: string) => void }) {
  const active = value === current
  return (
    <button
      type="button"
      onClick={() => onClick(value)}
      style={{
        padding: '5px 10px',
        fontSize: 12,
        fontWeight: active ? 600 : 500,
        color: active ? tokens.text.inverse : tokens.text.strong,
        background: active ? tokens.brand.primary : tokens.bg.cardSubtle,
        border: 'none',
        borderRadius: 999,
        cursor: 'pointer',
        transition: 'all 120ms',
      }}
    >
      {label}
    </button>
  )
}

function NovoProdutoModal({ open, onClose, onSaved, clinicaId }: { open: boolean; onClose: () => void; onSaved: (p: Produto) => void; clinicaId: string | null }) {
  const [form, setForm] = useState({
    nome: '', marca: '',
    categoria: 'medicamento' as Categoria,
    unidade: 'unidade' as typeof UNIDADES[number],
    estoqueAtual: '0', estoqueMinimo: '0',
    custoUnitario: '0', precoVenda: '',
    fotoUrl: '',
  })
  const [salvando, setSalvando] = useState(false)
  const { toast } = useToast()

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (!clinicaId) return
    if (!form.nome.trim()) { toast('Nome é obrigatório.', 'error'); return }
    setSalvando(true)
    const p = await salvarProduto({
      clinica_id: clinicaId,
      nome: form.nome.trim(),
      marca: form.marca.trim() || null,
      categoria: form.categoria,
      unidade: form.unidade,
      estoque_atual: Number(form.estoqueAtual) || 0,
      estoque_minimo: Number(form.estoqueMinimo) || 0,
      custo_unitario: Number(form.custoUnitario.replace(',', '.')) || 0,
      preco_venda: form.precoVenda ? Number(form.precoVenda.replace(',', '.')) : null,
      foto_url: form.fotoUrl.trim() || null,
      ativo: true,
    })
    setSalvando(false)
    if (!p) { toast('Não consegui salvar.', 'error'); return }
    onSaved(p)
    setForm({ nome: '', marca: '', categoria: 'medicamento', unidade: 'unidade', estoqueAtual: '0', estoqueMinimo: '0', custoUnitario: '0', precoVenda: '', fotoUrl: '' })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Novo produto"
      size="lg"
      footer={<>
        <Button variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button onClick={salvar} loading={salvando}>Salvar</Button>
      </>}
    >
      <form onSubmit={salvar} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
          <Input label="Nome" value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} required />
          <Input label="Marca" value={form.marca} onChange={(e) => setForm((f) => ({ ...f, marca: e.target.value }))} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <SelectField label="Categoria" value={form.categoria} onChange={(v) => setForm((f) => ({ ...f, categoria: v as Categoria }))} options={CATEGORIAS.map((c) => ({ v: c, l: CATEGORIA_LABEL[c] }))} />
          <SelectField label="Unidade" value={form.unidade} onChange={(v) => setForm((f) => ({ ...f, unidade: v as any }))} options={UNIDADES.map((u) => ({ v: u, l: UNIDADE_LABEL[u] }))} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          <Input label="Estoque atual" value={form.estoqueAtual} onChange={(e) => setForm((f) => ({ ...f, estoqueAtual: e.target.value }))} inputMode="decimal" />
          <Input label="Mínimo" value={form.estoqueMinimo} onChange={(e) => setForm((f) => ({ ...f, estoqueMinimo: e.target.value }))} inputMode="decimal" />
          <Input label="Custo unit." value={form.custoUnitario} onChange={(e) => setForm((f) => ({ ...f, custoUnitario: e.target.value }))} inputMode="decimal" />
          <Input label="Preço venda" value={form.precoVenda} onChange={(e) => setForm((f) => ({ ...f, precoVenda: e.target.value }))} inputMode="decimal" />
        </div>
        <Input label="Foto (URL)" value={form.fotoUrl} onChange={(e) => setForm((f) => ({ ...f, fotoUrl: e.target.value }))} placeholder="https://..." hint="Upload direto chega no Sprint 6." />
      </form>
    </Modal>
  )
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { v: string; l: string }[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 13, fontWeight: 500, color: tokens.text.strong }}>{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          height: 42,
          padding: '0 12px',
          border: `1px solid ${tokens.border.default}`,
          borderRadius: tokens.radius.lg,
          fontSize: 14,
          background: tokens.bg.card,
          color: tokens.text.primary,
        }}
      >
        {options.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
    </div>
  )
}

function PlusIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> }
function BoxIcon() { return <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg> }
