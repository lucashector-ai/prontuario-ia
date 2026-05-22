'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/useAuth'
import { tokens } from '@/lib/design-tokens'
import { listarFormasPagamento } from '@/lib/financeiro/recebimentos'
import {
  listarDespesas, criarDespesa, pagarDespesa, cancelarDespesa, statusEfetivoDespesa,
} from '@/lib/financeiro/despesas'
import { listarUnidades } from '@/lib/financeiro/unidades'
import { listarContas } from '@/lib/financeiro/contas'
import type { Despesa, FormaPagamento, Unidade, ContaBancaria } from '@/lib/financeiro/types'
import { PageHeader, Button, Card, Input, Select, Field } from '@/components/ui'

const brl = (v: number) =>
  'R$ ' + (Number(v) || 0).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')
const fmtData = (d: string | null) => {
  if (!d) return '—'
  const [a, m, dia] = d.slice(0, 10).split('-')
  return `${dia}/${m}/${a}`
}
const hojeISO = () => new Date().toISOString().slice(0, 10)

const CATEGORIAS = ['Aluguel', 'Salários', 'Insumos', 'Equipamentos', 'Marketing', 'Impostos', 'Software', 'Serviços', 'Outros']

const STATUS_META: Record<string, { label: string; bg: string; fg: string }> = {
  pendente:  { label: 'Pendente',  bg: tokens.bg.cardSubtle,    fg: tokens.text.secondary },
  pago:      { label: 'Pago',      bg: tokens.status.successBg, fg: tokens.status.success },
  atrasado:  { label: 'Atrasado',  bg: tokens.status.dangerBg,  fg: tokens.status.danger },
  cancelado: { label: 'Cancelado', bg: tokens.bg.cardSubtle,    fg: tokens.text.tertiary },
}
const STATUS_FILTROS = ['pendente', 'pago', 'atrasado', 'cancelado']

