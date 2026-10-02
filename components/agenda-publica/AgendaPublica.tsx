'use client'

import { useEffect, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  ArrowRight, CalendarDays, ChevronLeft, ChevronRight, CircleAlert, CircleCheck,
  ClipboardList, Clock, Lock, ShieldCheck, UserRound,
} from 'lucide-react'
import { tokens } from '@/lib/design-tokens'
import { supabase } from '@/lib/supabase'
import { notificar } from '@/components/ui/dialogos'
import { Button, EmptyState, Field, Icon, IconButton, IconTile, Input, Modal, Textarea } from '@/components/ui'
import { CascaPublica, Spinner, cartaoPublico } from '@/components/publico/CascaPublica'

const T = tokens

type Props = {
  medicoSlug: string
  clinicaSlug?: string
}

type Medico = {
  id: string
  nome: string
  especialidade: string | null
  crm: string | null
  foto_url: string | null
  agenda_publica_ativa: boolean
}

type Clinica = {
  id: string
  nome: string
  logo_url: string | null
}

const MESES_PT = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const MESES_PT_CURTO = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const DIAS_SEMANA_CURTO = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB']
const DIAS_SEMANA_FULL = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

function formatarTelefone(v: string) {
  const num = v.replace(/\D/g, '').slice(0, 11)
  if (num.length <= 2) return num
  if (num.length <= 7) return '(' + num.slice(0, 2) + ') ' + num.slice(2)
  if (num.length <= 10) return '(' + num.slice(0, 2) + ') ' + num.slice(2, 6) + '-' + num.slice(6)
  return '(' + num.slice(0, 2) + ') ' + num.slice(2, 7) + '-' + num.slice(7)
}

