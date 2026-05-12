'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { tokens } from '@/lib/design-tokens'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { FadeIn } from '@/components/motion/FadeIn'
import { PageHeader } from './_components/PageHeader'
import { usePortalSession } from '@/lib/portal/session'
import {
  contarMensagensNaoLidas,
  getProximoAgendamento,
  listarExames,
  listarProtocolos,
} from '@/lib/portal/queries'
import { formatDataLonga, formatHora } from '@/lib/portal/format'
import type { Agendamento, Exame, PortalProtocolo } from '@/lib/portal/types'

export default function PortalHome() {
  const { session, loading: loadingSession } = usePortalSession()
  const [loading, setLoading] = useState(true)
  const [proxima, setProxima] = useState<Agendamento | null>(null)
  const [ultimoExame, setUltimoExame] = useState<Exame | null>(null)
  const [naoLidas, setNaoLidas] = useState(0)
  const [protocolos, setProtocolos] = useState<PortalProtocolo[]>([])

  useEffect(() => {
    if (loadingSession || !session) return
    let alive = true
    setLoading(true)
    ;(async () => {
      const [ag, exames, msgs, prots] = await Promise.all([
        getProximoAgendamento(session.pacienteId),
        listarExames(session.pacienteId),
        contarMensagensNaoLidas(session.pacienteId),
        listarProtocolos(session.pacienteId),
      ])
      if (!alive) return
      setProxima(ag)
      setUltimoExame(exames[0] || null)
      setNaoLidas(msgs)
      setProtocolos(prots.filter((p) => p.status === 'ativo').slice(0, 2))
      setLoading(false)
    })()
    return () => { alive = false }
  }, [session, loadingSession])

  const primeiroNome = session?.nome?.split(' ')[0] || 'tudo bem'

  return (
    <FadeIn>
      <div style={{ padding: '24px 20px', maxWidth: 880 }}>
        <PageHeader
          eyebrow={`Olá, ${primeiroNome}`}
          title="Sua saúde, num só lugar."
          description="Acompanhe consultas, exames, prescrições e seu plano de tratamento."
        />

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Skeleton height={140} style={{ borderRadius: tokens.radius['3xl'] }} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
              <Skeleton height={120} style={{ borderRadius: tokens.radius['3xl'] }} />
              <Skeleton height={120} style={{ borderRadius: tokens.radius['3xl'] }} />
              <Skeleton height={120} style={{ borderRadius: tokens.radius['3xl'] }} />
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <HeroProximaConsulta agendamento={proxima} />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
              <ResumoCard
                href="/portal/exames"
                eyebrow="Último exame"
                titulo={ultimoExame?.nome || 'Nenhum exame ainda'}
                detalhe={ultimoExame ? formatDataLonga(ultimoExame.data_realizacao || ultimoExame.criado_em) : 'Quando chegar, aparece aqui.'}
                icon={<BeakerIcon />}
              />
              <ResumoCard
                href="/portal/chat"
                eyebrow="Mensagens"
                titulo={naoLidas > 0 ? `${naoLidas} não lida${naoLidas > 1 ? 's' : ''}` : 'Em dia'}
                detalhe={naoLidas > 0 ? 'Toca pra abrir o chat.' : 'Sem novas mensagens da clínica.'}
                icon={<ChatIcon />}
                accent={naoLidas > 0}
              />
              <ResumoCard
                href="/portal/protocolos"
                eyebrow="Tratamentos"
                titulo={protocolos.length > 0 ? `${protocolos.length} ativo${protocolos.length > 1 ? 's' : ''}` : 'Nenhum ativo'}
                detalhe={protocolos[0]?.nome || 'Seu próximo plano aparece aqui.'}
                icon={<TargetIcon />}
              />
            </div>

            {protocolos.length > 0 && (
              <Card variant="elevated">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: tokens.text.tertiary, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                    Próximos passos
                  </div>
                  <Link href="/portal/protocolos" style={{ fontSize: 13, color: tokens.brand.primary, textDecoration: 'none', fontWeight: 500 }}>
                    Ver todos →
                  </Link>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {protocolos.map((p) => (
                    <ProtocoloMini key={p.id} protocolo={p} />
                  ))}
                </div>
              </Card>
            )}
          </div>
        )}
      </div>
    </FadeIn>
  )
}