export default function DespesasPage() {
  const router = useRouter()
  const { usuario } = useAuth()
  const clinicaId = usuario?.clinica_id || null

  const [despesas, setDespesas] = useState<Despesa[]>([])
  const [formas, setFormas] = useState<FormaPagamento[]>([])
  const [unidades, setUnidades] = useState<Unidade[]>([])
  const [contas, setContas] = useState<ContaBancaria[]>([])
  const [carregando, setCarregando] = useState(true)

  const [fStatus, setFStatus] = useState<string[]>([])
  const [fCategoria, setFCategoria] = useState('')
  const [fBusca, setFBusca] = useState('')
  const [fUnidade, setFUnidade] = useState('')

  const [modalNova, setModalNova] = useState(false)
  const [pagarAlvo, setPagarAlvo] = useState<Despesa | null>(null)

  const carregar = useCallback(async () => {
    if (!clinicaId) return
    setCarregando(true)
    const { data } = await listarDespesas(clinicaId)
    setDespesas(data || [])
    setCarregando(false)
  }, [clinicaId])

  useEffect(() => { carregar() }, [carregar])
  useEffect(() => { listarFormasPagamento().then(({ data }) => setFormas(data || [])) }, [])
  useEffect(() => {
    if (!clinicaId) return
    listarUnidades(clinicaId, true).then(({ data }) => setUnidades(data || []))
    listarContas(clinicaId, true).then(({ data }) => setContas(data || []))
  }, [clinicaId])

  const filtradas = useMemo(() => {
    return despesas.filter((d) => {
      const ef = statusEfetivoDespesa(d)
      if (fStatus.length && !fStatus.includes(ef)) return false
      if (fCategoria && d.categoria !== fCategoria) return false
      if (fUnidade && d.unidade_id !== fUnidade) return false
      if (fBusca) {
        const alvo = `${d.descricao || ''} ${d.fornecedor || ''}`.toLowerCase()
        if (!alvo.includes(fBusca.toLowerCase())) return false
      }
      return true
    })
  }, [despesas, fStatus, fCategoria, fUnidade, fBusca])

  const totais = useMemo(() => {
    let aberto = 0, pago = 0
    for (const d of filtradas) {
      const ef = statusEfetivoDespesa(d)
      if (ef === 'pago') pago += Number(d.valor || 0)
      else if (ef === 'pendente' || ef === 'atrasado') aberto += Number(d.valor || 0)
    }
    return { aberto, pago }
  }, [filtradas])

  function toggleStatus(s: string) {
    setFStatus((p) => p.includes(s) ? p.filter((x) => x !== s) : [...p, s])
  }

  async function excluirCancelar(d: Despesa) {
    if (!confirm('Cancelar esta despesa?')) return
    await cancelarDespesa(d.id)
    carregar()
  }

  return (
    <div style={{ padding: 24 }}>
      <PageHeader
        titulo="Contas a pagar"
        descricao="Controle despesas, fornecedores e vencimentos da clínica."
        acao={<Button onClick={() => setModalNova(true)}>+ Nova despesa</Button>}
      />

      {/* Filtros */}
      <Card style={{ borderRadius: 14, padding: 16, margin: '18px 0 16px' }}>
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
              }}>{meta.label}</button>
            )
          })}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
          <Field label="Categoria">
            <Select value={fCategoria} onChange={(e) => setFCategoria(e.target.value)} style={{ width: 'auto' }}>
              <option value="">Todas</option>
              {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
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
          <Field label="Buscar" style={{ flex: 1, minWidth: 200 }}>
            <Input value={fBusca} onChange={(e) => setFBusca(e.target.value)} placeholder="Descrição ou fornecedor" />
          </Field>
        </div>
      </Card>

      <div style={{ display: 'flex', gap: 16, marginBottom: 12, fontSize: 12.5, color: tokens.text.secondary }}>
        <span>{filtradas.length} despesa(s)</span>
        <span>Em aberto: <strong style={{ color: tokens.status.danger }}>{brl(totais.aberto)}</strong></span>
        <span>Pago: <strong style={{ color: tokens.text.primary }}>{brl(totais.pago)}</strong></span>
      </div>

      {/* Tabela */}
      <Card style={{ padding: 0, borderRadius: 14, overflow: 'hidden' }}>
        {carregando ? (
          <p style={vazio}>Carregando...</p>
        ) : filtradas.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 20px' }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: tokens.text.primary, margin: '0 0 4px' }}>Nenhuma despesa por aqui</p>
            <p style={{ fontSize: 13, color: tokens.text.secondary, margin: '0 0 16px' }}>Cadastre suas contas a pagar para acompanhar os vencimentos.</p>
            <Button onClick={() => setModalNova(true)}>+ Nova despesa</Button>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: tokens.bg.muted }}>
                {['Descrição', 'Fornecedor', 'Categoria', 'Vencimento', 'Valor', 'Status', 'Ações'].map((h) => (
                  <th key={h} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtradas.map((d) => {
                const ef = statusEfetivoDespesa(d)
                const meta = STATUS_META[ef] || STATUS_META.pendente
                const riscado = ef === 'cancelado'
                return (
                  <tr key={d.id} style={{ borderTop: `1px solid ${tokens.border.subtle}` }}>
                    <td style={td}>
                      {d.descricao}
                      {d.recorrente && <span style={{ color: tokens.text.tertiary, fontSize: 11 }}> · recorrente</span>}
                    </td>
                    <td style={{ ...td, color: tokens.text.secondary }}>{d.fornecedor || '—'}</td>
                    <td style={{ ...td, color: tokens.text.secondary }}>{d.categoria || '—'}</td>
                    <td style={td}>{fmtData(d.vencimento)}</td>
                    <td style={{ ...td, fontWeight: 600, fontVariantNumeric: 'tabular-nums', textDecoration: riscado ? 'line-through' : 'none' }}>
                      {brl(d.valor)}
                    </td>
                    <td style={td}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 100, background: meta.bg, color: meta.fg }}>
                        {meta.label}
                      </span>
                    </td>
                    <td style={td}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {(ef === 'pendente' || ef === 'atrasado') && (
                          <>
                            <button onClick={() => setPagarAlvo(d)} style={btnAcao}>Pagar</button>
                            <button onClick={() => excluirCancelar(d)} style={btnAcaoGhost}>Cancelar</button>
                          </>
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

      <Button variant="ghost" size="sm" onClick={() => router.push('/financeiro')} style={{ marginTop: 14, paddingLeft: 0 }}>
        ← Voltar ao financeiro
      </Button>

      {modalNova && clinicaId && (
        <ModalNovaDespesa
          clinicaId={clinicaId}
          unidades={unidades}
          onClose={() => setModalNova(false)}
          onCriada={() => { setModalNova(false); carregar() }}
        />
      )}
      {pagarAlvo && (
        <ModalPagar
          despesa={pagarAlvo}
          formas={formas}
          contas={contas}
          usuarioId={usuario?.id || null}
          onClose={() => setPagarAlvo(null)}
          onPago={() => { setPagarAlvo(null); carregar() }}
        />
      )}
    </div>
  )
}

function ModalNovaDespesa({ clinicaId, unidades, onClose, onCriada }: {
  clinicaId: string; unidades: Unidade[]; onClose: () => void; onCriada: () => void
}) {
  const [descricao, setDescricao] = useState('')
  const [valor, setValor] = useState('')
  const [categoria, setCategoria] = useState('')
  const [fornecedor, setFornecedor] = useState('')
  const [unidadeId, setUnidadeId] = useState('')
  const [vencimento, setVencimento] = useState(hojeISO())
  const [recorrente, setRecorrente] = useState(false)
  const [periodicidade, setPeriodicidade] = useState<'semanal' | 'mensal' | 'anual'>('mensal')
  const [observacoes, setObservacoes] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  async function salvar() {
    const v = Number(String(valor).replace(',', '.'))
    if (!descricao.trim() || !v) { setErro('Preencha descrição e valor'); return }
    setSalvando(true); setErro('')
    const { error } = await criarDespesa({
      clinica_id: clinicaId,
      descricao: descricao.trim(),
      valor: v,
      categoria: categoria || null,
      fornecedor: fornecedor || null,
      vencimento: vencimento || null,
      unidade_id: unidadeId || null,
      recorrente,
      recorrencia_periodicidade: recorrente ? periodicidade : null,
      observacoes: observacoes || null,
    })
    setSalvando(false)
    if (error) { setErro(error); return }
    onCriada()
  }

  return (
    <Overlay onClose={onClose}>
      <h2 style={modalTitulo}>Nova despesa</h2>
      <label style={lbl}>Descrição</label>
      <input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex: Aluguel da sala" style={{ ...inp, width: '100%' }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
        <div>
          <label style={lbl}>Valor (R$)</label>
          <input value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" style={{ ...inp, width: '100%' }} />
        </div>
        <div>
          <label style={lbl}>Vencimento</label>
          <input type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)} style={{ ...inp, width: '100%' }} />
        </div>
        <div>
          <label style={lbl}>Categoria</label>
          <select value={categoria} onChange={(e) => setCategoria(e.target.value)} style={{ ...inp, width: '100%' }}>
            <option value="">Sem categoria</option>
            {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label style={lbl}>Fornecedor</label>
          <input value={fornecedor} onChange={(e) => setFornecedor(e.target.value)} placeholder="Opcional" style={{ ...inp, width: '100%' }} />
        </div>
      </div>
      {unidades.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <label style={lbl}>Unidade</label>
          <select value={unidadeId} onChange={(e) => setUnidadeId(e.target.value)} style={{ ...inp, width: '100%' }}>
            <option value="">Sem unidade específica</option>
            {unidades.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
          </select>
        </div>
      )}
      <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
        <input type="checkbox" id="rec" checked={recorrente} onChange={(e) => setRecorrente(e.target.checked)} />
        <label htmlFor="rec" style={{ fontSize: 13, color: tokens.text.strong }}>Despesa recorrente</label>
        {recorrente && (
          <select value={periodicidade} onChange={(e) => setPeriodicidade(e.target.value as any)} style={{ ...inp, marginLeft: 8 }}>
            <option value="semanal">Semanal</option>
            <option value="mensal">Mensal</option>
            <option value="anual">Anual</option>
          </select>
        )}
      </div>
      <div style={{ marginTop: 12 }}>
        <label style={lbl}>Observações</label>
        <input value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Opcional" style={{ ...inp, width: '100%' }} />
      </div>
      {erro && <p style={erroMsg}>{erro}</p>}
      <div style={modalAcoes}>
        <button onClick={onClose} style={btnSec}>Cancelar</button>
        <button onClick={salvar} disabled={salvando} style={{ ...btnPri, opacity: salvando ? 0.6 : 1 }}>
          {salvando ? 'Salvando...' : 'Criar despesa'}
        </button>
      </div>
    </Overlay>
  )
}

function ModalPagar({ despesa, formas, contas, usuarioId, onClose, onPago }: {
  despesa: Despesa; formas: FormaPagamento[]; contas: ContaBancaria[]; usuarioId: string | null
  onClose: () => void; onPago: () => void
}) {
  const [formaId, setFormaId] = useState(formas[0]?.id || '')
  const [contaId, setContaId] = useState(contas[0]?.id || '')
  const [data, setData] = useState(hojeISO())
  const [observacoes, setObservacoes] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  async function confirmar() {
    setSalvando(true); setErro('')
    const { error } = await pagarDespesa(despesa.id, {
      forma_pagamento_id: formaId || null,
      data,
      observacoes: observacoes || undefined,
      usuario_id: usuarioId,
      conta_id: contaId || null,
    })
    setSalvando(false)
    if (error) { setErro(error); return }
    onPago()
  }

  return (
    <Overlay onClose={onClose}>
      <h2 style={modalTitulo}>Pagar despesa</h2>
      <p style={{ fontSize: 13, color: tokens.text.secondary, margin: '0 0 18px' }}>
        {despesa.descricao} · {brl(despesa.valor)}
      </p>
      <label style={lbl}>Forma de pagamento</label>
      <select value={formaId} onChange={(e) => setFormaId(e.target.value)} style={{ ...inp, width: '100%' }}>
        <option value="">Não informar</option>
        {formas.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
      </select>
      {contas.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <label style={lbl}>Conta de saída</label>
          <select value={contaId} onChange={(e) => setContaId(e.target.value)} style={{ ...inp, width: '100%' }}>
            {contas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </div>
      )}
      <div style={{ marginTop: 12 }}>
        <label style={lbl}>Data do pagamento</label>
        <input type="date" value={data} onChange={(e) => setData(e.target.value)} style={{ ...inp, width: '100%' }} />
      </div>
      <div style={{ marginTop: 12 }}>
        <label style={lbl}>Observações</label>
        <input value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Opcional" style={{ ...inp, width: '100%' }} />
      </div>
      {erro && <p style={erroMsg}>{erro}</p>}
      <div style={modalAcoes}>
        <button onClick={onClose} style={btnSec}>Cancelar</button>
        <button onClick={confirmar} disabled={salvando} style={{ ...btnPri, opacity: salvando ? 0.6 : 1 }}>
          {salvando ? 'Confirmando...' : 'Confirmar pagamento'}
        </button>
      </div>
    </Overlay>
  )
}

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, background: tokens.bg.overlay, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: tokens.bg.card, borderRadius: 16, width: 'min(460px, 100%)', maxHeight: '90vh', overflowY: 'auto', padding: 26 }}>
        {children}
      </div>
    </div>
  )
}

