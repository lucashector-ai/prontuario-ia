'use client'
import { log } from '@/lib/logger'

import { useEffect, useState } from 'react'
import ModalEnviarFormulario from '@/components/formularios/ModalEnviarFormulario'
import { useRouter, useParams } from 'next/navigation'
import {
  ArrowLeft, Camera, CalendarPlus, Send, Mic, Phone, Mail, IdCard, MapPin, Shield, CreditCard, Cake,
  Pencil, X, FileText, Download, Stethoscope, CalendarDays, Clock, Trash2, Check, Video, ChevronDown,
  TriangleAlert, Repeat, Pill, HeartPulse, Receipt, Plus, ChevronRight, ClipboardList,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { HipotesesCard } from '@/components/HipotesesCard'
import { supabase } from '@/lib/supabase'
import { MemedPrescricao } from '@/components/MemedPrescricao'
import { BotaoMemed } from '@/components/BotaoMemed'
import { tokens, tint } from '@/lib/design-tokens'
import {
  Tabs, Button, IconButton, Card, Badge, Avatar, Icon, IconTile, Overline, EmptyState, Modal,
  Field, Input, Select, Textarea, type BadgeTone,
} from '@/components/ui'
import { usePageHeader } from '@/components/shell/header-context'
import { confirmar, notificar } from '@/components/ui/dialogos'

import { normalizarConvenio } from '@/lib/convenios'
const T = tokens

type Aba = 'overview' | 'consultas' | 'agendamentos' | 'prontuario' | 'timeline' | 'financeiro'

const TIPO_TOM: Record<string, BadgeTone> = { consulta: 'accent', retorno: 'info', exame: 'accent', urgencia: 'danger' }
const TIPO_LABEL: Record<string, string> = { consulta: 'Consulta', retorno: 'Retorno', exame: 'Exame', urgencia: 'Urgência' }
const STATUS_TOM: Record<string, BadgeTone> = { agendado: 'info', confirmado: 'accent', cancelado: 'danger', realizado: 'neutral' }
const STATUS_LABEL: Record<string, string> = { agendado: 'Agendado', confirmado: 'Confirmado', cancelado: 'Cancelado', realizado: 'Realizado' }

// Rótulos legíveis para os campos do formulário de edição
const CAMPOS_TEXTO: { k: string; l: string }[] = [
  { k: 'nome', l: 'Nome' }, { k: 'cpf', l: 'CPF' }, { k: 'telefone', l: 'Telefone' }, { k: 'email', l: 'E-mail' },
  { k: 'endereco', l: 'Endereço' }, { k: 'convenio', l: 'Convênio' }, { k: 'nr_carteirinha', l: 'Nº da carteirinha' },
]
const CAMPOS_CLINICOS: { k: string; l: string }[] = [
  { k: 'alergias', l: 'Alergias' }, { k: 'comorbidades', l: 'Comorbidades' }, { k: 'medicamentos_uso', l: 'Medicamentos em uso' },
]

const SECOES = [
  { key: 'subjetivo', letra: 'S', titulo: 'Subjetivo', cor: T.data.blue },
  { key: 'objetivo', letra: 'O', titulo: 'Objetivo', cor: T.data.green },
  { key: 'avaliacao', letra: 'A', titulo: 'Avaliação', cor: T.data.pink },
  { key: 'plano', letra: 'P', titulo: 'Plano', cor: T.data.purple },
]

export default function PacienteDetalhe() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const [medico, setMedico] = useState<any>(null)
  const [paciente, setPaciente] = useState<any>(null)
  const [prescricoes, setPrescricoes] = useState<any[]>([])
  const [carregandoPresc, setCarregandoPresc] = useState(false)
  const [memedAberto, setMemedAberto] = useState(false)
  const [medicoLogado, setMedicoLogado] = useState<any>(null)

  useEffect(() => {
    (async () => {
      const ca = localStorage.getItem('clinica_admin')
      if (ca) {
        // Logado como admin: pega primeiro médico ativo da clínica pra Memed
        const admin = JSON.parse(ca)
        if (admin.clinica_id) {
          const { data: primMed } = await supabase
            .from('medicos').select('*')
            .eq('clinica_id', admin.clinica_id).eq('cargo', 'medico').eq('ativo', true)
            .order('criado_em').limit(1).maybeSingle()
          if (primMed) { setMedicoLogado(primMed); return }
        }
      }
      const m = localStorage.getItem('medico')
      if (m) setMedicoLogado(JSON.parse(m))
    })()
  }, [])

  useEffect(() => {
    if (paciente?.id) carregarPrescricoes()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paciente?.id])

  useEffect(() => {
    if (paciente?.id) carregarComandas()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paciente?.id])

  const carregarPrescricoes = async () => {
    if (!paciente?.id) return
    setCarregandoPresc(true)
    try {
      const r = await fetch('/api/prescricoes?paciente_id=' + paciente.id)
      const d = await r.json()
      setPrescricoes(d.prescricoes || [])
    } catch (e) { log.error(e) }
    finally { setCarregandoPresc(false) }
  }

  const carregarComandas = async () => {
    if (!paciente?.id) return
    setCarregandoComandas(true)
    try {
      const r = await fetch('/api/comandas?paciente_id=' + paciente.id)
      const d = await r.json()
      setComandasPaciente(d.comandas || [])
    } catch (e) { log.error(e) }
    finally { setCarregandoComandas(false) }
  }

  async function criarNovaComanda() {
    if (!paciente?.id) return
    try {
      const r = await fetch('/api/comandas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paciente_id: paciente.id,
          medico_id: paciente.medico_id || null,
          clinica_id: paciente.clinica_id || null,
        }),
      })
      const d = await r.json()
      if (d.error) { notificar('Erro: ' + d.error, 'erro'); return }
      if (d.comanda?.id) {
        router.push('/comandas/' + d.comanda.id)
      }
    } catch (e: any) {
      notificar('Erro ao criar comanda' + (e?.message ? ': ' + e.message : ''), 'erro')
    }
  }

  const [consultas, setConsultas] = useState<any[]>([])
  const [transcricoesAbertas, setTranscricoesAbertas] = useState<Set<string>>(new Set())
  const [agendamentos, setAgendamentos] = useState<any[]>([])
  const [aba, setAba] = useState<Aba>('overview')
  const [comandasPaciente, setComandasPaciente] = useState<any[]>([])
  const [carregandoComandas, setCarregandoComandas] = useState(false)
  const [carregando, setCarregando] = useState(true)
  const [mapaMedicos, setMapaMedicos] = useState<Record<string, { nome: string; cor: string }>>({})
  const [editando, setEditando] = useState(false)
  const [editForm, setEditForm] = useState<any>({})
  const [salvando, setSalvando] = useState(false)
  const [modalAg, setModalAg] = useState(false)
  const [modalForm, setModalForm] = useState(false)
  const [agForm, setAgForm] = useState({data_hora:'',tipo:'consulta',motivo:'',observacoes:''})
  const [salvandoAg, setSalvandoAg] = useState(false)
  const [consultaAberta, setConsultaAberta] = useState<any>(null)
  const [uploadandoFoto, setUploadandoFoto] = useState(false)

  useEffect(() => {
    const ca_ = localStorage.getItem('clinica_admin')
    const m = ca_ || localStorage.getItem('medico')
    if (!m) { router.push('/login'); return }
    const med = JSON.parse(m); setMedico(med); carregar(med.id)
  }, [id])

  const carregar = async (medicoId: string) => {
    // Se for clinica admin, busca de todos os medicos da clinica
    const caStr = localStorage.getItem('clinica_admin')
    let medicoIds = [medicoId]
    if (caStr) {
      const admin = JSON.parse(caStr)
      if (admin.clinica_id) {
        const { data: meds } = await supabase.from('medicos').select('id, nome, cor').eq('clinica_id', admin.clinica_id).eq('cargo', 'medico').eq('ativo', true)
        if (meds && meds.length > 0) {
          medicoIds = meds.map((m: any) => m.id)
          const mapa: Record<string, { nome: string, cor: string }> = {}
          meds.forEach((m: any) => { mapa[m.id] = { nome: m.nome, cor: m.cor || tokens.brand.primary } })
          setMapaMedicos(mapa)
        }
      }
    }

    const [pR, cR, aR] = await Promise.all([
      fetch('/api/pacientes/' + id),
      // Só as consultas DESTE paciente (antes vinham todas as do médico/clínica)
      supabase.from('consultas').select('*').eq('paciente_id', id).in('medico_id', medicoIds).order('criado_em', {ascending:false}),
      fetch('/api/agendamentos?paciente_id=' + id),
    ])
    const pd = await pR.json(); const ad = await aR.json()
    if (pd.paciente) { setPaciente(pd.paciente); setEditForm(pd.paciente) }
    setConsultas(cR.data || []); setAgendamentos(ad.agendamentos || [])
    setCarregando(false)
  }

  const salvarPaciente = async () => {
    setSalvando(true)
    const r = await fetch('/api/pacientes/' + id, {method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(editForm)})
    const d = await r.json()
    if (d.paciente) { setPaciente(d.paciente); setEditando(false) }
    setSalvando(false)
  }

  const salvarAg = async (e: React.FormEvent) => {
    e.preventDefault(); setSalvandoAg(true)
    const r = await fetch('/api/agendamentos', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...agForm,paciente_id:id,medico_id:medico.id,status:'agendado'})})
    const d = await r.json()
    if (d.agendamento) {
      setAgendamentos(prev => [...prev, d.agendamento].sort((a,b) => new Date(a.data_hora).getTime()-new Date(b.data_hora).getTime()))
      setModalAg(false); setAgForm({data_hora:'',tipo:'consulta',motivo:'',observacoes:''})
    }
    setSalvandoAg(false)
  }

  const atualizarAg = async (agId: string, status: string) => {
    const r = await fetch('/api/agendamentos', {method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:agId,status})})
    const d = await r.json()
    if (d.agendamento) setAgendamentos(prev => prev.map(a => a.id===agId ? d.agendamento : a))
  }

  const deletarAg = async (agId: string) => {
    if (!(await confirmar({ titulo: 'Excluir este agendamento?', confirmar: 'Excluir', perigo: true }))) return
    await fetch('/api/agendamentos?id='+agId, {method:'DELETE'})
    setAgendamentos(prev => prev.filter(a => a.id!==agId))
  }

  const calcIdade = (nasc: string) => {
    if (!nasc) return null
    const h = new Date(); const d = new Date(nasc); let i = h.getFullYear()-d.getFullYear()
    if (h.getMonth()<d.getMonth()||(h.getMonth()===d.getMonth()&&h.getDate()<d.getDate())) i--
    return i
  }

  const fmt = (s: string) => new Date(s).toLocaleDateString('pt-BR',{day:'2-digit',month:'short',year:'numeric'})
  const fmtH = (s: string) => new Date(s).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})
  const uploadFoto = async (file: File) => {
    if (!file || !paciente) return
    setUploadandoFoto(true)
    const reader = new FileReader()
    reader.onload = async (e) => {
      const base64 = e.target?.result as string
      await fetch('/api/pacientes/' + id, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ foto_url: base64 }) })
      setPaciente((p: any) => ({ ...p, foto_url: base64 }))
      if (paciente.telefone) {
        await supabase.from('whatsapp_conversas').update({ foto_url: base64 }).or(`telefone.eq.${paciente.telefone.replace(/\D/g,'')},telefone.eq.+${paciente.telefone.replace(/\D/g,'')},telefone.eq.55${paciente.telefone.replace(/\D/g,'')}`)
      }
      setUploadandoFoto(false)
    }
    reader.readAsDataURL(file)
  }

  const fmtF = (s: string) => new Date(s).toLocaleDateString('pt-BR',{weekday:'short',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})

  const idadePac = calcIdade(paciente?.data_nascimento)
  const prox = (() => {
    // Inicio do dia atual
    const inicioHoje = new Date(); inicioHoje.setHours(0, 0, 0, 0)
    // Aceita agendado ou confirmado, e data >= hoje (inclui hoje mesmo se passou da hora)
    const futuros = agendamentos
      .filter(a => (a.status === 'agendado' || a.status === 'confirmado') && new Date(a.data_hora) >= inicioHoje)
      .sort((a, b) => new Date(a.data_hora).getTime() - new Date(b.data_hora).getTime())
    return futuros[0] || null
  })()

  const metaPaciente = [paciente?.sexo, idadePac ? idadePac + ' anos' : null, paciente?.convenio ? normalizarConvenio(paciente.convenio) : null].filter(Boolean).join(' · ')
  usePageHeader(paciente?.nome || 'Paciente', paciente ? (metaPaciente || 'Ficha do paciente') : 'Ficha do paciente')

  // Nova consulta já com o paciente selecionado (mesmo formato usado pela agenda)
  const irNovaConsulta = () => {
    const p = new URLSearchParams()
    p.set('paciente_id', id)
    if (paciente?.nome) p.set('paciente_nome', paciente.nome)
    if (paciente?.telefone) p.set('paciente_tel', paciente.telefone)
    router.push('/nova-consulta?' + p.toString())
  }

  const agendamentosAtivos = agendamentos.filter(a => a.status !== 'cancelado').length
  const temDadosClinicos = !!(paciente?.alergias || paciente?.comorbidades || paciente?.medicamentos_uso)

  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16, minHeight: '100%', boxSizing: 'border-box' }}>
      {carregando ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div className="c360-skel" style={{ width: 64, height: 64, borderRadius: '50%' }} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className="c360-skel" style={{ height: 18, width: 220, borderRadius: 8 }} />
              <div className="c360-skel" style={{ height: 12, width: 160, borderRadius: 6 }} />
            </div>
          </div>
          <div className="c360-skel" style={{ height: 40, borderRadius: 10 }} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
            <div className="c360-skel" style={{ height: 280, borderRadius: 16 }} />
            <div className="c360-skel" style={{ height: 280, borderRadius: 16 }} />
          </div>
        </div>
      ) : (<>
        {/* Cabeçalho da ficha */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={() => router.push('/pacientes')} style={{ color: T.text.secondary, marginLeft: -8 }}>
              Pacientes
            </Button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div
              style={{ position: 'relative', cursor: 'pointer', flexShrink: 0 }}
              onClick={() => (document.getElementById('foto-hdr') as HTMLInputElement)?.click()}
              title="Trocar foto"
            >
              <Avatar nome={paciente?.nome || '?'} size={64} src={paciente?.foto_url} />
              <span style={{
                position: 'absolute', bottom: -2, right: -2, width: 24, height: 24, borderRadius: '50%',
                background: T.brand.primary, color: '#fff', display: 'grid', placeItems: 'center', border: '2px solid #fff',
              }}>
                <Icon icon={Camera} size={12} />
              </span>
              {uploadandoFoto && (
                <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'rgba(255,255,255,0.7)', display: 'grid', placeItems: 'center' }}>
                  <span style={{ width: 18, height: 18, border: `2px solid ${T.brand.primary}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                </span>
              )}
            </div>
            <input id="foto-hdr" type="file" accept="image/*" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && uploadFoto(e.target.files[0])} />

            <div style={{ flex: '1 1 240px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-.01em', color: T.text.primary }}>{paciente?.nome}</span>
              {metaPaciente && <span style={{ fontSize: 13, color: T.text.quaternary }}>{metaPaciente}</span>}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                {prox
                  ? <Badge tone="accent" icon={CalendarDays}>Próxima: {fmt(prox.data_hora)} · {fmtH(prox.data_hora)}</Badge>
                  : <Badge tone="neutral">Sem consulta agendada</Badge>}
                {paciente?.alergias && <Badge tone="danger" icon={TriangleAlert}>Alergias</Badge>}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <BotaoMemed onClick={() => setMemedAberto(true)} variant="primary" />
              <Button variant="secondary" icon={CalendarPlus} onClick={() => setModalAg(true)}>Agendar</Button>
              <Button variant="secondary" icon={Send} onClick={() => setModalForm(true)}>Enviar formulário</Button>
              <Button variant="primary" icon={Mic} onClick={irNovaConsulta}>Nova consulta</Button>
            </div>
          </div>
        </div>

        <Tabs
          style={{ marginBottom: 0, overflowX: 'auto' }}
          ativa={aba}
          onChange={(id) => setAba(id as Aba)}
          tabs={[
            { id: 'overview', label: 'Visão geral' },
            { id: 'consultas', label: 'Consultas (' + consultas.length + ')' },
            { id: 'agendamentos', label: 'Agenda (' + agendamentosAtivos + ')' },
            { id: 'prontuario', label: 'Prontuário' },
            { id: 'timeline', label: 'Linha do tempo' },
          ]}
        />

        {/* ── Visão geral ── */}
        {aba === 'overview' && (
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div style={{ flex: '1 1 300px', maxWidth: 380, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Card
                titulo="Dados pessoais"
                acao={
                  <Button variant="ghost" size="sm" icon={editando ? X : Pencil} onClick={() => setEditando(!editando)}>
                    {editando ? 'Cancelar' : 'Editar'}
                  </Button>
                }
              >
                {editando ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {CAMPOS_TEXTO.map(({ k, l }) => (
                      <Field key={k} label={l}>
                        <Input value={editForm[k] || ''} onChange={e => setEditForm((p: any) => ({ ...p, [k]: e.target.value }))} />
                      </Field>
                    ))}
                    {CAMPOS_CLINICOS.map(({ k, l }) => (
                      <Field key={k} label={l}>
                        <Textarea value={editForm[k] || ''} onChange={e => setEditForm((p: any) => ({ ...p, [k]: e.target.value }))} style={{ minHeight: 64 }} />
                      </Field>
                    ))}
                    <Button onClick={salvarPaciente} disabled={salvando} block>{salvando ? 'Salvando...' : 'Salvar alterações'}</Button>
                  </div>
                ) : (() => {
                  const info: { icon: LucideIcon; l: string; v: any; mono?: boolean }[] = [
                    { icon: IdCard, l: 'CPF', v: paciente?.cpf, mono: true },
                    { icon: Phone, l: 'Telefone', v: paciente?.telefone, mono: true },
                    { icon: Mail, l: 'E-mail', v: paciente?.email },
                    { icon: Cake, l: 'Idade', v: idadePac !== null ? idadePac + ' anos' : null },
                    { icon: MapPin, l: 'Endereço', v: paciente?.endereco },
                    { icon: Shield, l: 'Convênio', v: paciente?.convenio ? normalizarConvenio(paciente.convenio) : null },
                    { icon: CreditCard, l: 'Carteirinha', v: paciente?.nr_carteirinha, mono: true },
                  ].filter(f => f.v)
                  if (info.length === 0) return <p style={{ fontSize: 12.5, color: T.text.quaternary, margin: 0 }}>Nenhum dado preenchido. Clique em Editar para completar.</p>
                  return (
                    <div>
                      {info.map((f, i) => (
                        <div key={f.l} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: i < info.length - 1 ? `1px solid ${T.border.muted}` : 'none' }}>
                          <Icon icon={f.icon} size={15} color={T.text.tertiary} />
                          <span style={{ flex: 1, fontSize: 12.5, color: T.text.quaternary }}>{f.l}</span>
                          <span className={f.mono ? 'mono' : undefined} style={{ fontSize: f.mono ? 12.5 : 13, fontWeight: 600, color: T.text.primary, textAlign: 'right', overflowWrap: 'anywhere', minWidth: 0 }}>{f.v}</span>
                        </div>
                      ))}
                    </div>
                  )
                })()}
              </Card>

              {temDadosClinicos && !editando && (
                <Card titulo="Resumo clínico">
                  <ResumoClinico paciente={paciente} />
                </Card>
              )}
            </div>

            <div style={{ flex: '999 1 420px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
                <StatCard icon={Stethoscope} cor={T.data.blue} label="Consultas" valor={String(consultas.length)} />
                <StatCard icon={CalendarDays} cor={T.data.purple} label="Agendamentos" valor={String(agendamentosAtivos)} />
                <StatCard icon={Clock} cor={T.data.green} label="Próximo" valor={prox ? fmt(prox.data_hora) : 'Não agendado'} pequeno />
              </div>

              <Card padding={0}>
                <div style={{ display: 'flex', alignItems: 'center', padding: '16px 18px 10px' }}>
                  <h3 style={{ margin: 0, flex: 1, fontSize: 15, fontWeight: 700, color: T.text.primary }}>Últimas consultas</h3>
                  <Button variant="ghost" size="sm" iconRight={ChevronRight} onClick={() => setAba('consultas')}>Ver todas</Button>
                </div>
                {consultas.length === 0 ? (
                  <EmptyState icon={Stethoscope} titulo="Nenhuma consulta registrada ainda" descricao="Inicie uma nova consulta para gerar o primeiro prontuário." />
                ) : consultas.slice(0, 4).map(c => (
                  <LinhaClicavel key={c.id} onClick={() => { setConsultaAberta(c); setAba('consultas') }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: T.text.secondary }}>{fmt(c.criado_em)}</span>
                      <span className="mono" style={{ fontSize: 11.5, color: T.text.tertiary }}>{fmtH(c.criado_em)}</span>
                      {(c.cids || []).slice(0, 2).map((cid: any) => <CidTag key={cid.codigo} codigo={cid.codigo} />)}
                    </div>
                    <p style={{ fontSize: 13, color: T.text.strong, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {(c.subjetivo || '').substring(0, 80) || <span style={{ color: T.text.tertiary }}>Sem relato registrado</span>}
                    </p>
                  </LinhaClicavel>
                ))}
              </Card>

              {/* Prescrições Memed */}
              {prescricoes.length > 0 && (
                <Card padding={0}>
                  <div style={{ display: 'flex', alignItems: 'center', padding: '16px 18px 10px' }}>
                    <h3 style={{ margin: 0, flex: 1, fontSize: 15, fontWeight: 700, color: T.text.primary }}>Prescrições Memed</h3>
                    <span style={{ fontSize: 12, color: T.text.quaternary }}>{prescricoes.length} {prescricoes.length === 1 ? 'prescrição' : 'prescrições'}</span>
                  </div>
                  {prescricoes.slice(0, 5).map((p: any) => {
                    const data = new Date(p.criado_em)
                    const dataFmt = data.toLocaleDateString('pt-BR') + ' às ' + data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                    const meds = p.dados_memed?.prescricao?.medicamentos || []
                    const idCurto = p.prescricao_id_memed ? String(p.prescricao_id_memed).substring(0, 8) : p.id.substring(0, 8)
                    const medicoNome = p.dados_memed?.prescricao?.medico?.nome_medico || p.medicos?.nome || ''
                    const crm = p.dados_memed?.prescricao?.medico?.board?.board_number
                    const uf = p.dados_memed?.prescricao?.medico?.board?.board_state
                    const crmFmt = crm && uf ? `CRM/${uf} ${crm}` : ''
                    return (
                      <div key={p.id} style={{ padding: '14px 18px', borderTop: `1px solid ${T.border.muted}` }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: meds.length > 0 ? 10 : 0 }}>
                          <IconTile icon={FileText} size={32} radius={10} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: 13, fontWeight: 600, color: T.text.primary, margin: '0 0 2px' }}>Prescrição <span className="mono" style={{ fontSize: 12 }}>#{idCurto}</span></p>
                            <p style={{ fontSize: 12, color: T.text.quaternary, margin: 0 }}>{dataFmt}{medicoNome ? ' · ' + medicoNome : ''}{crmFmt ? ' · ' + crmFmt : ''}</p>
                          </div>
                          <Badge tone="accent">{meds.length} {meds.length === 1 ? 'item' : 'itens'}</Badge>
                        </div>
                        {meds.length > 0 && (
                          <div style={{ paddingLeft: 44, display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {meds.slice(0, 4).map((m: any, idx: number) => (
                              <div key={idx} style={{ padding: '8px 12px', background: T.bg.page, borderRadius: 10, fontSize: 12.5 }}>
                                <p style={{ margin: 0, fontWeight: 600, color: T.text.strong }}>{m.nome || m.descricao || 'Medicamento'}</p>
                                {m.sanitized_posology && (
                                  <p style={{ margin: '2px 0 0', fontSize: 12, color: T.text.quaternary, lineHeight: 1.4 }}>{m.sanitized_posology}</p>
                                )}
                              </div>
                            ))}
                            {meds.length > 4 && (
                              <p style={{ fontSize: 12, color: T.text.tertiary, margin: '2px 0 0', paddingLeft: 4 }}>+ {meds.length - 4} {meds.length - 4 === 1 ? 'medicamento' : 'medicamentos'}</p>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </Card>
              )}
            </div>
          </div>
        )}

        {/* ── Consultas ── */}
        {aba === 'consultas' && (
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div style={{ flex: '1 1 300px', maxWidth: 360, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {consultas.length === 0 ? (
                <Card><EmptyState icon={Stethoscope} titulo="Nenhuma consulta ainda" descricao="Inicie uma nova consulta pra registrar." /></Card>
              ) : consultas.map(c => {
                const ativa = consultaAberta?.id === c.id
                const ehTele = !!(c.meet_link || c.sala_id)
                const medInfo = mapaMedicos[c.medico_id]
                const nomeMed = medInfo?.nome || ''
                const corMed = medInfo?.cor || T.brand.primary
                const primNome = nomeMed.split(' ')[0] || ''
                return (
                  <ItemConsulta key={c.id} ativa={ativa} onClick={() => setConsultaAberta(ativa ? null : c)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: ativa ? T.brand.primary : T.text.primary }}>
                        {fmt(c.criado_em)} <span className="mono" style={{ fontSize: 11.5, fontWeight: 500, color: T.text.tertiary }}>{fmtH(c.criado_em)}</span>
                      </span>
                      <Badge tone={ehTele ? 'info' : 'accent'} icon={ehTele ? Video : undefined} style={{ fontSize: 11 }}>{ehTele ? 'Tele' : 'Consulta'}</Badge>
                    </div>
                    {primNome && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: T.text.quaternary }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: corMed, flexShrink: 0 }} />
                        Dr(a). {primNome}
                      </span>
                    )}
                    <p style={{ fontSize: 12.5, color: T.text.muted, margin: 0, lineHeight: 1.5 }}>
                      {(c.subjetivo || '').substring(0, 90)}{(c.subjetivo || '').length > 90 ? '...' : ''}
                    </p>
                    {(c.cids || []).length > 0 && (
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {(c.cids || []).map((cid: any) => <CidTag key={cid.codigo} codigo={cid.codigo} />)}
                      </div>
                    )}
                  </ItemConsulta>
                )
              })}
            </div>
            <div style={{ flex: '999 1 420px', minWidth: 0 }}>
              {consultaAberta ? (
                <Card padding={0}>
                  <div style={{ padding: '18px 20px', borderBottom: `1px solid ${T.border.muted}`, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 16, fontWeight: 700, color: T.text.primary, textTransform: 'capitalize' }}>{fmtF(consultaAberta.criado_em)}</span>
                        {(consultaAberta.meet_link || consultaAberta.sala_id)
                          ? <Badge tone="info" icon={Video}>Teleconsulta</Badge>
                          : <Badge tone="accent">Consulta</Badge>}
                      </div>
                      {mapaMedicos[consultaAberta.medico_id] && (
                        <span style={{ fontSize: 12.5, color: T.text.quaternary, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ width: 9, height: 9, borderRadius: '50%', background: mapaMedicos[consultaAberta.medico_id].cor, flexShrink: 0 }} />
                          Dr(a). {mapaMedicos[consultaAberta.medico_id].nome}
                        </span>
                      )}
                    </div>
                    <Button
                      variant="primary"
                      icon={Download}
                      title="Baixar PDF"
                      onClick={() => window.open('/api/pdf-prontuario?consulta_id=' + consultaAberta.id + '&medico_id=' + (consultaAberta.medico_id || ''), '_blank')}
                    >
                      PDF
                    </Button>
                  </div>
                  <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 18 }}>
                    {SECOES.map(s => (
                      <div key={s.key} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <LetraSecao letra={s.letra} cor={s.cor} />
                          <Overline>{s.titulo}</Overline>
                        </div>
                        <p style={{ fontSize: 13.5, color: T.text.strong, margin: 0, lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
                          {consultaAberta[s.key] || <span style={{ color: T.text.tertiary }}>—</span>}
                        </p>
                      </div>
                    ))}

                    <HipotesesCard hipoteses={consultaAberta.hipoteses} />

                    {consultaAberta.cids && consultaAberta.cids.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <Overline>CID-10 sugeridos</Overline>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {consultaAberta.cids.map((cid: any, i: number) => (
                            <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 10, border: `1px solid ${T.border.default}`, fontSize: 13, color: T.text.strong }}>
                              <span className="mono" style={{ fontSize: 11.5, fontWeight: 600, color: T.brand.primary }}>{cid.codigo}</span>
                              {cid.descricao}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              ) : (
                <div style={{ border: `1px dashed ${T.border.strong}`, borderRadius: T.radius['2xl'], minHeight: 360, display: 'grid', placeItems: 'center' }}>
                  <EmptyState icon={ClipboardList} titulo="Selecione uma consulta" descricao="Clique em qualquer consulta na lista pra ver os detalhes." />
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Agenda ── */}
        {aba === 'agendamentos' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ flex: 1, fontSize: 12.5, color: T.text.quaternary }}>
                {agendamentos.length} agendamento{agendamentos.length !== 1 ? 's' : ''}
              </span>
              <Button icon={Plus} onClick={() => setModalAg(true)}>Novo agendamento</Button>
            </div>
            {agendamentos.length === 0 ? (
              <Card>
                <EmptyState
                  icon={CalendarDays}
                  titulo="Nenhum agendamento"
                  descricao="Agende a próxima consulta deste paciente."
                  acao={<Button icon={CalendarPlus} onClick={() => setModalAg(true)}>Agendar agora</Button>}
                />
              </Card>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {agendamentos.map(ag => {
                  const tc = (T.appointment as any)[ag.tipo] || T.appointment.consulta
                  const passado = new Date(ag.data_hora) < new Date()
                  return (
                    <Card key={ag.id} padding="14px 16px" style={{ display: 'flex', gap: 14, alignItems: 'flex-start', opacity: ag.status === 'cancelado' ? 0.55 : 1 }}>
                      <div style={{ background: tc.bg, borderRadius: 12, padding: '8px 10px', textAlign: 'center', flexShrink: 0, minWidth: 58, color: tc.text }}>
                        <p style={{ fontSize: 19, fontWeight: 700, margin: 0, lineHeight: 1 }}>{new Date(ag.data_hora).getDate()}</p>
                        <p style={{ fontSize: 10.5, fontWeight: 700, margin: '3px 0 0', textTransform: 'uppercase', letterSpacing: '.05em' }}>{new Date(ag.data_hora).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}</p>
                        <p className="mono" style={{ fontSize: 11, margin: '2px 0 0' }}>{fmtH(ag.data_hora)}</p>
                      </div>
                      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: T.text.primary }}>{ag.motivo || 'Consulta'}</span>
                          <Badge tone={TIPO_TOM[ag.tipo] || 'accent'}>{TIPO_LABEL[ag.tipo] || ag.tipo}</Badge>
                          <Badge tone={STATUS_TOM[ag.status] || 'info'} dot>{STATUS_LABEL[ag.status] || ag.status}</Badge>
                        </div>
                        {ag.observacoes && <p style={{ fontSize: 12.5, color: T.text.secondary, margin: 0 }}>{ag.observacoes}</p>}
                        {((!passado && ag.status === 'agendado') || (passado && ag.status !== 'realizado' && ag.status !== 'cancelado')) && (
                          <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
                            {!passado && ag.status === 'agendado' && <>
                              <Button size="sm" variant="secondary" icon={Check} onClick={() => atualizarAg(ag.id, 'confirmado')}>Confirmar</Button>
                              <Button size="sm" variant="danger" icon={X} onClick={() => atualizarAg(ag.id, 'cancelado')}>Cancelar</Button>
                            </>}
                            {passado && ag.status !== 'realizado' && ag.status !== 'cancelado' && (
                              <Button size="sm" variant="secondary" icon={Check} onClick={() => atualizarAg(ag.id, 'realizado')}>Marcar realizado</Button>
                            )}
                          </div>
                        )}
                      </div>
                      <IconButton icon={Trash2} tone="danger" size={32} title="Deletar agendamento" onClick={() => deletarAg(ag.id)} />
                    </Card>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Prontuário ── */}
        {aba === 'prontuario' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Card titulo="Resumo clínico">
              {temDadosClinicos
                ? <ResumoClinico paciente={paciente} />
                : <p style={{ fontSize: 13, color: T.text.quaternary, margin: 0 }}>Nenhum dado clínico preenchido.</p>}
            </Card>
            {consultas.map((c, idx) => (
              <Card key={c.id} padding={0}>
                <div style={{ padding: '14px 18px', borderBottom: `1px solid ${T.border.muted}`, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13.5, fontWeight: 700, color: T.text.primary, textTransform: 'capitalize' }}>
                    <span className="mono" style={{ fontSize: 12, color: T.text.tertiary, marginRight: 6 }}>#{consultas.length - idx}</span>
                    {fmtF(c.criado_em)}
                  </span>
                  {(c.meet_link || c.sala_id) && <Badge tone="info" icon={Video}>Teleconsulta</Badge>}
                  <span style={{ flex: 1 }} />
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>{(c.cids || []).map((cid: any) => <CidTag key={cid.codigo} codigo={cid.codigo} />)}</div>
                </div>
                <div style={{ padding: '14px 18px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
                  {SECOES.map(s => (
                    <div key={s.key} style={{ background: T.bg.cardSubtle, border: `1px solid ${T.border.muted}`, borderRadius: 12, padding: '10px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <LetraSecao letra={s.letra} cor={s.cor} size={20} />
                        <span style={{ fontSize: 12, fontWeight: 700, color: T.text.strong }}>{s.titulo}</span>
                      </div>
                      <p style={{ fontSize: 12.5, color: T.text.muted, margin: 0, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{c[s.key] || '—'}</p>
                    </div>
                  ))}
                </div>
                {/* Hipóteses diagnósticas */}
                {c.hipoteses && Array.isArray(c.hipoteses) && c.hipoteses.length > 0 && (
                  <div style={{ padding: '14px 18px', borderTop: `1px solid ${T.border.muted}` }}>
                    <HipotesesCard hipoteses={c.hipoteses} />
                  </div>
                )}
                {/* Transcrição colapsável */}
                {c.transcricao && (
                  <div style={{ padding: '10px 18px', borderTop: `1px solid ${T.border.muted}` }}>
                    <button onClick={() => {
                      const s = new Set(transcricoesAbertas)
                      s.has(c.id) ? s.delete(c.id) : s.add(c.id)
                      setTranscricoesAbertas(s)
                    }} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit', color: T.text.strong }}>
                      <Icon icon={FileText} size={14} color={T.text.tertiary} />
                      <span style={{ fontSize: 12.5, fontWeight: 600 }}>Transcrição</span>
                      <Icon icon={ChevronDown} size={14} color={T.text.tertiary} style={{ transform: transcricoesAbertas.has(c.id) ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                    </button>
                    {transcricoesAbertas.has(c.id) && (
                      <div style={{ marginTop: 8, background: T.bg.page, borderRadius: 10, padding: '10px 12px', fontSize: 12, color: T.text.muted, lineHeight: 1.7, maxHeight: 180, overflow: 'auto', whiteSpace: 'pre-wrap' }}>
                        {c.transcricao}
                      </div>
                    )}
                  </div>
                )}
                {/* Ações */}
                <div style={{ padding: '10px 18px 14px', borderTop: `1px solid ${T.border.muted}`, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <a
                    href={'/api/pdf-prontuario?consulta_id=' + c.id + '&medico_id=' + (c.medico_id || medico?.id)}
                    target="_blank" rel="noreferrer"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 32, padding: '0 11px', borderRadius: 9, border: `1px solid ${T.border.default}`, background: T.bg.card, color: T.text.strong, fontSize: 12.5, fontWeight: 600, textDecoration: 'none' }}
                  >
                    <Icon icon={Download} size={14} />
                    PDF prontuário
                  </a>
                  <BotaoMemed onClick={() => setMemedAberto(true)} variant="compact" />
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* ── Linha do tempo ── */}
        {aba === 'timeline' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <span style={{ fontSize: 12.5, color: T.text.quaternary }}>
              {consultas.length} consulta{consultas.length !== 1 ? 's' : ''} registrada{consultas.length !== 1 ? 's' : ''}
            </span>
            {consultas.length === 0 ? (
              <Card><EmptyState icon={Stethoscope} titulo="Nenhuma consulta registrada ainda" /></Card>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {consultas.map((c: any, i: number) => {
                  const cids = c.cids || []
                  const alertas = c.alertas || []
                  const data = new Date(c.criado_em)
                  const dataFmt = data.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
                  const hora = data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                  const isUltima = i === 0
                  const isFim = i === consultas.length - 1
                  return (
                    <div key={c.id} style={{ display: 'flex', gap: 14 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                        <span style={{
                          width: 32, height: 32, borderRadius: '50%', display: 'grid', placeItems: 'center',
                          fontSize: 11.5, fontWeight: 700,
                          background: isUltima ? T.brand.primary : T.bg.card,
                          color: isUltima ? '#fff' : T.brand.primary,
                          border: isUltima ? 'none' : `1.5px solid ${T.brand.primaryAccent}`,
                        }}>{consultas.length - i}</span>
                        {!isFim && <span style={{ flex: 1, width: 1, background: T.border.default, marginTop: 4 }} />}
                      </div>
                      <Card padding="14px 16px" style={{ flex: 1, minWidth: 0, marginBottom: 14 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 13.5, fontWeight: 700, color: T.text.primary }}>{dataFmt}</span>
                            <span className="mono" style={{ fontSize: 11.5, color: T.text.tertiary }}>{hora}</span>
                            {isUltima && <Badge tone="accent">Mais recente</Badge>}
                          </div>
                          <a
                            href={'/api/pdf-prontuario?consulta_id=' + c.id + '&medico_id=' + (c.medico_id || medico?.id)}
                            target="_blank" rel="noreferrer"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: T.brand.primary, fontWeight: 600, textDecoration: 'none' }}
                          >
                            <Icon icon={Download} size={13} />PDF
                          </a>
                        </div>
                        {alertas.length > 0 && (
                          <div style={{ background: T.status.dangerBg, borderRadius: 10, padding: '8px 10px', marginBottom: 10, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                            <Icon icon={TriangleAlert} size={13} color={T.status.danger} style={{ marginTop: 1 }} />
                            <p style={{ fontSize: 12, color: T.status.danger, margin: 0, lineHeight: 1.45 }}>{alertas.join(' · ')}</p>
                          </div>
                        )}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
                          {c.subjetivo && (
                            <div>
                              <Overline style={{ marginBottom: 4 }}>Subjetivo</Overline>
                              <p style={{ fontSize: 12.5, color: T.text.strong, margin: 0, lineHeight: 1.5 }}>{(c.subjetivo || '').substring(0, 120)}{c.subjetivo?.length > 120 ? '...' : ''}</p>
                            </div>
                          )}
                          {c.avaliacao && (
                            <div>
                              <Overline style={{ marginBottom: 4 }}>Avaliação</Overline>
                              <p style={{ fontSize: 12.5, color: T.text.strong, margin: 0, lineHeight: 1.5 }}>{(c.avaliacao || '').substring(0, 120)}{c.avaliacao?.length > 120 ? '...' : ''}</p>
                            </div>
                          )}
                        </div>
                        {cids.length > 0 && (
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                            {cids.map((cid: any, j: number) => <CidTag key={j} codigo={cid.codigo} />)}
                          </div>
                        )}
                        {i > 0 && consultas[i - 1] && (
                          <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${T.border.muted}`, display: 'flex', flexDirection: 'column', gap: 3 }}>
                            <p style={{ fontSize: 11.5, color: T.text.tertiary, margin: 0 }}>vs consulta anterior ({new Date(consultas[i - 1].criado_em).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })})</p>
                            {c.subjetivo && consultas[i - 1].subjetivo && c.subjetivo.substring(0, 50) === consultas[i - 1].subjetivo.substring(0, 50) && (
                              <p style={{ fontSize: 12, color: T.status.warning, margin: 0, display: 'flex', alignItems: 'center', gap: 5 }}>
                                <Icon icon={Repeat} size={12} />Queixa similar à consulta anterior
                              </p>
                            )}
                            {cids.length > 0 && consultas[i - 1].cids?.some((prev: any) => cids.find((cur: any) => cur.codigo === prev.codigo)) && (
                              <p style={{ fontSize: 12, color: T.status.danger, margin: 0, display: 'flex', alignItems: 'center', gap: 5 }}>
                                <Icon icon={TriangleAlert} size={12} />CID recorrente detectado
                              </p>
                            )}
                          </div>
                        )}
                      </Card>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Financeiro (aba sem botão no momento — módulo financeiro desligado) ── */}
        {aba === 'financeiro' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Card
              titulo="Financeiro do paciente"
              acao={<Button icon={Plus} onClick={criarNovaComanda}>Nova comanda</Button>}
            >
              <p style={{ fontSize: 12.5, color: T.text.quaternary, margin: '-6px 0 14px' }}>Histórico de comandas e pagamentos</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
                {(() => {
                  const fechadas = comandasPaciente.filter((c: any) => c.status === 'fechada')
                  const abertas = comandasPaciente.filter((c: any) => c.status === 'aberta')
                  const totalPago = fechadas.reduce((acc: number, c: any) => acc + Number(c.total_liquido || c.total || 0), 0)
                  const totalAberto = abertas.reduce((acc: number, c: any) => acc + Number(c.total_liquido || c.total || 0), 0)
                  const ticketMedio = fechadas.length > 0 ? totalPago / fechadas.length : 0
                  return (
                    <>
                      <MiniStat label="Total pago" valor={'R$ ' + totalPago.toFixed(2).replace('.', ',')} cor={T.status.success} bg={T.status.successBg} />
                      <MiniStat label="Em aberto" valor={'R$ ' + totalAberto.toFixed(2).replace('.', ',')} cor={T.status.warning} bg={T.status.warningBg} />
                      <MiniStat label="Comandas" valor={String(comandasPaciente.length)} />
                      <MiniStat label="Ticket médio" valor={'R$ ' + ticketMedio.toFixed(2).replace('.', ',')} />
                    </>
                  )
                })()}
              </div>
            </Card>

            <Card titulo="Histórico de comandas">
              {carregandoComandas ? (
                <p style={{ fontSize: 13, color: T.text.tertiary, textAlign: 'center', padding: 30, margin: 0 }}>Carregando...</p>
              ) : comandasPaciente.length === 0 ? (
                <EmptyState icon={Receipt} titulo="Nenhuma comanda ainda" descricao='Clique em "Nova comanda" pra criar.' />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {comandasPaciente.map((c: any) => {
                    const data = new Date(c.created_at)
                    const dataFmt = data.toLocaleDateString('pt-BR') + ' às ' + data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                    const total = Number(c.valor_final || c.valor_total || 0)
                    const fechada = c.status === 'fechada' || c.status === 'paga'
                    const cancelada = c.status === 'cancelada'
                    const cor = fechada ? T.status.success : cancelada ? T.status.danger : T.status.warning
                    return (
                      <LinhaClicavel key={c.id} onClick={() => router.push('/comandas/' + c.id)} style={{ display: 'flex', alignItems: 'center', gap: 12, borderRadius: 12, border: `1px solid ${T.border.muted}` }}>
                        <IconTile icon={Receipt} color={cor} size={36} radius={10} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 13, fontWeight: 600, color: T.text.primary, margin: '0 0 2px' }}>Comanda <span className="mono" style={{ fontSize: 12 }}>#{c.id.substring(0, 8)}</span></p>
                          <p style={{ fontSize: 12, color: T.text.quaternary, margin: 0 }}>{dataFmt}{c.medicos?.nome ? ' · ' + c.medicos.nome : ''}{c.forma_pagamento ? ' · ' + c.forma_pagamento : ''}</p>
                        </div>
                        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: T.text.primary }}>R$ {total.toFixed(2).replace('.', ',')}</span>
                          <Badge tone={fechada ? 'success' : cancelada ? 'danger' : 'warning'}>{fechada ? 'Pago' : cancelada ? 'Cancelado' : 'Em aberto'}</Badge>
                        </div>
                      </LinhaClicavel>
                    )
                  })}
                </div>
              )}
            </Card>
          </div>
        )}
      </>)}

      {/* Modal agendar */}
      {modalAg && (
        <Modal titulo="Agendar consulta" largura={460} onClose={() => setModalAg(false)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: T.brand.primarySoftBg, border: `1px solid ${T.brand.primaryAccentLight}`, borderRadius: 12, padding: '10px 12px', marginBottom: 16 }}>
            <Avatar nome={paciente?.nome || '?'} size={36} src={paciente?.foto_url} />
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 13.5, fontWeight: 700, color: T.text.primary, margin: 0 }}>{paciente?.nome}</p>
              <p style={{ fontSize: 12, color: T.text.quaternary, margin: 0 }}>{[paciente?.sexo, idadePac ? idadePac + ' anos' : null].filter(Boolean).join(' · ')}</p>
            </div>
          </div>
          <form onSubmit={salvarAg} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Field label="Data e hora">
              <Input type="datetime-local" required value={agForm.data_hora} onChange={e => setAgForm(f => ({ ...f, data_hora: e.target.value }))} />
            </Field>
            <Field label="Tipo">
              <Select value={agForm.tipo} onChange={e => setAgForm(f => ({ ...f, tipo: e.target.value }))} style={{ cursor: 'pointer' }}>
                <option value="consulta">Consulta</option>
                <option value="retorno">Retorno</option>
                <option value="exame">Exame</option>
                <option value="urgencia">Urgência</option>
              </Select>
            </Field>
            <Field label="Motivo">
              <Input value={agForm.motivo} onChange={e => setAgForm(f => ({ ...f, motivo: e.target.value }))} placeholder="Cefaleia, retorno..." />
            </Field>
            <Field label="Observações">
              <Textarea value={agForm.observacoes} onChange={e => setAgForm(f => ({ ...f, observacoes: e.target.value }))} style={{ minHeight: 64 }} />
            </Field>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
              <Button type="button" variant="secondary" onClick={() => setModalAg(false)}>Cancelar</Button>
              <Button type="submit" disabled={salvandoAg}>{salvandoAg ? 'Salvando...' : 'Confirmar agendamento'}</Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal enviar formulário */}
      {modalForm && paciente && medicoLogado && (
        <ModalEnviarFormulario
          clinicaId={medicoLogado.clinica_id}
          medicoId={medicoLogado.id}
          paciente={{
            id: paciente.id,
            nome: paciente.nome,
            telefone: paciente.telefone,
            email: paciente.email,
          }}
          onFechar={() => setModalForm(false)}
        />
      )}
      {/* Overlay Memed */}
      {memedAberto && medicoLogado && paciente && (
        <MemedPrescricao
          medicoId={medicoLogado.id}
          paciente={{
            id: paciente.id,
            nome: paciente.nome,
            cpf: paciente.cpf,
            data_nascimento: paciente.data_nascimento,
            sexo: paciente.sexo,
            telefone: paciente.telefone,
            email: paciente.email,
            endereco: paciente.endereco,
          }}
          onClose={() => setMemedAberto(false)}
          onPrescricaoGerada={(dados) => {
            // Salva prescricao no banco
            fetch('/api/prescricoes', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                paciente_id: paciente.id,
                medico_id: paciente.medico_id,
                clinica_id: paciente.clinica_id || null,
                dados_memed: dados,
              }),
            }).then(() => carregarPrescricoes()).catch(err => log.error('Erro ao salvar prescricao:', err))
            setMemedAberto(false)
          }}
        />
      )}
      <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
    </div>
  )
}