export default function AgendaPublica({ medicoSlug, clinicaSlug }: Props) {
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [medico, setMedico] = useState<Medico | null>(null)
  const [clinica, setClinica] = useState<Clinica | null>(null)

  const [hojeData] = useState(new Date())
  const [mesAtual, setMesAtual] = useState(() => {
    const d = new Date()
    return { ano: d.getFullYear(), mes: d.getMonth() + 1 }
  })
  const [disponibilidade, setDisponibilidade] = useState<Record<string, number>>({})
  const [configMedico, setConfigMedico] = useState<any>(null)
  const [carregandoMes, setCarregandoMes] = useState(false)

  const [dataSelecionada, setDataSelecionada] = useState<string | null>(null)
  const [slots, setSlots] = useState<string[]>([])
  const [carregandoSlots, setCarregandoSlots] = useState(false)
  const [horarioSelecionado, setHorarioSelecionado] = useState<string | null>(null)
  const [mostrandoForm, setMostrandoForm] = useState(false)
  const [mostrandoSucesso, setMostrandoSucesso] = useState(false)

  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [email, setEmail] = useState('')
  const [motivo, setMotivo] = useState('')
  const [primeiraConsulta, setPrimeiraConsulta] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [resultadoEnvio, setResultadoEnvio] = useState<'confirmado' | 'aguardando_confirmacao' | null>(null)
  const [urlFormulario, setUrlFormulario] = useState<string | null>(null)

  useEffect(() => {
    async function carregar() {
      setLoading(true)
      try {
        const { data: medicoData, error: errMed } = await supabase
          .from('medicos')
          .select('id, nome, especialidade, crm, foto_url, clinica_id, agenda_publica_ativa, agenda_publica_config')
          .eq('slug_publico', medicoSlug)
          .single()

        if (errMed || !medicoData) {
          setErro('Médico não encontrado.')
          setLoading(false)
          return
        }

        if (!medicoData.agenda_publica_ativa) {
          setErro('Esse médico ainda não ativou a agenda pública.')
          setLoading(false)
          return
        }

        setMedico(medicoData as any)
        setConfigMedico(medicoData.agenda_publica_config)

        if (clinicaSlug) {
          const { data: clinicaData } = await supabase
            .from('clinicas')
            .select('id, nome, logo_url')
            .eq('slug_publico', clinicaSlug)
            .single()
          if (clinicaData && clinicaData.id === medicoData.clinica_id) {
            setClinica(clinicaData as any)
          }
        } else if (medicoData.clinica_id) {
          const { data: clinicaData } = await supabase
            .from('clinicas')
            .select('id, nome, logo_url')
            .eq('id', medicoData.clinica_id)
            .single()
          if (clinicaData) setClinica(clinicaData as any)
        }
      } catch (e: any) {
        setErro(e.message || 'Erro ao carregar')
      } finally {
        setLoading(false)
      }
    }
    carregar()
  }, [medicoSlug, clinicaSlug])

  useEffect(() => {
    if (!medico) return
    async function carregar() {
      setCarregandoMes(true)
      try {
        const mesStr = mesAtual.ano + '-' + String(mesAtual.mes).padStart(2, '0')
        const res = await fetch('/api/agenda-publica/slots?medico=' + medicoSlug + '&mes=' + mesStr)
        const data = await res.json()
        if (data.disponibilidade) setDisponibilidade(data.disponibilidade)
      } finally {
        setCarregandoMes(false)
      }
    }
    carregar()
  }, [medico, mesAtual, medicoSlug])

  // Pre-seleciona o primeiro dia futuro com vaga ao carregar a disponibilidade.
  // Estilo Cal.com: paciente ja chega vendo horarios, sem precisar clicar no calendario.
  useEffect(() => {
    if (dataSelecionada) return
    if (!disponibilidade || Object.keys(disponibilidade).length === 0) return

    const hojeISO = new Date().toISOString().slice(0, 10)
    const proximaData = Object.keys(disponibilidade)
      .filter(d => d >= hojeISO && disponibilidade[d] > 0)
      .sort()[0]

    if (proximaData) {
      setDataSelecionada(proximaData)
    }
  }, [disponibilidade, dataSelecionada])

  useEffect(() => {
    if (!dataSelecionada || !medico) return
    async function carregar() {
      setCarregandoSlots(true)
      try {
        const res = await fetch('/api/agenda-publica/slots?medico=' + medicoSlug + '&data=' + dataSelecionada)
        const data = await res.json()
        setSlots(data.slots || [])
      } finally {
        setCarregandoSlots(false)
      }
    }
    carregar()
  }, [dataSelecionada, medico, medicoSlug])

  async function enviarSolicitacao() {
    if (!dataSelecionada || !horarioSelecionado || !nome.trim() || !telefone.trim()) return
    setEnviando(true)
    try {
      const dataHoraISO = new Date(dataSelecionada + 'T' + horarioSelecionado + ':00').toISOString()
      const res = await fetch('/api/agenda-publica/solicitar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          medicoSlug,
          clinicaSlug: clinicaSlug || undefined,
          dataHora: dataHoraISO,
          nome: nome.trim(),
          telefone: telefone.replace(/\D/g, ''),
          email: email.trim() || undefined,
          motivo: motivo.trim() || undefined,
          primeiraConsulta,
        }),
      })
      const data = await res.json()
      if (data.sucesso) {
        setResultadoEnvio(data.status)
        setUrlFormulario(data.urlFormulario || null)
        setMostrandoSucesso(true)
      } else {
        notificar(data.erro || 'Erro ao agendar', 'erro')
      }
    } catch (e: any) {
      notificar(e.message || 'Erro ao agendar', 'erro')
    } finally {
      setEnviando(false)
    }
  }

  if (loading) {
    return (
      <CascaPublica>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '64px 0' }}>
          <Spinner tamanho={28} />
        </div>
      </CascaPublica>
    )
  }

  if (erro || !medico) {
    return (
      <CascaPublica>
        <div style={{ ...cartao, maxWidth: 440, margin: '0 auto', padding: '36px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <IconTile icon={CircleAlert} color={T.status.danger} size={52} radius={16} />
          <h2 style={{ fontSize: 18, fontWeight: 700, color: T.text.primary, margin: '6px 0 0', letterSpacing: '-.01em' }}>Página indisponível</h2>
          <p style={{ fontSize: 14, color: T.text.secondary, lineHeight: 1.5, margin: 0 }}>{erro}</p>
        </div>
      </CascaPublica>
    )
  }

  // SUCESSO - tela cheia
  if (mostrandoSucesso && dataSelecionada && horarioSelecionado) {
    return <TelaSucesso resultado={resultadoEnvio} urlFormulario={urlFormulario} data={dataSelecionada} horario={horarioSelecionado} medico={medico} clinica={clinica} />
  }

  const duracao = configMedico?.duracao_consulta_min || 30
  const hojeISO = hojeData.toISOString().split('T')[0]
  const voltarDesabilitado = (() => {
    const hoje = new Date()
    return mesAtual.ano <= hoje.getFullYear() && mesAtual.mes <= hoje.getMonth() + 1
  })()
  const iniciais = medico.nome.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase()

  return (
    <CascaPublica clinica={clinica}>
      <style dangerouslySetInnerHTML={{ __html: `
        .ap-corpo { display: grid; grid-template-columns: 1fr; }
        .ap-col-horarios { border-top: 1px solid ${T.border.muted}; }
        @media (min-width: 768px) {
          .ap-corpo { grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr); }
          .ap-col-horarios { border-top: none; border-left: 1px solid ${T.border.muted}; }
        }
      ` }} />

      <div style={{ ...cartao, maxWidth: 880, margin: '0 auto', overflow: 'hidden' }}>
        {/* Cabeçalho — profissional */}
        <div style={{ padding: '20px 20px 18px', background: T.brand.primarySoftBg, borderBottom: `1px solid ${T.border.muted}`, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          {medico.foto_url ? (
            <img src={medico.foto_url} alt="" style={{ width: 52, height: 52, borderRadius: 15, objectFit: 'cover', flexShrink: 0 }} />
          ) : (
            <span style={{ width: 52, height: 52, borderRadius: 15, background: T.night[800], color: T.text.inverse, display: 'grid', placeItems: 'center', fontSize: 17, fontWeight: 700, flexShrink: 0 }}>
              {iniciais || <Icon icon={UserRound} size={20} />}
            </span>
          )}
          <div style={{ flex: '1 1 200px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <h1 style={{ fontSize: 19, fontWeight: 700, color: T.text.primary, margin: 0, letterSpacing: '-.01em', lineHeight: 1.25 }}>{medico.nome}</h1>
            <span style={{ fontSize: 13, color: T.text.quaternary }}>
              {[medico.especialidade, medico.crm ? 'CRM ' + medico.crm : null].filter(Boolean).join(' · ') || 'Agendamento online'}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <InfoPilula icon={Clock}>{duracao} min</InfoPilula>
            {configMedico?.modo_aprovacao === 'manual' && <InfoPilula icon={ShieldCheck}>Requer confirmação</InfoPilula>}
          </div>
        </div>

        <div className="ap-corpo">
          {/* 1. Dia */}
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={rotuloEtapa}>1. Escolha o dia</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: T.text.primary }}>
                  {MESES_PT[mesAtual.mes - 1]} <span style={{ fontWeight: 500, color: T.text.quaternary }}>{mesAtual.ano}</span>
                </span>
              </div>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                {carregandoMes && <Spinner tamanho={14} />}
                <IconButton
                  icon={ChevronLeft}
                  variant="outline"
                  size={34}
                  aria-label="Mês anterior"
                  disabled={voltarDesabilitado}
                  style={voltarDesabilitado ? { opacity: 0.4, cursor: 'default' } : undefined}
                  onClick={() => {
                    if (voltarDesabilitado) return
                    let m = mesAtual.mes - 1, a = mesAtual.ano
                    if (m < 1) { m = 12; a-- }
                    setMesAtual({ ano: a, mes: m })
                    setDataSelecionada(null)
                  }}
                />
                <IconButton
                  icon={ChevronRight}
                  variant="outline"
                  size={34}
                  aria-label="Próximo mês"
                  onClick={() => {
                    let m = mesAtual.mes + 1, a = mesAtual.ano
                    if (m > 12) { m = 1; a++ }
                    setMesAtual({ ano: a, mes: m })
                    setDataSelecionada(null)
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 5 }}>
              {DIAS_SEMANA_CURTO.map((d, i) => (
                <div key={i} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: T.text.tertiary, padding: '4px 0', letterSpacing: '.05em' }}>
                  {d}
                </div>
              ))}
              {(() => {
                const primeiroDia = new Date(mesAtual.ano, mesAtual.mes - 1, 1).getDay()
                const ultimoDia = new Date(mesAtual.ano, mesAtual.mes, 0).getDate()
                const dias: (number | null)[] = []
                for (let i = 0; i < primeiroDia; i++) dias.push(null)
                for (let d = 1; d <= ultimoDia; d++) dias.push(d)

                return dias.map((dia, idx) => {
                  if (dia === null) return <div key={idx} />
                  const dataISO = mesAtual.ano + '-' + String(mesAtual.mes).padStart(2, '0') + '-' + String(dia).padStart(2, '0')
                  const temVagas = !!disponibilidade[dataISO]
                  const ehHoje = dataISO === hojeISO
                  const ehPassado = dataISO < hojeISO
                  const desabilitado = !temVagas || ehPassado
                  const ehSelecionada = dataISO === dataSelecionada

                  return (
                    <DiaBotao
                      key={idx}
                      dia={dia}
                      hoje={ehHoje}
                      passado={ehPassado}
                      disponivel={!desabilitado}
                      selecionado={ehSelecionada}
                      onClick={() => setDataSelecionada(dataISO)}
                    />
                  )
                })
              })()}
            </div>
          </div>

          {/* 2. Horário */}
          <div className="ap-col-horarios" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={rotuloEtapa}>2. Escolha o horário</span>
              {dataSelecionada ? (
                <>
                  <span style={{ fontSize: 15, fontWeight: 700, color: T.text.primary }}>
                    {(() => {
                      const d = new Date(dataSelecionada + 'T12:00:00')
                      return DIAS_SEMANA_FULL[d.getDay()] + ', ' + d.getDate() + ' ' + MESES_PT_CURTO[d.getMonth()]
                    })()}
                  </span>
                  {!carregandoSlots && (
                    <span style={{ fontSize: 12.5, color: T.text.quaternary }}>
                      {slots.length} {slots.length === 1 ? 'horário disponível' : 'horários disponíveis'}
                    </span>
                  )}
                </>
              ) : null}
            </div>

            {!dataSelecionada ? (
              <EmptyState icon={CalendarDays} titulo="Selecione um dia" descricao="Os dias destacados no calendário têm horários livres." />
            ) : carregandoSlots ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
                <Spinner tamanho={22} />
              </div>
            ) : slots.length === 0 ? (
              <EmptyState icon={Clock} titulo="Nenhum horário livre" descricao="Escolha outro dia no calendário." />
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(82px, 1fr))', gap: 8, maxHeight: 420, overflowY: 'auto', paddingBottom: 2 }}>
                {slots.map((h: string) => (
                  <HorarioBotao
                    key={h}
                    horario={h}
                    selecionado={horarioSelecionado === h && mostrandoForm}
                    onClick={() => {
                      setHorarioSelecionado(h)
                      setMostrandoForm(true)
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MODAL DE DADOS */}
      {mostrandoForm && dataSelecionada && horarioSelecionado && (
        <ModalDados
          data={dataSelecionada}
          horario={horarioSelecionado}
          medico={medico}
          clinica={clinica}
          duracao={duracao}
          nome={nome}
          setNome={setNome}
          telefone={telefone}
          setTelefone={(v: string) => setTelefone(formatarTelefone(v))}
          email={email}
          setEmail={setEmail}
          motivo={motivo}
          setMotivo={setMotivo}
          primeiraConsulta={primeiraConsulta}
          setPrimeiraConsulta={setPrimeiraConsulta}
          enviando={enviando}
          onConfirmar={enviarSolicitacao}
          onFechar={() => setMostrandoForm(false)}
        />
      )}
    </CascaPublica>
  )
}

const cartao = cartaoPublico

const rotuloEtapa: React.CSSProperties = {
  fontSize: 12, fontWeight: 600, color: T.text.secondary,
}

// ─── Tela de sucesso ───
function TelaSucesso({ resultado, urlFormulario, data, horario, medico, clinica }: any) {
  const aguardando = resultado === 'aguardando_confirmacao'
  const dataObj = new Date(data + 'T12:00:00')
  const dataLabel = dataObj.getDate() + ' de ' + MESES_PT[dataObj.getMonth()].toLowerCase()

  return (
    <CascaPublica clinica={clinica}>
      <div style={{ ...cartao, maxWidth: 480, margin: '0 auto', padding: '32px 22px 24px', textAlign: 'center' }}>
        <IconTile
          icon={aguardando ? Clock : CircleCheck}
          color={aguardando ? T.status.warning : T.status.success}
          size={60}
          radius={18}
          style={{ margin: '0 auto 18px', background: aguardando ? T.status.warningBg : T.status.successBg }}
        />

        <h2 style={{ fontSize: 21, fontWeight: 700, color: T.text.primary, margin: '0 0 8px', letterSpacing: '-.01em' }}>
          {aguardando ? 'Solicitação enviada' : 'Consulta confirmada'}
        </h2>

        <p style={{ fontSize: 14, color: T.text.secondary, lineHeight: 1.55, margin: '0 0 22px' }}>
          {aguardando
            ? 'O médico vai analisar e confirmar em breve. Você receberá uma mensagem no WhatsApp informado.'
            : 'Sua consulta foi confirmada e adicionada à agenda. Você receberá um lembrete antes do horário.'}
        </p>

        {urlFormulario && (
          <div style={{
            marginBottom: 14, padding: 16, textAlign: 'left', borderRadius: T.radius['2xl'],
            background: T.brand.primarySoftBg, border: `1px solid ${T.brand.primaryAccentSoft}`,
            display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <IconTile icon={ClipboardList} size={34} radius={10} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: T.text.primary }}>Último passo</div>
                <div style={{ fontSize: 12.5, color: T.text.secondary, lineHeight: 1.45 }}>Preencha esse formulário rápido para agilizar sua consulta.</div>
              </div>
            </div>
            <a
              href={urlFormulario}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: 40, padding: '0 16px',
                background: T.brand.primary, color: T.text.inverse, borderRadius: 10, fontSize: 13.5, fontWeight: 600, textDecoration: 'none',
              }}
            >
              Preencher formulário
              <Icon icon={ArrowRight} size={15} />
            </a>
          </div>
        )}

        <div style={{ padding: '4px 16px', borderRadius: T.radius['2xl'], border: `1px solid ${T.border.default}`, textAlign: 'left' }}>
          <Linha label="Profissional" valor={medico.nome} />
          {medico.especialidade && <Linha label="Especialidade" valor={medico.especialidade} />}
          {clinica && <Linha label="Clínica" valor={clinica.nome} />}
          <Linha label="Data" valor={dataLabel} />
          <Linha label="Horário" valor={<span className="mono">{horario}</span>} ultimo />
        </div>
      </div>
    </CascaPublica>
  )
}

// ─── Modal de dados ───
function ModalDados(props: any) {
  const { data, horario, duracao, nome, setNome, telefone, setTelefone, email, setEmail, motivo, setMotivo, primeiraConsulta, setPrimeiraConsulta, enviando, onConfirmar, onFechar } = props

  const dataObj = new Date(data + 'T12:00:00')
  const dataLabel = DIAS_SEMANA_FULL[dataObj.getDay()] + ', ' + dataObj.getDate() + ' de ' + MESES_PT[dataObj.getMonth()].toLowerCase()
  const valido = nome.trim().length >= 2 && telefone.replace(/\D/g, '').length >= 10

  return (
    <Modal titulo="Confirmar agendamento" onClose={onFechar} largura={460}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: T.radius.input,
        border: `1.5px solid ${T.brand.primary}`, background: T.brand.primarySoftBg, marginBottom: 18,
      }}>
        <Icon icon={CalendarDays} size={16} color={T.brand.primary} />
        <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, color: T.text.primary }}>
          {dataLabel} às <span className="mono">{horario}</span>
        </span>
        <span style={{ fontSize: 12, color: T.text.quaternary }}>{duracao} min</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field label="Nome completo *">
          <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Como você quer ser chamado(a)" autoComplete="name" />
        </Field>
        <Field label="WhatsApp *">
          <Input type="tel" inputMode="tel" value={telefone} onChange={e => setTelefone(e.target.value)} placeholder="(11) 99999-9999" autoComplete="tel" />
        </Field>
        <Field label="E-mail (opcional)">
          <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" autoComplete="email" />
        </Field>
        <Field label="Motivo da consulta (opcional)">
          <Textarea rows={3} value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Ex: avaliação inicial, retorno, dor recorrente" />
        </Field>

        <Field label="É sua primeira consulta?">
          <div style={{ display: 'flex', gap: 8 }}>
            <OpcaoSelecao ativo={primeiraConsulta === true} onClick={() => setPrimeiraConsulta(true)}>Sim</OpcaoSelecao>
            <OpcaoSelecao ativo={primeiraConsulta === false} onClick={() => setPrimeiraConsulta(false)}>Já consultei antes</OpcaoSelecao>
          </div>
        </Field>
      </div>

      <Button size="lg" block onClick={onConfirmar} disabled={!valido || enviando} style={{ marginTop: 22 }}>
        {enviando ? 'Confirmando…' : 'Confirmar agendamento'}
      </Button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12, fontSize: 12, color: T.text.tertiary, justifyContent: 'center' }}>
        <Icon icon={Lock} size={12} />
        Seus dados são protegidos.
      </div>
    </Modal>
  )
}

