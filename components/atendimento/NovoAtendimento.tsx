'use client'
/**
 * Recepção → "Novo atendimento": para quem chegou sem horário ou quer marcar.
 *   1. Quem é: busca no cadastro (nome, CPF, telefone) ou cadastro rápido.
 *   2. O que precisa: atender hoje (encaixe com senha), agendar outro dia ou lista de espera.
 */
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, CalendarPlus, ChevronRight, ListPlus, Ticket, UserPlus, UserRound } from 'lucide-react'
import { tokens as T } from '@/lib/design-tokens'
import { supabase } from '@/lib/supabase'
import { Button, Field, Input, Modal, ModalAcoes, SearchInput, Select, SegmentedControl } from '@/components/ui'
import { notificar } from '@/components/ui/dialogos'
import { checkin, ehDemo, entrarListaEspera, novoPaciente, pacientesDemo, type Fila, type PacienteResumo } from '@/lib/atendimento/cliente'
import { formatarTelefone, prioridadePelaIdade, type Atendimento, type Prioridade } from '@/lib/atendimento/comum'
import { EscolhaPrioridade, idade } from './partes'

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
type Destino = 'agora' | 'agendar' | 'espera'

export function NovoAtendimento({ fila, buscaInicial, medicoInicial, onClose, onSenha }: {
  fila: Fila
  buscaInicial?: string
  medicoInicial?: string
  onClose: () => void
  onSenha: (a: Atendimento) => void
}) {
  const router = useRouter()
  const [etapa, setEtapa] = useState<1 | 2>(1)
  const [paciente, setPaciente] = useState<PacienteResumo | null>(null)
  const [destino, setDestino] = useState<Destino>('agora')

  // Carga de cada médico agora (para a recepção escolher quem atende mais rápido)
  const carga = (id: string) => fila.atendimentos.filter(a => a.medico_id === id && a.status === 'aguardando').length
  const [medicoId, setMedicoId] = useState(medicoInicial || [...fila.medicos].sort((a, b) => carga(a.id) - carga(b.id))[0]?.id || '')
  const [prioridade, setPrioridade] = useState<Prioridade>('normal')
  const [periodo, setPeriodo] = useState('qualquer')
  const [obs, setObs] = useState('')
  const [salvando, setSalvando] = useState(false)

  const escolher = (p: PacienteResumo) => { setPaciente(p); setPrioridade(prioridadePelaIdade(p.data_nascimento)); setEtapa(2) }

  const concluir = async () => {
    if (!paciente) return
    if (destino === 'agendar') {
      const q = new URLSearchParams({ novo: '1', paciente_id: paciente.id, tipo: 'consulta', ...(ehDemo() ? { demo: '1' } : {}) })
      router.push('/agenda?' + q)
      return
    }
    if (!medicoId) { notificar('Escolha o médico', 'erro'); return }
    setSalvando(true)
    try {
      if (destino === 'agora') {
        const r = await checkin({ paciente_id: paciente.id, medico_id: medicoId, prioridade })
        if (r.ja_existia) notificar('Este paciente já estava na fila — senha mantida', 'info')
        onSenha(r.atendimento)
      } else {
        await entrarListaEspera({ medico_id: medicoId, paciente_id: paciente.id, nome: paciente.nome, telefone: paciente.telefone, preferencia_periodo: periodo, observacao: obs.trim() || undefined })
        notificar(`${paciente.nome.split(' ')[0]} entrou na lista de espera. Avisamos pelo WhatsApp quando abrir vaga.`)
        onClose()
      }
    } catch (e: any) { notificar(e.message, 'erro'); setSalvando(false) }
  }

  return (
    <Modal titulo={etapa === 1 ? 'Novo atendimento' : `Novo atendimento · ${paciente?.nome.split(' ')[0] || ''}`} onClose={onClose} largura={540}>
      {etapa === 1
        ? <EscolherPaciente buscaInicial={buscaInicial} medicoId={medicoId} onEscolher={escolher} />
        : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Paciente escolhido */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 12, background: T.bg.page }}>
              <span style={{ width: 36, height: 36, borderRadius: 11, display: 'grid', placeItems: 'center', background: T.brand.primarySubtle, color: T.brand.primary }}><UserRound size={18} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 650 }}>{paciente?.nome}</div>
                <div style={{ fontSize: 12.5, color: T.text.secondary }}>
                  {[idade(paciente?.data_nascimento) !== null ? `${idade(paciente?.data_nascimento)} anos` : null, formatarTelefone(paciente?.telefone) || 'sem telefone', paciente?.convenio].filter(Boolean).join(' · ')}
                </div>
              </div>
              <Button size="sm" variant="ghost" icon={ArrowLeft} onClick={() => setEtapa(1)}>Trocar</Button>
            </div>

            {/* O que precisa */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
              {([
                { v: 'agora', icon: Ticket, t: 'Atender hoje', d: 'Encaixe com senha' },
                { v: 'agendar', icon: CalendarPlus, t: 'Agendar', d: 'Escolher dia e hora' },
                { v: 'espera', icon: ListPlus, t: 'Lista de espera', d: 'Avisamos se abrir vaga' },
              ] as const).map(o => {
                const ativo = destino === o.v
                return (
                  <button key={o.v} onClick={() => setDestino(o.v)} style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6, padding: 12, borderRadius: 12, cursor: 'pointer',
                    textAlign: 'left', fontFamily: 'inherit', background: ativo ? T.brand.primarySubtle : '#fff',
                    border: `1px solid ${ativo ? T.brand.primaryAccent : T.border.default}`, color: T.text.primary,
                  }}>
                    <o.icon size={18} color={ativo ? T.brand.primary : T.text.secondary} />
                    <span style={{ fontSize: 13.5, fontWeight: 650 }}>{o.t}</span>
                    <span style={{ fontSize: 11.5, color: T.text.secondary }}>{o.d}</span>
                  </button>
                )
              })}
            </div>

            {destino !== 'agendar' && (
              <Field label="Médico">
                <Select value={medicoId} onChange={e => setMedicoId(e.target.value)}>
                  {fila.medicos.map(m => <option key={m.id} value={m.id}>{m.nome}{destino === 'agora' ? ` — ${carga(m.id)} na fila` : ''}</option>)}
                </Select>
              </Field>
            )}
            {destino === 'agora' && (
              <Field label="Atendimento"><EscolhaPrioridade valor={prioridade} onChange={setPrioridade} sugerida={prioridadePelaIdade(paciente?.data_nascimento)} /></Field>
            )}
            {destino === 'espera' && (
              <>
                <Field label="Melhor período">
                  <SegmentedControl options={[{ value: 'manha', label: 'Manhã' }, { value: 'tarde', label: 'Tarde' }, { value: 'qualquer', label: 'Qualquer' }]} value={periodo} onChange={setPeriodo} />
                </Field>
                <Field label="Observação (opcional)"><Input value={obs} onChange={e => setObs(e.target.value)} placeholder="Ex.: dor no joelho há 2 semanas" /></Field>
              </>
            )}
            {destino === 'agendar' && (
              <div style={{ fontSize: 13, color: T.text.secondary }}>Abre a agenda já com o paciente preenchido para escolher dia, hora e médico.</div>
            )}
          </div>
        )}

      {etapa === 2 && (
        <ModalAcoes>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button icon={destino === 'agora' ? Ticket : destino === 'agendar' ? CalendarPlus : ListPlus} onClick={concluir} disabled={salvando}>
            {salvando ? 'Salvando…' : destino === 'agora' ? 'Gerar senha' : destino === 'agendar' ? 'Abrir agenda' : 'Colocar na lista'}
          </Button>
        </ModalAcoes>
      )}
    </Modal>
  )
}

