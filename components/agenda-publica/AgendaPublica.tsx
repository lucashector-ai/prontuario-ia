'use client'

import { useEffect, useState } from 'react'
import { tokens } from '@/lib/design-tokens'
import { supabase } from '@/lib/supabase'

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

type Etapa = 'calendario' | 'horario' | 'dados' | 'sucesso'

const MESES_PT = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const DIAS_SEMANA_CURTO = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

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

  // Calendário
  const [hojeData] = useState(new Date())
  const [mesAtual, setMesAtual] = useState(() => {
    const d = new Date()
    return { ano: d.getFullYear(), mes: d.getMonth() + 1 }
  })
  const [disponibilidade, setDisponibilidade] = useState<Record<string, number>>({})
  const [configMedico, setConfigMedico] = useState<any>(null)
  const [carregandoMes, setCarregandoMes] = useState(false)

  // Seleção
  const [dataSelecionada, setDataSelecionada] = useState<string | null>(null)
  const [slots, setSlots] = useState<string[]>([])
  const [carregandoSlots, setCarregandoSlots] = useState(false)
  const [horarioSelecionado, setHorarioSelecionado] = useState<string | null>(null)
  const [etapa, setEtapa] = useState<Etapa>('calendario')

  // Form
  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [email, setEmail] = useState('')
  const [motivo, setMotivo] = useState('')
  const [primeiraConsulta, setPrimeiraConsulta] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [resultadoEnvio, setResultadoEnvio] = useState<'confirmado' | 'aguardando_confirmacao' | null>(null)

  // 1) Carrega dados do médico/clínica
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

  // 2) Carrega disponibilidade do mês
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

  // 3) Carrega slots da data selecionada
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
        setEtapa('sucesso')
      } else {
        alert(data.erro || 'Erro ao agendar')
      }
    } catch (e: any) {
      alert(e.message || 'Erro ao agendar')
    } finally {
      setEnviando(false)
    }
  }

  if (loading) {
    return (
      <div style={containerEstado}>
        <div style={{ width: 32, height: 32, border: `2.5px solid ${tokens.brand.primaryLight}`, borderTopColor: tokens.brand.primary, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{'@keyframes spin { to { transform: rotate(360deg) } }'}</style>
      </div>
    )
  }

  if (erro || !medico) {
    return (
      <div style={containerEstado}>
        <div style={{ maxWidth: 420, textAlign: 'center', padding: 32 }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 600, color: tokens.text.primary, marginBottom: 8 }}>Página indisponível</h2>
          <p style={{ fontSize: 15, color: tokens.text.secondary, lineHeight: 1.5 }}>{erro}</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: tokens.bg.page, paddingBottom: 48 }}>
      <Header medico={medico} clinica={clinica} />

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '24px 16px' }}>
        {etapa === 'calendario' && (
          <SecaoCalendario
            mesAtual={mesAtual}
            setMesAtual={setMesAtual}
            disponibilidade={disponibilidade}
            carregando={carregandoMes}
            hojeData={hojeData}
            onSelecionarData={(d: string) => {
              setDataSelecionada(d)
              setEtapa('horario')
            }}
          />
        )}

        {etapa === 'horario' && dataSelecionada && (
          <SecaoHorario
            data={dataSelecionada}
            slots={slots}
            carregando={carregandoSlots}
            duracao={configMedico?.duracao_consulta_min || 30}
            onSelecionarHorario={(h: string) => {
              setHorarioSelecionado(h)
              setEtapa('dados')
            }}
            onVoltar={() => {
              setDataSelecionada(null)
              setEtapa('calendario')
            }}
          />
        )}

        {etapa === 'dados' && dataSelecionada && horarioSelecionado && (
          <SecaoDados
            data={dataSelecionada}
            horario={horarioSelecionado}
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
            onVoltar={() => setEtapa('horario')}
          />
        )}

        {etapa === 'sucesso' && dataSelecionada && horarioSelecionado && (
          <SecaoSucesso
            resultado={resultadoEnvio}
            data={dataSelecionada}
            horario={horarioSelecionado}
            medico={medico}
            clinica={clinica}
          />
        )}
      </div>
    </div>
  )
}

