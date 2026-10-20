'use client'
/** Tela mostrada no lugar de um recurso que não faz parte do plano Grátis: o que falta e os planos. */
import { Lock } from 'lucide-react'
import { tokens as T } from '@/lib/design-tokens'
import { IconTile } from '@/components/ui'
import { NOME_RECURSO, type Recurso } from '@/lib/planos'
import { TabelaPlanos } from '@/components/planos/TabelaPlanos'

export function PlanoCompleto({ recurso }: { recurso: Recurso }) {
  return (
    <div className="c360-pagina" style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1040, margin: '0 auto' }}>
      <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
        <IconTile icon={Lock} size={46} radius={14} />
        <div>
          <h2 style={{ margin: 0, fontSize: 21, fontWeight: 750, letterSpacing: '-.02em', color: T.text.primary }}>{NOME_RECURSO[recurso]} faz parte dos planos pagos</h2>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: T.text.secondary }}>Sua conta está no plano Grátis. Escolha um plano para liberar.</p>
        </div>
      </div>
      <TabelaPlanos recurso={NOME_RECURSO[recurso]} />
    </div>
  )
}
