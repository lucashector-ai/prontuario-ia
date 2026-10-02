'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { LucideIcon } from 'lucide-react'
import {
  SlidersHorizontal, ClipboardList, Stethoscope, Clock, Wallet, Hand, BarChart3, Check, Bot,
  Building2, Monitor, Repeat, MessageCircle, Mail, Send, X, Plus,
} from 'lucide-react'
import { useToast } from '@/components/Toast'
import { tokens } from '@/lib/design-tokens'
import { Badge, Button, Card, Chip, Field, Icon, IconButton, Input, Switch, Textarea } from '@/components/ui'

const T = tokens

const DIAS = [
  { key: 'seg', label: 'Segunda' },
  { key: 'ter', label: 'Terça' },
  { key: 'qua', label: 'Quarta' },
  { key: 'qui', label: 'Quinta' },
  { key: 'sex', label: 'Sexta' },
  { key: 'sab', label: 'Sábado' },
  { key: 'dom', label: 'Domingo' },
]

const SECOES: Array<{ id: string; label: string; icon: LucideIcon }> = [
  { id: 'comportamento', label: 'Comportamento', icon: SlidersHorizontal },
  { id: 'pre-atendimento', label: 'Pré-atendimento', icon: ClipboardList },
  { id: 'tipos', label: 'Tipos de consulta', icon: Stethoscope },
  { id: 'horarios', label: 'Horários', icon: Clock },
  { id: 'precos', label: 'Valores', icon: Wallet },
  { id: 'saudacao', label: 'Saudação', icon: Hand },
  { id: 'relatorio', label: 'Relatório diário', icon: BarChart3 },
]

const FAIXA = /^\s*(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})\s*$/

