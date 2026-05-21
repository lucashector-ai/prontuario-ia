'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { tokens } from '@/lib/design-tokens'

const ACCENT = tokens.brand.primary
const ACCENT_LIGHT = tokens.brand.primaryLighter

export function Procedimentos() {
  const router = useRouter()
  const [clinicaId, setClinicaId] = useState<string>('')
  const [procedimentos, setProcedimentos] = useState<any[]>([])
  const [carregando, setCarregando] = useState(true)
  const [modalAberto, setModalAberto] = useState(false)
  const [editando, setEditando] = useState<any>(null)
  const [form, setForm] = useState({ nome: '', duracao: '30', valor: '', custo_insumos: '', custo_operacional: '' })
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)

  useEffect(() => {
    const ca = localStorage.getItem('clinica_admin')
    if (!ca) {
      // Só admin da clínica acessa
      alert('Acesso restrito: apenas administradores da clínica')
      router.push('/dashboard')
      return
    }
    const admin = JSON.parse(ca)
    if (!admin.clinica_id) {
      router.push('/dashboard')
      return
    }
    setClinicaId(admin.clinica_id)
    carregar(admin.clinica_id)
  }, [router])

  const carregar = async (cid: string) => {
    setCarregando(true)
    const r = await fetch('/api/procedimentos?clinica_id=' + cid + '&incluir_inativos=1')
    const d = await r.json()
    setProcedimentos(d.procedimentos || [])
    setCarregando(false)
  }

  const toast = (tipo: 'ok' | 'erro', texto: string) => {
    setMsg({ tipo, texto })
    setTimeout(() => setMsg(null), 3000)
  }

  const abrirNovo = () => {
    setEditando(null)
    setForm({ nome: '', duracao: '30', valor: '', custo_insumos: '', custo_operacional: '' })
    setModalAberto(true)
  }

  const abrirEditar = (p: any) => {
    setEditando(p)
    setForm({
      nome: p.nome,
      duracao: String(p.duracao),
      valor: p.valor != null ? String(p.valor) : '',
      custo_insumos: p.custo_insumos != null ? String(p.custo_insumos) : '',
      custo_operacional: p.custo_operacional != null ? String(p.custo_operacional) : '',
    })
    setModalAberto(true)
  }

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.nome.trim()) return toast('erro', 'Nome obrigatório')
    setSalvando(true)
    try {
      if (editando) {
        const r = await fetch('/api/procedimentos', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editando.id, ...form }),
        })
        const d = await r.json()
        if (d.error) throw new Error(d.error)
        toast('ok', 'Procedimento atualizado')
      } else {
        const r = await fetch('/api/procedimentos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clinica_id: clinicaId, ...form }),
        })
        const d = await r.json()
        if (d.error) throw new Error(d.error)
        toast('ok', 'Procedimento criado')
      }
      setModalAberto(false)
      carregar(clinicaId)
    } catch (err: any) {
      toast('erro', err.message)
    }
    setSalvando(false)
  }

  const toggleAtivo = async (p: any) => {
    await fetch('/api/procedimentos', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: p.id, ativo: !p.ativo }),
    })
    carregar(clinicaId)
  }

  const excluir = async (p: any) => {
    if (!confirm('Desativar procedimento "' + p.nome + '"? (Pode reativar depois)')) return
    await fetch('/api/procedimentos?id=' + p.id, { method: 'DELETE' })
    carregar(clinicaId)
    toast('ok', 'Procedimento desativado')
  }

  const fmtValor = (v: number | null) => {
    if (v == null) return '—'
    return 'R$ ' + Number(v).toFixed(2).replace('.', ',')
  }

  const ativos = procedimentos.filter(p => p.ativo)
  const inativos = procedimentos.filter(p => !p.ativo)

  return (
    <div style={{ padding: '0 4px' }}>
      {msg && (
        <div style={{
          position: 'fixed', top: 24, right: 24, zIndex: 200,
          padding: '12px 20px', borderRadius: 10,
          background: msg.tipo === 'ok' ? tokens.status.successBgSoft : tokens.status.dangerBg,
          color: msg.tipo === 'ok' ? tokens.status.successText : tokens.status.dangerDark,
          fontSize: 13, fontWeight: 600, border: `1px solid ${msg.tipo === 'ok' ? tokens.status.successLightAlt : tokens.status.dangerLight}`,
        }}>{msg.texto}</div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: tokens.text.primary, margin: '0 0 4px' }}>Procedimentos</h1>
          <p style={{ fontSize: 13, color: tokens.text.secondary, margin: 0 }}>Cadastre os procedimentos que sua clínica oferece</p>
        </div>
        <button onClick={abrirNovo} style={{
          padding: '10px 18px', borderRadius: 9, background: ACCENT, color: 'white',
          border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Novo procedimento
        </button>
      </div>

      {carregando ? (
        <p style={{ color: tokens.text.tertiary, fontSize: 14 }}>Carregando...</p>
      ) : ativos.length === 0 && inativos.length === 0 ? (
        <div style={{ background: 'white', borderRadius: 16, padding: 48, textAlign: 'center' }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: tokens.text.primary, margin: '0 0 6px' }}>Nenhum procedimento cadastrado</p>
          <p style={{ fontSize: 13, color: tokens.text.tertiary, margin: 0 }}>Clique em "Novo procedimento" pra começar</p>
        </div>
      ) : (
        <>
          {/* Lista de ativos */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {ativos.map(p => (
              <ProcedimentoCard key={p.id} p={p} fmtValor={fmtValor}
                onEditar={() => abrirEditar(p)}
                onDesativar={() => excluir(p)} />
            ))}
          </div>

          {inativos.length > 0 && (
            <>
              <h2 style={{ fontSize: 11, fontWeight: 700, color: tokens.text.tertiary, marginTop: 28, marginBottom: 10, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                Inativos ({inativos.length})
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, opacity: 0.6 }}>
                {inativos.map(p => (
                  <ProcedimentoCard key={p.id} p={p} fmtValor={fmtValor}
                    onEditar={() => abrirEditar(p)}
                    onDesativar={() => toggleAtivo(p)}
                    desativarLabel="Reativar" />
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* Modal criar/editar */}
      {modalAberto && (
        <div onClick={() => setModalAberto(false)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16,
        }}>
          <form onClick={e => e.stopPropagation()} onSubmit={salvar} style={{
            background: 'white', borderRadius: 16, padding: 24, width: '100%', maxWidth: 460,
            display: 'flex', flexDirection: 'column', gap: 14,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: tokens.text.primary, margin: 0 }}>
                {editando ? 'Editar procedimento' : 'Novo procedimento'}
              </h2>
              <button type="button" onClick={() => setModalAberto(false)}
                style={{ background: 'none', border: 'none', fontSize: 22, color: tokens.text.tertiary, cursor: 'pointer', lineHeight: 1 }}>✕</button>
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: tokens.text.secondary, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Nome *</label>
              <input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                placeholder="Ex: Consulta clínica geral, ECG, Holter 24h..."
                style={{ width: '100%', padding: '9px 12px', fontSize: 13, borderRadius: 8, border: `1px solid ${tokens.border.default}`, outline: 'none' }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: tokens.text.secondary, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Duração padrão</label>
                <select value={form.duracao} onChange={e => setForm(f => ({ ...f, duracao: e.target.value }))}
                  style={{ width: '100%', padding: '9px 12px', fontSize: 13, borderRadius: 8, border: `1px solid ${tokens.border.default}` }}>
                  <option value="15">15 min</option>
                  <option value="30">30 min</option>
                  <option value="45">45 min</option>
                  <option value="60">1 hora</option>
                  <option value="90">1h30</option>
                  <option value="120">2 horas</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: tokens.text.secondary, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Valor (R$)</label>
                <input type="number" step="0.01" value={form.valor}
                  onChange={e => setForm(f => ({ ...f, valor: e.target.value }))}
                  placeholder="Opcional"
                  style={{ width: '100%', padding: '9px 12px', fontSize: 13, borderRadius: 8, border: `1px solid ${tokens.border.default}`, outline: 'none' }} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: tokens.text.secondary, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Custo de insumos (R$)</label>
                <input type="number" step="0.01" value={form.custo_insumos}
                  onChange={e => setForm(f => ({ ...f, custo_insumos: e.target.value }))}
                  placeholder="0,00"
                  style={{ width: '100%', padding: '9px 12px', fontSize: 13, borderRadius: 8, border: `1px solid ${tokens.border.default}`, outline: 'none' }} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: tokens.text.secondary, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Custo operacional (R$)</label>
                <input type="number" step="0.01" value={form.custo_operacional}
                  onChange={e => setForm(f => ({ ...f, custo_operacional: e.target.value }))}
                  placeholder="0,00"
                  style={{ width: '100%', padding: '9px 12px', fontSize: 13, borderRadius: 8, border: `1px solid ${tokens.border.default}`, outline: 'none' }} />
              </div>
            </div>

            {(() => {
              const v = parseFloat(form.valor) || 0
              const c = (parseFloat(form.custo_insumos) || 0) + (parseFloat(form.custo_operacional) || 0)
              if (v <= 0) return null
              const margem = v - c
              const pct = (margem / v) * 100
              return (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', borderRadius: 8, background: tokens.bg.cardSubtle, fontSize: 12 }}>
                  <span style={{ color: tokens.text.secondary }}>Margem estimada</span>
                  <span style={{ fontWeight: 700, color: margem >= 0 ? tokens.status.success : tokens.status.danger }}>
                    R$ {margem.toFixed(2).replace('.', ',')} · {pct.toFixed(0)}%
                  </span>
                </div>
              )
            })()}

            <button type="submit" disabled={salvando} style={{
              padding: '11px', borderRadius: 9, background: ACCENT, color: 'white', border: 'none',
              fontSize: 13, fontWeight: 700, cursor: salvando ? 'default' : 'pointer', opacity: salvando ? 0.7 : 1, marginTop: 6,
            }}>
              {salvando ? 'Salvando...' : (editando ? 'Salvar alterações' : 'Criar procedimento')}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}

function ProcedimentoCard({ p, fmtValor, onEditar, onDesativar, desativarLabel = 'Desativar' }: any) {
  return (
    <div style={{ background: 'white', borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 16 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 14, fontWeight: 700, color: tokens.text.primary, margin: 0 }}>{p.nome}</p>
        <p style={{ fontSize: 12, color: tokens.text.secondary, margin: '3px 0 0' }}>
          {p.duracao} min{p.valor != null ? ' · ' + fmtValor(p.valor) : ''}
          {p.valor > 0 && (Number(p.custo_insumos) || Number(p.custo_operacional))
            ? ' · margem ' + Math.round(((p.valor - (Number(p.custo_insumos || 0) + Number(p.custo_operacional || 0))) / p.valor) * 100) + '%'
            : ''}
        </p>
      </div>
      <button onClick={onEditar} style={{
        padding: '6px 12px', borderRadius: 7, background: 'white', border: `1px solid ${tokens.border.default}`,
        fontSize: 12, color: tokens.text.strong, fontWeight: 500, cursor: 'pointer',
      }}>Editar</button>
      <button onClick={onDesativar} style={{
        padding: '6px 12px', borderRadius: 7, background: tokens.status.dangerBg, color: tokens.status.danger,
        border: `1px solid ${tokens.status.dangerLight}`, fontSize: 12, cursor: 'pointer', fontWeight: 500,
      }}>{desativarLabel}</button>
    </div>
  )
}