function EscolherPaciente({ buscaInicial, medicoId, onEscolher }: { buscaInicial?: string; medicoId: string; onEscolher: (p: PacienteResumo) => void }) {
  const [termo, setTermo] = useState(buscaInicial || '')
  const [achados, setAchados] = useState<PacienteResumo[]>([])
  const [buscando, setBuscando] = useState(false)
  const [cadastro, setCadastro] = useState(false)

  useEffect(() => {
    const q = termo.trim()
    if (q.length < 2) { setAchados([]); return }
    setBuscando(true)
    const t = setTimeout(async () => {
      try {
        if (ehDemo()) { setAchados(pacientesDemo().filter(p => semAcento(p.nome).includes(semAcento(q))) as any); return }
        const dig = q.replace(/\D/g, '')
        let c = supabase.from('pacientes').select('id, nome, telefone, cpf, data_nascimento, convenio').order('nome').limit(8)
        c = dig.length >= 3 ? c.or(`cpf.ilike.%${dig}%,telefone.ilike.%${dig}%`) : c.ilike('nome', `%${q}%`)
        const { data } = await c
        setAchados((data || []) as any)
      } finally { setBuscando(false) }
    }, 250)
    return () => clearTimeout(t)
  }, [termo])

  if (cadastro) return <CadastroRapido nomeInicial={/\d/.test(termo) ? '' : termo} medicoId={medicoId} onVoltar={() => setCadastro(false)} onCriado={onEscolher} />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <SearchInput value={termo} onChange={setTermo} placeholder="Nome, CPF ou telefone" autoFocus />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minHeight: 60 }}>
        {buscando && achados.length === 0 && <div style={{ fontSize: 13, color: T.text.tertiary, padding: 8 }}>Buscando…</div>}
        {!buscando && termo.trim().length >= 2 && achados.length === 0 && <div style={{ fontSize: 13, color: T.text.tertiary, padding: 8 }}>Ninguém encontrado com “{termo}”.</div>}
        {termo.trim().length < 2 && <div style={{ fontSize: 13, color: T.text.tertiary, padding: 8 }}>Digite ao menos 2 letras ou números.</div>}
        {achados.map(p => (
          <button key={p.id} onClick={() => onEscolher(p)} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, border: `1px solid ${T.border.default}`,
            background: '#fff', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
          }}
            onMouseEnter={e => (e.currentTarget.style.background = T.bg.hover)} onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 13.5, fontWeight: 650, color: T.text.primary }}>{p.nome}</span>
              <span style={{ display: 'block', fontSize: 12, color: T.text.secondary }}>
                {[idade(p.data_nascimento) !== null ? `${idade(p.data_nascimento)} anos` : null, formatarTelefone(p.telefone), p.convenio].filter(Boolean).join(' · ') || 'sem dados de contato'}
              </span>
            </span>
            <ChevronRight size={16} color={T.text.tertiary} />
          </button>
        ))}
      </div>
      <Button variant="secondary" icon={UserPlus} onClick={() => setCadastro(true)} style={{ alignSelf: 'flex-start' }}>Cadastrar paciente novo</Button>
    </div>
  )
}

