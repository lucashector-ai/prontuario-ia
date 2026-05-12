'use client'

import { useEffect, useState } from 'react'
import { tokens } from '@/lib/design-tokens'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { FadeIn } from '@/components/motion/FadeIn'
import { useToast } from '@/components/Toast'
import { useClinicaId } from '@/lib/financeiro/clinica'
import { listarCampanhas, salvarCampanha } from '@/lib/crm/queries'
import { CANAL_CAMPANHA, CANAL_LABEL, type Campanha, type CanalCampanha } from '@/lib/crm/types'
import { dataBR } from '@/lib/financeiro/format'

const STATUS_VARIANT: Record<Campanha['status'], 'neutral' | 'warning' | 'success' | 'danger'> = {
  rascunho: 'neutral',
  agendada: 'warning',
  enviada: 'success',
  cancelada: 'danger',
}

const CANAL_VARIANT: Record<CanalCampanha, 'success' | 'info' | 'warning' | 'brand'> = {
  whatsapp: 'success',
  email: 'info',
  sms: 'warning',
  sofia: 'brand',
}

export default function CampanhasPage() {
  const { clinicaId, loading: loadingClinica } = useClinicaId()
  const [campanhas, setCampanhas] = useState<Campanha[]>([])
  const [loading, setLoading] = useState(true)
  const [novaOpen, setNovaOpen] = useState(false)
  const { toast } = useToast()

  async function carregar() {
    if (!clinicaId) return
    setLoading(true)
    setCampanhas(await listarCampanhas(clinicaId))
    setLoading(false)
  }

  useEffect(() => { void carregar() /* eslint-disable-next-line */ }, [clinicaId, loadingClinica])

  return (
    <FadeIn>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
        <div>
          <span style={{ fontSize: 12, fontWeight: 600, color: tokens.brand.primary, letterSpacing: 0.6, textTransform: 'uppercase' }}>CRM</span>
          <h1 style={{ margin: '8px 0 0', fontSize: 28, fontWeight: 700, letterSpacing: -0.5, color: tokens.text.primary }}>Campanhas</h1>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: tokens.text.secondary }}>
            Segmentos + mensagem. Envio real depende do canal (Sofia/WhatsApp Business) — TODO no Sprint 6.
          </p>
        </div>
        <Button onClick={() => setNovaOpen(true)} leftIcon={<PlusIcon />}>Nova campanha</Button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[0, 1].map((i) => <Skeleton key={i} height={120} style={{ borderRadius: tokens.radius['3xl'] }} />)}
        </div>
      ) : campanhas.length === 0 ? (
        <Card variant="elevated">
          <div style={{ padding: '40px 20px', textAlign: 'center', color: tokens.text.tertiary, fontSize: 14 }}>
            Nenhuma campanha ainda.
          </div>
        </Card>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12 }}>
          {campanhas.map((c) => <CampanhaCard key={c.id} campanha={c} />)}
        </div>
      )}

      <NovaCampanhaModal
        open={novaOpen}
        onClose={() => setNovaOpen(false)}
        onSaved={() => { setNovaOpen(false); toast('Campanha salva como rascunho.', 'success'); void carregar() }}
        clinicaId={clinicaId}
      />
    </FadeIn>
  )
}

function CampanhaCard({ campanha }: { campanha: Campanha }) {
  const segmento = campanha.segmento as Record<string, any>
  const segmentoLabels = Object.entries(segmento)
    .filter(([_, v]) => v)
    .map(([k]) => SEGMENTO_LABEL[k] || k)

  return (
    <Card variant="elevated">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: tokens.text.primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {campanha.nome}
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
            <Badge variant={CANAL_VARIANT[campanha.canal]} size="sm">{CANAL_LABEL[campanha.canal]}</Badge>
            <Badge variant={STATUS_VARIANT[campanha.status]} size="sm" dot>{campanha.status}</Badge>
          </div>
        </div>
      </div>

      {segmentoLabels.length > 0 && (
        <div style={{ fontSize: 12, color: tokens.text.tertiary, marginBottom: 10 }}>
          Segmento: <strong style={{ color: tokens.text.strong, fontWeight: 500 }}>{segmentoLabels.join(' · ')}</strong>
        </div>
      )}

      <div style={{
        background: tokens.bg.cardSubtle, padding: 12, borderRadius: tokens.radius.lg,
        fontSize: 13, color: tokens.text.strong, lineHeight: 1.5,
        display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        marginBottom: 10,
      }}>
        {campanha.mensagem_template}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: tokens.text.tertiary }}>
        <span>
          {campanha.enviada_em ? `Enviada ${dataBR(campanha.enviada_em)}` :
           campanha.agendada_para ? `Agendada ${dataBR(campanha.agendada_para)}` :
           'Rascunho'}
        </span>
        {campanha.destinatarios_total > 0 && (
          <span><strong style={{ color: tokens.text.strong, fontWeight: 600 }}>{campanha.destinatarios_alcancados}</strong> de {campanha.destinatarios_total}</span>
        )}
      </div>
    </Card>
  )
}

