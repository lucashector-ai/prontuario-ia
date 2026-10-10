'use client'
/**
 * Recepção — a central da recepcionista:
 *   • quem está agendado hoje (check-in conferindo os dados, ou "não veio")
 *   • quem está na clínica (senha, fila, quem foi chamado)
 *   • novo atendimento para quem chega sem horário (encaixe, agendar ou lista de espera)
 *   • como estão os médicos agora (atendendo, chamando, livre, fila)
 * Atalhos: "/" busca · "N" novo atendimento. ?demo=1 roda com dados de exemplo.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowUpDown, CheckCheck, Clock, Hourglass, MonitorPlay, Printer, RotateCcw, Settings2, Stethoscope, UserCheck, UserPlus, UserX, Users, XCircle,
} from 'lucide-react'
import { tokens as T } from '@/lib/design-tokens'
import { usePageHeader } from '@/components/shell/header-context'
import { Badge, Button, Card, EmptyState, Field, IconButton, Input, KpiCard, Modal, ModalAcoes, SearchInput, SegmentedControl, Select } from '@/components/ui'
import { confirmar, notificar } from '@/components/ui/dialogos'
import { useFila } from '@/lib/atendimento/useFila'
import { atualizarPaciente, avisarFila, carregarConfig, checkin, ehDemo, marcarFalta, mudar, type Config, type Fila } from '@/lib/atendimento/cliente'
import { formatarTelefone, minutosDesde, ordenarFila, prioridadePelaIdade, type Atendimento, type Esperado, type Prioridade } from '@/lib/atendimento/comum'
import { EscolhaPrioridade, ModalSenha, SeloPrioridade, SeloStatus, SenhaChip, esperaTexto, horaCurta, idade, imprimirSenha } from '@/components/atendimento/partes'
import { NovoAtendimento } from '@/components/atendimento/NovoAtendimento'

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
type FiltroAgenda = 'chegar' | 'atrasados'

export default function RecepcaoPage() {
  const router = useRouter()
  usePageHeader('Recepção', 'Chegadas, senhas e fila de hoje')

  const { fila, carregando, erro, recarregar } = useFila()
  const [config, setConfig] = useState<Config | null>(null)
  const [busca, setBusca] = useState('')
  const [medicoFiltro, setMedicoFiltro] = useState('')
  const [filtroAgenda, setFiltroAgenda] = useState<FiltroAgenda>('chegar')
  const [checkinDe, setCheckinDe] = useState<Esperado | null>(null)
  const [novo, setNovo] = useState(false)
  const [senhaGerada, setSenhaGerada] = useState<Atendimento | null>(null)
  const [mudarPrioridade, setMudarPrioridade] = useState<Atendimento | null>(null)
  const [agora, setAgora] = useState(() => Date.now())
  const buscaRef = useRef<HTMLInputElement>(null)

  useEffect(() => { carregarConfig().then(setConfig).catch(() => setConfig({ setores: [], consultorios: [] })) }, [])
  useEffect(() => { const t = setInterval(() => setAgora(Date.now()), 30000); return () => clearInterval(t) }, [])

  // Atalhos de teclado
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement
      if (alvo?.closest('input, textarea, select, [role=dialog]') || e.metaKey || e.ctrlKey) return
      if (e.key === '/') { e.preventDefault(); buscaRef.current?.focus() }
      if (e.key.toLowerCase() === 'n' && fila) { e.preventDefault(); setNovo(true) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [fila])

  const nomeSetor = (id: string | null) => config?.setores.find(s => s.id === id)?.nome || null
  const casa = (...campos: (string | null | undefined)[]) => {
    const q = semAcento(busca.trim())
    if (!q) return true
    const dig = q.replace(/\D/g, '')
    return semAcento(campos.filter(Boolean).join(' ')).includes(q) || (dig.length >= 3 && campos.some(c => String(c || '').replace(/\D/g, '').includes(dig)))
  }

  const todosEsperados = useMemo(() => (fila?.esperados || [])
    .filter(e => (!medicoFiltro || e.medico_id === medicoFiltro) && casa(e.paciente?.nome, e.paciente?.telefone, e.paciente?.cpf)), [fila, medicoFiltro, busca])
  const atrasados = todosEsperados.filter(e => minutosDesde(e.data_hora, agora) > 15)
  const esperados = filtroAgenda === 'atrasados' ? atrasados : todosEsperados

  const naClinica = useMemo(() => {
    const ativos = (fila?.atendimentos || []).filter(a => ['aguardando', 'chamado', 'em_atendimento', 'ausente'].includes(a.status)
      && (!medicoFiltro || a.medico_id === medicoFiltro) && casa(a.paciente?.nome, a.senha, a.paciente?.telefone))
    return {
      agora: ativos.filter(a => a.status === 'chamado' || a.status === 'em_atendimento'),
      aguardando: ordenarFila(ativos.filter(a => a.status === 'aguardando')),
      ausentes: ativos.filter(a => a.status === 'ausente'),
    }
  }, [fila, medicoFiltro, busca])
  const totalNaClinica = naClinica.agora.length + naClinica.aguardando.length + naClinica.ausentes.length
  const finalizados = (fila?.atendimentos || []).filter(a => a.status === 'finalizado' && (!medicoFiltro || a.medico_id === medicoFiltro))

  // Indicadores
  const todos = fila?.atendimentos || []
  const esperas = todos.filter(a => a.chamado_em).map(a => (new Date(a.chamado_em!).getTime() - new Date(a.chegada_em).getTime()) / 60000)
  const esperaMedia = esperas.length ? Math.round(esperas.reduce((s, x) => s + x, 0) / esperas.length) : null

  const acao = async (a: Atendimento, para: 'cancelar' | 'voltar_fila') => {
    if (para === 'cancelar' && !(await confirmar({ titulo: `Tirar ${a.paciente?.nome?.split(' ')[0] || 'paciente'} da fila?`, mensagem: `A senha ${a.senha} deixa de ser chamada. Dá para voltar depois.`, confirmar: 'Tirar da fila', perigo: true }))) return
    try { await mudar(a.id, para); avisarFila(); notificar(para === 'cancelar' ? 'Paciente tirado da fila' : 'Paciente de volta na fila') }
    catch (e: any) { notificar(e.message, 'erro') }
  }
  const naoVeio = async (e: Esperado) => {
    if (!(await confirmar({ titulo: `${e.paciente?.nome?.split(' ')[0] || 'Paciente'} não veio?`, mensagem: 'O agendamento fica marcado como falta (entra nos relatórios de faltas).', confirmar: 'Marcar falta', perigo: true }))) return
    try { await marcarFalta(e.id); avisarFila(); recarregar(); notificar('Falta registrada') } catch (er: any) { notificar(er.message, 'erro') }
  }

  // Enter na busca: um agendado só → check-in; ninguém → novo atendimento com o termo
  const enterNaBusca = () => {
    if (todosEsperados.length === 1) setCheckinDe(todosEsperados[0])
    else if (busca.trim() && todosEsperados.length === 0 && totalNaClinica === 0) setNovo(true)
  }

  const demo = ehDemo()
  const painel = config?.setores.find(s => s.ativo)
  const semSetores = config && config.setores.length === 0

  if (erro?.faltaMigration) {
    return <div className="c360-pagina"><Card><EmptyState icon={Settings2} titulo="Falta ativar o módulo de atendimento" descricao="Rode a migration 0018_atendimento_fila no Supabase (SQL Editor) e recarregue a página." /></Card></div>
  }

  return (
    <div className="c360-pagina" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Barra de ações */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <SearchInput value={busca} onChange={setBusca} inputRef={buscaRef} placeholder="Buscar paciente, CPF, telefone ou senha"
          onKeyDown={e => { if (e.key === 'Enter') enterNaBusca(); if (e.key === 'Escape') setBusca('') }}
          trailing={!busca ? <kbd style={kbd}>/</kbd> : undefined} style={{ flex: '1 1 300px', maxWidth: 460 }} />
        {(fila?.medicos.length || 0) > 1 && (
          <Select value={medicoFiltro} onChange={e => setMedicoFiltro(e.target.value)} style={{ width: 'auto', minWidth: 190 }} aria-label="Filtrar por médico">
            <option value="">Todos os médicos</option>
            {fila!.medicos.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
          </Select>
        )}
        <span style={{ flex: 1 }} />
        {painel && <Button variant="secondary" icon={MonitorPlay} onClick={() => window.open(`/painel/${painel.painel_token}${demo ? '?demo=1' : ''}`, '_blank')}>Painel da TV</Button>}
        <Button icon={UserPlus} onClick={() => setNovo(true)} disabled={!fila}>Novo atendimento <kbd style={{ ...kbd, background: 'rgba(255,255,255,.18)', color: '#fff', borderColor: 'rgba(255,255,255,.25)' }}>N</kbd></Button>
      </div>

      {semSetores && !demo && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 12, background: T.status.infoBg, color: T.status.infoStrong, fontSize: 13 }}>
          <MonitorPlay size={18} />
          <span style={{ flex: 1 }}>Cadastre a sala de espera e os consultórios para usar o painel de chamada na TV.</span>
          <Button size="sm" variant="secondary" onClick={() => router.push('/minha-clinica?aba=atendimento')}>Configurar</Button>
        </div>
      )}

      {/* Médicos agora */}
      {fila && fila.medicos.length > 0 && <MedicosAgora fila={fila} config={config} agora={agora} />}

      <div className="c360-kpis" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <KpiCard label="A chegar" valor={fila?.esperados.length ?? '—'} icon={Clock} comparacao={`${atrasados.length} atrasados`} carregando={carregando && !fila} />
        <KpiCard label="Aguardando" valor={(fila?.atendimentos || []).filter(a => a.status === 'aguardando').length} icon={Hourglass} comparacao="na sala de espera" cor={T.data.orange} carregando={carregando && !fila} />
        <KpiCard label="Atendidos" valor={(fila?.atendimentos || []).filter(a => a.status === 'finalizado').length} icon={CheckCheck} comparacao="hoje" cor={T.data.green} carregando={carregando && !fila} />
        <KpiCard label="Espera média" valor={esperaMedia === null ? '—' : esperaTexto(esperaMedia)} icon={Users} comparacao="da chegada à chamada" cor={T.data.blue} carregando={carregando && !fila} />
      </div>

      <div className="c360-recepcao-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 16, alignItems: 'start' }}>
        <style dangerouslySetInnerHTML={{ __html: '@media (max-width: 1023px) { .c360-recepcao-grid { grid-template-columns: minmax(0, 1fr) !important; } }' }} />

        {/* Agendados de hoje */}
        <Card padding={0}>
          <div style={cabecalho}>
            <span style={tituloCard}>Agendados de hoje</span>
            <SegmentedControl size="sm" value={filtroAgenda} onChange={setFiltroAgenda}
              options={[{ value: 'chegar', label: `A chegar · ${todosEsperados.length}` }, { value: 'atrasados', label: `Atrasados · ${atrasados.length}` }]} />
          </div>
          {carregando && !fila ? <Linhas /> : esperados.length === 0 ? (
            busca.trim() ? (
              <EmptyState icon={UserPlus} titulo="Não está na agenda de hoje" descricao="Busque no cadastro, cadastre o paciente ou coloque na lista de espera."
                acao={<Button icon={UserPlus} onClick={() => setNovo(true)}>Novo atendimento</Button>} />
            ) : <EmptyState icon={UserCheck} titulo={filtroAgenda === 'atrasados' ? 'Nenhum atrasado' : 'Todos já chegaram'} descricao="Os agendamentos de hoje sem check-in aparecem aqui." />
          ) : esperados.map((e, i) => {
            const atraso = minutosDesde(e.data_hora, agora)
            const anos = idade(e.paciente?.data_nascimento)
            return (
              <div key={e.id} style={{ ...linha, borderTop: i === 0 ? 'none' : linha.borderTop }}>
                <div style={{ width: 54, flexShrink: 0 }}>
                  <div className="mono" style={{ fontSize: 15, fontWeight: 700 }}>{horaCurta(e.data_hora)}</div>
                  {atraso > 15 && <div style={{ fontSize: 11, color: T.status.danger, fontWeight: 600 }}>{atraso < 120 ? `+${esperaTexto(atraso)}` : 'atrasado'}</div>}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 650, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    {e.paciente?.nome || 'Paciente'}
                    {anos !== null && <span style={{ fontSize: 12, color: T.text.tertiary, fontWeight: 500 }}>{anos} anos</span>}
                    <SeloPrioridade prioridade={prioridadePelaIdade(e.paciente?.data_nascimento)} />
                    {e.status === 'confirmado' && <Badge tone="success">Confirmou</Badge>}
                  </div>
                  <div style={{ fontSize: 12.5, color: T.text.secondary, marginTop: 2 }}>
                    {[e.medico?.nome, e.tipo === 'retorno' ? 'Retorno' : null, e.motivo, e.paciente?.convenio].filter(Boolean).join(' · ')}
                  </div>
                </div>
                <IconButton icon={UserX} size={32} tone="danger" title="Não veio (marcar falta)" onClick={() => naoVeio(e)} />
                <Button size="sm" icon={UserCheck} onClick={() => setCheckinDe(e)}>Chegou</Button>
              </div>
            )
          })}
        </Card>

        {/* Na clínica */}
        <Card padding={0}>
          <div style={cabecalho}><span style={tituloCard}>Na clínica · {totalNaClinica}</span></div>
          {carregando && !fila ? <Linhas /> : totalNaClinica === 0 ? (
            <EmptyState icon={Users} titulo="Sala de espera vazia" descricao="Depois do check-in, o paciente aparece aqui com a senha." />
          ) : (
            <>
              {naClinica.agora.length > 0 && <Secao titulo="Chamados e em atendimento" />}
              {naClinica.agora.map(a => <LinhaNaClinica key={a.id} a={a} agora={agora} />)}
              {naClinica.aguardando.length > 0 && <Secao titulo="Aguardando" />}
              {naClinica.aguardando.map(a => (
                <LinhaNaClinica key={a.id} a={a} agora={agora} posicao={naClinica.aguardando.filter(x => x.medico_id === a.medico_id).indexOf(a) + 1}>
                  <IconButton icon={Printer} size={30} title="Reimprimir senha" onClick={() => imprimirSenha(a, nomeSetor(a.setor_id))} />
                  <IconButton icon={ArrowUpDown} size={30} title="Mudar prioridade" onClick={() => setMudarPrioridade(a)} />
                  <IconButton icon={XCircle} size={30} tone="danger" title="Tirar da fila" onClick={() => acao(a, 'cancelar')} />
                </LinhaNaClinica>
              ))}
              {naClinica.ausentes.length > 0 && <Secao titulo="Não atenderam à chamada" />}
              {naClinica.ausentes.map(a => (
                <LinhaNaClinica key={a.id} a={a} agora={agora}>
                  <Button size="sm" variant="secondary" icon={RotateCcw} onClick={() => acao(a, 'voltar_fila')}>Voltar à fila</Button>
                </LinhaNaClinica>
              ))}
            </>
          )}
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

      {checkinDe && <ModalCheckin esperado={checkinDe} onClose={() => setCheckinDe(null)} onPronto={at => { setCheckinDe(null); setBusca(''); setSenhaGerada(at); avisarFila() }} />}
      {novo && fila && (
        <NovoAtendimento fila={fila} buscaInicial={busca.trim()} medicoInicial={medicoFiltro} onClose={() => setNovo(false)}
          onSenha={at => { setNovo(false); setBusca(''); setSenhaGerada(at); avisarFila() }} />
      )}
      {senhaGerada && <ModalSenha at={senhaGerada} setor={nomeSetor(senhaGerada.setor_id)} onClose={() => setSenhaGerada(null)} />}
      {mudarPrioridade && <ModalPrioridade at={mudarPrioridade} onClose={() => setMudarPrioridade(null)} />}
    </div>
  )
}

