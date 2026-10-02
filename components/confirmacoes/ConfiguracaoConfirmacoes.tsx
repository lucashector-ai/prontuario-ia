'use client'
/**
 * Aba "Confirmações" de Minha clínica → Automações: liga/desliga os envios automáticos
 * (48h, 24h, 2h, oferta de vaga), edita os modelos com pré-visualização, envia teste
 * e mostra os números dos últimos 30 dias. `?demo=1` usa dados de exemplo e não grava.
 */
import { useEffect, useMemo, useState } from 'react'
import { BellRing, CalendarCheck, CalendarClock, CheckCircle2, Clock, Hourglass, MessageCircle, RotateCcw, Send, TriangleAlert, UserX } from 'lucide-react'
import { tokens } from '@/lib/design-tokens'
import { supabase } from '@/lib/supabase'
import { Badge, Button, Card, Field, Icon, IconTile, ProgressBar, SegmentedControl, Select, Switch, Textarea } from '@/components/ui'
import { notificar } from '@/components/ui/dialogos'
import {
  BOTOES_CONFIRMACAO_24H, CONFIG_PADRAO, MODELOS_PADRAO, dataHoraSP, preencher, type ConfirmacaoConfig,
} from './modelos'

const T = tokens

type Estatisticas = { enviados: number; confirmados: number; sem_resposta: number; faltas: number; taxa_comparecimento: number | null }
type TipoModelo = '48h' | '24h' | '2h'

const ESTAT_DEMO: Estatisticas = { enviados: 184, confirmados: 121, sem_resposta: 9, faltas: 6, taxa_comparecimento: 94 }
const PLACEHOLDERS = ['{nome}', '{data}', '{hora}', '{medico}', '{clinica}']

const ehDemo = () => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('demo') === '1'

