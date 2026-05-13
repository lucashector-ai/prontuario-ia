'use client'

import { tokens } from '@/lib/design-tokens'

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

// SVG icons inline (sem emoji)
const IconCheck = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <polyline points="20 6 9 17 4 12" />
  </svg>
)
const IconX = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)
const IconCopy = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="9" y="9" width="13" height="13" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
)
const IconLink = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
)
const IconCalendar = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
)
const IconAlert = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
)
const IconUser = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
)

export default function Conteudo(props: any) {
  const {
    medico, ativa, setAtiva, slug, setSlug, config, setConfig,
    usarAlmoco, setUsarAlmoco, salvar, salvando, mensagem,
    statusSlug, validandoSlug, erroSlug, sugestaoSlug, aplicarSugestao,
    copiado, copiarLink, toggleDiaSemana,
    solicitacoes, loadingSolicitacoes, confirmarSolicitacao, rejeitarSolicitacao,
  } = props

  const linkPreview = 'clinical360.vercel.app/agenda/' + (slug || 'seu-link')

  return (
    <div style={{ maxWidth: 880, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: tokens.brand.primary, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 8 }}>
          Configurações
        </div>
        <h1 style={{ fontSize: 32, fontWeight: 600, color: tokens.text.primary, letterSpacing: '-0.02em', margin: 0, marginBottom: 8 }}>
          Agenda pública
        </h1>
        <p style={{ fontSize: 15, color: tokens.text.secondary, margin: 0, maxWidth: 640 }}>
          Crie um link único para que pacientes agendem consultas sem precisar entrar em contato. Estilo Cal.com, com a sua cara.
        </p>
      </div>

      {/* Mensagem global */}
      {mensagem && (
        <div style={{
          padding: '14px 16px',
          borderRadius: 12,
          background: mensagem.tipo === 'ok' ? '#ECFDF5' : '#FEF2F2',
          color: mensagem.tipo === 'ok' ? '#065F46' : '#991B1B',
          fontSize: 14,
          fontWeight: 500,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          border: '1px solid ' + (mensagem.tipo === 'ok' ? '#A7F3D0' : '#FECACA'),
        }}>
          {mensagem.tipo === 'ok' ? <IconCheck /> : <IconAlert />}
          {mensagem.texto}
        </div>
      )}

      {/* Card 1: Status */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: 17, fontWeight: 600, color: tokens.text.primary, margin: 0, marginBottom: 4 }}>
              Status da agenda pública
            </h3>
            <p style={{ fontSize: 14, color: tokens.text.secondary, margin: 0 }}>
              {ativa
                ? 'Pacientes podem agendar usando seu link público.'
                : 'Sua agenda pública está desativada. Ninguém pode agendar pelo link.'}
            </p>
          </div>
          <Toggle ativo={ativa} onChange={() => setAtiva(!ativa)} />
        </div>
      </Card>

      {/* Card 2: Link público */}
      <Card>
        <SectionTitle icon={<IconLink />} title="Seu link público" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: tokens.text.secondary }}>
            Personalize o link
          </label>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            border: '1px solid ' + (statusSlug === 'erro' ? '#FCA5A5' : tokens.border.default),
            borderRadius: 12,
            background: '#fff',
            overflow: 'hidden',
            transition: 'border-color 0.15s',
          }}>
            <div style={{
              padding: '12px 14px',
              fontSize: 14,
              color: tokens.text.tertiary,
              background: tokens.bg.cardSubtle,
              borderRight: '1px solid ' + tokens.border.default,
              whiteSpace: 'nowrap',
            }}>
              clinical360.app/agenda/
            </div>
            <input
              type="text"
              value={slug}
              onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
              placeholder="seu-nome"
              style={{
                flex: 1,
                padding: '12px 14px',
                fontSize: 14,
                fontWeight: 500,
                color: tokens.text.primary,
                border: 'none',
                outline: 'none',
                background: 'transparent',
              }}
            />
            <div style={{ padding: '0 14px', display: 'flex', alignItems: 'center' }}>
              {validandoSlug && (
                <div style={{ width: 14, height: 14, border: '2px solid ' + tokens.border.default, borderTopColor: tokens.brand.primary, borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
              )}
              {!validandoSlug && statusSlug === 'ok' && (
                <div style={{ color: '#10B981', display: 'flex' }}><IconCheck /></div>
              )}
              {!validandoSlug && statusSlug === 'erro' && (
                <div style={{ color: '#EF4444', display: 'flex' }}><IconX /></div>
              )}
            </div>
          </div>
          <style>{'@keyframes spin { to { transform: rotate(360deg) } }'}</style>

          {erroSlug && (
            <div style={{ fontSize: 13, color: '#DC2626', marginTop: 4 }}>
              {erroSlug}
              {sugestaoSlug && (
                <>
                  {' '}
                  <button
                    type="button"
                    onClick={aplicarSugestao}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: tokens.brand.primary,
                      fontWeight: 600,
                      cursor: 'pointer',
                      padding: 0,
                      textDecoration: 'underline',
                    }}
                  >
                    Usar &quot;{sugestaoSlug}&quot;?
                  </button>
                </>
              )}
            </div>
          )}

          <div style={{ fontSize: 12, color: tokens.text.tertiary, marginTop: 4 }}>
            Use apenas letras minúsculas, números e hífens. Mínimo 3 caracteres.
          </div>
        </div>

        {/* Preview do link */}
        <div style={{
          marginTop: 20,
          padding: 16,
          background: tokens.bg.cardSubtle,
          borderRadius: 12,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          border: '1px dashed ' + tokens.border.default,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, color: tokens.text.tertiary, marginBottom: 4 }}>Link para divulgar</div>
            <div style={{
              fontSize: 14,
              fontWeight: 600,
              color: tokens.text.primary,
              fontFamily: 'monospace',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {linkPreview}
            </div>
          </div>
          <button
            type="button"
            onClick={copiarLink}
            disabled={statusSlug === 'erro'}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 14px',
              borderRadius: 8,
              border: '1px solid ' + tokens.border.default,
              background: '#fff',
              color: copiado ? '#10B981' : tokens.text.primary,
              fontSize: 13,
              fontWeight: 600,
              cursor: statusSlug === 'erro' ? 'not-allowed' : 'pointer',
              opacity: statusSlug === 'erro' ? 0.5 : 1,
              transition: 'all 0.15s',
              whiteSpace: 'nowrap',
            }}
          >
            {copiado ? <><IconCheck /> Copiado!</> : <><IconCopy /> Copiar link</>}
          </button>
        </div>
      </Card>

      {/* Card 3: Configurações da agenda */}
      <Card>
        <SectionTitle icon={<IconCalendar />} title="Como funciona sua agenda" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, marginTop: 16 }}>

          {/* Duração */}
          <Field label="Duração de cada consulta">
            <SelectChips
              opcoes={DURACOES.map(d => ({ valor: d, label: d + ' min' }))}
              valor={config.duracao_consulta_min}
              onChange={(v: number) => setConfig({ ...config, duracao_consulta_min: v })}
            />
          </Field>

          {/* Antecedência mínima */}
          <Field label="Antecedência mínima" hint="Quanto tempo antes o paciente precisa agendar">
            <SelectChips
              opcoes={ANTECEDENCIAS_MIN}
              valor={config.antecedencia_minima_horas}
              onChange={(v: number) => setConfig({ ...config, antecedencia_minima_horas: v })}
            />
          </Field>

          {/* Antecedência máxima */}
          <Field label="Antecedência máxima" hint="Quanto tempo no futuro o paciente pode agendar">
            <SelectChips
              opcoes={ANTECEDENCIAS_MAX}
              valor={config.antecedencia_maxima_dias}
              onChange={(v: number) => setConfig({ ...config, antecedencia_maxima_dias: v })}
            />
          </Field>

          {/* Dias da semana */}
          <Field label="Dias de atendimento">
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {DIAS_SEMANA.map(d => {
                const ativo = config.dias_semana.includes(d.id)
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => toggleDiaSemana(d.id)}
                    style={{
                      padding: '10px 16px',
                      borderRadius: 10,
                      border: '1.5px solid ' + (ativo ? tokens.brand.primary : tokens.border.default),
                      background: ativo ? tokens.brand.primary : '#fff',
                      color: ativo ? '#fff' : tokens.text.primary,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.12s',
                      minWidth: 56,
                    }}
                  >
                    {d.label}
                  </button>
                )
              })}
            </div>
          </Field>

          {/* Horário */}
          <Field label="Horário de funcionamento">
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <SelectHora
                valor={config.horario_inicio}
                onChange={(v: string) => setConfig({ ...config, horario_inicio: v })}
              />
              <span style={{ color: tokens.text.tertiary, fontSize: 14 }}>até</span>
              <SelectHora
                valor={config.horario_fim}
                onChange={(v: string) => setConfig({ ...config, horario_fim: v })}
              />
            </div>
          </Field>

          {/* Almoço */}
          <Field label="Intervalo de almoço">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Toggle ativo={usarAlmoco} onChange={() => setUsarAlmoco(!usarAlmoco)} />
                <span style={{ fontSize: 14, color: tokens.text.primary }}>
                  {usarAlmoco ? 'Bloquear horário de almoço' : 'Sem bloqueio de almoço'}
                </span>
              </div>
              {usarAlmoco && (
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <SelectHora
                    valor={config.intervalo_almoco?.[0] || '12:00'}
                    onChange={(v: string) => setConfig({
                      ...config,
                      intervalo_almoco: [v, config.intervalo_almoco?.[1] || '13:00']
                    })}
                  />
                  <span style={{ color: tokens.text.tertiary, fontSize: 14 }}>até</span>
                  <SelectHora
                    valor={config.intervalo_almoco?.[1] || '13:00'}
                    onChange={(v: string) => setConfig({
                      ...config,
                      intervalo_almoco: [config.intervalo_almoco?.[0] || '12:00', v]
                    })}
                  />
                </div>
              )}
            </div>
          </Field>

          {/* Modo de aprovação */}
          <Field label="Como tratar novas solicitações">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <RadioOption
                ativo={config.modo_aprovacao === 'automatico'}
                onClick={() => setConfig({ ...config, modo_aprovacao: 'automatico' })}
                titulo="Confirma direto"
                desc="Paciente escolhe horário e já vira consulta confirmada. Reduz fricção."
              />
              <RadioOption
                ativo={config.modo_aprovacao === 'manual'}
                onClick={() => setConfig({ ...config, modo_aprovacao: 'manual' })}
                titulo="Eu aprovo manualmente"
                desc="Solicitações ficam pendentes até você confirmar ou rejeitar."
              />
            </div>
          </Field>
        </div>
      </Card>

      {/* Card 3.5: Formulário automático */}
      <Card>
        <SectionTitle 
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>}
          title="Formulário pré-consulta" 
        />
        <div style={{ marginTop: 16 }}>
          <p style={{ fontSize: 14, color: tokens.text.secondary, margin: '0 0 16px', lineHeight: 1.5 }}>
            Envie automaticamente um formulário pro paciente após ele agendar pela agenda pública. A IA gera um resumo das respostas pra você ler antes da consulta.
          </p>
          {(!props.templates || props.templates.length === 0) ? (
            <div style={{
              padding: 14,
              background: tokens.bg.cardSubtle,
              borderRadius: 10,
              fontSize: 13,
              color: tokens.text.secondary,
              lineHeight: 1.5,
            }}>
              Você ainda não criou nenhum formulário.<br/>
              Vai em <strong>Formulários</strong> no menu e crie o primeiro.
            </div>
          ) : (
            <select
              value={config.formulario_template_id || ''}
              onChange={(e) => setConfig({ ...config, formulario_template_id: e.target.value || null })}
              style={{
                width: '100%',
                padding: '11px 14px',
                fontSize: 14,
                color: tokens.text.primary,
                border: '1px solid ' + tokens.border.default,
                borderRadius: 10,
                background: '#fff',
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              <option value="">Não enviar formulário automaticamente</option>
              {(props.templates || []).map((t: any) => (
                <option key={t.id} value={t.id}>{t.nome}</option>
              ))}
            </select>
          )}
        </div>
      </Card>

      {/* Card 4: Solicitações pendentes (só se manual) */}
      {config.modo_aprovacao === 'manual' && (
        <Card>
          <SectionTitle
            icon={<IconUser />}
            title="Solicitações pendentes"
            badge={solicitacoes.length > 0 ? String(solicitacoes.length) : undefined}
          />
          <div style={{ marginTop: 16 }}>
            {loadingSolicitacoes ? (
              <div style={{ padding: 32, textAlign: 'center', color: tokens.text.tertiary, fontSize: 14 }}>
                Carregando...
              </div>
            ) : solicitacoes.length === 0 ? (
              <div style={{
                padding: 32,
                textAlign: 'center',
                color: tokens.text.tertiary,
                fontSize: 14,
                background: tokens.bg.cardSubtle,
                borderRadius: 12,
              }}>
                Nenhuma solicitação pendente no momento.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {solicitacoes.map((s: any) => (
                  <div key={s.id} style={{
                    padding: 16,
                    border: '1px solid ' + tokens.border.default,
                    borderRadius: 12,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 600, color: tokens.text.primary }}>
                          {s.nome_paciente}
                        </div>
                        <div style={{ fontSize: 13, color: tokens.text.secondary, marginTop: 2 }}>
                          {s.telefone}{s.email ? ' · ' + s.email : ''}
                        </div>
                      </div>
                      <div style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: tokens.brand.primary,
                        background: tokens.brand.primaryLight,
                        padding: '4px 10px',
                        borderRadius: 8,
                      }}>
                        {formatarDataHora(s.data_hora)}
                      </div>
                    </div>
                    {s.motivo && (
                      <div style={{ fontSize: 13, color: tokens.text.secondary, fontStyle: 'italic' }}>
                        &quot;{s.motivo}&quot;
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => confirmarSolicitacao(s)}
                        style={{
                          flex: 1,
                          padding: '10px 16px',
                          borderRadius: 8,
                          border: 'none',
                          background: tokens.brand.primary,
                          color: '#fff',
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                        }}
                      >
                        <IconCheck /> Confirmar
                      </button>
                      <button
                        type="button"
                        onClick={() => rejeitarSolicitacao(s)}
                        style={{
                          flex: 1,
                          padding: '10px 16px',
                          borderRadius: 8,
                          border: '1px solid ' + tokens.border.default,
                          background: '#fff',
                          color: tokens.text.secondary,
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                        }}
                      >
                        <IconX /> Rejeitar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Botão salvar fixo no final */}
      <div style={{
        position: 'sticky',
        bottom: 0,
        background: tokens.bg.page,
        padding: '16px 0',
        display: 'flex',
        justifyContent: 'flex-end',
        gap: 12,
        marginTop: 8,
      }}>
        <button
          type="button"
          onClick={salvar}
          disabled={salvando || statusSlug === 'erro'}
          style={{
            padding: '12px 28px',
            borderRadius: 10,
            border: 'none',
            background: (salvando || statusSlug === 'erro') ? tokens.text.tertiary : tokens.brand.primary,
            color: '#fff',
            fontSize: 14,
            fontWeight: 600,
            cursor: (salvando || statusSlug === 'erro') ? 'not-allowed' : 'pointer',
            transition: 'background 0.15s',
            boxShadow: '0 2px 8px rgba(96, 67, 193, 0.15)',
          }}
        >
          {salvando ? 'Salvando...' : 'Salvar configurações'}
        </button>
      </div>
    </div>
  )
}

// ─── Componentes auxiliares ───
function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: '#fff',
      borderRadius: 16,
      padding: 24,
      boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
    }}>
      {children}
    </div>
  )
}

function SectionTitle({ icon, title, badge }: { icon: React.ReactNode; title: string; badge?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{
        width: 32,
        height: 32,
        borderRadius: 8,
        background: tokens.brand.primaryLight,
        color: tokens.brand.primary,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {icon}
      </div>
      <h3 style={{ fontSize: 17, fontWeight: 600, color: tokens.text.primary, margin: 0 }}>
        {title}
      </h3>
      {badge && (
        <span style={{
          fontSize: 12,
          fontWeight: 700,
          color: '#fff',
          background: tokens.brand.primary,
          padding: '2px 8px',
          borderRadius: 100,
          marginLeft: 4,
        }}>
          {badge}
        </span>
      )}
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ marginBottom: 8 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: tokens.text.primary, display: 'block' }}>
          {label}
        </label>
        {hint && (
          <div style={{ fontSize: 12, color: tokens.text.tertiary, marginTop: 2 }}>
            {hint}
          </div>
        )}
      </div>
      {children}
    </div>
  )
}

