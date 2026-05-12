'use client'

import { useState } from 'react'
import { tokens } from '@/lib/design-tokens'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { Tabs } from '@/components/ui/Tabs'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Sheet } from '@/components/ui/Sheet'
import { Skeleton, SkeletonText } from '@/components/ui/Skeleton'
import { FadeIn } from '@/components/motion/FadeIn'
import { SlideIn } from '@/components/motion/SlideIn'
import { useToast } from '@/components/Toast'

export default function DesignSystemPage() {
  const [tab, setTab] = useState('botoes')
  const [modalOpen, setModalOpen] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [inputErr, setInputErr] = useState('')
  const { toast } = useToast()

  const tabs = [
    { value: 'botoes',     label: 'Botões' },
    { value: 'inputs',     label: 'Inputs' },
    { value: 'cards',      label: 'Cards' },
    { value: 'badges',     label: 'Badges' },
    { value: 'overlays',   label: 'Overlays' },
    { value: 'skeletons',  label: 'Skeletons' },
    { value: 'motion',     label: 'Motion' },
  ]

  return (
    <div style={{ minHeight: '100dvh', background: tokens.bg.page }}>
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '40px 24px 80px' }}>
        <FadeIn>
          <header style={{ marginBottom: 32 }}>
            <Badge variant="brand" size="sm">Clinical 360 v2 · Sprint 1</Badge>
            <h1 style={{ margin: '12px 0 8px', fontSize: 36, fontWeight: 700, letterSpacing: -0.8, color: tokens.text.primary }}>
              Design System
            </h1>
            <p style={{ margin: 0, fontSize: 16, color: tokens.text.secondary, lineHeight: 1.55 }}>
              Primitives reutilizáveis pra todos os pilares premium. Estética Stripe + Linear + Apple + Nubank.
            </p>
          </header>
        </FadeIn>

        <div style={{ marginBottom: 32 }}>
          <Tabs items={tabs} value={tab} onChange={setTab} />
        </div>

        {tab === 'botoes' && <Section title="Botões">
          <Row label="Variantes">
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
          </Row>
          <Row label="Tamanhos">
            <Button size="sm">Small</Button>
            <Button size="md">Medium</Button>
            <Button size="lg">Large</Button>
          </Row>
          <Row label="Estados">
            <Button loading>Carregando</Button>
            <Button disabled>Desabilitado</Button>
            <Button onClick={() => toast('Olá do toast', 'success')}>Disparar toast</Button>
          </Row>
          <Row label="Com ícone">
            <Button leftIcon={<PlusIcon />}>Adicionar</Button>
            <Button variant="secondary" rightIcon={<ArrowIcon />}>Próximo</Button>
          </Row>
        </Section>}

        {tab === 'inputs' && <Section title="Inputs">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
            <Input label="Nome completo" placeholder="Lucas Hector" />
            <Input label="Email" type="email" placeholder="voce@clinica.com" hint="Usado pra magic link." />
            <Input
              label="Telefone"
              placeholder="(11) 99999-9999"
              error={inputErr}
              onChange={(e) => setInputErr(e.target.value.length > 0 && e.target.value.length < 10 ? 'Mínimo 10 dígitos.' : '')}
            />
            <Input label="Busca" placeholder="Buscar..." leftIcon={<SearchIcon />} />
          </div>
        </Section>}

        {tab === 'cards' && <Section title="Cards">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
            <Card>
              <strong style={{ display: 'block', marginBottom: 6 }}>Default</strong>
              <span style={{ color: tokens.text.secondary, fontSize: 14 }}>Card padrão com border sutil.</span>
            </Card>
            <Card variant="elevated">
              <strong style={{ display: 'block', marginBottom: 6 }}>Elevated</strong>
              <span style={{ color: tokens.text.secondary, fontSize: 14 }}>Com box-shadow leve.</span>
            </Card>
            <Card variant="ghost">
              <strong style={{ display: 'block', marginBottom: 6 }}>Ghost</strong>
              <span style={{ color: tokens.text.secondary, fontSize: 14 }}>Sem fundo, sem border.</span>
            </Card>
            <Card interactive onClick={() => toast('Card clicado', 'info')}>
              <strong style={{ display: 'block', marginBottom: 6 }}>Interactive</strong>
              <span style={{ color: tokens.text.secondary, fontSize: 14 }}>Hover + clique.</span>
            </Card>
          </div>
        </Section>}

        {tab === 'badges' && <Section title="Badges">
          <Row label="Variantes">
            <Badge>Neutral</Badge>
            <Badge variant="brand">Brand</Badge>
            <Badge variant="success">Sucesso</Badge>
            <Badge variant="warning">Atenção</Badge>
            <Badge variant="danger">Erro</Badge>
            <Badge variant="info">Info</Badge>
          </Row>
          <Row label="Com dot">
            <Badge dot variant="success">Online</Badge>
            <Badge dot variant="warning">Pendente</Badge>
            <Badge dot variant="danger">Atrasado</Badge>
            <Badge dot variant="brand">Premium</Badge>
          </Row>
          <Row label="Tamanhos">
            <Badge size="sm">Small</Badge>
            <Badge size="md">Medium</Badge>
          </Row>
        </Section>}

        {tab === 'overlays' && <Section title="Overlays">
          <Row label="Modal & Sheet">
            <Button onClick={() => setModalOpen(true)}>Abrir Modal</Button>
            <Button variant="secondary" onClick={() => setSheetOpen(true)}>Abrir Sheet (bottom)</Button>
          </Row>
          <Modal
            open={modalOpen}
            onClose={() => setModalOpen(false)}
            title="Confirmar ação"
            description="Esta é uma demo do componente Modal. ESC fecha, clique no backdrop fecha."
            footer={<>
              <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
              <Button onClick={() => { setModalOpen(false); toast('Confirmado', 'success') }}>Confirmar</Button>
            </>}
          >
            <p style={{ margin: 0, color: tokens.text.secondary, lineHeight: 1.5 }}>
              Backdrop com blur, animação de entrada com easing premium, body scroll trava.
            </p>
          </Modal>
          <Sheet
            open={sheetOpen}
            onClose={() => setSheetOpen(false)}
            title="Bottom sheet"
            footer={<Button fullWidth onClick={() => setSheetOpen(false)}>Fechar</Button>}
          >
            <p style={{ margin: 0, color: tokens.text.secondary, lineHeight: 1.5 }}>
              Usado pra ações em mobile. Slide-up suave, handle visual no topo.
            </p>
          </Sheet>
        </Section>}

        {tab === 'skeletons' && <Section title="Skeletons">
          <Card>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
              <Skeleton circle width={48} height={48} />
              <div style={{ flex: 1 }}>
                <Skeleton width="40%" height={14} style={{ marginBottom: 8 }} />
                <Skeleton width="65%" height={12} />
              </div>
            </div>
            <SkeletonText lines={3} />
          </Card>
        </Section>}

        {tab === 'motion' && <Section title="Motion">
          <Row label="FadeIn (delays)">
            <FadeIn delay={0.0}><Card padding={14}>Imediato</Card></FadeIn>
            <FadeIn delay={0.1}><Card padding={14}>+100ms</Card></FadeIn>
            <FadeIn delay={0.2}><Card padding={14}>+200ms</Card></FadeIn>
          </Row>
          <Row label="SlideIn (direções)">
            <SlideIn from="up"><Card padding={14}>From up</Card></SlideIn>
            <SlideIn from="left"><Card padding={14}>From left</Card></SlideIn>
            <SlideIn from="right"><Card padding={14}>From right</Card></SlideIn>
          </Row>
        </Section>}
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: tokens.text.primary }}>{title}</h2>
      {children}
    </section>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 500, color: tokens.text.tertiary, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10 }}>{label}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>{children}</div>
    </div>
  )
}

function PlusIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
}
function ArrowIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
}
function SearchIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
}