export function ConfiguracaoConfirmacoes() {
  const demo = useMemo(ehDemo, [])
  const [medicos, setMedicos] = useState<{ id: string; nome: string; clinica_id?: string }[]>([])
  const [medicoId, setMedicoId] = useState('')
  const [clinicaNome, setClinicaNome] = useState('')
  const [config, setConfig] = useState<ConfirmacaoConfig>(CONFIG_PADRAO)
  const [salvo, setSalvo] = useState<ConfirmacaoConfig>(CONFIG_PADRAO)
  const [estat, setEstat] = useState<Estatisticas | null>(null)
  const [temWhatsapp, setTemWhatsapp] = useState(true)
  const [aviso, setAviso] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [enviandoTeste, setEnviandoTeste] = useState(false)
  const [tipo, setTipo] = useState<TipoModelo>('24h')

  // Quem está usando: médico, recepcionista (1º médico da clínica) ou admin (escolhe o médico)
  useEffect(() => {
    (async () => {
      if (demo) {
        setMedicos([{ id: 'demo', nome: 'Dra. Helena Prado' }]); setMedicoId('demo'); setClinicaNome('Clínica Bem Viver')
        return
      }
      const ca = localStorage.getItem('clinica_admin')
      const m = localStorage.getItem('medico')
      let clinicaId: string | undefined
      let lista: any[] = []
      if (ca) {
        clinicaId = JSON.parse(ca).clinica_id
      } else if (m) {
        const p = JSON.parse(m)
        if (p.cargo === 'recepcionista') clinicaId = p.clinica_id
        else { lista = [{ id: p.id, nome: p.nome, clinica_id: p.clinica_id }]; clinicaId = p.clinica_id }
      }
      if (!lista.length && clinicaId) {
        const { data } = await supabase.from('medicos').select('id, nome, clinica_id')
          .eq('clinica_id', clinicaId).eq('cargo', 'medico').eq('ativo', true).order('nome')
        lista = data || []
      }
      if (clinicaId) {
        const { data: cl } = await supabase.from('clinicas').select('nome').eq('id', clinicaId).maybeSingle()
        setClinicaNome(cl?.nome || '')
      }
      setMedicos(lista)
      setMedicoId(lista[0]?.id || '')
      if (!lista.length) setCarregando(false)
    })()
  }, [demo])

  useEffect(() => {
    if (!medicoId) return
    if (demo) {
      setConfig(CONFIG_PADRAO); setSalvo(CONFIG_PADRAO); setEstat(ESTAT_DEMO); setCarregando(false)
      return
    }
    setCarregando(true)
    fetch('/api/confirmacoes/config?medico_id=' + medicoId)
      .then(r => r.json())
      .then(d => {
        if (d.config) { setConfig(d.config); setSalvo(d.config) }
        setEstat(d.estatisticas || null)
        setTemWhatsapp(d.tem_whatsapp !== false)
        setAviso(d.aviso || '')
      })
      .catch(() => notificar('Não foi possível carregar as configurações', 'erro'))
      .finally(() => setCarregando(false))
  }, [medicoId, demo])

  const alterado = JSON.stringify(config) !== JSON.stringify(salvo)
  const chaveModelo = `modelo_${tipo}` as const
  const medicoNome = medicos.find(m => m.id === medicoId)?.nome || 'Dra. Helena Prado'

  const salvar = async () => {
    if (demo) { setSalvo(config); notificar('Modo demonstração: nada foi gravado', 'info'); return }
    setSalvando(true)
    try {
      const r = await fetch('/api/confirmacoes/config', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ medico_id: medicoId, ...config }),
      })
      const d = await r.json()
      if (!r.ok) { notificar(d.error || 'Erro ao salvar', 'erro'); return }
      setConfig(d.config); setSalvo(d.config)
      notificar('Configurações salvas')
    } catch { notificar('Erro de conexão', 'erro') }
    finally { setSalvando(false) }
  }

  const enviarTeste = async () => {
    if (demo) { notificar('Modo demonstração: o teste não foi enviado', 'info'); return }
    setEnviandoTeste(true)
    try {
      const r = await fetch('/api/confirmacoes/config', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ medico_id: medicoId, acao: 'teste', tipo, modelo: config[chaveModelo] }),
      })
      const d = await r.json()
      if (r.ok) notificar('Teste enviado para o seu WhatsApp')
      else if (d.error === 'sem_telefone') notificar('Cadastre seu celular em Meu perfil para receber o teste', 'info')
      else notificar(d.error || 'Não foi possível enviar o teste', 'erro')
    } catch { notificar('Erro de conexão', 'erro') }
    finally { setEnviandoTeste(false) }
  }

  // Pré-visualização: paciente "Maria", com a data relativa ao tipo (amanhã para a 24h)
  const previa = useMemo(() => {
    const d = new Date()
    if (tipo === '48h') d.setDate(d.getDate() + 2)
    if (tipo === '24h') d.setDate(d.getDate() + 1)
    d.setHours(tipo === '2h' ? d.getHours() + 2 : 14, tipo === '2h' ? 0 : 30, 0, 0)
    const { data, hora } = dataHoraSP(d)
    return preencher(config[chaveModelo], { nome: 'Maria', data, hora, medico: medicoNome, clinica: clinicaNome || medicoNome, online: '' })
  }, [config, chaveModelo, tipo, medicoNome, clinicaNome])

  const set = <K extends keyof ConfirmacaoConfig>(k: K, v: ConfirmacaoConfig[K]) => setConfig(c => ({ ...c, [k]: v }))
  const tipoLigado = tipo === '48h' ? config.lembrete_48h : tipo === '24h' ? config.confirmacao_24h : config.lembrete_2h

  if (carregando) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {[180, 320, 140].map((h, i) => <div key={i} className="c360-skel" style={{ height: h, borderRadius: 16 }} />)}
      </div>
    )
  }

  if (!medicoId) {
    return (
      <Card><p style={{ margin: 0, fontSize: 13, color: T.text.secondary }}>Nenhum médico ativo encontrado na clínica.</p></Card>
    )
  }

  const linhaSep = <div style={{ height: 1, background: T.border.muted }} />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {aviso && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 14px', borderRadius: 12, background: T.status.warningBg, color: T.status.warning, fontSize: 12.5, fontWeight: 600 }}>
          <Icon icon={TriangleAlert} size={15} />{aviso}
        </div>
      )}

      {medicos.length > 1 && (
        <Field label="Profissional">
          <Select value={medicoId} onChange={e => setMedicoId(e.target.value)} style={{ maxWidth: 320 }}>
            {medicos.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
          </Select>
        </Field>
      )}

      {/* Envios automáticos */}
      <Card titulo="Envios automáticos" acao={temWhatsapp
        ? <Badge tone="success" dot>WhatsApp conectado</Badge>
        : <Badge tone="warning" dot>WhatsApp não conectado</Badge>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Switch checked={config.lembrete_48h} onChange={v => set('lembrete_48h', v)}
            label="Lembrete 48h antes" descricao="Mensagem informativa dois dias antes da consulta." />
          {linhaSep}
          <Switch checked={config.confirmacao_24h} onChange={v => set('confirmacao_24h', v)}
            label="Confirmação 24h antes" descricao="Pede confirmação com os botões Sim confirmo, Preciso remarcar e Não poderei ir. A resposta atualiza a Agenda." />
          {linhaSep}
          <Switch checked={config.lembrete_2h} onChange={v => set('lembrete_2h', v)}
            label="Lembrete 2h antes" descricao="Aviso curto no dia, só para consultas que não foram canceladas." />
          {linhaSep}
          <Switch checked={config.oferecer_vaga_lista} onChange={v => set('oferecer_vaga_lista', v)}
            label="Oferecer vaga da lista de espera" descricao="Quando alguém cancela ou falta, a Agenda sugere pacientes compatíveis da lista para o horário liberado." />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: T.text.quaternary }}>
            <Icon icon={Clock} size={14} />
            Verificação a cada 15 minutos, com envios só entre 8h e 20h (horário de Brasília).
          </div>
        </div>
      </Card>

      {/* Modelos de mensagem */}
      <Card titulo="Mensagens" acao={
        <SegmentedControl size="sm" value={tipo} onChange={setTipo}
          options={[{ value: '48h', label: '48h' }, { value: '24h', label: '24h' }, { value: '2h', label: '2h' }]} />
      }>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
            <Textarea value={config[chaveModelo]} onChange={e => set(chaveModelo, e.target.value)}
              style={{ minHeight: 150 }} maxLength={1000} aria-label={`Modelo da mensagem de ${tipo}`} />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: T.text.quaternary, marginRight: 2 }}>Inserir</span>
              {PLACEHOLDERS.map(p => (
                <button key={p} type="button" className="mono" onClick={() => set(chaveModelo, config[chaveModelo] + p)} style={{
                  fontSize: 11.5, padding: '3px 8px', borderRadius: 8, cursor: 'pointer', fontFamily: undefined,
                  border: `1px solid ${T.border.default}`, background: '#fff', color: T.text.strong,
                }}>{p}</button>
              ))}
            </div>
            {tipo === '24h' && (
              <p style={{ margin: 0, fontSize: 12, color: T.text.quaternary, lineHeight: 1.45 }}>
                Os botões de resposta são fixos para a Agenda reconhecer a confirmação.
              </p>
            )}
            {!tipoLigado && <Badge tone="neutral" style={{ alignSelf: 'flex-start' }}>Envio desligado</Badge>}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 'auto' }}>
              <Button variant="ghost" size="sm" icon={RotateCcw} onClick={() => set(chaveModelo, MODELOS_PADRAO[chaveModelo])}
                disabled={config[chaveModelo] === MODELOS_PADRAO[chaveModelo]}>Restaurar padrão</Button>
              <Button variant="secondary" size="sm" icon={Send} onClick={enviarTeste} disabled={enviandoTeste}>
                {enviandoTeste ? 'Enviando…' : 'Enviar teste para mim'}
              </Button>
            </div>
          </div>

          {/* Pré-visualização estilo WhatsApp */}
          <div style={{ borderRadius: 14, background: T.bg.chatBg, border: `1px solid ${T.border.default}`, padding: 14, display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: T.text.tertiary }}>Pré-visualização</span>
            <div style={{ alignSelf: 'flex-start', maxWidth: '92%', background: '#fff', borderRadius: '4px 12px 12px 12px', boxShadow: '0 1px 1px rgba(0,0,0,.06)', overflow: 'hidden' }}>
              <p style={{ margin: 0, padding: '8px 10px', fontSize: 13, lineHeight: 1.45, color: T.text.chatPrimary, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {previa || <span style={{ color: T.text.tertiary }}>Mensagem vazia</span>}
              </p>
              {tipo === '24h' && BOTOES_CONFIRMACAO_24H.map(b => (
                <div key={b} style={{ borderTop: `1px solid ${T.border.muted}`, padding: '7px 10px', textAlign: 'center', fontSize: 13, fontWeight: 600, color: T.whatsapp.green }}>{b}</div>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        {alterado && <Button variant="secondary" onClick={() => setConfig(salvo)}>Descartar</Button>}
        <Button icon={CheckCircle2} onClick={salvar} disabled={!alterado || salvando}>{salvando ? 'Salvando…' : 'Salvar alterações'}</Button>
      </div>

      {/* Últimos 30 dias */}
      <Card titulo="Últimos 30 dias">
        {estat ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
              {([
                { label: 'Enviados', valor: estat.enviados, icon: MessageCircle, cor: T.data.purple },
                { label: 'Confirmados', valor: estat.confirmados, icon: CalendarCheck, cor: T.data.green },
                { label: 'Sem resposta', valor: estat.sem_resposta, icon: Hourglass, cor: T.data.orange },
                { label: 'Faltas', valor: estat.faltas, icon: UserX, cor: T.data.pink },
              ]).map(m => (
                <div key={m.label} style={{ border: `1px solid ${T.border.default}`, borderRadius: 12, padding: 12, display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <IconTile icon={m.icon} color={m.cor} size={32} radius={10} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: T.text.secondary, fontWeight: 600 }}>{m.label}</div>
                    <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-.02em', color: T.text.primary, fontVariantNumeric: 'tabular-nums' }}>{m.valor}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: T.text.strong, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Icon icon={BellRing} size={14} color={T.brand.primary} />Taxa de comparecimento
                </span>
                <span style={{ fontSize: 18, fontWeight: 700, color: T.text.primary, fontVariantNumeric: 'tabular-nums' }}>
                  {estat.taxa_comparecimento === null ? '—' : estat.taxa_comparecimento + '%'}
                </span>
              </div>
              <ProgressBar valor={estat.taxa_comparecimento ?? 0} cor={T.status.success} trilho={T.status.successBg} />
              <span style={{ fontSize: 12, color: T.text.quaternary }}>Consultas realizadas sobre realizadas + faltas no período.</span>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: T.text.quaternary }}>
            <Icon icon={CalendarClock} size={16} />Sem dados no período.
          </div>
        )}
      </Card>
    </div>
  )
}
