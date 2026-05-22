'use client'

import { useCallback, useEffect, useState } from 'react'
import { tokens } from '@/lib/design-tokens'
import {
  obterComanda, adicionarItem, removerItem, atualizarDescontoAcrescimo, atualizarComanda,
} from '@/lib/financeiro/comandas'
import type { Comanda, ComandaItem, ComandaStatus, ItemTipo } from '@/lib/financeiro/types'
import { Card, Badge, Button, Input, Select, Field, Modal, ModalAcoes, type BadgeTone } from '@/components/ui'
import ModalFecharComanda from './ModalFecharComanda'

const brl = (v: number) =>
  'R$ ' + (Number(v) || 0).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')

const STATUS_LABEL: Record<ComandaStatus, string> = {
  rascunho: 'Rascunho', aberta: 'Aberta', fechada: 'Fechada', paga: 'Paga', cancelada: 'Cancelada',
}
const STATUS_TONE: Record<ComandaStatus, BadgeTone> = {
  rascunho: 'neutral', aberta: 'info', fechada: 'success', paga: 'success', cancelada: 'neutral',
}

const TIPOS: { value: ItemTipo; label: string }[] = [
  { value: 'consulta', label: 'Consulta' },
  { value: 'procedimento', label: 'Procedimento' },
  { value: 'exame', label: 'Exame' },
  { value: 'produto', label: 'Produto' },
  { value: 'pacote', label: 'Pacote' },
  { value: 'outro', label: 'Outro' },
]

interface Props {
  comandaId: string
  usuarioId?: string | null
  onAtualizar?: (comanda: Comanda) => void
}

