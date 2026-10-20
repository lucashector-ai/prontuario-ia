'use client'
/** "Consome": insumos e quantidades que saem do estoque quando o procedimento é realizado. */
import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { tokens as T } from '@/lib/design-tokens'
import { Button, Input, Select } from '@/components/ui'
import { notificar } from '@/components/ui/dialogos'

export function InsumosDoProcedimento({ procedimentoId }: { procedimentoId: string }) {
  const [itens, setItens] = useState<{ id: string; nome: string; unidade: string }[]>([])
  const [linhas, setLinhas] = useState<{ item_id: string; quantidade: string }[]>([])
  const [carregado, setCarregado] = useState(false)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/estoque').then(r => r.ok ? r.json() : { itens: [] }),
      fetch('/api/estoque?procedimento_id=' + procedimentoId).then(r => r.ok ? r.json() : { insumos: [] }),
    ]).then(([a, b]) => {
      setItens((a.itens || []).filter((i: any) => i.ativo))
      setLinhas((b.insumos || []).map((i: any) => ({ item_id: i.item_id, quantidade: String(i.quantidade) })))
      setCarregado(true)
    }).catch(() => setCarregado(true))
  }, [procedimentoId])

  async function salvar() {
    setSalvando(true)
    try {
      const r = await fetch('/api/estoque', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'insumos', procedimento_id: procedimentoId, insumos: linhas.map(l => ({ item_id: l.item_id, quantidade: Number(l.quantidade) })) }) })
      const j = await r.json().catch(() => ({}))
      notificar(r.ok ? 'Insumos do procedimento salvos' : (j.error || 'Não foi possível salvar.'), r.ok ? undefined : 'erro')
    } finally { setSalvando(false) }
  }

  if (!carregado) return null
  if (!itens.length) return <div style={{ fontSize: 12, color: T.text.tertiary }}>Para dar baixa automática dos insumos, cadastre os itens em Estoque.</div>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12, borderRadius: 12, border: `1px solid ${T.border.default}` }}>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: T.text.secondary }}>Consome do estoque (baixa automática ao concluir)</div>
      {linhas.map((l, k) => (
        <div key={k} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 90px 28px', gap: 6, alignItems: 'center' }}>
          <Select value={l.item_id} onChange={e => setLinhas(x => x.map((y, j) => j === k ? { ...y, item_id: e.target.value } : y))}>
            <option value="">Escolha o insumo</option>
            {itens.map(i => <option key={i.id} value={i.id}>{i.nome} ({i.unidade})</option>)}
          </Select>
          <Input type="number" min={0} step="0.01" value={l.quantidade} onChange={e => setLinhas(x => x.map((y, j) => j === k ? { ...y, quantidade: e.target.value } : y))} placeholder="Qtd." />
          <button type="button" onClick={() => setLinhas(x => x.filter((_, j) => j !== k))} aria-label="Remover" style={{ border: 'none', background: 'none', cursor: 'pointer', color: T.text.tertiary }}><Trash2 size={15} /></button>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 6 }}>
        <Button type="button" size="sm" variant="ghost" icon={Plus} onClick={() => setLinhas(x => [...x, { item_id: '', quantidade: '1' }])}>Insumo</Button>
        <Button type="button" size="sm" variant="secondary" onClick={salvar} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar insumos'}</Button>
      </div>
    </div>
  )
}
