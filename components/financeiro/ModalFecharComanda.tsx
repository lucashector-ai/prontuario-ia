'use client'

import { useEffect, useMemo, useState } from 'react'
import { tokens } from '@/lib/design-tokens'
import { listarFormasPagamento } from '@/lib/financeiro/recebimentos'
import { fecharComanda } from '@/lib/financeiro/comandas'
import { distribuirParcelas } from '@/lib/financeiro/calculos'
import type { Comanda, FormaPagamento } from '@/lib/financeiro/types'
import { Modal, ModalAcoes, Button, Select, Textarea, Field } from '@/components/ui'

const brl = (v: number) =>
  'R$ ' + (Number(v) || 0).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')

function vencParcela(i: number): string {
  const d = new Date()
  d.setDate(d.getDate() + i * 30)
  return d.toLocaleDateString('pt-BR')
}

interface Props {
  comanda: Comanda
  usuarioId?: string | null
  onClose: () => void
  onFechada: (comanda: Comanda) => void
}

export default function ModalFecharComanda({ comanda, usuarioId, onClose, onFechada }: Props) {
  const [formas, setFormas] = useState<FormaPagamento[]>([])
  const [formaId, setFormaId] = useState('')
  const [parcelas, setParcelas] = useState(1)
  const [observacoes, setObservacoes] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    listarFormasPagamento().then(({ data }) => {
      const lista = data || []
      setFormas(lista)
      if (lista[0]) setFormaId(lista[0].id)
    })
  }, [])

  const forma = useMemo(() => formas.find((f) => f.id === formaId), [formas, formaId])
  const total = Number(comanda.valor_final || 0)
  const podeParcelar = !!forma?.permite_parcelamento
  const nParcelas = podeParcelar ? parcelas : 1
  const valoresParcelas = useMemo(() => distribuirParcelas(total, nParcelas), [total, nParcelas])

  async function confirmar() {
    if (!formaId) { setErro('Selecione uma forma de pagamento'); return }
    setSalvando(true); setErro('')
    const { data, error } = await fecharComanda(comanda.id, {
      forma_pagamento_id: formaId,
      parcelas: nParcelas,
      observacoes: observacoes || undefined,
      usuario_id: usuarioId,
    })
    setSalvando(false)
    if (error || !data) { setErro(error || 'Erro ao fechar comanda'); return }
    onFechada(data)
  }

  return (
    <Modal titulo="Fechar comanda" onClose={onClose}>
      <p style={{ fontSize: 13, color: tokens.text.secondary, margin: '-8px 0 20px' }}>
        Defina a forma de pagamento para gerar os recebíveis.
      </p>

      <Field label="Forma de pagamento">
        <Select value={formaId} onChange={(e) => { setFormaId(e.target.value); setParcelas(1) }}>
          {formas.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
        </Select>
      </Field>

      {podeParcelar && (
        <Field label="Número de parcelas" style={{ marginTop: 14 }}>
          <Select value={parcelas} onChange={(e) => setParcelas(Number(e.target.value))}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>{n}x de {brl(total / n)}</option>
            ))}
          </Select>
        </Field>
      )}

      {nParcelas > 1 && (
        <div style={{ marginTop: 14, border: `1px solid ${tokens.border.subtle}`, borderRadius: 10, overflow: 'hidden' }}>
          {valoresParcelas.map((v, i) => (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between', padding: '9px 14px', fontSize: 12.5,
              background: i % 2 ? tokens.bg.muted : tokens.bg.card, color: tokens.text.strong,
            }}>
              <span>{i + 1}ª parcela · vence {vencParcela(i)}</span>
              <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{brl(v)}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 18, padding: 16, background: tokens.bg.muted, borderRadius: 12 }}>
        {[
          ['Subtotal', comanda.valor_total],
          ['Desconto', -Number(comanda.desconto || 0)],
          ['Acréscimo', Number(comanda.acrescimo || 0)],
        ].map(([label, val]) => (
          (label === 'Subtotal' || Number(val) !== 0) && (
            <div key={label as string} style={resumoLinha}>
              <span style={{ color: tokens.text.secondary }}>{label}</span>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{brl(Number(val))}</span>
            </div>
          )
        ))}
        <div style={{ ...resumoLinha, marginTop: 8, paddingTop: 10, borderTop: `1px solid ${tokens.border.subtle}` }}>
          <span style={{ fontWeight: 700, color: tokens.text.primary }}>Total</span>
          <span style={{ fontWeight: 700, fontSize: 16, color: tokens.text.primary, fontVariantNumeric: 'tabular-nums' }}>
            {brl(total)}
          </span>
        </div>
      </div>

      <Field label="Observações" style={{ marginTop: 14 }}>
        <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={2} placeholder="Opcional" />
      </Field>

      {erro && <p style={{ color: tokens.status.danger, fontSize: 12.5, margin: '12px 0 0' }}>{erro}</p>}

      <ModalAcoes>
        <Button variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button onClick={confirmar} disabled={salvando}>
          {salvando ? 'Fechando...' : 'Confirmar fechamento'}
        </Button>
      </ModalAcoes>
    </Modal>
  )
}

const resumoLinha: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '2px 0',
}