export function Sofia() {
  const router = useRouter()
  const { toast } = useToast()
  const [medico, setMedico] = useState<any>(null)
  const [config, setConfig] = useState<any>(null)
  const [salvando, setSalvando] = useState(false)
  const [novoPrecoLabel, setNovoPrecoLabel] = useState('')
  const [novoPrecoValor, setNovoPrecoValor] = useState('')
  const [secaoAtiva, setSecaoAtiva] = useState('comportamento')
  // Lembra o último horário de cada dia para restaurar ao religar o switch
  const horariosAnteriores = useRef<Record<string, string>>({})

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
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 12 }}>
        {[0, 1, 2].map(i => <div key={i} className="c360-skel" style={{ height: 120, borderRadius: 16 }} />)}
      </div>
    )
  }

  const setHorario = (dia: string, valor: string | null) => setConfig((c: any) => ({
    ...c,
    horario_funcionamento: { ...(c.horario_funcionamento || {}), [dia]: valor || null },
  }))

  return (
    <div className="mc-sofia-grid">
      {/* Coluna esquerda — status + navegação */}
      <div className="mc-sofia-nav" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Card padding={16}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{
              width: 44, height: 44, borderRadius: 14, flexShrink: 0, display: 'grid', placeItems: 'center',
              background: config.ativa ? T.brand.primary : T.border.strong, color: '#fff',
            }}><Icon icon={Bot} size={22} /></span>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: T.text.primary }}>Sofia</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <Badge tone={config.ativa ? 'success' : 'neutral'} dot>{config.ativa ? 'Ativa' : 'Inativa'}</Badge>
                <span style={{ fontSize: 12, color: T.text.quaternary }}>{config.autonomia === 'auto' ? 'Automática' : 'Supervisionada'}</span>
              </span>
            </div>
          </div>
        </Card>

        <Card padding={6}>
          {SECOES.map(s => {
            const on = secaoAtiva === s.id
            return (
              <button
                key={s.id}
                onClick={() => irParaSecao(s.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 10px',
                  borderRadius: 10, border: 'none', fontFamily: 'inherit', textAlign: 'left',
                  background: on ? T.brand.primarySubtle : 'transparent',
                  color: on ? T.brand.primary : T.text.strong,
                  fontSize: 13, fontWeight: on ? 600 : 500, cursor: 'pointer', transition: 'background .12s',
                }}
                onMouseEnter={e => { if (!on) e.currentTarget.style.background = T.bg.hover }}
                onMouseLeave={e => { if (!on) e.currentTarget.style.background = 'transparent' }}
              >
                <Icon icon={s.icon} size={16} active={on} />
                {s.label}
              </button>
            )
          })}
        </Card>

        <Button icon={Check} block onClick={salvar} disabled={salvando}>
          {salvando ? 'Salvando…' : 'Salvar tudo'}
        </Button>
      </div>

      {/* Coluna direita — seções */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>

        <Secao id="comportamento" titulo="Comportamento geral" descricao="Define se a Sofia está ativa e como ela age">
          <Linha>
            <Switch label="Sofia ativa" descricao="Quando desligada, a Sofia não responde no WhatsApp"
              checked={!!config.ativa} onChange={v => setConfig({ ...config, ativa: v })} />
          </Linha>
          <Field label="Autonomia" style={{ marginTop: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
              {[['auto', 'Automática', 'Sofia age sozinha'], ['supervisionado', 'Supervisionada', 'Você confirma cada ação']].map(([v, t, d]) => {
                const sel = config.autonomia === v
                return (
                  <button key={v} onClick={() => setConfig({ ...config, autonomia: v })}
                    style={{
                      padding: '12px 14px', borderRadius: 12, textAlign: 'left', fontFamily: 'inherit', cursor: 'pointer',
                      border: `1px solid ${sel ? T.brand.primary : T.border.default}`,
                      background: sel ? T.brand.primarySoftBg : '#fff', transition: 'all .15s',
                    }}>
                    <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700, color: sel ? T.brand.primary : T.text.primary }}>{t}</span>
                    <span style={{ display: 'block', marginTop: 2, fontSize: 12, color: T.text.quaternary }}>{d}</span>
                  </button>
                )
              })}
            </div>
          </Field>
        </Secao>

        <Secao id="pre-atendimento" titulo="Pré-atendimento" descricao="Sofia coleta informações antes da consulta para agilizar">
          <Linha>
            <Switch label="Pré-atendimento ativo" descricao="Sofia pode coletar informações antes da consulta"
              checked={!!config.pre_atendimento_ativo} onChange={v => setConfig({ ...config, pre_atendimento_ativo: v })} />
          </Linha>
          <Linha>
            <Switch label="Disparo automático após agendamento" descricao="Quando um agendamento é criado, Sofia pergunta se pode fazer pré-atendimento"
              checked={!!config.pre_atendimento_automatico} onChange={v => setConfig({ ...config, pre_atendimento_automatico: v })} />
          </Linha>
          <Field label="Instruções extras para a IA gerar perguntas" hint='Ex.: "sempre pergunte sobre ciclo menstrual para consultas ginecológicas"' style={{ marginTop: 14 }}>
            <Textarea
              value={config.pre_atendimento_prompt_extra || ''}
              onChange={e => setConfig({ ...config, pre_atendimento_prompt_extra: e.target.value })}
              rows={3}
            />
          </Field>
        </Secao>

        <Secao id="tipos" titulo="Tipos de consulta oferecidos" descricao="Sofia pergunta ao paciente qual ele prefere">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {([['presencial', 'Presencial', Building2], ['online', 'Online', Monitor], ['hibrido', 'Híbrido', Repeat]] as const).map(([tipo, label, ic]) => {
              const tipos: string[] = config.tipos_consulta_aceitos || ['presencial']
              const ativo = tipos.includes(tipo)
              return (
                <Chip key={tipo} ativo={ativo} icon={ic}
                  onClick={() => {
                    const novos = ativo ? tipos.filter(t => t !== tipo) : [...tipos, tipo]
                    if (novos.length === 0) return
                    setConfig({ ...config, tipos_consulta_aceitos: novos })
                  }}>
                  {label}
                </Chip>
              )
            })}
          </div>
          <Field label="Lembrete da teleconsulta" hint="Sofia envia o link da sala esse tanto de minutos antes" style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Input type="number" min={5} max={60}
                value={config.lembrete_teleconsulta_min || 10}
                onChange={e => setConfig({ ...config, lembrete_teleconsulta_min: Number(e.target.value) })}
                style={{ width: 100 }} />
              <span style={{ fontSize: 13, color: T.text.quaternary }}>minutos antes</span>
            </div>
          </Field>
        </Secao>

        <Secao id="horarios" titulo="Horário de funcionamento" descricao="Sofia só oferece agendamento nesses horários.">
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {DIAS.map((d, i) => {
              const valor: string = config.horario_funcionamento?.[d.key] || ''
              const aberto = !!valor
              const m = valor.match(FAIXA)
              return (
                <div key={d.key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0', borderTop: i ? `1px solid ${T.border.muted}` : 'none', flexWrap: 'wrap', minHeight: 34 }}>
                  <Switch
                    checked={aberto}
                    onChange={v => {
                      if (v) setHorario(d.key, horariosAnteriores.current[d.key] || '08:00-18:00')
                      else { horariosAnteriores.current[d.key] = valor; setHorario(d.key, null) }
                    }}
                  />
                  <span style={{ width: 80, fontSize: 13.5, fontWeight: 600, color: aberto ? T.text.primary : T.text.tertiary }}>{d.label}</span>
                  {!aberto ? (
                    <span style={{ fontSize: 13, color: T.text.tertiary }}>Fechado</span>
                  ) : m ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Input type="time" className="mono" value={m[1].padStart(5, '0')}
                        onChange={e => setHorario(d.key, `${e.target.value}-${m[2]}`)}
                        style={{ width: 104, minHeight: 34, padding: '5px 10px', textAlign: 'center', fontSize: 12.5, fontFamily: T.font.mono }} />
                      <span style={{ color: T.text.tertiary }}>–</span>
                      <Input type="time" value={m[2].padStart(5, '0')}
                        onChange={e => setHorario(d.key, `${m[1]}-${e.target.value}`)}
                        style={{ width: 104, minHeight: 34, padding: '5px 10px', textAlign: 'center', fontSize: 12.5, fontFamily: T.font.mono }} />
                    </div>
                  ) : (
                    <Input value={valor} placeholder="08:00-18:00"
                      onChange={e => setHorario(d.key, e.target.value)}
                      style={{ flex: 1, minWidth: 160, minHeight: 34, padding: '5px 10px', fontSize: 12.5, fontFamily: T.font.mono }} />
                  )}
                </div>
              )
            })}
          </div>
          <Field label="Duração padrão da consulta (min)" style={{ marginTop: 14 }}>
            <Input type="number" value={config.duracao_consulta_padrao}
              onChange={e => setConfig({ ...config, duracao_consulta_padrao: Number(e.target.value) })}
              style={{ width: 120 }} />
          </Field>
        </Secao>

        <Secao id="precos" titulo="Valores de consulta" descricao="Sofia cita esses valores quando o paciente perguntar">
          <Field label="Consulta padrão (R$)">
            <Input type="number" value={config.preco_consulta || ''}
              onChange={e => setConfig({ ...config, preco_consulta: Number(e.target.value) || null })}
              placeholder="250" style={{ width: 180 }} />
          </Field>

          <Field label="Valores por tipo (opcional)" style={{ marginTop: 16 }}>
            {Object.keys(config.precos_tipos || {}).length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', border: `1px solid ${T.border.default}`, borderRadius: 12, overflow: 'hidden' }}>
                {Object.entries(config.precos_tipos || {}).map(([k, v], i) => (
                  <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 8px 8px 14px', borderTop: i ? `1px solid ${T.border.muted}` : 'none' }}>
                    <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: T.text.strong }}>{k}</span>
                    <span style={{ fontSize: 13.5, fontWeight: 700, color: T.text.primary, fontVariantNumeric: 'tabular-nums' }}>R$ {v as number}</span>
                    <IconButton icon={X} size={28} tone="danger" onClick={() => removePreco(k)} aria-label="Remover" />
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Input value={novoPrecoLabel} onChange={e => setNovoPrecoLabel(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addPreco() }}
                placeholder="Ex.: Retorno" style={{ flex: 1, minWidth: 140 }} />
              <Input type="number" value={novoPrecoValor} onChange={e => setNovoPrecoValor(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addPreco() }}
                placeholder="Valor" style={{ width: 120 }} />
              <Button variant="secondary" icon={Plus} onClick={addPreco} style={{ height: 40 }}>Adicionar</Button>
            </div>
          </Field>
        </Secao>

        <Secao id="saudacao" titulo="Saudação personalizada" descricao="Mensagem inicial que a Sofia envia ao abrir conversa">
          <Field label="Mensagem" hint="Deixe em branco para a Sofia usar a saudação padrão.">
            <Textarea
              value={config.saudacao || ''}
              onChange={e => setConfig({ ...config, saudacao: e.target.value })}
              rows={4}
              placeholder="Ex.: Olá! Sou a Sofia, assistente da Clínica São Luís. Como posso te ajudar hoje?"
            />
          </Field>
        </Secao>

        <Secao id="relatorio" titulo="Relatório diário" descricao="Sofia envia um resumo das consultas do dia toda manhã">
          <Linha>
            <Switch label="Relatório diário ativo" descricao="Sofia envia resumo das consultas do dia"
              checked={config.relatorio_diario_ativo !== false} onChange={v => setConfig({ ...config, relatorio_diario_ativo: v })} />
          </Linha>
          <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <Field label="Horário de envio" hint="Envio aproximado (pode variar em até 30 min)">
              <Input type="time" value={config.relatorio_diario_horario || '07:00'}
                onChange={e => setConfig({ ...config, relatorio_diario_horario: e.target.value })}
                style={{ fontFamily: T.font.mono }} />
            </Field>
            <Field label="WhatsApp do médico">
              <Input type="tel" value={config.relatorio_whatsapp || ''}
                onChange={e => setConfig({ ...config, relatorio_whatsapp: e.target.value })}
                placeholder="+55 47 99999-9999" />
            </Field>
            <Field label="E-mail do médico" style={{ gridColumn: '1 / -1' }}>
              <Input type="email" value={config.relatorio_email || ''}
                onChange={e => setConfig({ ...config, relatorio_email: e.target.value })}
                placeholder="medico@clinica.com" />
            </Field>
          </div>

          <Field label="Canais de envio" style={{ marginTop: 14 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {(['whatsapp', 'email'] as const).map(canal => {
                const canais: string[] = config.relatorio_diario_canais || ['whatsapp']
                const ativo = canais.includes(canal)
                return (
                  <Chip key={canal} ativo={ativo} icon={canal === 'whatsapp' ? MessageCircle : Mail}
                    onClick={() => {
                      const novos = ativo ? canais.filter(c => c !== canal) : [...canais, canal]
                      setConfig({ ...config, relatorio_diario_canais: novos })
                    }}>
                    {canal === 'whatsapp' ? 'WhatsApp' : 'E-mail'}
                  </Chip>
                )
              })}
            </div>
          </Field>

          <div style={{ marginTop: 16 }}>
            <Button variant="secondary" icon={Send} onClick={async () => {
              if (!medico) return
              const r = await fetch('/api/sofia/relatorio-diario', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ medico_id: medico.id }),
              })
              const d = await r.json()
              if (d.error) toast('Erro: ' + d.error, 'error')
              else toast('Relatório de teste enviado!')
            }}>
              Enviar relatório de teste agora
            </Button>
          </div>
        </Secao>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .mc-sofia-grid { display: grid; grid-template-columns: 240px minmax(0, 1fr); gap: 16px; align-items: start; }
        .mc-sofia-nav { position: sticky; top: 0; }
        @media (max-width: 860px) {
          .mc-sofia-grid { grid-template-columns: minmax(0, 1fr); }
          .mc-sofia-nav { position: static; }
        }
      ` }} />
    </div>
  )
}

/** Seção da Sofia: Card com título 15/700 + subtítulo, âncora para a navegação lateral. */
function Secao({ id, titulo, descricao, children }: { id: string; titulo: string; descricao?: string; children: React.ReactNode }) {
  return (
    <div id={`secao-${id}`} style={{ scrollMarginTop: 12 }}>
      <Card>
        <div style={{ marginBottom: 14, marginTop: -2 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, letterSpacing: '-.01em', color: T.text.primary }}>{titulo}</h3>
          {descricao && <p style={{ margin: '3px 0 0', fontSize: 12.5, color: T.text.quaternary }}>{descricao}</p>}
        </div>
        {children}
      </Card>
    </div>
  )
}

function Linha({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: '10px 0', borderTop: `1px solid ${T.border.muted}` }}>{children}</div>
}
