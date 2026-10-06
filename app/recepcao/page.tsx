'use client'
/**
 * Recepção — chegadas do dia, check-in com senha, encaixes e quem está na clínica.
 * Atualiza sozinha (tempo real). ?demo=1 roda com dados de exemplo, sem gravar nada.
 */
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Clock, Hourglass, MonitorPlay, Printer, RotateCcw, Stethoscope, UserCheck, UserPlus, Users, XCircle, ArrowUpDown, Settings2,
} from 'lucide-react'
import { tokens as T } from '@/lib/design-tokens'
import { supabase } from '@/lib/supabase'
import { usePageHeader } from '@/components/shell/header-context'
import { Button, Card, EmptyState, Field, IconButton, KpiCard, Modal, ModalAcoes, SearchInput, Select } from '@/components/ui'
import { confirmar, notificar } from '@/components/ui/dialogos'
import { useFila } from '@/lib/atendimento/useFila'
import { checkin, carregarConfig, ehDemo, mudar, pacientesDemo, avisarFila, type Config } from '@/lib/atendimento/cliente'
import { minutosDesde, ordenarFila, prioridadePelaIdade, type Atendimento, type Esperado, type Prioridade } from '@/lib/atendimento/comum'
import { EscolhaPrioridade, ModalSenha, SeloPrioridade, SeloStatus, SenhaChip, esperaTexto, horaCurta, idade, imprimirSenha } from '@/components/atendimento/partes'

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const ORDEM_STATUS: Record<string, number> = { chamado: 0, em_atendimento: 1, aguardando: 2, ausente: 3 }

