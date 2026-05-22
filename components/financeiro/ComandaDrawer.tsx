'use client'

import { useCallback, useEffect, useState } from 'react'
import { tokens } from '@/lib/design-tokens'
import { listarComandas, criarComandaAvulsa } from '@/lib/financeiro/comandas'
import { listarUnidades } from '@/lib/financeiro/unidades'
import type { Comanda, Unidade } from '@/lib/financeiro/types'
import ComandaPanel from './ComandaPanel'

const brl = (v: number) =>
  'R$ ' + (Number(v) || 0).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')

interface Props {
  pacienteId: string | null
  clinicaId: string | null
  profissionalId?: string | null
  usuarioId?: string | null
}

// Botão flutuante + gaveta lateral com a comanda do atendimento.
export default function ComandaDrawer({ pacienteId, clinicaId, profissionalId, usuarioId }: Props) {
  const [comanda, setComanda] = useState<Comanda | null>(null)
  const [aberto, setAberto] = useState(false)
  const [criando, setCriando] = useState(false)
  const [unidades, setUnidades] = useState<Unidade[]>([])
  const [unidadeSel, setUnidadeSel] = useState('')

  useEffect(() => {
    if (!clinicaId) return
    listarUnidades(clinicaId, true).then(({ data }) => setUnidades(data || []))
  }, [clinicaId])

  const buscar = useCallback(async () => {
    if (!pacienteId || !clinicaId) { setComanda(null); return }
    const { data } = await listarComandas(clinicaId, { pacienteId })
    // comanda ativa do atendimento = rascunho (criada pelo trigger) ou aberta
    const ativa = (data || []).find((c) => c.status === 'rascunho' || c.status === 'aberta')
    setComanda(ativa || null)
  }, [pacienteId, clinicaId])

  useEffect(() => { buscar() }, [buscar])

  if (!pacienteId || !clinicaId) return null

  async function abrirAvulsa() {
    if (!pacienteId || !clinicaId) return
    setCriando(true)
    const { data } = await criarComandaAvulsa({
      clinica_id: clinicaId,
      paciente_id: pacienteId,
      profissional_id: profissionalId,
      unidade_id: unidadeSel || null,
    })
    setCriando(false)
    if (data) setComanda(data)
  }

  return (
    <>
      {/* Botão flutuante */}
      <button onClick={() => setAberto(true)} style={fab}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 2L7 6H4a1 1 0 00-1 1.2l2.5 12A2 2 0 007.4 22h9.2a2 2 0 002-1.8L21 7.2A1 1 0 0020 6h-3l-2-4" />
          <path d="M9 6h6" />
        </svg>
        Comanda
        {comanda && comanda.valor_final > 0 && (
          <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>· {brl(comanda.valor_final)}</span>
        )}
      </button>

      {/* Gaveta */}
      {aberto && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setAberto(false) }}
          style={{ position: 'fixed', inset: 0, background: tokens.bg.overlay, zIndex: 150, display: 'flex', justifyContent: 'flex-end' }}
        >
          <div style={{
            width: 'min(440px, 100%)', height: '100%', background: tokens.bg.page,
            padding: 20, overflowY: 'auto', boxShadow: '-8px 0 32px rgba(0,0,0,0.12)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: tokens.text.primary, margin: 0 }}>
                Comanda do atendimento
              </h2>
              <button onClick={() => setAberto(false)} aria-label="Fechar" style={btnFechar}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {comanda ? (
              <ComandaPanel comandaId={comanda.id} usuarioId={usuarioId} onAtualizar={setComanda} />
            ) : (
              <div style={{
                background: tokens.bg.card, borderRadius: 16, border: `1px solid ${tokens.border.subtle}`,
                padding: 28, textAlign: 'center',
              }}>
                <p style={{ fontSize: 13, color: tokens.text.secondary, margin: '0 0 16px', lineHeight: 1.6 }}>
                  Nenhuma comanda em aberto para este paciente. Comandas de agendamentos
                  confirmados aparecem aqui automaticamente.
                </p>
                {unidades.length > 0 && (
                  <select
                    value={unidadeSel}
                    onChange={(e) => setUnidadeSel(e.target.value)}
                    style={{
                      width: '100%', padding: '9px 11px', borderRadius: 9, marginBottom: 10,
                      border: `1px solid ${tokens.border.default}`, fontSize: 13,
                      background: tokens.bg.card, color: tokens.text.primary, outline: 'none',
                    }}
                  >
                    <option value="">Sem unidade específica</option>
                    {unidades.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
                  </select>
                )}
                <button onClick={abrirAvulsa} disabled={criando} style={btnAvulsa}>
                  {criando ? 'Abrindo...' : 'Abrir comanda avulsa'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

const fab: React.CSSProperties = {
  position: 'fixed', right: 22, bottom: 22, zIndex: 120,
  display: 'inline-flex', alignItems: 'center', gap: 8,
  padding: '11px 18px', borderRadius: 100, border: 'none',
  background: tokens.brand.primary, color: '#fff', fontSize: 13, fontWeight: 600,
  cursor: 'pointer', boxShadow: '0 6px 20px rgba(96,67,193,0.35)',
}
const btnFechar: React.CSSProperties = {
  width: 30, height: 30, borderRadius: 8, border: `1px solid ${tokens.border.default}`,
  background: tokens.bg.card, color: tokens.text.secondary, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
}
const btnAvulsa: React.CSSProperties = {
  padding: '10px 20px', borderRadius: 10, border: 'none',
  background: tokens.brand.primary, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
}
