'use client'
/** Tela mostrada no lugar de um recurso que não faz parte do plano Grátis. */
import { useState } from 'react'
import { Lock, Check, Sparkles } from 'lucide-react'
import { tokens as T } from '@/lib/design-tokens'
import { Button, Card, IconTile } from '@/components/ui'
import { PLANO_GRATIS, NOME_RECURSO, type Recurso } from '@/lib/planos'
import { tokenSessao } from '@/lib/supabase'

export function PlanoCompleto({ recurso }: { recurso: Recurso }) {
  const [enviado, setEnviado] = useState(false)
  const [enviando, setEnviando] = useState(false)
  async function pedir() {
    setEnviando(true)
    try {
      const t = tokenSessao()
      await fetch('/api/planos/interesse', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) }, body: JSON.stringify({ recurso: NOME_RECURSO[recurso] }) })
      setEnviado(true)
    } finally { setEnviando(false) }
  }
  return (
    <div className="c360-pagina" style={{ display: 'grid', placeItems: 'center', minHeight: '60vh' }}>
      <Card style={{ maxWidth: 520, width: '100%' }} padding={26}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <IconTile icon={Lock} size={46} radius={14} />
          <div>
            <h2 style={{ margin: 0, fontSize: 21, fontWeight: 750, letterSpacing: '-.02em', color: T.text.primary }}>{NOME_RECURSO[recurso]} faz parte do plano completo</h2>
            <p style={{ margin: '6px 0 0', fontSize: 14, color: T.text.secondary, lineHeight: 1.55 }}>
              Sua conta está no plano Grátis. Ele inclui o essencial para atender sozinho:
            </p>
          </div>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {PLANO_GRATIS.incluso.map(i => (
              <li key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 13.5, color: T.text.strong }}>
                <span style={{ width: 20, height: 20, borderRadius: 6, background: T.brand.primaryLight, color: T.brand.primary, display: 'grid', placeItems: 'center', flexShrink: 0 }}><Check size={12} strokeWidth={2.4} /></span>{i}
              </li>
            ))}
          </ul>
          {enviado ? (
            <div style={{ padding: '12px 14px', borderRadius: 12, background: T.status.successBg, color: T.status.success, fontSize: 13.5, fontWeight: 600 }}>
              Pedido recebido. A equipe do Clinical 360 vai falar com você para liberar o plano completo.
            </div>
          ) : (
            <Button size="lg" icon={Sparkles} onClick={pedir} disabled={enviando}>{enviando ? 'Enviando…' : 'Quero o plano completo'}</Button>
          )}
        </div>
      </Card>
    </div>
  )
}
