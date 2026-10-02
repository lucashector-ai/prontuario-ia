'use client'
/**
 * Card do Dashboard: consultas das próximas 48h ainda sem confirmação.
 *
 *   <CardConfirmacoesPendentes medicoIds={medicoIds} />
 *   <CardConfirmacoesPendentes medicoIds={[]} demo />      // dados de exemplo
 *
 * Também entra em modo demonstração sozinho com `?demo=1` na URL (não grava nada).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, CheckCheck, MessageCircle } from 'lucide-react'
import { tokens } from '@/lib/design-tokens'
import { supabase } from '@/lib/supabase'
import { Avatar, Badge, Button, Card, EmptyState } from '@/components/ui'
import type { BadgeTone } from '@/components/ui'
import { notificar } from '@/components/ui/dialogos'

const T = tokens
const HORA = 3600e3

type Item = {
  id: string
  data_hora: string
  status: string
  confirmacao_24h_enviada?: boolean | null
  confirmacao_24h_status?: string | null
  lembrete_48h_enviado?: boolean | null
  pacientes?: { nome?: string; telefone?: string } | null
}

function demoItens(): Item[] {
  const em = (h: number) => {
    const d = new Date(Date.now() + h * HORA)
    d.setMinutes(d.getMinutes() < 30 ? 0 : 30, 0, 0)
    return d.toISOString()
  }
  return [
    { id: 'd1', data_hora: em(4), status: 'agendado', confirmacao_24h_enviada: true, confirmacao_24h_status: 'pendente', pacientes: { nome: 'Marcos Vinícius Andrade' } },
    { id: 'd2', data_hora: em(21), status: 'agendado', confirmacao_24h_enviada: true, confirmacao_24h_status: 'pendente', pacientes: { nome: 'Juliana Ferreira Costa' } },
    { id: 'd3', data_hora: em(26), status: 'agendado', confirmacao_24h_enviada: false, lembrete_48h_enviado: true, pacientes: { nome: 'Ana Beatriz Moura' } },
    { id: 'd4', data_hora: em(45), status: 'agendado', confirmacao_24h_enviada: false, lembrete_48h_enviado: false, pacientes: { nome: 'Roberto Nogueira' } },
  ]
}

/** Situação do lembrete para o badge da linha. */
function situacao(a: Item, agora: number): { label: string; tone: BadgeTone } {
  const falta = new Date(a.data_hora).getTime() - agora
  if (a.confirmacao_24h_status === 'nao_confirmado') return { label: 'Avisou que não vai', tone: 'danger' }
  if (a.confirmacao_24h_status === 'reagendou') return { label: 'Quer remarcar', tone: 'info' }
  if (a.confirmacao_24h_status === 'erro_envio') return { label: 'Falha no envio', tone: 'danger' }
  if (a.confirmacao_24h_enviada && falta < 6 * HORA) return { label: 'Não confirmou', tone: 'warning' }
  if (a.confirmacao_24h_enviada) return { label: 'Sem resposta', tone: 'pending' }
  if (a.lembrete_48h_enviado) return { label: 'Lembrete 48h enviado', tone: 'neutral' }
  return { label: 'Aguardando envio', tone: 'neutral' }
}

const fmtQuando = (iso: string) => {
  const d = new Date(iso)
  const hoje = new Date()
  const amanha = new Date(); amanha.setDate(hoje.getDate() + 1)
  const dia = d.toDateString() === hoje.toDateString() ? 'Hoje'
    : d.toDateString() === amanha.toDateString() ? 'Amanhã'
    : d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }).replace('.', '')
  return { dia: dia.charAt(0).toUpperCase() + dia.slice(1), hora: d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) }
}

