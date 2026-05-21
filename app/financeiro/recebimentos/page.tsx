'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/useAuth'
import { tokens } from '@/lib/design-tokens'
import {
  listarRecebimentos, listarFormasPagamento, darBaixa, statusEfetivo,
} from '@/lib/financeiro/recebimentos'
import type { FormaPagamento } from '@/lib/financeiro/types'

const brl = (v: number) =>
  'R$ ' + (Number(v) || 0).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')

const fmtData = (d: string | null) => {
  if (!d) return '—'
  const [a, m, dia] = d.slice(0, 10).split('-')
  return `${dia}/${m}/${a}`
}

const STATUS_META: Record<string, { label: string; bg: string; fg: string }> = {
  pendente:    { label: 'Pendente',    bg: tokens.bg.cardSubtle,       fg: tokens.text.secondary },
  pago:        { label: 'Pago',        bg: tokens.status.successBg,    fg: tokens.status.success },
  parcial:     { label: 'Parcial',     bg: tokens.status.warningBg,    fg: tokens.status.warningAmberStrong },
  atrasado:    { label: 'Atrasado',    bg: tokens.status.dangerBg,     fg: tokens.status.danger },
  cancelado:   { label: 'Cancelado',   bg: tokens.bg.cardSubtle,       fg: tokens.text.tertiary },
  reembolsado: { label: 'Reembolsado', bg: tokens.bg.cardSubtle,       fg: tokens.text.tertiary },
}
const STATUS_FILTROS = ['pendente', 'pago', 'parcial', 'atrasado', 'cancelado', 'reembolsado']

const hojeISO = () => new Date().toISOString().slice(0, 10)

