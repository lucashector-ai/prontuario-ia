'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, Stethoscope, Bot, Zap, ShieldCheck, Plug, MonitorPlay } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { VisaoGeral } from '@/components/minha-clinica/VisaoGeral'
import { Procedimentos } from '@/components/minha-clinica/Procedimentos'
import { Lgpd } from '@/components/minha-clinica/Lgpd'
import { Automacoes } from '@/components/minha-clinica/Automacoes'
import PainelAuditoria from '@/components/auditoria/PainelAuditoria'
import ConectarCanais from '@/components/canais/ConectarCanais'
import { Sofia } from '@/components/minha-clinica/Sofia'
import ConfigAtendimento from '@/components/atendimento/ConfigAtendimento'
import { Icon, PageHeader, Tabs } from '@/components/ui'

type TabKey = 'visao' | 'atendimento' | 'canais' | 'procedimentos' | 'sofia' | 'automacoes' | 'lgpd'

const TABS: Array<{ key: TabKey; label: string; icon: LucideIcon }> = [
  { key: 'visao', label: 'Visão geral', icon: Building2 },
  { key: 'atendimento', label: 'Recepção e painel', icon: MonitorPlay },
  { key: 'canais', label: 'Canais', icon: Plug },
  { key: 'procedimentos', label: 'Procedimentos', icon: Stethoscope },
  { key: 'sofia', label: 'Sofia · IA', icon: Bot },
  { key: 'automacoes', label: 'Automações', icon: Zap },
  { key: 'lgpd', label: 'Privacidade & LGPD', icon: ShieldCheck },
]

export default function MinhaClinicaPage() {
  const router = useRouter()
  const [tab, setTab] = useState<TabKey>('visao')

  // Abre direto numa aba: /minha-clinica?aba=atendimento|canais|procedimentos|sofia|automacoes|lgpd
  useEffect(() => {
    const aba = new URLSearchParams(window.location.search).get('aba') as TabKey | null
    if (aba && ['visao', 'atendimento', 'canais', 'procedimentos', 'sofia', 'automacoes', 'lgpd'].includes(aba)) setTab(aba)
  }, [])

  useEffect(() => {
    const ca_ = localStorage.getItem('clinica_admin')
    const m = ca_ || localStorage.getItem('medico')
    if (!m) { router.push('/login'); return }
  }, [router])

  return (
    <div style={{ minHeight: '100%', padding: 20 }}>
      <PageHeader titulo="Minha clínica" descricao="Dados, equipe, automações e privacidade — tudo no mesmo lugar" />

      <Tabs
        style={{ overflowX: 'auto', flexWrap: 'nowrap', marginBottom: 18 }}
        ativa={tab}
        onChange={(id) => setTab(id as TabKey)}
        tabs={TABS.map(t => ({ id: t.key, label: t.label, icon: <Icon icon={t.icon} size={15} /> }))}
      />

      {tab === 'visao' && <VisaoGeral />}
      {tab === 'atendimento' && <ConfigAtendimento />}
      {tab === 'canais' && <ConectarCanais />}
      {tab === 'procedimentos' && <Procedimentos />}
      {tab === 'sofia' && <Sofia />}
      {tab === 'automacoes' && <Automacoes />}
      {tab === 'lgpd' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          <Lgpd />
          <PainelAuditoria />
        </div>
      )}
    </div>
  )
}
