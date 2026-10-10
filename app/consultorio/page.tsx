'use client'
/**
 * Consultório — a estação do médico durante o turno, tudo numa tela:
 *   fila do dia (chamar próximo / um específico / de novo) · paciente atual com a
 *   ficha (alergias, remédios, pré-consulta do WhatsApp, últimas consultas) ·
 *   gravação da consulta com prontuário pela IA · finalizar com retorno.
 * ?demo=1 roda com dados de exemplo, sem gravar nada.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle, BellRing, CalendarPlus, CheckCircle2, ClipboardList, DoorOpen, ExternalLink, History, Megaphone, MessageCircle,
  MonitorPlay, Pill, Play, Settings2, Stethoscope, UserX, Users,
} from 'lucide-react'
import { tokens as T } from '@/lib/design-tokens'
import { usePageHeader } from '@/components/shell/header-context'
import { Badge, Button, Card, Chip, EmptyState, Field, Input, Modal, ModalAcoes, Select, Switch, Textarea } from '@/components/ui'
import { confirmar, notificar } from '@/components/ui/dialogos'
import { useFila } from '@/lib/atendimento/useFila'
import { abrirFicha, avisarFila, carregarConfig, carregarFicha, chamar, definirConsultorio, ehDemo, mudar, type Config, type Ficha } from '@/lib/atendimento/cliente'
import { formatarTelefone, hojeSP, minutosDesde, ordenarFila, type Atendimento } from '@/lib/atendimento/comum'
import { SeloPrioridade, SeloStatus, SenhaChip, esperaTexto, horaCurta, idade } from '@/components/atendimento/partes'
import { GravadorConsulta } from '@/components/atendimento/GravadorConsulta'

const PRAZOS_RETORNO = [7, 15, 30, 60, 90, 180]

export default function ConsultorioPage() {
  const router = useRouter()
  usePageHeader('Consultório', 'Chame, atenda e registre — tudo nesta tela')

  const [medicoLogado, setMedicoLogado] = useState<string | null>(null)
  const [medicoId, setMedicoId] = useState<string>('')
  const [consultorioId, setConsultorioId] = useState<string>('')
  const [config, setConfig] = useState<Config | null>(null)
  const [chamando, setChamando] = useState(false)
  const [finalizando, setFinalizando] = useState<Atendimento | null>(null)
  const [consultaSalva, setConsultaSalva] = useState(false)
  // Chamada automática: ao finalizar, já chama o próximo. Desligada por padrão — o médico decide quando chamar.
  const [autoChamar, setAutoChamar] = useState(false)
  useEffect(() => { try { setAutoChamar(localStorage.getItem('c360-chamada-automatica') === '1') } catch {} }, [])
  const trocarAuto = (v: boolean) => { setAutoChamar(v); try { localStorage.setItem('c360-chamada-automatica', v ? '1' : '0') } catch {} }
  const [agora, setAgora] = useState(() => Date.now())
  const demo = ehDemo()

  useEffect(() => {
    try {
      const m = localStorage.getItem('medico')
      if (m && !localStorage.getItem('clinica_admin')) {
        const med = JSON.parse(m)
        if (med.cargo !== 'recepcionista') { setMedicoLogado(med.id); setMedicoId(demo ? 'demo-medico' : med.id) }
      } else {
        const salvo = localStorage.getItem('c360-consultorio-medico')
        if (salvo) setMedicoId(salvo)
      }
    } catch {}
    carregarConfig().then(setConfig).catch(() => setConfig({ setores: [], consultorios: [] }))
    const t = setInterval(() => setAgora(Date.now()), 30000)
    return () => clearInterval(t)
  }, [demo])

  const { fila, carregando, erro, recarregar } = useFila(medicoId || null, !!medicoId || !medicoLogado)

  useEffect(() => { if (!medicoId && fila?.medicos.length) setMedicoId(fila.medicos[0].id) }, [fila, medicoId])

  // Consultório do dia: escolhido ao entrar (vale para hoje, neste computador, para este médico)
  const [escolhendoSala, setEscolhendoSala] = useState(false)
  useEffect(() => {
    if (!config || !medicoId) return
    const ativos = config.consultorios.filter(c => c.ativo)
    if (!ativos.length) return
    let salvo: { dia?: string; id?: string } = {}
    try { salvo = JSON.parse(localStorage.getItem('c360-sala-' + medicoId) || '{}') } catch {}
    if (salvo.dia === hojeSP() && ativos.some(c => c.id === salvo.id)) setConsultorioId(salvo.id!)
    else if (ativos.length === 1) escolherSala(ativos[0].id)
    else { setConsultorioId(''); setEscolhendoSala(true) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, medicoId])

  const escolherMedico = (id: string) => { setMedicoId(id); try { localStorage.setItem('c360-consultorio-medico', id) } catch {} }
  const escolherSala = (id: string) => {
    setConsultorioId(id); setEscolhendoSala(false)
    try { localStorage.setItem('c360-sala-' + medicoId, JSON.stringify({ dia: hojeSP(), id })) } catch {}
    if (medicoId) definirConsultorio(medicoId, id).catch(() => {})
  }

  const meus = useMemo(() => (fila?.atendimentos || []).filter(a => a.medico_id === medicoId), [fila, medicoId])
  const atual = useMemo(() => meus.filter(a => a.status === 'em_atendimento' || a.status === 'chamado')
    .sort((a, b) => (b.chamado_em || '').localeCompare(a.chamado_em || ''))[0] || null, [meus])
  const espera = useMemo(() => ordenarFila(meus.filter(a => a.status === 'aguardando')), [meus])
  const ausentes = meus.filter(a => a.status === 'ausente')
  const atendidos = meus.filter(a => a.status === 'finalizado').sort((a, b) => (b.fim_em || '').localeCompare(a.fim_em || ''))
  const naoChegaram = (fila?.esperados || []).filter(e => e.medico_id === medicoId)
  const sala = config?.consultorios.find(c => c.id === consultorioId)
  const setor = config?.setores.find(s => s.id === sala?.setor_id)

  const chamarProximo = async (atendimentoId?: string, rechamar = false) => {
    if (!medicoId) return
    setChamando(true)
    try {
      const r = await chamar({ medico_id: medicoId, consultorio_id: consultorioId || null, atendimento_id: atendimentoId, rechamar })
      if (r.fila_vazia) notificar('Ninguém aguardando na sua fila agora', 'info')
      else notificar(rechamar ? `Senha ${r.atendimento!.senha} chamada de novo` : `Chamando ${r.atendimento!.senha} — ${r.atendimento!.paciente?.nome?.split(' ')[0] || ''}`)
      avisarFila(); recarregar()
    } catch (e: any) { notificar(e.message, 'erro') }
    finally { setChamando(false) }
  }

  const mudarAtual = async (para: 'iniciar' | 'ausente') => {
    if (!atual) return
    try { await mudar(atual.id, para); avisarFila(); recarregar() } catch (e: any) { notificar(e.message, 'erro') }
  }

  const pedirFinalizar = async () => {
    if (!atual) return
    if (!consultaSalva && !(await confirmar({ titulo: 'Finalizar sem prontuário?', mensagem: 'Esta consulta ainda não foi gravada nem salva no histórico do paciente.', confirmar: 'Finalizar mesmo assim' }))) return
    setFinalizando(atual)
  }

  const aoProntuario = useCallback((salvo: boolean) => setConsultaSalva(salvo), [])

  if (erro?.faltaMigration) {
    return <div className="c360-pagina"><Card><EmptyState icon={Settings2} titulo="Falta ativar o módulo de atendimento" descricao="Rode a migration 0018_atendimento_fila no Supabase (SQL Editor) e recarregue a página." /></Card></div>
  }

  const semSalas = config && config.consultorios.filter(c => c.ativo).length === 0
  const podeChamar = !chamando && espera.length > 0 && !atual

  return (
    <div className="c360-pagina" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Barra: quem, onde, chamar */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        {!medicoLogado && (fila?.medicos.length || 0) > 0 && (
          <Select value={medicoId} onChange={e => escolherMedico(e.target.value)} style={{ width: 'auto', minWidth: 200 }} aria-label="Médico">
            {fila!.medicos.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
          </Select>
        )}
        {config && config.consultorios.length > 0 && (
          <button onClick={() => setEscolhendoSala(true)} title="Trocar de consultório" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8, height: 36, padding: '0 12px', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit',
            border: `1px solid ${T.border.default}`, background: '#fff', fontSize: 13, fontWeight: 600, color: T.text.primary,
          }}>
            <DoorOpen size={16} color={T.brand.primary} /> {sala?.nome || 'Escolher consultório'}
            <span style={{ color: T.brand.primary, fontWeight: 600, fontSize: 12.5 }}>Trocar</span>
          </button>
        )}
        {setor && <Button variant="ghost" icon={MonitorPlay} onClick={() => window.open(`/painel/${setor.painel_token}${demo ? '?demo=1' : ''}`, '_blank')}>Painel da TV</Button>}
        <span style={{ flex: 1 }} />
        <Switch checked={autoChamar} onChange={trocarAuto} label="Chamada automática" />
        <span style={{ fontSize: 13, color: T.text.secondary }}><b style={{ color: T.text.primary }}>{espera.length}</b> na espera · <b style={{ color: T.text.primary }}>{atendidos.length}</b> atendidos</span>
        <Button icon={Megaphone} onClick={() => chamarProximo()} disabled={!podeChamar} title={atual ? 'Finalize o paciente atual primeiro' : undefined}>
          {chamando ? 'Chamando…' : espera.length ? `Chamar próximo · ${espera[0].senha}` : 'Fila vazia'}
        </Button>
      </div>

      {semSalas && !demo && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 12, background: T.status.infoBg, color: T.status.infoStrong, fontSize: 13 }}>
          <DoorOpen size={18} />
          <span style={{ flex: 1 }}>Cadastre os consultórios para o painel da TV mostrar para onde o paciente deve ir.</span>
          <Button size="sm" variant="secondary" onClick={() => router.push('/minha-clinica?aba=atendimento')}>Configurar</Button>
        </div>
      )}

      <div className="c360-consultorio-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 320px) minmax(0, 1fr)', gap: 16, alignItems: 'start' }}>
        <style dangerouslySetInnerHTML={{ __html: '@media (max-width: 1023px) { .c360-consultorio-grid { grid-template-columns: minmax(0, 1fr) !important; } .c360-consultorio-fila { order: 2 } }' }} />

        {/* Fila */}
        <div className="c360-consultorio-fila" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Card padding={0}>
            <div style={cab}><Users size={15} /> Na espera · {espera.length}</div>
            {carregando && !fila ? <div style={{ padding: 16 }}><span className="c360-skel" style={{ display: 'block', height: 14, borderRadius: 6 }} /></div>
              : espera.length === 0 ? <div style={vazio}>Ninguém na sala de espera.</div>
              : espera.map((a, i) => (
                <div key={a.id} style={{ ...linha, borderTop: i === 0 ? 'none' : linha.borderTop }}>
                  <span style={{ width: 20, fontSize: 12, color: T.text.tertiary, fontWeight: 650 }}>{i + 1}º</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <SenhaChip senha={a.senha} />
                      <span style={{ fontSize: 13, fontWeight: 650, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.paciente?.nome?.split(' ').slice(0, 2).join(' ')}</span>
                    </div>
                    <div style={{ fontSize: 11.5, color: T.text.secondary, marginTop: 3, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                      {a.horario_previsto ? `agendado ${horaCurta(a.horario_previsto)}` : 'encaixe'} · espera {esperaTexto(minutosDesde(a.chegada_em, agora))}
                      <SeloPrioridade prioridade={a.prioridade} />
                    </div>
                  </div>
                  <Button size="sm" variant="secondary" onClick={() => chamarProximo(a.id)} disabled={chamando || !!atual}>Chamar</Button>
                </div>
              ))}
            {ausentes.length > 0 && (
              <div style={{ borderTop: `1px solid ${T.border.muted}`, padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: T.text.tertiary, textTransform: 'uppercase', letterSpacing: '.05em' }}>Não atenderam à chamada</div>
                {ausentes.map(a => (
                  <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                    <SenhaChip senha={a.senha} /><span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.paciente?.nome?.split(' ')[0]}</span>
                    <Button size="sm" variant="ghost" icon={BellRing} onClick={() => chamarProximo(a.id)} disabled={chamando || !!atual}>De novo</Button>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card padding={0}>
            <details>
              <summary style={{ ...cab, cursor: 'pointer', borderBottom: 'none' }}>Ainda não chegaram · {naoChegaram.length}</summary>
              {naoChegaram.length === 0 ? <div style={vazio}>Todos os agendados já chegaram.</div> : naoChegaram.map(e => (
                <div key={e.id} style={{ ...linha, padding: '8px 14px' }}>
                  <span className="mono" style={{ fontSize: 12.5, fontWeight: 700, width: 42 }}>{horaCurta(e.data_hora)}</span>
                  <span style={{ flex: 1, fontSize: 12.5, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.paciente?.nome}</span>
                  {minutosDesde(e.data_hora, agora) > 15 && <Badge tone="danger">atrasado</Badge>}
                </div>
              ))}
            </details>
          </Card>

          <Card padding={0}>
            <details>
              <summary style={{ ...cab, cursor: 'pointer', borderBottom: 'none' }}>Atendidos hoje · {atendidos.length}</summary>
              {atendidos.length === 0 ? <div style={vazio}>Nenhum ainda.</div> : atendidos.map(a => (
                <div key={a.id} style={{ ...linha, padding: '8px 14px' }}>
                  <CheckCircle2 size={15} color={T.status.success} />
                  <span style={{ flex: 1, fontSize: 12.5 }}>{a.paciente?.nome?.split(' ').slice(0, 2).join(' ')}</span>
                  <span className="mono" style={{ fontSize: 11.5, color: T.text.tertiary }}>{horaCurta(a.inicio_em)}–{horaCurta(a.fim_em)}</span>
                </div>
              ))}
            </details>
          </Card>
        </div>

        {/* Atendimento */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          {carregando && !fila ? (
            <Card><span className="c360-skel" style={{ display: 'block', height: 22, width: '50%', borderRadius: 8 }} /><span className="c360-skel" style={{ display: 'block', height: 14, width: '30%', borderRadius: 6, marginTop: 12 }} /></Card>
          ) : atual ? (
            <PacienteAtual key={atual.id} at={atual} medicoId={medicoId} agora={agora} chamando={chamando}
              onEntrou={() => mudarAtual('iniciar')} onAusente={() => mudarAtual('ausente')} onRechamar={() => chamarProximo(atual.id, true)}
              onFinalizar={pedirFinalizar} onProntuario={aoProntuario} />
          ) : (
            <Card>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '28px 10px', gap: 12 }}>
                <span style={{ width: 56, height: 56, borderRadius: 18, display: 'grid', placeItems: 'center', background: T.brand.primarySubtle, color: T.brand.primary }}><DoorOpen size={26} /></span>
                <div style={{ fontSize: 18, fontWeight: 700 }}>Consultório livre</div>
                <div style={{ fontSize: 13.5, color: T.text.secondary, maxWidth: 420 }}>
                  {espera.length ? `${espera.length} ${espera.length === 1 ? 'paciente aguardando' : 'pacientes aguardando'}. O próximo é ${espera[0].paciente?.nome?.split(' ')[0] || espera[0].senha}${espera[0].prioridade !== 'normal' ? ' (prioritário)' : ''}.` : 'Ninguém aguardando agora. Quando a recepção confirmar a chegada, o paciente aparece aqui.'}
                </div>
                <button onClick={() => chamarProximo()} disabled={!podeChamar} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 12, height: 64, padding: '0 34px', borderRadius: 18, border: 'none', marginTop: 6,
                  fontFamily: 'inherit', fontSize: 18, fontWeight: 700, color: '#fff', cursor: podeChamar ? 'pointer' : 'not-allowed',
                  background: T.brand.primary, boxShadow: '0 10px 24px -10px rgba(90, 64, 220, .55)', opacity: podeChamar ? 1 : 0.45,
                }}>
                  <Megaphone size={22} /> {chamando ? 'Chamando…' : espera.length ? `Chamar próximo · ${espera[0].senha}` : 'Fila vazia'}
                </button>
              </div>
            </Card>
          )}
        </div>
      </div>

      {erro && !erro.faltaMigration && (
        <div style={{ fontSize: 13, color: T.status.danger, display: 'flex', alignItems: 'center', gap: 10 }}>
          {erro.msg} <Button size="sm" variant="secondary" onClick={recarregar}>Tentar de novo</Button>
        </div>
      )}

      {escolhendoSala && config && (
        <ModalSala config={config} atual={consultorioId} outros={(fila?.medicos || []).filter(m => m.id !== medicoId)}
          onEscolher={escolherSala} onClose={consultorioId ? () => setEscolhendoSala(false) : undefined} />
      )}

      {finalizando && (
        <ModalFinalizar at={finalizando} chamarDepois={autoChamar && espera.length > 0} onClose={() => setFinalizando(null)}
          onPronto={async (chamarSeguinte) => {
            try { sessionStorage.removeItem('c360-consulta-' + finalizando.id) } catch {}
            setFinalizando(null); setConsultaSalva(false); avisarFila(); await recarregar()
            if (chamarSeguinte) chamarProximo()
          }} />
      )}
    </div>
  )
}

const cab: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px', fontSize: 13.5, fontWeight: 700, borderBottom: `1px solid ${T.border.muted}`, listStyle: 'none' }
const linha: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderTop: `1px solid ${T.border.muted}` }
const vazio: React.CSSProperties = { padding: '14px', fontSize: 13, color: T.text.tertiary }

function PacienteAtual({ at, medicoId, agora, chamando, onEntrou, onAusente, onRechamar, onFinalizar, onProntuario }: {
  at: Atendimento; medicoId: string; agora: number; chamando: boolean
  onEntrou: () => void; onAusente: () => void; onRechamar: () => void; onFinalizar: () => void; onProntuario: (salvo: boolean) => void
}) {
  const [ficha, setFicha] = useState<Ficha | null>(null)
  useEffect(() => {
    if (!at.paciente_id) return
    carregarFicha(at.paciente_id, at.agendamento_id).then(setFicha).catch(() => setFicha(null))
  }, [at.paciente_id, at.agendamento_id])

  const anos = idade(at.paciente?.data_nascimento)
  const emAtendimento = at.status === 'em_atendimento'
  const abrirFerramentas = () => {
    const q = new URLSearchParams({ paciente_id: at.paciente_id || '', paciente_nome: at.paciente?.nome || '', paciente_tel: at.paciente?.telefone || '' })
    window.open(`/nova-consulta?${q}`, '_blank')
  }

  return (
    <>
      {/* Cabeçalho do paciente */}
      <Card padding={0} style={{ overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', padding: '18px 20px', background: emAtendimento ? '#fff' : T.brand.primarySubtle }}>
          <span className="mono" style={{ fontSize: 30, fontWeight: 800, color: T.brand.primary, letterSpacing: '-.02em' }}>{at.senha}</span>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <button onClick={() => abrirFicha(at.paciente_id)} title="Ver ficha e histórico" style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 19, fontWeight: 700, letterSpacing: '-.01em', color: T.text.primary }}>{at.paciente?.nome || 'Paciente'}</button>
              <SeloStatus status={at.status} /><SeloPrioridade prioridade={at.prioridade} />
              {ficha?.paciente.alergias && <Badge tone="danger" icon={AlertTriangle}>Alergia: {ficha.paciente.alergias}</Badge>}
            </div>
            <div style={{ fontSize: 13, color: T.text.secondary, marginTop: 3 }}>
              {[anos !== null ? `${anos} anos` : null, ficha?.paciente.convenio, at.horario_previsto ? `agendado ${horaCurta(at.horario_previsto)}` : 'encaixe',
                emAtendimento ? `em consulta há ${esperaTexto(minutosDesde(at.inicio_em, agora))}` : `chamado há ${esperaTexto(minutosDesde(at.chamado_em, agora))}${at.chamadas > 1 ? ` (${at.chamadas}x)` : ''}`]
                .filter(Boolean).join(' · ')}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {emAtendimento ? (
              <Button variant="dark" icon={CheckCircle2} onClick={onFinalizar}>Finalizar atendimento</Button>
            ) : (
              <>
                <Button variant="ghost" icon={UserX} onClick={onAusente} style={{ color: T.status.danger }}>Não compareceu</Button>
                <Button variant="secondary" icon={BellRing} onClick={onRechamar} disabled={chamando}>Chamar de novo</Button>
                <Button icon={Play} onClick={onEntrou}>Paciente entrou</Button>
              </>
            )}
          </div>
        </div>
      </Card>

      <div className="c360-atendimento-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(240px, 300px)', gap: 16, alignItems: 'start' }}>
        <style dangerouslySetInnerHTML={{ __html: '@media (max-width: 1439px) { .c360-atendimento-grid { grid-template-columns: minmax(0, 1fr) !important; } }' }} />

        {/* Consulta */}
        <Card titulo={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Stethoscope size={16} /> Consulta</span>}
          acao={<Button size="sm" variant="ghost" icon={ExternalLink} onClick={abrirFerramentas}>Receita, atestado e exames</Button>}>
          {emAtendimento ? (
            <GravadorConsulta chave={at.id} medicoId={medicoId} paciente={{ id: at.paciente_id, nome: at.paciente?.nome || '' }} onProntuario={onProntuario} />
          ) : (
            <div style={{ fontSize: 13.5, color: T.text.secondary, padding: '8px 0' }}>
              Quando {at.paciente?.nome?.split(' ')[0] || 'o paciente'} entrar, clique em <b>Paciente entrou</b> para começar a consulta e a gravação.
            </div>
          )}
        </Card>

        {/* Ficha */}
        <FichaLateral ficha={ficha} pacienteId={at.paciente_id} />
      </div>
    </>
  )
}

function FichaLateral({ ficha, pacienteId }: { ficha: Ficha | null; pacienteId: string | null }) {
  if (!pacienteId) return null
  if (!ficha) return <Card><span className="c360-skel" style={{ display: 'block', height: 80, borderRadius: 10 }} /></Card>
  const p = ficha.paciente
  const item = (icon: any, titulo: string, texto: string | null, alerta = false) => texto ? (
    <div style={{ display: 'flex', gap: 8 }}>
      {(() => { const I = icon; return <I size={15} color={alerta ? T.status.danger : T.text.tertiary} style={{ flexShrink: 0, marginTop: 2 }} /> })()}
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: alerta ? T.status.danger : T.text.tertiary, textTransform: 'uppercase', letterSpacing: '.05em' }}>{titulo}</div>
        <div style={{ fontSize: 13, color: alerta ? T.status.danger : T.text.primary, fontWeight: alerta ? 600 : 400, lineHeight: 1.45 }}>{texto}</div>
      </div>
    </div>
  ) : null

  return (
    <Card titulo="Ficha" acao={<button onClick={() => abrirFicha(pacienteId)} style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontSize: 12.5, fontWeight: 600, color: T.brand.primary, fontFamily: 'inherit' }}>Histórico completo</button>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {item(AlertTriangle, 'Alergias', p.alergias, true)}
        {item(ClipboardList, 'Doenças', p.comorbidades)}
        {item(Pill, 'Remédios em uso', p.medicamentos_uso)}
        {item(ClipboardList, 'Motivo', ficha.agendamento?.motivo || null)}
        {ficha.agendamento?.pre_consulta_contexto && (
          <div style={{ padding: 10, borderRadius: 10, background: T.status.successBg }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: T.status.success, textTransform: 'uppercase', letterSpacing: '.05em' }}><MessageCircle size={13} /> Pré-consulta (WhatsApp)</div>
            <div style={{ fontSize: 12.5, marginTop: 4, lineHeight: 1.45, whiteSpace: 'pre-wrap', maxHeight: 140, overflowY: 'auto' }}>{ficha.agendamento.pre_consulta_contexto}</div>
          </div>
        )}
        {!p.alergias && !p.comorbidades && !p.medicamentos_uso && !ficha.agendamento?.motivo && <div style={{ fontSize: 12.5, color: T.text.tertiary }}>Sem alergias, doenças ou remédios registrados.</div>}
        {p.telefone && <div style={{ fontSize: 12.5, color: T.text.secondary }}>Celular: {formatarTelefone(p.telefone)}</div>}

        <div style={{ borderTop: `1px solid ${T.border.muted}`, paddingTop: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: T.text.tertiary, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}><History size={13} /> Últimas consultas</div>
          {ficha.consultas.length === 0 ? <div style={{ fontSize: 12.5, color: T.text.tertiary }}>Primeira consulta.</div> : ficha.consultas.map(c => (
            <div key={c.id} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11.5, color: T.text.tertiary }}>{new Date(c.data_hora || c.criado_em).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
              <div style={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.4 }}>{c.diagnostico_principal || (Array.isArray(c.cids) && c.cids[0]?.descricao) || 'Consulta'}</div>
              {c.plano && <div style={{ fontSize: 12, color: T.text.secondary, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{c.plano}</div>}
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}

const PARA_RECEPCAO: { v: string; label: string }[] = [
  { v: 'exames', label: 'Pedido de exames' }, { v: 'receita', label: 'Receita' }, { v: 'atestado', label: 'Atestado/declaração' },
  { v: 'procedimento', label: 'Agendar procedimento' }, { v: 'encaminhamento', label: 'Encaminhamento' },
]

function ModalFinalizar({ at, chamarDepois, onClose, onPronto }: { at: Atendimento; chamarDepois: boolean; onClose: () => void; onPronto: (chamarProximo: boolean) => void }) {
  const [dias, setDias] = useState<number | null>(null)
  const [outro, setOutro] = useState('')
  const [motivo, setMotivo] = useState('')
  const [itens, setItens] = useState<string[]>([])
  const [recado, setRecado] = useState('')
  const [salvando, setSalvando] = useState(false)
  const prazo = dias ?? (Number(outro) > 0 ? Number(outro) : null)
  const vaiParaRecepcao = !!prazo || itens.length > 0 || !!recado.trim()
  const alternar = (v: string) => setItens(l => l.includes(v) ? l.filter(x => x !== v) : [...l, v])

  const finalizar = async () => {
    setSalvando(true)
    try {
      await mudar(at.id, 'finalizar', {
        retorno: prazo ? { dias: prazo, motivo: motivo.trim() || undefined } : null,
        saida: itens.length || recado.trim() ? { itens, obs: recado.trim() || undefined } : null,
      })
      notificar(vaiParaRecepcao ? 'Atendimento finalizado · a recepção já foi avisada' : 'Atendimento finalizado')
      onPronto(chamarDepois)
    } catch (e: any) { notificar(e.message, 'erro'); setSalvando(false) }
  }

  return (
    <Modal titulo={`Finalizar · ${at.paciente?.nome?.split(' ')[0] || at.senha}`} onClose={onClose} largura={540}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Field label="Retorno" hint="A recepção recebe o aviso na hora e agenda com o paciente na saída.">
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <Chip ativo={dias === null && !outro} onClick={() => { setDias(null); setOutro('') }}>Sem retorno</Chip>
            {PRAZOS_RETORNO.map(d => <Chip key={d} ativo={dias === d} onClick={() => { setDias(d); setOutro('') }} icon={CalendarPlus}>{d < 60 ? `${d} dias` : `${d / 30} meses`}</Chip>)}
            <Input value={outro} onChange={e => { setOutro(e.target.value.replace(/\D/g, '').slice(0, 3)); setDias(null) }} placeholder="Outro (dias)" inputMode="numeric" style={{ width: 120, height: 32 }} />
          </div>
        </Field>
        {prazo && (
          <Field label="Motivo do retorno (opcional)">
            <Input value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Ex.: trazer exames de sangue" />
          </Field>
        )}
        <Field label="Para a recepção">
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {PARA_RECEPCAO.map(o => <Chip key={o.v} ativo={itens.includes(o.v)} onClick={() => alternar(o.v)}>{o.label}</Chip>)}
          </div>
        </Field>
        <Field label="Recado para a recepção (opcional)">
          <Textarea value={recado} onChange={e => setRecado(e.target.value)} rows={2} placeholder="Ex.: agendar fisioterapia 2x por semana; cobrar só a consulta" maxLength={500} />
        </Field>
        {vaiParaRecepcao && (
          <div style={{ fontSize: 12.5, color: T.status.infoStrong, background: T.status.infoBg, padding: '8px 10px', borderRadius: 10 }}>
            A recepção recebe um aviso agora e o paciente aparece em “Saindo do consultório”.
          </div>
        )}
      </div>
      <ModalAcoes>
        <Button variant="secondary" onClick={onClose}>Voltar</Button>
        <Button icon={chamarDepois ? Megaphone : CheckCircle2} onClick={finalizar} disabled={salvando}>{salvando ? 'Finalizando…' : chamarDepois ? 'Finalizar e chamar próximo' : 'Finalizar'}</Button>
      </ModalAcoes>
    </Modal>
  )
}

/** "Em qual consultório você está hoje?" — aparece ao entrar; mostra salas usadas por outros médicos. */
function ModalSala({ config, atual, outros, onEscolher, onClose }: {
  config: Config; atual: string; outros: { id: string; nome: string; consultorio_id: string | null }[]
  onEscolher: (id: string) => void; onClose?: () => void
}) {
  const setores = config.setores.filter(s => config.consultorios.some(c => c.setor_id === s.id && c.ativo))
  return (
    <Modal titulo="Em qual consultório você está hoje?" onClose={onClose || (() => {})} largura={520}>
      <div style={{ fontSize: 13, color: T.text.secondary, marginBottom: 14 }}>A TV chama os pacientes para esta sala e a recepção vê onde você está.</div>
      {setores.map(s => (
        <div key={s.id} style={{ marginBottom: 14 }}>
          {setores.length > 1 && <div style={{ fontSize: 11.5, fontWeight: 700, color: T.text.tertiary, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>{s.nome}</div>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
            {config.consultorios.filter(c => c.setor_id === s.id && c.ativo).map(c => {
              const ocupado = outros.find(m => m.consultorio_id === c.id)
              const ativo = atual === c.id
              return (
                <button key={c.id} onClick={() => onEscolher(c.id)} style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4, padding: '14px 14px', borderRadius: 14, cursor: 'pointer', textAlign: 'left',
                  fontFamily: 'inherit', background: ativo ? T.brand.primarySubtle : '#fff', border: `1px solid ${ativo ? T.brand.primaryAccent : T.border.default}`,
                }}>
                  <DoorOpen size={20} color={ativo ? T.brand.primary : T.text.secondary} />
                  <span style={{ fontSize: 14.5, fontWeight: 700, color: T.text.primary }}>{c.nome}</span>
                  <span style={{ fontSize: 11.5, color: ocupado ? T.status.warning : T.status.success, fontWeight: 600 }}>{ocupado ? `Usado por ${ocupado.nome.split(' ').slice(0, 2).join(' ')}` : 'Livre'}</span>
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </Modal>
  )
}