// ─── Header ───
function Header({ medico, clinica }: { medico: Medico; clinica: Clinica | null }) {
  return (
    <div style={{
      background: `linear-gradient(135deg, ${tokens.brand.primary} 0%, ${tokens.brand.primaryDark || tokens.brand.primary} 100%)`,
      padding: '32px 16px 48px',
      color: '#fff',
    }}>
      <div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 20 }}>
        <div style={{
          width: 72,
          height: 72,
          borderRadius: 18,
          background: 'rgba(255,255,255,0.18)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 28,
          fontWeight: 700,
          flexShrink: 0,
          backdropFilter: 'blur(8px)',
        }}>
          {medico.nome.charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          {clinica && (
            <div style={{ fontSize: 13, opacity: 0.85, fontWeight: 500, marginBottom: 4 }}>
              {clinica.nome}
            </div>
          )}
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, letterSpacing: '-0.01em' }}>
            {medico.nome}
          </h1>
          <div style={{ fontSize: 14, opacity: 0.9, marginTop: 4 }}>
            {medico.especialidade || 'Médico(a)'}
            {medico.crm ? ' · CRM ' + medico.crm : ''}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Seção: Calendário ───
function SecaoCalendario({ mesAtual, setMesAtual, disponibilidade, carregando, hojeData, onSelecionarData }: any) {
  const primeiroDia = new Date(mesAtual.ano, mesAtual.mes - 1, 1)
  const diaSemanaInicio = primeiroDia.getDay()
  const ultimoDia = new Date(mesAtual.ano, mesAtual.mes, 0).getDate()
  const hojeISO = hojeData.toISOString().split('T')[0]

  const podeVoltar = (() => {
    const hoje = new Date()
    return mesAtual.ano > hoje.getFullYear() || (mesAtual.ano === hoje.getFullYear() && mesAtual.mes > hoje.getMonth() + 1)
  })()

  function mudarMes(delta: number) {
    let novoMes = mesAtual.mes + delta
    let novoAno = mesAtual.ano
    if (novoMes < 1) { novoMes = 12; novoAno-- }
    if (novoMes > 12) { novoMes = 1; novoAno++ }
    setMesAtual({ ano: novoAno, mes: novoMes })
  }

  const dias: (number | null)[] = []
  for (let i = 0; i < diaSemanaInicio; i++) dias.push(null)
  for (let d = 1; d <= ultimoDia; d++) dias.push(d)

  return (
    <Card>
      <div style={{ marginBottom: 24, textAlign: 'center' }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, color: tokens.text.primary, margin: 0 }}>
          Escolha o melhor dia
        </h2>
        <p style={{ fontSize: 14, color: tokens.text.secondary, marginTop: 6, margin: 0 }}>
          Dias com bolinha roxa têm horários disponíveis.
        </p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <button
          type="button"
          onClick={() => mudarMes(-1)}
          disabled={!podeVoltar}
          style={navBtnStyle(!podeVoltar)}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
        </button>
        <div style={{ fontSize: 16, fontWeight: 600, color: tokens.text.primary }}>
          {MESES_PT[mesAtual.mes - 1]} {mesAtual.ano}
        </div>
        <button type="button" onClick={() => mudarMes(1)} style={navBtnStyle(false)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 8 }}>
        {DIAS_SEMANA_CURTO.map((d, i) => (
          <div key={i} style={{ textAlign: 'center', fontSize: 12, fontWeight: 600, color: tokens.text.tertiary, padding: 6 }}>
            {d}
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, opacity: carregando ? 0.5 : 1 }}>
        {dias.map((dia, idx) => {
          if (dia === null) return <div key={idx} />
          const dataISO = mesAtual.ano + '-' + String(mesAtual.mes).padStart(2, '0') + '-' + String(dia).padStart(2, '0')
          const temVagas = !!disponibilidade[dataISO]
          const ehHoje = dataISO === hojeISO
          const ehPassado = dataISO < hojeISO
          const desabilitado = !temVagas || ehPassado

          return (
            <button
              key={idx}
              type="button"
              disabled={desabilitado}
              onClick={() => onSelecionarData(dataISO)}
              style={{
                aspectRatio: '1',
                border: ehHoje ? '1.5px solid ' + tokens.brand.primary : '1px solid transparent',
                borderRadius: 10,
                background: temVagas && !ehPassado ? tokens.brand.primaryLight : 'transparent',
                color: desabilitado ? tokens.text.tertiary : tokens.text.primary,
                fontSize: 14,
                fontWeight: temVagas ? 600 : 500,
                cursor: desabilitado ? 'not-allowed' : 'pointer',
                position: 'relative',
                transition: 'all 0.15s',
                opacity: ehPassado ? 0.35 : 1,
              }}
            >
              {dia}
              {temVagas && !ehPassado && (
                <div style={{
                  position: 'absolute',
                  bottom: 4,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: 5,
                  height: 5,
                  borderRadius: '50%',
                  background: tokens.brand.primary,
                }} />
              )}
            </button>
          )
        })}
      </div>
    </Card>
  )
}