function CadastroRapido({ nomeInicial, medicoId, onVoltar, onCriado }: { nomeInicial: string; medicoId: string; onVoltar: () => void; onCriado: (p: PacienteResumo) => void }) {
  const [nome, setNome] = useState(nomeInicial)
  const [telefone, setTelefone] = useState('')
  const [cpf, setCpf] = useState('')
  const [nascimento, setNascimento] = useState('')
  const [convenio, setConvenio] = useState('')
  const [salvando, setSalvando] = useState(false)

  const mascaraTel = (v: string) => {
    const d = v.replace(/\D/g, '').slice(0, 11)
    if (d.length <= 2) return d
    if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  }
  const mascaraCpf = (v: string) => v.replace(/\D/g, '').slice(0, 11).replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2')

  const salvar = async () => {
    setSalvando(true)
    try {
      const r = await novoPaciente({ nome, telefone, cpf, data_nascimento: nascimento || undefined, convenio: convenio || undefined, medico_id: medicoId })
      if (r.ja_existia) notificar('Esse paciente já tinha cadastro — usamos o existente', 'info')
      onCriado(r.paciente)
    } catch (e: any) { notificar(e.message, 'erro'); setSalvando(false) }
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
        <Field label="Nome completo *" style={{ gridColumn: '1 / -1' }}><Input autoFocus value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome e sobrenome" /></Field>
        <Field label="Celular (WhatsApp)"><Input value={telefone} onChange={e => setTelefone(mascaraTel(e.target.value))} placeholder="(11) 98765-4321" inputMode="tel" /></Field>
        <Field label="CPF"><Input value={cpf} onChange={e => setCpf(mascaraCpf(e.target.value))} placeholder="000.000.000-00" inputMode="numeric" /></Field>
        <Field label="Nascimento"><Input type="date" value={nascimento} onChange={e => setNascimento(e.target.value)} max={new Date().toISOString().slice(0, 10)} /></Field>
        <Field label="Convênio"><Input value={convenio} onChange={e => setConvenio(e.target.value)} placeholder="Particular, Unimed…" /></Field>
      </div>
      <div style={{ fontSize: 12, color: T.text.tertiary, marginTop: 10 }}>Com o celular, o paciente recebe a senha e o aviso de “sua vez” pelo WhatsApp. O resto do cadastro pode ser completado depois.</div>
      <ModalAcoes>
        <Button variant="secondary" icon={ArrowLeft} onClick={onVoltar}>Voltar à busca</Button>
        <Button icon={UserPlus} onClick={salvar} disabled={salvando || nome.trim().split(/\s+/).length < 2}>{salvando ? 'Salvando…' : 'Cadastrar e continuar'}</Button>
      </ModalAcoes>
    </div>
  )
}
