'use client'
import { log } from '@/lib/logger'


import { Suspense, useEffect, useState, useMemo, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Ban, Calendar, CalendarClock, Check, CheckCircle2, ChevronLeft, ChevronRight, Copy,
  Eye, EyeOff, Gift, Hourglass, MessageCircle, Mic, Plus, Send, SlidersHorizontal, Trash2, TriangleAlert, Video, X,
} from 'lucide-react'
import { useToast } from '@/components/Toast'
import { supabase } from '@/lib/supabase'
import { tokens, tint } from '@/lib/design-tokens'
import {
  Avatar, Badge, Button, Checkbox, Chip, Field, Icon, IconButton, IconTile, Input, Modal,
  SearchInput, SegmentedControl, Select, Textarea,
} from '@/components/ui'
import type { BadgeTone } from '@/components/ui'
import { confirmar, notificar } from '@/components/ui/dialogos'
import { DIAS_SEMANA_CURTOS, PERIODOS, periodoDaHora } from '@/components/confirmacoes/modelos'

const T = tokens

// Só a 1ª letra maiúscula ("Outubro de 2026", não "Outubro De 2026")
const cap = (t: string) => t ? t.charAt(0).toUpperCase() + t.slice(1) : t

// Tipos de atendimento — cores da paleta de dados (cheia na barra/hora, tint no fundo)
const TIPOS = {
  consulta: { label: 'Consulta', cor: T.data.purple },
  retorno:  { label: 'Retorno',  cor: T.data.pink },
  exame:    { label: 'Exame',    cor: T.data.green },
  urgencia: { label: 'Urgência', cor: T.data.orange },
}
type TipoKey = keyof typeof TIPOS
const tipoDe = (t: string) => TIPOS[t as TipoKey] || TIPOS.consulta

const STATUS_OPTS = [
  { value: 'agendado',   label: 'Agendado' },
  { value: 'confirmado', label: 'Confirmado' },
  { value: 'cancelado',  label: 'Cancelado' },
  { value: 'realizado',  label: 'Realizado' },
]

const STATUS_BADGE: Record<string, { label: string; tone: BadgeTone }> = {
  agendado:   { label: 'Agendado',   tone: 'pending' },
  confirmado: { label: 'Confirmado', tone: 'success' },
  cancelado:  { label: 'Cancelado',  tone: 'danger' },
  realizado:  { label: 'Realizado',  tone: 'neutral' },
  faltou:     { label: 'Faltou',     tone: 'warning' },
}

// Cores de reserva para profissionais sem cor cadastrada
const CORES_PROF = [T.data.purple, T.data.pink, T.data.blue, T.data.green, T.data.orange]

// Grade de horas: 56px por hora (protótipo), cliques em fatias de 15 min
const SLOT_MIN = 15
const HORA_PX = 56
const PX_MIN = HORA_PX / 60
const SLOT_PX = SLOT_MIN * PX_MIN
const HORA_INI = 7
const HORA_FIM = 21
const ALTURA_GRADE = (HORA_FIM - HORA_INI) * HORA_PX

/** Minutos desde HORA_INI → px */
const minToPx = (d: Date) => ((d.getHours() - HORA_INI) * 60 + d.getMinutes()) * PX_MIN

const DIAS_CURTOS = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM']
const DIAS_MINI = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D']
const MESES_AB = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const dowSeg = (d: Date) => (d.getDay() + 6) % 7

// ── Lista de espera ──
const TIPOS_ESPERA = [
  { value: 'consulta', label: 'Consulta' },
  { value: 'retorno', label: 'Retorno' },
  { value: 'exame', label: 'Exame' },
] as const
const PRIORIDADES = [
  { value: '0', label: 'Normal' },
  { value: '1', label: 'Alta' },
  { value: '2', label: 'Urgente' },
]
// Seg → Dom (valores de Date.getDay)
const DIAS_ESPERA = [1, 2, 3, 4, 5, 6, 0]
const HORA_MS = 3600e3

const FORM_ESPERA_VAZIO = {
  modo: 'paciente' as 'paciente' | 'contato',
  paciente_id: '', nome: '', telefone: '', medico_id: '',
  tipo: 'consulta', preferencia_dias: [] as number[], preferencia_periodo: 'qualquer',
  prioridade: '0', observacao: '',
}

/** Ordem da lista: prioridade (maior primeiro), depois quem entrou antes. */
const ordenarEspera = (l: any[]) => [...l].sort((a, b) =>
  (Number(b.prioridade) || 0) - (Number(a.prioridade) || 0) || String(a.criado_em || '').localeCompare(String(b.criado_em || '')))

/** "Consulta · Seg, Qua · Tarde" */
function resumoPreferencias(w: any) {
  const tipo = TIPOS_ESPERA.find(t => t.value === w.tipo)?.label || 'Consulta'
  const dias: number[] = Array.isArray(w.preferencia_dias) ? w.preferencia_dias : []
  const diasTxt = dias.length === 0 || dias.length === 7 ? 'Qualquer dia'
    : DIAS_ESPERA.filter(d => dias.includes(d)).map(d => DIAS_SEMANA_CURTOS[d]).join(', ')
  const per = w.preferencia_periodo && w.preferencia_periodo !== 'qualquer'
    ? ' · ' + (PERIODOS.find(p => p.value === w.preferencia_periodo)?.label || '') : ''
  return `${tipo} · ${diasTxt}${per}`
}

// ── Modo demonstração (?demo=1) — nada é gravado ──
function dadosDemo(medicoId: string) {
  const em = (diasAdiante: number, h: number, m = 0) => {
    const d = new Date(); d.setDate(d.getDate() + diasAdiante); d.setHours(h, m, 0, 0); return d
  }
  // Consulta "daqui a ~3h" para mostrar o aviso de não confirmação (cai para amanhã cedo fora do expediente)
  const breve = new Date(Date.now() + 3 * HORA_MS); breve.setMinutes(breve.getMinutes() < 30 ? 0 : 30, 0, 0)
  const brevePos = breve.getHours() >= 8 && breve.getHours() <= 19 ? breve : em(1, 8)
  const pacientes = [
    { id: 'dp1', nome: 'Marcos Vinícius Andrade', telefone: '(11) 98765-4321', medico_id: medicoId },
    { id: 'dp2', nome: 'Juliana Ferreira Costa', telefone: '(11) 99812-3344', medico_id: medicoId },
    { id: 'dp3', nome: 'Ana Beatriz Moura', telefone: '(11) 97654-1122', medico_id: medicoId },
    { id: 'dp4', nome: 'Roberto Nogueira', telefone: '(11) 96543-7788', medico_id: medicoId },
    { id: 'dp5', nome: 'Patrícia Lima Santos', telefone: '(11) 95432-6655', medico_id: medicoId },
    { id: 'dp6', nome: 'Carla Mendes', telefone: '(11) 94321-9900', medico_id: medicoId },
    { id: 'dp7', nome: 'Thiago Alves', telefone: '(11) 93210-5566', medico_id: medicoId },
  ]
  const pac = (id: string) => { const p = pacientes.find(x => x.id === id)!; return { nome: p.nome, telefone: p.telefone } }
  const ag = (id: string, pid: string, d: Date, extra: any = {}) => ({
    id, medico_id: medicoId, paciente_id: pid, pacientes: pac(pid), data_hora: d.toISOString(), duracao: '30',
    tipo: 'consulta', status: 'agendado', motivo: '', ...extra,
  })
  const agendamentos = [
    ag('da1', 'dp1', brevePos, { confirmacao_24h_enviada: true, confirmacao_24h_status: 'pendente', motivo: 'Dor no peito ao esforço' }),
    ag('da2', 'dp2', em(1, 9), { confirmacao_24h_enviada: true, confirmacao_24h_status: 'pendente' }),
    ag('da3', 'dp3', em(1, 10, 30), { status: 'confirmado', confirmacao_24h_enviada: true, confirmacao_24h_status: 'confirmado' }),
    ag('da4', 'dp4', em(1, 14), { tipo: 'retorno', motivo: 'Retorno exames' }),
    ag('da5', 'dp5', em(1, 15, 30), { tipo: 'exame', duracao: '45', motivo: 'Eletrocardiograma' }),
    ag('da6', 'dp4', em(2, 11), { lembrete_48h_enviado: true }),
  ]
  const criado = (dias: number) => new Date(Date.now() - dias * 864e5).toISOString()
  const amanha = em(1, 9).getDay()
  const listaEspera = [
    { id: 'dw1', medico_id: medicoId, paciente_id: 'dp6', nome: 'Carla Mendes', telefone: '(11) 94321-9900', tipo: 'consulta', preferencia_dias: [], preferencia_periodo: 'qualquer', prioridade: 2, status: 'aguardando', observacao: 'Dor lombar há 2 semanas', criado_em: criado(5) },
    { id: 'dw2', medico_id: medicoId, paciente_id: null, nome: 'Luiza Barros', telefone: '(11) 92109-4433', tipo: 'consulta', preferencia_dias: [amanha], preferencia_periodo: 'qualquer', prioridade: 1, status: 'aguardando', observacao: 'Prefere primeiro horário', criado_em: criado(3) },
    { id: 'dw3', medico_id: medicoId, paciente_id: 'dp7', nome: 'Thiago Alves', telefone: '(11) 93210-5566', tipo: 'retorno', preferencia_dias: [1, 3, 5], preferencia_periodo: 'tarde', prioridade: 0, status: 'aguardando', observacao: null, criado_em: criado(8) },
    { id: 'dw4', medico_id: medicoId, paciente_id: null, nome: 'Eduardo Pires', telefone: '(11) 91098-2211', tipo: 'exame', preferencia_dias: [2, 4], preferencia_periodo: 'manha', prioridade: 0, status: 'oferecido', observacao: null, criado_em: criado(10) },
  ]
  return { pacientes, agendamentos, listaEspera }
}

function getWeekDays(date: Date) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(d.setDate(diff))
  return Array.from({ length: 7 }, (_, i) => {
    const nd = new Date(monday)
    nd.setDate(monday.getDate() + i)
    return nd
  })
}

/** Grade mensal começando na segunda; só as semanas necessárias (4–6). */
function getMonthGrid(date: Date) {
  const first = new Date(date.getFullYear(), date.getMonth(), 1)
  const startDay = first.getDay()
  const offset = startDay === 0 ? -6 : 1 - startDay
  const start = new Date(first)
  start.setDate(first.getDate() + offset)
  const diasNoMes = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  const semanas = Math.ceil((dowSeg(first) + diasNoMes) / 7)
  return Array.from({ length: semanas * 7 }, (_, i) => {
    const nd = new Date(start)
    nd.setDate(start.getDate() + i)
    return nd
  })
}

const isMesmoDia = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

const fmtMesAno = (d: Date) =>
  d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).replace(/ De /, ' de ')

const fmtHora = (d: Date) => d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

const ehAniversario = (nascStr: string | null | undefined, alvo: Date) => {
  if (!nascStr) return false
  const n = new Date(nascStr)
  if (isNaN(n.getTime())) return false
  return n.getMonth() === alvo.getMonth() && n.getDate() === alvo.getDate()
}

/** Distribui eventos sobrepostos em colunas (lanes) — mesmo algoritmo do protótipo. */
function calcularLanes(ags: any[]) {
  const itens = ags
    .map(a => {
      const d = new Date(a.data_hora)
      const ini = d.getHours() * 60 + d.getMinutes()
      return { ag: a, ini, fim: ini + (Number(a.duracao) || 30), l: 0, L: 1 }
    })
    .sort((a, b) => a.ini - b.ini)
  let grupo: typeof itens = []
  let fimGrupo = -1
  const fechar = () => {
    const lanes: number[] = []
    grupo.forEach(it => {
      let l = lanes.findIndex(f => f <= it.ini)
      if (l < 0) { l = lanes.length; lanes.push(0) }
      lanes[l] = it.fim
      it.l = l
    })
    grupo.forEach(it => { it.L = lanes.length })
    grupo = []
  }
  itens.forEach(it => {
    if (it.ini >= fimGrupo) { fechar(); fimGrupo = -1 }
    grupo.push(it)
    fimGrupo = Math.max(fimGrupo, it.fim)
  })
  fechar()
  return itens
}

/** Botão-ícone pequeno de navegação (‹ ›) */
function BotaoNav({ dir, onClick, size = 34 }: { dir: -1 | 1; onClick: () => void; size?: number }) {
  return (
    <IconButton
      icon={dir < 0 ? ChevronLeft : ChevronRight}
      size={size}
      onClick={onClick}
      aria-label={dir < 0 ? 'Anterior' : 'Próximo'}
    />
  )
}

function AgendaContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()

  const [medico, setMedico] = useState<any>(null)
  const [pacientes, setPacientes] = useState<any[]>([])
  const [agendamentos, setAgendamentos] = useState<any[]>([])
  const [mapaCoresMedicos, setMapaCoresMedicos] = useState<Record<string, string>>({})
  const [bloqueios, setBloqueios] = useState<any[]>([])
  const [modalBloqueio, setModalBloqueio] = useState(false)
  const [medicosClinica, setMedicosClinica] = useState<any[]>([])
  const [procedimentos, setProcedimentos] = useState<any[]>([])
  const [formBloqueio, setFormBloqueio] = useState({
    medico_id: '',
    tipo: 'horario' as 'horario' | 'dia' | 'periodo',
    data: '',
    hora_inicio: '08:00',
    hora_fim: '09:00',
    data_inicio: '',
    data_fim: '',
    motivo: '',
    recorrente: false,
    dias_semana: [] as string[],
  })
  const [salvandoBloqueio, setSalvandoBloqueio] = useState(false)

  const [semana, setSemana] = useState<Date>(() => new Date(0))
  const [diaSelecionado, setDiaSelecionado] = useState<Date>(() => new Date(0))
  const [viewMode, setViewMode] = useState<'semana' | 'dia' | 'mes'>('semana')
  const [isMobile, setIsMobile] = useState(false)
  const [filtrosMobileOpen, setFiltrosMobileOpen] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Em mobile, força view 'dia' (semana de 7 colunas não cabe em 375px)
  useEffect(() => {
    if (isMobile && viewMode !== 'dia') setViewMode('dia')
  }, [isMobile, viewMode])
  const [mesVisualizado, setMesVisualizado] = useState<Date>(() => new Date(0))

  const [filtroStatus, setFiltroStatus] = useState<string>('todos')
  // Tipos e profissionais ocultos (checkbox/olho na coluna lateral)
  const [tiposOff, setTiposOff] = useState<string[]>([])
  const [filtroPaciente, setFiltroPaciente] = useState<string>('')
  const [profsOff, setProfsOff] = useState<string[]>([])

  const demo = searchParams?.get('demo') === '1'
  const [listaEsperaOpen, setListaEsperaOpen] = useState(false)
  const [listaEspera, setListaEspera] = useState<any[]>([])
  const [avisoEspera, setAvisoEspera] = useState('')
  const [modalEspera, setModalEspera] = useState(false)
  const [formEspera, setFormEspera] = useState(FORM_ESPERA_VAZIO)
  const [salvandoEspera, setSalvandoEspera] = useState(false)
  // Config "oferecer vaga da lista" por médico (sem config = ligado)
  const [ofertaPorMedico, setOfertaPorMedico] = useState<Record<string, boolean>>({})
  // Horário liberado (cancelado/faltou) + sugestões da lista
  const [vagaLiberada, setVagaLiberada] = useState<{ ag: any; sugestoes: any[] } | null>(null)
  const [oferecendo, setOferecendo] = useState<string | null>(null)
  // Item da lista sendo encaixado no novo agendamento
  const [encaixeListaId, setEncaixeListaId] = useState<string | null>(null)

  const [modal, setModal] = useState<{ open: boolean; date?: Date; ag?: any }>({ open: false })
  const [submodalRealizado, setSubmodalRealizado] = useState(false)
  // Agendamento existente abre em "Detalhes"; "Editar/Remarcar" troca para o formulário
  const [editando, setEditando] = useState(false)
  const [form, setForm] = useState({ paciente_id: '', medico_id: '', procedimento_id: '', data_hora: '', tipo: 'consulta', motivo: '', observacoes: '', duracao: '30' })
  const [salvando, setSalvando] = useState(false)

  const [comVideo, setComVideo] = useState(false)
  const [salaLink, setSalaLink] = useState('')
  const [salaId, setSalaId] = useState('')

  const [enviandoPreConsulta, setEnviandoPreConsulta] = useState(false)
  const [preConsultaEnviada, setPreConsultaEnviada] = useState(false)

  const [agora, setAgora] = useState<Date | null>(null)
  // Query da primeira carga (a URL é limpa logo depois de abrir o "novo agendamento")
  const buscaInicial = useRef<string | null>(null)
  if (buscaInicial.current === null && typeof window !== 'undefined') buscaInicial.current = window.location.search
  useEffect(() => {
    const agora_ = new Date()
    setAgora(agora_)
    // ?data=AAAA-MM-DD (atalho vindo de Retornos) abre a agenda já na semana certa
    const dataParam = new URLSearchParams(buscaInicial.current || '').get('data')
    const m_ = dataParam && /^(\d{4})-(\d{2})-(\d{2})$/.exec(dataParam)
    const foco = m_ ? new Date(Number(m_[1]), Number(m_[2]) - 1, Number(m_[3]), 9) : agora_
    const inicio = foco < agora_ ? agora_ : foco
    setSemana(inicio)
    setDiaSelecionado(inicio)
    setMesVisualizado(inicio)
    const t = setInterval(() => setAgora(new Date()), 60000)
    return () => clearInterval(t)
  }, [])

  const diasSemana = getWeekDays(semana)
  const hojeStr = agora ? agora.toDateString() : ''
  const isHoje = (d: Date) => hojeStr !== '' && d.toDateString() === hojeStr

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      if (params.get('nova_teleconsulta') === '1') {
        setComVideo(true)
        setModal({ open: true })
        window.history.replaceState({}, '', '/agenda')
      } else if (params.get('novo') === '1') {
        // Atalhos de outras telas (ex.: Retornos): ?novo=1&paciente_id=…&tipo=retorno&data=AAAA-MM-DD&motivo=…
        const dataParam = params.get('data')
        let quando: Date | undefined
        if (dataParam && /^\d{4}-\d{2}-\d{2}$/.test(dataParam)) {
          const [a_, m_, d_] = dataParam.split('-').map(Number)
          quando = new Date(a_, m_ - 1, d_, 9, 0, 0, 0)
          const agora_ = new Date()
          if (quando < agora_) { quando = new Date(agora_); quando.setMinutes(0, 0, 0); quando.setHours(quando.getHours() + 1) }
        }
        abrirModal(quando)
        const pid = params.get('paciente_id'), tipo = params.get('tipo'), motivo = params.get('motivo')
        if (pid || tipo || motivo) {
          setForm(f => ({ ...f, ...(pid ? { paciente_id: pid } : {}), ...(tipo ? { tipo } : {}), ...(motivo ? { motivo } : {}) }))
        }
        window.history.replaceState({}, '', demo ? '/agenda?demo=1' : '/agenda')
      }
    }
  }, [])

  useEffect(() => {
    const ca_ = localStorage.getItem('clinica_admin')
    const m = ca_ || localStorage.getItem('medico')
    if (demo) {
      const med = m ? JSON.parse(m) : { id: 'demo', nome: 'Helena Prado' }
      setMedico(med)
      const d = dadosDemo(med.id)
      setPacientes(d.pacientes); setAgendamentos(d.agendamentos); setListaEspera(ordenarEspera(d.listaEspera))
      setMedicosClinica([{ id: med.id, nome: med.nome || 'Helena Prado' }])
      return
    }
    if (!m) { router.push('/login'); return }
    const med = JSON.parse(m)
    setMedico(med)
    carregarDados(med.id)
  }, [router, demo])

  const carregarListaEspera = async (ids: string[]) => {
    try {
      const r = await fetch('/api/lista-espera?medico_ids=' + ids.join(','))
      const d = await r.json()
      setListaEspera(ordenarEspera(d.itens || []))
      setAvisoEspera(d.aviso || '')
    } catch { /* lista é complementar: não quebra a agenda */ }
    // Config "oferecer vaga" de cada médico
    const pares = await Promise.all(ids.map(id =>
      fetch('/api/confirmacoes/config?so_config=1&medico_id=' + id).then(r => r.json())
        .then(d => [id, d.config?.oferecer_vaga_lista !== false] as const).catch(() => [id, true] as const)))
    setOfertaPorMedico(Object.fromEntries(pares))
  }

  const carregarDados = async (medicoId: string) => {
    // Se for clinica admin, busca pacientes e agendamentos de TODOS os medicos da clinica
    const ca = localStorage.getItem('clinica_admin')
    let medicoIds: string[] = [medicoId]

    if (ca) {
      const admin = JSON.parse(ca)
      if (admin.clinica_id) {
        const { data: meds } = await supabase
          .from('medicos').select('id, cor').eq('clinica_id', admin.clinica_id).eq('cargo', 'medico').eq('ativo', true)
        medicoIds = (meds || []).map((m: any) => m.id)
        const mapa: Record<string, string> = {}
        ;(meds || []).forEach((m: any) => { mapa[m.id] = m.cor || tokens.brand.primary })
        setMapaCoresMedicos(mapa)
        if (medicoIds.length === 0) medicoIds = [medicoId]
      }
    } else {
      // Medico logado sozinho: busca sua propria cor
      const { data: med } = await supabase.from('medicos').select('id, cor').eq('id', medicoId).maybeSingle()
      if (med) setMapaCoresMedicos({ [med.id]: (med as any).cor || tokens.brand.primary })
    }

    const clinicaIdLocal = JSON.parse(localStorage.getItem('clinica_admin') || 'null')?.clinica_id
      || JSON.parse(localStorage.getItem('medico') || 'null')?.clinica_id

    const [pacsR, agsR, medsR, blqsResp] = await Promise.all([
      supabase.from('pacientes').select('id, nome, data_nascimento, telefone, medico_id').in('medico_id', medicoIds).order('nome'),
      supabase.from('agendamentos').select(`*, pacientes(nome, data_nascimento, telefone)`).in('medico_id', medicoIds).order('data_hora'),
      supabase.from('medicos').select('id, nome, cor').in('id', medicoIds).eq('ativo', true).neq('cargo', 'recepcionista').order('nome'),
      // Bloqueios via API (service_role, sem RLS)
      fetch('/api/bloqueios?' + (clinicaIdLocal ? 'clinica_id=' + clinicaIdLocal : 'medico_id=' + medicoId)).then(r => r.json()),
    ])
    setPacientes(pacsR.data || [])
    setAgendamentos(agsR.data || [])
    setMedicosClinica(medsR.data || [])
    carregarListaEspera(medicoIds)

    // Carregar procedimentos da clínica (cobre admin + medico)
    const cidLoad = clinicaIdLocal || medico?.clinica_id
    if (cidLoad) {
      const procR = await fetch('/api/procedimentos?clinica_id=' + cidLoad)
      const procD = await procR.json()
      setProcedimentos(procD.procedimentos || [])
    }
    setBloqueios(blqsResp.bloqueios || [])
  }

  const agendamentosFiltrados = useMemo(() => {
    return agendamentos.filter(a => {
      if (filtroStatus !== 'todos' && a.status !== filtroStatus) return false
      if (tiposOff.includes(a.tipo || 'consulta')) return false
      if (filtroPaciente) {
        const nome = (a.pacientes?.nome || a.paciente_nome || '').toLowerCase()
        if (!nome.includes(filtroPaciente.toLowerCase())) return false
      }
      if (a.medico_id && profsOff.includes(a.medico_id)) return false
      return true
    })
  }, [agendamentos, filtroStatus, tiposOff, filtroPaciente, profsOff])

  const getBloqueiosDia = (dia: Date) => {
    const diaSemana = dia.getDay().toString()
    const iniDia = new Date(dia); iniDia.setHours(0, 0, 0, 0)
    const fimDia = new Date(dia); fimDia.setHours(23, 59, 59, 999)

    return bloqueios.flatMap((b: any) => {
      const dIni = new Date(b.data_inicio)
      const dFim = new Date(b.data_fim)

      // Bloqueio recorrente semanal
      if (b.recorrente && b.dias_semana) {
        const dias = b.dias_semana.split(',')
        if (!dias.includes(diaSemana)) return []
        // Data tem que estar no range do bloqueio (data_inicio define quando a recorrencia comeca)
        if (iniDia < new Date(new Date(b.data_inicio).setHours(0, 0, 0, 0))) return []

        // Cria ocorrencia do dia atual usando as horas do bloqueio original
        const ocorrIni = new Date(dia)
        ocorrIni.setHours(dIni.getHours(), dIni.getMinutes(), 0, 0)
        const ocorrFim = new Date(dia)
        ocorrFim.setHours(dFim.getHours(), dFim.getMinutes(), 0, 0)
        return [{ ...b, data_inicio: ocorrIni.toISOString(), data_fim: ocorrFim.toISOString() }]
      }

      // Bloqueio pontual: verifica overlap com o dia
      if (dFim < iniDia || dIni > fimDia) return []
      return [b]
    })
  }

  const getAgsDia = (dia: Date) =>
    agendamentosFiltrados.filter(a => new Date(a.data_hora).toDateString() === dia.toDateString())

  const navegarSemana = (dir: number) => {
    const nd = new Date(semana); nd.setDate(nd.getDate() + dir * 7); setSemana(nd)
  }
  const navegarMes = (dir: number) => {
    const nd = new Date(mesVisualizado); nd.setMonth(nd.getMonth() + dir); setMesVisualizado(nd)
  }
  // ‹ › da toolbar: anda 1 dia, 1 semana ou 1 mês conforme a visão
  const navegar = (dir: number) => {
    if (viewMode === 'mes') { navegarMes(dir); return }
    if (viewMode === 'dia') {
      const nd = new Date(diaSelecionado); nd.setDate(nd.getDate() + dir)
      setDiaSelecionado(nd); setSemana(nd); setMesVisualizado(nd)
      return
    }
    navegarSemana(dir)
  }
  const irParaHoje = () => { setSemana(new Date()); setDiaSelecionado(new Date()); setMesVisualizado(new Date()) }
  const alternar = (lista: string[], v: string) => lista.includes(v) ? lista.filter(x => x !== v) : [...lista, v]

  const limparFiltros = () => {
    setFiltroStatus('todos'); setTiposOff([]); setFiltroPaciente(''); setProfsOff([])
  }

  const filtrosAtivos =
    (filtroStatus !== 'todos' ? 1 : 0) +
    (tiposOff.length > 0 ? 1 : 0) +
    (filtroPaciente ? 1 : 0) +
    (profsOff.length > 0 ? 1 : 0)

  // useEffect: abre modal quando ?ag=ID na URL e agendamentos carregaram
  useEffect(() => {
    const agId = searchParams?.get('ag')
    if (!agId || agendamentos.length === 0) return
    const ag = agendamentos.find((a: any) => a.id === agId)
    if (ag) {
      abrirModal(undefined, ag)
      // Limpa o param da URL pra nao reabrir ao recarregar
      const url = new URL(window.location.href)
      url.searchParams.delete('ag')
      window.history.replaceState({}, '', url.toString())
    }
  }, [searchParams, agendamentos])

  // Comanda financeira desligada pra rebuild (Financeiro 2.0). Sprint 1 pré-beta.
  // const gerarComandaDoAgendamento = async (ag: any) => {
  //   if (!ag?.id) return
  //   try {
  //     const r = await fetch('/api/comandas', {
  //       method: 'POST',
  //       headers: { 'Content-Type': 'application/json' },
  //       body: JSON.stringify({
  //         paciente_id: ag.paciente_id,
  //         medico_id: ag.medico_id || null,
  //         clinica_id: medico?.clinica_id || null,
  //         agendamento_id: ag.id,
  //       }),
  //     })
  //     const d = await r.json()
  //     if (d.error) { alert('Erro ao gerar comanda: ' + d.error); return }
  //     if (d.comanda?.id) {
  //       router.push('/comandas/' + d.comanda.id)
  //     }
  //   } catch (e: any) {
  //     alert('Erro: ' + (e?.message || 'desconhecido'))
  //   }
  // }

  const abrirModal = (date?: Date, ag?: any) => {
    setPreConsultaEnviada(false); setComVideo(false); setSalaLink(''); setSalaId(''); setEditando(false); setEncaixeListaId(null)
    if (ag) {
      const d = new Date(ag.data_hora)
      const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
      setForm({
        paciente_id: ag.paciente_id || '',
        medico_id: ag.medico_id || '',
        procedimento_id: ag.procedimento_id || '',
        data_hora: local,
        tipo: ag.tipo || 'consulta',
        motivo: ag.motivo || '',
        observacoes: ag.observacoes || '',
        duracao: ag.duracao || '30',
      })
      setModal({ open: true, ag })
    } else {
      const d = date || new Date()
      if (d.getHours() < HORA_INI) d.setHours(8, 0, 0, 0)
      const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
      setForm({ paciente_id: '', medico_id: '', procedimento_id: '', data_hora: local, tipo: 'consulta', motivo: '', observacoes: '', duracao: '30' })
      setModal({ open: true, date: d })
    }
  }

  const criarSalaAgora = async () => {
    if (!medico || salaLink) return
    try {
      // Resolve medico_id real (se estiver como clinica_admin, medico.id é do admin)
      let medicoIdFinal = medico.id
      const ca = localStorage.getItem('clinica_admin')
      if (ca) {
        if (form.paciente_id) {
          const pac = pacientes.find((p: any) => p.id === form.paciente_id)
          if (pac && pac.medico_id) medicoIdFinal = pac.medico_id
        } else if (medico.clinica_id) {
          const { data: primMed } = await supabase
            .from('medicos').select('id')
            .eq('clinica_id', medico.clinica_id).eq('cargo', 'medico').eq('ativo', true)
            .order('criado_em').limit(1).maybeSingle()
          if (primMed) medicoIdFinal = primMed.id
        }
      }

      const tcRes = await fetch('/api/teleconsulta', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          medico_id: medicoIdFinal,
          paciente_id: form.paciente_id || null,
          titulo: form.motivo || 'Teleconsulta',
        }),
      })
      const tcData = await tcRes.json()
      if (tcData.teleconsulta) {
        const sid = tcData.teleconsulta.sala_id
        const link = window.location.origin + '/sala/' + sid
        setSalaId(sid)
        setSalaLink(link)
        setComVideo(true)
      } else {
        log.error('Erro criando sala:', tcData.error)
        toast('Erro ao criar sala: ' + (tcData.error || 'desconhecido'))
      }
    } catch (err) {
      log.error('Erro criando sala:', err)
      toast('Erro ao criar sala')
    }
  }

  const removerSala = async () => {
    // Encerra a sala órfã no servidor pra não poluir o painel
    if (salaId) {
      try {
        const { data: tc } = await supabase
          .from('teleconsultas').select('id').eq('sala_id', salaId).maybeSingle()
        if (tc?.id) {
          await supabase.from('teleconsultas').update({ status: 'encerrada', encerrada_em: new Date().toISOString() }).eq('id', tc.id)
        }
      } catch (err) { log.error('Erro removendo sala:', err) }
    }
    setSalaLink(''); setSalaId(''); setComVideo(false)
  }

  const copiarLinkSala = () => {
    navigator.clipboard.writeText(salaLink).catch(() => {})
    toast('Link copiado!')
  }

  const enviarSalaWhatsApp = async () => {
    if (!salaLink) return
    const pac = pacientes.find((p: any) => p.id === form.paciente_id)
    const msgTxt = 'Olá! Dr(a). ' + (medico?.nome || '') + ' te convidou para uma teleconsulta.\n\nAcesse pelo link (não precisa instalar nada):\n' + salaLink
    if (pac?.telefone) {
      await fetch('/api/whatsapp/enviar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telefone: pac.telefone, texto: msgTxt, medico_id: medico.id })
      })
      toast('Enviado por WhatsApp!')
    } else {
      navigator.clipboard.writeText(msgTxt).catch(() => {})
      toast('Paciente sem telefone — mensagem copiada')
    }
  }

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (demo) {
      const pac = pacientes.find((p: any) => p.id === form.paciente_id)
      const dados = {
        paciente_id: form.paciente_id || null, data_hora: new Date(form.data_hora).toISOString(), tipo: form.tipo,
        motivo: form.motivo, observacoes: form.observacoes, duracao: form.duracao,
        pacientes: pac ? { nome: pac.nome, telefone: pac.telefone } : null,
      }
      if (modal.ag) setAgendamentos(prev => prev.map(a => a.id === modal.ag.id ? { ...a, ...dados } : a))
      else setAgendamentos(prev => [...prev, { id: 'demo-' + Date.now(), medico_id: form.medico_id || medico?.id, status: 'agendado', ...dados }])
      if (!modal.ag && encaixeListaId) setListaEspera(l => l.filter(w => w.id !== encaixeListaId))
      setModal({ open: false })
      notificar('Modo demonstração: nada foi gravado', 'info')
      return
    }
    setSalvando(true)
    try {
      if (modal.ag) {
        const { data } = await supabase.from('agendamentos').update({
          paciente_id: form.paciente_id || null,
          procedimento_id: form.procedimento_id || null,
          data_hora: new Date(form.data_hora).toISOString(),
          tipo: form.tipo,
          motivo: form.motivo,
          observacoes: form.observacoes,
          duracao: form.duracao,
        }).eq('id', modal.ag.id).select(`*, pacientes(nome, data_nascimento, telefone)`).single()
        if (data) setAgendamentos(prev => prev.map(a => a.id === data.id ? data : a))
      } else {
        let meetLinkFinal = ''
        let meetCodeFinal = ''
        // Sala já criada ao clicar em "Adicionar videoconferência" — só reaproveita
        if (salaLink && salaId) {
          meetLinkFinal = salaLink
          meetCodeFinal = salaId
        }
        // Resolução do médico responsável pelo agendamento
        let medicoIdFinal = medico.id
        const ca = localStorage.getItem('clinica_admin')
        if (ca) {
          // Admin da clínica: prioriza médico escolhido no form, senão pega do paciente, senão primeiro ativo
          if (form.medico_id) {
            medicoIdFinal = form.medico_id
          } else if (form.paciente_id) {
            const pac = pacientes.find((p: any) => p.id === form.paciente_id)
            if (pac && pac.medico_id) medicoIdFinal = pac.medico_id
          } else {
            const { data: primMed } = await supabase
              .from('medicos').select('id').eq('clinica_id', medico.clinica_id).eq('cargo', 'medico').eq('ativo', true).order('criado_em').limit(1).maybeSingle()
            if (primMed) medicoIdFinal = primMed.id
          }
        }
        // Se médico logado, medicoIdFinal já é medico.id (default acima)

        const { data } = await supabase.from('agendamentos').insert({
          medico_id: medicoIdFinal,
          paciente_id: form.paciente_id || null,
          procedimento_id: form.procedimento_id || null,
          data_hora: new Date(form.data_hora).toISOString(),
          tipo: form.tipo,
          motivo: form.motivo,
          observacoes: form.observacoes,
          duracao: form.duracao,
          status: 'agendado',
          meet_link: meetLinkFinal || null,
          meet_code: meetCodeFinal || null,
        }).select(`*, pacientes(nome, data_nascimento, telefone)`).single()
        if (data) setAgendamentos(prev => [...prev, data])
        if (data && encaixeListaId) marcarEsperaAgendada(encaixeListaId, data.id)
      }
      setModal({ open: false })
    } finally { setSalvando(false) }
  }

  const deletar = async (id: string) => {
    if (!(await confirmar({ titulo: 'Excluir este agendamento?', mensagem: 'Se quiser manter o registro, use “Cancelar” em vez de excluir.', confirmar: 'Excluir', perigo: true }))) return
    if (!demo) await supabase.from('agendamentos').delete().eq('id', id)
    setAgendamentos(prev => prev.filter(a => a.id !== id))
    setModal({ open: false })
  }

  const enviarPreConsulta = async (agendamentoId: string) => {
    if (!medico) return
    if (demo) { setPreConsultaEnviada(true); notificar('Modo demonstração: nada foi enviado', 'info'); return }
    setEnviandoPreConsulta(true)
    try {
      const res = await fetch('/api/sofia/preatendimento', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agendamento_id: agendamentoId })
      })
      const data = await res.json()
      if (data.ok) {
        setPreConsultaEnviada(true)
        setAgendamentos(prev => prev.map(a => a.id === agendamentoId ? { ...a, pre_consulta_enviada: true } : a))
        toast(`Sofia vai fazer ${data.total_perguntas} perguntas adaptativas ao paciente`)
      } else {
        toast(data.error || 'Erro ao enviar pré-atendimento', 'error')
      }
    } catch (e) { notificar('Erro de conexão', 'erro') }
    finally { setEnviandoPreConsulta(false) }
  }

  const abrirModalBloqueio = () => {
    const hoje = new Date().toISOString().split('T')[0]
    setFormBloqueio({
      medico_id: medicosClinica[0]?.id || medico?.id || '',
      tipo: 'horario',
      data: hoje,
      hora_inicio: '12:00',
      hora_fim: '13:00',
      data_inicio: hoje,
      data_fim: hoje,
      motivo: '',
      recorrente: false,
      dias_semana: [],
    })
    setModalBloqueio(true)
  }

  const salvarBloqueio = async () => {
    if (!formBloqueio.medico_id) { toast('Escolha um medico', 'error'); return }
    if (demo) { setModalBloqueio(false); notificar('Modo demonstração: nada foi gravado', 'info'); return }

    let data_inicio: string, data_fim: string

    if (formBloqueio.tipo === 'horario') {
      data_inicio = new Date(formBloqueio.data + 'T' + formBloqueio.hora_inicio + ':00').toISOString()
      data_fim = new Date(formBloqueio.data + 'T' + formBloqueio.hora_fim + ':00').toISOString()
    } else if (formBloqueio.tipo === 'dia') {
      data_inicio = new Date(formBloqueio.data + 'T00:00:00').toISOString()
      data_fim = new Date(formBloqueio.data + 'T23:59:59').toISOString()
    } else {
      // periodo
      if (!formBloqueio.data_inicio || !formBloqueio.data_fim) { toast('Preencha as datas', 'error'); return }
      data_inicio = new Date(formBloqueio.data_inicio + 'T00:00:00').toISOString()
      data_fim = new Date(formBloqueio.data_fim + 'T23:59:59').toISOString()
    }

    setSalvandoBloqueio(true)
    try {
      const clinicaId = JSON.parse(localStorage.getItem('clinica_admin') || 'null')?.clinica_id
        || JSON.parse(localStorage.getItem('medico') || 'null')?.clinica_id

      const res = await fetch('/api/bloqueios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          medico_id: formBloqueio.medico_id,
          clinica_id: clinicaId,
          data_inicio,
          data_fim,
          motivo: formBloqueio.motivo || null,
          recorrente: formBloqueio.recorrente,
          dias_semana: formBloqueio.recorrente && formBloqueio.dias_semana.length > 0 ? formBloqueio.dias_semana.join(',') : null,
        }),
      })
      const data = await res.json()
      if (data.bloqueio) {
        setBloqueios(prev => [...prev, data.bloqueio])
        setModalBloqueio(false)
        toast('Horario bloqueado!')
      } else {
        toast(data.error || 'Erro ao bloquear', 'error')
      }
    } catch (e: any) {
      toast('Erro de conexao', 'error')
    } finally {
      setSalvandoBloqueio(false)
    }
  }

  const removerBloqueio = async (id: string) => {
    if (!(await confirmar({ titulo: 'Remover este bloqueio?', mensagem: 'O horário volta a ficar disponível para agendamentos.', confirmar: 'Remover' }))) return
    await fetch('/api/bloqueios?id=' + id, { method: 'DELETE' })
    setBloqueios(prev => prev.filter(b => b.id !== id))
    toast('Bloqueio removido')
  }

  const atualizarStatus = async (id: string, status: string) => {
    const anterior = agendamentos.find(a => a.id === id)
    if (demo) {
      setAgendamentos(prev => prev.map(a => a.id === id ? { ...a, status } : a))
    } else {
      // Confirmação manual registra quando/como (colunas da migration 0010; sem elas, só o status)
      const extra = status === 'confirmado' ? { confirmado_em: new Date().toISOString(), confirmado_via: 'manual' } : {}
      let { data, error } = await supabase.from('agendamentos').update({ status, ...extra }).eq('id', id).select(`*, pacientes(nome, data_nascimento, telefone)`).single()
      if (error && status === 'confirmado') {
        ({ data } = await supabase.from('agendamentos').update({ status }).eq('id', id).select(`*, pacientes(nome, data_nascimento, telefone)`).single())
      }
      if (data) setAgendamentos(prev => prev.map(a => a.id === id ? data : a))
    }
    if ((status === 'cancelado' || status === 'faltou') && anterior) sugerirVaga(anterior)
  }

  // ── Lista de espera ───────────────────────────────────────────────────────

  /** Horário liberado → até 3 pacientes da lista compatíveis com o dia e o período. */
  const sugerirVaga = (ag: any) => {
    const d = new Date(ag.data_hora)
    if (d.getTime() <= Date.now()) return // horário já passou: nada a oferecer
    if (ag.medico_id && ofertaPorMedico[ag.medico_id] === false) return
    const per = periodoDaHora(d.getHours())
    const sugestoes = listaEspera.filter(w => {
      if (w.status !== 'aguardando') return false
      if (ag.medico_id && w.medico_id && w.medico_id !== ag.medico_id) return false
      const dias: number[] = Array.isArray(w.preferencia_dias) ? w.preferencia_dias : []
      if (dias.length && !dias.includes(d.getDay())) return false
      return !w.preferencia_periodo || w.preferencia_periodo === 'qualquer' || w.preferencia_periodo === per
    }).slice(0, 3)
    if (sugestoes.length) setVagaLiberada({ ag, sugestoes })
  }

  const atualizarItemEspera = (id: string, campos: any) => {
    setListaEspera(l => l.map(w => w.id === id ? { ...w, ...campos } : w))
    setVagaLiberada(v => v ? { ...v, sugestoes: v.sugestoes.map(w => w.id === id ? { ...w, ...campos } : w) } : v)
  }

  const marcarEsperaAgendada = async (itemId: string, agendamentoId: string) => {
    setListaEspera(l => l.filter(w => w.id !== itemId))
    try {
      await fetch('/api/lista-espera', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: itemId, status: 'agendado', agendamento_id: agendamentoId }),
      })
    } catch { /* o item some da lista local de qualquer forma */ }
  }

  const oferecerHorario = async (w: any, ag: any) => {
    const nome = w.nome || w.pacientes?.nome || 'Paciente'
    if (demo) {
      atualizarItemEspera(w.id, { status: 'oferecido' })
      notificar('Modo demonstração: a oferta não foi enviada', 'info')
      return
    }
    setOferecendo(w.id)
    try {
      const r = await fetch('/api/lista-espera/oferecer', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: w.id, data_hora: ag.data_hora, duracao: Number(ag.duracao) || 30, medico_id: ag.medico_id }),
      })
      const d = await r.json()
      if (!r.ok) { notificar(d.error || 'Não foi possível enviar a oferta', 'erro'); return }
      atualizarItemEspera(w.id, { status: 'oferecido' })
      notificar(`Horário oferecido a ${nome.split(' ')[0]} pelo WhatsApp`)
    } catch { notificar('Erro de conexão', 'erro') }
    finally { setOferecendo(null) }
  }

  /** Abre o novo agendamento já preenchido com o paciente da lista. */
  const encaixarDaLista = (w: any, data?: Date, ag?: any) => {
    setListaEsperaOpen(false); setVagaLiberada(null)
    abrirModal(data)
    setForm(f => ({
      ...f,
      paciente_id: w.paciente_id || '',
      tipo: w.tipo || 'consulta',
      medico_id: ag?.medico_id || w.medico_id || f.medico_id,
      duracao: ag?.duracao ? String(ag.duracao) : f.duracao,
      motivo: w.paciente_id ? (w.observacao || '') : `Encaixe — ${w.nome}${w.telefone ? ' · ' + w.telefone : ''}`,
    }))
    setEncaixeListaId(w.id)
  }

  const abrirModalEspera = () => {
    setListaEsperaOpen(false)
    setFormEspera({ ...FORM_ESPERA_VAZIO, medico_id: medicosClinica[0]?.id || '' })
    setModalEspera(true)
  }

  const salvarEspera = async () => {
    const f = formEspera
    const pac = f.modo === 'paciente' ? pacientes.find((p: any) => p.id === f.paciente_id) : null
    if (f.modo === 'paciente' && !pac) { notificar('Escolha o paciente', 'erro'); return }
    if (f.modo === 'contato' && !f.nome.trim()) { notificar('Informe o nome', 'erro'); return }
    if (f.modo === 'contato' && f.telefone.replace(/\D/g, '').length < 10) { notificar('Informe um telefone com DDD', 'erro'); return }
    const item = {
      medico_id: f.medico_id || pac?.medico_id || medicosClinica[0]?.id || medico?.id,
      paciente_id: pac?.id || null,
      nome: pac?.nome || f.nome.trim(),
      telefone: pac?.telefone || f.telefone.trim() || null,
      tipo: f.tipo, preferencia_dias: f.preferencia_dias, preferencia_periodo: f.preferencia_periodo,
      prioridade: Number(f.prioridade) || 0, observacao: f.observacao.trim() || null,
    }
    if (demo) {
      setListaEspera(l => ordenarEspera([...l, { ...item, id: 'demo-' + Date.now(), status: 'aguardando', criado_em: new Date().toISOString() }]))
      setModalEspera(false)
      notificar('Modo demonstração: nada foi gravado', 'info')
      return
    }
    setSalvandoEspera(true)
    try {
      const r = await fetch('/api/lista-espera', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(item) })
      const d = await r.json()
      if (!r.ok) { notificar(d.error || 'Erro ao adicionar', 'erro'); return }
      setListaEspera(l => ordenarEspera([...l, d.item]))
      setModalEspera(false)
      notificar(`${item.nome.split(' ')[0]} entrou na lista de espera`)
    } catch { notificar('Erro de conexão', 'erro') }
    finally { setSalvandoEspera(false) }
  }

  const removerEspera = async (w: any) => {
    const nome = w.nome || 'Paciente'
    if (!(await confirmar({ titulo: 'Remover da lista de espera?', mensagem: `${nome} deixa de receber ofertas de horário.`, confirmar: 'Remover', perigo: true }))) return
    if (!demo) {
      const r = await fetch('/api/lista-espera?id=' + w.id, { method: 'DELETE' }).catch(() => null)
      if (!r?.ok) { notificar('Não foi possível remover', 'erro'); return }
    }
    setListaEspera(l => l.filter(x => x.id !== w.id))
    notificar(demo ? 'Modo demonstração: nada foi gravado' : 'Removido da lista de espera', demo ? 'info' : 'ok')
  }

  // ── Apresentação ──────────────────────────────────────────────────────────

  const fecharModal = () => setModal({ open: false })

  // Profissionais (checkbox colorido) — cor cadastrada do médico ou paleta de reserva
  const profs = medicosClinica.map((m: any, i: number) => ({
    id: m.id as string,
    nome: (m.nome || 'Profissional') as string,
    cor: (m.cor || mapaCoresMedicos[m.id] || CORES_PROF[i % CORES_PROF.length]) as string,
  }))
  const multiProf = profs.length > 1
  const nomeMedico = (id: string) => profs.find(p => p.id === id)?.nome || ''

  // Dias visíveis (para contadores por profissional)
  const diasVisiveis = viewMode === 'dia' ? [diaSelecionado]
    : viewMode === 'semana' ? diasSemana
    : getMonthGrid(mesVisualizado).filter(d => d.getMonth() === mesVisualizado.getMonth())
  const chavesVisiveis = diasVisiveis.map(d => d.toDateString())
  const contarProf = (id: string) => agendamentos.filter(a => a.medico_id === id && chavesVisiveis.indexOf(new Date(a.data_hora).toDateString()) >= 0).length

  const tituloIntervalo = (() => {
    if (viewMode === 'mes') return cap(fmtMesAno(mesVisualizado))
    if (viewMode === 'dia') {
      const d = diaSelecionado
      return cap(d.toLocaleDateString('pt-BR', { weekday: 'long' })) + ', ' + d.getDate() + ' de ' + d.toLocaleDateString('pt-BR', { month: 'long' })
    }
    const a = diasSemana[0], b = diasSemana[6]
    return `${a.getDate()} ${MESES_AB[a.getMonth()]} – ${b.getDate()} ${MESES_AB[b.getMonth()]} ${b.getFullYear()}`
  })()

  const hoverLinha = {
    onMouseEnter: (e: React.MouseEvent<HTMLElement>) => { e.currentTarget.style.background = T.bg.page },
    onMouseLeave: (e: React.MouseEvent<HTMLElement>) => { e.currentTarget.style.background = 'transparent' },
  }
  const linhaFiltro: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 10, padding: '7px 8px', borderRadius: 9, border: 'none',
    background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, color: T.text.strong,
    textAlign: 'left', width: '100%', transition: 'background .15s, opacity .15s',
  }
  const tituloSecao: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: T.text.secondary, marginBottom: 4 }

  // ── Mini calendário ──
  const renderMiniCal = (mobile: boolean) => {
    const grid = getMonthGrid(mesVisualizado)
    const mesAtual = mesVisualizado.getMonth()
    const ini = diasSemana[0], fim = diasSemana[6]
    const iniT = new Date(ini.getFullYear(), ini.getMonth(), ini.getDate()).getTime()
    const fimT = new Date(fim.getFullYear(), fim.getMonth(), fim.getDate()).getTime()
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: T.text.primary }}>{cap(fmtMesAno(mesVisualizado))}</span>
          <div style={{ display: 'flex', gap: 2 }}>
            <BotaoNav dir={-1} size={28} onClick={() => navegarMes(-1)} />
            <BotaoNav dir={1} size={28} onClick={() => navegarMes(1)} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 2 }}>
          {DIAS_MINI.map((l, i) => (
            <span key={i} style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, color: T.text.tertiary, padding: '4px 0' }}>{l}</span>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', rowGap: 2 }}>
          {grid.map((d, i) => {
            const fora = d.getMonth() !== mesAtual
            const hoje = isHoje(d)
            const sel = isMesmoDia(d, diaSelecionado)
            const t = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
            const naSemana = viewMode === 'semana' && t >= iniT && t <= fimT
            const dow = dowSeg(d)
            const temAgs = agendamentosFiltrados.some(a => new Date(a.data_hora).toDateString() === d.toDateString())
            const raio = naSemana && !sel ? (dow === 0 ? '9px 0 0 9px' : dow === 6 ? '0 9px 9px 0' : '0') : '9px'
            const bgBase = sel ? T.brand.primary : naSemana ? T.brand.primarySubtle : 'transparent'
            return (
              <button key={i} type="button"
                onClick={() => { setDiaSelecionado(d); setSemana(d); if (mobile) setFiltrosMobileOpen(false) }}
                onMouseEnter={e => { if (!sel) e.currentTarget.style.background = T.brand.primaryLight }}
                onMouseLeave={e => { e.currentTarget.style.background = bgBase }}
                style={{
                  height: mobile ? 38 : 32, border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1,
                  fontSize: 12.5, fontWeight: sel || hoje ? 700 : 500,
                  color: sel ? '#fff' : hoje ? T.brand.primary : fora ? '#C3C1CC' : T.text.strong,
                  background: bgBase, borderRadius: raio, transition: 'background .12s',
                }}>
                {d.getDate()}
                <span style={{ width: 4, height: 4, borderRadius: '50%', background: temAgs && !sel ? T.brand.primaryAccent : 'transparent' }} />
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // ── Coluna de filtros (desktop) / conteúdo do bottom sheet (mobile) ──
  const renderFiltros = (mobile: boolean) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
      {renderMiniCal(mobile)}
      <div style={{ height: 1, background: T.border.muted }} />

      <SearchInput value={filtroPaciente} onChange={setFiltroPaciente} placeholder="Buscar paciente" />

      {multiProf && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={tituloSecao}>Profissionais</span>
          {profs.map(p => {
            const on = !profsOff.includes(p.id)
            const n = contarProf(p.id)
            return (
              <button key={p.id} type="button" onClick={() => setProfsOff(l => alternar(l, p.id))} style={linhaFiltro} {...hoverLinha}>
                <span style={{
                  width: 16, height: 16, borderRadius: 5, flexShrink: 0, display: 'grid', placeItems: 'center',
                  background: on ? p.cor : '#fff', border: `1.5px solid ${p.cor}`, color: '#fff',
                }}>{on && <Check size={11} strokeWidth={3} />}</span>
                <span style={{ flex: 1, minWidth: 0, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nome}</span>
                <span style={{ fontSize: 12, color: T.text.tertiary }}>{n || ''}</span>
              </button>
            )
          })}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={tituloSecao}>Tipos de atendimento</span>
        {(Object.keys(TIPOS) as TipoKey[]).map(k => {
          const on = !tiposOff.includes(k)
          return (
            <button key={k} type="button" onClick={() => setTiposOff(l => alternar(l, k))} style={{ ...linhaFiltro, opacity: on ? 1 : 0.45 }} {...hoverLinha}>
              <span style={{ width: 10, height: 10, borderRadius: 4, flexShrink: 0, background: TIPOS[k].cor }} />
              <span style={{ flex: 1, fontWeight: 500 }}>{TIPOS[k].label}</span>
              <Icon icon={on ? Eye : EyeOff} size={14} color={T.text.tertiary} />
            </button>
          )
        })}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={tituloSecao}>Status</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          <Chip ativo={filtroStatus === 'todos'} onClick={() => setFiltroStatus('todos')} style={{ height: 28, padding: '0 10px', fontSize: 12 }}>Todos</Chip>
          {STATUS_OPTS.map(s => (
            <Chip key={s.value} ativo={filtroStatus === s.value} onClick={() => setFiltroStatus(s.value)} style={{ height: 28, padding: '0 10px', fontSize: 12 }}>{s.label}</Chip>
          ))}
        </div>
      </div>

      {filtrosAtivos > 0 && (
        <Button variant="ghost" size="sm" onClick={limparFiltros} style={{ alignSelf: 'flex-start' }}>
          Limpar filtros ({filtrosAtivos})
        </Button>
      )}
    </div>
  )

  // ── Toolbar ──
  const renderToolbar = () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: isMobile ? 'wrap' : 'nowrap', flexShrink: 0, minWidth: 0 }}>
      <Button variant="secondary" onClick={irParaHoje}>Hoje</Button>
      <div style={{ display: 'flex', gap: 2 }}>
        <BotaoNav dir={-1} onClick={() => navegar(-1)} />
        <BotaoNav dir={1} onClick={() => navegar(1)} />
      </div>
      <h2 style={{ margin: 0, flex: 1, minWidth: 0, fontSize: 17, fontWeight: 700, letterSpacing: '-.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: T.text.primary }}>{tituloIntervalo}</h2>
      {isMobile && (
        <Button variant="secondary" icon={SlidersHorizontal} onClick={() => setFiltrosMobileOpen(true)}>
          Filtros{filtrosAtivos > 0 ? ` (${filtrosAtivos})` : ''}
        </Button>
      )}
      <div style={{ position: 'relative' }}>
        <Button variant="secondary" icon={Hourglass} onClick={() => setListaEsperaOpen(o => !o)}>
          Lista de espera
          {listaEspera.length > 0 && (
            <span style={{
              minWidth: 18, height: 18, padding: '0 5px', boxSizing: 'border-box', borderRadius: 9,
              background: T.brand.primaryLight, color: T.brand.primary, fontSize: 11, fontWeight: 700, lineHeight: '18px', textAlign: 'center',
            }}>{listaEspera.length}</span>
          )}
        </Button>
        {listaEsperaOpen && (
          <>
            <div onClick={() => setListaEsperaOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 49 }} />
            <div style={{
              position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 360, maxWidth: 'calc(100vw - 32px)',
              background: '#fff', border: `1px solid ${T.border.default}`, borderRadius: T.radius.xl,
              boxShadow: T.shadow.lg, padding: 8, zIndex: 50,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 4px 8px 8px' }}>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: T.text.primary }}>Lista de espera</span>
                <Button variant="ghost" size="sm" icon={Plus} onClick={abrirModalEspera} disabled={!!avisoEspera}>Adicionar</Button>
              </div>
              {avisoEspera && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 4px 6px', padding: '8px 10px', borderRadius: 10, background: T.status.warningBg, color: T.status.warning, fontSize: 12, fontWeight: 600 }}>
                  <Icon icon={TriangleAlert} size={14} />{avisoEspera}
                </div>
              )}
              {listaEspera.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '18px 12px 20px', textAlign: 'center' }}>
                  <IconTile icon={Hourglass} size={36} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: T.text.primary, marginTop: 4 }}>Ninguém aguardando</span>
                  <span style={{ fontSize: 12, color: T.text.quaternary, lineHeight: 1.45 }}>Adicione pacientes que querem um horário antes. Quando alguém cancelar, a agenda sugere quem chamar.</span>
                </div>
              ) : (
                <div style={{ maxHeight: 380, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                  {listaEspera.map((w: any, i: number) => {
                    const nome = w.pacientes?.nome || w.paciente_nome || w.nome || 'Paciente'
                    const prio = Number(w.prioridade) || 0
                    return (
                      <div key={w.id || i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 8, borderRadius: 10 }} {...hoverLinha}>
                        <Avatar nome={nome} size={30} />
                        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2, lineHeight: 1.3 }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: T.text.primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nome}</span>
                            {prio === 2 && <Badge tone="danger" style={{ padding: '1px 7px', fontSize: 10.5 }}>Urgente</Badge>}
                            {prio === 1 && <Badge tone="warning" style={{ padding: '1px 7px', fontSize: 10.5 }}>Alta</Badge>}
                            {w.status === 'oferecido' && <Badge tone="info" style={{ padding: '1px 7px', fontSize: 10.5 }}>Oferecido</Badge>}
                          </span>
                          <span style={{ fontSize: 11.5, color: T.text.quaternary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {resumoPreferencias(w)}{w.observacao ? ' · ' + w.observacao : ''}
                          </span>
                        </span>
                        <Button variant="ghost" size="sm" onClick={() => encaixarDaLista(w)}>Encaixar</Button>
                        <IconButton icon={Trash2} size={28} tone="danger" onClick={() => removerEspera(w)} aria-label={`Remover ${nome} da lista`} title="Remover da lista" />
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
      {!isMobile && (
        <SegmentedControl
          options={[{ value: 'dia', label: 'Dia' }, { value: 'semana', label: 'Semana' }, { value: 'mes', label: 'Mês' }]}
          value={viewMode}
          onChange={v => setViewMode(v)}
        />
      )}
      <IconButton icon={Ban} variant="outline" onClick={abrirModalBloqueio} title="Bloquear horário" />
      <Button icon={Plus} onClick={() => abrirModal()}>Novo</Button>
    </div>
  )

  // ── Bloco de evento na grade ──
  const renderEvento = (it: { ag: any; l: number; L: number }) => {
    const { ag, l, L } = it
    const d = new Date(ag.data_hora)
    const dur = Number(ag.duracao) || 30
    const fim = new Date(d.getTime() + dur * 60000)
    const tipo = tipoDe(ag.tipo)
    const cancelado = ag.status === 'cancelado'
    const apagado = cancelado || ag.status === 'realizado' || ag.status === 'faltou'
    const cor = cancelado ? T.text.tertiary : tipo.cor
    const pacNome = ag.pacientes?.nome || ag.paciente_nome || 'Encaixe'
    const h = dur * PX_MIN
    const umaLinha = h < 34
    const sub = (ag.motivo || tipo.label) + (multiProf && ag.medico_id ? ' · ' + nomeMedico(ag.medico_id) : '')
    // Confirmação: confirmado (check verde) · pendente (pontinho âmbar) · não confirmou a < 6h (âmbar com halo) · avisou que não vai (vermelho)
    const ativo = ag.status === 'agendado' || ag.status === 'confirmado'
    const confirmou = ag.status === 'confirmado' || ag.confirmacao_24h_status === 'confirmado'
    const recusou = ativo && ag.confirmacao_24h_status === 'nao_confirmado'
    const faltaMs = agora ? d.getTime() - agora.getTime() : Infinity
    const naoConfirmou = ativo && !confirmou && !recusou && faltaMs > 0 && faltaMs < 6 * HORA_MS
    const pendente = ativo && !confirmou && !recusou && !naoConfirmou && ag.confirmacao_24h_enviada && ag.confirmacao_24h_status === 'pendente'
    const ponto = recusou ? { cor: T.status.danger, halo: 'rgba(194,65,59,.22)', dica: 'Paciente avisou que não poderá ir' }
      : naoConfirmou ? { cor: T.status.warningAmber, halo: 'rgba(245,158,11,.28)', dica: 'Não confirmou — consulta em menos de 6h' }
      : pendente ? { cor: T.status.warningAmber, halo: '', dica: 'Confirmação pendente — lembrete de 24h enviado, sem resposta' }
      : null
    const temIndicadores = !!(ag.meet_link || ag.pre_consulta_enviada || (confirmou && !cancelado) || ponto)
    return (
      <div key={ag.id} style={{
        position: 'absolute', top: minToPx(d), height: h, left: `${(l / L) * 100}%`, width: `${100 / L}%`,
        padding: '1px 2px', boxSizing: 'border-box', zIndex: 10,
      }}>
        <button type="button"
          onClick={e => { e.stopPropagation(); abrirModal(undefined, ag) }}
          title={`${fmtHora(d)} – ${fmtHora(fim)} · ${pacNome}`}
          onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 6px 16px -8px rgba(28,27,34,.35)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
          onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none' }}
          style={{
            position: 'relative', width: '100%', height: '100%', boxSizing: 'border-box', overflow: 'hidden',
            display: 'flex', flexDirection: 'column', gap: 1, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
            padding: umaLinha ? '2px 6px 2px 7px' : '5px 7px 5px 8px', borderRadius: 9,
            background: cancelado ? T.bg.hover : tint(tipo.cor, 0.12),
            border: `1px solid ${cancelado ? T.border.default : tint(tipo.cor, 0.22)}`,
            borderLeft: `3px solid ${cor}`,
            opacity: cancelado ? 0.55 : apagado ? 0.65 : 1,
            transition: 'transform .15s, box-shadow .15s',
          }}>
          <span className="mono" style={{
            fontSize: 11, fontWeight: 700, color: cor, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            paddingRight: temIndicadores ? 30 : 0, lineHeight: umaLinha ? '14px' : 1.3,
          }}>
            {umaLinha ? `${fmtHora(d)} · ${pacNome.split(' ')[0]}` : `${fmtHora(d)} – ${fmtHora(fim)}`}
          </span>
          {!umaLinha && (
            <span style={{
              fontSize: 12, fontWeight: 600, color: T.text.primary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              textDecoration: cancelado ? 'line-through' : 'none',
            }}>{pacNome}</span>
          )}
          {h >= 50 && (
            <span style={{ fontSize: 11, color: T.text.secondary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</span>
          )}
          {temIndicadores && (
            <span style={{ position: 'absolute', top: umaLinha ? 2 : 5, right: 5, display: 'flex', gap: 3 }}>
              {ag.meet_link && <span title="Teleconsulta" style={{ display: 'inline-grid' }}><Video size={12} strokeWidth={1.8} color={cor} /></span>}
              {ag.pre_consulta_enviada && <span title="Pré-consulta enviada no WhatsApp" style={{ display: 'inline-grid' }}><MessageCircle size={12} strokeWidth={1.8} color={T.whatsapp.green} /></span>}
              {confirmou && !cancelado
                ? <span title="Paciente confirmou a consulta" style={{ display: 'inline-grid' }}><CheckCircle2 size={12} strokeWidth={1.8} color={T.status.success} /></span>
                : ponto
                  ? <span title={ponto.dica} aria-label={ponto.dica} style={{ display: 'inline-grid', placeItems: 'center', width: 12, height: 12 }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: ponto.cor, boxShadow: ponto.halo ? `0 0 0 2.5px ${ponto.halo}` : 'none' }} />
                    </span>
                  : null}
            </span>
          )}
        </button>
      </div>
    )
  }

  // ── Faixa de bloqueio na grade ──
  const renderBloqueio = (b: any, dia: Date) => {
    const dIni = new Date(b.data_inicio)
    const dFim = new Date(b.data_fim)
    // Se o bloqueio cobre o dia inteiro, ocupa a grade toda
    const ehDiaInteiro = dIni.getHours() === 0 && dFim.getHours() === 23 && dFim.getMinutes() === 59
    const top = ehDiaInteiro ? 0 : Math.max(0, minToPx(dIni))
    const fimPx = ehDiaInteiro ? ALTURA_GRADE : Math.min(ALTURA_GRADE, minToPx(dFim))
    const altura = fimPx - top
    if (altura <= 0) return null
    return (
      <div key={'blq-' + b.id + '-' + dia.toISOString()}
        title={b.motivo || 'Horário bloqueado'}
        onClick={e => { e.stopPropagation(); removerBloqueio(b.id) }}
        style={{
          position: 'absolute', left: 0, right: 0, top, height: altura, zIndex: 5, cursor: 'pointer', overflow: 'hidden',
          background: `repeating-linear-gradient(45deg, ${T.bg.hover}, ${T.bg.hover} 6px, ${T.border.muted} 6px, ${T.border.muted} 12px)`,
          borderTop: `1px solid ${T.border.default}`, borderBottom: `1px solid ${T.border.default}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 4, boxSizing: 'border-box',
        }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 5, maxWidth: '100%', boxSizing: 'border-box',
          fontSize: 11, fontWeight: 600, color: T.text.secondary, background: '#fff',
          padding: '3px 9px', borderRadius: 99, border: `1px solid ${T.border.default}`, whiteSpace: 'nowrap', overflow: 'hidden',
        }}>
          <Ban size={12} strokeWidth={1.6} style={{ flexShrink: 0 }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.motivo || 'Bloqueado'}</span>
        </span>
      </div>
    )
  }

  // ── Grade de horas (dia e semana) ──
  const renderGrade = (dias: Date[]) => {
    const horas = Array.from({ length: HORA_FIM - HORA_INI + 1 }, (_, i) => HORA_INI + i)
    const totalSlots = ((HORA_FIM - HORA_INI) * 60) / SLOT_MIN
    const agoraTop = agora ? minToPx(agora) : -1
    const mostrarAgora = agora !== null && agoraTop >= 0 && agoraTop <= ALTURA_GRADE
    return (
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', border: `1px solid ${T.border.default}`, borderRadius: T.radius['2xl'], overflow: 'hidden', background: '#fff' }}>
        {/* Cabeçalho dos dias */}
        <div style={{ display: 'flex', borderBottom: `1px solid ${T.border.default}`, background: '#fff', flexShrink: 0 }}>
          <div style={{ width: 56, flexShrink: 0 }} />
          {dias.map((dia, i) => {
            const hoje = isHoje(dia)
            const aniversariantes = pacientes.filter(p => ehAniversario(p.data_nascimento, dia)).length
            const nAgs = viewMode === 'dia' ? getAgsDia(dia).length : 0
            return (
              <button key={i} type="button"
                onClick={() => { setDiaSelecionado(dia); setSemana(dia); setViewMode('dia') }}
                style={{
                  flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  padding: '10px 0', border: 'none', borderLeft: `1px solid ${T.border.muted}`, cursor: 'pointer', fontFamily: 'inherit',
                  background: hoje ? T.brand.primarySoftBg : '#fff',
                }}>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', color: hoje ? T.brand.primary : '#9A98A5' }}>{DIAS_CURTOS[dowSeg(dia)]}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{
                    width: 32, height: 32, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 16, fontWeight: 700,
                    background: hoje ? T.brand.primary : 'transparent', color: hoje ? '#fff' : T.text.primary,
                  }}>{dia.getDate()}</span>
                  {aniversariantes > 0 && (
                    <span title={`${aniversariantes} aniversariante(s)`} style={{ display: 'inline-grid', color: T.data.pink }}>
                      <Gift size={14} strokeWidth={1.6} />
                    </span>
                  )}
                </span>
                {viewMode === 'dia' && (
                  <span style={{ fontSize: 11.5, color: T.text.quaternary }}>{nAgs} agendamento{nAgs !== 1 ? 's' : ''}</span>
                )}
              </button>
            )
          })}
        </div>

        {/* Corpo rolável */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          <div style={{ display: 'flex', position: 'relative', height: ALTURA_GRADE, margin: '8px 0' }}>
            <div style={{ width: 56, flexShrink: 0, position: 'relative' }}>
              {horas.map((h, i) => (
                <span key={h} className="mono" style={{
                  position: 'absolute', top: i * HORA_PX, right: 10, fontSize: 11, color: T.text.tertiary, transform: 'translateY(-50%)',
                }}>{String(h).padStart(2, '0')}:00</span>
              ))}
            </div>
            {dias.map((dia, di) => {
              const hoje = isHoje(dia)
              return (
                <div key={di} style={{
                  flex: 1, minWidth: 0, position: 'relative', borderLeft: `1px solid ${T.border.muted}`,
                  backgroundColor: hoje ? '#FBFAFF' : '#fff',
                  backgroundImage: `repeating-linear-gradient(to bottom, ${T.border.muted} 0 1px, transparent 1px ${HORA_PX}px)`,
                  borderBottom: `1px solid ${T.border.muted}`,
                }}>
                  {/* Fatias clicáveis de 15 min → novo agendamento */}
                  {Array.from({ length: totalSlots }, (_, i) => (
                    <div key={i}
                      onClick={() => { const d = new Date(dia); d.setHours(HORA_INI + Math.floor(i / 4), (i % 4) * 15, 0, 0); abrirModal(d) }}
                      onMouseOver={e => { e.currentTarget.style.background = tint(T.data.purple, 0.05) }}
                      onMouseOut={e => { e.currentTarget.style.background = 'transparent' }}
                      style={{ height: SLOT_PX, cursor: 'pointer', transition: 'background .1s' }} />
                  ))}
                  {calcularLanes(getAgsDia(dia)).map(renderEvento)}
                  {getBloqueiosDia(dia).map((b: any) => renderBloqueio(b, dia))}
                  {hoje && mostrarAgora && (
                    <div style={{ position: 'absolute', left: 0, right: 0, top: agoraTop, height: 2, background: T.brand.primary, zIndex: 20, pointerEvents: 'none' }}>
                      <span style={{ position: 'absolute', left: -5, top: -4, width: 10, height: 10, borderRadius: '50%', background: T.brand.primary }} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  // ── Visão mensal ──
  const renderGridMes = () => {
    const grid = getMonthGrid(mesVisualizado)
    const mesAtual = mesVisualizado.getMonth()
    return (
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', border: `1px solid ${T.border.default}`, borderRadius: T.radius['2xl'], background: '#fff' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', borderBottom: `1px solid ${T.border.default}` }}>
          {DIAS_CURTOS.map(l => (
            <span key={l} style={{ padding: '10px 0', textAlign: 'center', fontSize: 11, fontWeight: 700, letterSpacing: '.06em', color: '#9A98A5' }}>{l}</span>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
          {grid.map((d, i) => {
            const ags = [...getAgsDia(d)].sort((a, b) => new Date(a.data_hora).getTime() - new Date(b.data_hora).getTime())
            const fora = d.getMonth() !== mesAtual
            const hoje = isHoje(d)
            const bgBase = fora ? '#FBFBFC' : '#fff'
            return (
              <div key={i}
                onClick={() => { setDiaSelecionado(d); setSemana(d); setViewMode('dia') }}
                onMouseEnter={e => { e.currentTarget.style.background = '#FAF9FC' }}
                onMouseLeave={e => { e.currentTarget.style.background = bgBase }}
                style={{
                  minHeight: 108, padding: 8, boxSizing: 'border-box', cursor: 'pointer', minWidth: 0,
                  borderRight: i % 7 !== 6 ? `1px solid ${T.border.muted}` : 'none', borderBottom: `1px solid ${T.border.muted}`,
                  display: 'flex', flexDirection: 'column', gap: 4, background: bgBase, transition: 'background .12s',
                }}>
                <span style={{
                  alignSelf: 'flex-start', minWidth: 24, height: 24, padding: '0 4px', boxSizing: 'border-box', borderRadius: 12,
                  display: 'grid', placeItems: 'center', fontSize: 12.5, fontWeight: hoje ? 700 : 500,
                  background: hoje ? T.brand.primary : 'transparent', color: hoje ? '#fff' : fora ? '#C3C1CC' : T.text.strong,
                }}>{d.getDate()}</span>
                {ags.slice(0, 3).map(ag => {
                  const cancelado = ag.status === 'cancelado'
                  return (
                    <span key={ag.id}
                      onClick={e => { e.stopPropagation(); abrirModal(undefined, ag) }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: T.text.strong, whiteSpace: 'nowrap', overflow: 'hidden',
                        opacity: cancelado ? 0.55 : 1, textDecoration: cancelado ? 'line-through' : 'none', borderRadius: 4,
                      }}>
                      <span style={{ width: 6, height: 6, borderRadius: 2, flexShrink: 0, background: cancelado ? T.text.tertiary : tipoDe(ag.tipo).cor }} />
                      <span className="mono" style={{ color: T.text.quaternary }}>{fmtHora(new Date(ag.data_hora))}</span>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{(ag.pacientes?.nome || ag.paciente_nome || 'Encaixe').split(' ')[0]}</span>
                    </span>
                  )
                })}
                {ags.length > 3 && <span style={{ fontSize: 11, fontWeight: 600, color: T.brand.primary }}>+{ags.length - 3} mais</span>}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ── Modal: detalhes da consulta ──
  const renderDetalhes = () => {
    const ag = modal.ag
    const d = new Date(ag.data_hora)
    const dur = Number(ag.duracao) || 30
    const fim = new Date(d.getTime() + dur * 60000)
    const tipo = tipoDe(ag.tipo)
    const pacNome = ag.pacientes?.nome || ag.paciente_nome || 'Encaixe'
    const st = STATUS_BADGE[ag.status] || { label: cap(ag.status || 'agendado'), tone: 'neutral' as BadgeTone }
    const prof = nomeMedico(ag.medico_id)
    const preOk = preConsultaEnviada || ag.pre_consulta_enviada
    const tile: React.CSSProperties = { padding: 12, borderRadius: 12, background: T.bg.page, display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }
    const tileLabel: React.CSSProperties = { fontSize: 11.5, color: T.text.quaternary }
    const tileValor: React.CSSProperties = { fontSize: 13.5, fontWeight: 600, color: T.text.primary }
    return (
      <Modal titulo="Detalhes da consulta" onClose={fecharModal} largura={480}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Avatar nome={pacNome} size={44} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: T.text.primary }}>{pacNome}</div>
              <div style={{ fontSize: 12.5, color: T.text.quaternary, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: 3, background: tipo.cor, flexShrink: 0 }} />
                {tipo.label}{prof ? ' · ' + prof : ''}
              </div>
            </div>
            <Badge tone={st.tone}>{st.label}</Badge>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
            <div style={tile}>
              <span style={tileLabel}>Data</span>
              <span style={tileValor}>{cap(d.toLocaleDateString('pt-BR', { weekday: 'long' }))}, {d.getDate()} {MESES_AB[d.getMonth()]}</span>
            </div>
            <div style={tile}>
              <span style={tileLabel}>Horário</span>
              <span className="mono" style={tileValor}>{fmtHora(d)} – {fmtHora(fim)}</span>
            </div>
            {ag.motivo && (
              <div style={{ ...tile, gridColumn: '1 / -1' }}>
                <span style={tileLabel}>Motivo</span>
                <span style={{ ...tileValor, fontWeight: 500 }}>{ag.motivo}</span>
              </div>
            )}
            {ag.observacoes && (
              <div style={{ ...tile, gridColumn: '1 / -1' }}>
                <span style={tileLabel}>Observações</span>
                <span style={{ ...tileValor, fontWeight: 500, whiteSpace: 'pre-wrap' }}>{ag.observacoes}</span>
              </div>
            )}
          </div>

          {(() => {
            if (ag.status !== 'agendado' && ag.status !== 'confirmado') return null
            const cs = ag.confirmacao_24h_status
            const conf = ag.status === 'confirmado' || cs === 'confirmado'
              ? { cor: T.status.success, texto: 'Presença confirmada' + (ag.confirmado_via === 'whatsapp' ? ' pelo WhatsApp' : ag.confirmado_via === 'manual' ? ' manualmente' : '') }
              : cs === 'nao_confirmado' ? { cor: T.status.danger, texto: 'Paciente avisou que não poderá ir' }
              : cs === 'reagendou' ? { cor: T.status.info, texto: 'Paciente pediu para remarcar' }
              : cs === 'erro_envio' ? { cor: T.status.danger, texto: 'Falha ao enviar a confirmação de 24h' }
              : cs === 'pendente' ? { cor: T.status.warningAmber, texto: 'Confirmação de 24h enviada, aguardando resposta' }
              : ag.lembrete_48h_enviado ? { cor: T.text.tertiary, texto: 'Lembrete de 48h enviado' }
              : null
            if (!conf) return null
            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: T.text.secondary }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: conf.cor, flexShrink: 0 }} />
                {conf.texto}
              </div>
            )
          })()}

          {ag.meet_link && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12, border: `1px solid ${T.border.default}` }}>
              <IconTile icon={Video} size={32} radius={10} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.text.primary }}>Teleconsulta</div>
                <div style={{ fontSize: 11.5, color: T.text.quaternary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ag.meet_link}</div>
              </div>
              <Button variant="secondary" size="sm" onClick={() => window.open(ag.meet_link, '_blank')}>Abrir sala</Button>
            </div>
          )}

          {ag.paciente_id && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12,
              background: preOk ? T.status.successBg : T.brand.primarySoftBg,
              border: `1px solid ${preOk ? 'transparent' : T.brand.primaryAccentLight}`,
            }}>
              <IconTile icon={MessageCircle} size={32} radius={10} color={preOk ? T.status.success : T.brand.primary} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: preOk ? T.status.success : T.text.primary }}>Pré-consulta no WhatsApp</div>
                <div style={{ fontSize: 11.5, color: T.text.quaternary }}>{preOk ? 'Perguntas enviadas ao paciente' : 'Enviar perguntas antes da consulta'}</div>
              </div>
              {!preOk && (
                <Button variant="secondary" size="sm" onClick={() => enviarPreConsulta(ag.id)} disabled={enviandoPreConsulta}>
                  {enviandoPreConsulta ? 'Enviando…' : 'Enviar'}
                </Button>
              )}
            </div>
          )}

          {(ag.status !== 'confirmado' || (ag.status !== 'realizado' && ag.status !== 'faltou')) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: T.text.secondary, marginRight: 4 }}>Marcar como</span>
              {ag.status !== 'confirmado' && (
                <Chip onClick={() => { atualizarStatus(ag.id, 'confirmado'); setModal(m => ({ ...m, ag: { ...m.ag, status: 'confirmado' } })) }} icon={Check}>Confirmado</Chip>
              )}
              {ag.status !== 'realizado' && ag.status !== 'faltou' && (
                <Chip onClick={() => setSubmodalRealizado(true)} icon={CheckCircle2}>Realizado</Chip>
              )}
              {ag.status !== 'realizado' && ag.status !== 'faltou' && ag.status !== 'cancelado' && (
                <Chip onClick={() => { atualizarStatus(ag.id, 'faltou'); fecharModal() }} icon={X}>Faltou</Chip>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button icon={Mic} style={{ flex: 1 }} onClick={() => {
              const params = new URLSearchParams()
              if (ag.paciente_id) params.set('paciente_id', ag.paciente_id)
              if (ag.pacientes?.nome) params.set('paciente_nome', ag.pacientes.nome)
              if (ag.pacientes?.telefone) params.set('paciente_tel', ag.pacientes.telefone || '')
              router.push('/nova-consulta?' + params.toString())
            }}>Iniciar consulta</Button>
            <Button variant="secondary" icon={CalendarClock} onClick={() => setEditando(true)}>Remarcar</Button>
            {ag.status !== 'cancelado' && ag.status !== 'realizado' && (
              <Button variant="danger" onClick={() => { atualizarStatus(ag.id, 'cancelado'); fecharModal() }}>Cancelar</Button>
            )}
            <IconButton icon={Trash2} tone="danger" variant="outline" onClick={() => deletar(ag.id)} aria-label="Excluir agendamento" title="Excluir agendamento" />
          </div>
        </div>
      </Modal>
    )
  }

  // ── Modal: novo agendamento / editar ──
  const renderFormulario = () => {
    const ehAdminClinica = typeof window !== 'undefined' && !!localStorage.getItem('clinica_admin')
    const duracoes = [
      { value: '15', label: '15 min' }, { value: '30', label: '30 min' }, { value: '45', label: '45 min' },
      { value: '60', label: '1 hora' }, { value: '90', label: '1h30' },
    ]
    const durAtual = String(form.duracao || '30')
    if (!duracoes.some(o => o.value === durAtual)) duracoes.push({ value: durAtual, label: durAtual + ' min' })
    return (
      <Modal titulo={modal.ag ? 'Editar agendamento' : 'Novo agendamento'} onClose={fecharModal} largura={520}>
        <form onSubmit={salvar} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label="Paciente" hint={!form.paciente_id ? 'Deixe em branco para criar um encaixe rápido' : undefined}>
            <Select value={form.paciente_id} onChange={e => setForm(f => ({ ...f, paciente_id: e.target.value }))}>
              <option value="">Selecionar paciente (opcional)</option>
              {pacientes.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </Select>
          </Field>

          <Field label="Tipo">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {(Object.keys(TIPOS) as TipoKey[]).map(k => {
                const on = form.tipo === k
                return (
                  <button key={k} type="button" onClick={() => setForm(f => ({ ...f, tipo: k }))}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 12px', borderRadius: 10, cursor: 'pointer',
                      fontFamily: 'inherit', fontSize: 12.5, fontWeight: 600, transition: 'all .15s',
                      border: `1px solid ${on ? T.brand.primary : T.border.default}`,
                      background: on ? T.brand.primary : '#fff', color: on ? '#fff' : T.text.muted,
                    }}>
                    <span style={{ width: 8, height: 8, borderRadius: 3, background: on ? '#fff' : TIPOS[k].cor }} />
                    {TIPOS[k].label}
                  </button>
                )
              })}
            </div>
          </Field>

          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <Field label="Data e hora" style={{ flex: '1 1 200px' }}>
              <Input type="datetime-local" required value={form.data_hora} onChange={e => setForm(f => ({ ...f, data_hora: e.target.value }))} />
            </Field>
            <Field label="Duração">
              <SegmentedControl size="sm" options={duracoes} value={durAtual} onChange={v => setForm(f => ({ ...f, duracao: v }))} style={{ padding: 4 }} />
            </Field>
          </div>

          {/* Profissional — read-only se médico logado, lista se admin da clínica */}
          {!ehAdminClinica ? (
            <Field label="Profissional">
              <div style={{
                minHeight: 40, padding: '0 12px', fontSize: 13.5, borderRadius: T.radius.input, background: T.bg.page,
                color: T.text.primary, border: `1px solid ${T.border.default}`, display: 'flex', alignItems: 'center', gap: 8, boxSizing: 'border-box',
              }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: medico?.cor || T.brand.primary }} />
                Dr(a). {medico?.nome || '...'}
              </div>
            </Field>
          ) : (
            <Field label="Profissional">
              <Select value={form.medico_id} onChange={e => setForm(f => ({ ...f, medico_id: e.target.value }))}>
                <option value="">Selecionar médico</option>
                {medicosClinica.filter((m: any) => (m.cargo === 'medico' || m.cargo === 'admin' || !m.cargo) && m.ativo !== false).map((m: any) => (
                  <option key={m.id} value={m.id}>Dr(a). {m.nome}</option>
                ))}
              </Select>
            </Field>
          )}

          {procedimentos.length > 0 && (
            <Field label="Procedimento">
              <Select
                value={form.procedimento_id}
                onChange={e => {
                  const procId = e.target.value
                  const proc = procedimentos.find((p: any) => p.id === procId)
                  // Auto-preenche duração se procedimento tem duração definida
                  setForm(f => ({
                    ...f,
                    procedimento_id: procId,
                    duracao: proc?.duracao ? String(proc.duracao) : f.duracao,
                  }))
                }}>
                <option value="">Nenhum (consulta padrão)</option>
                {procedimentos.map((p: any) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}{p.duracao ? ' · ' + p.duracao + 'min' : ''}{p.valor ? ' · R$ ' + Number(p.valor).toFixed(2).replace('.', ',') : ''}
                  </option>
                ))}
              </Select>
            </Field>
          )}

          <Field label="Motivo">
            <Input value={form.motivo} onChange={e => setForm(f => ({ ...f, motivo: e.target.value }))} placeholder="Ex.: consulta de rotina, dor abdominal…" />
          </Field>
          <Field label="Observações">
            <Textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))}
              style={{ minHeight: 64, resize: 'none' }} placeholder="Observações adicionais…" />
          </Field>

          {!modal.ag && !salaLink && (
            <button type="button" onClick={criarSalaAgora}
              onMouseEnter={e => { e.currentTarget.style.borderColor = T.brand.primaryAccent; e.currentTarget.style.background = T.brand.primarySoftBg }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = T.border.default; e.currentTarget.style.background = '#fff' }}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 12px', background: '#fff',
                border: `1px solid ${T.border.default}`, borderRadius: 12, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', transition: 'all .15s',
              }}>
              <IconTile icon={Video} size={32} radius={10} />
              <span style={{ fontSize: 13, fontWeight: 600, color: T.brand.primary }}>Adicionar videoconferência</span>
            </button>
          )}
          {!modal.ag && salaLink && (
            <div style={{ background: T.brand.primarySoftBg, border: `1px solid ${T.brand.primaryAccentLight}`, borderRadius: 12, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <IconTile icon={Video} size={32} radius={10} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: T.brand.primary, margin: '0 0 2px' }}>Sala de vídeo criada</p>
                  <p style={{ fontSize: 11.5, color: T.text.secondary, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{salaLink}</p>
                </div>
                <IconButton icon={X} size={30} onClick={removerSala} title="Remover sala" aria-label="Remover sala" type="button" />
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <Button type="button" variant="secondary" size="sm" icon={Copy} onClick={copiarLinkSala} style={{ flex: 1 }}>Copiar link</Button>
                <Button type="button" variant="secondary" size="sm" icon={MessageCircle} onClick={enviarSalaWhatsApp} style={{ flex: 1, color: T.status.success }}>WhatsApp</Button>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 4 }}>
            <Button type="button" variant="secondary" onClick={() => modal.ag ? setEditando(false) : fecharModal()}>
              {modal.ag ? 'Voltar' : 'Cancelar'}
            </Button>
            <Button type="submit" disabled={salvando} icon={modal.ag ? undefined : Calendar}>
              {salvando ? 'Salvando…' : modal.ag ? 'Salvar alterações' : 'Criar agendamento'}
            </Button>
          </div>
        </form>
      </Modal>
    )
  }

  // ── Modal: bloquear horário ──
  const renderModalBloqueio = () => (
    <Modal titulo="Bloquear horário" onClose={() => setModalBloqueio(false)} largura={520}
      rodape={<>
        <Button variant="secondary" onClick={() => setModalBloqueio(false)}>Cancelar</Button>
        <Button icon={Ban} onClick={salvarBloqueio} disabled={salvandoBloqueio}>{salvandoBloqueio ? 'Bloqueando…' : 'Bloquear'}</Button>
      </>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <p style={{ margin: 0, fontSize: 12.5, color: T.text.quaternary }}>Impede agendamentos nesse período.</p>

        <Field label="Médico">
          <Select value={formBloqueio.medico_id} onChange={e => setFormBloqueio(p => ({ ...p, medico_id: e.target.value }))}>
            <option value="">Selecionar médico</option>
            {medicosClinica.map(m => <option key={m.id} value={m.id}>Dr(a). {m.nome}</option>)}
          </Select>
        </Field>

        <Field label="Tipo">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
            {([
              { v: 'horario', label: 'Horário', sub: 'Só algumas horas' },
              { v: 'dia', label: 'Dia inteiro', sub: 'O dia todo' },
              { v: 'periodo', label: 'Período', sub: 'Vários dias' },
            ] as const).map(t => {
              const on = formBloqueio.tipo === t.v
              return (
                <button key={t.v} type="button" onClick={() => setFormBloqueio(p => ({ ...p, tipo: t.v }))}
                  style={{
                    padding: '10px 12px', borderRadius: 12, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
                    border: `1px solid ${on ? T.brand.primary : T.border.default}`, background: on ? T.brand.primarySoftBg : '#fff',
                    transition: 'all .15s',
                  }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: on ? T.brand.primary : T.text.primary, margin: 0 }}>{t.label}</p>
                  <p style={{ fontSize: 11.5, color: T.text.quaternary, margin: '2px 0 0' }}>{t.sub}</p>
                </button>
              )
            })}
          </div>
        </Field>

        {formBloqueio.tipo === 'horario' && (
          <>
            <Field label="Data">
              <Input type="date" value={formBloqueio.data} onChange={e => setFormBloqueio(p => ({ ...p, data: e.target.value }))} />
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Field label="Das">
                <Input type="time" value={formBloqueio.hora_inicio} onChange={e => setFormBloqueio(p => ({ ...p, hora_inicio: e.target.value }))} />
              </Field>
              <Field label="Até">
                <Input type="time" value={formBloqueio.hora_fim} onChange={e => setFormBloqueio(p => ({ ...p, hora_fim: e.target.value }))} />
              </Field>
            </div>
          </>
        )}

        {formBloqueio.tipo === 'dia' && (
          <Field label="Data" hint="Dia inteiro indisponível">
            <Input type="date" value={formBloqueio.data} onChange={e => setFormBloqueio(p => ({ ...p, data: e.target.value }))} />
          </Field>
        )}

        {formBloqueio.tipo === 'periodo' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label="De">
              <Input type="date" value={formBloqueio.data_inicio} onChange={e => setFormBloqueio(p => ({ ...p, data_inicio: e.target.value }))} />
            </Field>
            <Field label="Até">
              <Input type="date" value={formBloqueio.data_fim} onChange={e => setFormBloqueio(p => ({ ...p, data_fim: e.target.value }))} />
            </Field>
          </div>
        )}

        <Field label="Motivo (opcional)">
          <Input value={formBloqueio.motivo} onChange={e => setFormBloqueio(p => ({ ...p, motivo: e.target.value }))} placeholder="Ex.: almoço, reunião, férias…" />
        </Field>

        {/* Recorrência (só para horário/dia) */}
        {(formBloqueio.tipo === 'horario' || formBloqueio.tipo === 'dia') && (
          <div style={{ background: T.bg.page, borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Checkbox
              checked={formBloqueio.recorrente}
              onChange={v => setFormBloqueio(p => ({ ...p, recorrente: v }))}
              label={<span style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: T.text.primary }}>Repetir semanalmente</span>
                <span style={{ fontSize: 11.5, color: T.text.quaternary }}>Bloqueio toda semana nos dias escolhidos</span>
              </span>}
            />
            {formBloqueio.recorrente && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {([
                  { v: '1', label: 'S' }, { v: '2', label: 'T' }, { v: '3', label: 'Q' }, { v: '4', label: 'Q' },
                  { v: '5', label: 'S' }, { v: '6', label: 'S' }, { v: '0', label: 'D' },
                ] as const).map(d => {
                  const ativo = formBloqueio.dias_semana.includes(d.v)
                  return (
                    <button key={d.v} type="button"
                      onClick={() => setFormBloqueio(p => ({
                        ...p,
                        dias_semana: ativo ? p.dias_semana.filter(x => x !== d.v) : [...p.dias_semana, d.v],
                      }))}
                      style={{
                        width: 36, height: 36, borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
                        border: `1px solid ${ativo ? T.brand.primary : T.border.default}`,
                        background: ativo ? T.brand.primary : '#fff', color: ativo ? '#fff' : T.text.secondary,
                      }}>{d.label}</button>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  )

  // ── Aviso: horário liberado → sugestões da lista de espera ──
  const renderVagaLiberada = () => {
    if (!vagaLiberada) return null
    const { ag, sugestoes } = vagaLiberada
    const d = new Date(ag.data_hora)
    const prof = multiProf ? nomeMedico(ag.medico_id) : ''
    return (
      <div role="dialog" aria-label="Horário liberado" style={{
        position: 'fixed', zIndex: 150, bottom: isMobile ? 12 : 24, right: isMobile ? 12 : 24, left: isMobile ? 12 : 'auto',
        width: isMobile ? 'auto' : 400, background: '#fff', border: `1px solid ${T.border.default}`, borderRadius: T.radius.xl,
        boxShadow: T.shadow.lg, padding: 14, display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <IconTile icon={Hourglass} size={34} radius={10} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.text.primary }}>Horário liberado</div>
            <div style={{ fontSize: 12.5, color: T.text.quaternary }}>
              {cap(d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }).replace('.', ''))} · <span className="mono" style={{ color: T.text.strong }}>{fmtHora(d)}</span>
              {prof ? ' · ' + prof : ''} — quem da lista pode vir:
            </div>
          </div>
          <IconButton icon={X} size={28} onClick={() => setVagaLiberada(null)} aria-label="Fechar" />
        </div>
        {sugestoes.map((w: any) => {
          const nome = w.nome || 'Paciente'
          const oferecido = w.status === 'oferecido'
          return (
            <div key={w.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 12, border: `1px solid ${T.border.default}`, flexWrap: 'wrap' }}>
              <Avatar nome={nome} size={30} />
              <div style={{ flex: '1 1 140px', minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: T.text.primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nome}</span>
                  {Number(w.prioridade) === 2 && <Badge tone="danger" style={{ padding: '1px 7px', fontSize: 10.5 }}>Urgente</Badge>}
                  {Number(w.prioridade) === 1 && <Badge tone="warning" style={{ padding: '1px 7px', fontSize: 10.5 }}>Alta</Badge>}
                </div>
                <div style={{ fontSize: 11.5, color: T.text.quaternary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{resumoPreferencias(w)}</div>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                {oferecido
                  ? <Badge tone="info" icon={Send}>Oferecido</Badge>
                  : <Button variant="secondary" size="sm" icon={Send} disabled={oferecendo === w.id || (!w.telefone && !w.paciente_id)}
                      title={!w.telefone && !w.paciente_id ? 'Sem telefone' : undefined}
                      onClick={() => oferecerHorario(w, ag)}>{oferecendo === w.id ? 'Enviando…' : 'Oferecer horário'}</Button>}
                <Button variant="ghost" size="sm" onClick={() => encaixarDaLista(w, d, ag)}>Encaixar</Button>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // ── Modal: adicionar à lista de espera ──
  const renderModalEspera = () => {
    const f = formEspera
    const setF = (campos: Partial<typeof FORM_ESPERA_VAZIO>) => setFormEspera(p => ({ ...p, ...campos }))
    return (
      <Modal titulo="Adicionar à lista de espera" onClose={() => setModalEspera(false)} largura={500}
        rodape={<>
          <Button variant="secondary" onClick={() => setModalEspera(false)}>Cancelar</Button>
          <Button icon={Plus} onClick={salvarEspera} disabled={salvandoEspera}>{salvandoEspera ? 'Salvando…' : 'Adicionar'}</Button>
        </>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <SegmentedControl stretch value={f.modo} onChange={v => setF({ modo: v })}
            options={[{ value: 'paciente', label: 'Paciente cadastrado' }, { value: 'contato', label: 'Novo contato' }]} />
          {f.modo === 'paciente' ? (
            <Field label="Paciente">
              <Select value={f.paciente_id} onChange={e => {
                const p = pacientes.find((x: any) => x.id === e.target.value)
                setF({ paciente_id: e.target.value, medico_id: multiProf && p?.medico_id ? p.medico_id : f.medico_id })
              }}>
                <option value="">Selecionar paciente</option>
                {pacientes.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </Select>
            </Field>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
              <Field label="Nome"><Input value={f.nome} onChange={e => setF({ nome: e.target.value })} placeholder="Nome do paciente" /></Field>
              <Field label="WhatsApp"><Input value={f.telefone} onChange={e => setF({ telefone: e.target.value })} placeholder="(11) 99999-9999" inputMode="tel" /></Field>
            </div>
          )}
          {multiProf && (
            <Field label="Profissional">
              <Select value={f.medico_id} onChange={e => setF({ medico_id: e.target.value })}>
                {profs.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </Select>
            </Field>
          )}
          <Field label="Tipo">
            <SegmentedControl stretch size="sm" value={f.tipo} onChange={v => setF({ tipo: v })} options={TIPOS_ESPERA.map(t => ({ value: t.value as string, label: t.label }))} />
          </Field>
          <Field label="Dias preferidos" hint="Nenhum marcado = qualquer dia">
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {DIAS_ESPERA.map(dia => {
                const on = f.preferencia_dias.includes(dia)
                return (
                  <button key={dia} type="button" aria-pressed={on}
                    onClick={() => setF({ preferencia_dias: on ? f.preferencia_dias.filter(x => x !== dia) : [...f.preferencia_dias, dia] })}
                    style={{
                      minWidth: 44, height: 34, padding: '0 8px', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 600,
                      border: `1px solid ${on ? T.brand.primary : T.border.default}`,
                      background: on ? T.brand.primary : '#fff', color: on ? '#fff' : T.text.secondary,
                    }}>{DIAS_SEMANA_CURTOS[dia]}</button>
                )
              })}
            </div>
          </Field>
          <Field label="Período">
            <SegmentedControl stretch size="sm" value={f.preferencia_periodo} onChange={v => setF({ preferencia_periodo: v })} options={PERIODOS.map(p => ({ value: p.value as string, label: p.label }))} />
          </Field>
          <Field label="Prioridade">
            <SegmentedControl stretch size="sm" value={f.prioridade} onChange={v => setF({ prioridade: v })} options={PRIORIDADES} />
          </Field>
          <Field label="Observação (opcional)">
            <Input value={f.observacao} onChange={e => setF({ observacao: e.target.value })} placeholder="Ex.: prefere primeiro horário, dor há 2 semanas…" />
          </Field>
        </div>
      </Modal>
    )
  }

  return (
    <div style={{
      height: '100%', boxSizing: 'border-box', padding: isMobile ? 12 : 20,
      display: 'grid', gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : '236px minmax(0, 1fr)', gridTemplateRows: 'minmax(0, 1fr)', gap: 24,
    }}>
      {!isMobile && (
        <aside style={{ minWidth: 0, minHeight: 0, overflowY: 'auto', overflowX: 'hidden' }}>
          {renderFiltros(false)}
        </aside>
      )}
      <div style={{ minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {renderToolbar()}
        {viewMode === 'semana' && renderGrade(diasSemana)}
        {viewMode === 'dia' && renderGrade([diaSelecionado])}
        {viewMode === 'mes' && renderGridMes()}
      </div>

      {/* Bottom sheet de filtros (mobile) */}
      {filtrosMobileOpen && isMobile && (
        <>
          <div onClick={() => setFiltrosMobileOpen(false)} style={{ position: 'fixed', inset: 0, background: T.bg.overlay, zIndex: 80 }} />
          <div style={{
            position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 81,
            background: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, boxShadow: T.shadow.modal,
            maxHeight: '85vh', overflowY: 'auto',
            paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
            animation: 'slideUpAgenda 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 6px' }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: T.border.strong }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 16px 12px' }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: T.text.primary, margin: 0 }}>Filtros e calendário</h3>
              <IconButton icon={X} size={32} onClick={() => setFiltrosMobileOpen(false)} aria-label="Fechar" />
            </div>
            <div style={{ padding: '0 16px' }}>
              {renderFiltros(true)}
            </div>
            <style dangerouslySetInnerHTML={{ __html: `@keyframes slideUpAgenda { from { transform: translateY(100%); } to { transform: translateY(0); } }` }} />
          </div>
        </>
      )}

      {modalBloqueio && renderModalBloqueio()}
      {modalEspera && renderModalEspera()}
      {!modal.open && renderVagaLiberada()}

      {modal.open && (modal.ag && !editando ? renderDetalhes() : renderFormulario())}

      {/* Renderizado depois do modal principal para ficar por cima */}
      {submodalRealizado && modal.ag && (
        <SubModalRealizado
          ag={modal.ag}
          onClose={() => setSubmodalRealizado(false)}
          onSaved={() => {
            setSubmodalRealizado(false)
            setModal({ open: false })
            window.location.reload()
          }}
        />
      )}
    </div>
  )
}

export default function Agenda() {
  return (
    <Suspense fallback={<div style={{ padding: 24, fontSize: 13.5, color: T.text.quaternary }}>Carregando agenda…</div>}>
      <AgendaContent />
    </Suspense>
  )
}


// ============================================
// SUBMODAL: Marcar como realizado (gera receita)
// ============================================

function SubModalRealizado({ ag, onClose, onSaved }: { ag: any; onClose: () => void; onSaved: () => void }) {
  const [valor, setValor] = useState('')
  const [valorSugestao, setValorSugestao] = useState<number | null>(null)
  const [metodoPag, setMetodoPag] = useState('pix')
  const [statusPag, setStatusPag] = useState<'recebido' | 'pendente'>('recebido')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [carregandoSugestao, setCarregandoSugestao] = useState(true)

  useEffect(() => {
    (async () => {
      // Busca valor do procedimento vinculado ao agendamento (se tiver)
      if (ag.procedimento_id) {
        const { data: proc } = await supabase.from('procedimentos').select('valor, nome').eq('id', ag.procedimento_id).maybeSingle()
        if (proc?.valor) {
          setValorSugestao(Number(proc.valor))
          setValor(String(proc.valor).replace('.', ','))
        }
      }
      setCarregandoSugestao(false)
    })()
  }, [ag])

  const salvar = async () => {
    setErro('')
    const valorNum = parseFloat(valor.replace(',', '.'))
    if (isNaN(valorNum) || valorNum < 0) { setErro('Valor inválido'); return }

    setSalvando(true)

    // 1. Atualiza agendamento pra status realizado
    const { error: errAg } = await supabase.from('agendamentos').update({ status: 'realizado' }).eq('id', ag.id)
    if (errAg) { setErro('Erro ao atualizar agendamento: ' + errAg.message); setSalvando(false); return }

    // 1.5 Verifica se paciente tem pacote ativo - se tiver, consome 1 sessao automaticamente
    let pacoteConsumido = null
    if (ag.paciente_id) {
      const { data: pacotes } = await supabase.from('financeiro_pacotes')
        .select('*').eq('paciente_id', ag.paciente_id).eq('status', 'ativo')
        .order('criado_em', { ascending: true }).limit(1)
      const pacote = pacotes?.[0]
      if (pacote && pacote.sessoes_usadas < pacote.total_sessoes) {
        const novasSessoes = pacote.sessoes_usadas + 1
        const novoStatus = novasSessoes >= pacote.total_sessoes ? 'concluido' : 'ativo'
        await supabase.from('financeiro_pacotes')
          .update({ sessoes_usadas: novasSessoes, status: novoStatus, atualizado_em: new Date().toISOString() })
          .eq('id', pacote.id)
        pacoteConsumido = pacote
      }
    }

    // 2. Cria movimentacao financeira (se valor > 0)
    if (valorNum > 0) {
      // Busca clinica_id via medico (agendamentos nao tem clinica_id direto)
      let clinicaId: string | null = null
      if (ag.medico_id) {
        const { data: med } = await supabase.from('medicos').select('clinica_id').eq('id', ag.medico_id).maybeSingle()
        clinicaId = med?.clinica_id || null
      }

      if (clinicaId) {
        const { data: cats } = await supabase.from('financeiro_categorias')
          .select('id').eq('clinica_id', clinicaId).eq('tipo', 'receita').eq('ativo', true).order('nome').limit(20)
        const catConsulta = cats?.find((c: any) => false) // placeholder, vai ser sobrescrito abaixo
        // Procurar categoria "Consulta" pelo nome
        const { data: catC } = await supabase.from('financeiro_categorias')
          .select('id').eq('clinica_id', clinicaId).eq('tipo', 'receita').eq('ativo', true).ilike('nome', 'Consulta').maybeSingle()

        const descricaoBase = ag.titulo || ag.tipo || 'Consulta'
        const pacNome = ag.pacientes?.nome || ''

        const { error: errMov } = await supabase.from('financeiro_movimentacoes').insert({
          clinica_id: clinicaId,
          tipo: 'receita',
          valor: valorNum,
          descricao: pacNome ? `${descricaoBase} - ${pacNome}` : descricaoBase,
          data_movimentacao: ag.data_hora ? ag.data_hora.substring(0, 10) : new Date().toISOString().substring(0, 10),
          categoria_id: catC?.id || (cats?.[0]?.id ?? null),
          metodo_pagamento: metodoPag,
          status: statusPag,
          paciente_id: ag.paciente_id || null,
          medico_id: ag.medico_id || null,
          agendamento_id: ag.id,
        })
        if (errMov) { setErro('Erro ao criar movimentação financeira: ' + errMov.message); setSalvando(false); return }
      }
    }

    setSalvando(false)
    onSaved()
  }


  return (
    <Modal titulo="Marcar como realizada" onClose={onClose} largura={440}
      rodape={<>
        <Button variant="secondary" onClick={onClose} disabled={salvando}>Cancelar</Button>
        <Button icon={Check} onClick={salvar} disabled={salvando}>{salvando ? 'Salvando…' : 'Confirmar e gerar receita'}</Button>
      </>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <p style={{ fontSize: 13, color: T.text.quaternary, margin: 0, lineHeight: 1.45 }}>Quanto foi cobrado nessa consulta? Vamos lançar no financeiro.</p>

        <Field label="Valor cobrado" hint={valorSugestao !== null
          ? `Valor sugerido pelo procedimento (R$ ${valorSugestao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})`
          : 'Vincule um procedimento ao agendamento para sugestão automática'}>
          <div style={{ position: 'relative' }}>
            <span className="mono" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: T.text.tertiary, fontSize: 13 }}>R$</span>
            <Input type="text" value={valor} onChange={e => setValor(e.target.value.replace(/[^0-9,]/g, ''))}
              placeholder={carregandoSugestao ? 'Carregando sugestão…' : '0,00'}
              style={{ paddingLeft: 40, fontWeight: 600 }} autoFocus />
          </div>
        </Field>

        <Field label="Forma de pagamento">
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {[
              { v: 'pix', l: 'PIX' },
              { v: 'cartao_credito', l: 'Cartão crédito' },
              { v: 'cartao_debito', l: 'Cartão débito' },
              { v: 'dinheiro', l: 'Dinheiro' },
              { v: 'transferencia', l: 'Transferência' },
              { v: 'boleto', l: 'Boleto' },
            ].map(o => (
              <Chip key={o.v} ativo={metodoPag === o.v} onClick={() => setMetodoPag(o.v)}>{o.l}</Chip>
            ))}
          </div>
        </Field>

        <Field label="Status do pagamento">
          <SegmentedControl stretch
            options={[{ value: 'recebido', label: 'Já recebido' }, { value: 'pendente', label: 'Aguardando' }]}
            value={statusPag}
            onChange={v => setStatusPag(v)} />
        </Field>

        {erro && (
          <div style={{ background: T.status.dangerBg, color: T.status.danger, padding: '10px 12px', borderRadius: 10, fontSize: 12.5 }}>{erro}</div>
        )}
      </div>
    </Modal>
  )
}
