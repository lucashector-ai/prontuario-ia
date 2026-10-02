'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  CalendarClock, CalendarX2, BellRing, CalendarCheck, Plus, CalendarPlus, MessageCircle, Check, Pencil, X,
  RotateCcw, Sparkles, Stethoscope, Hand, TriangleAlert,
} from 'lucide-react'
import { tokens } from '@/lib/design-tokens'
import { supabase } from '@/lib/supabase'
import {
  Avatar, Badge, Button, Chip, EmptyState, Field, IconButton, Input, KpiCard, Modal, SearchInput, SegmentedControl, Overline,
  type BadgeTone,
} from '@/components/ui'
import { confirmar, notificar } from '@/components/ui/dialogos'
import { ATALHOS_DIAS, diffDias, fmtDia, hojeISO, relativo, somarDias, telefoneBonito } from '@/components/retornos/datas'
import type { MedicoCtx } from './page'
import { PACIENTES_DEMO, faltaMigration, retornosDemo, type Retorno, type StatusRetorno } from './tipos'

const T = tokens
type Filtro = 'abertos' | 'agendados' | 'finalizados'

const STATUS_UI: Record<StatusRetorno, { label: string; tone: BadgeTone }> = {
  pendente: { label: 'Pendente', tone: 'pending' },
  lembrado: { label: 'Lembrado', tone: 'info' },
  agendado: { label: 'Agendado', tone: 'success' },
  concluido: { label: 'Concluído', tone: 'neutral' },
  descartado: { label: 'Descartado', tone: 'neutral' },
}
const ORIGEM_ICONE = { ia: Sparkles, consulta: Stethoscope, manual: Hand }
const ORIGEM_LABEL = { ia: 'Sugerido pela IA', consulta: 'Definido na consulta', manual: 'Criado manualmente' }
const TONS = ['purple', 'pink', 'blue', 'green'] as const
const tomDe = (s: string) => TONS[Math.abs(s.split("").reduce((h, c) => c.charCodeAt(0) + ((h << 5) - h), 0)) % 4]

