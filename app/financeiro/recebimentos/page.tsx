'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/useAuth'
import { tokens } from '@/lib/design-tokens'
import { cleanTelefone } from '@/lib/format'
import { PageHeader, Card, Button, Input, Select, Field, Modal, ModalAcoes } from '@/components/ui'
import {
  listarRecebimentos, listarFormasPagamento, darBaixa, statusEfetivo,
} from '@/lib/financeiro/recebimentos'
import { listarUnidades } from '@/lib/financeiro/unidades'
import { listarContas } from '@/lib/financeiro/contas'
import type { FormaPagamento, Unidade, ContaBancaria } from '@/lib/financeiro/types'

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
  const [unidades, setUnidades] = useState<Unidade[]>([])
  const [contas, setContas] = useState<ContaBancaria[]>([])
  const [carregando, setCarregando] = useState(true)

  // filtros
  const [fStatus, setFStatus] = useState<string[]>([])
  const [fDe, setFDe] = useState('')
  const [fAte, setFAte] = useState('')
  const [fProfissional, setFProfissional] = useState('')
  const [fUnidade, setFUnidade] = useState('')
  const [fBusca, setFBusca] = useState('')

  // modal de baixa
  const [baixaAlvo, setBaixaAlvo] = useState<any>(null)
  const [cobrando, setCobrando] = useState<string | null>(null)

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
    listarUnidades(clinicaId, true).then(({ data }) => setUnidades(data || []))
    listarContas(clinicaId, true).then(({ data }) => setContas(data || []))
  }, [clinicaId])

  const filtrados = useMemo(() => {
    return recebimentos.filter((r) => {
      const ef = statusEfetivo(r)
      if (fStatus.length && !fStatus.includes(ef)) return false
      if (fDe && (!r.vencimento || r.vencimento < fDe)) return false
      if (fAte && (!r.vencimento || r.vencimento > fAte)) return false
      if (fProfissional && r.comandas?.profissional_id !== fProfissional) return false
      if (fUnidade && r.unidade_id !== fUnidade) return false
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

  async function cobrarWhatsApp(r: any) {
    const tel = cleanTelefone(r.pacientes?.telefone)
    if (tel.length < 10) { alert('Paciente sem telefone válido cadastrado.'); return }
    const msg = `Olá ${r.pacientes?.nome || ''}! Passando para lembrar do pagamento de ${brl(r.valor)}`
      + (r.vencimento ? `, com vencimento em ${fmtData(r.vencimento)}` : '')
      + '. Qualquer dúvida, estamos à disposição.'
    const telWpp = tel.startsWith('55') ? tel : '55' + tel
    setCobrando(r.id)
    try {
      const resp = await fetch('/api/whatsapp/enviar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telefone: telWpp, texto: msg, medico_id: usuario?.id }),
      })
      const d = await resp.json()
      if (d.error) alert('Não foi possível enviar: ' + d.error)
      else alert('Cobrança enviada pelo WhatsApp.')
    } catch {
      alert('Falha de conexão ao enviar a cobrança.')
    } finally {
      setCobrando(null)
    }
  }

  return (
    <div style={{ padding: 24 }}>
      <PageHeader
        titulo="Contas a receber"
        descricao="Acompanhe pagamentos pendentes, atrasados e baixados."
      />

      {/* Filtros */}
      <Card style={{ borderRadius: 14, padding: 16, marginBottom: 16 }}>
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
          <Field label="Vencimento de">
            <Input type="date" value={fDe} onChange={(e) => setFDe(e.target.value)} style={{ width: 'auto' }} />
          </Field>
          <Field label="até">
            <Input type="date" value={fAte} onChange={(e) => setFAte(e.target.value)} style={{ width: 'auto' }} />
          </Field>
          <Field label="Profissional">
            <Select value={fProfissional} onChange={(e) => setFProfissional(e.target.value)} style={{ width: 'auto' }}>
              <option value="">Todos</option>
              {medicos.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
            </Select>
          </Field>
          {unidades.length > 0 && (
            <Field label="Unidade">
              <Select value={fUnidade} onChange={(e) => setFUnidade(e.target.value)} style={{ width: 'auto' }}>
                <option value="">Todas</option>
                {unidades.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
              </Select>
            </Field>
          )}
          <Field label="Buscar paciente" style={{ flex: 1, minWidth: 180 }}>
            <Input value={fBusca} onChange={(e) => setFBusca(e.target.value)} placeholder="Nome do paciente" />
          </Field>
        </div>
      </Card>

      {/* Resumo da seleção */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 12, fontSize: 12.5, color: tokens.text.secondary }}>
        <span>{filtrados.length} recebível(is)</span>
        <span>A receber: <strong style={{ color: tokens.text.primary }}>{brl(totais.pendente)}</strong></span>
        <span>Recebido: <strong style={{ color: tokens.status.success }}>{brl(totais.recebido)}</strong></span>
      </div>

      {/* Tabela */}
      <Card style={{ padding: 0, borderRadius: 14, overflow: 'hidden' }}>
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
            <Button onClick={() => router.push('/nova-consulta')}>Ir para atendimento</Button>
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
                        {podeBaixar && r.pacientes?.telefone && (
                          <button onClick={() => cobrarWhatsApp(r)} disabled={cobrando === r.id} style={btnAcao}>
                            {cobrando === r.id ? 'Enviando...' : 'Cobrar no WhatsApp'}
                          </button>
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
      </Card>

      {baixaAlvo && (
        <ModalBaixa
          recebimento={baixaAlvo}
          formas={formas}
          contas={contas}
          usuarioId={usuario?.id || null}
          onClose={() => setBaixaAlvo(null)}
          onBaixado={() => { setBaixaAlvo(null); carregar() }}
        />
      )}
    </div>
  )
}

function ModalBaixa({ recebimento, formas, contas, usuarioId, onClose, onBaixado }: {
  recebimento: any
  formas: FormaPagamento[]
  contas: ContaBancaria[]
  usuarioId: string | null
  onClose: () => void
  onBaixado: () => void
}) {
  const [formaId, setFormaId] = useState(recebimento.forma_pagamento_id || formas[0]?.id || '')
  const [contaId, setContaId] = useState(contas[0]?.id || '')
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
      conta_id: contaId || null,
    })
    setSalvando(false)
    if (error) { setErro(error); return }
    onBaixado()
  }

  return (
    <Modal titulo="Dar baixa" onClose={onClose} largura={420}>
      <p style={{ fontSize: 13, color: tokens.text.secondary, margin: '-8px 0 18px' }}>
        {recebimento.pacientes?.nome || 'Recebível'} · {brl(recebimento.valor)}
      </p>
      <Field label="Forma de pagamento">
        <Select value={formaId} onChange={(e) => setFormaId(e.target.value)}>
          {formas.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
        </Select>
      </Field>
      {contas.length > 0 && (
        <Field label="Conta de destino" style={{ marginTop: 12 }}>
          <Select value={contaId} onChange={(e) => setContaId(e.target.value)}>
            {contas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </Select>
        </Field>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
        <Field label="Valor pago (R$)">
          <Input value={valorPago} onChange={(e) => setValorPago(e.target.value)} />
        </Field>
        <Field label="Data do pagamento">
          <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
        </Field>
      </div>
      <Field label="Observações" style={{ marginTop: 12 }}>
        <Input value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Opcional" />
      </Field>
      {erro && <p style={{ color: tokens.status.danger, fontSize: 12.5, margin: '12px 0 0' }}>{erro}</p>}
      <ModalAcoes>
        <Button variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button onClick={confirmar} disabled={salvando}>
          {salvando ? 'Confirmando...' : 'Confirmar baixa'}
        </Button>
      </ModalAcoes>
    </Modal>
  )
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
