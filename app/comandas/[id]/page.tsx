'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const ACCENT = '#6043C1'
const ACCENT_LIGHT = '#f0ebff'
const BG = '#fafafa'
const CARD_RADIUS = 14

export default function ComandaDetalhe() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [comanda, setComanda] = useState<any>(null)
  const [itens, setItens] = useState<any[]>([])
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [procedimentos, setProcedimentos] = useState<any[]>([])

  // Form de novo item
  const [novoItem, setNovoItem] = useState({ procedimento_id: '', descricao: '', quantidade: 1, valor_unitario: '' })

  // Modal de fechar
  const [modalFechar, setModalFechar] = useState(false)
  const [formaPagamento, setFormaPagamento] = useState('pix')
  const [contaId, setContaId] = useState<string>('')
  const [contas, setContas] = useState<any[]>([])

  const [desconto, setDesconto] = useState('0')
  const [observacao, setObservacao] = useState('')

  const carregar = useCallback(async () => {
    setCarregando(true)
    try {
      const r = await fetch('/api/comandas/' + id)
      const d = await r.json()
      if (d.comanda) {
        setComanda(d.comanda)
        setItens(d.itens || [])
        setDesconto(String(d.comanda.desconto || 0))
        setObservacao(d.comanda.observacao || '')
      }
    } finally { setCarregando(false) }
  }, [id])

  useEffect(() => { carregar() }, [carregar])

  // Carrega procedimentos da clinica
  useEffect(() => {
    if (!comanda?.clinica_id) return
    supabase.from('procedimentos').select('id, nome, preco').eq('clinica_id', comanda.clinica_id).eq('ativo', true).order('nome').then(({ data }) => setProcedimentos(data || []))
    supabase.from('financeiro_contas').select('id, nome, tipo').eq('clinica_id', comanda.clinica_id).eq('ativo', true).then(({ data }) => setContas(data || []))
  }, [comanda?.clinica_id])

  async function adicionarItem() {
    if (!novoItem.descricao.trim() || !novoItem.valor_unitario) {
      alert('Preencha descrição e valor')
      return
    }
    setSalvando(true)
    try {
      const r = await fetch('/api/comandas/' + id + '/itens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          procedimento_id: novoItem.procedimento_id || null,
          descricao: novoItem.descricao,
          quantidade: Number(novoItem.quantidade) || 1,
          valor_unitario: Number(novoItem.valor_unitario.replace(',', '.')),
        }),
      })
      const d = await r.json()
      if (d.error) { alert('Erro: ' + d.error); return }
      setNovoItem({ procedimento_id: '', descricao: '', quantidade: 1, valor_unitario: '' })
      await carregar()
    } finally { setSalvando(false) }
  }

  async function removerItem(itemId: string) {
    if (!confirm('Remover este item?')) return
    await fetch('/api/comandas/' + id + '/itens?item_id=' + itemId, { method: 'DELETE' })
    await carregar()
  }

  async function selecionarProcedimento(procId: string) {
    const p = procedimentos.find(x => x.id === procId)
    if (p) {
      setNovoItem({
        procedimento_id: procId,
        descricao: p.nome,
        quantidade: 1,
        valor_unitario: String(p.preco || 0).replace('.', ','),
      })
    } else {
      setNovoItem({ ...novoItem, procedimento_id: '' })
    }
  }

  async function salvarDesconto() {
    setSalvando(true)
    try {
      await fetch('/api/comandas/' + id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          desconto: Number(desconto.replace(',', '.')) || 0,
          observacao,
        }),
      })
      // Re-trigger calculo total ao adicionar/remover item ja recalcula
      await carregar()
    } finally { setSalvando(false) }
  }

  async function fecharComanda() {
    setSalvando(true)
    try {
      const r = await fetch('/api/comandas/' + id + '/fechar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          forma_pagamento: formaPagamento,
          conta_id: contaId || null,
        }),
      })
      const d = await r.json()
      if (d.error) { alert('Erro: ' + d.error); return }
      setModalFechar(false)
      await carregar()
    } finally { setSalvando(false) }
  }

  if (carregando) return <div style={{padding:60,textAlign:'center'}}>Carregando...</div>
  if (!comanda) return <div style={{padding:60,textAlign:'center'}}>Comanda não encontrada</div>

  const total = Number(comanda.total || 0)
  const desc = Number(desconto.replace(',', '.')) || 0
  const totalLiquido = total - desc
  const fechada = comanda.status === 'fechada'

  return (
    <div style={{ background: BG, minHeight: '100vh', padding: 24 }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <button onClick={() => router.back()} style={{ background:'none',border:'none',color:'#6b7280',fontSize:13,cursor:'pointer',marginBottom:8,padding:0 }}>← Voltar</button>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: 0 }}>
              Comanda #{comanda.id.substring(0, 8)}
            </h1>
            <p style={{ fontSize: 13, color: '#6b7280', margin: '4px 0 0' }}>
              {comanda.pacientes?.nome} · {new Date(comanda.criada_em).toLocaleDateString('pt-BR')}
            </p>
          </div>
          {fechada ? (
            <span style={{ padding: '6px 14px', borderRadius: 100, background: '#dcfce7', color: '#16a34a', fontSize: 12, fontWeight: 700 }}>
              FECHADA
            </span>
          ) : (
            <button onClick={() => setModalFechar(true)} disabled={total === 0} style={{
              padding: '10px 20px', borderRadius: 10, border: 'none',
              background: total === 0 ? '#e5e7eb' : ACCENT,
              color: total === 0 ? '#9ca3af' : 'white',
              fontSize: 13, fontWeight: 600, cursor: total === 0 ? 'not-allowed' : 'pointer',
            }}>
              Receber pagamento
            </button>
          )}
        </div>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
          <div style={{ background: 'white', borderRadius: CARD_RADIUS, padding: 18 }}>
            <p style={{ fontSize: 11, color: '#6b7280', margin: '0 0 6px', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>Subtotal</p>
            <p style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: 0 }}>R$ {total.toFixed(2).replace('.', ',')}</p>
          </div>
          <div style={{ background: 'white', borderRadius: CARD_RADIUS, padding: 18 }}>
            <p style={{ fontSize: 11, color: '#6b7280', margin: '0 0 6px', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>Desconto</p>
            <p style={{ fontSize: 22, fontWeight: 700, color: '#dc2626', margin: 0 }}>- R$ {desc.toFixed(2).replace('.', ',')}</p>
          </div>
          <div style={{ background: ACCENT, borderRadius: CARD_RADIUS, padding: 18 }}>
            <p style={{ fontSize: 11, color: 'white', opacity: 0.8, margin: '0 0 6px', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>Total a pagar</p>
            <p style={{ fontSize: 22, fontWeight: 700, color: 'white', margin: 0 }}>R$ {totalLiquido.toFixed(2).replace('.', ',')}</p>
          </div>
        </div>

        {/* Itens da comanda */}
        <div style={{ background: 'white', borderRadius: CARD_RADIUS, padding: 22, marginBottom: 16 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: '0 0 14px' }}>Itens da comanda</h2>

          {itens.length === 0 ? (
            <p style={{ fontSize: 13, color: '#9ca3af', textAlign: 'center', padding: 30, margin: 0 }}>Nenhum item adicionado ainda</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
              {itens.map((it: any) => (
                <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, background: '#fafafa', borderRadius: 10 }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#111827', margin: '0 0 2px' }}>{it.descricao}</p>
                    <p style={{ fontSize: 11, color: '#6b7280', margin: 0 }}>{it.quantidade}x · R$ {Number(it.valor_unitario).toFixed(2).replace('.', ',')}</p>
                  </div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: '#111827', margin: 0 }}>R$ {Number(it.valor_total).toFixed(2).replace('.', ',')}</p>
                  {!fechada && (
                    <button onClick={() => removerItem(it.id)} style={{
                      padding: '6px 8px', borderRadius: 8, border: '1px solid #fecaca',
                      background: '#fef2f2', color: '#dc2626', cursor: 'pointer',
                      display: 'flex', alignItems: 'center'
                    }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Adicionar item */}
          {!fechada && (
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #f3f4f6' }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', margin: '0 0 10px', textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>Adicionar item</p>

              {procedimentos.length > 0 && (
                <select
                  value={novoItem.procedimento_id}
                  onChange={e => selecionarProcedimento(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13, marginBottom: 10, background: 'white' }}
                >
                  <option value="">Selecionar procedimento... (ou preencher manualmente)</option>
                  {procedimentos.map(p => <option key={p.id} value={p.id}>{p.nome} — R$ {Number(p.preco || 0).toFixed(2).replace('.', ',')}</option>)}
                </select>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 120px auto', gap: 8 }}>
                <input type="text" placeholder="Descrição" value={novoItem.descricao} onChange={e => setNovoItem({ ...novoItem, descricao: e.target.value })} style={inp} />
                <input type="number" min="1" placeholder="Qtd" value={novoItem.quantidade} onChange={e => setNovoItem({ ...novoItem, quantidade: Number(e.target.value) })} style={inp} />
                <input type="text" placeholder="Valor unit." value={novoItem.valor_unitario} onChange={e => setNovoItem({ ...novoItem, valor_unitario: e.target.value })} style={inp} />
                <button onClick={adicionarItem} disabled={salvando} style={{ padding: '10px 16px', borderRadius: 8, border: 'none', background: ACCENT, color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' as const }}>
                  + Adicionar
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Desconto + observacao */}
        {!fechada && itens.length > 0 && (
          <div style={{ background: 'white', borderRadius: CARD_RADIUS, padding: 22, marginBottom: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 6 }}>Desconto (R$)</label>
                <input type="text" value={desconto} onChange={e => setDesconto(e.target.value)} onBlur={salvarDesconto} placeholder="0,00" style={inp} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 6 }}>Observação</label>
                <input type="text" value={observacao} onChange={e => setObservacao(e.target.value)} onBlur={salvarDesconto} placeholder="Ex: paciente irá pagar em 2 vezes" style={inp} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal Fechar */}
      {modalFechar && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={e => { if (e.target === e.currentTarget) setModalFechar(false) }}>
          <div style={{ background: 'white', borderRadius: CARD_RADIUS, padding: 28, width: 'min(440px, 90vw)' }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 6px' }}>Receber pagamento</h2>
            <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 18px' }}>Total: R$ {totalLiquido.toFixed(2).replace('.', ',')}</p>

            <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 6 }}>Forma de pagamento</label>
            <select value={formaPagamento} onChange={e => setFormaPagamento(e.target.value)} style={{ ...inp, marginBottom: 14 }}>
              <option value="pix">PIX</option>
              <option value="dinheiro">Dinheiro</option>
              <option value="cartao_credito">Cartão de crédito</option>
              <option value="cartao_debito">Cartão de débito</option>
              <option value="transferencia">Transferência</option>
              <option value="boleto">Boleto</option>
            </select>

            {contas.length > 0 && (
              <>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 6 }}>Conta de destino</label>
                <select value={contaId} onChange={e => setContaId(e.target.value)} style={{ ...inp, marginBottom: 14 }}>
                  <option value="">Padrão (não vincular conta)</option>
                  {contas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
              <button onClick={() => setModalFechar(false)} style={btnCancelar}>Cancelar</button>
              <button onClick={fecharComanda} disabled={salvando} style={btnPrincipal}>{salvando ? 'Confirmando...' : 'Confirmar recebimento'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const inp: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: 8,
  border: '1px solid #e5e7eb', fontSize: 13, outline: 'none',
  boxSizing: 'border-box' as const, background: 'white',
}

const btnCancelar: React.CSSProperties = {
  padding: '10px 18px', borderRadius: 8, border: '1px solid #e5e7eb',
  background: 'white', color: '#374151', fontSize: 13, fontWeight: 500, cursor: 'pointer',
}

const btnPrincipal: React.CSSProperties = {
  padding: '10px 18px', borderRadius: 8, border: 'none',
  background: '#6043C1', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer',
}