const SEGMENTO_LABEL: Record<string, string> = {
  aniversariantes_mes: 'Aniversariantes do mês',
  sem_consulta_3_meses: 'Sem consulta há 3+ meses',
  sem_consulta_6_meses: 'Sem consulta há 6+ meses',
  status_lead_novo: 'Status: novo',
  status_lead_qualificado: 'Status: qualificado',
  todos_pacientes: 'Todos os pacientes',
}

function NovaCampanhaModal({ open, onClose, onSaved, clinicaId }: { open: boolean; onClose: () => void; onSaved: () => void; clinicaId: string | null }) {
  const [form, setForm] = useState({
    nome: '',
    canal: 'whatsapp' as CanalCampanha,
    mensagem: '',
    agendadaPara: '',
    segmento: {} as Record<string, boolean>,
  })
  const [salvando, setSalvando] = useState(false)
  const { toast } = useToast()

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (!clinicaId || !form.nome.trim() || !form.mensagem.trim()) {
      toast('Nome e mensagem são obrigatórios.', 'error')
      return
    }
    setSalvando(true)
    const c = await salvarCampanha({
      clinica_id: clinicaId,
      nome: form.nome.trim(),
      canal: form.canal,
      mensagem_template: form.mensagem.trim(),
      agendada_para: form.agendadaPara ? new Date(form.agendadaPara).toISOString() : null,
      segmento: form.segmento,
      status: form.agendadaPara ? 'agendada' : 'rascunho',
    })
    setSalvando(false)
    if (!c) { toast('Erro ao salvar.', 'error'); return }
    setForm({ nome: '', canal: 'whatsapp', mensagem: '', agendadaPara: '', segmento: {} })
    onSaved()
  }

  return (
    <Modal
      open={open} onClose={onClose}
      title="Nova campanha"
      size="lg"
      description="Definir segmento, mensagem e canal. Envio efetivo ainda depende da integração com WhatsApp Business / Sofia (Sprint 6)."
      footer={<>
        <Button variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button onClick={salvar} loading={salvando}>Salvar campanha</Button>
      </>}
    >
      <form onSubmit={salvar} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Input label="Nome interno" value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} placeholder="Reativação de pacientes — Mai/26" required />

        <div>
          <div style={{ fontSize: 13, fontWeight: 500, color: tokens.text.strong, marginBottom: 8 }}>Canal</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {CANAL_CAMPANHA.map((c) => {
              const active = form.canal === c
              return (
                <button
                  key={c} type="button"
                  onClick={() => setForm((f) => ({ ...f, canal: c }))}
                  style={{
                    padding: '6px 12px', fontSize: 13, fontWeight: active ? 600 : 500,
                    color: active ? tokens.text.inverse : tokens.text.strong,
                    background: active ? tokens.brand.primary : tokens.bg.cardSubtle,
                    border: 'none', borderRadius: 999, cursor: 'pointer',
                  }}
                >
                  {CANAL_LABEL[c]}
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <div style={{ fontSize: 13, fontWeight: 500, color: tokens.text.strong, marginBottom: 8 }}>Segmento</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {Object.entries(SEGMENTO_LABEL).map(([k, label]) => (
              <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: tokens.text.primary, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={!!form.segmento[k]}
                  onChange={(e) => setForm((f) => ({ ...f, segmento: { ...f.segmento, [k]: e.target.checked } }))}
                />
                {label}
              </label>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 13, fontWeight: 500, color: tokens.text.strong }}>
            Mensagem template
            <span style={{ marginLeft: 8, fontWeight: 400, color: tokens.text.tertiary }}>
              Use {'{nome}'} pra personalização.
            </span>
          </label>
          <textarea
            value={form.mensagem}
            onChange={(e) => setForm((f) => ({ ...f, mensagem: e.target.value }))}
            rows={5}
            placeholder="Oi {nome}! Faz um tempo que não te vemos por aqui. Que tal agendar uma consulta de retorno?"
            style={{
              padding: 12, border: `1px solid ${tokens.border.default}`, borderRadius: tokens.radius.lg,
              fontSize: 14, fontFamily: 'inherit', outline: 'none', resize: 'vertical', minHeight: 100,
            }}
          />
        </div>

        <Input
          label="Agendar para (opcional)"
          type="datetime-local"
          value={form.agendadaPara}
          onChange={(e) => setForm((f) => ({ ...f, agendadaPara: e.target.value }))}
          hint="Deixe em branco pra salvar como rascunho."
        />
      </form>
    </Modal>
  )
}

function PlusIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> }
