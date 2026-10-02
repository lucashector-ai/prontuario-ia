'use client'

import { useMemo, useState } from 'react'
import {
  Check, X, Copy, Globe, ExternalLink, CalendarDays, Clock, UserRound, FileText, AlertCircle, Stethoscope, Inbox,
} from 'lucide-react'
import { tokens } from '@/lib/design-tokens'
import {
  Card, Button, IconButton, Switch, SegmentedControl, Select, Field, Tabs, Badge, EmptyState, Icon, Avatar, Overline,
} from '@/components/ui'
import type { AgendaConfig } from '@/lib/agenda-publica/slots'

type Aba = 'config' | 'link' | 'form'

const T = tokens

const DIAS_SEMANA = [
  { id: 0, label: 'Dom' },
  { id: 1, label: 'Seg' },
  { id: 2, label: 'Ter' },
  { id: 3, label: 'Qua' },
  { id: 4, label: 'Qui' },
  { id: 5, label: 'Sex' },
  { id: 6, label: 'Sáb' },
]

const DURACOES = [15, 20, 30, 45, 60, 90]
const ANTECEDENCIAS_MIN = [
  { valor: 1, label: '1 hora' },
  { valor: 6, label: '6 horas' },
  { valor: 12, label: '12 horas' },
  { valor: 24, label: '24 horas' },
  { valor: 48, label: '48 horas' },
  { valor: 72, label: '72 horas' },
]
const ANTECEDENCIAS_MAX = [
  { valor: 7, label: '7 dias' },
  { valor: 15, label: '15 dias' },
  { valor: 30, label: '30 dias' },
  { valor: 60, label: '60 dias' },
  { valor: 90, label: '90 dias' },
  { valor: 180, label: '6 meses' },
]

const HORAS: string[] = (() => {
  const arr: string[] = []
  for (let h = 0; h < 24; h++) {
    arr.push(String(h).padStart(2, '0') + ':00')
    arr.push(String(h).padStart(2, '0') + ':30')
  }
  return arr
})()

function formatarDataHora(iso: string): string {
  const d = new Date(iso)
  const dia = String(d.getDate()).padStart(2, '0')
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const hora = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return dia + '/' + mes + ' às ' + hora + ':' + min
}

