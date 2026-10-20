'use client'
/**
 * Estoque de insumos: saber o que falta e o que vence. Entrada como uma nota (vários itens, lote e
 * validade), saída avulsa/perda, baixa automática pelos procedimentos realizados, reposição sugerida
 * com o porquê, e inventário que gera os ajustes.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Package, Plus, PackagePlus, PackageMinus, TriangleAlert, CalendarClock, Copy, Download, ClipboardCheck, Trash2 } from 'lucide-react'
import { tokens as T } from '@/lib/design-tokens'
import { usePageHeader } from '@/components/shell/header-context'
import { Button, Card, Chip, Drawer, EmptyState, Field, Input, Modal, SearchInput, Select, Tabs } from '@/components/ui'
import { notificar } from '@/components/ui/dialogos'
import { ehDemo, avisoDemo } from '@/lib/demo'
import { alertasDoItem, sugestaoReposicao, type Alerta } from '@/lib/estoque/calculos'

type Lote = { id: string; lote: string | null; validade: string | null; saldo: number }
type Item = { id: string; nome: string; unidade: string; estoque_minimo: number; controla_lote: boolean; custo_unitario: number | null; ativo: boolean; saldo: number; proxima_validade: string | null; consumo30: number; lotes: Lote[]; alertas: Alerta[] }
type Mov = { id: string; tipo: string; quantidade: number; falta: number; fornecedor: string | null; motivo: string | null; criado_em: string; item: { nome: string; unidade: string } | null; lote: { lote: string | null; validade: string | null } | null; paciente: { nome: string } | null }
type Repo = { item_id: string; nome: string; unidade: string; saldo: number; sugerido: number; porque: string[] }
type Aba = 'itens' | 'movimentos' | 'reposicao' | 'inventario'

const hoje = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
const dataBR = (d: string) => new Date(d.length === 10 ? d + 'T12:00:00' : d).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
const q = (n: number) => (Math.round(Number(n) * 100) / 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })
const NOME_TIPO: Record<string, string> = { entrada: 'Entrada', baixa_procedimento: 'Baixa do procedimento', saida_avulsa: 'Uso avulso', perda: 'Perda', vencido: 'Vencido', ajuste: 'Ajuste de inventário', estorno: 'Estorno' }
const NOME_ALERTA: Record<Alerta, { t: string; cor: string; fundo: string }> = {
  zerado: { t: 'Zerado', cor: T.status.danger, fundo: T.status.dangerBg },
  abaixo_minimo: { t: 'Abaixo do mínimo', cor: T.status.warning, fundo: T.status.warningBg },
  vencido: { t: 'Lote vencido', cor: T.status.danger, fundo: T.status.dangerBg },
  vence_7: { t: 'Vence em 7 dias', cor: T.status.danger, fundo: T.status.dangerBg },
  vence_30: { t: 'Vence em 30 dias', cor: T.status.warning, fundo: T.status.warningBg },
}

function demoItens(): Item[] {
  const d = (dias: number) => new Date(Date.now() + dias * 864e5).toLocaleDateString('en-CA')
  const it = (id: string, nome: string, unidade: string, minimo: number, lotes: [string, number, number][], consumo30: number): Item => {
    const ls = lotes.map(([lote, dias, saldo], k) => ({ id: id + k, lote, validade: d(dias), saldo }))
    const saldo = ls.reduce((s, l) => s + l.saldo, 0)
    const proxima = ls.map(l => l.validade).sort()[0] || null
    return { id, nome, unidade, estoque_minimo: minimo, controla_lote: true, custo_unitario: null, ativo: true, saldo, proxima_validade: proxima, consumo30, lotes: ls, alertas: alertasDoItem({ saldo, minimo, proximaValidade: proxima }, hoje()) }
  }
  return [
    it('i1', 'Ácido hialurônico 1 ml', 'seringa', 5, [['AH2291', 120, 3]], 14),
    it('i2', 'Toxina botulínica 100U', 'frasco', 4, [['TB771', 5, 2], ['TB802', 200, 6]], 10),
    it('i3', 'Seringa 3 ml', 'un', 50, [['S-01', 400, 180]], 120),
    it('i4', 'Agulha 30G', 'un', 100, [['A30', 300, 60]], 140),
    it('i5', 'Lidocaína 2%', 'frasco', 3, [['LD19', 25, 4]], 3),
    it('i6', 'Luva de procedimento M', 'caixa', 4, [], 6),
    it('i7', 'Gaze estéril', 'pacote', 20, [['GZ5', 500, 45]], 18),
  ]
}

export default function EstoquePage() {
  usePageHeader('Estoque', 'O que falta, o que vence e o que comprar')
  const demo = typeof window !== 'undefined' && ehDemo()
  const [aba, setAba] = useState<Aba>('itens')
  const [itens, setItens] = useState<Item[] | null>(null)
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<'todos' | 'falta' | 'vence'>('todos')
  const [entrada, setEntrada] = useState(false)
  const [novoItem, setNovoItem] = useState<Partial<Item> | null>(null)
  const [saida, setSaida] = useState<Item | null>(null)

  const carregar = useCallback(async () => {
    if (ehDemo()) { setItens(demoItens()); return }
    const r = await fetch('/api/estoque')
    const j = await r.json().catch(() => ({}))
    if (!r.ok) { notificar(j.error || 'Não foi possível abrir o estoque.', 'erro'); setItens([]); return }
    setItens(j.itens || [])
  }, [])
  useEffect(() => { carregar() }, [carregar])

  async function post(corpo: any, ok?: string) {
    if (ehDemo()) { avisoDemo(); return null }
    const r = await fetch('/api/estoque', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) { notificar(j.error || 'Não foi possível salvar.', 'erro'); return null }
    if (ok) notificar(ok)
    carregar()
    return j
  }

  const lista = itens || []
  const falta = lista.filter(i => i.alertas.includes('zerado') || i.alertas.includes('abaixo_minimo'))
  const vence = lista.filter(i => i.alertas.some(a => a.startsWith('vence') || a === 'vencido'))
  const visiveis = lista.filter(i => i.nome.toLowerCase().includes(busca.trim().toLowerCase()))
    .filter(i => filtro === 'falta' ? falta.includes(i) : filtro === 'vence' ? vence.includes(i) : true)

  return (
    <div className="c360-pagina" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <Tabs ativa={aba} onChange={id => setAba(id as Aba)} tabs={[
          { id: 'itens', label: 'Itens' }, { id: 'reposicao', label: 'Reposição' }, { id: 'movimentos', label: 'Movimentos' }, { id: 'inventario', label: 'Inventário' },
        ]} />
        <span style={{ flex: 1 }} />
        <Button variant="secondary" icon={Plus} onClick={() => setNovoItem({ unidade: 'un', estoque_minimo: 0, controla_lote: true })}>Novo item</Button>
        <Button icon={PackagePlus} onClick={() => setEntrada(true)} disabled={!lista.length}>Registrar entrada</Button>
      </div>

      {aba === 'itens' && (itens && !lista.length ? (
        <Card><EmptyState icon={Package} titulo="Nenhum item no estoque" descricao="Cadastre os insumos (seringas, ampolas, luvas…), defina o estoque mínimo e ligue aos procedimentos: a baixa passa a ser automática quando o atendimento é concluído." acao={<Button icon={Plus} onClick={() => setNovoItem({ unidade: 'un', estoque_minimo: 0, controla_lote: true })}>Cadastrar item</Button>} /></Card>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <Chip ativo={filtro === 'todos'} onClick={() => setFiltro('todos')}>Todos ({lista.length})</Chip>
            <Chip ativo={filtro === 'falta'} onClick={() => setFiltro('falta')} icon={TriangleAlert}>Em falta ou abaixo do mínimo ({falta.length})</Chip>
            <Chip ativo={filtro === 'vence'} onClick={() => setFiltro('vence')} icon={CalendarClock}>Vencendo ({vence.length})</Chip>
            <span style={{ flex: 1 }} />
            <div style={{ width: 260, maxWidth: '100%' }}><SearchInput value={busca} onChange={setBusca} placeholder="Buscar item" /></div>
          </div>
          <Card padding={0} style={{ overflow: 'hidden' }}>
            {visiveis.map(i => {
              const pct = i.estoque_minimo > 0 ? Math.min(100, (i.saldo / (i.estoque_minimo * 2)) * 100) : 100
              return (
                <div key={i.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', borderBottom: `1px solid ${T.border.muted}`, flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: T.text.primary }}>{i.nome}</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                      {i.alertas.map(a => <span key={a} style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99, color: NOME_ALERTA[a].cor, background: NOME_ALERTA[a].fundo }}>{NOME_ALERTA[a].t}</span>)}
                      {i.proxima_validade && <span style={{ fontSize: 11.5, color: T.text.tertiary }}>próximo lote vence {dataBR(i.proxima_validade)}</span>}
                    </div>
                  </div>
                  <div style={{ width: 170 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: i.alertas.includes('zerado') ? T.status.danger : T.text.primary }}>{q(i.saldo)} <span style={{ fontSize: 12, fontWeight: 500, color: T.text.tertiary }}>{i.unidade}</span></div>
                    <div style={{ height: 5, borderRadius: 99, background: T.bg.hover, marginTop: 4 }}>
                      <div style={{ width: pct + '%', height: '100%', borderRadius: 99, background: i.alertas.includes('abaixo_minimo') || i.alertas.includes('zerado') ? T.status.warning : T.status.success }} />
                    </div>
                    <div style={{ fontSize: 11, color: T.text.tertiary, marginTop: 2 }}>mínimo {q(i.estoque_minimo)} · {q(i.consumo30)} usados em 30 dias</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <Button size="sm" variant="ghost" icon={PackageMinus} onClick={() => setSaida(i)} disabled={i.saldo <= 0}>Saída</Button>
                    <Button size="sm" variant="ghost" onClick={() => setNovoItem(i)}>Editar</Button>
                  </div>
                </div>
              )
            })}
            {!visiveis.length && <p style={{ padding: 20, textAlign: 'center', fontSize: 13, color: T.text.quaternary, margin: 0 }}>Nada por aqui.</p>}
          </Card>
        </>
      ))}

      {aba === 'reposicao' && <AbaReposicao itens={lista} demo={demo} />}
      {aba === 'movimentos' && <AbaMovimentos demo={demo} />}
      {aba === 'inventario' && <AbaInventario itens={lista} onAplicar={contagem => post({ acao: 'inventario', contagem }, 'Ajustes de inventário lançados')} />}

      {entrada && <EntradaDrawer itens={lista} onClose={() => setEntrada(false)} onSalvar={async (corpo) => { if (await post({ acao: 'entrada', ...corpo }, 'Entrada registrada')) setEntrada(false) }} />}
      {novoItem && <ItemModal inicial={novoItem} onClose={() => setNovoItem(null)} onSalvar={async (corpo) => { if (await post({ acao: 'item', ...corpo }, 'Item salvo')) setNovoItem(null) }} />}
      {saida && <SaidaModal item={saida} onClose={() => setSaida(null)} onSalvar={async (corpo) => {
        const j = await post({ acao: 'saida', item_id: saida.id, ...corpo })
        if (j) { notificar(j.faltou > 0 ? `Saída registrada; faltaram ${q(j.faltou)} ${saida.unidade} no estoque.` : 'Saída registrada'); setSaida(null) }
      }} />}
    </div>
  )
}

function ItemModal({ inicial, onClose, onSalvar }: { inicial: Partial<Item>; onClose: () => void; onSalvar: (c: any) => void }) {
  const [f, setF] = useState({ nome: inicial.nome || '', unidade: inicial.unidade || 'un', estoque_minimo: String(inicial.estoque_minimo ?? 0), custo_unitario: inicial.custo_unitario != null ? String(inicial.custo_unitario) : '', controla_lote: inicial.controla_lote !== false })
  return (
    <Modal titulo={inicial.id ? 'Editar item' : 'Novo item'} onClose={onClose} largura={460}
      rodape={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button onClick={() => onSalvar({ id: inicial.id, ...f, estoque_minimo: Number(f.estoque_minimo) || 0, custo_unitario: f.custo_unitario ? Number(f.custo_unitario) : null })}>Salvar</Button></>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Field label="Nome"><Input value={f.nome} onChange={e => setF(v => ({ ...v, nome: e.target.value }))} placeholder="Ex.: Seringa 3 ml" autoFocus /></Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <Field label="Unidade">
            <Select value={f.unidade} onChange={e => setF(v => ({ ...v, unidade: e.target.value }))}>
              {['un', 'ml', 'mg', 'frasco', 'ampola', 'seringa', 'caixa', 'pacote', 'par'].map(u => <option key={u} value={u}>{u}</option>)}
            </Select>
          </Field>
          <Field label="Estoque mínimo"><Input type="number" min={0} value={f.estoque_minimo} onChange={e => setF(v => ({ ...v, estoque_minimo: e.target.value }))} /></Field>
          <Field label="Custo (R$)"><Input type="number" min={0} step="0.01" value={f.custo_unitario} onChange={e => setF(v => ({ ...v, custo_unitario: e.target.value }))} placeholder="Opcional" /></Field>
        </div>
      </div>
    </Modal>
  )
}

function SaidaModal({ item, onClose, onSalvar }: { item: Item; onClose: () => void; onSalvar: (c: any) => void }) {
  const [qtd, setQtd] = useState('1')
  const [tipo, setTipo] = useState<'saida_avulsa' | 'perda' | 'vencido'>('saida_avulsa')
  const [motivo, setMotivo] = useState('')
  return (
    <Modal titulo={`Saída · ${item.nome}`} onClose={onClose} largura={420}
      rodape={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button onClick={() => onSalvar({ quantidade: Number(qtd), tipo, motivo })}>Registrar saída</Button></>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {([['saida_avulsa', 'Uso avulso'], ['perda', 'Perda'], ['vencido', 'Vencido']] as const).map(([v, l]) => <Chip key={v} ativo={tipo === v} onClick={() => setTipo(v)}>{l}</Chip>)}
        </div>
        <Field label={`Quantidade (${item.unidade}) · saldo ${q(item.saldo)}`}><Input type="number" min={0} step="0.01" value={qtd} onChange={e => setQtd(e.target.value)} autoFocus /></Field>
        <Field label="Motivo (opcional)"><Input value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Ex.: frasco quebrou" /></Field>
        <div style={{ fontSize: 12, color: T.text.tertiary }}>Sai primeiro do lote que vence antes.</div>
      </div>
    </Modal>
  )
}

function EntradaDrawer({ itens, onClose, onSalvar }: { itens: Item[]; onClose: () => void; onSalvar: (c: any) => void }) {
  const [fornecedor, setFornecedor] = useState('')
  const [linhas, setLinhas] = useState<{ item_id: string; quantidade: string; lote: string; validade: string }[]>([{ item_id: '', quantidade: '', lote: '', validade: '' }])
  const set = (k: number, c: string, v: string) => setLinhas(l => l.map((x, j) => j === k ? { ...x, [c]: v } : x))
  const salvar = () => {
    const passado = linhas.some(l => l.validade && l.validade < hoje())
    if (passado && !window.confirm('Há validade no passado. Dar entrada mesmo assim?')) return
    onSalvar({ fornecedor, linhas: linhas.filter(l => l.item_id && Number(l.quantidade) > 0).map(l => ({ ...l, quantidade: Number(l.quantidade) })) })
  }
  return (
    <Drawer titulo="Registrar entrada" onClose={onClose} largura={560} rodape={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button icon={PackagePlus} onClick={salvar}>Dar entrada</Button></>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field label="Fornecedor (opcional)"><Input value={fornecedor} onChange={e => setFornecedor(e.target.value)} placeholder="Ex.: Distribuidora Saúde" /></Field>
        {linhas.map((l, k) => (
          <div key={k} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.6fr) 80px 1fr 1fr 28px', gap: 6, alignItems: 'end' }}>
            <Field label={k === 0 ? 'Item' : ''}>
              <Select value={l.item_id} onChange={e => set(k, 'item_id', e.target.value)}>
                <option value="">Escolha o item</option>
                {itens.map(i => <option key={i.id} value={i.id}>{i.nome} ({i.unidade})</option>)}
              </Select>
            </Field>
            <Field label={k === 0 ? 'Qtd.' : ''}><Input type="number" min={0} step="0.01" value={l.quantidade} onChange={e => set(k, 'quantidade', e.target.value)} /></Field>
            <Field label={k === 0 ? 'Lote' : ''}><Input value={l.lote} onChange={e => set(k, 'lote', e.target.value)} placeholder="Opcional" /></Field>
            <Field label={k === 0 ? 'Validade' : ''}><Input type="date" value={l.validade} onChange={e => set(k, 'validade', e.target.value)} /></Field>
            <button onClick={() => setLinhas(x => x.length > 1 ? x.filter((_, j) => j !== k) : x)} aria-label="Remover linha" style={{ border: 'none', background: 'none', cursor: 'pointer', color: T.text.tertiary, paddingBottom: 8 }}><Trash2 size={15} /></button>
          </div>
        ))}
        <Button variant="ghost" icon={Plus} onClick={() => setLinhas(l => [...l, { item_id: '', quantidade: '', lote: '', validade: '' }])} style={{ alignSelf: 'flex-start' }}>Mais um item</Button>
      </div>
    </Drawer>
  )
}

function AbaReposicao({ itens, demo }: { itens: Item[]; demo: boolean }) {
  const [lista, setLista] = useState<Repo[] | null>(null)
  const [aberto, setAberto] = useState<string | null>(null)
  useEffect(() => {
    if (demo) {
      setLista(itens.map(i => ({ item_id: i.id, nome: i.nome, unidade: i.unidade, saldo: i.saldo, ...sugestaoReposicao({ saldo: i.saldo, minimo: i.estoque_minimo, consumo30: i.consumo30, previsto14: 0, vencendo: i.lotes.filter(l => l.validade && l.validade <= new Date(Date.now() + 30 * 864e5).toLocaleDateString('en-CA')).reduce((s, l) => s + l.saldo, 0) }) })).filter(r => r.sugerido > 0))
      return
    }
    fetch('/api/estoque?ver=reposicao').then(r => r.json()).then(j => setLista(j.reposicao || [])).catch(() => setLista([]))
  }, [demo, itens])
  const texto = useMemo(() => (lista || []).map(r => `${r.nome}: ${q(r.sugerido)} ${r.unidade}`).join('\n'), [lista])
  if (!lista) return <Card><div style={{ padding: 16, fontSize: 13, color: T.text.tertiary }}>Calculando…</div></Card>
  if (!lista.length) return <Card><EmptyState icon={ClipboardCheck} titulo="Nada para comprar agora" descricao="O estoque cobre o consumo dos próximos 30 dias e a agenda dos próximos 14." /></Card>
  return (
    <Card padding={0} style={{ overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderBottom: `1px solid ${T.border.default}`, flexWrap: 'wrap' }}>
        <span style={{ flex: 1, fontSize: 13, color: T.text.secondary }}>Para cobrir 30 dias de consumo e a agenda dos próximos 14 dias. Toque num item para ver o porquê.</span>
        <Button size="sm" variant="secondary" icon={Copy} onClick={() => { navigator.clipboard?.writeText('Pedido de compra\n' + texto); notificar('Lista copiada: é só colar no WhatsApp do fornecedor') }}>Copiar lista</Button>
        <Button size="sm" variant="ghost" icon={Download} onClick={() => {
          const csv = 'Item;Quantidade;Unidade\n' + (lista || []).map(r => `${r.nome};${String(r.sugerido).replace('.', ',')};${r.unidade}`).join('\n')
          const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })); a.download = 'reposicao.csv'; a.click()
        }}>CSV</Button>
      </div>
      {lista.map(r => (
        <div key={r.item_id} onClick={() => setAberto(aberto === r.item_id ? null : r.item_id)} style={{ padding: '12px 16px', borderBottom: `1px solid ${T.border.muted}`, cursor: 'pointer' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: T.text.primary }}>{r.nome}</span>
            <span style={{ fontSize: 12.5, color: T.text.tertiary }}>saldo {q(r.saldo)}</span>
            <span style={{ fontSize: 15, fontWeight: 750, color: T.brand.primary }}>comprar {q(r.sugerido)} {r.unidade}</span>
          </div>
          {aberto === r.item_id && <ul style={{ margin: '8px 0 0 18px', padding: 0, fontSize: 12.5, color: T.text.secondary, lineHeight: 1.6 }}>{r.porque.map(p => <li key={p}>{p}</li>)}</ul>}
        </div>
      ))}
    </Card>
  )
}

function AbaMovimentos({ demo }: { demo: boolean }) {
  const [movs, setMovs] = useState<Mov[] | null>(null)
  useEffect(() => {
    if (demo) {
      const agora = Date.now()
      setMovs([
        { id: 'm1', tipo: 'baixa_procedimento', quantidade: -1, falta: 0, fornecedor: null, motivo: null, criado_em: new Date(agora - 3600e3).toISOString(), item: { nome: 'Ácido hialurônico 1 ml', unidade: 'seringa' }, lote: { lote: 'AH2291', validade: null }, paciente: { nome: 'Mariana Costa Ribeiro' } },
        { id: 'm2', tipo: 'entrada', quantidade: 200, falta: 0, fornecedor: 'Distribuidora Saúde', motivo: null, criado_em: new Date(agora - 86400e3).toISOString(), item: { nome: 'Seringa 3 ml', unidade: 'un' }, lote: { lote: 'S-01', validade: null }, paciente: null },
        { id: 'm3', tipo: 'perda', quantidade: -1, falta: 0, fornecedor: null, motivo: 'Frasco quebrou', criado_em: new Date(agora - 2 * 86400e3).toISOString(), item: { nome: 'Lidocaína 2%', unidade: 'frasco' }, lote: { lote: 'LD19', validade: null }, paciente: null },
      ])
      return
    }
    fetch('/api/estoque?ver=movimentos').then(r => r.json()).then(j => setMovs(j.movimentos || [])).catch(() => setMovs([]))
  }, [demo])
  if (!movs) return <Card><div style={{ padding: 16, fontSize: 13, color: T.text.tertiary }}>Carregando…</div></Card>
  if (!movs.length) return <Card><EmptyState icon={Package} titulo="Nenhum movimento ainda" descricao="Entradas, baixas dos procedimentos, perdas e ajustes aparecem aqui. Nada é apagado." /></Card>
  return (
    <Card padding={0} style={{ overflow: 'hidden' }}>
      {movs.map(m => (
        <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: `1px solid ${T.border.muted}`, fontSize: 13, flexWrap: 'wrap' }}>
          <span style={{ width: 92, color: T.text.tertiary, fontSize: 12 }}>{new Date(m.criado_em).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
          <span style={{ flex: '1 1 200px', minWidth: 0 }}>
            <b style={{ color: T.text.primary }}>{m.item?.nome}</b>
            <span style={{ display: 'block', fontSize: 12, color: T.text.tertiary }}>
              {NOME_TIPO[m.tipo] || m.tipo}{m.lote?.lote ? ` · lote ${m.lote.lote}` : ''}{m.paciente ? ` · ${m.paciente.nome}` : ''}{m.fornecedor ? ` · ${m.fornecedor}` : ''}{m.motivo ? ` · ${m.motivo}` : ''}
            </span>
          </span>
          <span style={{ fontWeight: 700, color: m.quantidade > 0 ? T.status.success : m.falta > 0 ? T.status.danger : T.text.primary }}>
            {m.falta > 0 ? `faltaram ${q(m.falta)}` : `${m.quantidade > 0 ? '+' : ''}${q(m.quantidade)}`} {m.item?.unidade}
          </span>
        </div>
      ))}
    </Card>
  )
}

function AbaInventario({ itens, onAplicar }: { itens: Item[]; onAplicar: (contagem: { item_id: string; contado: number }[]) => void }) {
  const [contado, setContado] = useState<Record<string, string>>({})
  const difs = itens.filter(i => contado[i.id] !== undefined && contado[i.id] !== '' && Number(contado[i.id]) !== i.saldo)
  return (
    <Card padding={0} style={{ overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderBottom: `1px solid ${T.border.default}` }}>
        <span style={{ flex: 1, fontSize: 13, color: T.text.secondary }}>Conte o que tem na prateleira e digite. Só os itens contados geram ajuste.</span>
        <Button size="sm" icon={ClipboardCheck} disabled={!difs.length} onClick={() => onAplicar(difs.map(i => ({ item_id: i.id, contado: Number(contado[i.id]) })))}>Gerar {difs.length || ''} ajuste{difs.length === 1 ? '' : 's'}</Button>
      </div>
      {itens.map(i => {
        const c = contado[i.id]
        const dif = c !== undefined && c !== '' ? Number(c) - i.saldo : null
        return (
          <div key={i.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 110px 110px 90px', gap: 10, alignItems: 'center', padding: '8px 16px', borderBottom: `1px solid ${T.border.muted}`, fontSize: 13 }}>
            <span style={{ color: T.text.primary, fontWeight: 600 }}>{i.nome}</span>
            <span style={{ color: T.text.tertiary }}>sistema: {q(i.saldo)} {i.unidade}</span>
            <Input type="number" min={0} step="0.01" value={c ?? ''} onChange={e => setContado(v => ({ ...v, [i.id]: e.target.value }))} placeholder="contado" />
            <span style={{ fontWeight: 700, color: dif === null || dif === 0 ? T.text.tertiary : dif > 0 ? T.status.success : T.status.danger }}>{dif === null ? '' : dif === 0 ? 'confere' : `${dif > 0 ? '+' : ''}${q(dif)}`}</span>
          </div>
        )
      })}
    </Card>
  )
}
