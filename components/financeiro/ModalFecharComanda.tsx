'use client'

import { useEffect, useMemo, useState } from 'react'
import { tokens } from '@/lib/design-tokens'
import { listarFormasPagamento } from '@/lib/financeiro/recebimentos'
import { fecharComanda } from '@/lib/financeiro/comandas'
import type { Comanda, FormaPagamento } from '@/lib/financeiro/types'

const brl = (v: number) =>
  'R$ ' + (Number(v) || 0).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')

function distribuir(total: number, n: number): number[] {
  if (n <= 1) return [total]
  const base = Math.floor((total / n) * 100) / 100
  const arr = Array(n).fill(base)
  arr[n - 1] = Math.round((total - base * (n - 1)) * 100) / 100
  return arr
}

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
  const valoresParcelas = useMemo(() => distribuir(total, nParcelas), [total, nParcelas])

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
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, background: tokens.bg.overlay, zIndex: 200,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
    >
      <div style={{
        background: tokens.bg.card, borderRadius: 16, width: 'min(460px, 100%)',
        maxHeight: '90vh', overflowY: 'auto', padding: 28,
      }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: tokens.text.primary, margin: '0 0 4px' }}>
          Fechar comanda
        </h2>
        <p style={{ fontSize: 13, color: tokens.text.secondary, margin: '0 0 20px' }}>
          Defina a forma de pagamento para gerar os recebíveis.
        </p>

        {/* Forma de pagamento */}
        <label style={lbl}>Forma de pagamento</label>
        <select value={formaId} onChange={(e) => { setFormaId(e.target.value); setParcelas(1) }} style={inp}>
          {formas.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
        </select>

        {/* Parcelas */}
        {podeParcelar && (
          <div style={{ marginTop: 14 }}>
            <label style={lbl}>Número de parcelas</label>
            <select value={parcelas} onChange={(e) => setParcelas(Number(e.target.value))} style={inp}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>{n}x de {brl(total / n)}</option>
              ))}
            </select>
          </div>
        )}

        {/* Preview de parcelas */}
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

        {/* Resumo */}
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

        {/* Observações */}
        <div style={{ marginTop: 14 }}>
          <label style={lbl}>Observações</label>
          <textarea
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            rows={2}
            placeholder="Opcional"
            style={{ ...inp, resize: 'vertical' as const, fontFamily: 'inherit' }}
          />
        </div>

        {erro && <p style={{ color: tokens.status.danger, fontSize: 12.5, margin: '12px 0 0' }}>{erro}</p>}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 22 }}>
          <button onClick={onClose} style={btnSec}>Cancelar</button>
          <button onClick={confirmar} disabled={salvando} style={{ ...btnPri, opacity: salvando ? 0.6 : 1 }}>
            {salvando ? 'Fechando...' : 'Confirmar fechamento'}
          </button>
        </div>
      </div>
    </div>
  )
}

const lbl: React.CSSProperties = {
  fontSize: 12, fontWeight: 600, color: tokens.text.secondary, display: 'block', marginBottom: 6,
}
const inp: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: 9, border: `1px solid ${tokens.border.default}`,
  fontSize: 13, outline: 'none', boxSizing: 'border-box', background: tokens.bg.card, color: tokens.text.primary,
}
const resumoLinha: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '2px 0',
}
const btnSec: React.CSSProperties = {
  padding: '10px 18px', borderRadius: 9, border: `1px solid ${tokens.border.default}`,
  background: tokens.bg.card, color: tokens.text.strong, fontSize: 13, fontWeight: 500, cursor: 'pointer',
}
const btnPri: React.CSSProperties = {
  padding: '10px 18px', borderRadius: 9, border: 'none',
  background: tokens.brand.primary, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
}