export default function AbaRetornos({ medico, demo }: { medico: MedicoCtx; demo: boolean }) {
  const router = useRouter()
  const [retornos, setRetornos] = useState<Retorno[]>([])
  const [carregando, setCarregando] = useState(true)
  const [aviso, setAviso] = useState<string | null>(null)
  const [filtro, setFiltro] = useState<Filtro>('abertos')
  const [busca, setBusca] = useState('')
  const [modalNovo, setModalNovo] = useState(false)
  const [editando, setEditando] = useState<Retorno | null>(null)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const hoje = hojeISO()

  const carregar = useCallback(async () => {
    if (demo) { setRetornos(r => r.length ? r : retornosDemo(medico.id)); setCarregando(false); return }
    try {
      const r = await fetch(`/api/retornos?medico_id=${medico.id}`)
      const j = await r.json()
      if (!r.ok) { setAviso(j.falta_migration ? 'Retornos ainda não ativados — rode a migration 0011_retornos no Supabase.' : (j.error || 'Erro ao carregar')); setRetornos([]) }
      else { setAviso(null); setRetornos(j.retornos || []) }
    } catch { setAviso('Sem conexão. Tente novamente.') }
    setCarregando(false)
  }, [demo, medico.id])
  useEffect(() => { carregar() }, [carregar])

  const abertos = retornos.filter(r => r.status === 'pendente' || r.status === 'lembrado')
  const fimSemana = somarDias(hoje, 6)
  const mes = hoje.slice(0, 7)
  const kpi = {
    semana: abertos.filter(r => r.data_prevista >= hoje && r.data_prevista <= fimSemana).length,
    atrasados: abertos.filter(r => r.data_prevista < hoje).length,
    lembrados: retornos.filter(r => r.status === 'lembrado').length,
    agendadosMes: retornos.filter(r => (r.status === 'agendado' || r.status === 'concluido') && r.data_prevista.slice(0, 7) === mes).length,
  }

  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return retornos
      .filter(r => filtro === 'abertos' ? (r.status === 'pendente' || r.status === 'lembrado')
        : filtro === 'agendados' ? r.status === 'agendado' : (r.status === 'concluido' || r.status === 'descartado'))
      .filter(r => !q || (r.paciente?.nome || '').toLowerCase().includes(q) || (r.motivo || '').toLowerCase().includes(q))
      .sort((a, b) => filtro === 'finalizados' ? b.data_prevista.localeCompare(a.data_prevista) : a.data_prevista.localeCompare(b.data_prevista))
  }, [retornos, filtro, busca])

  const grupos = filtro === 'abertos'
    ? [
        { id: 'atrasados', titulo: 'Atrasados', itens: visiveis.filter(r => r.data_prevista < hoje) },
        { id: 'semana', titulo: 'Esta semana', itens: visiveis.filter(r => r.data_prevista >= hoje && r.data_prevista <= fimSemana) },
        { id: 'proximas', titulo: 'Próximas semanas', itens: visiveis.filter(r => r.data_prevista > fimSemana) },
      ].filter(g => g.itens.length)
    : [{ id: 'todos', titulo: '', itens: visiveis }]

  // ── Ações ──────────────────────────────────────────────────────────────────
  const atualizarLocal = (id: string, patch: Partial<Retorno>) => setRetornos(rs => rs.map(r => r.id === id ? { ...r, ...patch } : r))

  const patch = async (r: Retorno, dados: Record<string, any>, ok: string) => {
    setOcupado(r.id)
    try {
      if (demo) {
        const local: Partial<Retorno> = { ...dados }
        if (dados.acao === 'lembrar') { delete (local as any).acao; local.status = r.status === 'pendente' ? 'lembrado' : r.status; local.lembrete_enviado_em = new Date().toISOString() }
        if (dados.data_prevista && dados.data_prevista !== r.data_prevista) { local.lembrete_enviado_em = null; if (r.status === 'lembrado' && !dados.status) local.status = 'pendente' }
        atualizarLocal(r.id, local)
        notificar(ok + ' (demonstração)')
        return true
      }
      const res = await fetch('/api/retornos', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: r.id, ...dados }) })
      const j = await res.json()
      if (!res.ok) { notificar(j.error || 'Não foi possível concluir', 'erro'); return false }
      atualizarLocal(r.id, j.retorno)
      notificar(ok)
      return true
    } catch {
      notificar('Sem conexão', 'erro'); return false
    } finally { setOcupado(null) }
  }

  const agendar = (r: Retorno) => {
    if (demo) { notificar(`Abriria a agenda para marcar ${r.paciente?.nome || 'o paciente'}`, 'info'); return }
    const q = new URLSearchParams({ novo: '1', paciente_id: r.paciente_id, tipo: 'retorno', data: r.data_prevista.slice(0, 10) })
    if (r.motivo) q.set('motivo', `Retorno — ${r.motivo}`)
    router.push('/agenda?' + q.toString())
  }
  const lembrar = async (r: Retorno) => {
    if (!r.paciente?.telefone) { notificar('Paciente sem telefone cadastrado', 'erro'); return }
    const ok = await confirmar({
      titulo: 'Enviar lembrete agora?',
      mensagem: `${r.paciente.nome} vai receber no WhatsApp um convite para agendar o retorno previsto para ${fmtDia(r.data_prevista)}.`,
      confirmar: 'Enviar lembrete',
    })
    if (ok) patch(r, { acao: 'lembrar' }, 'Lembrete enviado')
  }
  const concluir = (r: Retorno) => patch(r, { status: 'concluido' }, 'Retorno concluído')
  const reabrir = (r: Retorno) => patch(r, { status: 'pendente' }, 'Retorno reaberto')
  const descartar = async (r: Retorno) => {
    const ok = await confirmar({
      titulo: 'Descartar este retorno?',
      mensagem: `${r.paciente?.nome || 'O paciente'} não receberá mais lembretes deste retorno. Você pode reabri-lo depois em "Finalizados".`,
      confirmar: 'Descartar', perigo: true,
    })
    if (ok) patch(r, { status: 'descartado' }, 'Retorno descartado')
  }

  const criar = async (dados: { paciente: { id: string; nome: string; telefone: string | null }; data_prevista: string; motivo: string }) => {
    if (demo) {
      setRetornos(rs => [...rs, {
        id: 'ret-' + Date.now(), medico_id: medico.id, paciente_id: dados.paciente.id, data_prevista: dados.data_prevista,
        motivo: dados.motivo || null, origem: 'manual', status: 'pendente', lembrete_enviado_em: null, criado_em: new Date().toISOString(), paciente: dados.paciente,
      }])
      notificar('Retorno criado (demonstração)')
      return true
    }
    const res = await fetch('/api/retornos', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ medico_id: medico.id, paciente_id: dados.paciente.id, data_prevista: dados.data_prevista, motivo: dados.motivo, origem: 'manual' }),
    })
    const j = await res.json()
    if (!res.ok) { notificar(j.error || 'Não foi possível criar', 'erro'); return false }
    setRetornos(rs => [...rs, { ...j.retorno, paciente: dados.paciente }])
    notificar('Retorno criado · lembrete automático 7 dias antes')
    return true
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, minWidth: 0 }}>
      <div className="c360-kpis" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <KpiCard label="Previstos esta semana" valor={kpi.semana} icon={CalendarClock} cor={T.data.purple} carregando={carregando} />
        <KpiCard label="Atrasados" valor={kpi.atrasados} icon={CalendarX2} cor={T.data.pink} carregando={carregando} />
        <KpiCard label="Lembrados" valor={kpi.lembrados} icon={BellRing} cor={T.data.blue} carregando={carregando} />
        <KpiCard label="Agendados no mês" valor={kpi.agendadosMes} icon={CalendarCheck} cor={T.data.green} carregando={carregando} />
      </div>

      {aviso && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 12, background: T.status.warningBg, color: T.status.warning, fontSize: 13 }}>
          <TriangleAlert size={16} strokeWidth={1.6} style={{ flexShrink: 0 }} />{aviso}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ maxWidth: '100%', overflowX: 'auto', scrollbarWidth: 'none' }}>
          <SegmentedControl<Filtro> value={filtro} onChange={setFiltro} options={[
            { value: 'abertos', label: `Em aberto${abertos.length ? ` · ${abertos.length}` : ''}` },
            { value: 'agendados', label: 'Agendados' },
            { value: 'finalizados', label: 'Finalizados' },
          ]} />
        </div>
        <SearchInput value={busca} onChange={setBusca} placeholder="Buscar paciente ou motivo" style={{ flex: '1 1 220px', minWidth: 0, maxWidth: 360 }} />
        <div style={{ flex: '1 1 0', minWidth: 0 }} />
        <Button icon={Plus} onClick={() => setModalNovo(true)}>Novo retorno</Button>
      </div>

      {carregando ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[0, 1, 2, 3, 4].map(i => <div key={i} className="c360-skel" style={{ height: 66, borderRadius: 14 }} />)}
        </div>
      ) : visiveis.length === 0 ? (
        <div style={{ border: `1px solid ${T.border.default}`, borderRadius: 16 }}>
          {busca ? (
            <EmptyState icon={CalendarClock} titulo="Nada encontrado" descricao={`Nenhum retorno corresponde a "${busca}".`} acao={<Button variant="secondary" onClick={() => setBusca('')}>Limpar busca</Button>} />
          ) : filtro === 'abertos' ? (
            <EmptyState icon={CalendarClock} titulo="Nenhum retorno em aberto"
              descricao="Ao finalizar uma consulta, a IA sugere o prazo de retorno a partir do plano. Você também pode criar um retorno manualmente — o paciente é lembrado por WhatsApp 7 dias antes."
              acao={<Button icon={Plus} onClick={() => setModalNovo(true)}>Novo retorno</Button>} />
          ) : filtro === 'agendados' ? (
            <EmptyState icon={CalendarCheck} titulo="Nenhum retorno agendado ainda" descricao="Quando o paciente marca a consulta na agenda, o retorno passa para cá automaticamente." />
          ) : (
            <EmptyState icon={Check} titulo="Nada finalizado" descricao="Retornos concluídos e descartados aparecem aqui." />
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {grupos.map(g => (
            <section key={g.id} style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
              {g.titulo && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Overline style={{ color: g.id === 'atrasados' ? T.status.danger : T.text.tertiary }}>{g.titulo}</Overline>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: T.text.tertiary }}>{g.itens.length}</span>
                </div>
              )}
              <div style={{ border: `1px solid ${T.border.default}`, borderRadius: 16, overflow: 'hidden', background: '#fff' }}>
                {g.itens.map((r, i) => (
                  <LinhaRetorno key={r.id} r={r} primeira={i === 0} hoje={hoje} ocupado={ocupado === r.id}
                    onAgendar={() => agendar(r)} onLembrar={() => lembrar(r)} onConcluir={() => concluir(r)}
                    onEditar={() => setEditando(r)} onDescartar={() => descartar(r)} onReabrir={() => reabrir(r)} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .ret-linha { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(0, .9fr) minmax(0, 1.3fr) auto auto; align-items: center; gap: 14px; padding: 12px 14px; }
        .ret-linha:hover { background: ${T.bg.cardSubtle}; }
        .ret-acoes { display: flex; align-items: center; gap: 2px; justify-content: flex-end; }
        @media (max-width: 899px) {
          .ret-linha { grid-template-columns: minmax(0, 1fr) auto; gap: 8px 10px; }
          .ret-linha .ret-data, .ret-linha .ret-motivo { grid-column: 1 / -1; padding-left: 46px; }
          .ret-linha .ret-status { grid-row: 1; grid-column: 2; }
          .ret-linha .ret-acoes { grid-column: 1 / -1; justify-content: flex-start; padding-left: 40px; flex-wrap: wrap; }
        }
      ` }} />

      {modalNovo && <ModalNovoRetorno medico={medico} demo={demo} onFechar={() => setModalNovo(false)} onCriar={async d => { if (await criar(d)) setModalNovo(false) }} />}
      {editando && (
        <ModalEditar r={editando} onFechar={() => setEditando(null)}
          onSalvar={async (data, motivo) => { if (await patch(editando, { data_prevista: data, motivo }, 'Retorno atualizado')) setEditando(null) }} />
      )}
    </div>
  )
}

// ── Linha ───────────────────────────────────────────────────────────────────

function LinhaRetorno({ r, primeira, hoje, ocupado, onAgendar, onLembrar, onConcluir, onEditar, onDescartar, onReabrir }: {
  r: Retorno; primeira: boolean; hoje: string; ocupado: boolean
  onAgendar: () => void; onLembrar: () => void; onConcluir: () => void; onEditar: () => void; onDescartar: () => void; onReabrir: () => void
}) {
  const nome = r.paciente?.nome || 'Paciente removido'
  const aberto = r.status === 'pendente' || r.status === 'lembrado'
  const atrasado = aberto && r.data_prevista < hoje
  const OrigemIcone = ORIGEM_ICONE[r.origem] || Hand
  const st = STATUS_UI[r.status]
  return (
    <div className="ret-linha" style={{ borderTop: primeira ? 'none' : `1px solid ${T.border.muted}`, opacity: ocupado ? 0.55 : 1, transition: 'opacity .2s' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <Avatar nome={nome} size={36} tom={tomDe(nome)} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: T.text.primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nome}</div>
          <div className="mono" style={{ fontSize: 12, color: r.paciente?.telefone ? T.text.quaternary : T.status.warning }}>{telefoneBonito(r.paciente?.telefone)}</div>
        </div>
      </div>
      <div className="ret-data" style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: atrasado ? T.status.danger : T.text.strong }}>{fmtDia(r.data_prevista, true)}</div>
        <div style={{ fontSize: 12, color: atrasado ? T.status.danger : T.text.quaternary }}>{relativo(r.data_prevista)}</div>
      </div>
      <div className="ret-motivo" style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 7 }}>
        <span title={ORIGEM_LABEL[r.origem]} style={{ display: 'inline-grid', color: r.origem === 'ia' ? T.brand.primary : T.text.tertiary, flexShrink: 0 }}>
          <OrigemIcone size={14} strokeWidth={1.6} />
        </span>
        <span style={{ fontSize: 13, color: r.motivo ? T.text.muted : T.text.tertiary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.motivo || 'Sem motivo informado'}</span>
      </div>
      <div className="ret-status" title={r.lembrete_enviado_em ? `Lembrete enviado em ${new Date(r.lembrete_enviado_em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}` : undefined}>
        <Badge tone={atrasado && r.status === 'pendente' ? 'danger' : st.tone} dot>{atrasado && r.status === 'pendente' ? 'Atrasado' : st.label}</Badge>
      </div>
      <div className="ret-acoes">
        {aberto && <Button size="sm" variant="secondary" icon={CalendarPlus} onClick={onAgendar} disabled={ocupado} style={{ marginRight: 4 }}>Agendar</Button>}
        {aberto && <IconButton icon={MessageCircle} size={32} onClick={onLembrar} disabled={ocupado} title="Lembrar agora pelo WhatsApp" aria-label="Lembrar agora" />}
        {(aberto || r.status === 'agendado') && <IconButton icon={Check} size={32} onClick={onConcluir} disabled={ocupado} title="Concluir" aria-label="Concluir" />}
        {aberto && <IconButton icon={Pencil} size={32} onClick={onEditar} disabled={ocupado} title="Editar data e motivo" aria-label="Editar" />}
        {aberto && <IconButton icon={X} size={32} tone="danger" onClick={onDescartar} disabled={ocupado} title="Descartar" aria-label="Descartar" />}
        {(r.status === 'concluido' || r.status === 'descartado') && <Button size="sm" variant="ghost" icon={RotateCcw} onClick={onReabrir} disabled={ocupado}>Reabrir</Button>}
      </div>
    </div>
  )
}

// ── Seletor de data (atalhos + data livre) ─────────────────────────────────

function SeletorData({ valor, onChange }: { valor: string; onChange: (iso: string) => void }) {
  const hoje = hojeISO()
  const n = valor ? diffDias(hoje, valor) : null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {ATALHOS_DIAS.map(a => <Chip key={a.dias} ativo={n === a.dias} onClick={() => onChange(somarDias(hoje, a.dias))}>{a.label}</Chip>)}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Input type="date" min={hoje} value={valor} onChange={e => onChange(e.target.value)} style={{ flex: '0 1 190px' }} aria-label="Data prevista" />
        {valor && <span style={{ fontSize: 12.5, color: T.text.quaternary }}>{fmtDia(valor, true)} · {relativo(valor)}</span>}
      </div>
    </div>
  )
}

// ── Modais ──────────────────────────────────────────────────────────────────

type PacLite = { id: string; nome: string; telefone: string | null }

function ModalNovoRetorno({ medico, demo, onFechar, onCriar }: {
  medico: MedicoCtx; demo: boolean; onFechar: () => void
  onCriar: (d: { paciente: PacLite; data_prevista: string; motivo: string }) => Promise<void>
}) {
  const [pacientes, setPacientes] = useState<PacLite[] | null>(null)
  const [busca, setBusca] = useState('')
  const [paciente, setPaciente] = useState<PacLite | null>(null)
  const [data, setData] = useState(somarDias(hojeISO(), 30))
  const [motivo, setMotivo] = useState('')
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (demo) { setPacientes(PACIENTES_DEMO); return }
    supabase.from('pacientes').select('id, nome, telefone').eq('medico_id', medico.id).order('nome').limit(1000)
      .then(({ data }) => setPacientes(data || []))
  }, [demo, medico.id])

  const q = busca.trim().toLowerCase()
  const qDig = busca.replace(/\D/g, '')
  const achados = (pacientes || []).filter(p => !q || p.nome?.toLowerCase().includes(q) || (qDig.length >= 3 && (p.telefone || '').replace(/\D/g, '').includes(qDig))).slice(0, 7)

  return (
    <Modal titulo="Novo retorno" onClose={onFechar} largura={520}
      rodape={<>
        <Button variant="secondary" onClick={onFechar}>Cancelar</Button>
        <Button icon={CalendarCheck} disabled={!paciente || !data || data < hojeISO() || salvando}
          onClick={async () => { setSalvando(true); await onCriar({ paciente: paciente!, data_prevista: data, motivo: motivo.trim() }); setSalvando(false) }}>
          {salvando ? 'Salvando…' : 'Criar retorno'}
        </Button>
      </>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Field label="Paciente">
          {paciente ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 12, border: `1px solid ${T.brand.primaryAccentSoft}`, background: T.brand.primarySoftBg }}>
              <Avatar nome={paciente.nome} size={32} tom={tomDe(paciente.nome)} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{paciente.nome}</div>
                <div className="mono" style={{ fontSize: 12, color: T.text.quaternary }}>{telefoneBonito(paciente.telefone)}</div>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setPaciente(null)}>Trocar</Button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <SearchInput value={busca} onChange={setBusca} placeholder="Buscar por nome ou telefone" autoFocus />
              <div style={{ border: `1px solid ${T.border.default}`, borderRadius: 12, overflow: 'hidden', maxHeight: 280, overflowY: 'auto' }}>
                {pacientes === null ? (
                  [0, 1, 2].map(i => <div key={i} style={{ padding: 10 }}><div className="c360-skel" style={{ height: 30, borderRadius: 8 }} /></div>)
                ) : achados.length === 0 ? (
                  <div style={{ padding: '18px 12px', textAlign: 'center', fontSize: 13, color: T.text.tertiary }}>
                    {pacientes.length ? 'Nenhum paciente encontrado' : 'Nenhum paciente cadastrado ainda'}
                  </div>
                ) : achados.map((p, i) => (
                  <button key={p.id} type="button" onClick={() => setPaciente(p)} style={{
                    display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '8px 12px', border: 'none',
                    borderTop: i ? `1px solid ${T.border.muted}` : 'none', background: '#fff', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                  }}
                    onMouseEnter={e => (e.currentTarget.style.background = T.bg.hover)} onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>
                    <Avatar nome={p.nome} size={28} tom={tomDe(p.nome)} />
                    <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 500, color: T.text.primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nome}</span>
                    <span className="mono" style={{ fontSize: 12, color: T.text.quaternary, flexShrink: 0 }}>{telefoneBonito(p.telefone)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </Field>
        <Field label="Data prevista"><SeletorData valor={data} onChange={setData} /></Field>
        <Field label="Motivo" hint="Aparece no lembrete enviado ao paciente.">
          <Input value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Ex.: reavaliar pressão arterial" maxLength={200} />
        </Field>
      </div>
    </Modal>
  )
}

function ModalEditar({ r, onFechar, onSalvar }: { r: Retorno; onFechar: () => void; onSalvar: (data: string, motivo: string) => Promise<void> }) {
  const [data, setData] = useState(r.data_prevista)
  const [motivo, setMotivo] = useState(r.motivo || '')
  const [salvando, setSalvando] = useState(false)
  const mudouData = data !== r.data_prevista
  return (
    <Modal titulo="Editar retorno" onClose={onFechar} largura={500}
      rodape={<>
        <Button variant="secondary" onClick={onFechar}>Cancelar</Button>
        <Button disabled={!data || salvando} onClick={async () => { setSalvando(true); await onSalvar(data, motivo.trim()); setSalvando(false) }}>{salvando ? 'Salvando…' : 'Salvar'}</Button>
      </>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar nome={r.paciente?.nome || '?'} size={34} tom={tomDe(r.paciente?.nome || '?')} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{r.paciente?.nome || 'Paciente'}</div>
            <div style={{ fontSize: 12.5, color: T.text.quaternary }}>Previsto para {fmtDia(r.data_prevista, true)}</div>
          </div>
        </div>
        <Field label="Nova data"><SeletorData valor={data} onChange={setData} /></Field>
        <Field label="Motivo"><Input value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Ex.: reavaliar pressão arterial" maxLength={200} /></Field>
        {mudouData && r.lembrete_enviado_em && (
          <div style={{ fontSize: 12.5, color: T.text.quaternary, display: 'flex', gap: 6, alignItems: 'center' }}>
            <BellRing size={14} strokeWidth={1.6} /> Um novo lembrete será enviado 7 dias antes da nova data.
          </div>
        )}
      </div>
    </Modal>
  )
}