export default function RecebimentosPage() {
  const router = useRouter()
  const { usuario } = useAuth()
  const clinicaId = usuario?.clinica_id || null

  const [recebimentos, setRecebimentos] = useState<any[]>([])
  const [formas, setFormas] = useState<FormaPagamento[]>([])
  const [medicos, setMedicos] = useState<any[]>([])
  const [carregando, setCarregando] = useState(true)

  // filtros
  const [fStatus, setFStatus] = useState<string[]>([])
  const [fDe, setFDe] = useState('')
  const [fAte, setFAte] = useState('')
  const [fProfissional, setFProfissional] = useState('')
  const [fBusca, setFBusca] = useState('')

  // modal de baixa
  const [baixaAlvo, setBaixaAlvo] = useState<any>(null)

  const carregar = useCallback(async () => {
    if (!clinicaId) return
    setCarregando(true)
    const { data } = await listarRecebimentos(clinicaId)
    setRecebimentos(data || [])
    setCarregando(false)
  }, [clinicaId])

  useEffect(() => { carregar() }, [carregar])

  useEffect(() => {
    if (!clinicaId) return
    listarFormasPagamento().then(({ data }) => setFormas(data || []))
    supabase.from('medicos').select('id, nome').eq('clinica_id', clinicaId).order('nome')
      .then(({ data }) => setMedicos(data || []))
  }, [clinicaId])

  const filtrados = useMemo(() => {
    return recebimentos.filter((r) => {
      const ef = statusEfetivo(r)
      if (fStatus.length && !fStatus.includes(ef)) return false
      if (fDe && (!r.vencimento || r.vencimento < fDe)) return false
      if (fAte && (!r.vencimento || r.vencimento > fAte)) return false
      if (fProfissional && r.comandas?.profissional_id !== fProfissional) return false
      if (fBusca && !(r.pacientes?.nome || '').toLowerCase().includes(fBusca.toLowerCase())) return false
      return true
    })
  }, [recebimentos, fStatus, fDe, fAte, fProfissional, fBusca])

  const totais = useMemo(() => {
    let pendente = 0, recebido = 0
    for (const r of filtrados) {
      const ef = statusEfetivo(r)
      if (ef === 'pago') recebido += Number(r.valor_pago || 0)
      else if (ef === 'pendente' || ef === 'parcial' || ef === 'atrasado') pendente += Number(r.valor || 0)
    }
    return { pendente, recebido }
  }, [filtrados])

  function toggleStatus(s: string) {
    setFStatus((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s])
  }

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <h1 style={{ fontSize: 22, fontWeight: 700, color: tokens.text.primary, margin: 0 }}>
        Contas a receber
      </h1>
      <p style={{ fontSize: 13, color: tokens.text.secondary, margin: '4px 0 20px' }}>
        Acompanhe pagamentos pendentes, atrasados e baixados.
      </p>

      {/* Filtros */}
      <div style={{
        background: tokens.bg.card, border: `1px solid ${tokens.border.subtle}`,
        borderRadius: 14, padding: 16, marginBottom: 16,
      }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {STATUS_FILTROS.map((s) => {
            const ativo = fStatus.includes(s)
            const meta = STATUS_META[s]
            return (
              <button key={s} onClick={() => toggleStatus(s)} style={{
                padding: '5px 12px', borderRadius: 100, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                border: `1px solid ${ativo ? meta.fg : tokens.border.default}`,
                background: ativo ? meta.bg : tokens.bg.card,
                color: ativo ? meta.fg : tokens.text.secondary,
              }}>
                {meta.label}
              </button>
            )
          })}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
          <div>
            <label style={lbl}>Vencimento de</label>
            <input type="date" value={fDe} onChange={(e) => setFDe(e.target.value)} style={inp} />
          </div>
          <div>
            <label style={lbl}>até</label>
            <input type="date" value={fAte} onChange={(e) => setFAte(e.target.value)} style={inp} />
          </div>
          <div>
            <label style={lbl}>Profissional</label>
            <select value={fProfissional} onChange={(e) => setFProfissional(e.target.value)} style={inp}>
              <option value="">Todos</option>
              {medicos.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 180 }}>
            <label style={lbl}>Buscar paciente</label>
            <input value={fBusca} onChange={(e) => setFBusca(e.target.value)} placeholder="Nome do paciente" style={{ ...inp, width: '100%' }} />
          </div>
        </div>
      </div>

      {/* Resumo da seleção */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 12, fontSize: 12.5, color: tokens.text.secondary }}>
        <span>{filtrados.length} recebível(is)</span>
        <span>A receber: <strong style={{ color: tokens.text.primary }}>{brl(totais.pendente)}</strong></span>
        <span>Recebido: <strong style={{ color: tokens.status.success }}>{brl(totais.recebido)}</strong></span>
      </div>

      {/* Tabela */}
      <div style={{ background: tokens.bg.card, border: `1px solid ${tokens.border.subtle}`, borderRadius: 14, overflow: 'hidden' }}>
        {carregando ? (
          <p style={vazio}>Carregando...</p>
        ) : filtrados.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 20px' }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: tokens.text.primary, margin: '0 0 4px' }}>
              Nenhum recebível por aqui
            </p>
            <p style={{ fontSize: 13, color: tokens.text.secondary, margin: '0 0 16px' }}>
              Recebíveis são gerados ao fechar uma comanda no atendimento.
            </p>
            <button onClick={() => router.push('/nova-consulta')} style={btnPri}>Ir para atendimento</button>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: tokens.bg.muted }}>
                {['Paciente', 'Descrição', 'Vencimento', 'Valor', 'Status', 'Ações'].map((h) => (
                  <th key={h} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtrados.map((r) => {
                const ef = statusEfetivo(r)
                const meta = STATUS_META[ef] || STATUS_META.pendente
                const riscado = ef === 'cancelado' || ef === 'reembolsado'
                const podeBaixar = ['pendente', 'parcial', 'atrasado'].includes(ef)
                return (
                  <tr key={r.id} style={{ borderTop: `1px solid ${tokens.border.subtle}` }}>
                    <td style={td}>{r.pacientes?.nome || '—'}</td>
                    <td style={{ ...td, color: tokens.text.secondary }}>
                      {r.comanda_id ? `Comanda #${String(r.comanda_id).substring(0, 8)}` : 'Avulso'}
                      {r.parcela_total > 1 && (
                        <span style={{ color: tokens.text.tertiary }}> · {r.parcela_numero}/{r.parcela_total}</span>
                      )}
                    </td>
                    <td style={td}>{fmtData(r.vencimento)}</td>
                    <td style={{ ...td, fontWeight: 600, fontVariantNumeric: 'tabular-nums', textDecoration: riscado ? 'line-through' : 'none' }}>
                      {brl(r.valor)}
                    </td>
                    <td style={td}>
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 100,
                        background: meta.bg, color: meta.fg,
                      }}>{meta.label}</span>
                    </td>
                    <td style={td}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {podeBaixar && (
                          <button onClick={() => setBaixaAlvo(r)} style={btnAcao}>Dar baixa</button>
                        )}
                        {ef === 'pago' && (
                          <a href={`/api/financeiro/recibo/${r.id}`} target="_blank" rel="noreferrer" style={{ ...btnAcao, textDecoration: 'none' }}>
                            Recibo
                          </a>
                        )}
                        {r.comanda_id && (
                          <button onClick={() => router.push('/comandas/' + r.comanda_id)} style={btnAcaoGhost}>
                            Ver comanda
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {baixaAlvo && (
        <ModalBaixa
          recebimento={baixaAlvo}
          formas={formas}
          usuarioId={usuario?.id || null}
          onClose={() => setBaixaAlvo(null)}
          onBaixado={() => { setBaixaAlvo(null); carregar() }}
        />
      )}
    </div>
  )
}

function ModalBaixa({ recebimento, formas, usuarioId, onClose, onBaixado }: {
  recebimento: any
  formas: FormaPagamento[]
  usuarioId: string | null
  onClose: () => void
  onBaixado: () => void
}) {
  const [formaId, setFormaId] = useState(recebimento.forma_pagamento_id || formas[0]?.id || '')
  const [valorPago, setValorPago] = useState(String(recebimento.valor))
  const [data, setData] = useState(hojeISO())
  const [observacoes, setObservacoes] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  async function confirmar() {
    if (!formaId) { setErro('Selecione a forma de pagamento'); return }
    setSalvando(true); setErro('')
    const { error } = await darBaixa(recebimento.id, {
      forma_pagamento_id: formaId,
      valor_pago: Number(String(valorPago).replace(',', '.')) || 0,
      data,
      observacoes: observacoes || undefined,
      usuario_id: usuarioId,
    })
    setSalvando(false)
    if (error) { setErro(error); return }
    onBaixado()
  }

  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, background: tokens.bg.overlay, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: tokens.bg.card, borderRadius: 16, width: 'min(420px, 100%)', padding: 26 }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, color: tokens.text.primary, margin: '0 0 4px' }}>Dar baixa</h2>
        <p style={{ fontSize: 13, color: tokens.text.secondary, margin: '0 0 18px' }}>
          {recebimento.pacientes?.nome || 'Recebível'} · {brl(recebimento.valor)}
        </p>
        <label style={lbl}>Forma de pagamento</label>
        <select value={formaId} onChange={(e) => setFormaId(e.target.value)} style={{ ...inp, width: '100%' }}>
          {formas.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
        </select>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
          <div>
            <label style={lbl}>Valor pago (R$)</label>
            <input value={valorPago} onChange={(e) => setValorPago(e.target.value)} style={{ ...inp, width: '100%' }} />
          </div>
          <div>
            <label style={lbl}>Data do pagamento</label>
            <input type="date" value={data} onChange={(e) => setData(e.target.value)} style={{ ...inp, width: '100%' }} />
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <label style={lbl}>Observações</label>
          <input value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Opcional" style={{ ...inp, width: '100%' }} />
        </div>
        {erro && <p style={{ color: tokens.status.danger, fontSize: 12.5, margin: '12px 0 0' }}>{erro}</p>}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
          <button onClick={onClose} style={btnSec}>Cancelar</button>
          <button onClick={confirmar} disabled={salvando} style={{ ...btnPri, opacity: salvando ? 0.6 : 1 }}>
            {salvando ? 'Confirmando...' : 'Confirmar baixa'}
          </button>
        </div>
      </div>
    </div>
  )
}

const lbl: React.CSSProperties = {
  fontSize: 11.5, fontWeight: 600, color: tokens.text.secondary, display: 'block', marginBottom: 5,
}
const inp: React.CSSProperties = {
  padding: '8px 11px', borderRadius: 9, border: `1px solid ${tokens.border.default}`,
  fontSize: 13, outline: 'none', boxSizing: 'border-box', background: tokens.bg.card, color: tokens.text.primary,
}
const th: React.CSSProperties = {
  textAlign: 'left', padding: '11px 14px', fontSize: 11, fontWeight: 700,
  color: tokens.text.secondary, textTransform: 'uppercase', letterSpacing: '0.04em',
}
const td: React.CSSProperties = {
  padding: '12px 14px', fontSize: 13, color: tokens.text.primary, verticalAlign: 'middle',
}
const vazio: React.CSSProperties = {
  textAlign: 'center', padding: '40px 20px', fontSize: 13, color: tokens.text.tertiary, margin: 0,
}
const btnAcao: React.CSSProperties = {
  padding: '6px 11px', borderRadius: 8, border: `1px solid ${tokens.border.default}`,
  background: tokens.bg.card, color: tokens.text.strong, fontSize: 12, fontWeight: 600, cursor: 'pointer',
}
const btnAcaoGhost: React.CSSProperties = {
  padding: '6px 11px', borderRadius: 8, border: 'none',
  background: 'transparent', color: tokens.brand.primary, fontSize: 12, fontWeight: 600, cursor: 'pointer',
}
const btnSec: React.CSSProperties = {
  padding: '10px 18px', borderRadius: 9, border: `1px solid ${tokens.border.default}`,
  background: tokens.bg.card, color: tokens.text.strong, fontSize: 13, fontWeight: 500, cursor: 'pointer',
}
const btnPri: React.CSSProperties = {
  padding: '10px 18px', borderRadius: 9, border: 'none',
  background: tokens.brand.primary, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
}
