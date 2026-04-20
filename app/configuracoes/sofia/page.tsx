'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sidebar } from '@/components/Sidebar'
import { useToast } from '@/components/Toast'

const DIAS = [
  { key: 'seg', label: 'Segunda' },
  { key: 'ter', label: 'Terça' },
  { key: 'qua', label: 'Quarta' },
  { key: 'qui', label: 'Quinta' },
  { key: 'sex', label: 'Sexta' },
  { key: 'sab', label: 'Sábado' },
  { key: 'dom', label: 'Domingo' },
]

export default function SofiaConfig() {
  const router = useRouter()
  const { toast } = useToast()
  const [medico, setMedico] = useState<any>(null)
  const [config, setConfig] = useState<any>(null)
  const [salvando, setSalvando] = useState(false)
  const [novoPrecoLabel, setNovoPrecoLabel] = useState('')
  const [novoPrecoValor, setNovoPrecoValor] = useState('')

  useEffect(() => {
    const m = localStorage.getItem('medico')
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

  if (!medico || !config) return null

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#F9FAFC', overflow: 'hidden' }}>
      <Sidebar />
      <main style={{ flex: 1, overflow: 'auto', padding: '24px 32px' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 42, height: 42, borderRadius: 10, background: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M20.52 3.45c-2.14-2.11-5.04-3.45-8.12-3.45C6.37 0 1.45 4.92 1.45 11c0 1.95.5 3.85 1.45 5.55L1 23l6.6-1.73c1.6.9 3.5 1.36 5.4 1.36 6.03 0 10.95-4.92 10.95-11 0-2.96-1.14-5.76-3.43-8.18z"/></svg>
            </div>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: 0 }}>Sofia · Configurações</h1>
              <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>Personalize como a Sofia atende seus pacientes no WhatsApp</p>
            </div>
          </div>

          {/* Ativa / Autonomia */}
          <Card title="Comportamento geral">
            <ToggleRow
              label="Sofia ativa"
              desc="Quando desligada, a Sofia não responde no WhatsApp"
              value={config.ativa}
              onChange={v => setConfig({ ...config, ativa: v })}
            />
            <div style={{ marginTop: 16 }}>
              <Label>Autonomia</Label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[['auto', 'Automática', 'Sofia age sozinha'], ['supervisionado', 'Supervisionada', 'Você confirma cada ação']].map(([v, t, d]) => (
                  <button key={v} onClick={() => setConfig({ ...config, autonomia: v })}
                    style={{
                      padding: '12px 14px', borderRadius: 10, textAlign: 'left',
                      border: `1.5px solid ${config.autonomia === v ? '#6043C1' : '#e5e7eb'}`,
                      background: config.autonomia === v ? '#f3f0fd' : 'white',
                      cursor: 'pointer',
                    }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: config.autonomia === v ? '#6043C1' : '#111827' }}>{t}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 11, color: '#6b7280' }}>{d}</p>
                  </button>
                ))}
              </div>
            </div>
          </Card>

          {/* Pré-atendimento */}
          <Card title="Pré-atendimento">
            <ToggleRow
              label="Pré-atendimento ativo"
              desc="Sofia pode coletar informações antes da consulta"
              value={config.pre_atendimento_ativo}
              onChange={v => setConfig({ ...config, pre_atendimento_ativo: v })}
            />
            <ToggleRow
              label="Disparo automático após agendamento"
              desc="Sempre que um agendamento é criado, Sofia pergunta se pode fazer pré-atendimento"
              value={config.pre_atendimento_automatico}
              onChange={v => setConfig({ ...config, pre_atendimento_automatico: v })}
            />
            <div style={{ marginTop: 16 }}>
              <Label>Instruções extras para a IA gerar perguntas</Label>
              <p style={{ margin: '0 0 6px', fontSize: 11, color: '#9ca3af' }}>
                Ex: "sempre pergunte sobre ciclo menstrual para consultas ginecológicas", "nunca pergunte sobre uso de drogas"
              </p>
              <textarea
                value={config.pre_atendimento_prompt_extra || ''}
                onChange={e => setConfig({ ...config, pre_atendimento_prompt_extra: e.target.value })}
                rows={3}
                style={{
                  width: '100%', padding: 10, borderRadius: 8, border: '1.5px solid #e5e7eb',
                  fontSize: 13, fontFamily: 'inherit', resize: 'vertical',
                }}
              />
            </div>
          </Card>

          {/* Horários */}
          <Card title="Horários de funcionamento">
            <p style={{ margin: '0 0 12px', fontSize: 12, color: '#6b7280' }}>
              Sofia só oferece agendamento nestes horários. Formato: 08:00-18:00 (ou deixe em branco para fechado)
            </p>
            {DIAS.map(d => (
              <div key={d.key} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span style={{ width: 90, fontSize: 13, color: '#374151' }}>{d.label}</span>
                <input
                  value={config.horario_funcionamento?.[d.key] || ''}
                  onChange={e => setConfig({
                    ...config,
                    horario_funcionamento: {
                      ...(config.horario_funcionamento || {}),
                      [d.key]: e.target.value || null,
                    }
                  })}
                  placeholder="08:00-18:00 ou vazio"
                  style={{ flex: 1, padding: '7px 10px', borderRadius: 7, border: '1px solid #e5e7eb', fontSize: 13 }}
                />
              </div>
            ))}
            <div style={{ marginTop: 12 }}>
              <Label>Duração padrão da consulta (min)</Label>
              <input type="number" value={config.duracao_consulta_padrao}
                onChange={e => setConfig({ ...config, duracao_consulta_padrao: Number(e.target.value) })}
                style={{ width: 120, padding: '7px 10px', borderRadius: 7, border: '1px solid #e5e7eb', fontSize: 13 }}/>
            </div>
          </Card>

          {/* Preços */}
          <Card title="Valores de consulta">
            <p style={{ margin: '0 0 12px', fontSize: 12, color: '#6b7280' }}>
              Quando o paciente perguntar sobre valores, Sofia cita o que estiver aqui
            </p>
            <div style={{ marginBottom: 14 }}>
              <Label>Consulta padrão</Label>
              <input type="number" value={config.preco_consulta || ''} onChange={e => setConfig({ ...config, preco_consulta: Number(e.target.value) || null })}
                placeholder="Ex: 250"
                style={{ width: 180, padding: '7px 10px', borderRadius: 7, border: '1px solid #e5e7eb', fontSize: 13 }}/>
              <span style={{ marginLeft: 6, fontSize: 12, color: '#9ca3af' }}>R$</span>
            </div>

            <Label>Valores por tipo (opcional)</Label>
            {Object.entries(config.precos_tipos || {}).map(([k, v]) => (
              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ flex: 1, fontSize: 13, color: '#374151' }}>{k}</span>
                <span style={{ fontSize: 13, color: '#111827', fontWeight: 600 }}>R$ {v as number}</span>
                <button onClick={() => removePreco(k)} style={{ border: 'none', background: 'transparent', color: '#dc2626', fontSize: 16, cursor: 'pointer' }}>×</button>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <input value={novoPrecoLabel} onChange={e => setNovoPrecoLabel(e.target.value)}
                placeholder="Ex: Retorno"
                style={{ flex: 1, padding: '7px 10px', borderRadius: 7, border: '1px solid #e5e7eb', fontSize: 13 }}/>
              <input type="number" value={novoPrecoValor} onChange={e => setNovoPrecoValor(e.target.value)}
                placeholder="Valor"
                style={{ width: 100, padding: '7px 10px', borderRadius: 7, border: '1px solid #e5e7eb', fontSize: 13 }}/>
              <button onClick={addPreco}
                style={{ padding: '7px 14px', borderRadius: 7, border: 'none', background: '#6043C1', color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                Adicionar
              </button>
            </div>
          </Card>

          {/* Saudação */}
          <Card title="Saudação personalizada">
            <Label>Mensagem inicial (opcional)</Label>
            <p style={{ margin: '0 0 6px', fontSize: 11, color: '#9ca3af' }}>
              Ex: "Olá! Sou a Sofia, da Clínica São Luís. Como posso te ajudar hoje?"
            </p>
            <textarea
              value={config.saudacao || ''}
              onChange={e => setConfig({ ...config, saudacao: e.target.value })}
              rows={3}
              style={{ width: '100%', padding: 10, borderRadius: 8, border: '1.5px solid #e5e7eb', fontSize: 13, fontFamily: 'inherit', resize: 'vertical' }}
              placeholder="Deixe em branco para usar o padrão"
            />
          </Card>

                    {/* Relatório diário */}
          <Card title="Relatório diário">
            <ToggleRow
              label="Relatório diário ativo"
              desc="Sofia envia resumo das consultas do dia toda manhã"
              value={config.relatorio_diario_ativo !== false}
              onChange={v => setConfig({ ...config, relatorio_diario_ativo: v })}
            />
            <div style={{ marginTop: 14 }}>
              <Label>Horário de envio</Label>
              <input type="time" value={config.relatorio_diario_horario || '07:00'}
                onChange={e => setConfig({ ...config, relatorio_diario_horario: e.target.value })}
                style={{ width: 140, padding: '7px 10px', borderRadius: 7, border: '1px solid #e5e7eb', fontSize: 13 }}/>
              <p style={{ margin: '4px 0 0', fontSize: 11, color: '#9ca3af' }}>
                Envio aproximado (pode variar em até 30min)
              </p>
            </div>
            <div style={{ marginTop: 14 }}>
              <Label>Canais de envio</Label>
              <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
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
                        padding: '8px 16px', borderRadius: 8,
                        border: `1.5px solid ${ativo ? '#6043C1' : '#e5e7eb'}`,
                        background: ativo ? '#f3f0fd' : 'white',
                        color: ativo ? '#6043C1' : '#6b7280',
                        fontSize: 13, fontWeight: 600, cursor: 'pointer',
                        textTransform: 'capitalize',
                      }}>
                      {canal === 'whatsapp' ? '💬 WhatsApp' : '📧 E-mail'}
                    </button>
                  )
                })}
              </div>
            </div>
            <div style={{ marginTop: 14 }}>
              <Label>WhatsApp do médico (para receber relatório)</Label>
              <input type="tel" value={config.relatorio_whatsapp || ''}
                onChange={e => setConfig({ ...config, relatorio_whatsapp: e.target.value })}
                placeholder="+55 47 99999-9999"
                style={{ width: '100%', maxWidth: 300, padding: '7px 10px', borderRadius: 7, border: '1px solid #e5e7eb', fontSize: 13 }}/>
            </div>
            <div style={{ marginTop: 14 }}>
              <Label>E-mail do médico</Label>
              <input type="email" value={config.relatorio_email || ''}
                onChange={e => setConfig({ ...config, relatorio_email: e.target.value })}
                placeholder="medico@clinica.com"
                style={{ width: '100%', maxWidth: 300, padding: '7px 10px', borderRadius: 7, border: '1px solid #e5e7eb', fontSize: 13 }}/>
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
              style={{ marginTop: 14, padding: '8px 16px', borderRadius: 7, border: '1px solid #e5e7eb', background: 'white', color: '#374151', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              📤 Enviar relatório de teste agora
            </button>
          </Card>

          <div style={{ position: 'sticky', bottom: 0, padding: '16px 0', background: '#F9FAFC', borderTop: '1px solid #f3f4f6', marginTop: 20, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button onClick={() => router.back()}
              style={{ padding: '10px 18px', borderRadius: 8, border: '1px solid #e5e7eb', background: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#374151' }}>
              Cancelar
            </button>
            <button onClick={salvar} disabled={salvando}
              style={{ padding: '10px 24px', borderRadius: 8, border: 'none', background: '#6043C1', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              {salvando ? 'Salvando...' : 'Salvar configurações'}
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'white', borderRadius: 12, padding: 20, marginBottom: 14, border: '1px solid #f3f4f6' }}>
      <h2 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 700, color: '#111827' }}>{title}</h2>
      {children}
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{children}</label>
}

function ToggleRow({ label, desc, value, onChange }: { label: string; desc: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f9fafb' }}>
      <div>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#111827' }}>{label}</p>
        <p style={{ margin: '2px 0 0', fontSize: 11, color: '#9ca3af' }}>{desc}</p>
      </div>
      <button onClick={() => onChange(!value)}
        style={{ width: 44, height: 24, borderRadius: 12, border: 'none', background: value ? '#6043C1' : '#d1d5db', cursor: 'pointer', position: 'relative', flexShrink: 0 }}>
        <span style={{ position: 'absolute', top: 2, left: value ? 22 : 2, width: 20, height: 20, borderRadius: '50%', background: 'white', transition: 'left .2s' }}/>
      </button>
    </div>
  )
}
