'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Send, Inbox, ChevronRight } from 'lucide-react'
import { tokens } from '@/lib/design-tokens'
import { supabase } from '@/lib/supabase'
import { Avatar, Badge, Card, EmptyState, Icon, SegmentedControl, type BadgeTone } from '@/components/ui'

const T = tokens

type Envio = {
  id: string
  nome_paciente: string
  telefone: string | null
  status: string
  enviado_em: string
  preenchido_em: string | null
  expira_em: string
  origem: string
  template: { nome: string } | null
}

const STATUS_LABEL: Record<string, { label: string; tone: BadgeTone }> = {
  pendente: { label: 'Aguardando resposta', tone: 'pending' },
  preenchido: { label: 'Preenchido', tone: 'success' },
  expirado: { label: 'Expirado', tone: 'neutral' },
  cancelado: { label: 'Cancelado', tone: 'danger' },
}

const ORIGEM_LABEL: Record<string, string> = {
  manual: 'Envio manual',
  agenda_publica: 'Via agenda pública',
  agendamento_interno: 'Via agendamento',
}

type FiltroStatus = 'todos' | 'pendente' | 'preenchido' | 'expirado'

export default function ListaEnvios({ clinicaId }: { clinicaId: string }) {
  const router = useRouter()
  const [envios, setEnvios] = useState<Envio[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>('todos')

  useEffect(() => {
    async function carregar() {
      setLoading(true)
      try {
        const { data } = await supabase
          .from('formularios_envios')
          .select(`
            id, nome_paciente, telefone, status, enviado_em, preenchido_em,
            expira_em, origem,
            template:formularios_templates(nome)
          `)
          .eq('clinica_id', clinicaId)
          .order('enviado_em', { ascending: false })
          .limit(200)
        setEnvios((data || []) as any)
      } finally {
        setLoading(false)
      }
    }
    carregar()
  }, [clinicaId])

  const filtrados = filtroStatus === 'todos'
    ? envios
    : envios.filter(e => e.status === filtroStatus)

  const contadores: Record<FiltroStatus, number> = {
    todos: envios.length,
    pendente: envios.filter(e => e.status === 'pendente').length,
    preenchido: envios.filter(e => e.status === 'preenchido').length,
    expirado: envios.filter(e => e.status === 'expirado').length,
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[0, 1, 2, 3].map(i => <div key={i} className="c360-skel" style={{ height: 64, borderRadius: 12 }} />)}
      </div>
    )
  }

  if (envios.length === 0) {
    return (
      <Card padding={0}>
        <EmptyState
          icon={Send}
          titulo="Nenhum envio ainda"
          descricao="Quando você enviar formulários para pacientes, eles aparecem aqui."
        />
      </Card>
    )
  }

  const rotulo = (k: FiltroStatus, l: string) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      {l}
      <span style={{ fontSize: 11, fontWeight: 700, color: T.text.tertiary, fontVariantNumeric: 'tabular-nums' }}>{contadores[k]}</span>
    </span>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Filtros */}
      <div style={{ maxWidth: '100%', overflowX: 'auto', scrollbarWidth: 'none' }}>
        <SegmentedControl<FiltroStatus>
          value={filtroStatus}
          onChange={setFiltroStatus}
          options={[
            { value: 'todos', label: rotulo('todos', 'Todos') },
            { value: 'pendente', label: rotulo('pendente', 'Aguardando') },
            { value: 'preenchido', label: rotulo('preenchido', 'Preenchidos') },
            { value: 'expirado', label: rotulo('expirado', 'Expirados') },
          ]}
        />
      </div>

      {/* Lista */}
      <div style={{ border: `1px solid ${T.border.default}`, borderRadius: 16, overflow: 'hidden', background: '#fff' }}>
        {filtrados.length === 0 ? (
          <EmptyState icon={Inbox} titulo="Nenhum envio com esse filtro" />
        ) : (
          filtrados.map((e, idx) => {
            const statusInfo = STATUS_LABEL[e.status] || STATUS_LABEL.pendente
            const clicavel = e.status === 'preenchido'
            return (
              <div
                key={e.id}
                onClick={() => clicavel && router.push('/formularios/respostas/' + e.id)}
                style={{
                  padding: '14px 18px',
                  borderTop: idx === 0 ? 'none' : '1px solid ' + T.border.muted,
                  cursor: clicavel ? 'pointer' : 'default',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  transition: 'background 0.12s',
                }}
                onMouseEnter={(ev) => { if (clicavel) ev.currentTarget.style.background = T.bg.hover }}
                onMouseLeave={(ev) => { ev.currentTarget.style.background = 'transparent' }}
              >
                <Avatar nome={e.nome_paciente} size={36} />
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: T.text.primary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {e.nome_paciente}
                  </span>
                  <span style={{ fontSize: 12.5, color: T.text.secondary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {e.template?.nome || 'Formulário'} · {ORIGEM_LABEL[e.origem] || e.origem}
                  </span>
                  <span style={{ fontSize: 11.5, color: T.text.tertiary }}>
                    Enviado em <span className="mono">{formatarData(e.enviado_em)}</span>
                    {e.preenchido_em && <> · Respondido em <span className="mono">{formatarData(e.preenchido_em)}</span></>}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                  <Badge tone={statusInfo.tone} dot>{statusInfo.label}</Badge>
                  {clicavel && <Icon icon={ChevronRight} size={16} color={T.text.tertiary} />}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

function formatarData(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch {
    return iso
  }
}
