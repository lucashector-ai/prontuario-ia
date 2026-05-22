'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/useAuth'
import { tokens } from '@/lib/design-tokens'
import { listarLogs, type LogAuditoria } from '@/lib/financeiro/auditoria'
import { PageHeader, Card, Button } from '@/components/ui'

const brl = (v: number) =>
  'R$ ' + (Number(v) || 0).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')

const ACAO_LABEL: Record<string, string> = {
  'comanda.fechar': 'Comanda fechada',
  'recebimento.baixa': 'Baixa de recebimento',
  'despesa.pagar': 'Pagamento de despesa',
  'conta.transferencia': 'Transferência entre contas',
  'conta.ajuste': 'Ajuste de saldo',
}

function fmtDataHora(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export default function AuditoriaPage() {
  const router = useRouter()
  const { usuario } = useAuth()
  const clinicaId = usuario?.clinica_id || null

  const [logs, setLogs] = useState<LogAuditoria[]>([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    if (!clinicaId) return
    listarLogs(clinicaId).then(({ data }) => {
      setLogs(data || [])
      setCarregando(false)
    })
  }, [clinicaId])

  return (
    <div style={{ padding: 24 }}>
      <PageHeader
        titulo="Auditoria"
        descricao="Trilha de tudo que mexeu no financeiro — para rastrear e corrigir erros."
      />

      <Card style={{ padding: 0, overflow: 'hidden' }}>
        {carregando ? (
          <p style={vazio}>Carregando...</p>
        ) : logs.length === 0 ? (
          <p style={vazio}>Nenhum registro de auditoria ainda.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: tokens.bg.muted }}>
                {['Data', 'Ação', 'Detalhe', 'Valor'].map((h) => <th key={h} style={th}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} style={{ borderTop: `1px solid ${tokens.border.subtle}` }}>
                  <td style={{ ...td, color: tokens.text.secondary, whiteSpace: 'nowrap' }}>{fmtDataHora(l.created_at)}</td>
                  <td style={{ ...td, fontWeight: 600 }}>{ACAO_LABEL[l.acao] || l.acao}</td>
                  <td style={{ ...td, color: tokens.text.secondary }}>{l.detalhe || '—'}</td>
                  <td style={{ ...td, fontVariantNumeric: 'tabular-nums' }}>
                    {l.valor != null ? brl(l.valor) : '—'}
                  </td>
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
const td: React.CSSProperties = { padding: '11px 14px', fontSize: 13, color: tokens.text.primary }
const vazio: React.CSSProperties = { textAlign: 'center', padding: '40px 20px', fontSize: 13, color: tokens.text.tertiary, margin: 0 }
