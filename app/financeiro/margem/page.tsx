'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/useAuth'
import { tokens } from '@/lib/design-tokens'
import { obterMargens, type ProcedimentoMargem } from '@/lib/financeiro/margem'

const brl = (v: number) =>
  'R$ ' + (Number(v) || 0).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')

function corMargem(pct: number): string {
  if (pct >= 60) return tokens.status.success
  if (pct >= 30) return tokens.status.warningAmberStrong
  return tokens.status.danger
}

export default function MargemPage() {
  const router = useRouter()
  const { usuario } = useAuth()
  const clinicaId = usuario?.clinica_id || null

  const [margens, setMargens] = useState<ProcedimentoMargem[]>([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    if (!clinicaId) return
    obterMargens(clinicaId).then(({ data }) => {
      setMargens(data || [])
      setCarregando(false)
    })
  }, [clinicaId])

  const ordenados = useMemo(
    () => [...margens].sort((a, b) => b.margemPct - a.margemPct),
    [margens],
  )
  const comCusto = ordenados.filter((m) => m.custoTotal > 0)
  const semCusto = ordenados.length - comCusto.length

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: tokens.text.primary, margin: 0 }}>
        Margem por procedimento
      </h1>
      <p style={{ fontSize: 13, color: tokens.text.secondary, margin: '4px 0 20px' }}>
        Veja quais serviços realmente dão lucro. Custos são cadastrados em Procedimentos.
      </p>

      {semCusto > 0 && (
        <div style={{
          background: tokens.status.warningBg, border: `1px solid ${tokens.status.warningLightSoft}`,
          borderRadius: 12, padding: '10px 14px', marginBottom: 14, fontSize: 12.5, color: tokens.status.warningTextStrong,
        }}>
          {semCusto} procedimento(s) sem custo cadastrado — a margem deles considera custo zero.
        </div>
      )}

      <div style={{ background: tokens.bg.card, border: `1px solid ${tokens.border.subtle}`, borderRadius: 14, overflow: 'hidden' }}>
        {carregando ? (
          <p style={vazio}>Carregando...</p>
        ) : ordenados.length === 0 ? (
          <p style={vazio}>Nenhum procedimento ativo cadastrado.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: tokens.bg.muted }}>
                {['Procedimento', 'Preço', 'Custo', 'Margem R$', 'Margem %', 'ROI', 'Faturado no mês'].map((h) => (
                  <th key={h} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ordenados.map((m) => (
                <tr key={m.id} style={{ borderTop: `1px solid ${tokens.border.subtle}` }}>
                  <td style={{ ...td, fontWeight: 600 }}>{m.nome}</td>
                  <td style={tdNum}>{brl(m.valor)}</td>
                  <td style={{ ...tdNum, color: tokens.text.secondary }}>{brl(m.custoTotal)}</td>
                  <td style={{ ...tdNum, fontWeight: 600, color: m.margem >= 0 ? tokens.text.primary : tokens.status.danger }}>
                    {brl(m.margem)}
                  </td>
                  <td style={tdNum}>
                    <span style={{ fontWeight: 700, color: corMargem(m.margemPct) }}>
                      {m.margemPct.toFixed(0)}%
                    </span>
                  </td>
                  <td style={{ ...tdNum, color: tokens.text.secondary }}>
                    {m.custoTotal > 0 ? `${m.roi.toFixed(0)}%` : '—'}
                  </td>
                  <td style={{ ...tdNum, color: tokens.text.secondary }}>
                    {m.faturadoMes > 0 ? `${brl(m.faturadoMes)} · ${m.qtdMes}x` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <button onClick={() => router.push('/financeiro')} style={{
        marginTop: 14, padding: '6px 11px', borderRadius: 8, border: 'none',
        background: 'transparent', color: tokens.brand.primary, fontSize: 12, fontWeight: 600, cursor: 'pointer',
      }}>← Voltar ao financeiro</button>
    </div>
  )
}

const th: React.CSSProperties = {
  textAlign: 'left', padding: '11px 14px', fontSize: 11, fontWeight: 700,
  color: tokens.text.secondary, textTransform: 'uppercase', letterSpacing: '0.04em',
}
const td: React.CSSProperties = { padding: '12px 14px', fontSize: 13, color: tokens.text.primary, verticalAlign: 'middle' }
const tdNum: React.CSSProperties = { ...td, fontVariantNumeric: 'tabular-nums' }
const vazio: React.CSSProperties = { textAlign: 'center', padding: '40px 20px', fontSize: 13, color: tokens.text.tertiary, margin: 0 }
