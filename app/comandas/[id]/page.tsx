'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { tokens } from '@/lib/design-tokens'
import ComandaPanel from '@/components/financeiro/ComandaPanel'
import { PageHeader } from '@/components/ui'
import type { Comanda } from '@/lib/financeiro/types'

export default function ComandaDetalhe() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [usuarioId, setUsuarioId] = useState<string | null>(null)
  const [comanda, setComanda] = useState<any>(null)

  useEffect(() => {
    try {
      const m = localStorage.getItem('medico')
      if (m) setUsuarioId(JSON.parse(m)?.id || null)
    } catch { /* ignore */ }
  }, [])

  return (
    <div style={{ padding: 24 }}>
      <div style={{ maxWidth: 620 }}>
        <button onClick={() => router.back()} style={{
          background: 'none', border: 'none', color: tokens.text.secondary,
          fontSize: 13, cursor: 'pointer', padding: 0, marginBottom: 10,
        }}>
          ← Voltar
        </button>
        <PageHeader
          titulo="Comanda"
          descricao={comanda?.pacientes?.nome
            ? `${comanda.pacientes.nome} — gerencie itens, descontos e fechamento.`
            : 'Gerencie itens, descontos e fechamento da comanda.'}
        />

        <ComandaPanel
          comandaId={id}
          usuarioId={usuarioId}
          onAtualizar={(c: Comanda) => setComanda(c)}
        />
      </div>
    </div>
  )
}
