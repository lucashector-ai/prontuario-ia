'use client'
/**
 * Consultório — a tela do médico durante o turno: paciente atual, "Chamar próximo"
 * (vai para a TV da sala de espera), a fila dele e o retorno ao finalizar.
 * ?demo=1 roda com dados de exemplo, sem gravar nada.
 */
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  BellRing, CalendarPlus, CheckCircle2, DoorOpen, FileText, Megaphone, Mic, MonitorPlay, Play, Settings2, UserX, Users,
} from 'lucide-react'
import { tokens as T } from '@/lib/design-tokens'
import { usePageHeader } from '@/components/shell/header-context'
import { Badge, Button, Card, Chip, EmptyState, Field, Input, Modal, ModalAcoes, Select } from '@/components/ui'
import { notificar } from '@/components/ui/dialogos'
import { useFila } from '@/lib/atendimento/useFila'
import { avisarFila, carregarConfig, chamar, ehDemo, mudar, type Config } from '@/lib/atendimento/cliente'
import { minutosDesde, ordenarFila, type Atendimento } from '@/lib/atendimento/comum'
import { SeloPrioridade, SeloStatus, SenhaChip, esperaTexto, horaCurta, idade } from '@/components/atendimento/partes'

const PRAZOS_RETORNO = [7, 15, 30, 60, 90, 180]

