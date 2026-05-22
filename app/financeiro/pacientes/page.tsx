'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/useAuth'
import { tokens } from '@/lib/design-tokens'
import { obterCrmFinanceiro, type ClienteFinanceiro } from '@/lib/financeiro/crm'
import { PageHeader, Card, Button, Input } from '@/components/ui'

const brl = (v: number) =>
  'R$ ' + (Number(v) || 0).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')
const fmtData = (d: string | null) => {
  if (!d) return '—'
  const [a, m, dia] = d.split('-')
  return `${dia}/${m}/${a}`
}

export default function CrmFinanceiroPage() {
  const router = useRouter()
  const { usuario } = useAuth()
  const clinicaId = usuario?.clinica_id || null

  const [clientes, setClientes] = useState<ClienteFinanceiro[]>([])
  const [carregando, setCarregando] = useState(true)
  const [busca, setBusca] = useState('')

  useEffect(() => {
    if (!clinicaId) return
    obterCrmFinanceiro(clinicaId).then(({ data }) => {
      setClientes(data || [])
      setCarregando(false)
    })
  }, [clinicaId])

  const filtrados = useMemo(
    () => clientes.filter((c) => !busca || c.nome.toLowerCase().includes(busca.toLowerCase())),
    [clientes, busca],
  )
  const resumo = useMemo(() => ({
    ltvTotal: clientes.reduce((s, c) => s + c.recebido, 0),
    emAberto: clientes.reduce((s, c) => s + c.emAberto, 0),
  }), [clientes])

  return (
    <div style={{ padding: 24 }}>
      <PageHeader
        titulo="CRM financeiro"
        descricao="Valor de cada paciente para a clínica — LTV, frequência e pendências."
      />

      {/* Resumo */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 16 }}>
        {[
          ['Pacientes com histórico', String(clientes.length)],
          ['LTV total (recebido)', brl(resumo.ltvTotal)],
          ['Em aberto com pacientes', brl(resumo.emAberto)],
        ].map(([label, valor]) => (
          <Card key={label} style={{ padding: '16px 18px' }}>
            <p style={{ fontSize: 12.5, color: tokens.text.secondary, margin: 0 }}>{label}</p>
            <p style={{ fontSize: 24, fontWeight: 600, color: tokens.text.primary, margin: '7px 0 0', fontVariantNumeric: 'tabular-nums' }}>{valor}</p>
          </Card>
        ))}
      </div>

      <div style={{ marginBottom: 12 }}>
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar paciente"
          style={{ width: 'min(320px, 100%)' }}
        />
      </div>

      <Card style={{ padding: 0, borderRadius: 14, overflow: 'hidden' }}>
        {carregando ? (
          <p style={vazio}>Carregando...</p>
        ) : filtrados.length === 0 ? (
          <p style={vazio}>Nenhum paciente com histórico financeiro ainda.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: tokens.bg.muted }}>
                {['#', 'Paciente', 'Comandas', 'Faturado', 'LTV (recebido)', 'Em aberto', 'Inadimplência', 'Última visita'].map((h) => (
                  <th key={h} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtrados.map((c, i) => (
                <tr key={c.pacienteId}
                  onClick={() => router.push('/pacientes/' + c.pacienteId)}
                  style={{ borderTop: `1px solid ${tokens.border.subtle}`, cursor: 'pointer' }}>
                  <td style={{ ...td, color: tokens.text.tertiary, width: 36 }}>{i + 1}</td>
                  <td style={{ ...td, fontWeight: 600 }}>{c.nome}</td>
                  <td style={{ ...tdNum, color: tokens.text.secondary }}>{c.nComandas}</td>
                  <td style={tdNum}>{brl(c.faturado)}</td>
                  <td style={{ ...tdNum, fontWeight: 700, color: tokens.brand.primary }}>{brl(c.recebido)}</td>
                  <td style={{ ...tdNum, color: c.emAberto > 0 ? tokens.text.primary : tokens.text.tertiary }}>{brl(c.emAberto)}</td>
                  <td style={{ ...tdNum, color: c.inadimplencia > 0 ? tokens.status.danger : tokens.text.tertiary }}>
                    {c.inadimplencia > 0 ? brl(c.inadimplencia) : '—'}
                  </td>
                  <td style={{ ...td, color: tokens.text.secondary }}>{fmtData(c.ultimaComanda)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Button variant="ghost" size="sm" onClick={() => router.push('/financeiro')} style={{ marginTop: 14, paddingLeft: 0 }}>
        ← Voltar ao financeiro
      </Button>
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
