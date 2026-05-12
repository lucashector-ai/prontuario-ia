'use client'

import { useEffect, useMemo, useState } from 'react'
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
import { atualizarLead, atualizarStatusLead, criarLead, listarLeads } from '@/lib/crm/queries'
import {
  ORIGEM_LEAD,
  ORIGEM_LEAD_LABEL,
  STATUS_LEAD,
  STATUS_LEAD_LABEL,
  type Lead,
  type StatusLead,
  type OrigemLead,
} from '@/lib/crm/types'
import { formatRelativo } from '@/lib/portal/format'

const COLUNA_COR: Record<StatusLead, string> = {
  novo: tokens.status.info,
  qualificado: tokens.brand.primary,
  agendado: tokens.brand.primaryDarker,
  atendido: tokens.status.success,
  perdido: tokens.text.tertiary,
}

const ORIGEM_VARIANT: Record<OrigemLead, 'brand' | 'info' | 'warning' | 'success' | 'neutral' | 'danger'> = {
  instagram: 'danger',
  indicacao: 'success',
  doctoralia: 'info',
  site: 'brand',
  whatsapp: 'success',
  google: 'warning',
  outro: 'neutral',
}

export default function KanbanLeadsPage() {
  const { clinicaId, loading: loadingClinica } = useClinicaId()
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [novoOpen, setNovoOpen] = useState(false)
  const [editando, setEditando] = useState<Lead | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [overCol, setOverCol] = useState<StatusLead | null>(null)
  const { toast } = useToast()

  async function carregar() {
    if (!clinicaId) return
    setLoading(true)
    setLeads(await listarLeads(clinicaId))
    setLoading(false)
  }

  useEffect(() => { void carregar() /* eslint-disable-next-line */ }, [clinicaId, loadingClinica])

  const porStatus = useMemo(() => {
    const map: Record<StatusLead, Lead[]> = { novo: [], qualificado: [], agendado: [], atendido: [], perdido: [] }
    for (const l of leads) map[l.status].push(l)
    return map
  }, [leads])

  async function moverLead(leadId: string, novoStatus: StatusLead) {
    const lead = leads.find((l) => l.id === leadId)
    if (!lead || lead.status === novoStatus) return

    // optimistic
    setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, status: novoStatus, atualizado_em: new Date().toISOString() } : l)))
    await atualizarStatusLead(leadId, novoStatus)
    toast(`Lead movido para "${STATUS_LEAD_LABEL[novoStatus]}".`, 'success')
  }

  return (
    <FadeIn>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
        <div>
          <span style={{ fontSize: 12, fontWeight: 600, color: tokens.brand.primary, letterSpacing: 0.6, textTransform: 'uppercase' }}>CRM</span>
          <h1 style={{ margin: '8px 0 0', fontSize: 28, fontWeight: 700, letterSpacing: -0.5, color: tokens.text.primary }}>Funil de leads</h1>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: tokens.text.secondary }}>
            Arraste cards entre colunas pra mover o lead no funil.
          </p>
        </div>
        <Button onClick={() => setNovoOpen(true)} leftIcon={<PlusIcon />}>Novo lead</Button>
      </div>

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 12 }}>
          {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} height={400} style={{ borderRadius: tokens.radius['3xl'] }} />)}
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8 }}>
          {STATUS_LEAD.map((status) => (
            <Coluna
              key={status}
              status={status}
              leads={porStatus[status]}
              hovering={overCol === status}
              onDragEnter={() => setOverCol(status)}
              onDragLeave={() => setOverCol((cur) => (cur === status ? null : cur))}
              onDrop={(leadId) => { setOverCol(null); setDragId(null); void moverLead(leadId, status) }}
              onCardClick={setEditando}
              onCardDragStart={setDragId}
              draggingId={dragId}
            />
          ))}
        </div>
      )}

      <NovoLeadModal
        open={novoOpen}
        onClose={() => setNovoOpen(false)}
        onSaved={() => { setNovoOpen(false); toast('Lead criado.', 'success'); void carregar() }}
        clinicaId={clinicaId}
      />
      <EditarLeadModal
        open={!!editando}
        onClose={() => setEditando(null)}
        lead={editando}
        onSaved={() => { setEditando(null); toast('Lead atualizado.', 'success'); void carregar() }}
      />
    </FadeIn>
  )
}