export default function Conteudo(props: any) {
  const {
    medico, medicosDisponiveis = [], trocarMedicoAtivo,
    ativa, setAtiva, slug, setSlug, config, setConfig,
    usarAlmoco, setUsarAlmoco, salvar, salvando, mensagem,
    statusSlug, validandoSlug, erroSlug, sugestaoSlug, aplicarSugestao,
    copiado, copiarLink, toggleDiaSemana,
    solicitacoes, loadingSolicitacoes, confirmarSolicitacao, rejeitarSolicitacao,
  } = props

  const [aba, setAba] = useState<Aba>('config')
  const linkPreview = 'clinical360.vercel.app/agenda/' + (slug || 'seu-link')
  const adminComMedicos = medicosDisponiveis.length > 1
  const slugSalvo: string | undefined = medico?.slug_publico

  // Valor do SegmentedControl precisa ser string
  const seg = (lista: { valor: number; label: string }[]) => lista.map(o => ({ value: String(o.valor), label: o.label }))

  return (
    <div style={{ padding: 20 }}>
      <style>{`
        .c360-pub-grid { display: grid; grid-template-columns: minmax(0, 1fr) 360px; gap: 20px; align-items: start; }
        @media (max-width: 1100px) { .c360-pub-grid { grid-template-columns: minmax(0, 1fr); } }
        @keyframes spin { to { transform: rotate(360deg) } }
      `}</style>

      {/* Abas + seletor de médico (admin com vários médicos) */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ flex: '1 1 320px', minWidth: 0, overflowX: 'auto', scrollbarWidth: 'none' }}>
          <Tabs
            ativa={aba}
            onChange={(id) => setAba(id as Aba)}
            style={{ marginBottom: 0 }}
            tabs={[
              { id: 'config', label: 'Configurações' },
              { id: 'link', label: 'Link público' },
              { id: 'form', label: 'Formulário pré-consulta' },
            ]}
          />
        </div>
        {adminComMedicos && medico && (
          <Select
            value={medico.id}
            onChange={(e) => trocarMedicoAtivo(e.target.value)}
            style={{ width: 'auto', minWidth: 220, fontWeight: 600, cursor: 'pointer', marginBottom: 6 }}
          >
            {medicosDisponiveis.map((m: any) => (
              <option key={m.id} value={m.id}>{m.nome}{m.especialidade ? ' · ' + m.especialidade : ''}</option>
            ))}
          </Select>
        )}
      </div>

      <div className="c360-pub-grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          {/* Mensagem global */}
          {mensagem && (
            <div style={{
              padding: '12px 14px', borderRadius: 12, fontSize: 13.5, fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: 10,
              background: mensagem.tipo === 'ok' ? T.status.successBg : T.status.dangerBg,
              color: mensagem.tipo === 'ok' ? T.status.success : T.status.danger,
            }}>
              <Icon icon={mensagem.tipo === 'ok' ? Check : AlertCircle} size={16} />
              {mensagem.texto}
            </div>
          )}

          {/* ── Aba Configurações ── */}
          {aba === 'config' && (
            <>
              {/* Status + link */}
              <Card style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: T.text.primary }}>Página de agendamento</span>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: ativa ? T.status.success : T.status.warning }}>
                      {ativa
                        ? 'Ativa · pacientes podem agendar pelo seu link'
                        : 'Desativada · ninguém consegue agendar pelo link'}
                    </span>
                  </div>
                  <Switch checked={ativa} onChange={() => setAtiva(!ativa)} />
                </div>
                <LinkBar
                  link={linkPreview}
                  copiado={copiado}
                  onCopiar={copiarLink}
                  desabilitado={statusSlug === 'erro'}
                  acao={
                    <Button
                      variant="secondary"
                      icon={ExternalLink}
                      disabled={!slugSalvo}
                      title={slugSalvo ? undefined : 'Salve as configurações para abrir a página'}
                      onClick={() => slugSalvo && window.open('/agenda/' + slugSalvo, '_blank')}
                      style={{ height: 40 }}
                    >
                      Abrir página
                    </Button>
                  }
                />
              </Card>

              {/* Regras */}
              <Card titulo="Regras de agendamento" style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <Field label="Duração de cada consulta">
                    <Rolavel>
                      <SegmentedControl
                        options={DURACOES.map(d => ({ value: String(d), label: d + ' min' }))}
                        value={String(config.duracao_consulta_min)}
                        onChange={(v) => setConfig({ ...config, duracao_consulta_min: Number(v) })}
                      />
                    </Rolavel>
                  </Field>
                  <Field label="Antecedência mínima" hint="Quanto tempo antes o paciente precisa agendar">
                    <Rolavel>
                      <SegmentedControl
                        options={seg(ANTECEDENCIAS_MIN)}
                        value={String(config.antecedencia_minima_horas)}
                        onChange={(v) => setConfig({ ...config, antecedencia_minima_horas: Number(v) })}
                      />
                    </Rolavel>
                  </Field>
                  <Field label="Pacientes podem agendar até">
                    <Rolavel>
                      <SegmentedControl
                        options={seg(ANTECEDENCIAS_MAX)}
                        value={String(config.antecedencia_maxima_dias)}
                        onChange={(v) => setConfig({ ...config, antecedencia_maxima_dias: Number(v) })}
                      />
                    </Rolavel>
                  </Field>
                </div>
                <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${T.border.muted}` }}>
                  <Switch
                    checked={config.modo_aprovacao === 'automatico'}
                    onChange={(v) => setConfig({ ...config, modo_aprovacao: v ? 'automatico' : 'manual' })}
                    label="Confirmação automática"
                    descricao={config.modo_aprovacao === 'automatico'
                      ? 'O paciente escolhe o horário e a consulta já entra confirmada.'
                      : 'Solicitações ficam pendentes até você confirmar.'}
                  />
                </div>
              </Card>

              {/* Dias e horários */}
              <Card titulo="Dias e horários">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <Field label="Dias de atendimento">
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {DIAS_SEMANA.map(d => {
                        const on = config.dias_semana.includes(d.id)
                        return (
                          <button
                            key={d.id}
                            type="button"
                            onClick={() => toggleDiaSemana(d.id)}
                            style={{
                              minWidth: 52, height: 36, padding: '0 12px', borderRadius: 10, cursor: 'pointer',
                              fontFamily: 'inherit', fontSize: 13, fontWeight: 600, transition: 'all .12s',
                              border: `1px solid ${on ? T.brand.primary : T.border.default}`,
                              background: on ? T.brand.primarySoftBg : '#fff',
                              color: on ? T.brand.primary : T.text.muted,
                            }}
                          >
                            {d.label}
                          </button>
                        )
                      })}
                    </div>
                  </Field>

                  <Field label="Horário de funcionamento">
                    <IntervaloHoras
                      inicio={config.horario_inicio}
                      fim={config.horario_fim}
                      onInicio={(v) => setConfig({ ...config, horario_inicio: v })}
                      onFim={(v) => setConfig({ ...config, horario_fim: v })}
                    />
                  </Field>

                  <div style={{ paddingTop: 14, borderTop: `1px solid ${T.border.muted}`, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <Switch
                      checked={usarAlmoco}
                      onChange={() => setUsarAlmoco(!usarAlmoco)}
                      label="Intervalo de almoço"
                      descricao={usarAlmoco ? 'Horários nesse intervalo ficam bloqueados.' : 'Sem bloqueio no meio do dia.'}
                    />
                    {usarAlmoco && (
                      <IntervaloHoras
                        inicio={config.intervalo_almoco?.[0] || '12:00'}
                        fim={config.intervalo_almoco?.[1] || '13:00'}
                        onInicio={(v) => setConfig({ ...config, intervalo_almoco: [v, config.intervalo_almoco?.[1] || '13:00'] })}
                        onFim={(v) => setConfig({ ...config, intervalo_almoco: [config.intervalo_almoco?.[0] || '12:00', v] })}
                      />
                    )}
                  </div>
                </div>
              </Card>

              {/* Solicitações pendentes — só no modo manual */}
              {config.modo_aprovacao === 'manual' && (
                <Card
                  titulo="Solicitações pendentes"
                  acao={solicitacoes.length > 0 ? <Badge tone="accent">{solicitacoes.length}</Badge> : undefined}
                >
                  {loadingSolicitacoes ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {[0, 1].map(i => <div key={i} className="c360-skel" style={{ height: 96, borderRadius: 12 }} />)}
                    </div>
                  ) : solicitacoes.length === 0 ? (
                    <EmptyState icon={Inbox} titulo="Nenhuma solicitação pendente" descricao="Quando um paciente pedir um horário, ele aparece aqui para você confirmar." />
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      {solicitacoes.map((s: any, i: number) => (
                        <div key={s.id} style={{
                          padding: '14px 0', borderTop: i === 0 ? 'none' : `1px solid ${T.border.muted}`,
                          display: 'flex', flexDirection: 'column', gap: 10,
                        }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                            <Avatar nome={s.nome_paciente} size={36} />
                            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                              <span style={{ fontSize: 13.5, fontWeight: 600, color: T.text.primary }}>{s.nome_paciente}</span>
                              <span style={{ fontSize: 12.5, color: T.text.quaternary }}>{s.telefone}{s.email ? ' · ' + s.email : ''}</span>
                            </div>
                            <span className="mono" style={{
                              fontSize: 12, fontWeight: 600, color: T.brand.primary, background: T.brand.primarySubtle,
                              padding: '4px 10px', borderRadius: 8, whiteSpace: 'nowrap',
                            }}>
                              {formatarDataHora(s.data_hora)}
                            </span>
                          </div>
                          {s.motivo && (
                            <div style={{ fontSize: 13, color: T.text.secondary, padding: '8px 12px', background: T.bg.page, borderRadius: 10 }}>
                              &quot;{s.motivo}&quot;
                            </div>
                          )}
                          <div style={{ display: 'flex', gap: 8 }}>
                            <Button icon={Check} size="sm" onClick={() => confirmarSolicitacao(s)} style={{ flex: 1 }}>Confirmar</Button>
                            <Button icon={X} size="sm" variant="secondary" onClick={() => rejeitarSolicitacao(s)} style={{ flex: 1 }}>Rejeitar</Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              )}
            </>
          )}

          {/* ── Aba Link público ── */}
          {aba === 'link' && (
            <Card titulo="Seu link público">
              <Field label="Personalize o link" hint="Use apenas letras minúsculas, números e hífens. Mínimo 3 caracteres.">
                <div style={{
                  display: 'flex', alignItems: 'center', height: 40, borderRadius: T.radius.input, background: '#fff', overflow: 'hidden',
                  border: '1px solid ' + (statusSlug === 'erro' ? T.status.dangerLightAlt : T.border.default),
                  transition: 'border-color 0.15s',
                }}>
                  <span className="mono" style={{
                    padding: '0 12px', height: '100%', display: 'flex', alignItems: 'center', fontSize: 12.5,
                    color: T.text.tertiary, background: T.bg.page, borderRight: '1px solid ' + T.border.default, whiteSpace: 'nowrap',
                  }}>
                    clinical360.app/agenda/
                  </span>
                  <input
                    type="text"
                    value={slug}
                    onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    placeholder="seu-nome"
                    className="mono"
                    style={{
                      flex: 1, minWidth: 0, padding: '0 12px', fontSize: 13, color: T.text.primary,
                      border: 'none', outline: 'none', background: 'transparent', height: '100%',
                    }}
                  />
                  <span style={{ padding: '0 12px', display: 'flex', alignItems: 'center' }}>
                    {validandoSlug && (
                      <span style={{ width: 14, height: 14, border: '2px solid ' + T.border.default, borderTopColor: T.brand.primary, borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                    )}
                    {!validandoSlug && statusSlug === 'ok' && <Icon icon={Check} size={16} color={T.status.success} />}
                    {!validandoSlug && statusSlug === 'erro' && <Icon icon={X} size={16} color={T.status.danger} />}
                  </span>
                </div>
              </Field>

              {erroSlug && (
                <div style={{ fontSize: 12.5, color: T.status.danger, marginTop: 8 }}>
                  {erroSlug}
                  {sugestaoSlug && (
                    <>
                      {' '}
                      <button
                        type="button"
                        onClick={aplicarSugestao}
                        style={{ background: 'none', border: 'none', color: T.brand.primary, fontWeight: 600, cursor: 'pointer', padding: 0, fontFamily: 'inherit', fontSize: 'inherit' }}
                      >
                        Usar &quot;{sugestaoSlug}&quot;?
                      </button>
                    </>
                  )}
                </div>
              )}

              <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: T.text.secondary }}>Link para divulgar</span>
                <LinkBar link={linkPreview} copiado={copiado} onCopiar={copiarLink} desabilitado={statusSlug === 'erro'} />
              </div>
            </Card>
          )}

          {/* ── Aba Formulário pré-consulta ── */}
          {aba === 'form' && (
            <Card titulo="Formulário pré-consulta">
              <p style={{ fontSize: 13, color: T.text.secondary, margin: '0 0 14px', lineHeight: 1.5 }}>
                Envie automaticamente um formulário para o paciente após ele agendar pela agenda pública. A IA gera um resumo das respostas para você ler antes da consulta.
              </p>
              {(!props.templates || props.templates.length === 0) ? (
                <EmptyState
                  icon={FileText}
                  titulo="Nenhum formulário criado"
                  descricao="Vá em Formulários no menu e crie o primeiro."
                />
              ) : (
                <Field label="Formulário enviado após o agendamento">
                  <Select
                    value={config.formulario_template_id || ''}
                    onChange={(e) => setConfig({ ...config, formulario_template_id: e.target.value || null })}
                    style={{ cursor: 'pointer' }}
                  >
                    <option value="">Não enviar formulário automaticamente</option>
                    {(props.templates || []).map((t: any) => (
                      <option key={t.id} value={t.id}>{t.nome}</option>
                    ))}
                  </Select>
                </Field>
              )}
            </Card>
          )}

          {/* Salvar */}
          <div style={{
            position: 'sticky', bottom: 0, zIndex: 2, padding: '12px 0',
            background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(6px)',
            borderTop: `1px solid ${T.border.muted}`, display: 'flex', justifyContent: 'flex-end', gap: 12,
          }}>
            <Button onClick={salvar} disabled={salvando || statusSlug === 'erro'}>
              {salvando ? 'Salvando...' : 'Salvar configurações'}
            </Button>
          </div>
        </div>

        {/* Pré-visualização */}
        <PreviaAgenda medico={medico} config={config} ativa={ativa} usarAlmoco={usarAlmoco} />
      </div>
    </div>
  )
}

// ─── Componentes auxiliares ───

function Rolavel({ children }: { children: React.ReactNode }) {
  return <div style={{ maxWidth: '100%', overflowX: 'auto', scrollbarWidth: 'none' }}>{children}</div>
}

function LinkBar({ link, copiado, onCopiar, desabilitado, acao }: {
  link: string
  copiado: boolean
  onCopiar: () => void
  desabilitado?: boolean
  acao?: React.ReactNode
}) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <div style={{
        flex: '1 1 240px', minWidth: 0, display: 'flex', alignItems: 'center', gap: 8, height: 40,
        padding: '0 5px 0 12px', borderRadius: 11, background: T.bg.page,
      }}>
        <Icon icon={Globe} size={14} color={T.text.tertiary} />
        <span className="mono" style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 12.5, color: T.text.muted }}>
          {link}
        </span>
        {copiado ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: T.status.success, padding: '0 8px' }}>
            <Icon icon={Check} size={13} /> Copiado
          </span>
        ) : (
          <IconButton icon={Copy} size={30} onClick={onCopiar} disabled={desabilitado} aria-label="Copiar link" title="Copiar link"
            style={desabilitado ? { opacity: 0.4, cursor: 'not-allowed' } : undefined} />
        )}
      </div>
      {acao}
    </div>
  )
}

function IntervaloHoras({ inicio, fim, onInicio, onFim }: {
  inicio: string
  fim: string
  onInicio: (v: string) => void
  onFim: (v: string) => void
}) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
      <SelectHora valor={inicio} onChange={onInicio} />
      <span style={{ color: T.text.tertiary, fontSize: 13 }}>até</span>
      <SelectHora valor={fim} onChange={onFim} />
    </div>
  )
}

function SelectHora({ valor, onChange }: { valor: string; onChange: (v: string) => void }) {
  return (
    <Select value={valor} onChange={e => onChange(e.target.value)} className="mono" style={{ width: 112, cursor: 'pointer', fontSize: 13 }}>
      {HORAS.map(h => (
        <option key={h} value={h}>{h}</option>
      ))}
    </Select>
  )
}

// ─── Pré-visualização (montada só com a configuração em memória) ───

const DN = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MESES_CURTO = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

const paraMin = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m }
const paraHhmm = (min: number) => String(Math.floor(min / 60)).padStart(2, '0') + ':' + String(min % 60).padStart(2, '0')

/** Horários teóricos do dia (mesma regra de lib/agenda-publica/slots, sem consultar ocupação). */
function slotsTeoricos(config: AgendaConfig, usarAlmoco: boolean): string[] {
  const ini = paraMin(config.horario_inicio), fim = paraMin(config.horario_fim), dur = config.duracao_consulta_min
  const almoco = usarAlmoco && config.intervalo_almoco ? [paraMin(config.intervalo_almoco[0]), paraMin(config.intervalo_almoco[1])] : null
  const out: string[] = []
  if (!dur || dur <= 0) return out
  for (let t = ini; t + dur <= fim; t += dur) {
    if (almoco && t < almoco[1] && t + dur > almoco[0]) continue
    out.push(paraHhmm(t))
  }
  return out
}

function PreviaAgenda({ medico, config, ativa, usarAlmoco }: { medico: any; config: AgendaConfig; ativa: boolean; usarAlmoco: boolean }) {
  const [diaSel, setDiaSel] = useState(0)
  const [slotSel, setSlotSel] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  const slots = useMemo(() => slotsTeoricos(config, usarAlmoco), [config, usarAlmoco])

  // Próximos 5 dias de atendimento respeitando antecedência mínima e máxima
  const dias = useMemo(() => {
    const agora = new Date()
    const limiteMin = new Date(agora.getTime() + config.antecedencia_minima_horas * 3600 * 1000)
    const limiteMax = new Date(agora.getTime() + config.antecedencia_maxima_dias * 86400 * 1000)
    const out: { data: Date; slots: string[] }[] = []
    for (let i = 0; i < 60 && out.length < 5; i++) {
      const d = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + i)
      if (d > limiteMax) break
      if (!config.dias_semana.includes(d.getDay())) continue
      const livres = slots.filter(h => {
        const [hh, mm] = h.split(':').map(Number)
        return new Date(d.getFullYear(), d.getMonth(), d.getDate(), hh, mm) >= limiteMin
      })
      if (livres.length) out.push({ data: d, slots: livres })
    }
    return out
  }, [config, slots])

  const dia = dias[Math.min(diaSel, Math.max(0, dias.length - 1))]
  const iniciais = (medico?.nome || '').split(' ').filter(Boolean).slice(0, 2).map((w: string) => w[0]).join('').toUpperCase()

  function agendar() {
    if (!ativa) { setAviso('Ative a página para receber agendamentos.'); return }
    if (!dia || !slotSel) { setAviso('Escolha um dia e um horário.'); return }
    setAviso('Exemplo: consulta em ' + dia.data.getDate() + ' ' + MESES_CURTO[dia.data.getMonth()] + ' às ' + slotSel +
      (config.modo_aprovacao === 'manual' ? ' · fica pendente até você confirmar.' : ' · confirmada automaticamente.'))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0, position: 'sticky', top: 0 }}>
      <Overline style={{ paddingLeft: 4 }}>Pré-visualização</Overline>
      <div style={{
        border: `1px solid ${T.border.default}`, borderRadius: 22, overflow: 'hidden', background: '#fff',
        boxShadow: '0 18px 44px -24px rgba(28,27,34,.25)', opacity: ativa ? 1 : 0.5, transition: 'opacity .2s',
      }}>
        <div style={{ padding: 20, background: T.brand.primarySoftBg, borderBottom: '1px solid #F0EDFB', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ width: 44, height: 44, borderRadius: 13, background: T.night[800], color: '#fff', display: 'grid', placeItems: 'center', fontSize: 14, fontWeight: 700, flexShrink: 0 }}>
            {iniciais || <Icon icon={UserRound} size={18} />}
          </span>
          <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: T.text.primary }}>{medico?.nome || 'Seu nome'}</span>
            <span style={{ fontSize: 12, color: T.text.quaternary }}>
              {[medico?.especialidade, medico?.crm ? 'CRM ' + medico.crm : null].filter(Boolean).join(' · ') || 'Agendamento online'}
            </span>
          </span>
        </div>

        <div style={{ padding: '18px 20px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: T.text.primary }}>1. Serviço</span>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12,
              border: `1.5px solid ${T.brand.primary}`, background: T.brand.primarySoftBg,
            }}>
              <Icon icon={Stethoscope} size={16} color={T.brand.primary} />
              <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: T.text.primary }}>Consulta</span>
              <span style={{ fontSize: 12, color: T.text.quaternary }}>{config.duracao_consulta_min} min</span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: T.text.primary }}>2. Dia</span>
            {dias.length === 0 ? (
              <span style={{ fontSize: 12.5, color: T.text.quaternary, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Icon icon={CalendarDays} size={14} /> Nenhum dia disponível com essas regras.
              </span>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
                {dias.map((d, i) => {
                  const on = dia === d
                  return (
                    <button key={i} type="button" onClick={() => { setDiaSel(i); setSlotSel(null); setAviso(null) }} style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '8px 0', borderRadius: 11,
                      cursor: 'pointer', fontFamily: 'inherit',
                      background: on ? T.brand.primary : '#fff', color: on ? '#fff' : T.text.primary,
                      border: `1px solid ${on ? T.brand.primary : T.border.default}`,
                    }}>
                      <span style={{ fontSize: 10.5, fontWeight: 700, opacity: 0.8 }}>{DN[d.data.getDay()]}</span>
                      <span style={{ fontSize: 15, fontWeight: 700 }}>{d.data.getDate()}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {dia && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: T.text.primary }}>3. Horário</span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                {dia.slots.slice(0, 12).map(h => {
                  const on = slotSel === h
                  return (
                    <button key={h} type="button" className="mono" onClick={() => { setSlotSel(h); setAviso(null) }} style={{
                      padding: '8px 0', borderRadius: 10, fontSize: 12, fontWeight: 500, cursor: 'pointer', textAlign: 'center',
                      background: on ? T.brand.primary : '#fff', color: on ? '#fff' : T.text.strong,
                      border: `1px solid ${on ? T.brand.primary : T.border.default}`,
                    }}>{h}</button>
                  )
                })}
              </div>
              {dia.slots.length > 12 && (
                <span style={{ fontSize: 11.5, color: T.text.tertiary }}>+{dia.slots.length - 12} horários</span>
              )}
            </div>
          )}

          <Button size="lg" block onClick={agendar} style={{ height: 42 }}>
            {config.modo_aprovacao === 'manual' ? 'Solicitar agendamento' : 'Confirmar agendamento'}
          </Button>
          {aviso && (
            <span style={{ fontSize: 12, color: T.text.secondary, textAlign: 'center', lineHeight: 1.45 }}>{aviso}</span>
          )}
        </div>
      </div>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: T.text.tertiary, paddingLeft: 4 }}>
        <Icon icon={Clock} size={12} /> Prévia com as regras atuais. Horários já ocupados não aparecem aqui.
      </span>
    </div>
  )
}