const kbd: React.CSSProperties = { fontSize: 11, border: `1px solid ${T.border.default}`, borderRadius: 6, padding: '1px 6px', background: T.bg.page, color: T.text.secondary, fontFamily: 'inherit' }
const linha: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderTop: `1px solid ${T.border.muted}` }
const cabecalho: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', padding: '14px 16px', borderBottom: `1px solid ${T.border.muted}` }
const tituloCard: React.CSSProperties = { fontSize: 15, fontWeight: 700, letterSpacing: '-.01em' }

function Secao({ titulo }: { titulo: string }) {
  return <div style={{ padding: '10px 16px 4px', fontSize: 11.5, fontWeight: 700, color: T.text.tertiary, textTransform: 'uppercase', letterSpacing: '.06em' }}>{titulo}</div>
}

function LinhaNaClinica({ a, agora, posicao, children }: { a: Atendimento; agora: number; posicao?: number; children?: React.ReactNode }) {
  return (
    <div style={{ ...linha, borderTop: 'none', padding: '10px 16px' }}>
      <SenhaChip senha={a.senha} destaque={a.status === 'chamado'} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 650, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          {a.paciente?.nome || 'Paciente'} <SeloPrioridade prioridade={a.prioridade} />
        </div>
        <div style={{ fontSize: 12.5, color: T.text.secondary, marginTop: 2 }}>
          {a.medico?.nome}
          {a.status === 'aguardando' && ` · ${posicao}º na fila · espera ${esperaTexto(minutosDesde(a.chegada_em, agora))}`}
          {(a.status === 'chamado' || a.status === 'em_atendimento') && a.consultorio && ` · ${a.consultorio.nome}`}
          {a.status === 'chamado' && a.chamadas > 1 && ` · chamado ${a.chamadas}x`}
        </div>
      </div>
      {a.status !== 'aguardando' && <SeloStatus status={a.status} />}
      {children && <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>{children}</div>}
    </div>
  )
}

