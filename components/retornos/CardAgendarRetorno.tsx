'use client'
/**
 * Card compacto "Agendar retorno" — para o fim da Nova consulta e para o Histórico.
 *
 *   <CardAgendarRetorno pacienteId={…} pacienteNome={…} medicoId={…} consultaId={…} plano={soap.plano} avaliacao={soap.avaliacao} />
 *
 * Ao montar, pede a sugestão a /api/retornos/sugerir e pré-seleciona o prazo. Se o paciente já tem
 * retorno em aberto, mostra-o com opção de alterar. Em ?demo=1 não grava nada.
 */
import { useEffect, useMemo, useState } from 'react'
import { CalendarClock, Sparkles, CalendarCheck, Pencil, UserX, BellRing } from 'lucide-react'
import { tokens } from '@/lib/design-tokens'
import { Button, Chip, Input, IconTile } from '@/components/ui'
import { notificar } from '@/components/ui/dialogos'
import { ATALHOS_DIAS, diffDias, ehDemo, fmtDia, hojeISO, rotuloDias, somarDias } from './datas'

const T = tokens
const DIAS_LEMBRETE = 7

type Retorno = { id: string; data_prevista: string; motivo: string | null; status: string; origem?: string }
type Sugestao = { dias: number | null; motivo: string; fonte?: 'texto' | 'ia' | null }

