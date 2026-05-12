'use client'

import { useEffect, useState } from 'react'
import { tokens } from '@/lib/design-tokens'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { Tabs } from '@/components/ui/Tabs'
import { Skeleton } from '@/components/ui/Skeleton'
import { FadeIn } from '@/components/motion/FadeIn'
import { useToast } from '@/components/Toast'
import { useClinicaId } from '@/lib/financeiro/clinica'
import { listarPix } from '@/lib/financeiro/queries'
import { supabase } from '@/lib/supabase'
import type { PixCobranca } from '@/lib/financeiro/types'
import { dataBR, moeda } from '@/lib/financeiro/format'

const STATUS_VARIANT: Record<PixCobranca['status'], 'success' | 'warning' | 'danger' | 'neutral'> = {
  pago: 'success',
  pendente: 'warning',
  expirado: 'danger',
  cancelado: 'neutral',
}

export default function PixPage() {
  const { clinicaId, loading: loadingClinica } = useClinicaId()
  const [cobs, setCobs] = useState<PixCobranca[]>([])
  const [tab, setTab] = useState<'pendente' | 'pago' | 'todos'>('pendente')
  const [loading, setLoading] = useState(true)
  const [novoOpen, setNovoOpen] = useState(false)
  const [verOpen, setVerOpen] = useState<PixCobranca | null>(null)
  const { toast } = useToast()

  // form nova cobrança
  const [valor, setValor] = useState('')
  const [descricao, setDescricao] = useState('')
  const [emailPaciente, setEmailPaciente] = useState('')
  const [gerando, setGerando] = useState(false)

  async function carregar() {
    if (!clinicaId) return
    setLoading(true)
    const list = await listarPix(clinicaId, tab)
    setCobs(list)
    setLoading(false)
  }

  useEffect(() => { void carregar() /* eslint-disable-next-line */ }, [clinicaId, tab, loadingClinica])

  async function gerarCobranca(e: React.FormEvent) {
    e.preventDefault()
    if (!clinicaId) return
    const valorNum = Number(valor.replace(',', '.'))
    if (!valorNum || valorNum <= 0) { toast('Valor inválido', 'error'); return }
    setGerando(true)

    // TODO: integrar com Mercado Pago / Asaas / AbacatePay pra emitir QR real
    // Por enquanto: salvamos a cobrança com um TXID fake e um copia-e-cola
    // placeholder. Em prod, isso vira chamada à API do gateway.
    const txid = `MOCK-${Date.now().toString(36).toUpperCase()}`
    const qrCode = `00020126360014BR.GOV.BCB.PIX0114${txid}5204000053039865802BR5913Clinical 36060${valorNum.toFixed(2)}`
    const expira = new Date(Date.now() + 30 * 60 * 1000).toISOString()

    let paciente_id: string | null = null
    if (emailPaciente.trim()) {
      const { data: p } = await supabase
        .from('pacientes')
        .select('id')
        .ilike('email', emailPaciente.trim())
        .maybeSingle()
      if (p) paciente_id = p.id
    }

    const { data, error } = await supabase
      .from('financeiro_pix_cobrancas')
      .insert({
        clinica_id: clinicaId,
        paciente_id,
        valor: valorNum,
        descricao: descricao || null,
        txid,
        qr_code: qrCode,
        status: 'pendente',
        expira_em: expira,
      })
      .select('*, pacientes:paciente_id(nome)')
      .single()

    setGerando(false)
    if (error) {
      toast('Não foi possível gerar a cobrança.', 'error')
      return
    }
    setNovoOpen(false)
    setValor(''); setDescricao(''); setEmailPaciente('')
    setVerOpen(data as PixCobranca)
    void carregar()
    toast('Cobrança Pix gerada (modo mock — sem gateway real).', 'info')
  }

  async function marcarPago(id: string) {
    await supabase
      .from('financeiro_pix_cobrancas')
      .update({ status: 'pago', pago_em: new Date().toISOString() })
      .eq('id', id)
    toast('Marcada como paga.', 'success')
    void carregar()
  }

  return (
    <FadeIn>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
        <div>
          <span style={{ fontSize: 12, fontWeight: 600, color: tokens.brand.primary, letterSpacing: 0.6, textTransform: 'uppercase' }}>Financeiro</span>
          <h1 style={{ margin: '8px 0 0', fontSize: 28, fontWeight: 700, letterSpacing: -0.5, color: tokens.text.primary }}>Cobranças Pix</h1>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: tokens.text.secondary }}>
            Gere QR Code on-demand. Integração com gateway de pagamento real é TODO.
          </p>
        </div>
        <Button onClick={() => setNovoOpen(true)} leftIcon={<PlusIcon />}>Nova cobrança</Button>
      </div>

      <div style={{ marginBottom: 16 }}>
        <Tabs
          items={[
            { value: 'pendente', label: 'Pendentes' },
            { value: 'pago',     label: 'Pagos' },
            { value: 'todos',    label: 'Todos' },
          ]}
          value={tab}
          onChange={(v) => setTab(v as typeof tab)}
        />
      </div>

      <Card variant="elevated" padding={0}>
        {loading ? (
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[0, 1, 2].map((i) => <Skeleton key={i} height={56} />)}
          </div>
        ) : cobs.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: tokens.text.tertiary, fontSize: 14 }}>
            Nenhuma cobrança encontrada.
          </div>
        ) : (
          <div>
            {cobs.map((c, i) => (
              <div
                key={c.id}
                onClick={() => setVerOpen(c)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  gap: 12, padding: '14px 20px',
                  borderTop: i === 0 ? 'none' : `1px solid ${tokens.border.subtle}`,
                  cursor: 'pointer',
                  transition: 'background 120ms ease',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = tokens.bg.hover}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: tokens.text.primary, marginBottom: 3 }}>
                    {moeda(c.valor)} {c.descricao && <span style={{ fontWeight: 400, color: tokens.text.secondary }}>· {c.descricao}</span>}
                  </div>
                  <div style={{ fontSize: 12, color: tokens.text.tertiary }}>
                    {dataBR(c.criada_em)} {c.pacientes?.nome ? ` · ${c.pacientes.nome}` : ''}
                  </div>
                </div>
                <Badge variant={STATUS_VARIANT[c.status]} size="sm" dot>
                  {c.status}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Modal nova cobrança */}
      <Modal
        open={novoOpen}
        onClose={() => setNovoOpen(false)}
        title="Nova cobrança Pix"
        description="Gera QR Code instantâneo. Integração com gateway é TODO — agora salva mock no banco."
        footer={<>
          <Button variant="secondary" onClick={() => setNovoOpen(false)}>Cancelar</Button>
          <Button onClick={gerarCobranca} loading={gerando}>Gerar QR</Button>
        </>}
      >
        <form onSubmit={gerarCobranca} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Input label="Valor (R$)" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="180,00" inputMode="decimal" required />
          <Input label="Descrição" value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Consulta · Dr. João" />
          <Input label="Email do paciente (opcional)" value={emailPaciente} onChange={(e) => setEmailPaciente(e.target.value)} placeholder="paciente@email.com" hint="Vincula a cobrança ao paciente se encontrar." />
        </form>
      </Modal>

      {/* Modal ver cobrança */}
      {verOpen && (
        <Modal
          open={!!verOpen}
          onClose={() => setVerOpen(null)}
          title="Cobrança Pix"
          size="md"
          footer={<>
            <Button variant="secondary" onClick={() => setVerOpen(null)}>Fechar</Button>
            {verOpen.status === 'pendente' && (
              <Button variant="secondary" onClick={() => { marcarPago(verOpen!.id); setVerOpen(null) }}>Marcar como paga</Button>
            )}
            <Button onClick={() => { navigator.clipboard?.writeText(verOpen!.qr_code || ''); toast('Código Pix copiado', 'success') }}>Copiar código</Button>
          </>}
        >
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: 220, height: 220,
              margin: '0 auto 16px',
              background: tokens.bg.cardSubtle,
              borderRadius: tokens.radius.xl,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <QrPlaceholder />
            </div>
            <div style={{ fontSize: 30, fontWeight: 700, color: tokens.text.primary, marginBottom: 4 }}>{moeda(verOpen.valor)}</div>
            <div style={{ fontSize: 13, color: tokens.text.tertiary, marginBottom: 16 }}>
              {verOpen.descricao || 'Cobrança avulsa'}
            </div>
            <div style={{
              background: tokens.bg.cardSubtle,
              padding: '10px 14px',
              borderRadius: tokens.radius.md,
              fontSize: 11,
              fontFamily: 'ui-monospace, SF Mono, monospace',
              color: tokens.text.strong,
              wordBreak: 'break-all',
              textAlign: 'left',
            }}>
              {verOpen.qr_code}
            </div>
          </div>
        </Modal>
      )}
    </FadeIn>
  )
}

function PlusIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
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