export default function RecepcaoPage() {
  const router = useRouter()
  usePageHeader('Recepção', 'Chegadas, senhas e fila de hoje')

  const { fila, carregando, erro, recarregar } = useFila()
  const [config, setConfig] = useState<Config | null>(null)
  const [busca, setBusca] = useState('')
  const [medicoFiltro, setMedicoFiltro] = useState('')
  const [checkinDe, setCheckinDe] = useState<Esperado | null>(null)
  const [encaixe, setEncaixe] = useState(false)
  const [senhaGerada, setSenhaGerada] = useState<Atendimento | null>(null)
  const [mudarPrioridade, setMudarPrioridade] = useState<Atendimento | null>(null)
  const [agora, setAgora] = useState(() => Date.now())

  useEffect(() => { carregarConfig().then(setConfig).catch(() => setConfig({ setores: [], consultorios: [] })) }, [])
  useEffect(() => { const t = setInterval(() => setAgora(Date.now()), 30000); return () => clearInterval(t) }, [])

  const nomeSetor = (id: string | null) => config?.setores.find(s => s.id === id)?.nome || null
  const casa = (nome?: string | null, extra?: string | null) => {
    const q = semAcento(busca.trim())
    return !q || semAcento(`${nome || ''} ${extra || ''}`).includes(q)
  }

  const esperados = useMemo(() => (fila?.esperados || [])
    .filter(e => (!medicoFiltro || e.medico_id === medicoFiltro) && casa(e.paciente?.nome, e.paciente?.telefone)), [fila, medicoFiltro, busca])

  const naClinica = useMemo(() => {
    const ativos = (fila?.atendimentos || []).filter(a => ['aguardando', 'chamado', 'em_atendimento', 'ausente'].includes(a.status)
      && (!medicoFiltro || a.medico_id === medicoFiltro) && casa(a.paciente?.nome, a.senha))
    const aguardando = ordenarFila(ativos.filter(a => a.status === 'aguardando'))
    const outros = ativos.filter(a => a.status !== 'aguardando').sort((a, b) => ORDEM_STATUS[a.status] - ORDEM_STATUS[b.status])
    return [...outros.filter(a => a.status !== 'ausente'), ...aguardando, ...outros.filter(a => a.status === 'ausente')]
  }, [fila, medicoFiltro, busca])

  const finalizados = (fila?.atendimentos || []).filter(a => a.status === 'finalizado' && (!medicoFiltro || a.medico_id === medicoFiltro))

  // Indicadores do dia
  const todos = fila?.atendimentos || []
  const aguardandoN = todos.filter(a => a.status === 'aguardando').length
  const emAtendN = todos.filter(a => a.status === 'chamado' || a.status === 'em_atendimento').length
  const esperas = todos.filter(a => a.chamado_em).map(a => (new Date(a.chamado_em!).getTime() - new Date(a.chegada_em).getTime()) / 60000)
  const esperaMedia = esperas.length ? Math.round(esperas.reduce((s, x) => s + x, 0) / esperas.length) : null

  const acao = async (a: Atendimento, para: 'cancelar' | 'voltar_fila') => {
    if (para === 'cancelar' && !(await confirmar({ titulo: `Tirar ${a.paciente?.nome?.split(' ')[0] || 'paciente'} da fila?`, mensagem: `A senha ${a.senha} deixa de ser chamada. Dá para voltar depois.`, confirmar: 'Tirar da fila', perigo: true }))) return
    try { await mudar(a.id, para); avisarFila(); notificar(para === 'cancelar' ? 'Paciente tirado da fila' : 'Paciente de volta na fila') }
    catch (e: any) { notificar(e.message, 'erro') }
  }

  const demo = ehDemo()
  const linkPainel = config?.setores.find(s => s.ativo)
  const semSetores = config && config.setores.length === 0

  if (erro?.faltaMigration) {
    return (
      <div className="c360-pagina">
        <Card><EmptyState icon={Settings2} titulo="Falta ativar o módulo de atendimento" descricao="Rode a migration 0018_atendimento_fila no Supabase (SQL Editor) e recarregue a página." /></Card>
      </div>
    )
  }

  return (
    <div className="c360-pagina" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Barra de ações */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <SearchInput value={busca} onChange={setBusca} placeholder="Buscar paciente ou senha" style={{ flex: '1 1 260px', maxWidth: 420 }} autoFocus />
        {(fila?.medicos.length || 0) > 1 && (
          <Select value={medicoFiltro} onChange={e => setMedicoFiltro(e.target.value)} style={{ width: 'auto', minWidth: 190 }} aria-label="Filtrar por médico">
            <option value="">Todos os médicos</option>
            {fila!.medicos.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
          </Select>
        )}
        <span style={{ flex: 1 }} />
        {linkPainel && (
          <Button variant="secondary" icon={MonitorPlay} onClick={() => window.open(`/painel/${linkPainel.painel_token}${demo ? '?demo=1' : ''}`, '_blank')}>Abrir painel da TV</Button>
        )}
        <Button icon={UserPlus} onClick={() => setEncaixe(true)}>Encaixe</Button>
      </div>

      {semSetores && !demo && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 12, background: T.status.infoBg, color: T.status.infoStrong, fontSize: 13 }}>
          <MonitorPlay size={18} />
          <span style={{ flex: 1 }}>Cadastre a sala de espera e os consultórios para usar o painel de chamada na TV.</span>
          <Button size="sm" variant="secondary" onClick={() => router.push('/minha-clinica?aba=atendimento')}>Configurar</Button>
        </div>
      )}

      <div className="c360-kpis" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <KpiCard label="A chegar" valor={fila?.esperados.length ?? '—'} icon={Clock} comparacao="agendados sem check-in" carregando={carregando && !fila} />
        <KpiCard label="Aguardando" valor={aguardandoN} icon={Hourglass} comparacao="na sala de espera" cor={T.data.orange} carregando={carregando && !fila} />
        <KpiCard label="Em atendimento" valor={emAtendN} icon={Stethoscope} comparacao="chamados ou no consultório" cor={T.data.blue} carregando={carregando && !fila} />
        <KpiCard label="Espera média" valor={esperaMedia === null ? '—' : esperaTexto(esperaMedia)} icon={Users} comparacao={`${finalizados.length} atendidos hoje`} cor={T.data.green} carregando={carregando && !fila} />
      </div>

      <div className="c360-recepcao-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 16, alignItems: 'start' }}>
        <style dangerouslySetInnerHTML={{ __html: '@media (max-width: 1023px) { .c360-recepcao-grid { grid-template-columns: minmax(0, 1fr) !important; } }' }} />

        {/* Chegando hoje */}
        <Card titulo={`Chegando hoje · ${esperados.length}`} padding={0}>
          {carregando && !fila ? <Linhas /> : esperados.length === 0 ? (
            <EmptyState icon={UserCheck} titulo={busca ? 'Ninguém encontrado' : 'Todos já chegaram'} descricao={busca ? 'Tente outro nome, ou faça um encaixe.' : 'Os agendamentos de hoje sem check-in aparecem aqui.'} />
          ) : esperados.map(e => {
            const atraso = minutosDesde(e.data_hora, agora)
            const anos = idade(e.paciente?.data_nascimento)
            return (
              <div key={e.id} style={linha}>
                <div style={{ width: 52, flexShrink: 0 }}>
                  <div className="mono" style={{ fontSize: 15, fontWeight: 700 }}>{horaCurta(e.data_hora)}</div>
                  {atraso > 15 && <div style={{ fontSize: 11, color: T.status.danger, fontWeight: 600 }}>{atraso < 120 ? `+${esperaTexto(atraso)}` : 'atrasado'}</div>}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 650, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    {e.paciente?.nome || 'Paciente'}
                    {anos !== null && <span style={{ fontSize: 12, color: T.text.tertiary, fontWeight: 500 }}>{anos} anos</span>}
                    <SeloPrioridade prioridade={prioridadePelaIdade(e.paciente?.data_nascimento)} />
                  </div>
                  <div style={{ fontSize: 12.5, color: T.text.secondary, marginTop: 2 }}>
                    {e.medico?.nome}{e.motivo ? ` · ${e.motivo}` : ''}{e.tipo === 'retorno' ? ' · Retorno' : ''}
                  </div>
                </div>
                <Button size="sm" icon={UserCheck} onClick={() => setCheckinDe(e)}>Chegou</Button>
              </div>
            )
          })}
        </Card>

        {/* Na clínica */}
        <Card titulo={`Na clínica · ${naClinica.length}`} padding={0}>
          {carregando && !fila ? <Linhas /> : naClinica.length === 0 ? (
            <EmptyState icon={Users} titulo="Sala de espera vazia" descricao="Depois do check-in, o paciente aparece aqui com a senha." />
          ) : naClinica.map((a, i) => {
            const pos = a.status === 'aguardando' ? naClinica.filter(x => x.status === 'aguardando' && x.medico_id === a.medico_id).indexOf(a) + 1 : null
            return (
              <div key={a.id} style={{ ...linha, opacity: a.status === 'ausente' ? 0.7 : 1, borderTop: i === 0 ? 'none' : linha.borderTop }}>
                <SenhaChip senha={a.senha} destaque={a.status === 'chamado'} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 650, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    {a.paciente?.nome || 'Paciente'} <SeloPrioridade prioridade={a.prioridade} />
                  </div>
                  <div style={{ fontSize: 12.5, color: T.text.secondary, marginTop: 2 }}>
                    {a.medico?.nome}
                    {a.status === 'aguardando' && ` · ${pos}º na fila · espera ${esperaTexto(minutosDesde(a.chegada_em, agora))}`}
                    {(a.status === 'chamado' || a.status === 'em_atendimento') && a.consultorio && ` · ${a.consultorio.nome}`}
                    {a.status === 'chamado' && a.chamadas > 1 && ` · chamado ${a.chamadas}x`}
                  </div>
                </div>
                <SeloStatus status={a.status} />
                <div style={{ display: 'flex', gap: 2 }}>
                  <IconButton icon={Printer} size={30} title="Reimprimir senha" onClick={() => imprimirSenha(a, nomeSetor(a.setor_id))} />
                  {a.status === 'aguardando' && <IconButton icon={ArrowUpDown} size={30} title="Mudar prioridade" onClick={() => setMudarPrioridade(a)} />}
                  {a.status === 'ausente'
                    ? <IconButton icon={RotateCcw} size={30} title="Voltar para a fila" onClick={() => acao(a, 'voltar_fila')} />
                    : a.status === 'aguardando' && <IconButton icon={XCircle} size={30} tone="danger" title="Tirar da fila" onClick={() => acao(a, 'cancelar')} />}
                </div>
              </div>
            )
          })}
          {finalizados.length > 0 && (
            <details style={{ borderTop: `1px solid ${T.border.muted}` }}>
              <summary style={{ cursor: 'pointer', padding: '12px 16px', fontSize: 13, fontWeight: 600, color: T.text.secondary }}>Atendidos hoje · {finalizados.length}</summary>
              {finalizados.map(a => (
                <div key={a.id} style={{ ...linha, padding: '8px 16px' }}>
                  <SenhaChip senha={a.senha} />
                  <span style={{ flex: 1, fontSize: 13 }}>{a.paciente?.nome} <span style={{ color: T.text.tertiary }}>· {a.medico?.nome}</span></span>
                  <span className="mono" style={{ fontSize: 12, color: T.text.tertiary }}>{horaCurta(a.fim_em)}</span>
                </div>
              ))}
            </details>
          )}
        </Card>
      </div>

      {erro && !erro.faltaMigration && (
        <div style={{ fontSize: 13, color: T.status.danger, display: 'flex', alignItems: 'center', gap: 10 }}>
          {erro.msg} <Button size="sm" variant="secondary" onClick={recarregar}>Tentar de novo</Button>
        </div>
      )}

      {checkinDe && (
        <ModalCheckin esperado={checkinDe} onClose={() => setCheckinDe(null)} onPronto={at => { setCheckinDe(null); setSenhaGerada(at); avisarFila() }} />
      )}
      {encaixe && fila && (
        <ModalEncaixe medicos={fila.medicos} medicoInicial={medicoFiltro} onClose={() => setEncaixe(false)} onPronto={at => { setEncaixe(false); setSenhaGerada(at); avisarFila() }} />
      )}
      {senhaGerada && <ModalSenha at={senhaGerada} setor={nomeSetor(senhaGerada.setor_id)} onClose={() => setSenhaGerada(null)} />}
      {mudarPrioridade && <ModalPrioridade at={mudarPrioridade} onClose={() => setMudarPrioridade(null)} />}
    </div>
  )
}

