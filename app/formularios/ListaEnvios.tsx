'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { tokens } from '@/lib/design-tokens'
import { supabase } from '@/lib/supabase'

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

const STATUS_LABEL: Record<string, { label: string; cor: string; bg: string }> = {
  pendente: { label: 'Aguardando resposta', cor: '#D97706', bg: '#FEF3C7' },
  preenchido: { label: 'Preenchido', cor: '#059669', bg: '#D1FAE5' },
  expirado: { label: 'Expirado', cor: '#6B7280', bg: '#F3F4F6' },
  cancelado: { label: 'Cancelado', cor: '#DC2626', bg: '#FEE2E2' },
}

const ORIGEM_LABEL: Record<string, string> = {
  manual: 'Envio manual',
  agenda_publica: 'Via agenda pública',
  agendamento_interno: 'Via agendamento',
}

export default function ListaEnvios({ clinicaId }: { clinicaId: string }) {
  const router = useRouter()
  const [envios, setEnvios] = useState<Envio[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroStatus, setFiltroStatus] = useState<string>('todos')

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

  const contadores = {
    todos: envios.length,
    pendente: envios.filter(e => e.status === 'pendente').length,
    preenchido: envios.filter(e => e.status === 'preenchido').length,
    expirado: envios.filter(e => e.status === 'expirado').length,
  }

  if (loading) {
    return (
      <div style={{ padding: 64, display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: 28, height: 28, border: '2.5px solid ' + tokens.brand.primaryLight, borderTopColor: tokens.brand.primary, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{'@keyframes spin { to { transform: rotate(360deg) } }'}</style>
      </div>
    )
  }

  if (envios.length === 0) {
    return (
      <div style={{
        background: '#fff',
        borderRadius: 16,
        padding: '48px 32px',
        textAlign: 'center',
        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
      }}>
        <div style={{
          width: 56, height: 56, margin: '0 auto 16px',
          background: tokens.brand.primaryLight, color: tokens.brand.primary,
          borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 2L11 13" />
            <path d="M22 2l-7 20-4-9-9-4z" />
          </svg>
        </div>
        <h3 style={{ fontSize: 17, fontWeight: 600, color: tokens.text.primary, margin: '0 0 6px' }}>
          Nenhum envio ainda
        </h3>
        <p style={{ fontSize: 14, color: tokens.text.secondary, margin: 0, maxWidth: 340, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.5 }}>
          Quando você enviar formulários pra pacientes, eles aparecem aqui.
        </p>
      </div>
    )
  }

  return (
    <div>
      {/* Filtros */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { key: 'todos', label: 'Todos' },
          { key: 'pendente', label: 'Aguardando' },
          { key: 'preenchido', label: 'Preenchidos' },
          { key: 'expirado', label: 'Expirados' },
        ].map(f => {
          const ativo = filtroStatus === f.key
          const count = (contadores as any)[f.key]
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setFiltroStatus(f.key)}
              style={{
                padding: '8px 14px',
                border: 'none',
                borderRadius: 8,
                background: ativo ? tokens.brand.primary : '#fff',
                color: ativo ? '#fff' : tokens.text.primary,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                boxShadow: ativo ? 'none' : '0 1px 2px rgba(0,0,0,0.04)',
              }}
            >
              {f.label}
              <span style={{
                fontSize: 11,
                background: ativo ? 'rgba(255,255,255,0.25)' : tokens.bg.cardSubtle,
                padding: '2px 6px',
                borderRadius: 100,
                fontWeight: 700,
              }}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Lista */}
      <div style={{
        background: '#fff',
        borderRadius: 14,
        overflow: 'hidden',
        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
      }}>
        {filtrados.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: tokens.text.tertiary, fontSize: 14 }}>
            Nenhum envio com esse filtro.
          </div>
        ) : (
          filtrados.map((e, idx) => {
            const statusInfo = STATUS_LABEL[e.status] || STATUS_LABEL.pendente
            const ultimo = idx === filtrados.length - 1
            const clicavel = e.status === 'preenchido'
            return (
              <div
                key={e.id}
                onClick={() => clicavel && router.push('/formularios/respostas/' + e.id)}
                style={{
                  padding: '16px 20px',
                  borderBottom: ultimo ? 'none' : '1px solid ' + tokens.border.subtle,
                  cursor: clicavel ? 'pointer' : 'default',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 16,
                  transition: 'background 0.12s',
                }}
                onMouseEnter={(ev) => { if (clicavel) ev.currentTarget.style.background = tokens.bg.cardSubtle }}
                onMouseLeave={(ev) => { ev.currentTarget.style.background = 'transparent' }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: tokens.text.primary, marginBottom: 4 }}>
                    {e.nome_paciente}
                  </div>
                  <div style={{ fontSize: 12, color: tokens.text.secondary }}>
                    {e.template?.nome || 'Formulário'} · {ORIGEM_LABEL[e.origem] || e.origem}
                  </div>
                  <div style={{ fontSize: 11, color: tokens.text.tertiary, marginTop: 4 }}>
                    Enviado em {formatarData(e.enviado_em)}
                    {e.preenchido_em && ' · Respondido em ' + formatarData(e.preenchido_em)}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{
                    fontSize: 12,
                    fontWeight: 600,
                    padding: '4px 10px',
                    borderRadius: 100,
                    background: statusInfo.bg,
                    color: statusInfo.cor,
                    whiteSpace: 'nowrap',
                  }}>
                    {statusInfo.label}
                  </span>
                  {clicavel && (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={tokens.text.tertiary} strokeWidth="2">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  )}
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