function Coluna({
  status, leads, hovering, onDragEnter, onDragLeave, onDrop, onCardClick, onCardDragStart, draggingId,
}: {
  status: StatusLead; leads: Lead[]; hovering: boolean
  onDragEnter: () => void; onDragLeave: () => void; onDrop: (id: string) => void
  onCardClick: (l: Lead) => void
  onCardDragStart: (id: string | null) => void
  draggingId: string | null
}) {
  const cor = COLUNA_COR[status]
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); onDragEnter() }}
      onDragLeave={onDragLeave}
      onDrop={(e) => {
        e.preventDefault()
        const id = e.dataTransfer.getData('text/plain')
        if (id) onDrop(id)
      }}
      style={{
        flex: '0 0 280px',
        background: hovering ? tokens.brand.primaryLighter : tokens.bg.muted,
        borderRadius: tokens.radius['2xl'],
        padding: 12,
        border: `1px solid ${hovering ? tokens.brand.primaryAccent : tokens.border.subtle}`,
        transition: 'background 140ms ease, border-color 140ms ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 8px 12px', borderBottom: `1px solid ${tokens.border.subtle}`, marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span aria-hidden style={{ width: 8, height: 8, borderRadius: '50%', background: cor }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: tokens.text.primary }}>{STATUS_LEAD_LABEL[status]}</span>
        </div>
        <span style={{ fontSize: 12, color: tokens.text.tertiary, fontWeight: 500 }}>{leads.length}</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 200 }}>
        {leads.map((l) => (
          <LeadCard
            key={l.id}
            lead={l}
            dragging={draggingId === l.id}
            onClick={() => onCardClick(l)}
            onDragStart={() => onCardDragStart(l.id)}
            onDragEnd={() => onCardDragStart(null)}
          />
        ))}
        {leads.length === 0 && (
          <div style={{ padding: '20px 8px', textAlign: 'center', color: tokens.text.tertiary, fontSize: 12, lineHeight: 1.5 }}>
            Solte um lead aqui ou aguarde — esta coluna está vazia.
          </div>
        )}
      </div>
    </div>
  )
}