const linha: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderTop: `1px solid ${T.border.muted}` }

function Linhas() {
  return <>{[0, 1, 2].map(i => <div key={i} style={linha}><span className="c360-skel" style={{ width: 52, height: 16, borderRadius: 6 }} /><span style={{ flex: 1 }}><span className="c360-skel" style={{ display: 'block', height: 12, width: '60%', borderRadius: 6 }} /></span></div>)}</>
}

function ModalCheckin({ esperado, onClose, onPronto }: { esperado: Esperado; onClose: () => void; onPronto: (a: Atendimento) => void }) {
  const sugerida = prioridadePelaIdade(esperado.paciente?.data_nascimento)
  const [prioridade, setPrioridade] = useState<Prioridade>(sugerida)
  const [salvando, setSalvando] = useState(false)
  const confirmarChegada = async () => {
    setSalvando(true)
    try { const r = await checkin({ agendamento_id: esperado.id, prioridade }); onPronto(r.atendimento) }
    catch (e: any) { notificar(e.message, 'erro'); setSalvando(false) }
  }
  return (
    <Modal titulo={`Chegada de ${esperado.paciente?.nome?.split(' ')[0] || 'paciente'}`} onClose={onClose} largura={460}>
      <div style={{ fontSize: 13.5, color: T.text.secondary, marginBottom: 14 }}>
        <b style={{ color: T.text.primary }}>{esperado.paciente?.nome}</b> · {esperado.medico?.nome} · {horaCurta(esperado.data_hora)}
      </div>
      <Field label="Atendimento"><EscolhaPrioridade valor={prioridade} onChange={setPrioridade} sugerida={sugerida} /></Field>
      <ModalAcoes>
        <Button variant="secondary" onClick={onClose}>Voltar</Button>
        <Button icon={UserCheck} onClick={confirmarChegada} disabled={salvando}>{salvando ? 'Gerando senha…' : 'Confirmar chegada'}</Button>
      </ModalAcoes>
    </Modal>
  )
}

