'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/Toast'

const ACCENT = '#6043C1'
const ACCENT_LIGHT = '#ede9fb'
const BG = '#F5F5F5'
const CARD_RADIUS = 16

const DIAS = [
  { key: 'seg', label: 'Segunda' },
  { key: 'ter', label: 'Terça' },
  { key: 'qua', label: 'Quarta' },
  { key: 'qui', label: 'Quinta' },
  { key: 'sex', label: 'Sexta' },
  { key: 'sab', label: 'Sábado' },
  { key: 'dom', label: 'Domingo' },
]

const SECOES = [
  { id: 'comportamento', label: 'Comportamento', icon: '⚙' },
  { id: 'pre-atendimento', label: 'Pré-atendimento', icon: '📋' },
  { id: 'tipos', label: 'Tipos de consulta', icon: '🩺' },
  { id: 'horarios', label: 'Horários', icon: '🕐' },
  { id: 'precos', label: 'Valores', icon: '💰' },
  { id: 'saudacao', label: 'Saudação', icon: '👋' },
  { id: 'relatorio', label: 'Relatório diário', icon: '📊' },
]

export default function SofiaConfig() {
  const router = useRouter()
  const { toast } = useToast()
  const [medico, setMedico] = useState<any>(null)
  const [config, setConfig] = useState<any>(null)
  const [salvando, setSalvando] = useState(false)
  const [novoPrecoLabel, setNovoPrecoLabel] = useState('')
  const [novoPrecoValor, setNovoPrecoValor] = useState('')
  const [secaoAtiva, setSecaoAtiva] = useState('comportamento')

  useEffect(() => {
    const ca_ = localStorage.getItem('clinica_admin')
    const m = ca_ || localStorage.getItem('medico')
    if (!m) { router.push('/login'); return }
    const med = JSON.parse(m)
    setMedico(med)
    fetch(`/api/sofia/config?medico_id=${med.id}`)
      .then(r => r.json())
      .then(d => setConfig(d.config))
  }, [router])

  const salvar = async () => {
    if (!medico || !config) return
    setSalvando(true)
    const res = await fetch('/api/sofia/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ medico_id: medico.id, ...config }),
    })
    const data = await res.json()
    setSalvando(false)
    if (data.error) toast(data.error, 'error')
    else toast('Configurações salvas!')
  }

  const addPreco = () => {
    if (!novoPrecoLabel.trim() || !novoPrecoValor) return
    setConfig((c: any) => ({
      ...c,
      precos_tipos: { ...(c.precos_tipos || {}), [novoPrecoLabel.trim()]: Number(novoPrecoValor) }
    }))
    setNovoPrecoLabel('')
    setNovoPrecoValor('')
  }

  const removePreco = (k: string) => {
    setConfig((c: any) => {
      const novos = { ...(c.precos_tipos || {}) }
      delete novos[k]
      return { ...c, precos_tipos: novos }
    })
  }

  const irParaSecao = (id: string) => {
    setSecaoAtiva(id)
    const el = document.getElementById(`secao-${id}`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  if (!medico || !config) {
    return (
      <main style={{ height: '100%', padding: 24, background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 32, height: 32, border: `3px solid ${ACCENT_LIGHT}`, borderTopColor: ACCENT, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
      </main>
    )
  }

  const inputBase: React.CSSProperties = {
    padding: '10px 14px', borderRadius: 10, border: '1px solid #e5e7eb',
    fontSize: 14, fontFamily: 'inherit', color: '#111827',
    background: 'white', outline: 'none', boxSizing: 'border-box',
  }

  return (
    <main style={{ height: '100%', overflow: 'auto', padding: 24, background: BG }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>Sofia · Configurações</h1>
        <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>Personalize como a Sofia atende seus pacientes no WhatsApp</p>
      </div>

      {/* Grid horizontal 2 colunas */}
      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 20, alignItems: 'start' }}>

        {/* COLUNA ESQUERDA — Status + Navegação */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, position: 'sticky' as const, top: 0 }}>
          {/* Card status Sofia */}
          <div style={{ background: 'white', borderRadius: CARD_RADIUS, padding: 20, textAlign: 'center' as const }}>
            <div style={{
              width: 72, height: 72, borderRadius: 18,
              background: config.ativa ? `linear-gradient(135deg, ${ACCENT}, #8b5cf6)` : '#9ca3af',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 12px',
            }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="white">
                <path d="M20.52 3.45c-2.14-2.11-5.04-3.45-8.12-3.45C6.37 0 1.45 4.92 1.45 11c0 1.95.5 3.85 1.45 5.55L1 23l6.6-1.73c1.6.9 3.5 1.36 5.4 1.36 6.03 0 10.95-4.92 10.95-11 0-2.96-1.14-5.76-3.43-8.18z"/>
              </svg>
            </div>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>Sofia</p>
            <span style={{
              fontSize: 11, fontWeight: 700,
              padding: '3px 10px', borderRadius: 20,
              background: config.ativa ? '#ecfdf5' : '#fef2f2',
              color: config.ativa ? '#065f46' : '#991b1b',
            }}>
              {config.ativa ? '● Ativa' : '● Inativa'}
            </span>
            <p style={{ fontSize: 11, color: '#9ca3af', margin: '10px 0 0' }}>
              {config.autonomia === 'auto' ? 'Modo automático' : 'Modo supervisionado'}
            </p>
          </div>

          {/* Navegação de seções */}
          <div style={{ background: 'white', borderRadius: CARD_RADIUS, padding: 8 }}>
            {SECOES.map(s => (
              <button
                key={s.id}
                onClick={() => irParaSecao(s.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  width: '100%', padding: '10px 12px',
                  borderRadius: 10, border: 'none',
                  background: secaoAtiva === s.id ? ACCENT_LIGHT : 'transparent',
                  color: secaoAtiva === s.id ? ACCENT : '#374151',
                  fontSize: 13, fontWeight: secaoAtiva === s.id ? 600 : 500,
                  cursor: 'pointer', textAlign: 'left' as const,
                  transition: 'background 0.12s',
                }}
                onMouseEnter={e => { if (secaoAtiva !== s.id) e.currentTarget.style.background = '#F9FAFB' }}
                onMouseLeave={e => { if (secaoAtiva !== s.id) e.currentTarget.style.background = 'transparent' }}
              >
                <span style={{ fontSize: 15 }}>{s.icon}</span>
                {s.label}
              </button>
            ))}
          </div>

          {/* Botão salvar sticky */}
          <button onClick={salvar} disabled={salvando}
            style={{
              padding: '12px 20px', borderRadius: 12,
              border: 'none', background: salvando ? '#9ca3af' : ACCENT,
              color: 'white', fontSize: 13, fontWeight: 700,
              cursor: salvando ? 'not-allowed' : 'pointer',
            }}>
            {salvando ? 'Salvando...' : '✓ Salvar tudo'}
          </button>
        </div>

        {/* COLUNA DIREITA — Cards de configuração */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Comportamento */}
          <div id="secao-comportamento" style={{ background: 'white', borderRadius: CARD_RADIUS, padding: 24 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>Comportamento geral</h2>
            <p style={{ fontSize: 12, color: '#9ca3af', margin: '0 0 20px' }}>Define se a Sofia está ativa e como ela age</p>

            <ToggleRow
              label="Sofia ativa"
              desc="Quando desligada, a Sofia não responde no WhatsApp"
              value={config.ativa}
              onChange={v => setConfig({ ...config, ativa: v })}
            />
            <div style={{ marginTop: 20 }}>
              <Label>Autonomia</Label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[['auto', 'Automática', 'Sofia age sozinha'], ['supervisionado', 'Supervisionada', 'Você confirma cada ação']].map(([v, t, d]) => (
                  <button key={v} onClick={() => setConfig({ ...config, autonomia: v })}
                    style={{
                      padding: '14px 16px', borderRadius: 12, textAlign: 'left' as const,
                      border: `1.5px solid ${config.autonomia === v ? ACCENT : '#e5e7eb'}`,
                      background: config.autonomia === v ? ACCENT_LIGHT : 'white',
                      cursor: 'pointer',
                    }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: config.autonomia === v ? ACCENT : '#111827' }}>{t}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 11, color: '#6b7280' }}>{d}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Pré-atendimento */}
          <div id="secao-pre-atendimento" style={{ background: 'white', borderRadius: CARD_RADIUS, padding: 24 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>Pré-atendimento</h2>
            <p style={{ fontSize: 12, color: '#9ca3af', margin: '0 0 20px' }}>Sofia coleta informações antes da consulta pra agilizar</p>

            <ToggleRow
              label="Pré-atendimento ativo"
              desc="Sofia pode coletar informações antes da consulta"
              value={config.pre_atendimento_ativo}
              onChange={v => setConfig({ ...config, pre_atendimento_ativo: v })}
            />
            <ToggleRow
              label="Disparo automático após agendamento"
              desc="Quando um agendamento é criado, Sofia pergunta se pode fazer pré-atendimento"
              value={config.pre_atendimento_automatico}
              onChange={v => setConfig({ ...config, pre_atendimento_automatico: v })}
            />
            <div style={{ marginTop: 20 }}>
              <Label>Instruções extras para a IA gerar perguntas</Label>
              <p style={{ margin: '0 0 6px', fontSize: 11, color: '#9ca3af' }}>
                Ex: "sempre pergunte sobre ciclo menstrual para consultas ginecológicas"
              </p>
              <textarea
                value={config.pre_atendimento_prompt_extra || ''}
                onChange={e => setConfig({ ...config, pre_atendimento_prompt_extra: e.target.value })}
                rows={3}
                style={{ ...inputBase, width: '100%', resize: 'vertical' as const }}
              />
            </div>
          </div>

          {/* Tipos de consulta */}
          <div id="secao-tipos" style={{ background: 'white', borderRadius: CARD_RADIUS, padding: 24 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>Tipos de consulta oferecidos</h2>
            <p style={{ fontSize: 12, color: '#9ca3af', margin: '0 0 20px' }}>Sofia pergunta ao paciente qual ele prefere</p>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' as const }}>
              {(['presencial', 'online', 'hibrido'] as const).map(tipo => {
                const tipos: string[] = config.tipos_consulta_aceitos || ['presencial']
                const ativo = tipos.includes(tipo)
                const labels: Record<string, string> = {
                  presencial: '🏥 Presencial',
                  online: '💻 Online',
                  hibrido: '🔄 Híbrido',
                }
                return (
                  <button key={tipo}
                    onClick={() => {
                      const novos = ativo ? tipos.filter(t => t !== tipo) : [...tipos, tipo]
                      if (novos.length === 0) return
                      setConfig({ ...config, tipos_consulta_aceitos: novos })
                    }}
                    style={{
                      padding: '10px 18px', borderRadius: 10,
                      border: `1.5px solid ${ativo ? ACCENT : '#e5e7eb'}`,
                      background: ativo ? ACCENT_LIGHT : 'white',
                      color: ativo ? ACCENT : '#6b7280',
                      fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    }}>
                    {labels[tipo]}
                  </button>
                )
              })}
            </div>
            <div style={{ marginTop: 20 }}>
              <Label>Lembrete da teleconsulta (min antes)</Label>
              <p style={{ margin: '0 0 8px', fontSize: 11, color: '#9ca3af' }}>
                Sofia envia link da sala esse tanto de minutos antes
              </p>
              <input type="number" min={5} max={60}
                value={config.lembrete_teleconsulta_min || 10}
                onChange={e => setConfig({ ...config, lembrete_teleconsulta_min: Number(e.target.value) })}
                style={{ ...inputBase, width: 120 }}/>
              <span style={{ marginLeft: 8, fontSize: 13, color: '#9ca3af' }}>minutos</span>
            </div>
          </div>

          {/* Horários */}
          <div id="secao-horarios" style={{ background: 'white', borderRadius: CARD_RADIUS, padding: 24 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>Horários de funcionamento</h2>
            <p style={{ fontSize: 12, color: '#9ca3af', margin: '0 0 20px' }}>Sofia só oferece agendamento nesses horários. Deixe vazio pra fechado.</p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {DIAS.map(d => (
                <div key={d.key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 80, fontSize: 13, color: '#374151', fontWeight: 500 }}>{d.label}</span>
                  <input
                    value={config.horario_funcionamento?.[d.key] || ''}
                    onChange={e => setConfig({
                      ...config,
                      horario_funcionamento: {
                        ...(config.horario_funcionamento || {}),
                        [d.key]: e.target.value || null,
                      }
                    })}
                    placeholder="08:00-18:00"
                    style={{ ...inputBase, flex: 1, padding: '8px 12px', fontSize: 13 }}
                  />
                </div>
              ))}
            </div>
            <div style={{ marginTop: 20 }}>
              <Label>Duração padrão da consulta (min)</Label>
              <input type="number" value={config.duracao_consulta_padrao}
                onChange={e => setConfig({ ...config, duracao_consulta_padrao: Number(e.target.value) })}
                style={{ ...inputBase, width: 140 }}/>
            </div>
          </div>

          {/* Preços */}
          <div id="secao-precos" style={{ background: 'white', borderRadius: CARD_RADIUS, padding: 24 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>Valores de consulta</h2>
            <p style={{ fontSize: 12, color: '#9ca3af', margin: '0 0 20px' }}>Sofia cita esses valores quando o paciente perguntar</p>

            <div style={{ marginBottom: 20 }}>
              <Label>Consulta padrão</Label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, color: '#9ca3af' }}>R$</span>
                <input type="number" value={config.preco_consulta || ''}
                  onChange={e => setConfig({ ...config, preco_consulta: Number(e.target.value) || null })}
                  placeholder="250"
                  style={{ ...inputBase, width: 180 }}/>
              </div>
            </div>

            <Label>Valores por tipo (opcional)</Label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
              {Object.entries(config.precos_tipos || {}).map(([k, v]) => (
                <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#F9FAFB', borderRadius: 10 }}>
                  <span style={{ flex: 1, fontSize: 13, color: '#374151', fontWeight: 500 }}>{k}</span>
                  <span style={{ fontSize: 13, color: '#111827', fontWeight: 700 }}>R$ {v as number}</span>
                  <button onClick={() => removePreco(k)} style={{ border: 'none', background: 'transparent', color: '#dc2626', fontSize: 18, cursor: 'pointer', padding: 0, width: 24, height: 24 }}>×</button>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={novoPrecoLabel} onChange={e => setNovoPrecoLabel(e.target.value)}
                placeholder="Ex: Retorno"
                style={{ ...inputBase, flex: 1, padding: '9px 12px', fontSize: 13 }}/>
              <input type="number" value={novoPrecoValor} onChange={e => setNovoPrecoValor(e.target.value)}
                placeholder="Valor"
                style={{ ...inputBase, width: 120, padding: '9px 12px', fontSize: 13 }}/>
              <button onClick={addPreco}
                style={{ padding: '9px 18px', borderRadius: 10, border: 'none', background: ACCENT, color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                Adicionar
              </button>
            </div>
          </div>

          {/* Saudação */}
          <div id="secao-saudacao" style={{ background: 'white', borderRadius: CARD_RADIUS, padding: 24 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>Saudação personalizada</h2>
            <p style={{ fontSize: 12, color: '#9ca3af', margin: '0 0 20px' }}>Mensagem inicial que a Sofia envia ao abrir conversa</p>

            <textarea
              value={config.saudacao || ''}
              onChange={e => setConfig({ ...config, saudacao: e.target.value })}
              rows={4}
              placeholder="Ex: Olá! Sou a Sofia, assistente da Clínica São Luís. Como posso te ajudar hoje?"
              style={{ ...inputBase, width: '100%', resize: 'vertical' as const }}
            />
            <p style={{ margin: '8px 0 0', fontSize: 11, color: '#9ca3af' }}>
              Deixe em branco para a Sofia usar a saudação padrão.
            </p>
          </div>

          {/* Relatório diário */}
          <div id="secao-relatorio" style={{ background: 'white', borderRadius: CARD_RADIUS, padding: 24 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>Relatório diário</h2>
            <p style={{ fontSize: 12, color: '#9ca3af', margin: '0 0 20px' }}>Sofia envia resumo das consultas do dia toda manhã</p>

            <ToggleRow
              label="Relatório diário ativo"
              desc="Sofia envia resumo das consultas do dia"
              value={config.relatorio_diario_ativo !== false}
              onChange={v => setConfig({ ...config, relatorio_diario_ativo: v })}
            />
            <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <Label>Horário de envio</Label>
                <input type="time" value={config.relatorio_diario_horario || '07:00'}
                  onChange={e => setConfig({ ...config, relatorio_diario_horario: e.target.value })}
                  style={{ ...inputBase, width: '100%' }}/>
                <p style={{ margin: '4px 0 0', fontSize: 11, color: '#9ca3af' }}>
                  Envio aproximado (pode variar em até 30min)
                </p>
              </div>
              <div>
                <Label>WhatsApp do médico</Label>
                <input type="tel" value={config.relatorio_whatsapp || ''}
                  onChange={e => setConfig({ ...config, relatorio_whatsapp: e.target.value })}
                  placeholder="+55 47 99999-9999"
                  style={{ ...inputBase, width: '100%' }}/>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <Label>E-mail do médico</Label>
                <input type="email" value={config.relatorio_email || ''}
                  onChange={e => setConfig({ ...config, relatorio_email: e.target.value })}
                  placeholder="medico@clinica.com"
                  style={{ ...inputBase, width: '100%' }}/>
              </div>
            </div>

            <div style={{ marginTop: 20 }}>
              <Label>Canais de envio</Label>
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                {(['whatsapp', 'email'] as const).map(canal => {
                  const canais: string[] = config.relatorio_diario_canais || ['whatsapp']
                  const ativo = canais.includes(canal)
                  return (
                    <button key={canal}
                      onClick={() => {
                        const novos = ativo ? canais.filter(c => c !== canal) : [...canais, canal]
                        setConfig({ ...config, relatorio_diario_canais: novos })
                      }}
                      style={{
                        padding: '10px 18px', borderRadius: 10,
                        border: `1.5px solid ${ativo ? ACCENT : '#e5e7eb'}`,
                        background: ativo ? ACCENT_LIGHT : 'white',
                        color: ativo ? ACCENT : '#6b7280',
                        fontSize: 13, fontWeight: 600, cursor: 'pointer',
                        textTransform: 'capitalize' as const,
                      }}>
                      {canal === 'whatsapp' ? '💬 WhatsApp' : '📧 E-mail'}
                    </button>
                  )
                })}
              </div>
            </div>

            <button onClick={async () => {
              if (!medico) return
              const r = await fetch('/api/sofia/relatorio-diario', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ medico_id: medico.id }),
              })
              const d = await r.json()
              if (d.error) toast('Erro: ' + d.error, 'error')
              else toast('Relatório de teste enviado!')
            }}
              style={{ marginTop: 20, padding: '10px 18px', borderRadius: 10, background: 'white', color: '#374151', border: '1px solid #e5e7eb', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              📤 Enviar relatório de teste agora
            </button>
          </div>

        </div>
      </div>
    </main>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label style={{
      display: 'block', fontSize: 11, fontWeight: 600, color: '#6b7280',
      textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6,
    }}>
      {children}
    </label>
  )
}

function ToggleRow({ label, desc, value, onChange }: { label: string; desc: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #f3f4f6' }}>
      <div style={{ flex: 1, paddingRight: 16 }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#111827' }}>{label}</p>
        <p style={{ margin: '2px 0 0', fontSize: 12, color: '#9ca3af' }}>{desc}</p>
      </div>
      <button onClick={() => onChange(!value)}
        style={{
          width: 44, height: 24, borderRadius: 12, border: 'none',
          background: value ? '#6043C1' : '#d1d5db',
          cursor: 'pointer', position: 'relative' as const, flexShrink: 0,
        }}>
        <span style={{
          position: 'absolute' as const, top: 2,
          left: value ? 22 : 2,
          width: 20, height: 20, borderRadius: '50%',
          background: 'white', transition: 'left .2s',
        }}/>
      </button>
    </div>
  )
}