/** Faixa "Médicos agora": quem está atendendo, chamando ou livre, e o tamanho da fila de cada um. */
function MedicosAgora({ fila, config, agora }: { fila: Fila; config: Config | null; agora: number }) {
  return (
    <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 2 }}>
      {fila.medicos.map(m => {
        const meus = fila.atendimentos.filter(a => a.medico_id === m.id)
        const atual = meus.find(a => a.status === 'em_atendimento') || meus.find(a => a.status === 'chamado')
        const naFila = meus.filter(a => a.status === 'aguardando').length
        const sala = config?.consultorios.find(c => c.id === (atual?.consultorio_id || m.consultorio_id))?.nome
        const estado = atual?.status === 'em_atendimento' ? { t: `Atendendo · ${atual.paciente?.nome?.split(' ')[0] || atual.senha}`, cor: T.status.info, bg: T.status.infoBg }
          : atual ? { t: `Chamando ${atual.senha}`, cor: T.brand.primary, bg: T.brand.primarySubtle }
          : { t: 'Livre', cor: T.status.success, bg: T.status.successBg }
        return (
          <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 14, background: '#fff', border: `1px solid ${T.border.default}`, minWidth: 230, flexShrink: 0 }}>
            <span style={{ width: 34, height: 34, borderRadius: 11, display: 'grid', placeItems: 'center', background: estado.bg, color: estado.cor, flexShrink: 0 }}><Stethoscope size={17} /></span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 650, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.nome}</div>
              <div style={{ fontSize: 12, color: estado.cor, fontWeight: 600, whiteSpace: 'nowrap' }}>
                {estado.t}{atual?.status === 'em_atendimento' && atual.inicio_em ? ` · ${esperaTexto(minutosDesde(atual.inicio_em, agora))}` : ''}
              </div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 750 }}>{naFila}</div>
              <div style={{ fontSize: 10.5, color: T.text.tertiary }}>{sala || 'na fila'}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function Linhas() {
  return <>{[0, 1, 2].map(i => <div key={i} style={linha}><span className="c360-skel" style={{ width: 52, height: 16, borderRadius: 6 }} /><span style={{ flex: 1 }}><span className="c360-skel" style={{ display: 'block', height: 12, width: '60%', borderRadius: 6 }} /></span></div>)}</>
}