// ─── Seção: Horário ───
function SecaoHorario({ data, slots, carregando, duracao, onSelecionarHorario, onVoltar }: any) {
  const dataObj = new Date(data + 'T12:00:00')
  const dataLabel = dataObj.getDate() + ' de ' + MESES_PT[dataObj.getMonth()].toLowerCase()
  const diaSemana = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][dataObj.getDay()]

  return (
    <Card>
      <ButtonVoltar onClick={onVoltar} />
      <div style={{ marginBottom: 24, marginTop: 12 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, color: tokens.text.primary, margin: 0 }}>
          Horários disponíveis
        </h2>
        <p style={{ fontSize: 14, color: tokens.text.secondary, marginTop: 6, margin: 0 }}>
          {diaSemana}, {dataLabel} · {duracao} minutos por consulta
        </p>
      </div>

      {carregando ? (
        <div style={{ padding: 48, textAlign: 'center', color: tokens.text.tertiary }}>
          Carregando horários...
        </div>
      ) : slots.length === 0 ? (
        <div style={{ padding: 48, textAlign: 'center', color: tokens.text.tertiary, fontSize: 14, background: tokens.bg.cardSubtle, borderRadius: 12 }}>
          Nenhum horário disponível nesta data.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: 10 }}>
          {slots.map((h: string) => (
            <button
              key={h}
              type="button"
              onClick={() => onSelecionarHorario(h)}
              style={{
                padding: '14px 8px',
                border: '1.5px solid ' + tokens.border.default,
                borderRadius: 10,
                background: '#fff',
                color: tokens.text.primary,
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.12s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = tokens.brand.primary
                e.currentTarget.style.background = tokens.brand.primaryLight
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = tokens.border.default
                e.currentTarget.style.background = '#fff'
              }}
            >
              {h}
            </button>
          ))}
        </div>
      )}
    </Card>
  )
}

// ─── Seção: Dados ───
function SecaoDados({ data, horario, nome, setNome, telefone, setTelefone, email, setEmail, motivo, setMotivo, primeiraConsulta, setPrimeiraConsulta, enviando, onConfirmar, onVoltar }: any) {
  const dataObj = new Date(data + 'T12:00:00')
  const dataLabel = dataObj.getDate() + ' de ' + MESES_PT[dataObj.getMonth()].toLowerCase() + ' às ' + horario
  const valido = nome.trim().length >= 2 && telefone.replace(/\D/g, '').length >= 10

  return (
    <Card>
      <ButtonVoltar onClick={onVoltar} />
      <div style={{ marginBottom: 8, marginTop: 12 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, color: tokens.text.primary, margin: 0 }}>
          Seus dados
        </h2>
        <p style={{ fontSize: 14, color: tokens.text.secondary, marginTop: 6, margin: 0 }}>
          Agendamento para {dataLabel}.
        </p>
      </div>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: 12,
        background: tokens.brand.primaryLight,
        borderRadius: 10,
        margin: '20px 0',
        color: tokens.brand.primary,
        fontSize: 13,
        fontWeight: 500,
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="11" width="18" height="11" rx="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        Seus dados são protegidos. Usamos apenas para confirmar a consulta.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <InputField label="Nome completo" value={nome} onChange={setNome} required placeholder="Como você quer ser chamado(a)" />
        <InputField label="WhatsApp" value={telefone} onChange={setTelefone} required placeholder="(11) 99999-9999" type="tel" />
        <InputField label="Email (opcional)" value={email} onChange={setEmail} placeholder="seu@email.com" type="email" />
        <InputField
          label="Motivo da consulta (opcional)"
          value={motivo}
          onChange={setMotivo}
          placeholder="Ex: avaliação inicial, retorno, dor recorrente"
          textarea
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: tokens.text.primary }}>
            É sua primeira consulta?
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <ChipRadio ativo={primeiraConsulta === true} onClick={() => setPrimeiraConsulta(true)} label="Sim, primeira vez" />
            <ChipRadio ativo={primeiraConsulta === false} onClick={() => setPrimeiraConsulta(false)} label="Não, já consultei antes" />
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={onConfirmar}
        disabled={!valido || enviando}
        style={{
          marginTop: 24,
          width: '100%',
          padding: '14px',
          border: 'none',
          borderRadius: 12,
          background: (!valido || enviando) ? tokens.text.tertiary : tokens.brand.primary,
          color: '#fff',
          fontSize: 15,
          fontWeight: 600,
          cursor: (!valido || enviando) ? 'not-allowed' : 'pointer',
          transition: 'background 0.15s',
        }}
      >
        {enviando ? 'Confirmando...' : 'Confirmar agendamento'}
      </button>
    </Card>
  )
}