export default function ComandaPanel({ comandaId, usuarioId, onAtualizar }: Props) {
  const [comanda, setComanda] = useState<Comanda | null>(null)
  const [itens, setItens] = useState<ComandaItem[]>([])
  const [carregando, setCarregando] = useState(true)
  const [modalItem, setModalItem] = useState(false)
  const [modalFechar, setModalFechar] = useState(false)
  const [ajustesAbertos, setAjustesAbertos] = useState(false)

  // form de novo item
  const [novoItem, setNovoItem] = useState({ tipo: 'procedimento' as ItemTipo, descricao: '', quantidade: '1', valor_unitario: '' })
  // ajustes
  const [desconto, setDesconto] = useState('0')
  const [acrescimo, setAcrescimo] = useState('0')
  const [observacoes, setObservacoes] = useState('')

  const carregar = useCallback(async () => {
    const { data } = await obterComanda(comandaId)
    if (data) {
      setComanda(data.comanda)
      setItens(data.itens)
      setDesconto(String(data.comanda.desconto || 0))
      setAcrescimo(String(data.comanda.acrescimo || 0))
      setObservacoes(data.comanda.observacoes || '')
      onAtualizar?.(data.comanda)
    }
    setCarregando(false)
  }, [comandaId, onAtualizar])

  useEffect(() => { carregar() }, [carregar])

  if (carregando) {
    return <Card style={{ textAlign: 'center', color: tokens.text.tertiary, fontSize: 13 }}>Carregando comanda...</Card>
  }
  if (!comanda) {
    return <Card style={{ textAlign: 'center', color: tokens.text.tertiary, fontSize: 13 }}>Comanda não encontrada</Card>
  }

  const editavel = comanda.status === 'rascunho' || comanda.status === 'aberta'

  async function salvarItem() {
    const valor = Number(novoItem.valor_unitario.replace(',', '.'))
    if (!novoItem.descricao.trim() || !valor) return
    await adicionarItem(comandaId, {
      tipo: novoItem.tipo,
      descricao: novoItem.descricao.trim(),
      quantidade: Number(novoItem.quantidade) || 1,
      valor_unitario: valor,
    })
    setNovoItem({ tipo: 'procedimento', descricao: '', quantidade: '1', valor_unitario: '' })
    setModalItem(false)
    await carregar()
  }

  async function excluirItem(id: string) {
    await removerItem(comandaId, id)
    await carregar()
  }

  async function salvarAjustes() {
    await atualizarDescontoAcrescimo(comandaId, {
      desconto: Number(desconto.replace(',', '.')) || 0,
      acrescimo: Number(acrescimo.replace(',', '.')) || 0,
    })
    await carregar()
  }

  return (
    <Card>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: tokens.text.primary, margin: 0 }}>Comanda</h3>
            <Badge tone={STATUS_TONE[comanda.status]}>{STATUS_LABEL[comanda.status]}</Badge>
          </div>
          <p style={{ fontSize: 11.5, color: tokens.text.tertiary, margin: '4px 0 0' }}>
            #{comanda.id.substring(0, 8)}
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: 10.5, color: tokens.text.tertiary, margin: '0 0 2px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total</p>
          <p style={{ fontSize: 24, fontWeight: 700, color: tokens.text.primary, margin: 0, fontVariantNumeric: 'tabular-nums' }}>
            {brl(comanda.valor_final)}
          </p>
        </div>
      </div>

      {/* Itens */}
      <div style={{ marginTop: 18 }}>
        {itens.length === 0 ? (
          <p style={{ fontSize: 12.5, color: tokens.text.tertiary, textAlign: 'center', padding: '22px 0', margin: 0 }}>
            Nenhum item na comanda ainda.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {itens.map((it) => (
              <div key={it.id} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                background: tokens.bg.cardSubtle, borderRadius: 10,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: tokens.text.primary, margin: '0 0 2px' }}>
                    {it.descricao}
                  </p>
                  <p style={{ fontSize: 11, color: tokens.text.tertiary, margin: 0 }}>
                    {TIPOS.find((t) => t.value === it.tipo)?.label || it.tipo} · {it.quantidade}× {brl(it.valor_unitario)}
                  </p>
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: tokens.text.primary, fontVariantNumeric: 'tabular-nums' }}>
                  {brl(it.valor_total)}
                </span>
                {editavel && (
                  <button onClick={() => excluirItem(it.id)} aria-label="Remover item" style={btnX}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {editavel && (
          <button onClick={() => setModalItem(true)} style={btnAddItem}>+ Adicionar item</button>
        )}
      </div>

      {/* Ajustes colapsáveis */}
      {editavel && (
        <div style={{ marginTop: 14, borderTop: `1px solid ${tokens.border.subtle}`, paddingTop: 12 }}>
          <button onClick={() => setAjustesAbertos((v) => !v)} style={btnColapso}>
            <span>Desconto, acréscimo e observações</span>
            <span style={{ transform: ajustesAbertos ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>⌄</span>
          </button>
          {ajustesAbertos && (
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <Field label="Desconto (R$)">
                  <Input value={desconto} onChange={(e) => setDesconto(e.target.value)} onBlur={salvarAjustes} />
                </Field>
                <Field label="Acréscimo (R$)">
                  <Input value={acrescimo} onChange={(e) => setAcrescimo(e.target.value)} onBlur={salvarAjustes} />
                </Field>
              </div>
              <Field label="Observações">
                <Input
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  onBlur={() => atualizarComanda(comandaId, { observacoes })}
                  placeholder="Opcional"
                />
              </Field>
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div style={{ marginTop: 16 }}>
        {editavel ? (
          <Button
            onClick={() => setModalFechar(true)}
            disabled={itens.length === 0}
            style={{ width: '100%', padding: '12px', fontSize: 13.5, fontWeight: 700 }}
          >
            Fechar comanda
          </Button>
        ) : (
          <p style={{ fontSize: 12, color: tokens.text.tertiary, textAlign: 'center', margin: 0 }}>
            {comanda.status === 'paga' ? 'Comanda quitada.' : 'Comanda fechada — aguardando recebimento.'}
          </p>
        )}
      </div>

      {/* Modal adicionar item */}
      {modalItem && (
        <Modal titulo="Adicionar item" onClose={() => setModalItem(false)} largura={400}>
          <Field label="Tipo">
            <Select value={novoItem.tipo} onChange={(e) => setNovoItem({ ...novoItem, tipo: e.target.value as ItemTipo })}>
              {TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </Select>
          </Field>
          <Field label="Descrição" style={{ marginTop: 12 }}>
            <Input value={novoItem.descricao} onChange={(e) => setNovoItem({ ...novoItem, descricao: e.target.value })} placeholder="Ex: Consulta clínica" />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: 10, marginTop: 12 }}>
            <Field label="Qtd.">
              <Input type="number" min="1" value={novoItem.quantidade} onChange={(e) => setNovoItem({ ...novoItem, quantidade: e.target.value })} />
            </Field>
            <Field label="Valor unitário (R$)">
              <Input value={novoItem.valor_unitario} onChange={(e) => setNovoItem({ ...novoItem, valor_unitario: e.target.value })} placeholder="0,00" />
            </Field>
          </div>
          <ModalAcoes>
            <Button variant="secondary" onClick={() => setModalItem(false)}>Cancelar</Button>
            <Button onClick={salvarItem}>Adicionar</Button>
          </ModalAcoes>
        </Modal>
      )}

      {/* Modal fechar comanda */}
      {modalFechar && (
        <ModalFecharComanda
          comanda={comanda}
          usuarioId={usuarioId}
          onClose={() => setModalFechar(false)}
          onFechada={() => { setModalFechar(false); carregar() }}
        />
      )}
    </Card>
  )
}

const btnX: React.CSSProperties = {
  width: 26, height: 26, borderRadius: 7, border: 'none', background: 'transparent',
  color: tokens.text.tertiary, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
}
const btnAddItem: React.CSSProperties = {
  width: '100%', marginTop: 10, padding: '9px', borderRadius: 9,
  border: `1px dashed ${tokens.border.strong}`, background: 'transparent',
  color: tokens.brand.primary, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
}
const btnColapso: React.CSSProperties = {
  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
  fontSize: 12.5, fontWeight: 600, color: tokens.text.secondary,
}
