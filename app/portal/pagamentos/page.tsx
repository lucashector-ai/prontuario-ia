'use client'

import { useState } from 'react'
import { tokens } from '@/lib/design-tokens'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { Tabs } from '@/components/ui/Tabs'
import { FadeIn } from '@/components/motion/FadeIn'
import { PageHeader } from '../_components/PageHeader'
import { EmptyState } from '../_components/EmptyState'
import { useToast } from '@/components/Toast'
import { formatDataLonga, formatMoeda } from '@/lib/portal/format'

/**
 * Pagamentos — UI premium pronta. O backend de cobrança Pix (Mercado Pago /
 * AbacatePay / Asaas) e integração com `financeiro_movimentacoes` ficam pra
 * Sprint 3 (Financeiro Premium). Aqui mostramos a estética e fluxo, com
 * placeholders claros.
 */
export default function PagamentosPage() {
  const [tab, setTab] = useState('em-aberto')
  const [pixOpen, setPixOpen] = useState(false)
  const { toast } = useToast()

  const tabs = [
    { value: 'em-aberto', label: 'Em aberto', badge: 0 },
    { value: 'historico', label: 'Histórico' },
    { value: 'metodos',   label: 'Métodos' },
  ]

  return (
    <FadeIn>
      <div style={{ padding: '24px 20px', maxWidth: 760 }}>
        <PageHeader
          eyebrow="Pagamentos"
          title="Cobranças e recibos"
          description="Quitar uma fatura em segundos, baixar recibo, gerenciar métodos."
        />

        <div style={{ marginBottom: 20 }}>
          <Tabs items={tabs} value={tab} onChange={setTab} />
        </div>

        {tab === 'em-aberto' && (
          <EmptyState
            title="Sem cobranças em aberto"
            description="Quando a clínica gerar uma cobrança pra você, vai aparecer aqui com Pix on-demand."
            action={<Button onClick={() => setPixOpen(true)}>Ver exemplo de Pix</Button>}
          />
        )}

        {tab === 'historico' && (
          <EmptyState
            title="Histórico vazio"
            description="Suas faturas pagas aparecem aqui com recibo em PDF."
          />
        )}

        {tab === 'metodos' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Card variant="elevated">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: tokens.text.primary, marginBottom: 4 }}>Pix</div>
                  <div style={{ fontSize: 13, color: tokens.text.tertiary }}>Pagamento instantâneo via QR Code</div>
                </div>
                <Badge variant="success" size="sm" dot>Disponível</Badge>
              </div>
            </Card>
            <Card>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: tokens.text.primary, marginBottom: 4 }}>Cartão de crédito</div>
                  <div style={{ fontSize: 13, color: tokens.text.tertiary }}>Em breve</div>
                </div>
                <Badge size="sm">Em breve</Badge>
              </div>
            </Card>
            <Card>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: tokens.text.primary, marginBottom: 4 }}>Boleto</div>
                  <div style={{ fontSize: 13, color: tokens.text.tertiary }}>Em breve</div>
                </div>
                <Badge size="sm">Em breve</Badge>
              </div>
            </Card>
          </div>
        )}

        <Modal
          open={pixOpen}
          onClose={() => setPixOpen(false)}
          title="Pix — exemplo"
          description="No produto final, a clínica gera a cobrança e este QR fica válido por 30 minutos."
          footer={<>
            <Button variant="secondary" onClick={() => setPixOpen(false)}>Fechar</Button>
            <Button onClick={() => { navigator.clipboard?.writeText('00020126360014BR.GOV.BCB.PIX...exemplo'); toast('Código Pix copiado', 'success'); setPixOpen(false) }}>Copiar código</Button>
          </>}
        >
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: 220, height: 220,
              margin: '0 auto 16px',
              background: tokens.bg.cardSubtle,
              borderRadius: tokens.radius.xl,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: tokens.text.tertiary,
              fontSize: 12,
            }}>
              <QrPlaceholder />
            </div>
            <div style={{ fontSize: 26, fontWeight: 700, color: tokens.text.primary, marginBottom: 4 }}>
              {formatMoeda(180)}
            </div>
            <div style={{ fontSize: 13, color: tokens.text.tertiary }}>
              Vence em 30 min · {formatDataLonga(new Date().toISOString())}
            </div>
          </div>
        </Modal>
      </div>
    </FadeIn>
  )
}

function QrPlaceholder() {
  return (
    <svg width="160" height="160" viewBox="0 0 160 160" style={{ opacity: 0.55 }}>
      <rect x="0" y="0" width="160" height="160" fill="none" stroke={tokens.border.strong} strokeWidth="2" rx="8"/>
      {Array.from({ length: 11 }).map((_, r) =>
        Array.from({ length: 11 }).map((_, c) => {
          const fill = (r * 13 + c * 7 + r * c) % 5 < 2
          return fill ? <rect key={`${r}-${c}`} x={10 + c * 13} y={10 + r * 13} width="11" height="11" fill={tokens.text.strong} rx="2"/> : null
        })
      )}
    </svg>
  )
}