const lbl: React.CSSProperties = { fontSize: 11.5, fontWeight: 600, color: tokens.text.secondary, display: 'block', marginBottom: 5 }
const inp: React.CSSProperties = {
  padding: '8px 11px', borderRadius: 9, border: `1px solid ${tokens.border.default}`,
  fontSize: 13, outline: 'none', boxSizing: 'border-box', background: tokens.bg.card, color: tokens.text.primary,
}
const th: React.CSSProperties = {
  textAlign: 'left', padding: '11px 14px', fontSize: 11, fontWeight: 700,
  color: tokens.text.secondary, textTransform: 'uppercase', letterSpacing: '0.04em',
}
const td: React.CSSProperties = { padding: '12px 14px', fontSize: 13, color: tokens.text.primary, verticalAlign: 'middle' }
const vazio: React.CSSProperties = { textAlign: 'center', padding: '40px 20px', fontSize: 13, color: tokens.text.tertiary, margin: 0 }
const modalTitulo: React.CSSProperties = { fontSize: 17, fontWeight: 700, color: tokens.text.primary, margin: '0 0 14px' }
const modalAcoes: React.CSSProperties = { display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }
const erroMsg: React.CSSProperties = { color: tokens.status.danger, fontSize: 12.5, margin: '12px 0 0' }
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
