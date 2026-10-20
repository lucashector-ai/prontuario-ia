'use client'
/**
 * Salas do dia: linha do tempo de cada sala e equipamento (agendamentos e manutenções).
 * Para a recepção encaixar e a enfermagem preparar salas e equipamentos.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, DoorOpen, Cpu, Wrench, Settings2 } from 'lucide-react'
import { tokens as T } from '@/lib/design-tokens'
import { usePageHeader } from '@/components/shell/header-context'
import { Button, Card, EmptyState } from '@/components/ui'
import { ehDemo, comDemo } from '@/lib/demo'

type Reserva = { id: string; consultorio_id: string | null; equipamento_id: string | null; inicio: string; fim: string; motivo: string; observacao: string | null
  agendamento: { id: string; status: string; motivo: string | null; paciente: { nome: string } | null; medico: { nome: string } | null } | null }
type Dados = { salas: { id: string; nome: string; tipo: string; descricao_local: string | null; ativo: boolean }[]; equipamentos: { id: string; nome: string; consultorio_id: string | null; ativo: boolean }[]; reservas: Reserva[] }

const INICIO = 7, FIM = 21
const diaSP = (d = new Date()) => d.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
const horaDe = (iso: string) => { const d = new Date(iso); return Number(d.toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: 'America/Sao_Paulo' })) % 24 + d.getMinutes() / 60 }
const hhmm = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })

function demoDados(dia: string): Dados {
  const em = (h: number, m = 0) => new Date(`${dia}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00-03:00`).toISOString()
  const ag = (nome: string, medico: string, motivo: string) => ({ id: 'x', status: 'agendado', motivo, paciente: { nome }, medico: { nome: medico } })
  return {
    salas: [
      { id: 'c1', nome: 'Consultório 1', tipo: 'consultorio', descricao_local: '1º andar', ativo: true },
      { id: 'c2', nome: 'Consultório 2', tipo: 'consultorio', descricao_local: '1º andar', ativo: true },
      { id: 'c3', nome: 'Sala de procedimentos', tipo: 'procedimentos', descricao_local: '2º andar', ativo: true },
    ],
    equipamentos: [{ id: 'e1', nome: 'Laser CO2', consultorio_id: 'c3', ativo: true }, { id: 'e2', nome: 'Eletrocardiógrafo', consultorio_id: null, ativo: true }],
    reservas: [
      { id: 'r1', consultorio_id: 'c1', equipamento_id: null, inicio: em(8), fim: em(8, 30), motivo: 'agendamento', observacao: null, agendamento: ag('Mariana Costa', 'Dra. Helena Duarte', 'Consulta') },
      { id: 'r2', consultorio_id: 'c1', equipamento_id: null, inicio: em(9), fim: em(9, 30), motivo: 'agendamento', observacao: null, agendamento: ag('Roberto Nogueira', 'Dra. Helena Duarte', 'Retorno') },
      { id: 'r3', consultorio_id: 'c2', equipamento_id: null, inicio: em(10), fim: em(11), motivo: 'agendamento', observacao: null, agendamento: ag('Juliana Ferreira', 'Dr. Marcos Vieira', 'Consulta') },
      { id: 'r4', consultorio_id: 'c3', equipamento_id: null, inicio: em(14), fim: em(14, 40), motivo: 'agendamento', observacao: null, agendamento: ag('Ana Beatriz Moura', 'Dr. Marcos Vieira', 'Laser') },
      { id: 'r5', consultorio_id: null, equipamento_id: 'e1', inicio: em(14), fim: em(14, 40), motivo: 'agendamento', observacao: null, agendamento: ag('Ana Beatriz Moura', 'Dr. Marcos Vieira', 'Laser') },
      { id: 'r6', consultorio_id: null, equipamento_id: 'e2', inicio: em(16), fim: em(18), motivo: 'manutencao', observacao: 'Revisão técnica', agendamento: null },
    ],
  }
}

export default function SalasDoDia() {
  usePageHeader('Salas do dia', 'Quem está em cada sala e equipamento, hora a hora')
  const router = useRouter()
  const [dia, setDia] = useState(diaSP())
  const [d, setD] = useState<Dados | null>(null)

  const carregar = useCallback(async () => {
    if (ehDemo()) { setD(demoDados(dia)); return }
    const r = await fetch('/api/salas?dia=' + dia)
    setD(r.ok ? await r.json() : { salas: [], equipamentos: [], reservas: [] })
  }, [dia])
  useEffect(() => { carregar() }, [carregar])
  useEffect(() => { const t = setInterval(carregar, 60000); return () => clearInterval(t) }, [carregar])

  const andar = (n: number) => { const x = new Date(dia + 'T12:00:00'); x.setDate(x.getDate() + n); setDia(x.toLocaleDateString('en-CA')) }
  const linhas = useMemo(() => d ? [
    ...d.salas.filter(s => s.ativo).map(s => ({ id: s.id, nome: s.nome, sub: s.descricao_local, icone: DoorOpen, reservas: d.reservas.filter(r => r.consultorio_id === s.id) })),
    ...d.equipamentos.filter(e => e.ativo).map(e => ({ id: e.id, nome: e.nome, sub: e.consultorio_id ? d.salas.find(s => s.id === e.consultorio_id)?.nome || null : 'móvel', icone: Cpu, reservas: d.reservas.filter(r => r.equipamento_id === e.id) })),
  ] : [], [d])
  const horas = Array.from({ length: FIM - INICIO }, (_, k) => INICIO + k)
  const agora = horaDe(new Date().toISOString())
  const ehHoje = dia === diaSP()
  const pos = (h: number) => `${((Math.max(INICIO, Math.min(FIM, h)) - INICIO) / (FIM - INICIO)) * 100}%`

  return (
    <div className="c360-pagina" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Button variant="secondary" onClick={() => setDia(diaSP())}>Hoje</Button>
        <Button variant="ghost" icon={ChevronLeft} onClick={() => andar(-1)} aria-label="Dia anterior" />
        <Button variant="ghost" icon={ChevronRight} onClick={() => andar(1)} aria-label="Próximo dia" />
        <span style={{ fontSize: 16, fontWeight: 700, color: T.text.primary }}>{new Date(dia + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
        <span style={{ flex: 1 }} />
        <Button variant="ghost" icon={Settings2} onClick={() => router.push(comDemo('/minha-clinica?aba=salas'))}>Salas e equipamentos</Button>
      </div>

      {d && !linhas.length ? (
        <Card><EmptyState icon={DoorOpen} titulo="Nenhuma sala cadastrada" descricao="Cadastre os consultórios em Minha clínica → Recepção e painel e os equipamentos em Salas e equipamentos." /></Card>
      ) : (
        <Card padding={0} style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: 820 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '190px 1fr', borderBottom: `1px solid ${T.border.default}` }}>
              <span />
              <div style={{ position: 'relative', height: 30 }}>
                {horas.map(h => <span key={h} style={{ position: 'absolute', left: pos(h), top: 8, fontSize: 11, color: T.text.tertiary, transform: 'translateX(-50%)' }}>{h}h</span>)}
              </div>
            </div>
            {linhas.map(l => (
              <div key={l.id} style={{ display: 'grid', gridTemplateColumns: '190px 1fr', borderBottom: `1px solid ${T.border.muted}`, minHeight: 54 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px' }}>
                  <l.icone size={15} color={T.text.secondary} />
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: T.text.primary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.nome}</span>
                    {l.sub && <span style={{ display: 'block', fontSize: 11, color: T.text.tertiary }}>{l.sub}</span>}
                  </span>
                </div>
                <div style={{ position: 'relative' }}>
                  {horas.map(h => <span key={h} style={{ position: 'absolute', left: pos(h), top: 0, bottom: 0, width: 1, background: T.border.muted }} />)}
                  {ehHoje && agora >= INICIO && agora <= FIM && <span style={{ position: 'absolute', left: pos(agora), top: 0, bottom: 0, width: 2, background: T.status.danger, opacity: 0.6 }} />}
                  {l.reservas.map(r => {
                    const manut = r.motivo === 'manutencao'
                    const ini = horaDe(r.inicio), fim = Math.max(ini + 0.25, horaDe(r.fim) || 24)
                    const cor = manut ? T.status.warning : T.brand.primary
                    return (
                      <div key={r.id} title={manut ? `Manutenção ${hhmm(r.inicio)}–${hhmm(r.fim)}${r.observacao ? ' · ' + r.observacao : ''}` : `${hhmm(r.inicio)}–${hhmm(r.fim)} · ${r.agendamento?.paciente?.nome || 'Paciente'} · ${r.agendamento?.medico?.nome || ''}`}
                        onClick={() => r.agendamento?.id && r.agendamento.id !== 'x' && router.push(comDemo('/agenda?ag=' + r.agendamento.id))}
                        style={{ position: 'absolute', top: 6, bottom: 6, left: pos(ini), width: `calc(${pos(fim)} - ${pos(ini)} - 2px)`, borderRadius: 8, padding: '3px 6px', overflow: 'hidden',
                          background: manut ? T.status.warningBg : T.brand.primaryLight, borderLeft: `3px solid ${cor}`, cursor: r.agendamento ? 'pointer' : 'default', fontSize: 11, lineHeight: 1.25, color: T.text.primary }}>
                        {manut ? <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600, color: T.status.warning }}><Wrench size={11} /> Manutenção</span>
                          : <><b style={{ display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.agendamento?.paciente?.nome || 'Paciente'}</b>
                            <span style={{ color: T.text.secondary, whiteSpace: 'nowrap' }}>{hhmm(r.inicio)} · {r.agendamento?.medico?.nome || ''}</span></>}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
      <p style={{ fontSize: 12, color: T.text.tertiary, margin: 0 }}>A agenda reserva a sala e os equipamentos ao marcar um procedimento (ou a sala padrão do profissional) e não deixa dois agendamentos no mesmo recurso ao mesmo tempo.</p>
    </div>
  )
}