// ─── Auxiliares ───
function InfoPilula({ icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, height: 28, padding: '0 10px', borderRadius: 99,
      background: T.bg.card, border: `1px solid ${T.border.default}`, fontSize: 12, fontWeight: 600, color: T.text.muted,
    }}>
      <Icon icon={icon} size={13} color={T.text.tertiary} />
      {children}
    </span>
  )
}

function DiaBotao({ dia, hoje, passado, disponivel, selecionado, onClick }: {
  dia: number; hoje: boolean; passado: boolean; disponivel: boolean; selecionado: boolean; onClick: () => void
}) {
  const [h, setH] = useState(false)
  const on = selecionado
  return (
    <button
      type="button"
      disabled={!disponivel}
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      aria-pressed={on}
      style={{
        position: 'relative', aspectRatio: '1', minHeight: 38, borderRadius: 11, fontFamily: 'inherit',
        display: 'grid', placeItems: 'center', fontSize: 14, fontVariantNumeric: 'tabular-nums',
        fontWeight: on || disponivel ? 700 : 500,
        cursor: disponivel ? 'pointer' : 'default',
        border: `1.5px solid ${on ? T.brand.primary : disponivel ? (h ? T.brand.primaryAccent : T.border.default) : 'transparent'}`,
        background: on ? T.brand.primarySoftBg : disponivel ? (h ? T.brand.primarySoftBg : T.bg.card) : 'transparent',
        color: on ? T.brand.primary : disponivel ? T.text.primary : T.text.tertiary,
        opacity: passado ? 0.4 : 1,
        transition: 'background .15s, border-color .15s, color .15s',
      }}
    >
      {dia}
      {hoje && (
        <span style={{ position: 'absolute', bottom: 5, left: '50%', transform: 'translateX(-50%)', width: 4, height: 4, borderRadius: '50%', background: T.brand.primary }} />
      )}
    </button>
  )
}