export default function ConsultorioPage() {
  const router = useRouter()
  usePageHeader('Consultório', 'Sua fila de hoje: chame o próximo e atenda')

  const [medicoLogado, setMedicoLogado] = useState<string | null>(null)
  const [medicoId, setMedicoId] = useState<string>('')
  const [consultorioId, setConsultorioId] = useState<string>('')
  const [config, setConfig] = useState<Config | null>(null)
  const [chamando, setChamando] = useState(false)
  const [finalizando, setFinalizando] = useState<Atendimento | null>(null)
  const [agora, setAgora] = useState(() => Date.now())
  const demo = ehDemo()

  // Quem está usando: médico logado atende a própria fila; a conta da clínica escolhe o médico
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

  // Sem médico escolhido (conta da clínica): pega o primeiro da lista
  useEffect(() => {
    if (!medicoId && fila?.medicos.length) setMedicoId(fila.medicos[0].id)
  }, [fila, medicoId])

  // Consultório: o último usado neste computador, senão o padrão do médico
  useEffect(() => {
    if (!config || consultorioId) return
    let salvo = ''
    try { salvo = localStorage.getItem('c360-consultorio-sala') || '' } catch {}
    const padrao = fila?.medicos.find(m => m.id === medicoId)?.consultorio_id
    const valido = (id?: string | null) => !!id && config.consultorios.some(c => c.id === id && c.ativo)
    setConsultorioId(valido(salvo) ? salvo : valido(padrao) ? padrao! : config.consultorios.find(c => c.ativo)?.id || '')
  }, [config, fila, medicoId, consultorioId])

  const escolherMedico = (id: string) => { setMedicoId(id); try { localStorage.setItem('c360-consultorio-medico', id) } catch {} }
  const escolherSala = (id: string) => { setConsultorioId(id); try { localStorage.setItem('c360-consultorio-sala', id) } catch {} }

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

  const abrirProntuario = (a: Atendimento) => {
    const q = new URLSearchParams({ paciente_id: a.paciente_id || '', paciente_nome: a.paciente?.nome || '' })
    window.open(`/nova-consulta?${q}`, '_blank')
  }

  if (erro?.faltaMigration) {
    return <div className="c360-pagina"><Card><EmptyState icon={Settings2} titulo="Falta ativar o módulo de atendimento" descricao="Rode a migration 0018_atendimento_fila no Supabase (SQL Editor) e recarregue a página." /></Card></div>
  }

  const semSalas = config && config.consultorios.filter(c => c.ativo).length === 0

  return (
    <div className="c360-pagina" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Quem e onde */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        {!medicoLogado && (fila?.medicos.length || 0) > 0 && (
          <Select value={medicoId} onChange={e => escolherMedico(e.target.value)} style={{ width: 'auto', minWidth: 200 }} aria-label="Médico">
            {fila!.medicos.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
          </Select>
        )}
        {config && config.consultorios.length > 0 && (
          <Select value={consultorioId} onChange={e => escolherSala(e.target.value)} style={{ width: 'auto', minWidth: 180 }} aria-label="Consultório">
            {config.consultorios.filter(c => c.ativo).map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </Select>
        )}
        <span style={{ flex: 1 }} />
        {setor && <Button variant="secondary" icon={MonitorPlay} onClick={() => window.open(`/painel/${setor.painel_token}${demo ? '?demo=1' : ''}`, '_blank')}>Painel da TV</Button>}
      </div>

      {semSalas && !demo && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 12, background: T.status.infoBg, color: T.status.infoStrong, fontSize: 13 }}>
          <DoorOpen size={18} />
          <span style={{ flex: 1 }}>Cadastre os consultórios para o painel da TV mostrar para onde o paciente deve ir.</span>
          <Button size="sm" variant="secondary" onClick={() => router.push('/minha-clinica?aba=atendimento')}>Configurar</Button>
        </div>
      )}

      <div className="c360-consultorio-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.25fr) minmax(0, 1fr)', gap: 16, alignItems: 'start' }}>
        <style dangerouslySetInnerHTML={{ __html: '@media (max-width: 1023px) { .c360-consultorio-grid { grid-template-columns: minmax(0, 1fr) !important; } }' }} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Paciente atual */}
          <Card padding={0} style={{ overflow: 'hidden' }}>
            {carregando && !fila ? (
              <div style={{ padding: 24 }}><span className="c360-skel" style={{ display: 'block', height: 22, width: '50%', borderRadius: 8 }} /><span className="c360-skel" style={{ display: 'block', height: 14, width: '30%', borderRadius: 6, marginTop: 12 }} /></div>
            ) : atual ? (
              <>
                <div style={{ padding: '20px 22px', background: atual.status === 'chamado' ? T.brand.primarySubtle : '#fff' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <SeloStatus status={atual.status} />
                    {atual.status === 'chamado' && <span style={{ fontSize: 12.5, color: T.text.secondary }}>há {esperaTexto(minutosDesde(atual.chamado_em, agora))}{atual.chamadas > 1 ? ` · chamado ${atual.chamadas}x` : ''}</span>}
                    {atual.status === 'em_atendimento' && <span style={{ fontSize: 12.5, color: T.text.secondary }}>desde {horaCurta(atual.inicio_em)}</span>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                    <span className="mono" style={{ fontSize: 34, fontWeight: 800, color: T.brand.primary, letterSpacing: '-.02em' }}>{atual.senha}</span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-.01em' }}>{atual.paciente?.nome || 'Paciente'}</div>
                      <div style={{ fontSize: 13, color: T.text.secondary, marginTop: 3, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                        {idade(atual.paciente?.data_nascimento) !== null && <span>{idade(atual.paciente?.data_nascimento)} anos</span>}
                        {atual.horario_previsto && <span>· agendado {horaCurta(atual.horario_previsto)}</span>}
                        <span>· esperou {esperaTexto(Math.round(((atual.chamado_em ? new Date(atual.chamado_em).getTime() : agora) - new Date(atual.chegada_em).getTime()) / 60000))}</span>
                        <SeloPrioridade prioridade={atual.prioridade} />
                      </div>
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '14px 22px', borderTop: `1px solid ${T.border.muted}` }}>
                  {atual.status === 'chamado' ? (
                    <>
                      <Button icon={Play} onClick={() => mudarAtual('iniciar')}>Paciente entrou</Button>
                      <Button variant="secondary" icon={BellRing} onClick={() => chamarProximo(atual.id, true)} disabled={chamando}>Chamar de novo</Button>
                      <Button variant="ghost" icon={UserX} onClick={() => mudarAtual('ausente')} style={{ color: T.status.danger }}>Não compareceu</Button>
                    </>
                  ) : (
                    <>
                      <Button icon={Mic} onClick={() => abrirProntuario(atual)}>Gravar consulta</Button>
                      {atual.paciente_id && <Button variant="secondary" icon={FileText} onClick={() => window.open(`/pacientes/${atual.paciente_id}`, '_blank')}>Prontuário</Button>}
                      <span style={{ flex: 1 }} />
                      <Button variant="dark" icon={CheckCircle2} onClick={() => setFinalizando(atual)}>Finalizar</Button>
                    </>
                  )}
                </div>
              </>
            ) : (
              <div style={{ padding: '26px 22px', display: 'flex', alignItems: 'center', gap: 14 }}>
                <span style={{ width: 46, height: 46, borderRadius: 14, display: 'grid', placeItems: 'center', background: T.brand.primarySubtle, color: T.brand.primary }}><DoorOpen size={22} /></span>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>Consultório livre</div>
                  <div style={{ fontSize: 13, color: T.text.secondary, marginTop: 2 }}>{espera.length ? `${espera.length} ${espera.length === 1 ? 'paciente aguardando' : 'pacientes aguardando'}. Chame o próximo quando estiver pronto.` : 'Ninguém aguardando agora.'}</div>
                </div>
              </div>
            )}
          </Card>

          {/* Chamar próximo */}
          <button
            onClick={() => chamarProximo()}
            disabled={chamando || !espera.length || atual?.status === 'em_atendimento' || atual?.status === 'chamado'}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, height: 72, borderRadius: 18, border: 'none',
              fontFamily: 'inherit', fontSize: 19, fontWeight: 700, letterSpacing: '-.01em', color: '#fff', cursor: 'pointer',
              background: T.brand.primary, boxShadow: '0 10px 24px -10px rgba(90, 64, 220, .55)', transition: 'transform .15s, opacity .2s',
              opacity: chamando || !espera.length || atual ? 0.45 : 1,
            }}
          >
            <Megaphone size={24} />
            {chamando ? 'Chamando…' : espera.length ? `Chamar próximo · ${espera[0].senha}` : 'Fila vazia'}
          </button>
          {atual && <div style={{ fontSize: 12.5, color: T.text.tertiary, textAlign: 'center', marginTop: -8 }}>Finalize o paciente atual para chamar o próximo.</div>}
        </div>

        {/* Fila */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card titulo={`Na espera · ${espera.length}`} padding={0}>
            {espera.length === 0 ? (
              <div style={{ padding: '18px 16px', fontSize: 13, color: T.text.tertiary }}>Ninguém na sala de espera.</div>
            ) : espera.map((a, i) => (
              <div key={a.id} style={{ ...linha, borderTop: i === 0 ? 'none' : linha.borderTop }}>
                <span style={{ width: 22, fontSize: 12.5, color: T.text.tertiary, fontWeight: 600 }}>{i + 1}º</span>
                <SenhaChip senha={a.senha} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 650, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>{a.paciente?.nome} <SeloPrioridade prioridade={a.prioridade} /></div>
                  <div style={{ fontSize: 12, color: T.text.secondary }}>{a.horario_previsto ? `agendado ${horaCurta(a.horario_previsto)} · ` : 'encaixe · '}espera {esperaTexto(minutosDesde(a.chegada_em, agora))}</div>
                </div>
                <Button size="sm" variant="secondary" onClick={() => chamarProximo(a.id)} disabled={chamando || !!atual}>Chamar</Button>
              </div>
            ))}
            {ausentes.length > 0 && (
              <div style={{ borderTop: `1px solid ${T.border.muted}`, padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ fontSize: 12, fontWeight: 650, color: T.text.secondary }}>Não compareceram à chamada</div>
                {ausentes.map(a => (
                  <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                    <SenhaChip senha={a.senha} /><span style={{ flex: 1 }}>{a.paciente?.nome}</span>
                    <Button size="sm" variant="ghost" onClick={() => chamarProximo(a.id)} disabled={chamando || !!atual}>Chamar de novo</Button>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card titulo={`Ainda não chegaram · ${naoChegaram.length}`} padding={0}>
            {naoChegaram.length === 0 ? <div style={{ padding: '14px 16px', fontSize: 13, color: T.text.tertiary }}>Todos os agendados de hoje já chegaram.</div>
              : naoChegaram.map((e, i) => (
                <div key={e.id} style={{ ...linha, padding: '10px 16px', borderTop: i === 0 ? 'none' : linha.borderTop }}>
                  <span className="mono" style={{ fontSize: 13, fontWeight: 700, width: 44 }}>{horaCurta(e.data_hora)}</span>
                  <span style={{ flex: 1, fontSize: 13 }}>{e.paciente?.nome}{e.motivo ? <span style={{ color: T.text.tertiary }}> · {e.motivo}</span> : null}</span>
                  {minutosDesde(e.data_hora, agora) > 15 && <Badge tone="danger">atrasado</Badge>}
                </div>
              ))}
          </Card>

          <Card titulo={`Atendidos hoje · ${atendidos.length}`} padding={0}>
            {atendidos.length === 0 ? <div style={{ padding: '14px 16px', fontSize: 13, color: T.text.tertiary }}>Nenhum ainda.</div>
              : atendidos.map((a, i) => (
                <div key={a.id} style={{ ...linha, padding: '10px 16px', borderTop: i === 0 ? 'none' : linha.borderTop }}>
                  <CheckCircle2 size={16} color={T.status.success} />
                  <span style={{ flex: 1, fontSize: 13 }}>{a.paciente?.nome}</span>
                  <span className="mono" style={{ fontSize: 12, color: T.text.tertiary }}>{horaCurta(a.inicio_em)}–{horaCurta(a.fim_em)}</span>
                </div>
              ))}
          </Card>
        </div>
      </div>

      {erro && !erro.faltaMigration && (
        <div style={{ fontSize: 13, color: T.status.danger, display: 'flex', alignItems: 'center', gap: 10 }}>
          {erro.msg} <Button size="sm" variant="secondary" onClick={recarregar}>Tentar de novo</Button>
        </div>
      )}

      {finalizando && (
        <ModalFinalizar
          at={finalizando}
          temProximo={espera.length > 0}
          onClose={() => setFinalizando(null)}
          onPronto={async (chamarSeguinte) => {
            setFinalizando(null); avisarFila(); await recarregar()
            if (chamarSeguinte) chamarProximo()
          }}
        />
      )}
    </div>
  )
}

const linha: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px', borderTop: `1px solid ${T.border.muted}` }

function ModalFinalizar({ at, temProximo, onClose, onPronto }: { at: Atendimento; temProximo: boolean; onClose: () => void; onPronto: (chamarProximo: boolean) => void }) {
  const [dias, setDias] = useState<number | null>(null)
  const [outro, setOutro] = useState('')
  const [motivo, setMotivo] = useState('')
  const [salvando, setSalvando] = useState(false)
  const prazo = dias ?? (Number(outro) > 0 ? Number(outro) : null)

  const finalizar = async (chamarSeguinte: boolean) => {
    setSalvando(true)
    try {
      await mudar(at.id, 'finalizar', { retorno: prazo ? { dias: prazo, motivo: motivo.trim() || undefined } : null })
      notificar(prazo ? `Atendimento finalizado · retorno em ${prazo} dias na lista de retornos` : 'Atendimento finalizado')
      onPronto(chamarSeguinte)
    } catch (e: any) { notificar(e.message, 'erro'); setSalvando(false) }
  }

  return (
    <Modal titulo={`Finalizar · ${at.paciente?.nome?.split(' ')[0] || at.senha}`} onClose={onClose} largura={480}>
      <Field label="Retorno" hint="Vai para a lista de Retornos; a clínica lembra o paciente de agendar.">
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <Chip ativo={dias === null && !outro} onClick={() => { setDias(null); setOutro('') }}>Sem retorno</Chip>
          {PRAZOS_RETORNO.map(d => <Chip key={d} ativo={dias === d} onClick={() => { setDias(d); setOutro('') }} icon={CalendarPlus}>{d < 60 ? `${d} dias` : `${d / 30} meses`}</Chip>)}
          <Input value={outro} onChange={e => { setOutro(e.target.value.replace(/\D/g, '').slice(0, 3)); setDias(null) }} placeholder="Outro (dias)" inputMode="numeric" style={{ width: 120, height: 32 }} />
        </div>
      </Field>
      {prazo && (
        <Field label="Motivo do retorno (opcional)" style={{ marginTop: 14 }}>
          <Input value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Ex.: trazer exames de sangue" />
        </Field>
      )}
      <ModalAcoes>
        <Button variant="secondary" onClick={onClose}>Voltar</Button>
        <Button variant={temProximo ? 'secondary' : 'primary'} icon={CheckCircle2} onClick={() => finalizar(false)} disabled={salvando}>Finalizar</Button>
        {temProximo && <Button icon={Users} onClick={() => finalizar(true)} disabled={salvando}>Finalizar e chamar próximo</Button>}
      </ModalAcoes>
    </Modal>
  )
}
