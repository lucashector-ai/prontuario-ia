import { tint, tokens } from '@/lib/design-tokens'
import { corConvenio, normalizarConvenio } from '@/lib/convenios'

/** Selo de convênio padronizado: mesma cor para a mesma operadora em todo o app. */
export function ConvenioBadge({ convenio, size = 'md', style }: {
  convenio?: string | null
  size?: 'sm' | 'md'
  style?: React.CSSProperties
}) {
  const nome = normalizarConvenio(convenio)
  const cor = corConvenio(nome)
  const particular = nome === 'Particular'
  return (
    <span title={nome} style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, maxWidth: '100%',
      fontSize: size === 'sm' ? 11 : 11.5, fontWeight: 600, padding: size === 'sm' ? '2px 7px' : '3px 9px', borderRadius: 99,
      background: particular ? tokens.border.muted : tint(cor, 0.13),
      color: particular ? tokens.text.secondary : `color-mix(in oklch, ${cor} 72%, black)`,
      whiteSpace: 'nowrap', ...style,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: cor, flexShrink: 0 }} />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{nome}</span>
    </span>
  )
}
