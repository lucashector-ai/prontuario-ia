'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/useAuth'
import { tokens } from '@/lib/design-tokens'
import {
  listarRegras, criarRegra, atualizarRegra, removerRegra,
  listarRepasses, atualizarStatusRepasse, pagarRepasse,
} from '@/lib/financeiro/repasses'
import { listarUnidades } from '@/lib/financeiro/unidades'
import type { ItemTipo, RepasseStatus, Unidade } from '@/lib/financeiro/types'

const brl = (v: number) =>
  'R$ ' + (Number(v) || 0).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')

const TIPOS: { value: ItemTipo; label: string }[] = [
  { value: 'consulta', label: 'Consulta' },
  { value: 'procedimento', label: 'Procedimento' },
  { value: 'exame', label: 'Exame' },
  { value: 'produto', label: 'Produto' },
  { value: 'pacote', label: 'Pacote' },
  { value: 'outro', label: 'Outro' },
]
const STATUS_META: Record<string, { label: string; bg: string; fg: string }> = {
  pendente:  { label: 'Pendente',  bg: tokens.bg.cardSubtle,        fg: tokens.text.secondary },
  aprovado:  { label: 'Aprovado',  bg: tokens.status.infoBg,        fg: tokens.status.infoStrong },
  pago:      { label: 'Pago',      bg: tokens.status.successBg,     fg: tokens.status.success },
  cancelado: { label: 'Cancelado', bg: tokens.bg.cardSubtle,        fg: tokens.text.tertiary },
}
const STATUS_FILTROS = ['pendente', 'aprovado', 'pago', 'cancelado']

export default function RepassesPage() {
  const router = useRouter()
  const { usuario } = useAuth()
  const clinicaId = usuario?.clinica_id || null

  const [aba, setAba] = useState<'repasses' | 'regras'>('repasses')
  const [medicos, setMedicos] = useState<any[]>([])

  useEffect(() => {
    if (!clinicaId) return
    supabase.from('medicos').select('id, nome').eq('clinica_id', clinicaId).order('nome')
      .then(({ data }) => setMedicos(data || []))
  }, [clinicaId])

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: tokens.text.primary, margin: 0 }}>Repasse médico</h1>
      <p style={{ fontSize: 13, color: tokens.text.secondary, margin: '4px 0 18px' }}>
        Comissões dos profissionais — regras de cálculo e repasses gerados.
      </p>

      <div style={{ display: 'flex', gap: 4, marginBottom: 18, borderBottom: `1px solid ${tokens.border.subtle}` }}>
        {([['repasses', 'Repasses'], ['regras', 'Regras de comissão']] as const).map(([k, label]) => (
          <button key={k} onClick={() => setAba(k)} style={{
            padding: '9px 16px', border: 'none', background: 'transparent', cursor: 'pointer',
            fontSize: 13, fontWeight: 600,
            color: aba === k ? tokens.brand.primary : tokens.text.secondary,
            borderBottom: `2px solid ${aba === k ? tokens.brand.primary : 'transparent'}`,
          }}>{label}</button>
        ))}
      </div>

      {clinicaId && aba === 'repasses' && <AbaRepasses clinicaId={clinicaId} medicos={medicos} usuarioId={usuario?.id || null} />}
      {clinicaId && aba === 'regras' && <AbaRegras clinicaId={clinicaId} medicos={medicos} />}

      <button onClick={() => router.push('/financeiro')} style={{ ...btnGhost, marginTop: 16 }}>← Voltar ao financeiro</button>
    </div>
  )
}

// ───────────────────────────────── Repasses ────────────────────────────────

