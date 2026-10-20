'use client'
/**
 * Selo do modo demonstração, em todas as telas da casca: deixa claro que os dados
 * são fictícios e que nada é gravado. "Sair da demonstração" encerra o demo e volta ao site.
 */
import { Badge } from '@/components/ui'
import { tokens as T } from '@/lib/design-tokens'
import { sairDoDemo } from '@/lib/demo'

export function SeloDemo() {
  return (
    <div role="status" style={{ display: 'flex', alignItems: 'center', gap: '6px 10px', flexWrap: 'wrap', padding: '0 2px', fontSize: 12.5, color: T.text.tertiary }}>
      <Badge tone="accent" dot>Modo demonstração · nada é gravado</Badge>
      <span>Dados fictícios, só para apresentação.</span>
      <button
        onClick={() => { sairDoDemo(); window.location.href = '/' }}
        style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 600, color: T.brand.primary }}
      >Sair da demonstração</button>
    </div>
  )
}
