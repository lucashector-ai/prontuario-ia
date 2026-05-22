'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import * as XLSX from 'xlsx'
import { useAuth } from '@/lib/useAuth'
import { tokens } from '@/lib/design-tokens'
import {
  obterDRE, obterFluxoMensal, obterMovimentacoesPeriodo,
  type DRE, type MesFluxo,
} from '@/lib/financeiro/relatorios'
import { PageHeader, Card, Button, Field, Input } from '@/components/ui'

const brl = (v: number) =>
  'R$ ' + (Number(v) || 0).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')

const mesAtual = () => new Date().toISOString().slice(0, 7)
const hojeISO = () => new Date().toISOString().slice(0, 10)
const inicioMesISO = () => {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
}

export default function RelatoriosPage() {
  const router = useRouter()
  const { usuario } = useAuth()
  const clinicaId = usuario?.clinica_id || null

  const [competencia, setCompetencia] = useState(mesAtual())
  const [dre, setDre] = useState<DRE | null>(null)
  const [fluxo, setFluxo] = useState<MesFluxo[]>([])

  const [de, setDe] = useState(inicioMesISO())
  const [ate, setAte] = useState(hojeISO())
  const [exportando, setExportando] = useState(false)

  const carregarDRE = useCallback(async () => {
    if (!clinicaId) return
    const { data } = await obterDRE(clinicaId, competencia)
    setDre(data)
  }, [clinicaId, competencia])
  useEffect(() => { carregarDRE() }, [carregarDRE])

  useEffect(() => {
    if (!clinicaId) return
    obterFluxoMensal(clinicaId).then(({ data }) => setFluxo(data || []))
  }, [clinicaId])

  async function exportar() {
    if (!clinicaId) return
    setExportando(true)
    const { data } = await obterMovimentacoesPeriodo(clinicaId, de, ate)
    const linhas = (data || []).map((m: any) => ({
      Data: m.data_movimentacao,
      Tipo: m.tipo === 'entrada' ? 'Entrada' : 'Saída',
      Origem: m.origem,
      Descrição: m.descricao || '',
      Valor: Number(m.valor || 0),
    }))
    const ws = XLSX.utils.json_to_sheet(linhas)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Movimentações')
    XLSX.writeFile(wb, `movimentacoes_${de}_a_${ate}.xlsx`)
    setExportando(false)
  }

  return (
    <div style={{ padding: 24 }}>
      <PageHeader
        titulo="Relatórios"
        descricao="DRE, fluxo de caixa mensal e exportação para a contabilidade."
      />

      {/* DRE */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: tokens.text.primary, margin: 0 }}>
            DRE — Demonstrativo de Resultado
          </p>
          <Input type="month" value={competencia} onChange={(e) => setCompetencia(e.target.value)} style={{ width: 'auto' }} />
        </div>
        {!dre ? (
          <p style={{ fontSize: 13, color: tokens.text.tertiary, margin: 0 }}>Carregando...</p>
        ) : (
          <div>
            <LinhaDRE rotulo="Receita bruta (recebido)" valor={dre.receitaBruta} forte />
            <p style={{ fontSize: 11.5, fontWeight: 700, color: tokens.text.tertiary, textTransform: 'uppercase', letterSpacing: '0.04em', margin: '14px 0 4px' }}>
              Despesas
            </p>
            {dre.despesas.length === 0 && (
              <p style={{ fontSize: 12.5, color: tokens.text.tertiary, margin: '4px 0' }}>Sem despesas pagas no mês.</p>
            )}
            {dre.despesas.map((d) => <LinhaDRE key={d.rotulo} rotulo={d.rotulo} valor={-d.valor} />)}
            <LinhaDRE rotulo="Repasses médicos" valor={-dre.repasses} />
            <div style={{ borderTop: `2px solid ${tokens.border.default}`, marginTop: 8, paddingTop: 8 }}>
              <LinhaDRE
                rotulo="Resultado do mês"
                valor={dre.resultado}
                forte
                cor={dre.resultado >= 0 ? tokens.status.success : tokens.status.danger}
              />
            </div>
          </div>
        )}
      </Card>

      {/* Fluxo mensal */}
      <Card style={{ marginBottom: 16, padding: 0, overflow: 'hidden' }}>
        <p style={{ fontSize: 14, fontWeight: 700, color: tokens.text.primary, margin: 0, padding: '18px 20px 12px' }}>
          Fluxo de caixa mensal
        </p>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: tokens.bg.muted }}>
              {['Mês', 'Entradas', 'Saídas', 'Saldo'].map((h) => <th key={h} style={th}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {fluxo.map((m) => (
              <tr key={m.mes} style={{ borderTop: `1px solid ${tokens.border.subtle}` }}>
                <td style={{ ...td, fontWeight: 600 }}>{m.rotulo}</td>
                <td style={{ ...tdNum, color: tokens.status.success }}>{brl(m.entradas)}</td>
                <td style={{ ...tdNum, color: tokens.status.danger }}>{brl(m.saidas)}</td>
                <td style={{ ...tdNum, fontWeight: 700, color: m.saldo < 0 ? tokens.status.danger : tokens.text.primary }}>
                  {brl(m.saldo)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Exportação */}
      <Card>
        <p style={{ fontSize: 14, fontWeight: 700, color: tokens.text.primary, margin: '0 0 4px' }}>
          Exportar para a contabilidade
        </p>
        <p style={{ fontSize: 12.5, color: tokens.text.secondary, margin: '0 0 14px' }}>
          Gera uma planilha XLSX com as movimentações do período para enviar ao contador.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
          <Field label="De"><Input type="date" value={de} onChange={(e) => setDe(e.target.value)} style={{ width: 'auto' }} /></Field>
          <Field label="Até"><Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} style={{ width: 'auto' }} /></Field>
          <Button onClick={exportar} disabled={exportando}>
            {exportando ? 'Gerando...' : 'Exportar XLSX'}
          </Button>
        </div>
      </Card>

      <Button variant="ghost" size="sm" onClick={() => router.push('/financeiro')} style={{ marginTop: 16, paddingLeft: 0 }}>
        ← Voltar ao financeiro
      </Button>
    </div>
  )
}

function LinhaDRE({ rotulo, valor, forte, cor }: {
  rotulo: string; valor: number; forte?: boolean; cor?: string
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 13 }}>
      <span style={{ color: forte ? tokens.text.primary : tokens.text.secondary, fontWeight: forte ? 700 : 400 }}>
        {rotulo}
      </span>
      <span style={{
        fontWeight: forte ? 700 : 600, fontVariantNumeric: 'tabular-nums',
        color: cor || (valor < 0 ? tokens.status.danger : tokens.text.primary),
      }}>
        {brl(valor)}
      </span>
    </div>
  )
}

const th: React.CSSProperties = {
  textAlign: 'left', padding: '10px 14px', fontSize: 11, fontWeight: 700,
  color: tokens.text.secondary, textTransform: 'uppercase', letterSpacing: '0.04em',
}
const td: React.CSSProperties = { padding: '10px 14px', fontSize: 13, color: tokens.text.primary }
const tdNum: React.CSSProperties = { ...td, fontVariantNumeric: 'tabular-nums' }
