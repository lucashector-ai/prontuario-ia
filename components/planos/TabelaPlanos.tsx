'use client'
/** Cartões dos planos com "Quero este plano" (vira pedido por email para a equipe liberar). */
import { useState } from 'react'
import { Check, Sparkles } from 'lucide-react'
import { tokens as T } from '@/lib/design-tokens'
import { Button, Card, SegmentedControl } from '@/components/ui'
import { PLANOS_PAGOS } from '@/lib/planos'
import { tokenSessao } from '@/lib/supabase'

export function TabelaPlanos({ recurso }: { recurso?: string }) {
  const [ciclo, setCiclo] = useState<'mensal' | 'anual'>('mensal')
  const [pedido, setPedido] = useState<string | null>(null)
  const [enviando, setEnviando] = useState<string | null>(null)

  async function pedir(id: string, nome: string) {
    setEnviando(id)
    try {
      const t = tokenSessao()
      await fetch('/api/planos/interesse', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) }, body: JSON.stringify({ recurso, plano: `${nome} (${ciclo})` }) })
      setPedido(id)
    } finally { setEnviando(null) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <SegmentedControl value={ciclo} onChange={v => setCiclo(v as any)} options={[{ value: 'mensal', label: 'Mensal' }, { value: 'anual', label: 'Anual (20% menos)' }]} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
        {PLANOS_PAGOS.map(p => (
          <Card key={p.id} style={{ display: 'flex', flexDirection: 'column', gap: 14, border: p.destaque ? `1.5px solid ${T.brand.primary}` : undefined }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 17, fontWeight: 750, color: T.text.primary }}>{p.nome}</span>
                {p.destaque && <span style={{ fontSize: 11, fontWeight: 700, color: T.brand.primary, background: T.brand.primaryLight, padding: '2px 8px', borderRadius: 99 }}>Mais escolhido</span>}
              </div>
              <div style={{ fontSize: 13, color: T.text.tertiary, marginTop: 2 }}>{p.para}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span style={{ fontSize: 13, color: T.text.secondary }}>R$</span>
              <span style={{ fontSize: 32, fontWeight: 750, letterSpacing: '-.03em', color: T.text.primary }}>{ciclo === 'mensal' ? p.mensal : p.anualMes}</span>
              <span style={{ fontSize: 13, color: T.text.secondary }}>/mês{ciclo === 'anual' ? ', no plano anual' : ''}</span>
            </div>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
              {p.itens.map(i => (
                <li key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13.5, color: T.text.strong }}>
                  <Check size={15} color={T.brand.primary} style={{ flexShrink: 0, marginTop: 2 }} />{i}
                </li>
              ))}
            </ul>
            {pedido === p.id ? (
              <div style={{ padding: '10px 12px', borderRadius: 12, background: T.status.successBg, color: T.status.success, fontSize: 13, fontWeight: 600 }}>Pedido recebido. A equipe do Clinical 360 fala com você para ativar.</div>
            ) : (
              <Button variant={p.destaque ? 'primary' : 'secondary'} icon={Sparkles} onClick={() => pedir(p.id, p.nome)} disabled={!!enviando}>{enviando === p.id ? 'Enviando…' : `Quero o ${p.nome}`}</Button>
            )}
          </Card>
        ))}
      </div>
    </div>
  )
}