export function CardConfirmacoesPendentes({ medicoIds, demo: demoProp, limite = 6, style }: {
  /** Médicos cujos agendamentos entram no card (médico logado ou médicos da clínica). */
  medicoIds: string[]
  /** Força dados de exemplo (também ativado por ?demo=1). */
  demo?: boolean
  /** Máximo de linhas exibidas (padrão 6). */
  limite?: number
  style?: React.CSSProperties
}) {
  const router = useRouter()
  // Lido já na criação do estado: evita uma carga real "atrasada" sobrescrever os dados de exemplo
  const [demoUrl, setDemoUrl] = useState(() => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('demo') === '1')
  const demo = !!demoProp || demoUrl
  const [itens, setItens] = useState<Item[]>([])
  const [carregando, setCarregando] = useState(true)
  const [confirmando, setConfirmando] = useState<string | null>(null)
  const chave = useMemo(() => medicoIds.join(','), [medicoIds])

  useEffect(() => { setDemoUrl(new URLSearchParams(window.location.search).get('demo') === '1') }, [])

  const versao = useRef(0)
  const carregar = useCallback(async () => {
    const minha = ++versao.current
    if (demo) { setItens(demoItens()); setCarregando(false); return }
    const ids = chave.split(',').filter(Boolean)
    if (!ids.length) { setItens([]); setCarregando(false); return }
    setCarregando(true)
    const agora = Date.now()
    const { data } = await supabase.from('agendamentos')
      .select('*, pacientes(nome, telefone)')
      .in('medico_id', ids).eq('status', 'agendado')
      .gte('data_hora', new Date(agora).toISOString())
      .lte('data_hora', new Date(agora + 48 * HORA).toISOString())
      .order('data_hora')
    if (minha !== versao.current) return // chegou uma carga mais nova
    setItens((data || []).filter((a: any) => a.confirmacao_24h_status !== 'confirmado'))
    setCarregando(false)
  }, [chave, demo])

  useEffect(() => { carregar() }, [carregar])

  const confirmarManual = async (a: Item) => {
    if (demo) {
      setItens(l => l.filter(x => x.id !== a.id))
      notificar('Modo demonstração: confirmação não gravada', 'info')
      return
    }
    setConfirmando(a.id)
    const agoraIso = new Date().toISOString()
    let { error } = await supabase.from('agendamentos')
      .update({ status: 'confirmado', confirmado_em: agoraIso, confirmado_via: 'manual' }).eq('id', a.id)
    // Sem a migration 0010 (colunas novas): confirma só o status
    if (error) ({ error } = await supabase.from('agendamentos').update({ status: 'confirmado' }).eq('id', a.id))
    setConfirmando(null)
    if (error) { notificar('Não foi possível confirmar', 'erro'); return }
    setItens(l => l.filter(x => x.id !== a.id))
    notificar('Consulta confirmada')
  }

  const agora = Date.now()
  const visiveis = itens.slice(0, limite)

  return (
    <Card style={style} titulo="Confirmações pendentes" acao={
      !carregando && itens.length > 0 ? <Badge tone="pending">{itens.length} nas próximas 48h</Badge> : undefined
    }>
      {carregando ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[0, 1, 2].map(i => <div key={i} className="c360-skel" style={{ height: 44, borderRadius: 10 }} />)}
        </div>
      ) : itens.length === 0 ? (
        <EmptyState icon={CheckCheck} titulo="Tudo confirmado" descricao="Nenhuma consulta das próximas 48h aguardando confirmação." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {visiveis.map((a, i) => {
            const nome = a.pacientes?.nome || 'Paciente'
            const q = fmtQuando(a.data_hora)
            const s = situacao(a, agora)
            return (
              <div key={a.id} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', flexWrap: 'wrap',
                borderTop: i ? `1px solid ${T.border.muted}` : 'none',
              }}>
                <Avatar nome={nome} size={34} />
                <div style={{ flex: '1 1 160px', minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: T.text.primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nome}</div>
                  <div style={{ fontSize: 12, color: T.text.quaternary, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {q.dia} · <span className="mono" style={{ color: T.text.strong }}>{q.hora}</span>
                  </div>
                </div>
                <Badge tone={s.tone}>{s.label}</Badge>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  <Button variant="secondary" size="sm" icon={Check} onClick={() => confirmarManual(a)} disabled={confirmando === a.id}>
                    {confirmando === a.id ? 'Confirmando…' : 'Confirmar manualmente'}
                  </Button>
                  <Button variant="ghost" size="sm" icon={MessageCircle} onClick={() => router.push('/chat')}>Abrir no Chat</Button>
                </div>
              </div>
            )
          })}
          {itens.length > limite && (
            <Button variant="ghost" size="sm" style={{ alignSelf: 'flex-start', marginTop: 6 }} onClick={() => router.push('/agenda')}>
              Ver mais {itens.length - limite} na Agenda
            </Button>
          )}
        </div>
      )}
    </Card>
  )
}

export default CardConfirmacoesPendentes