export default function CardAgendarRetorno({ pacienteId, pacienteNome, medicoId, consultaId, plano, avaliacao }: {
  pacienteId?: string | null
  pacienteNome?: string | null
  medicoId?: string | null
  consultaId?: string | null
  plano?: string | null
  avaliacao?: string | null
}) {
  const demo = useMemo(ehDemo, [])
  const [existente, setExistente] = useState<Retorno | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [sugestao, setSugestao] = useState<Sugestao | null>(null)
  const [sugerindo, setSugerindo] = useState(false)
  const [editando, setEditando] = useState(false)
  const [dias, setDias] = useState<number | null>(null)
  const [dataLivre, setDataLivre] = useState('')
  const [motivo, setMotivo] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [recemCriado, setRecemCriado] = useState(false)
  const [erroMigration, setErroMigration] = useState(false)

  const hoje = hojeISO()
  const dataEscolhida = dataLivre || (dias ? somarDias(hoje, dias) : '')

  // Retorno em aberto do paciente
  useEffect(() => {
    if (!pacienteId || !medicoId) { setCarregando(false); return }
    if (demo) { setCarregando(false); return }
    let vivo = true
    fetch(`/api/retornos?medico_id=${medicoId}&paciente_id=${pacienteId}&status=pendente,lembrado,agendado&conciliar=0`)
      .then(r => r.json())
      .then(j => {
        if (!vivo) return
        if (j.falta_migration) setErroMigration(true)
        const prox = (j.retornos || []).filter((r: Retorno) => r.status !== 'agendado')[0] || null
        setExistente(prox)
      })
      .catch(() => {})
      .finally(() => vivo && setCarregando(false))
    return () => { vivo = false }
  }, [pacienteId, medicoId, demo])

  // Sugestão a partir do plano/avaliação
  useEffect(() => {
    if (!pacienteId || (!plano?.trim() && !avaliacao?.trim())) return
    let vivo = true
    setSugerindo(true)
    fetch('/api/retornos/sugerir', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plano, avaliacao }) })
      .then(r => r.json())
      .then((s: Sugestao) => {
        if (!vivo) return
        setSugestao(s)
        if (s.dias) setDias(d => d ?? s.dias)
        if (s.motivo) setMotivo(m => m || s.motivo)
      })
      .catch(() => {})
      .finally(() => vivo && setSugerindo(false))
    return () => { vivo = false }
  }, [pacienteId, plano, avaliacao])

  const abrirEdicao = () => {
    if (existente) {
      const n = diffDias(hoje, existente.data_prevista)
      const atalho = ATALHOS_DIAS.find(a => a.dias === n)
      setDias(atalho ? atalho.dias : null)
      setDataLivre(atalho ? '' : existente.data_prevista)
      setMotivo(existente.motivo || '')
    }
    setRecemCriado(false)
    setEditando(true)
  }

  const salvar = async () => {
    if (!pacienteId || !medicoId || !dataEscolhida) return
    if (dataEscolhida < hoje) { notificar('Escolha uma data a partir de hoje', 'erro'); return }
    const origem = sugestao?.dias && !dataLivre && dias === sugestao.dias
      ? (sugestao.fonte === 'ia' ? 'ia' : 'consulta')
      : (consultaId ? 'consulta' : 'manual')
    setSalvando(true)
    try {
      if (demo) {
        setExistente({ id: existente?.id || 'demo', data_prevista: dataEscolhida, motivo: motivo.trim() || null, status: 'pendente', origem })
      } else {
        const r = existente
          ? await fetch('/api/retornos', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: existente.id, data_prevista: dataEscolhida, motivo }) })
          : await fetch('/api/retornos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ medico_id: medicoId, paciente_id: pacienteId, consulta_id: consultaId || null, data_prevista: dataEscolhida, motivo, origem }) })
        const j = await r.json()
        if (!r.ok) { notificar(j.error || 'Não foi possível salvar o retorno', 'erro'); return }
        setExistente(j.retorno)
      }
      setEditando(false)
      setRecemCriado(true)
      notificar(existente ? 'Retorno alterado' : 'Retorno marcado')
    } finally {
      setSalvando(false)
    }
  }

  const casca = (conteudo: React.ReactNode) => (
    <div style={{ background: '#fff', border: `1px solid ${T.border.default}`, borderRadius: 16, padding: 16, display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
      {conteudo}
    </div>
  )
  const cabecalho = (sub?: React.ReactNode) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
      <IconTile icon={CalendarClock} size={36} color={T.data.purple} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: T.text.primary }}>Retorno</div>
        <div style={{ fontSize: 12.5, color: T.text.quaternary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {sub ?? (pacienteNome ? `Para ${pacienteNome}` : 'Lembrete automático por WhatsApp')}
        </div>
      </div>
    </div>
  )

  // Sem paciente vinculado
  if (!pacienteId || !medicoId) {
    return casca(
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, opacity: 0.85 }}>
        <IconTile icon={UserX} size={36} color={T.text.tertiary} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.text.strong }}>Retorno indisponível</div>
          <div style={{ fontSize: 12.5, color: T.text.quaternary, lineHeight: 1.45 }}>Vincule esta consulta a um paciente cadastrado para marcar o retorno e enviar o lembrete automático.</div>
        </div>
      </div>,
    )
  }

  if (carregando) {
    return casca(<>
      {cabecalho()}
      <div className="c360-skel" style={{ height: 32, borderRadius: 10 }} />
    </>)
  }

  // Já existe retorno em aberto (ou acabou de ser criado)
  if (existente && !editando) {
    const lembrete = somarDias(existente.data_prevista, -DIAS_LEMBRETE)
    return casca(
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <IconTile icon={CalendarCheck} size={36} color={T.data.green} />
        <div style={{ flex: '1 1 200px', minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.text.primary }}>
            {recemCriado ? 'Retorno marcado para ' : 'Retorno previsto para '}{fmtDia(existente.data_prevista)}
            {existente.motivo && <span style={{ fontWeight: 500, color: T.text.secondary }}> · {existente.motivo}</span>}
          </div>
          <div style={{ fontSize: 12.5, color: T.text.quaternary, display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
            <BellRing size={13} strokeWidth={1.6} />
            {existente.status === 'lembrado'
              ? 'Paciente já foi lembrado por WhatsApp'
              : lembrete <= hoje ? 'Lembrete automático no próximo envio (10h)' : `Lembrete automático ${DIAS_LEMBRETE} dias antes · ${fmtDia(lembrete)}`}
          </div>
        </div>
        <Button variant="secondary" size="sm" icon={Pencil} onClick={abrirEdicao}>Alterar</Button>
      </div>,
    )
  }

  const textoSugestao = sugerindo
    ? 'Lendo o plano para sugerir o retorno…'
    : sugestao?.dias
      ? <>A IA sugeriu retorno em <b style={{ color: T.text.primary }}>{rotuloDias(sugestao.dias)}</b>{sugestao.motivo ? ` — ${sugestao.motivo}` : ''}</>
      : null

  return casca(<>
    {cabecalho(existente ? `Alterando o retorno de ${fmtDia(existente.data_prevista)}` : undefined)}

    {textoSugestao && (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 11px', borderRadius: 10, background: T.brand.primarySoftBg, border: `1px solid ${T.brand.primaryAccentLight}`, fontSize: 12.5, color: T.text.muted }}>
        <Sparkles size={14} strokeWidth={1.6} color={T.brand.primary} style={{ flexShrink: 0 }} />
        <span style={{ minWidth: 0 }}>{textoSugestao}</span>
      </div>
    )}

    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {ATALHOS_DIAS.map(a => (
        <Chip key={a.dias} ativo={!dataLivre && dias === a.dias} onClick={() => { setDias(a.dias); setDataLivre('') }}>{a.label}</Chip>
      ))}
    </div>

    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
      <Input type="date" min={hoje} value={dataEscolhida} onChange={e => { setDataLivre(e.target.value); setDias(null) }} aria-label="Data do retorno" />
      <Input value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Motivo (ex.: reavaliar pressão)" maxLength={200} aria-label="Motivo do retorno" />
    </div>

    {erroMigration && <div style={{ fontSize: 12, color: T.status.warning }}>Retornos ainda não ativados: rode a migration 0011_retornos.</div>}

    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <span style={{ flex: '1 1 180px', fontSize: 12.5, color: T.text.quaternary }}>
        {dataEscolhida ? <>Retorno em <b className="mono" style={{ color: T.text.strong, fontWeight: 600 }}>{fmtDia(dataEscolhida, true)}</b> · lembrete {DIAS_LEMBRETE} dias antes</> : 'Escolha um prazo ou uma data'}
      </span>
      {existente && <Button variant="ghost" size="sm" onClick={() => setEditando(false)}>Cancelar</Button>}
      <Button size="sm" icon={CalendarCheck} disabled={!dataEscolhida || salvando || erroMigration} onClick={salvar}>
        {salvando ? 'Salvando…' : existente ? 'Salvar alteração' : 'Agendar retorno'}
      </Button>
    </div>
  </>)
}