function HorarioBotao({ horario, selecionado, onClick }: { horario: string; selecionado: boolean; onClick: () => void }) {
  const [h, setH] = useState(false)
  const realce = selecionado || h
  return (
    <button
      type="button"
      className="mono"
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        height: 42, borderRadius: 10, fontSize: 13.5, fontWeight: 500, cursor: 'pointer', textAlign: 'center',
        border: `1.5px solid ${realce ? T.brand.primary : T.border.default}`,
        background: realce ? T.brand.primarySoftBg : T.bg.card,
        color: realce ? T.brand.primary : T.text.strong,
        transition: 'background .15s, border-color .15s, color .15s',
      }}
    >
      {horario}
    </button>
  )
}

function OpcaoSelecao({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      style={{
        flex: 1, height: 42, padding: '0 12px', borderRadius: T.radius.input, fontFamily: 'inherit',
        border: `1.5px solid ${ativo ? T.brand.primary : T.border.default}`,
        background: ativo ? T.brand.primarySoftBg : T.bg.card,
        color: ativo ? T.brand.primary : T.text.strong,
        fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all .15s',
      }}
    >
      {children}
    </button>
  )
}

function Linha({ label, valor, ultimo }: { label: string; valor: React.ReactNode; ultimo?: boolean }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', gap: 16, padding: '10px 0',
      borderBottom: ultimo ? 'none' : `1px solid ${T.border.muted}`,
    }}>
      <span style={{ fontSize: 13, color: T.text.quaternary, fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: 13, color: T.text.primary, fontWeight: 600, textAlign: 'right' }}>{valor}</span>
    </div>
  )
}