function ModalEncaixe({ medicos, medicoInicial, onClose, onPronto }: {
  medicos: { id: string; nome: string }[]; medicoInicial: string; onClose: () => void; onPronto: (a: Atendimento) => void
}) {
  const [termo, setTermo] = useState('')
  const [achados, setAchados] = useState<any[]>([])
  const [paciente, setPaciente] = useState<any | null>(null)
  const [medicoId, setMedicoId] = useState(medicoInicial || medicos[0]?.id || '')
  const [prioridade, setPrioridade] = useState<Prioridade>('normal')
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    const q = termo.trim()
    if (q.length < 2 || paciente) { setAchados([]); return }
    const t = setTimeout(async () => {
      if (ehDemo()) { setAchados(pacientesDemo().filter(p => semAcento(p.nome).includes(semAcento(q)))); return }
      const digitos = q.replace(/\D/g, '')
      let consulta = supabase.from('pacientes').select('id, nome, telefone, cpf, data_nascimento').limit(8)
      consulta = digitos.length >= 3 ? consulta.or(`cpf.ilike.%${digitos}%,telefone.ilike.%${digitos}%`) : consulta.ilike('nome', `%${q}%`)
      const { data } = await consulta
      setAchados(data || [])
    }, 250)
    return () => clearTimeout(t)
  }, [termo, paciente])

  const escolher = (p: any) => { setPaciente(p); setTermo(p.nome); setPrioridade(prioridadePelaIdade(p.data_nascimento)) }
  const salvar = async () => {
    if (!paciente || !medicoId) return
    setSalvando(true)
    try { const r = await checkin({ paciente_id: paciente.id, medico_id: medicoId, prioridade }); onPronto(r.atendimento) }
    catch (e: any) { notificar(e.message, 'erro'); setSalvando(false) }
  }

  return (
    <Modal titulo="Encaixe" onClose={onClose} largura={480}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field label="Paciente" hint="Nome, CPF ou telefone. Paciente novo: cadastre em Pacientes.">
          <div style={{ position: 'relative' }}>
            <SearchInput value={termo} onChange={v => { setTermo(v); setPaciente(null) }} placeholder="Buscar paciente" autoFocus />
            {achados.length > 0 && (
              <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 5, background: '#fff', border: `1px solid ${T.border.default}`, borderRadius: 12, boxShadow: T.shadow.lg, padding: 4 }}>
                {achados.map(p => (
                  <button key={p.id} onClick={() => escolher(p)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 10px', border: 'none', background: 'none', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}
                    onMouseEnter={e => (e.currentTarget.style.background = T.bg.hover)} onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                    <b>{p.nome}</b>{idade(p.data_nascimento) !== null && <span style={{ color: T.text.tertiary }}> · {idade(p.data_nascimento)} anos</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </Field>
        <Field label="Médico">
          <Select value={medicoId} onChange={e => setMedicoId(e.target.value)}>
            {medicos.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
          </Select>
        </Field>
        {paciente && <Field label="Atendimento"><EscolhaPrioridade valor={prioridade} onChange={setPrioridade} sugerida={prioridadePelaIdade(paciente.data_nascimento)} /></Field>}
      </div>
      <ModalAcoes>
        <Button variant="secondary" onClick={onClose}>Voltar</Button>
        <Button icon={UserPlus} onClick={salvar} disabled={!paciente || !medicoId || salvando}>{salvando ? 'Gerando senha…' : 'Colocar na fila'}</Button>
      </ModalAcoes>
    </Modal>
  )
}

function ModalPrioridade({ at, onClose }: { at: Atendimento; onClose: () => void }) {
  const [prioridade, setPrioridade] = useState<Prioridade>(at.prioridade)
  const salvar = async () => {
    try { await mudar(at.id, 'prioridade', { prioridade }); avisarFila(); onClose() } catch (e: any) { notificar(e.message, 'erro') }
  }
  return (
    <Modal titulo={`Prioridade · ${at.senha}`} onClose={onClose} largura={460}>
      <EscolhaPrioridade valor={prioridade} onChange={setPrioridade} />
      <div style={{ fontSize: 12, color: T.text.tertiary, marginTop: 10 }}>A senha continua a mesma; muda só a ordem na fila.</div>
      <ModalAcoes>
        <Button variant="secondary" onClick={onClose}>Voltar</Button>
        <Button onClick={salvar}>Salvar</Button>
      </ModalAcoes>
    </Modal>
  )
}