/** Check-in: confere os dados que mais mudam (celular, convênio, CPF) e a prioridade. */
function ModalCheckin({ esperado, onClose, onPronto }: { esperado: Esperado; onClose: () => void; onPronto: (a: Atendimento) => void }) {
  const p = esperado.paciente
  const sugerida = prioridadePelaIdade(p?.data_nascimento)
  const [prioridade, setPrioridade] = useState<Prioridade>(sugerida)
  const [telefone, setTelefone] = useState(formatarTelefone(p?.telefone))
  const [convenio, setConvenio] = useState(p?.convenio || '')
  const [cpf, setCpf] = useState(p?.cpf || '')
  const [salvando, setSalvando] = useState(false)

  const confirmarChegada = async () => {
    setSalvando(true)
    try {
      if (p?.id) {
        const mudou: Record<string, string> = {}
        if (telefone.replace(/\D/g, '') !== String(p.telefone || '').replace(/\D/g, '')) mudou.telefone = telefone
        if (convenio.trim() !== (p.convenio || '')) mudou.convenio = convenio.trim()
        if (cpf.replace(/\D/g, '') !== String(p.cpf || '').replace(/\D/g, '')) mudou.cpf = cpf
        if (Object.keys(mudou).length) await atualizarPaciente(p.id, mudou)
      }
      const r = await checkin({ agendamento_id: esperado.id, prioridade })
      onPronto(r.atendimento)
    } catch (e: any) { notificar(e.message, 'erro'); setSalvando(false) }
  }

  return (
    <Modal titulo={`Chegada de ${p?.nome?.split(' ')[0] || 'paciente'}`} onClose={onClose} largura={500}>
      <div style={{ fontSize: 13.5, color: T.text.secondary, marginBottom: 14 }}>
        <b style={{ color: T.text.primary }}>{p?.nome}</b> · {esperado.medico?.nome} · {horaCurta(esperado.data_hora)}{esperado.motivo ? ` · ${esperado.motivo}` : ''}
      </div>
      <div style={{ fontSize: 12, fontWeight: 700, color: T.text.tertiary, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>Conferir dados</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10, marginBottom: 16 }}>
        <Field label="Celular"><Input value={telefone} onChange={e => setTelefone(e.target.value)} placeholder="(11) 98765-4321" inputMode="tel" /></Field>
        <Field label="Convênio"><Input value={convenio} onChange={e => setConvenio(e.target.value)} placeholder="Particular" /></Field>
        <Field label="CPF"><Input value={cpf} onChange={e => setCpf(e.target.value)} placeholder="000.000.000-00" inputMode="numeric" /></Field>
      </div>
      <Field label="Atendimento"><EscolhaPrioridade valor={prioridade} onChange={setPrioridade} sugerida={sugerida} /></Field>
      <ModalAcoes>
        <Button variant="secondary" onClick={onClose}>Voltar</Button>
        <Button icon={UserCheck} onClick={confirmarChegada} disabled={salvando}>{salvando ? 'Gerando senha…' : 'Confirmar chegada'}</Button>
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