function AbaRepasses({ clinicaId, medicos, usuarioId }: { clinicaId: string; medicos: any[]; usuarioId: string | null }) {
  const [repasses, setRepasses] = useState<any[]>([])
  const [carregando, setCarregando] = useState(true)
  const [fStatus, setFStatus] = useState<string[]>([])
  const [fProf, setFProf] = useState('')
  const [fMes, setFMes] = useState('')
  const [fUnidade, setFUnidade] = useState('')
  const [unidades, setUnidades] = useState<Unidade[]>([])

  const carregar = useCallback(async () => {
    setCarregando(true)
    const { data } = await listarRepasses(clinicaId)
    setRepasses(data || [])
    setCarregando(false)
  }, [clinicaId])
  useEffect(() => { carregar() }, [carregar])
  useEffect(() => {
    listarUnidades(clinicaId, true).then(({ data }) => setUnidades(data || []))
  }, [clinicaId])

  const filtrados = useMemo(() => {
    return repasses.filter((r) => {
      if (fStatus.length && !fStatus.includes(r.status)) return false
      if (fProf && r.profissional_id !== fProf) return false
      if (fMes && (r.competencia || '').slice(0, 7) !== fMes) return false
      if (fUnidade && r.unidade_id !== fUnidade) return false
      return true
    })
  }, [repasses, fStatus, fProf, fMes, fUnidade])

  const resumo = useMemo(() => {
    let pendente = 0, aprovado = 0, pago = 0
    for (const r of filtrados) {
      if (r.status === 'pendente') pendente += Number(r.valor || 0)
      else if (r.status === 'aprovado') aprovado += Number(r.valor || 0)
      else if (r.status === 'pago') pago += Number(r.valor || 0)
    }
    return { pendente, aprovado, pago }
  }, [filtrados])

  async function mudarStatus(id: string, status: RepasseStatus) {
    await atualizarStatusRepasse(id, status)
    carregar()
  }
  async function pagar(r: any) {
    await pagarRepasse(r.id, { usuario_id: usuarioId, nomeProfissional: r.medicos?.nome })
    carregar()
  }

  return (
    <>
      <div style={{ background: tokens.bg.card, border: `1px solid ${tokens.border.subtle}`, borderRadius: 14, padding: 16, marginBottom: 14 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {STATUS_FILTROS.map((s) => {
            const ativo = fStatus.includes(s)
            const meta = STATUS_META[s]
            return (
              <button key={s} onClick={() => setFStatus((p) => p.includes(s) ? p.filter((x) => x !== s) : [...p, s])} style={{
                padding: '5px 12px', borderRadius: 100, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                border: `1px solid ${ativo ? meta.fg : tokens.border.default}`,
                background: ativo ? meta.bg : tokens.bg.card, color: ativo ? meta.fg : tokens.text.secondary,
              }}>{meta.label}</button>
            )
          })}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
          <div>
            <label style={lbl}>Profissional</label>
            <select value={fProf} onChange={(e) => setFProf(e.target.value)} style={inp}>
              <option value="">Todos</option>
              {medicos.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Competência</label>
            <input type="month" value={fMes} onChange={(e) => setFMes(e.target.value)} style={inp} />
          </div>
          {unidades.length > 0 && (
            <div>
              <label style={lbl}>Unidade</label>
              <select value={fUnidade} onChange={(e) => setFUnidade(e.target.value)} style={inp}>
                <option value="">Todas</option>
                {unidades.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
              </select>
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16, marginBottom: 12, fontSize: 12.5, color: tokens.text.secondary }}>
        <span>{filtrados.length} repasse(s)</span>
        <span>Pendente: <strong style={{ color: tokens.text.primary }}>{brl(resumo.pendente)}</strong></span>
        <span>Aprovado: <strong style={{ color: tokens.status.infoStrong }}>{brl(resumo.aprovado)}</strong></span>
        <span>Pago: <strong style={{ color: tokens.status.success }}>{brl(resumo.pago)}</strong></span>
      </div>

      <div style={{ background: tokens.bg.card, border: `1px solid ${tokens.border.subtle}`, borderRadius: 14, overflow: 'hidden' }}>
        {carregando ? (
          <p style={vazio}>Carregando...</p>
        ) : filtrados.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '44px 20px' }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: tokens.text.primary, margin: '0 0 4px' }}>Nenhum repasse gerado</p>
            <p style={{ fontSize: 13, color: tokens.text.secondary, margin: 0 }}>
              Repasses são criados automaticamente quando uma comanda é quitada — desde que o profissional tenha regra de comissão.
            </p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: tokens.bg.muted }}>
                {['Profissional', 'Item', 'Base', '%', 'Repasse', 'Status', 'Ações'].map((h) => <th key={h} style={th}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {filtrados.map((r) => {
                const meta = STATUS_META[r.status] || STATUS_META.pendente
                return (
                  <tr key={r.id} style={{ borderTop: `1px solid ${tokens.border.subtle}` }}>
                    <td style={td}>{r.medicos?.nome || '—'}</td>
                    <td style={{ ...td, color: tokens.text.secondary }}>{r.descricao || '—'}</td>
                    <td style={{ ...td, fontVariantNumeric: 'tabular-nums' }}>{brl(r.base_calculo)}</td>
                    <td style={{ ...td, color: tokens.text.secondary }}>{Number(r.percentual)}%</td>
                    <td style={{ ...td, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{brl(r.valor)}</td>
                    <td style={td}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 100, background: meta.bg, color: meta.fg }}>
                        {meta.label}
                      </span>
                    </td>
                    <td style={td}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {r.status === 'pendente' && (
                          <button onClick={() => mudarStatus(r.id, 'aprovado')} style={btnAcao}>Aprovar</button>
                        )}
                        {(r.status === 'pendente' || r.status === 'aprovado') && (
                          <>
                            <button onClick={() => pagar(r)} style={btnAcao}>Pagar</button>
                            <button onClick={() => mudarStatus(r.id, 'cancelado')} style={btnGhost}>Cancelar</button>
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
      </div>
    </>
  )
}

// ────────────────────────────────── Regras ─────────────────────────────────

function AbaRegras({ clinicaId, medicos }: { clinicaId: string; medicos: any[] }) {
  const [regras, setRegras] = useState<any[]>([])
  const [carregando, setCarregando] = useState(true)
  const [modal, setModal] = useState(false)

  const carregar = useCallback(async () => {
    setCarregando(true)
    const { data } = await listarRegras(clinicaId)
    setRegras(data || [])
    setCarregando(false)
  }, [clinicaId])
  useEffect(() => { carregar() }, [carregar])

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <p style={{ fontSize: 12.5, color: tokens.text.secondary, margin: 0 }}>
          A regra mais específica (por tipo de item) vence sobre a regra padrão do profissional.
        </p>
        <button onClick={() => setModal(true)} style={btnPri}>+ Nova regra</button>
      </div>

      <div style={{ background: tokens.bg.card, border: `1px solid ${tokens.border.subtle}`, borderRadius: 14, overflow: 'hidden' }}>
        {carregando ? (
          <p style={vazio}>Carregando...</p>
        ) : regras.length === 0 ? (
          <p style={vazio}>Nenhuma regra de comissão cadastrada.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: tokens.bg.muted }}>
                {['Profissional', 'Aplica-se a', 'Percentual', 'Ativa', 'Ações'].map((h) => <th key={h} style={th}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {regras.map((r) => (
                <tr key={r.id} style={{ borderTop: `1px solid ${tokens.border.subtle}` }}>
                  <td style={td}>{r.medicos?.nome || '—'}</td>
                  <td style={{ ...td, color: tokens.text.secondary }}>
                    {r.tipo_item ? (TIPOS.find((t) => t.value === r.tipo_item)?.label || r.tipo_item) : 'Todos os itens (padrão)'}
                  </td>
                  <td style={{ ...td, fontWeight: 700 }}>{Number(r.percentual)}%</td>
                  <td style={td}>
                    <button onClick={async () => { await atualizarRegra(r.id, { ativo: !r.ativo }); carregar() }} style={{
                      padding: '3px 10px', borderRadius: 100, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: 'none',
                      background: r.ativo ? tokens.status.successBg : tokens.bg.cardSubtle,
                      color: r.ativo ? tokens.status.success : tokens.text.tertiary,
                    }}>{r.ativo ? 'Ativa' : 'Inativa'}</button>
                  </td>
                  <td style={td}>
                    <button onClick={async () => { if (confirm('Remover esta regra?')) { await removerRegra(r.id); carregar() } }} style={btnGhost}>
                      Remover
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal && (
        <ModalRegra
          clinicaId={clinicaId}
          medicos={medicos}
          onClose={() => setModal(false)}
          onCriada={() => { setModal(false); carregar() }}
        />
      )}
    </>
  )
}

function ModalRegra({ clinicaId, medicos, onClose, onCriada }: {
  clinicaId: string; medicos: any[]; onClose: () => void; onCriada: () => void
}) {
  const [profissionalId, setProfissionalId] = useState(medicos[0]?.id || '')
  const [tipo, setTipo] = useState('')
  const [percentual, setPercentual] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  async function salvar() {
    const p = Number(String(percentual).replace(',', '.'))
    if (!profissionalId || !p) { setErro('Selecione o profissional e informe o percentual'); return }
    if (p < 0 || p > 100) { setErro('Percentual deve ficar entre 0 e 100'); return }
    setSalvando(true); setErro('')
    const { error } = await criarRegra({
      clinica_id: clinicaId,
      profissional_id: profissionalId,
      tipo_item: (tipo || null) as ItemTipo | null,
      percentual: p,
    })
    setSalvando(false)
    if (error) { setErro(error); return }
    onCriada()
  }

  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, background: tokens.bg.overlay, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: tokens.bg.card, borderRadius: 16, width: 'min(420px, 100%)', padding: 26 }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, color: tokens.text.primary, margin: '0 0 16px' }}>Nova regra de comissão</h2>
        <label style={lbl}>Profissional</label>
        <select value={profissionalId} onChange={(e) => setProfissionalId(e.target.value)} style={{ ...inp, width: '100%' }}>
          {medicos.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
        </select>
        <div style={{ marginTop: 12 }}>
          <label style={lbl}>Aplica-se a</label>
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} style={{ ...inp, width: '100%' }}>
            <option value="">Todos os itens (regra padrão)</option>
            {TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div style={{ marginTop: 12 }}>
          <label style={lbl}>Percentual de repasse (%)</label>
          <input value={percentual} onChange={(e) => setPercentual(e.target.value)} placeholder="Ex: 40" style={{ ...inp, width: '100%' }} />
        </div>
        {erro && <p style={{ color: tokens.status.danger, fontSize: 12.5, margin: '12px 0 0' }}>{erro}</p>}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
          <button onClick={onClose} style={btnSec}>Cancelar</button>
          <button onClick={salvar} disabled={salvando} style={{ ...btnPri, opacity: salvando ? 0.6 : 1 }}>
            {salvando ? 'Salvando...' : 'Criar regra'}
          </button>
        </div>
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
const btnAcao: React.CSSProperties = {
  padding: '6px 11px', borderRadius: 8, border: `1px solid ${tokens.border.default}`,
  background: tokens.bg.card, color: tokens.text.strong, fontSize: 12, fontWeight: 600, cursor: 'pointer',
}
const btnGhost: React.CSSProperties = {
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
