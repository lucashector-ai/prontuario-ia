'use client'
/**
 * Botão "Gerar guia TISS" para telas de consulta (histórico, fim da consulta).
 * Só aparece se o convênio do paciente não for Particular. Cria a guia em
 * rascunho (ou reaproveita a já existente da consulta) e abre /faturamento?guia=<id>.
 *
 *   <BotaoGerarGuia consultaId={consulta.id} pacienteConvenio={paciente.convenio} />
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileText } from 'lucide-react'
import { Button } from '@/components/ui'
import { notificar } from '@/components/ui/dialogos'
import { normalizarConvenio } from '@/lib/convenios'

export function BotaoGerarGuia({ consultaId, pacienteConvenio, size = 'sm' }: {
  consultaId: string
  pacienteConvenio?: string | null
  size?: 'sm' | 'md'
}) {
  const router = useRouter()
  const [gerando, setGerando] = useState(false)
  if (!consultaId || normalizarConvenio(pacienteConvenio) === 'Particular') return null

  async function gerar() {
    setGerando(true)
    try {
      const escopo: Record<string, string> = {}
      try {
        const ca = localStorage.getItem('clinica_admin')
        const m = localStorage.getItem('medico')
        if (ca) escopo.clinica_id = JSON.parse(ca).clinica_id
        else if (m) { const med = JSON.parse(m); if (med.clinica_id) escopo.clinica_id = med.clinica_id; else escopo.medico_id = med.id }
      } catch { /* sem escopo: a API usa o médico da consulta */ }
      const r = await fetch('/api/tiss/guias/gerar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consulta_id: consultaId, ...escopo }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { notificar(j.error || 'Não foi possível gerar a guia', 'erro'); return }
      notificar(j.existente ? 'Esta consulta já tem guia — abrindo' : 'Guia criada em rascunho')
      router.push(`/faturamento?guia=${j.guia.id}`)
    } finally {
      setGerando(false)
    }
  }

  return (
    <Button variant="secondary" size={size} icon={FileText} disabled={gerando} onClick={gerar}>
      {gerando ? 'Gerando…' : 'Gerar guia TISS'}
    </Button>
  )
}