function LeadCard({ lead, dragging, onClick, onDragStart, onDragEnd }: { lead: Lead; dragging: boolean; onClick: () => void; onDragStart: () => void; onDragEnd: () => void }) {
  return (
    <div
      draggable
      onDragStart={(e) => { e.dataTransfer.setData('text/plain', lead.id); e.dataTransfer.effectAllowed = 'move'; onDragStart() }}
      onDragEnd={onDragEnd}
      onClick={onClick}
      style={{
        background: tokens.bg.card,
        border: `1px solid ${tokens.border.subtle}`,
        borderRadius: tokens.radius.xl,
        padding: 12,
        cursor: 'grab',
        opacity: dragging ? 0.4 : 1,
        boxShadow: tokens.shadow.sm,
        transition: 'opacity 120ms ease, transform 80ms ease',
      }}
      onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.98)' }}
      onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6, marginBottom: 6 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: tokens.text.primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
          {lead.nome}
        </div>
        <Badge size="sm" variant={ORIGEM_VARIANT[lead.origem]}>{ORIGEM_LEAD_LABEL[lead.origem]}</Badge>
      </div>
      {lead.interesse && (
        <div style={{ fontSize: 12, color: tokens.text.secondary, marginBottom: 8, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {lead.interesse}
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: tokens.text.tertiary }}>
        <span>{lead.telefone || lead.email || '—'}</span>
        <span>{formatRelativo(lead.atualizado_em)}</span>
      </div>
    </div>
  )
}

function NovoLeadModal({ open, onClose, onSaved, clinicaId }: { open: boolean; onClose: () => void; onSaved: () => void; clinicaId: string | null }) {
  const [form, setForm] = useState({ nome: '', telefone: '', email: '', origem: 'outro' as OrigemLead, interesse: '' })
  const [salvando, setSalvando] = useState(false)
  const { toast } = useToast()

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (!clinicaId || !form.nome.trim()) { toast('Nome obrigatório.', 'error'); return }
    setSalvando(true)
    await criarLead({
      clinica_id: clinicaId,
      nome: form.nome.trim(),
      telefone: form.telefone.trim() || null,
      email: form.email.trim() || null,
      origem: form.origem,
      interesse: form.interesse.trim() || null,
      status: 'novo',
      observacoes: null,
    })
    setSalvando(false)
    setForm({ nome: '', telefone: '', email: '', origem: 'outro', interesse: '' })
    onSaved()
  }

  return (
    <Modal
      open={open} onClose={onClose}
      title="Novo lead"
      footer={<>
        <Button variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button onClick={salvar} loading={salvando}>Adicionar</Button>
      </>}
    >
      <form onSubmit={salvar} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Input label="Nome" value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} required />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Input label="Telefone" value={form.telefone} onChange={(e) => setForm((f) => ({ ...f, telefone: e.target.value }))} placeholder="(11) 99999-9999" />
          <Input label="Email" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 13, fontWeight: 500, color: tokens.text.strong }}>Origem</label>
          <select
            value={form.origem}
            onChange={(e) => setForm((f) => ({ ...f, origem: e.target.value as OrigemLead }))}
            style={{
              height: 42, padding: '0 12px',
              border: `1px solid ${tokens.border.default}`, borderRadius: tokens.radius.lg,
              fontSize: 14, background: tokens.bg.card, color: tokens.text.primary,
            }}
          >
            {ORIGEM_LEAD.map((o) => <option key={o} value={o}>{ORIGEM_LEAD_LABEL[o]}</option>)}
          </select>
        </div>
        <Input label="Interesse" value={form.interesse} onChange={(e) => setForm((f) => ({ ...f, interesse: e.target.value }))} placeholder="Botox, consulta avaliação, etc." />
      </form>
    </Modal>
  )
}

function EditarLeadModal({ open, onClose, lead, onSaved }: { open: boolean; onClose: () => void; lead: Lead | null; onSaved: () => void }) {
  const [form, setForm] = useState({ nome: '', telefone: '', email: '', interesse: '', observacoes: '', origem: 'outro' as OrigemLead })
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (lead) {
      setForm({
        nome: lead.nome,
        telefone: lead.telefone || '',
        email: lead.email || '',
        interesse: lead.interesse || '',
        observacoes: lead.observacoes || '',
        origem: lead.origem,
      })
    }
  }, [lead])

  if (!lead) return null

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (!lead) return
    setSalvando(true)
    await atualizarLead(lead.id, {
      nome: form.nome.trim(),
      telefone: form.telefone.trim() || null,
      email: form.email.trim() || null,
      interesse: form.interesse.trim() || null,
      observacoes: form.observacoes.trim() || null,
      origem: form.origem,
    })
    setSalvando(false)
    onSaved()
  }

  return (
    <Modal
      open={open} onClose={onClose}
      title="Editar lead"
      description={`Status: ${STATUS_LEAD_LABEL[lead.status]} · Origem: ${ORIGEM_LEAD_LABEL[lead.origem]}`}
      footer={<>
        <Button variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button onClick={salvar} loading={salvando}>Salvar</Button>
      </>}
    >
      <form onSubmit={salvar} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Input label="Nome" value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} required />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Input label="Telefone" value={form.telefone} onChange={(e) => setForm((f) => ({ ...f, telefone: e.target.value }))} />
          <Input label="Email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
        </div>
        <Input label="Interesse" value={form.interesse} onChange={(e) => setForm((f) => ({ ...f, interesse: e.target.value }))} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 13, fontWeight: 500, color: tokens.text.strong }}>Observações</label>
          <textarea
            value={form.observacoes}
            onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))}
            rows={4}
            style={{
              padding: 12, border: `1px solid ${tokens.border.default}`, borderRadius: tokens.radius.lg,
              fontSize: 14, fontFamily: 'inherit', outline: 'none', resize: 'vertical', minHeight: 90,
            }}
          />
        </div>
      </form>
    </Modal>
  )
}

function PlusIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> }
