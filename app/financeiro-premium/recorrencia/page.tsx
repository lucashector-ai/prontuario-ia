'use client'

import { useEffect, useState } from 'react'
import { tokens } from '@/lib/design-tokens'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Tabs } from '@/components/ui/Tabs'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { FadeIn } from '@/components/motion/FadeIn'
import { useToast } from '@/components/Toast'
import { useClinicaId } from '@/lib/financeiro/clinica'
import { listarPlanos } from '@/lib/financeiro/queries'
import { supabase } from '@/lib/supabase'
import type { PlanoRecorrente } from '@/lib/financeiro/types'
import { dataBR, moeda } from '@/lib/financeiro/format'

const STATUS_VARIANT: Record<PlanoRecorrente['status'], 'success' | 'warning' | 'danger' | 'neutral' | 'brand'> = {
  ativo: 'brand',
  pausado: 'warning',
  concluido: 'success',
  cancelado: 'neutral',
}

export default function RecorrenciaPage() {
  const { clinicaId, loading: loadingClinica } = useClinicaId()
  const [planos, setPlanos] = useState<PlanoRecorrente[]>([])
  const [tab, setTab] = useState<'ativo' | 'todos'>('ativo')
  const [loading, setLoading] = useState(true)
  const [novoOpen, setNovoOpen] = useState(false)
  const [form, setForm] = useState({ nome: '', valorMensal: '', parcelas: '12', emailPaciente: '' })
  const [salvando, setSalvando] = useState(false)
  const { toast } = useToast()

  async function carregar() {
    if (!clinicaId) return
    setLoading(true)
    const list = await listarPlanos(clinicaId, tab)
    setPlanos(list)
    setLoading(false)
  }

  useEffect(() => { void carregar() /* eslint-disable-next-line */ }, [clinicaId, tab, loadingClinica])

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (!clinicaId) return
    const valorNum = Number(form.valorMensal.replace(',', '.'))
    const parcelas = Number(form.parcelas)
    if (!form.nome.trim() || !valorNum || valorNum <= 0 || !parcelas || parcelas <= 0) {
      toast('Preencha nome, valor e parcelas válidos.', 'error')
      return
    }
    setSalvando(true)

    const { data: paciente } = await supabase
      .from('pacientes')
      .select('id')
      .ilike('email', form.emailPaciente.trim())
      .maybeSingle()

    if (!paciente) {
      toast('Paciente com esse email não encontrado.', 'error')
      setSalvando(false)
      return
    }

    const proxVenc = new Date()
    proxVenc.setMonth(proxVenc.getMonth() + 1)

    const { error } = await supabase
      .from('financeiro_planos_recorrentes')
      .insert({
        clinica_id: clinicaId,
        paciente_id: paciente.id,
        nome: form.nome.trim(),
        valor_mensal: valorNum,
        parcelas_total: parcelas,
        parcelas_pagas: 0,
        iniciado_em: new Date().toISOString().split('T')[0],
        proximo_vencimento: proxVenc.toISOString().split('T')[0],
        status: 'ativo',
      })

    setSalvando(false)
    if (error) {
      toast('Erro ao criar plano.', 'error')
      return
    }
    setNovoOpen(false)
    setForm({ nome: '', valorMensal: '', parcelas: '12', emailPaciente: '' })
    toast('Plano recorrente criado.', 'success')
    void carregar()
  }

  return (
    <FadeIn>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
        <div>
          <span style={{ fontSize: 12, fontWeight: 600, color: tokens.brand.primary, letterSpacing: 0.6, textTransform: 'uppercase' }}>Financeiro</span>
          <h1 style={{ margin: '8px 0 0', fontSize: 28, fontWeight: 700, letterSpacing: -0.5, color: tokens.text.primary }}>Planos recorrentes</h1>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: tokens.text.secondary }}>
            Assinaturas mensais — protocolos de longa duração com cobrança automática.
          </p>
        </div>
        <Button onClick={() => setNovoOpen(true)} leftIcon={<PlusIcon />}>Novo plano</Button>
      </div>

      <div style={{ marginBottom: 16 }}>
        <Tabs
          items={[{ value: 'ativo', label: 'Ativos' }, { value: 'todos', label: 'Todos' }]}
          value={tab}
          onChange={(v) => setTab(v as typeof tab)}
        />
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[0, 1].map((i) => <Skeleton key={i} height={140} style={{ borderRadius: tokens.radius['3xl'] }} />)}
        </div>
      ) : planos.length === 0 ? (
        <Card variant="elevated">
          <div style={{ padding: '40px 20px', textAlign: 'center', color: tokens.text.tertiary, fontSize: 14 }}>
            Nenhum plano nessa categoria.
          </div>
        </Card>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>
          {planos.map((p) => {
            const progresso = Math.round((p.parcelas_pagas / p.parcelas_total) * 100)
            const restante = (p.parcelas_total - p.parcelas_pagas) * p.valor_mensal
            return (
              <Card key={p.id} variant="elevated">
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 16, fontWeight: 600, color: tokens.text.primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nome}</div>
                    <div style={{ fontSize: 12, color: tokens.text.tertiary, marginTop: 2 }}>{p.pacientes?.nome || 'Paciente'}</div>
                  </div>
                  <Badge variant={STATUS_VARIANT[p.status]} size="sm">{p.status}</Badge>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                  <span style={{ color: tokens.text.secondary }}>{p.parcelas_pagas} de {p.parcelas_total} parcelas</span>
                  <span style={{ color: tokens.text.strong, fontWeight: 600 }}>{progresso}%</span>
                </div>

                <div style={{ height: 6, background: tokens.bg.cardSubtle, borderRadius: 999, overflow: 'hidden', marginBottom: 14 }}>
                  <div style={{
                    width: `${progresso}%`,
                    height: '100%',
                    background: `linear-gradient(90deg, ${tokens.brand.primary}, ${tokens.brand.primaryDarker})`,
                    transition: 'width 400ms ease',
                  }} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, fontSize: 12 }}>
                  <Mini titulo="Mensal"     valor={moeda(p.valor_mensal)} />
                  <Mini titulo="A receber"  valor={moeda(restante)} />
                  <Mini titulo="Próx. venc" valor={dataBR(p.proximo_vencimento)} />
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <Modal
        open={novoOpen}
        onClose={() => setNovoOpen(false)}
        title="Novo plano recorrente"
        description="Cria assinatura mensal vinculada ao paciente. Geração de cobrança automática depende do gateway de Pix (Sprint 6)."
        footer={<>
          <Button variant="secondary" onClick={() => setNovoOpen(false)}>Cancelar</Button>
          <Button onClick={salvar} loading={salvando}>Criar plano</Button>
        </>}
      >
        <form onSubmit={salvar} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Input label="Nome do plano" value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} placeholder="Protocolo de emagrecimento — 6 meses" required />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Input label="Valor mensal (R$)" value={form.valorMensal} onChange={(e) => setForm((f) => ({ ...f, valorMensal: e.target.value }))} placeholder="450,00" inputMode="decimal" required />
            <Input label="Parcelas" value={form.parcelas} onChange={(e) => setForm((f) => ({ ...f, parcelas: e.target.value }))} placeholder="12" inputMode="numeric" required />
          </div>
          <Input label="Email do paciente" value={form.emailPaciente} onChange={(e) => setForm((f) => ({ ...f, emailPaciente: e.target.value }))} placeholder="paciente@email.com" required />
        </form>
      </Modal>
    </FadeIn>
  )
}

function Mini({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div>
      <div style={{ color: tokens.text.tertiary, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>{titulo}</div>
      <div style={{ color: tokens.text.primary, fontWeight: 600, fontSize: 13 }}>{valor}</div>
    </div>
  )
}

function PlusIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
}