function Toggle({ ativo, onChange }: { ativo: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      onClick={onChange}
      style={{
        width: 44,
        height: 26,
        borderRadius: 100,
        background: ativo ? tokens.brand.primary : '#D1D5DB',
        position: 'relative',
        border: 'none',
        cursor: 'pointer',
        transition: 'background 0.2s',
        flexShrink: 0,
      }}
    >
      <div style={{
        position: 'absolute',
        top: 3,
        left: ativo ? 21 : 3,
        width: 20,
        height: 20,
        background: '#fff',
        borderRadius: '50%',
        transition: 'left 0.2s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
      }} />
    </button>
  )
}

function SelectChips({ opcoes, valor, onChange }: any) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {opcoes.map((o: any) => {
        const ativo = valor === o.valor
        return (
          <button
            key={o.valor}
            type="button"
            onClick={() => onChange(o.valor)}
            style={{
              padding: '8px 14px',
              borderRadius: 8,
              border: '1.5px solid ' + (ativo ? tokens.brand.primary : tokens.border.default),
              background: ativo ? tokens.brand.primary : '#fff',
              color: ativo ? '#fff' : tokens.text.primary,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.12s',
            }}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

function SelectHora({ valor, onChange }: { valor: string; onChange: (v: string) => void }) {
  const horas: string[] = []
  for (let h = 0; h < 24; h++) {
    horas.push(String(h).padStart(2, '0') + ':00')
    horas.push(String(h).padStart(2, '0') + ':30')
  }
  return (
    <select
      value={valor}
      onChange={e => onChange(e.target.value)}
      style={{
        padding: '10px 14px',
        borderRadius: 8,
        border: '1px solid ' + tokens.border.default,
        background: '#fff',
        fontSize: 14,
        fontWeight: 500,
        color: tokens.text.primary,
        cursor: 'pointer',
        outline: 'none',
      }}
    >
      {horas.map(h => (
        <option key={h} value={h}>{h}</option>
      ))}
    </select>
  )
}

function RadioOption({ ativo, onClick, titulo, desc }: any) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        textAlign: 'left',
        padding: 14,
        borderRadius: 10,
        border: '1.5px solid ' + (ativo ? tokens.brand.primary : tokens.border.default),
        background: ativo ? tokens.brand.primaryLight : '#fff',
        cursor: 'pointer',
        transition: 'all 0.12s',
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start',
      }}
    >
      <div style={{
        width: 18,
        height: 18,
        borderRadius: '50%',
        border: '2px solid ' + (ativo ? tokens.brand.primary : tokens.border.strong),
        background: '#fff',
        flexShrink: 0,
        marginTop: 2,
        position: 'relative',
      }}>
        {ativo && (
          <div style={{
            position: 'absolute',
            inset: 3,
            borderRadius: '50%',
            background: tokens.brand.primary,
          }} />
        )}
      </div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: tokens.text.primary }}>{titulo}</div>
        <div style={{ fontSize: 13, color: tokens.text.secondary, marginTop: 2 }}>{desc}</div>
      </div>
    </button>
  )
}