function HeroProximaConsulta({ agendamento }: { agendamento: Agendamento | null }) {
  if (!agendamento) {
    return (
      <Card variant="elevated">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: tokens.text.tertiary, textTransform: 'uppercase', letterSpacing: 0.6 }}>
            Próxima consulta
          </span>
          <span style={{ fontSize: 22, fontWeight: 600, color: tokens.text.primary }}>Nenhuma agendada</span>
          <span style={{ fontSize: 14, color: tokens.text.secondary }}>
            Quando a clínica marcar, aparece aqui com data, hora e local.
          </span>
        </div>
      </Card>
    )
  }

  const dataStr = formatDataLonga(agendamento.data)
  const hora = agendamento.hora || formatHora(agendamento.data)

  return (
    <Card
      style={{
        background: `linear-gradient(135deg, ${tokens.brand.primary} 0%, ${tokens.brand.primaryDarker} 100%)`,
        border: 'none',
        color: tokens.text.inverse,
        padding: 24,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 600, opacity: 0.85, textTransform: 'uppercase', letterSpacing: 0.6 }}>
            Próxima consulta
          </span>
          <h2 style={{ margin: 0, fontSize: 26, fontWeight: 700, letterSpacing: -0.4 }}>
            {dataStr}
          </h2>
          <div style={{ fontSize: 15, opacity: 0.9 }}>
            {hora ? `${hora} • ` : ''}{agendamento.tipo || 'Consulta'}
          </div>
        </div>
        <Badge style={{ background: 'rgba(255,255,255,0.18)', color: tokens.text.inverse }}>
          Confirmada
        </Badge>
      </div>
    </Card>
  )
}

function ResumoCard({
  href, eyebrow, titulo, detalhe, icon, accent,
}: {
  href: string; eyebrow: string; titulo: string; detalhe: string; icon: React.ReactNode; accent?: boolean
}) {
  return (
    <Link href={href} style={{ textDecoration: 'none' }}>
      <Card interactive>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: accent ? tokens.brand.primary : tokens.brand.primaryLighter,
            color: accent ? tokens.text.inverse : tokens.brand.primary,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 4,
          }}>
            {icon}
          </div>
          <span style={{ fontSize: 12, fontWeight: 600, color: tokens.text.tertiary, textTransform: 'uppercase', letterSpacing: 0.6 }}>
            {eyebrow}
          </span>
          <span style={{ fontSize: 17, fontWeight: 600, color: tokens.text.primary, lineHeight: 1.25 }}>{titulo}</span>
          <span style={{ fontSize: 13, color: tokens.text.secondary, lineHeight: 1.4 }}>{detalhe}</span>
        </div>
      </Card>
    </Link>
  )
}

function ProtocoloMini({ protocolo }: { protocolo: PortalProtocolo }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: tokens.text.primary }}>{protocolo.nome}</div>
        <div style={{ fontSize: 13, color: tokens.text.tertiary, fontWeight: 500 }}>{protocolo.progresso_percentual}%</div>
      </div>
      {protocolo.proximo_passo && (
        <div style={{ fontSize: 13, color: tokens.text.secondary, marginBottom: 10 }}>
          Próximo: {protocolo.proximo_passo}
        </div>
      )}
      <div style={{ height: 6, background: tokens.bg.cardSubtle, borderRadius: 999, overflow: 'hidden' }}>
        <div style={{
          width: `${Math.min(100, Math.max(0, protocolo.progresso_percentual))}%`,
          height: '100%',
          background: tokens.brand.primary,
          borderRadius: 999,
          transition: 'width 320ms ease',
        }} />
      </div>
    </div>
  )
}

function BeakerIcon()   { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 3v6l-5 9a3 3 0 0 0 3 5h10a3 3 0 0 0 3-5l-5-9V3"/><path d="M7 3h10"/></svg> }
function ChatIcon()     { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> }
function TargetIcon()   { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/></svg> }
