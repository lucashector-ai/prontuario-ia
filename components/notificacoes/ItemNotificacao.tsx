'use client'
/**
 * Uma notificação na lista (sino e central). Não lida = fundo lilás + ponto.
 * O botão à direita alterna lida/não lida sem abrir a notificação.
 */
import { useState } from 'react'
import { Check, CircleDot } from 'lucide-react'
import { tokens as T } from '@/lib/design-tokens'
import { estiloDaNotificacao, tempoRelativo, type Notificacao } from '@/lib/notificacoes'

export function ItemNotificacao({ n, onAbrir, onAlternarLida, compacto }: {
  n: Notificacao
  onAbrir: (n: Notificacao) => void
  onAlternarLida: (n: Notificacao) => void
  compacto?: boolean
}) {
  const [hover, setHover] = useState(false)
  const { icon: Icone, cor } = estiloDaNotificacao(n)
  const fundo = hover ? T.bg.hover : n.lida ? 'transparent' : T.brand.primarySoftBg
  const tam = compacto ? 38 : 44

  return (
    <div
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ position: 'relative', display: 'flex', alignItems: 'center', borderRadius: 12, background: fundo, transition: 'background .12s' }}
    >
      <button
        onClick={() => onAbrir(n)}
        style={{
          flex: 1, minWidth: 0, display: 'flex', alignItems: 'flex-start', gap: 12, textAlign: 'left',
          padding: compacto ? '10px 44px 10px 10px' : '12px 52px 12px 12px', background: 'none', border: 'none',
          cursor: 'pointer', fontFamily: 'inherit', borderRadius: 12,
        }}
      >
        <span style={{ width: tam, height: tam, borderRadius: '50%', flexShrink: 0, display: 'grid', placeItems: 'center', background: `color-mix(in srgb, ${cor} 12%, transparent)`, color: cor }}>
          <Icone size={compacto ? 17 : 19} strokeWidth={1.7} />
        </span>
        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: compacto ? 13 : 14, fontWeight: n.lida ? 500 : 650, color: T.text.primary, lineHeight: 1.35 }}>{n.titulo}</span>
          {n.descricao && <span style={{ fontSize: compacto ? 12 : 13, color: T.text.secondary, lineHeight: 1.4 }}>{n.descricao}</span>}
          <span style={{ fontSize: 11.5, fontWeight: n.lida ? 400 : 600, color: n.lida ? T.text.quaternary : T.brand.primary, marginTop: 2 }}>{tempoRelativo(n.criada_em)}</span>
        </span>
      </button>

      {/* Ponto de não lida; no hover vira o botão de alternar */}
      <button
        onClick={() => onAlternarLida(n)}
        title={n.lida ? 'Marcar como não lida' : 'Marcar como lida'}
        aria-label={n.lida ? 'Marcar como não lida' : 'Marcar como lida'}
        style={{
          position: 'absolute', right: compacto ? 8 : 12, top: '50%', transform: 'translateY(-50%)',
          width: 30, height: 30, borderRadius: '50%', display: 'grid', placeItems: 'center', cursor: 'pointer',
          border: hover ? `1px solid ${T.border.default}` : '1px solid transparent',
          background: hover ? '#fff' : 'transparent', color: T.text.secondary, padding: 0,
        }}
      >
        {hover
          ? (n.lida ? <CircleDot size={15} strokeWidth={1.8} /> : <Check size={15} strokeWidth={2} />)
          : (!n.lida && <span style={{ width: 10, height: 10, borderRadius: '50%', background: T.brand.primary }} />)}
      </button>
    </div>
  )
}

export function EsqueletoNotificacao({ compacto }: { compacto?: boolean }) {
  const tam = compacto ? 38 : 44
  return (
    <div style={{ display: 'flex', gap: 12, padding: compacto ? 10 : 12, alignItems: 'center' }}>
      <span className="c360-skel" style={{ width: tam, height: tam, borderRadius: '50%', flexShrink: 0 }} />
      <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
        <span className="c360-skel" style={{ height: 11, width: '72%', borderRadius: 6 }} />
        <span className="c360-skel" style={{ height: 9, width: '40%', borderRadius: 6 }} />
      </span>
    </div>
  )
}
