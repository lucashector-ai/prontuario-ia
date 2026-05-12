'use client'

import { useState } from 'react'
import { tokens } from '@/lib/design-tokens'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { FadeIn } from '@/components/motion/FadeIn'
import { useToast } from '@/components/Toast'
import { PeriodoSelect, type PeriodoValor } from '../_components/PeriodoSelect'
import { useClinicaId } from '@/lib/financeiro/clinica'
import { listarMovimentacoes } from '@/lib/financeiro/queries'
import { dataBR, moeda } from '@/lib/financeiro/format'

export default function ExportarPage() {
  const { clinicaId } = useClinicaId()
  const [periodo, setPeriodo] = useState<PeriodoValor>(30)
  const [exportando, setExportando] = useState<'csv' | 'json' | null>(null)
  const { toast } = useToast()

  async function exportar(formato: 'csv' | 'json') {
    if (!clinicaId) {
      toast('Aguarde — identificando clínica.', 'info')
      return
    }
    setExportando(formato)

    const fim = new Date()
    const ini = new Date()
    ini.setDate(fim.getDate() - periodo)
    const inicio = ini.toISOString().split('T')[0]
    const fimStr = fim.toISOString().split('T')[0]

    const movs = await listarMovimentacoes(clinicaId, {
      inicio,
      fim: fimStr,
      limit: 5000,
    })

    let blob: Blob
    let filename: string

    if (formato === 'json') {
      const payload = movs.map((m) => ({
        data: m.data_movimentacao,
        tipo: m.tipo,
        valor: m.valor,
        status: m.status,
        descricao: m.descricao,
        categoria: m.categoria?.nome,
        paciente: m.pacientes?.nome,
        medico: m.medicos?.nome,
      }))
      blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
      filename = `movimentacoes-${inicio}-a-${fimStr}.json`
    } else {
      const header = ['data', 'tipo', 'valor', 'status', 'descricao', 'categoria', 'paciente', 'medico']
      const lines = [header.join(',')]
      for (const m of movs) {
        const row = [
          m.data_movimentacao,
          m.tipo,
          String(m.valor).replace('.', ','),
          m.status,
          csvEscape(m.descricao || ''),
          csvEscape(m.categoria?.nome || ''),
          csvEscape(m.pacientes?.nome || ''),
          csvEscape(m.medicos?.nome || ''),
        ]
        lines.push(row.join(','))
      }
      blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
      filename = `movimentacoes-${inicio}-a-${fimStr}.csv`
    }

    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    setExportando(null)
    toast(`Exportado ${movs.length} registro${movs.length === 1 ? '' : 's'}.`, 'success')
  }

  return (
    <FadeIn>
      <div style={{ marginBottom: 24 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: tokens.brand.primary, letterSpacing: 0.6, textTransform: 'uppercase' }}>Financeiro</span>
        <h1 style={{ margin: '8px 0 0', fontSize: 28, fontWeight: 700, letterSpacing: -0.5, color: tokens.text.primary }}>Exportar</h1>
        <p style={{ margin: '4px 0 0', fontSize: 14, color: tokens.text.secondary }}>
          Baixe movimentações pra mandar pro contador ou abrir em planilha.
        </p>
      </div>

      <Card variant="elevated" style={{ marginBottom: 14 }}>
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: tokens.text.strong, marginBottom: 8 }}>Período</div>
          <PeriodoSelect value={periodo} onChange={setPeriodo} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          <FormatCard
            titulo="CSV (Excel/Sheets)"
            descricao="Pra abrir direto no Excel, Sheets ou software contábil."
            badge="Recomendado"
            badgeVariant="success"
            onClick={() => exportar('csv')}
            loading={exportando === 'csv'}
          />
          <FormatCard
            titulo="JSON"
            descricao="Dados brutos pra automações ou backup."
            onClick={() => exportar('json')}
            loading={exportando === 'json'}
          />
          <FormatCard
            titulo="PDF (TODO)"
            descricao="Relatório formatado com KPIs e gráfico. Em produção: jsPDF ou html-to-pdf."
            badge="Em breve"
            badgeVariant="warning"
            disabled
          />
        </div>
      </Card>

      <Card>
        <div style={{ fontSize: 13, color: tokens.text.secondary, lineHeight: 1.6 }}>
          <strong style={{ color: tokens.text.strong, fontWeight: 600 }}>Sobre o CSV:</strong> usamos BOM UTF-8 + vírgula como separador. Valor numérico vem com vírgula decimal pra abrir bem em ferramentas brasileiras.
        </div>
      </Card>
    </FadeIn>
  )
}

function FormatCard({
  titulo, descricao, badge, badgeVariant, onClick, loading, disabled,
}: {
  titulo: string; descricao: string;
  badge?: string; badgeVariant?: 'success' | 'warning' | 'brand' | 'neutral'
  onClick?: () => void; loading?: boolean; disabled?: boolean
}) {
  return (
    <Card padding={16} interactive={!disabled} onClick={disabled ? undefined : onClick}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: tokens.text.primary }}>{titulo}</div>
        {badge && <Badge size="sm" variant={badgeVariant || 'neutral'}>{badge}</Badge>}
      </div>
      <div style={{ fontSize: 13, color: tokens.text.secondary, lineHeight: 1.45, marginBottom: 12 }}>{descricao}</div>
      <Button
        size="sm"
        fullWidth
        disabled={disabled}
        loading={loading}
        variant={disabled ? 'secondary' : 'primary'}
      >
        {disabled ? 'Em breve' : 'Baixar'}
      </Button>
    </Card>
  )
}

function csvEscape(s: string): string {
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}