// ── Componentes locais ──────────────────────────────────────────────────────

function CidTag({ codigo }: { codigo: string }) {
  return (
    <span className="mono" style={{ fontSize: 11, fontWeight: 500, padding: '2px 6px', borderRadius: 6, background: T.brand.primarySubtle, color: T.brand.primary, flexShrink: 0 }}>
      {codigo}
    </span>
  )
}

function LetraSecao({ letra, cor, size = 24 }: { letra: string; cor: string; size?: number }) {
  return (
    <span style={{
      width: size, height: size, borderRadius: Math.round(size * 0.3), flexShrink: 0, display: 'grid', placeItems: 'center',
      background: tint(cor, 0.12), color: cor, fontSize: Math.round(size * 0.5), fontWeight: 700,
    }}>{letra}</span>
  )
}

function StatCard({ icon, cor, label, valor, pequeno }: { icon: LucideIcon; cor: string; label: string; valor: string; pequeno?: boolean }) {
  return (
    <Card hover padding="16px 18px" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <IconTile icon={icon} color={cor} />
      <div style={{ minWidth: 0 }}>
        <p style={{ fontSize: pequeno ? 16 : 22, fontWeight: 700, letterSpacing: '-.02em', color: T.text.primary, margin: 0, lineHeight: 1.2, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{valor}</p>
        <p style={{ fontSize: 12.5, color: T.text.quaternary, margin: '2px 0 0' }}>{label}</p>
      </div>
    </Card>
  )
}

function MiniStat({ label, valor, cor, bg }: { label: string; valor: string; cor?: string; bg?: string }) {
  return (
    <div style={{ padding: 14, background: bg || T.bg.page, borderRadius: 12 }}>
      <Overline style={{ color: cor || T.text.quaternary, marginBottom: 4 }}>{label}</Overline>
      <p style={{ fontSize: 18, fontWeight: 700, color: cor || T.text.primary, margin: 0, fontVariantNumeric: 'tabular-nums' }}>{valor}</p>
    </div>
  )
}

function ResumoClinico({ paciente }: { paciente: any }) {
  const itens: { icon: LucideIcon; titulo: string; texto: string; cor: string; bg: string }[] = [
    ...(paciente?.alergias ? [{ icon: TriangleAlert, titulo: 'Alergias', texto: paciente.alergias, cor: T.status.danger, bg: T.status.dangerBg }] : []),
    ...(paciente?.comorbidades ? [{ icon: HeartPulse, titulo: 'Comorbidades', texto: paciente.comorbidades, cor: T.status.warning, bg: T.status.warningBg }] : []),
    ...(paciente?.medicamentos_uso ? [{ icon: Pill, titulo: 'Medicamentos em uso', texto: paciente.medicamentos_uso, cor: T.brand.primary, bg: T.brand.primarySubtle }] : []),
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {itens.map(it => (
        <div key={it.titulo} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: it.bg, borderRadius: 12, padding: '10px 12px' }}>
          <Icon icon={it.icon} size={15} color={it.cor} style={{ marginTop: 1 }} />
          <div style={{ minWidth: 0 }}>
            <Overline style={{ color: it.cor, marginBottom: 2 }}>{it.titulo}</Overline>
            <p style={{ fontSize: 13, color: T.text.strong, margin: 0, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{it.texto}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

function LinhaClicavel({ onClick, children, style }: { onClick: () => void; children: React.ReactNode; style?: React.CSSProperties }) {
  const [h, setH] = useState(false)
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter') onClick() }}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        padding: '12px 18px', borderTop: `1px solid ${T.border.muted}`, cursor: 'pointer', outline: 'none',
        background: h ? T.bg.muted : 'transparent', transition: 'background .15s', ...style,
      }}
    >
      {children}
    </div>
  )
}

function ItemConsulta({ ativa, onClick, children }: { ativa: boolean; onClick: () => void; children: React.ReactNode }) {
  const [h, setH] = useState(false)
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter') onClick() }}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        display: 'flex', flexDirection: 'column', gap: 6, padding: '12px 14px', borderRadius: 14, cursor: 'pointer', outline: 'none',
        border: `1px solid ${ativa ? T.brand.primary : h ? T.brand.primaryAccentSoft : T.border.default}`,
        background: ativa ? T.brand.primarySoftBg : T.bg.card, transition: 'border-color .15s, background .15s',
      }}
    >
      {children}
    </div>
  )
}
