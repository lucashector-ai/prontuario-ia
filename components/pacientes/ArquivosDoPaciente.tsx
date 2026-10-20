'use client'
/** Ficha do paciente: arquivos que ele enviou pelo portal e documentos liberados para ele. */
import { useEffect, useState } from 'react'
import { FileText, Paperclip, ExternalLink } from 'lucide-react'
import { tokens as T } from '@/lib/design-tokens'
import { Card } from '@/components/ui'

type Dados = { anexos: { id: string; nome_arquivo: string; criado_em: string; url: string | null }[]; documentos: { id: string; titulo: string; criado_em: string }[] }

export function ArquivosDoPaciente({ pacienteId }: { pacienteId: string }) {
  const [d, setD] = useState<Dados | null>(null)
  useEffect(() => {
    fetch(`/api/pacientes/${pacienteId}/arquivos`).then(r => r.ok ? r.json() : null).then(setD).catch(() => {})
  }, [pacienteId])
  if (!d || (!d.anexos.length && !d.documentos.length)) return null
  const data = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
  return (
    <Card style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: T.text.primary }}>Arquivos e documentos</h3>
      {d.anexos.map(a => (
        <a key={a.id} href={a.url || undefined} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: T.text.primary, textDecoration: 'none', padding: '6px 0' }}>
          <Paperclip size={15} color={T.brand.primary} />
          <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.nome_arquivo}</span>
          <span style={{ fontSize: 12, color: T.text.tertiary }}>enviado pelo paciente · {data(a.criado_em)}</span>
          <ExternalLink size={13} color={T.text.tertiary} />
        </a>
      ))}
      {d.documentos.map(x => (
        <div key={x.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: T.text.primary, padding: '6px 0' }}>
          <FileText size={15} color={T.text.secondary} />
          <span style={{ flex: 1 }}>{x.titulo}</span>
          <span style={{ fontSize: 12, color: T.text.tertiary }}>no portal desde {data(x.criado_em)}</span>
        </div>
      ))}
    </Card>
  )
}