// ─── Seção: Sucesso ───
function SecaoSucesso({ resultado, data, horario, medico, clinica }: any) {
  const aguardando = resultado === 'aguardando_confirmacao'
  const dataObj = new Date(data + 'T12:00:00')
  const dataLabel = dataObj.getDate() + ' de ' + MESES_PT[dataObj.getMonth()] + ' às ' + horario

  return (
    <Card>
      <div style={{ textAlign: 'center', padding: '16px 8px' }}>
        <div style={{
          width: 72,
          height: 72,
          borderRadius: '50%',
          background: aguardando ? '#FEF3C7' : '#D1FAE5',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 24px',
        }}>
          {aguardando ? (
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          ) : (
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </div>

        <h2 style={{ fontSize: 24, fontWeight: 700, color: tokens.text.primary, margin: 0, marginBottom: 12 }}>
          {aguardando ? 'Solicitação enviada!' : 'Consulta confirmada!'}
        </h2>

        <p style={{ fontSize: 15, color: tokens.text.secondary, lineHeight: 1.5, maxWidth: 480, margin: '0 auto 24px' }}>
          {aguardando
            ? 'O médico vai analisar e confirmar em breve. Você receberá uma mensagem no WhatsApp informado.'
            : 'Sua consulta foi confirmada e adicionada à agenda. Você receberá um lembrete antes do horário.'}
        </p>

        <div style={{
          padding: 20,
          background: tokens.bg.cardSubtle,
          borderRadius: 12,
          textAlign: 'left',
          marginBottom: 8,
        }}>
          <Linha label="Profissional" valor={medico.nome} />
          {medico.especialidade && <Linha label="Especialidade" valor={medico.especialidade} />}
          {clinica && <Linha label="Clínica" valor={clinica.nome} />}
          <Linha label="Data" valor={dataLabel} ultimo />
        </div>
      </div>
    </Card>
  )
}

// ─── Componentes auxiliares ───
function Card({ children }: any) {
  return (
    <div style={{
      background: '#fff',
      borderRadius: 16,
      padding: 24,
      border: '1px solid ' + tokens.border.default,
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    }}>
      {children}
    </div>
  )
}

function ButtonVoltar({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      background: 'none',
      border: 'none',
      color: tokens.text.secondary,
      fontSize: 13,
      fontWeight: 600,
      cursor: 'pointer',
      padding: 4,
    }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
      Voltar
    </button>
  )
}

function InputField({ label, value, onChange, required, placeholder, type = 'text', textarea }: any) {
  const Tag = textarea ? 'textarea' : 'input'
  return (
    <div>
      <label style={{ fontSize: 13, fontWeight: 600, color: tokens.text.primary, display: 'block', marginBottom: 6 }}>
        {label} {required && <span style={{ color: '#EF4444' }}>*</span>}
      </label>
      <Tag
        type={type}
        value={value}
        onChange={(e: any) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={textarea ? 3 : undefined}
        style={{
          width: '100%',
          padding: '12px 14px',
          fontSize: 14,
          color: tokens.text.primary,
          border: '1px solid ' + tokens.border.default,
          borderRadius: 10,
          background: '#fff',
          outline: 'none',
          fontFamily: 'inherit',
          resize: textarea ? 'vertical' : undefined,
          boxSizing: 'border-box',
        }}
      />
    </div>
  )
}

function ChipRadio({ ativo, onClick, label }: any) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1,
        padding: '10px 14px',
        borderRadius: 10,
        border: '1.5px solid ' + (ativo ? tokens.brand.primary : tokens.border.default),
        background: ativo ? tokens.brand.primaryLight : '#fff',
        color: ativo ? tokens.brand.primary : tokens.text.primary,
        fontSize: 13,
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'all 0.12s',
      }}
    >
      {label}
    </button>
  )
}

function Linha({ label, valor, ultimo }: any) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      gap: 16,
      padding: '10px 0',
      borderBottom: ultimo ? 'none' : '1px solid ' + tokens.border.subtle,
    }}>
      <span style={{ fontSize: 13, color: tokens.text.secondary, fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: 14, color: tokens.text.primary, fontWeight: 600, textAlign: 'right' }}>{valor}</span>
    </div>
  )
}

// ─── Estilos compartilhados ───
const containerEstado: React.CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: tokens.bg.page,
}

function navBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    width: 36,
    height: 36,
    borderRadius: 8,
    border: '1px solid ' + tokens.border.default,
    background: '#fff',
    color: disabled ? tokens.text.tertiary : tokens.text.primary,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.4 : 1,
  }
}
