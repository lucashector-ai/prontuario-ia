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

const MESES_PT = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const MESES_PT_CURTO = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const DIAS_SEMANA_CURTO = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']
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
      <div style={{ minHeight: '100vh', background: tokens.bg.page, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 32, height: 32, border: '2.5px solid ' + tokens.brand.primaryLight, borderTopColor: tokens.brand.primary, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{'@keyframes spin { to { transform: rotate(360deg) } }'}</style>
      </div>
    )
  }

  if (erro || !medico) {
    return (
      <div style={{ minHeight: '100vh', background: tokens.bg.page, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ maxWidth: 420, textAlign: 'center' }}>
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

  // SUCESSO - tela full overlay
  if (mostrandoSucesso && dataSelecionada && horarioSelecionado) {
    return <TelaSucesso resultado={resultadoEnvio} urlFormulario={urlFormulario} data={dataSelecionada} horario={horarioSelecionado} medico={medico} clinica={clinica} />
  }

  const duracao = configMedico?.duracao_consulta_min || 30

  return (
    <div style={{ minHeight: '100vh', background: tokens.bg.page, padding: '24px 16px' }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        .agenda-grid { display: grid; gap: 0; }
        @media (min-width: 768px) {
          .agenda-grid {
            grid-template-columns: 280px 1fr ${dataSelecionada ? '280px' : '0'};
            transition: grid-template-columns 0.3s;
          }
          .agenda-grid-2 {
            grid-template-columns: 280px 1fr 0;
          }
        }
      `}</style>

      <div style={{
        maxWidth: dataSelecionada ? 980 : 760,
        margin: '0 auto',
        background: '#fff',
        borderRadius: 20,
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        overflow: 'hidden',
        transition: 'max-width 0.3s',
      }}>
        <div className={'agenda-grid' + (dataSelecionada ? '' : ' agenda-grid-2')}>
          {/* COLUNA 1 — Info do médico */}
          <div style={{
            padding: '32px 24px',
            borderRight: '1px solid ' + tokens.border.subtle,
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
          }}>
            <div style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background: 'linear-gradient(135deg, ' + tokens.brand.primary + ' 0%, ' + (tokens.brand.primaryDark || tokens.brand.primary) + ' 100%)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 22,
              fontWeight: 700,
            }}>
              {medico.nome.charAt(0).toUpperCase()}
            </div>

            <div>
              {clinica && (
                <div style={{ fontSize: 12, color: tokens.text.tertiary, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>
                  {clinica.nome}
                </div>
              )}
              <h1 style={{ fontSize: 22, fontWeight: 700, color: tokens.text.primary, margin: 0, letterSpacing: '-0.01em', lineHeight: 1.2 }}>
                {medico.nome}
              </h1>
              {medico.especialidade && (
                <div style={{ fontSize: 14, color: tokens.text.secondary, marginTop: 4 }}>
                  {medico.especialidade}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 16, borderTop: '1px solid ' + tokens.border.subtle }}>
              <InfoLinha
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>}
                text={duracao + ' minutos'}
              />
              {medico.crm && (
                <InfoLinha
                  icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>}
                  text={'CRM ' + medico.crm}
                />
              )}
              {configMedico?.modo_aprovacao === 'manual' && (
                <InfoLinha
                  icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 9V5a3 3 0 0 0-6 0v4"/><rect x="3" y="11" width="18" height="11" rx="2"/></svg>}
                  text="Requer confirmação"
                />
              )}
            </div>
          </div>

          {/* COLUNA 2 — Calendário */}
          <div style={{
            padding: '32px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: tokens.text.primary }}>
                <span style={{ fontWeight: 400, color: tokens.text.secondary }}>{MESES_PT_CURTO[mesAtual.mes - 1]}</span>{' '}
                {mesAtual.ano}
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <NavBtn 
                  disabled={(() => {
                    const hoje = new Date()
                    return mesAtual.ano <= hoje.getFullYear() && mesAtual.mes <= hoje.getMonth() + 1
                  })()}
                  onClick={() => {
                    let m = mesAtual.mes - 1, a = mesAtual.ano
                    if (m < 1) { m = 12; a-- }
                    setMesAtual({ ano: a, mes: m })
                    setDataSelecionada(null)
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
                </NavBtn>
                <NavBtn 
                  disabled={false}
                  onClick={() => {
                    let m = mesAtual.mes + 1, a = mesAtual.ano
                    if (m > 12) { m = 1; a++ }
                    setMesAtual({ ano: a, mes: m })
                    setDataSelecionada(null)
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
                </NavBtn>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
              {DIAS_SEMANA_CURTO.map((d, i) => (
                <div key={i} style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, color: tokens.text.tertiary, padding: '6px 0', textTransform: 'uppercase' }}>
                  {d}
                </div>
              ))}
              {(() => {
                const primeiroDia = new Date(mesAtual.ano, mesAtual.mes - 1, 1).getDay()
                const ultimoDia = new Date(mesAtual.ano, mesAtual.mes, 0).getDate()
                const hojeISO = hojeData.toISOString().split('T')[0]
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
                    <button
                      key={idx}
                      type="button"
                      disabled={desabilitado}
                      onClick={() => setDataSelecionada(dataISO)}
                      style={{
                        aspectRatio: '1',
                        border: 'none',
                        borderRadius: 10,
                        background: ehSelecionada ? tokens.brand.primary : (temVagas && !ehPassado ? tokens.brand.primaryLight : 'transparent'),
                        color: ehSelecionada ? '#fff' : (desabilitado ? tokens.text.tertiary : tokens.text.primary),
                        fontSize: 14,
                        fontWeight: ehSelecionada || temVagas ? 600 : 500,
                        cursor: desabilitado ? 'default' : 'pointer',
                        position: 'relative',
                        transition: 'all 0.15s',
                        opacity: ehPassado ? 0.3 : 1,
                        outline: ehHoje && !ehSelecionada ? '1.5px solid ' + tokens.brand.primary : 'none',
                        outlineOffset: -1,
                      }}
                    >
                      {dia}
                    </button>
                  )
                })
              })()}
            </div>
          </div>

          {/* COLUNA 3 — Horários (só aparece quando data selecionada) */}
          {dataSelecionada && (
            <div style={{
              padding: '32px 24px',
              borderLeft: '1px solid ' + tokens.border.subtle,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              maxHeight: 580,
            }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 600, color: tokens.text.primary }}>
                  {(() => {
                    const d = new Date(dataSelecionada + 'T12:00:00')
                    return DIAS_SEMANA_FULL[d.getDay()] + ', ' + d.getDate() + ' ' + MESES_PT_CURTO[d.getMonth()]
                  })()}
                </div>
                <div style={{ fontSize: 12, color: tokens.text.tertiary, marginTop: 2 }}>
                  {slots.length} {slots.length === 1 ? 'horário disponível' : 'horários disponíveis'}
                </div>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {carregandoSlots ? (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
                    <div style={{ width: 20, height: 20, border: '2px solid ' + tokens.border.default, borderTopColor: tokens.brand.primary, borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                  </div>
                ) : slots.length === 0 ? (
                  <div style={{ fontSize: 13, color: tokens.text.tertiary, textAlign: 'center', padding: 24 }}>
                    Nenhum horário livre.
                  </div>
                ) : (
                  slots.map((h: string) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => {
                        setHorarioSelecionado(h)
                        setMostrandoForm(true)
                      }}
                      style={{
                        padding: '12px',
                        border: '1px solid ' + tokens.border.default,
                        borderRadius: 8,
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
                        e.currentTarget.style.color = tokens.brand.primary
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = tokens.border.default
                        e.currentTarget.style.background = '#fff'
                        e.currentTarget.style.color = tokens.text.primary
                      }}
                    >
                      {h}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
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

      <div style={{ textAlign: 'center', marginTop: 32, fontSize: 12, color: tokens.text.tertiary }}>
        Powered by <span style={{ fontWeight: 600, color: tokens.text.secondary }}>Clinical 360</span>
      </div>
    </div>
  )
}

// ─── Tela de sucesso ───
function TelaSucesso({ resultado, urlFormulario, data, horario, medico, clinica }: any) {
  const aguardando = resultado === 'aguardando_confirmacao'
  const dataObj = new Date(data + 'T12:00:00')
  const dataLabel = dataObj.getDate() + ' de ' + MESES_PT[dataObj.getMonth()] + ' às ' + horario

  return (
    <div style={{ minHeight: '100vh', background: tokens.bg.page, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{
        maxWidth: 480,
        width: '100%',
        background: '#fff',
        borderRadius: 20,
        padding: '40px 32px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        textAlign: 'center',
      }}>
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

        <h2 style={{ fontSize: 24, fontWeight: 700, color: tokens.text.primary, margin: 0, marginBottom: 12, letterSpacing: '-0.01em' }}>
          {aguardando ? 'Solicitação enviada!' : 'Consulta confirmada!'}
        </h2>

        <p style={{ fontSize: 15, color: tokens.text.secondary, lineHeight: 1.5, margin: '0 0 24px' }}>
          {aguardando
            ? 'O médico vai analisar e confirmar em breve. Você receberá uma mensagem no WhatsApp informado.'
            : 'Sua consulta foi confirmada e adicionada à agenda. Você receberá um lembrete antes do horário.'}
        </p>

        <div style={{
          padding: 16,
          background: tokens.bg.cardSubtle,
          borderRadius: 12,
          textAlign: 'left',
        }}>
          {urlFormulario && (
            <div style={{
              marginBottom: 16,
              padding: 16,
              background: tokens.brand.primaryLight,
              borderRadius: 12,
              borderLeft: '3px solid ' + tokens.brand.primary,
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: tokens.brand.primary, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Último passo
              </div>
              <div style={{ fontSize: 14, color: tokens.text.primary, fontWeight: 500, marginBottom: 12, lineHeight: 1.5 }}>
                Preencha esse formulário rápido pra agilizar sua consulta:
              </div>
              <a
                href={urlFormulario}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 16px',
                  background: tokens.brand.primary,
                  color: '#fff',
                  borderRadius: 10,
                  fontSize: 14,
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                Preencher formulário
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14"/>
                  <polyline points="12 5 19 12 12 19"/>
                </svg>
              </a>
            </div>
          )}
          <Linha label="Profissional" valor={medico.nome} />
          {medico.especialidade && <Linha label="Especialidade" valor={medico.especialidade} />}
          {clinica && <Linha label="Clínica" valor={clinica.nome} />}
          <Linha label="Data" valor={dataLabel} ultimo />
        </div>
      </div>
    </div>
  )
}

// ─── Modal de dados (overlay) ───
function ModalDados(props: any) {
  const { data, horario, medico, clinica, duracao, nome, setNome, telefone, setTelefone, email, setEmail, motivo, setMotivo, primeiraConsulta, setPrimeiraConsulta, enviando, onConfirmar, onFechar } = props
  
  const dataObj = new Date(data + 'T12:00:00')
  const dataLabel = DIAS_SEMANA_FULL[dataObj.getDay()] + ', ' + dataObj.getDate() + ' de ' + MESES_PT[dataObj.getMonth()].toLowerCase()
  const valido = nome.trim().length >= 2 && telefone.replace(/\D/g, '').length >= 10

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.5)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16,
      zIndex: 50,
    }}
    onClick={(e) => { if (e.target === e.currentTarget) onFechar() }}
    >
      <div style={{
        background: '#fff',
        borderRadius: 16,
        padding: 32,
        maxWidth: 480,
        width: '100%',
        maxHeight: '90vh',
        overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: tokens.text.primary, margin: 0, letterSpacing: '-0.01em' }}>
              Confirmar agendamento
            </h2>
            <p style={{ fontSize: 14, color: tokens.text.secondary, margin: '6px 0 0' }}>
              {dataLabel} às {horario} · {duracao}min
            </p>
          </div>
          <button type="button" onClick={onFechar} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: tokens.text.tertiary }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 24 }}>
          <InputField label="Nome completo" value={nome} onChange={setNome} required placeholder="Como você quer ser chamado(a)" />
          <InputField label="WhatsApp" value={telefone} onChange={setTelefone} required placeholder="(11) 99999-9999" type="tel" />
          <InputField label="Email (opcional)" value={email} onChange={setEmail} placeholder="seu@email.com" type="email" />
          <InputField label="Motivo da consulta (opcional)" value={motivo} onChange={setMotivo} placeholder="Ex: avaliação inicial, retorno, dor recorrente" textarea />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 2 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: tokens.text.primary }}>É sua primeira consulta?</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <ChipRadio ativo={primeiraConsulta === true} onClick={() => setPrimeiraConsulta(true)} label="Sim" />
              <ChipRadio ativo={primeiraConsulta === false} onClick={() => setPrimeiraConsulta(false)} label="Já consultei antes" />
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
          }}
        >
          {enviando ? 'Confirmando...' : 'Confirmar agendamento'}
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16, fontSize: 12, color: tokens.text.tertiary, justifyContent: 'center' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          Seus dados são protegidos.
        </div>
      </div>
    </div>
  )
}

// ─── Auxiliares ───
function InfoLinha({ icon, text }: any) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: tokens.text.secondary }}>
      <div style={{ color: tokens.text.tertiary, display: 'flex' }}>{icon}</div>
      {text}
    </div>
  )
}

function NavBtn({ children, onClick, disabled }: any) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        width: 32,
        height: 32,
        borderRadius: 8,
        border: 'none',
        background: disabled ? 'transparent' : tokens.bg.cardSubtle,
        color: disabled ? tokens.text.tertiary : tokens.text.primary,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        transition: 'background 0.12s',
      }}
    >
      {children}
    </button>
  )
}

function InputField({ label, value, onChange, required, placeholder, type = 'text', textarea }: any) {
  const Tag: any = textarea ? 'textarea' : 'input'
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
          padding: '11px 14px',
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
      padding: '8px 0',
      borderBottom: ultimo ? 'none' : '1px solid ' + tokens.border.subtle,
    }}>
      <span style={{ fontSize: 13, color: tokens.text.secondary, fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: 13, color: tokens.text.primary, fontWeight: 600, textAlign: 'right' }}>{valor}</span>
    </div>
  )
}
