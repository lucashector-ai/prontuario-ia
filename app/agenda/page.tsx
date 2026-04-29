'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/Toast'
import { supabase } from '@/lib/supabase'
import { Sidebar } from '@/components/Sidebar'
import { IconGift } from '@/components/Icon'

const TIPOS = {
  consulta: { label: 'Consulta', bg: '#ede9fb', text: '#4c1d95', border: '#b9a9ef', dot: '#6043C1' },
  retorno:  { label: 'Retorno',  bg: '#f3effd', text: '#5b42b0', border: '#dfd3f5', dot: '#7c3aed' },
  exame:    { label: 'Exame',    bg: '#f5f3ff', text: '#6d28d9', border: '#ddd6fe', dot: '#8b5cf6' },
  urgencia: { label: 'Urgência', bg: '#fee2e2', text: '#991b1b', border: '#fca5a5', dot: '#dc2626' },
}

const STATUS_OPTS = [
  { value: 'agendado',   label: 'Agendado' },
  { value: 'confirmado', label: 'Confirmado' },
  { value: 'cancelado',  label: 'Cancelado' },
  { value: 'realizado',  label: 'Realizado' },
]

const SLOT_MIN = 15
const SLOT_PX = 20
const HORA_INI = 7
const HORA_FIM = 21
const TOTAL_SLOTS = ((HORA_FIM - HORA_INI) * 60) / SLOT_MIN

const toSlotIdx = (d: Date) => Math.floor(((d.getHours() - HORA_INI) * 60 + d.getMinutes()) / SLOT_MIN)
const slotToPx = (idx: number) => idx * SLOT_PX
const durToPx  = (dur: number) => (dur / SLOT_MIN) * SLOT_PX

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

function getMonthGrid(date: Date) {
  const first = new Date(date.getFullYear(), date.getMonth(), 1)
  const startDay = first.getDay()
  const offset = startDay === 0 ? -6 : 1 - startDay
  const start = new Date(first)
  start.setDate(first.getDate() + offset)
  return Array.from({ length: 42 }, (_, i) => {
    const nd = new Date(start)
    nd.setDate(start.getDate() + i)
    return nd
  })
}

const isMesmoDia = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

const fmtMesAno = (d: Date) =>
  d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).replace(/ De /, ' de ')

const fmtDia = (d: Date) =>
  d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })

function coresDerivadas(hex: string) {
  const base = hex || '#6043C1'
  // Remove # e converte pra RGB
  const h = base.replace('#', '')
  const r = parseInt(h.substring(0, 2), 16)
  const g = parseInt(h.substring(2, 4), 16)
  const b = parseInt(h.substring(4, 6), 16)
  // Fundo: cor base com transparencia alta (hex alpha 1A = ~10%)
  const bg = base + '1A'
  // Texto: escurecer 30% para contraste
  const darken = (v: number) => Math.max(0, Math.floor(v * 0.5))
  const text = '#' + darken(r).toString(16).padStart(2, '0') + darken(g).toString(16).padStart(2, '0') + darken(b).toString(16).padStart(2, '0')
  // Borda: cor base com alpha moderado
  const border = base + '4D' // ~30%
  return { bg, text, border, dot: base }
}

const ehAniversario = (nascStr: string | null | undefined, alvo: Date) => {
  if (!nascStr) return false
  const n = new Date(nascStr)
  if (isNaN(n.getTime())) return false
  return n.getMonth() === alvo.getMonth() && n.getDate() === alvo.getDate()
}

export default function Agenda() {
  const router = useRouter()
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
  const [mesVisualizado, setMesVisualizado] = useState<Date>(() => new Date(0))

  const [filtroStatus, setFiltroStatus] = useState<string>('todos')
  const [filtroTipo, setFiltroTipo] = useState<string>('todos')
  const [filtroPaciente, setFiltroPaciente] = useState<string>('')
  const [filtroProfissional, setFiltroProfissional] = useState<string>('todos')

  const [listaEsperaOpen, setListaEsperaOpen] = useState(false)
  const [listaEspera] = useState<any[]>([])

  const [modal, setModal] = useState<{ open: boolean; date?: Date; ag?: any }>({ open: false })
  const [form, setForm] = useState({ paciente_id: '', medico_id: '', procedimento_id: '', data_hora: '', tipo: 'consulta', motivo: '', observacoes: '', duracao: '30' })
  const [salvando, setSalvando] = useState(false)

  const [comVideo, setComVideo] = useState(false)
  const [salaLink, setSalaLink] = useState('')
  const [salaId, setSalaId] = useState('')

  const [enviandoPreConsulta, setEnviandoPreConsulta] = useState(false)
  const [preConsultaEnviada, setPreConsultaEnviada] = useState(false)

  const [agora, setAgora] = useState<Date | null>(null)
  useEffect(() => {
    const agora_ = new Date()
    setAgora(agora_)
    setSemana(agora_)
    setDiaSelecionado(agora_)
    setMesVisualizado(agora_)
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
      }
    }
  }, [])

  useEffect(() => {
    const ca_ = localStorage.getItem('clinica_admin')
    const m = ca_ || localStorage.getItem('medico')
    if (!m) { router.push('/login'); return }
    const med = JSON.parse(m)
    setMedico(med)
    carregarDados(med.id)
  }, [router])

  const carregarDados = async (medicoId: string) => {
    // Se for clinica admin, busca pacientes e agendamentos de TODOS os medicos da clinica
    const ca = localStorage.getItem('clinica_admin')
    let medicoIds: string[] = [medicoId]

    if (ca) {
      const admin = JSON.parse(ca)
      if (admin.clinica_id) {
        const { data: meds } = await supabase
          .from('medicos').select('id, cor').eq('clinica_id', admin.clinica_id).eq('ativo', true)
        medicoIds = (meds || []).map((m: any) => m.id)
        const mapa: Record<string, string> = {}
        ;(meds || []).forEach((m: any) => { mapa[m.id] = m.cor || '#6043C1' })
        setMapaCoresMedicos(mapa)
        if (medicoIds.length === 0) medicoIds = [medicoId]
      }
    } else {
      // Medico logado sozinho: busca sua propria cor
      const { data: med } = await supabase.from('medicos').select('id, cor').eq('id', medicoId).maybeSingle()
      if (med) setMapaCoresMedicos({ [med.id]: (med as any).cor || '#6043C1' })
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

    // Carregar procedimentos da clínica (se houver clinica_id)
    const cidLoad = medico?.clinica_id
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
      if (filtroTipo !== 'todos' && a.tipo !== filtroTipo) return false
      if (filtroPaciente) {
        const nome = (a.pacientes?.nome || a.paciente_nome || '').toLowerCase()
        if (!nome.includes(filtroPaciente.toLowerCase())) return false
      }
      if (filtroProfissional !== 'todos' && a.profissional_id && a.profissional_id !== filtroProfissional) return false
      return true
    })
  }, [agendamentos, filtroStatus, filtroTipo, filtroPaciente, filtroProfissional])

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

  const limparFiltros = () => {
    setFiltroStatus('todos'); setFiltroTipo('todos'); setFiltroPaciente(''); setFiltroProfissional('todos')
  }

  const filtrosAtivos =
    (filtroStatus !== 'todos' ? 1 : 0) +
    (filtroTipo !== 'todos' ? 1 : 0) +
    (filtroPaciente ? 1 : 0) +
    (filtroProfissional !== 'todos' ? 1 : 0)

  const abrirModal = (date?: Date, ag?: any) => {
    setPreConsultaEnviada(false); setComVideo(false); setSalaLink(''); setSalaId('')
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
        console.error('Erro criando sala:', tcData.error)
        toast('Erro ao criar sala: ' + (tcData.error || 'desconhecido'))
      }
    } catch (err) {
      console.error('Erro criando sala:', err)
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
      } catch (err) { console.error('Erro removendo sala:', err) }
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
    e.preventDefault(); setSalvando(true)
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
      }
      setModal({ open: false })
    } finally { setSalvando(false) }
  }

  const deletar = async (id: string) => {
    if (!confirm('Deletar este agendamento?')) return
    await supabase.from('agendamentos').delete().eq('id', id)
    setAgendamentos(prev => prev.filter(a => a.id !== id))
    setModal({ open: false })
  }

  const enviarPreConsulta = async (agendamentoId: string) => {
    if (!medico) return
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
    } catch (e) { alert('Erro de conexao') }
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
    if (!confirm('Remover este bloqueio?')) return
    await fetch('/api/bloqueios?id=' + id, { method: 'DELETE' })
    setBloqueios(prev => prev.filter(b => b.id !== id))
    toast('Bloqueio removido')
  }

  const atualizarStatus = async (id: string, status: string) => {
    const { data } = await supabase.from('agendamentos').update({ status }).eq('id', id).select(`*, pacientes(nome, data_nascimento, telefone)`).single()
    if (data) setAgendamentos(prev => prev.map(a => a.id === id ? data : a))
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: 6,
    textTransform: 'uppercase', letterSpacing: '0.06em',
  }
  const selectStyle: React.CSSProperties = {
    width: '100%', padding: '8px 10px', fontSize: 12, borderRadius: 7, background: 'white', color: '#111827', cursor: 'pointer',
  }

  const renderHeader = () => {
    const labelData = viewMode === 'mes'
      ? fmtMesAno(mesVisualizado)
      : viewMode === 'dia'
        ? diaSelecionado.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
        : `${diasSemana[0].getDate()} – ${diasSemana[6].getDate()} ${fmtMesAno(diasSemana[6])}`

    return (
      <div style={{ padding: '0 20px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => { setSemana(new Date()); setDiaSelecionado(new Date()); setMesVisualizado(new Date()) }}
            style={{ fontSize: 12, fontWeight: 600, color: '#374151', background: 'white', padding: '5px 14px', borderRadius: 7, cursor: 'pointer' }}>
            Hoje
          </button>
          <div style={{ display: 'flex', gap: 1 }}>
            <button onClick={() => viewMode === 'mes' ? navegarMes(-1) : navegarSemana(-1)}
              style={{ width: 28, height: 28, background: 'white', borderRadius: '6px 0 0 6px', cursor: 'pointer', color: '#374151', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 18l-6-6 6-6"/></svg>
            </button>
            <button onClick={() => viewMode === 'mes' ? navegarMes(1) : navegarSemana(1)}
              style={{ width: 28, height: 28, background: 'white', borderRadius: '0 6px 6px 0', cursor: 'pointer', color: '#374151', display: 'flex', alignItems: 'center', justifyContent: 'center', borderLeft: 'none' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 18l6-6-6-6"/></svg>
            </button>
          </div>
          <h1 style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: 0, textTransform: 'capitalize' }}>{labelData}</h1>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={() => setListaEsperaOpen(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 7, background: 'white', fontSize: 12, color: '#374151', fontWeight: 600, cursor: 'pointer' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            Lista de espera
            {listaEspera.length > 0 && <span style={{ background: '#6043C1', color: 'white', borderRadius: 10, padding: '0 6px', fontSize: 10 }}>{listaEspera.length}</span>}
          </button>
          <div style={{ display: 'flex', borderRadius: 7, overflow: 'hidden', background: 'white' }}>
            {(['dia', 'semana', 'mes'] as const).map((v, i) => (
              <button key={v} onClick={() => setViewMode(v)}
                style={{ padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', background: viewMode === v ? '#6043C1' : 'white', color: viewMode === v ? 'white' : '#6b7280', border: 'none', borderLeft: i > 0 ? '1px solid #e5e7eb' : 'none' }}>
                {v === 'dia' ? 'Dia' : v === 'semana' ? 'Semana' : 'Mês'}
              </button>
            ))}
          </div>
          <button onClick={abrirModalBloqueio}
            title="Bloquear horario"
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, border: '1px solid #e5e7eb', background: 'white', color: '#6b7280', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
            </svg>
            Bloquear
          </button>
          <button onClick={() => abrirModal()}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 16px', borderRadius: 8, border: 'none', background: '#6043C1', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
            Novo
          </button>
        </div>
      </div>
    )
  }

  const renderPainel = () => {
    const monthGrid = getMonthGrid(mesVisualizado)
    const mesAtual = mesVisualizado.getMonth()
    return (
      <aside style={{ width: 260, background: 'white', borderRight: '1px solid #f3f4f6', padding: 16, overflow: 'auto', flexShrink: 0 }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: '#111827', margin: 0, textTransform: 'capitalize' }}>{fmtMesAno(mesVisualizado)}</h3>
            <div style={{ display: 'flex', gap: 2 }}>
              <button onClick={() => navegarMes(-1)} style={{ width: 22, height: 22, border: 'none', background: 'transparent', cursor: 'pointer', color: '#6b7280', borderRadius: 4 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 18l-6-6 6-6"/></svg>
              </button>
              <button onClick={() => navegarMes(1)} style={{ width: 22, height: 22, border: 'none', background: 'transparent', cursor: 'pointer', color: '#6b7280', borderRadius: 4 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 18l6-6-6-6"/></svg>
              </button>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
            {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((l, i) => (
              <div key={i} style={{ fontSize: 10, color: '#9ca3af', textAlign: 'center', fontWeight: 700, padding: '4px 0' }}>{l}</div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
            {monthGrid.map((d, i) => {
              const noMes = d.getMonth() === mesAtual
              const hoje = isHoje(d)
              const selecionado = isMesmoDia(d, diaSelecionado)
              const temAgs = agendamentosFiltrados.some(a => new Date(a.data_hora).toDateString() === d.toDateString())
              return (
                <button key={i} onClick={() => { setDiaSelecionado(d); setSemana(d); setViewMode('dia') }}
                  style={{ aspectRatio: '1', border: 'none', background: selecionado ? '#6043C1' : (hoje ? '#ede9fb' : 'transparent'), color: selecionado ? 'white' : (!noMes ? '#d1d5db' : (hoje ? '#6043C1' : '#374151')), fontSize: 11, fontWeight: hoje || selecionado ? 700 : 500, borderRadius: 6, cursor: 'pointer', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {d.getDate()}
                  {temAgs && !selecionado && <span style={{ position: 'absolute', bottom: 2, width: 3, height: 3, borderRadius: '50%', background: hoje ? '#6043C1' : '#9ca3af' }}/>}
                </button>
              )
            })}
          </div>
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: '#111827', margin: 0 }}>Filtros</h3>
            {filtrosAtivos > 0 && <button onClick={limparFiltros} style={{ fontSize: 11, color: '#6043C1', background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Limpar ({filtrosAtivos})</button>}
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 5 }}>Status</label>
            <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)} style={selectStyle}>
              <option value="todos">Todos</option>
              {STATUS_OPTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 5 }}>Tipo</label>
            <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)} style={selectStyle}>
              <option value="todos">Todos</option>
              {Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 5 }}>Paciente</label>
            <input type="text" value={filtroPaciente} onChange={e => setFiltroPaciente(e.target.value)} placeholder="Buscar por nome..." style={{ ...selectStyle, padding: '8px 10px' }}/>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 5 }}>Profissional</label>
            <select value={filtroProfissional} onChange={e => setFiltroProfissional(e.target.value)} style={selectStyle}>
              <option value="todos">Todos</option>
              {medico && <option value={medico.id}>{medico.nome || 'Eu'}</option>}
            </select>
          </div>
        </div>
        <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #f3f4f6' }}>
          <h3 style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Legenda</h3>
          {Object.entries(TIPOS).map(([k, v]) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: 3, background: v.bg, border: `1.5px solid ${v.border}`, borderLeft: `3px solid ${v.dot}` }}/>
              <span style={{ fontSize: 12, color: '#6b7280' }}>{v.label}</span>
            </div>
          ))}
        </div>
      </aside>
    )
  }

  const renderGridSemana = () => {
    const agoraIdx = agora ? toSlotIdx(agora) : -1
    const mostrarLinhaAgora = agora !== null && agoraIdx >= 0 && agoraIdx < TOTAL_SLOTS
    return (
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', background: 'white', borderRadius: 12, margin: '0 16px 16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '56px repeat(7, 1fr)', borderBottom: '1px solid #f3f4f6', flexShrink: 0 }}>
          <div/>
          {diasSemana.map((dia, i) => {
            const ags = getAgsDia(dia)
            const aniversariantes = pacientes.filter(p => ehAniversario(p.data_nascimento, dia)).length
            return (
              <div key={i} onClick={() => { setDiaSelecionado(dia); setViewMode('dia') }}
                style={{ padding: '10px 8px', textAlign: 'center', borderLeft: '1px solid #f3f4f6', cursor: 'pointer', background: isHoje(dia) ? '#faf8ff' : 'white' }}>
                <p style={{ fontSize: 10, color: isHoje(dia) ? '#6043C1' : '#9ca3af', fontWeight: 700, margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  {dia.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: isHoje(dia) ? '#6043C1' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <p style={{ fontSize: 14, fontWeight: 700, color: isHoje(dia) ? 'white' : '#111827', margin: 0 }}>{dia.getDate()}</p>
                  </div>
                  {aniversariantes > 0 && <span title={`${aniversariantes} aniversariante(s)`} style={{ fontSize: 12 }}><IconGift size={14} /></span>}
                </div>
                {ags.length > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 2, marginTop: 3 }}>
                    {ags.slice(0, 4).map((ag, ai) => (
                      <div key={ai} style={{ width: 4, height: 4, borderRadius: '50%', background: TIPOS[ag.tipo as keyof typeof TIPOS]?.dot || '#6043C1' }}/>
                    ))}
                    {ags.length > 4 && <span style={{ fontSize: 9, color: '#6b7280' }}>+{ags.length - 4}</span>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
        <div style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '56px repeat(7, 1fr)', minHeight: `${TOTAL_SLOTS * SLOT_PX}px`, position: 'relative' }}>
            <div style={{ position: 'sticky', left: 0, background: 'white', zIndex: 5, paddingTop: 12, paddingBottom: 12 }}>
              {Array.from({ length: HORA_FIM - HORA_INI }, (_, i) => (
                <div key={i} style={{ height: SLOT_PX * 4, position: 'relative', borderBottom: '1px solid #f3f4f6' }}>
                  <span style={{ position: 'absolute', top: -7, right: 8, fontSize: 10, color: '#9ca3af', fontWeight: 600, background: 'white', padding: '0 2px' }}>
                    {(HORA_INI + i).toString().padStart(2, '0')}:00
                  </span>
                </div>
              ))}
            </div>
            {diasSemana.map((dia, di) => (
              <div key={di} style={{ borderLeft: '1px solid #f3f4f6', background: isHoje(dia) ? '#faf8ff' : 'white', position: 'relative', paddingTop: 12, paddingBottom: 12 }}>
                {Array.from({ length: (HORA_FIM - HORA_INI) * 4 }, (_, i) => {
                  const isHoraCheia = i % 4 === 0
                  const isMeia = i % 4 === 2
                  const isUltimo = i === (HORA_FIM - HORA_INI) * 4 - 1
                  return (
                    <div key={i}
                      onClick={() => { const d = new Date(dia); d.setHours(HORA_INI + Math.floor(i / 4), (i % 4) * 15, 0, 0); abrirModal(d) }}
                      style={{ height: SLOT_PX, borderTop: isHoraCheia ? '1px solid #f3f4f6' : 'none', borderBottom: isUltimo ? '1px solid #f3f4f6' : 'none', cursor: 'pointer', transition: 'background 0.1s' }}
                      onMouseOver={e => { e.currentTarget.style.background = 'rgba(96,67,193,0.04)' }}
                      onMouseOut={e => { e.currentTarget.style.background = 'transparent' }}/>
                  )
                })}
                {getAgsDia(dia).map(ag => {
                  const tipo = TIPOS[ag.tipo as keyof typeof TIPOS] || TIPOS.consulta
                  const corMed = coresDerivadas(mapaCoresMedicos[ag.medico_id] || '#6043C1')
                  const d = new Date(ag.data_hora)
                  const idx = toSlotIdx(d)
                  const dur = Number(ag.duracao) || 30
                  const pacNome = ag.pacientes?.nome || ag.paciente_nome || 'Encaixe'
                  const cancelado = ag.status === 'cancelado'
                  return (
                    <div key={ag.id} onClick={e => { e.stopPropagation(); abrirModal(undefined, ag) }}
                      style={{ position: 'absolute', left: 3, right: 3, top: slotToPx(idx) + 1, height: durToPx(dur) - 2, background: cancelado ? '#f3f4f6' : corMed.bg, border: `1px solid ${cancelado ? '#d1d5db' : corMed.border}`, borderLeft: `3px solid ${cancelado ? '#9ca3af' : corMed.dot}`, borderRadius: 6, padding: '3px 6px', cursor: 'pointer', zIndex: 10, overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', opacity: cancelado ? 0.6 : 1, textDecoration: cancelado ? 'line-through' : 'none' }}>
                      {/* Indicadores no canto superior direito */}
                      {(ag.pre_consulta_enviada || ag.confirmacao_24h_enviada) && (
                        <div style={{ position: 'absolute', top: 3, right: 3, display: 'flex', flexDirection: 'column' as const, gap: 2, zIndex: 2 }}>
                          {ag.pre_consulta_enviada && (
                            <span title="Pré-consulta enviada" style={{ width: 12, height: 12, borderRadius: '50%', background: '#25d366', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <svg width="7" height="7" viewBox="0 0 24 24" fill="white"><path d="M20.52 3.45C18.38 1.34 15.48 0 12.4 0 6.37 0 1.45 4.92 1.45 11c0 1.95.5 3.85 1.45 5.55L1 23l6.6-1.73c1.6.9 3.5 1.36 5.4 1.36 6.03 0 10.95-4.92 10.95-11 0-2.96-1.14-5.76-3.43-8.18z"/></svg>
                            </span>
                          )}
                          {ag.confirmacao_24h_status === 'confirmado' && (
                            <span title="Paciente confirmou" style={{ width: 12, height: 12, borderRadius: '50%', background: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5"><polyline points="20 6 9 17 4 12"/></svg>
                            </span>
                          )}
                          {ag.confirmacao_24h_enviada && ag.confirmacao_24h_status !== 'confirmado' && (
                            <span title="Aguardando confirmação" style={{ width: 12, height: 12, borderRadius: '50%', background: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                            </span>
                          )}
                        </div>
                      )}
                      <p style={{ fontSize: 11, fontWeight: 700, color: corMed.text, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: (ag.pre_consulta_enviada || ag.confirmacao_24h_enviada) ? 16 : 0 }}>{pacNome}</p>
                      {durToPx(dur) > 28 && (
                        <p style={{ fontSize: 10, color: corMed.text, margin: '1px 0 0', opacity: 0.75, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ag.motivo || tipo.label}</p>
                      )}
                      {durToPx(dur) > 44 && (
                        <p style={{ fontSize: 9, color: corMed.text, margin: 'auto 0 0', opacity: 0.65, fontWeight: 600 }}>
                          {d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} – {new Date(d.getTime() + dur * 60000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      )}
                    </div>
                  )
                })}
                {/* Renderiza bloqueios */}
                {getBloqueiosDia(dia).map((b: any) => {
                  const dIni = new Date(b.data_inicio)
                  const dFim = new Date(b.data_fim)
                  // Se o bloqueio cobre o dia inteiro, renderiza de 0h a fim do grid
                  const ehDiaInteiro = dIni.getHours() === 0 && dFim.getHours() === 23 && dFim.getMinutes() === 59
                  const idx = ehDiaInteiro ? 0 : Math.max(0, toSlotIdx(dIni))
                  const idxFim = ehDiaInteiro ? TOTAL_SLOTS : Math.min(TOTAL_SLOTS, toSlotIdx(dFim))
                  const altura = (idxFim - idx) * SLOT_PX
                  if (altura <= 0) return null
                  return (
                    <div key={'blq-' + b.id + '-' + dia.toISOString()}
                      title={b.motivo || 'Horário bloqueado'}
                      onClick={e => { e.stopPropagation(); if (confirm('Remover bloqueio?' + (b.motivo ? ' (' + b.motivo + ')' : ''))) removerBloqueio(b.id) }}
                      style={{
                        position: 'absolute' as const, left: 0, right: 0,
                        top: slotToPx(idx), height: altura,
                        background: 'repeating-linear-gradient(45deg, #f3f4f6, #f3f4f6 6px, #e5e7eb 6px, #e5e7eb 12px)',
                        borderTop: '1px solid #d1d5db', borderBottom: '1px solid #d1d5db',
                        zIndex: 5, cursor: 'pointer', overflow: 'hidden' as const,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 4,
                      }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' as const, letterSpacing: '0.04em', background: 'white', padding: '2px 8px', borderRadius: 12 }}>
                        🚫 {b.motivo || 'Bloqueado'}
                      </span>
                    </div>
                  )
                })}
                {isHoje(dia) && mostrarLinhaAgora && (
                  <div style={{ position: 'absolute', top: slotToPx(agoraIdx) + (agora.getMinutes() % SLOT_MIN) * (SLOT_PX / SLOT_MIN), left: 0, right: 0, height: 2, background: '#dc2626', zIndex: 20, pointerEvents: 'none' }}>
                    <div style={{ position: 'absolute', left: -4, top: -3, width: 8, height: 8, borderRadius: '50%', background: '#dc2626' }}/>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  const renderGridMes = () => {
    const grid = getMonthGrid(mesVisualizado)
    const mesAtual = mesVisualizado.getMonth()
    return (
      <div style={{ flex: 1, background: 'white', borderRadius: 12, margin: '0 16px 16px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid #f3f4f6' }}>
          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((l, i) => (
            <div key={i} style={{ padding: '12px 8px', fontSize: 11, fontWeight: 700, color: i === 0 || i === 6 ? '#6043C1' : '#374151', textAlign: 'center' as const, textTransform: 'uppercase' as const, letterSpacing: '0.08em', background: '#F9FAFB' }}>{l}</div>
          ))}
        </div>
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gridAutoRows: '1fr' }}>
          {grid.map((d, i) => {
            const ags = getAgsDia(d)
            const noMes = d.getMonth() === mesAtual
            const hoje = isHoje(d)
            return (
              <div key={i} onClick={() => { setDiaSelecionado(d); setSemana(d); setViewMode('dia') }}
                style={{ borderTop: '1px solid #f3f4f6', borderLeft: i % 7 !== 0 ? '1px solid #f3f4f6' : 'none', padding: 8, cursor: 'pointer', background: noMes ? 'white' : '#F5F5F5', overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 4, minHeight: 90, transition: 'background 0.12s' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, fontWeight: hoje ? 800 : 600, color: noMes ? (hoje ? 'white' : '#111827') : '#d1d5db', background: hoje ? '#6043C1' : 'transparent', width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{d.getDate()}</span>
                  {ags.length > 2 && <span style={{ fontSize: 9, color: '#9ca3af', fontWeight: 600 }}>+{ags.length - 2}</span>}
                </div>
                {ags.slice(0, 2).map(ag => {
                  const tipo = TIPOS[ag.tipo as keyof typeof TIPOS] || TIPOS.consulta
                  const corMed = coresDerivadas(mapaCoresMedicos[ag.medico_id] || '#6043C1')
                  return (
                    <div key={ag.id} onClick={e => { e.stopPropagation(); abrirModal(undefined, ag) }}
                      style={{ fontSize: 10, padding: '2px 5px', borderRadius: 4, background: corMed.bg, color: corMed.text, borderLeft: `2px solid ${corMed.dot}`, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>
                      {new Date(ag.data_hora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} {ag.pacientes?.nome || 'Encaixe'}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const renderGridDia = () => {
    const agoraIdx = agora ? toSlotIdx(agora) : -1
    const mostrarLinhaAgora = agora !== null && isHoje(diaSelecionado) && agoraIdx >= 0 && agoraIdx < TOTAL_SLOTS
    const ags = getAgsDia(diaSelecionado)
    return (
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', background: 'white', borderRadius: 12, margin: '0 16px 16px' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: isHoje(diaSelecionado) ? '#6043C1' : '#ede9fb', color: isHoje(diaSelecionado) ? 'white' : '#6043C1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, fontWeight: 700 }}>
            {diaSelecionado.getDate()}
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#111827', textTransform: 'capitalize' }}>{diaSelecionado.toLocaleDateString('pt-BR', { weekday: 'long' })}</p>
            <p style={{ margin: 0, fontSize: 12, color: '#6b7280', textTransform: 'capitalize' }}>{fmtMesAno(diaSelecionado)} · {ags.length} agendamento{ags.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <div style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '72px 1fr', minHeight: `${TOTAL_SLOTS * SLOT_PX}px`, position: 'relative' }}>
            <div style={{ position: 'sticky', left: 0, background: 'white', zIndex: 5 }}>
              {Array.from({ length: HORA_FIM - HORA_INI }, (_, i) => (
                <div key={i} style={{ height: SLOT_PX * 4, position: 'relative', borderBottom: '1px solid #f3f4f6' }}>
                  <span style={{ position: 'absolute', top: -7, right: 10, fontSize: 11, color: '#9ca3af', fontWeight: 600, background: 'white', padding: '0 4px' }}>{(HORA_INI + i).toString().padStart(2, '0')}:00</span>
                </div>
              ))}
            </div>
            <div style={{ borderLeft: '1px solid #f3f4f6', position: 'relative', paddingTop: 12, paddingBottom: 12 }}>
              {Array.from({ length: (HORA_FIM - HORA_INI) * 4 }, (_, i) => {
                const isHoraCheia = i % 4 === 0
                const isMeia = i % 4 === 2
                const isUltimo = i === (HORA_FIM - HORA_INI) * 4 - 1
                return (
                  <div key={i}
                    onClick={() => { const d = new Date(diaSelecionado); d.setHours(HORA_INI + Math.floor(i / 4), (i % 4) * 15, 0, 0); abrirModal(d) }}
                    style={{ height: SLOT_PX, borderTop: isHoraCheia ? '1px solid #f3f4f6' : 'none', borderBottom: isUltimo ? '1px solid #f3f4f6' : 'none', cursor: 'pointer' }}
                    onMouseOver={e => { e.currentTarget.style.background = 'rgba(96,67,193,0.04)' }}
                    onMouseOut={e => { e.currentTarget.style.background = 'transparent' }}/>
                )
              })}
              {ags.map(ag => {
                const tipo = TIPOS[ag.tipo as keyof typeof TIPOS] || TIPOS.consulta
                const corMed = coresDerivadas(mapaCoresMedicos[ag.medico_id] || '#6043C1')
                const d = new Date(ag.data_hora)
                const idx = toSlotIdx(d)
                const dur = Number(ag.duracao) || 30
                const pacNome = ag.pacientes?.nome || ag.paciente_nome || 'Encaixe'
                return (
                  <div key={ag.id} onClick={e => { e.stopPropagation(); abrirModal(undefined, ag) }}
                    style={{ position: 'absolute', left: 8, right: 8, top: slotToPx(idx) + 1, height: durToPx(dur) - 2, background: corMed.bg, border: `1px solid ${corMed.border}`, borderLeft: `3px solid ${corMed.dot}`, borderRadius: 8, padding: '8px 12px', cursor: 'pointer', zIndex: 10, overflow: 'hidden' }}>
                    {/* Indicadores no canto superior direito */}
                    {(ag.pre_consulta_enviada || ag.confirmacao_24h_enviada) && (
                      <div style={{ position: 'absolute', top: 6, right: 8, display: 'flex', gap: 4, zIndex: 2 }}>
                        {ag.pre_consulta_enviada && (
                          <span title="Pré-consulta enviada no WhatsApp" style={{ width: 18, height: 18, borderRadius: '50%', background: '#25d366', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="white"><path d="M20.52 3.45C18.38 1.34 15.48 0 12.4 0 6.37 0 1.45 4.92 1.45 11c0 1.95.5 3.85 1.45 5.55L1 23l6.6-1.73c1.6.9 3.5 1.36 5.4 1.36 6.03 0 10.95-4.92 10.95-11 0-2.96-1.14-5.76-3.43-8.18z"/></svg>
                          </span>
                        )}
                        {ag.confirmacao_24h_status === 'confirmado' ? (
                          <span title="Paciente confirmou a consulta" style={{ width: 18, height: 18, borderRadius: '50%', background: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5"><polyline points="20 6 9 17 4 12"/></svg>
                          </span>
                        ) : ag.confirmacao_24h_enviada ? (
                          <span title="Aguardando confirmação do paciente" style={{ width: 18, height: 18, borderRadius: '50%', background: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                          </span>
                        ) : null}
                      </div>
                    )}
                    <p style={{ fontSize: 13, fontWeight: 700, color: corMed.text, margin: 0, paddingRight: (ag.pre_consulta_enviada || ag.confirmacao_24h_enviada) ? 48 : 0 }}>{pacNome}</p>
                    <p style={{ fontSize: 11, color: corMed.text, margin: '2px 0 0', opacity: 0.75 }}>
                      {d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} · {ag.motivo || tipo.label}
                    </p>
                  </div>
                )
              })}
              {/* Bloqueios no dia */}
              {getBloqueiosDia(diaSelecionado).map((b: any) => {
                const dIni = new Date(b.data_inicio)
                const dFim = new Date(b.data_fim)
                const ehDiaInteiro = dIni.getHours() === 0 && dFim.getHours() === 23 && dFim.getMinutes() === 59
                const idx = ehDiaInteiro ? 0 : Math.max(0, toSlotIdx(dIni))
                const idxFim = ehDiaInteiro ? TOTAL_SLOTS : Math.min(TOTAL_SLOTS, toSlotIdx(dFim))
                const altura = (idxFim - idx) * SLOT_PX
                if (altura <= 0) return null
                return (
                  <div key={'blq-' + b.id}
                    title={b.motivo || 'Horário bloqueado'}
                    onClick={e => { e.stopPropagation(); if (confirm('Remover bloqueio?' + (b.motivo ? ' (' + b.motivo + ')' : ''))) removerBloqueio(b.id) }}
                    style={{
                      position: 'absolute' as const, left: 0, right: 0,
                      top: slotToPx(idx), height: altura,
                      background: 'repeating-linear-gradient(45deg, #f3f4f6, #f3f4f6 8px, #e5e7eb 8px, #e5e7eb 16px)',
                      borderTop: '1px solid #d1d5db', borderBottom: '1px solid #d1d5db',
                      zIndex: 5, cursor: 'pointer', overflow: 'hidden' as const,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 8,
                    }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' as const, letterSpacing: '0.04em', background: 'white', padding: '4px 14px', borderRadius: 20, border: '1px solid #e5e7eb' }}>
                      🚫 {b.motivo || 'Horário bloqueado'}
                    </span>
                  </div>
                )
              })}
              {mostrarLinhaAgora && (
                <div style={{ position: 'absolute', top: slotToPx(agoraIdx) + (agora.getMinutes() % SLOT_MIN) * (SLOT_PX / SLOT_MIN), left: 0, right: 0, height: 2, background: '#dc2626', zIndex: 20, pointerEvents: 'none' }}>
                  <div style={{ position: 'absolute', left: -4, top: -3, width: 8, height: 8, borderRadius: '50%', background: '#dc2626' }}/>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#F5F5F5', overflow: 'hidden' }}>
      {renderPainel()}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {renderHeader()}
        {viewMode === 'semana' && renderGridSemana()}
        {viewMode === 'dia'    && renderGridDia()}
        {viewMode === 'mes'    && renderGridMes()}
      </main>

      {listaEsperaOpen && (
        <div onClick={() => setListaEsperaOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.2)', zIndex: 90 }}>
          <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 360, background: 'white', boxShadow: '-8px 0 24px rgba(0,0,0,0.08)', padding: 20, overflow: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#111827' }}>Lista de espera</h3>
              <button onClick={() => setListaEsperaOpen(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 20, color: '#9ca3af' }}>✕</button>
            </div>
            <div style={{ padding: '40px 0', textAlign: 'center', color: '#9ca3af' }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ margin: '0 auto 12px', display: 'block' }}>
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
              <p style={{ margin: 0, fontSize: 13 }}>Nenhum paciente na lista de espera.</p>
              <p style={{ margin: '6px 0 0', fontSize: 11 }}>Pacientes aguardando encaixe aparecem aqui.</p>
            </div>
          </div>
        </div>
      )}

      {modalBloqueio && (
        <div onClick={e => { if (e.target === e.currentTarget) setModalBloqueio(false) }}
          style={{ position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: 'white', borderRadius: 16, width: '100%', maxWidth: 520, maxHeight: '90vh', overflow: 'auto' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: '#fef2f2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
                  </svg>
                </div>
                <div>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: 0 }}>Bloquear horário</h3>
                  <p style={{ fontSize: 11, color: '#9ca3af', margin: 0 }}>Impede agendamentos nesse período</p>
                </div>
              </div>
              <button onClick={() => setModalBloqueio(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 20, padding: 4 }}>✕</button>
            </div>

            <div style={{ padding: 24, display: 'flex', flexDirection: 'column' as const, gap: 16 }}>
              {/* Médico */}
              <div>
                <label style={labelStyle}>Médico</label>
                <select value={formBloqueio.medico_id}
                  onChange={e => setFormBloqueio(p => ({ ...p, medico_id: e.target.value }))}
                  style={{ width: '100%', padding: '10px 14px', fontSize: 14, borderRadius: 10, border: '1px solid #e5e7eb', background: 'white', color: '#111827', cursor: 'pointer' }}>
                  <option value="">Selecionar médico</option>
                  {medicosClinica.map(m => (
                    <option key={m.id} value={m.id}>Dr(a). {m.nome}</option>
                  ))}
                </select>
              </div>

              {/* Tipo de bloqueio */}
              <div>
                <label style={labelStyle}>Tipo</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  {([
                    { v: 'horario', label: 'Horário', sub: 'Só umas horas' },
                    { v: 'dia', label: 'Dia inteiro', sub: 'Dia todo' },
                    { v: 'periodo', label: 'Período', sub: 'Vários dias' },
                  ] as const).map(t => (
                    <button key={t.v} type="button"
                      onClick={() => setFormBloqueio(p => ({ ...p, tipo: t.v }))}
                      style={{
                        padding: '10px 8px', borderRadius: 10, textAlign: 'left' as const,
                        border: formBloqueio.tipo === t.v ? '1.5px solid #dc2626' : '1.5px solid #e5e7eb',
                        background: formBloqueio.tipo === t.v ? '#fef2f2' : 'white',
                        cursor: 'pointer',
                      }}>
                      <p style={{ fontSize: 12, fontWeight: 700, color: formBloqueio.tipo === t.v ? '#dc2626' : '#111827', margin: 0 }}>{t.label}</p>
                      <p style={{ fontSize: 10, color: '#9ca3af', margin: '2px 0 0' }}>{t.sub}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Datas conforme tipo */}
              {formBloqueio.tipo === 'horario' && (
                <>
                  <div>
                    <label style={labelStyle}>Data</label>
                    <input type="date" value={formBloqueio.data}
                      onChange={e => setFormBloqueio(p => ({ ...p, data: e.target.value }))}
                      style={{ width: '100%', padding: '10px 14px', fontSize: 14, borderRadius: 10, border: '1px solid #e5e7eb' }}/>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <label style={labelStyle}>Das</label>
                      <input type="time" value={formBloqueio.hora_inicio}
                        onChange={e => setFormBloqueio(p => ({ ...p, hora_inicio: e.target.value }))}
                        style={{ width: '100%', padding: '10px 14px', fontSize: 14, borderRadius: 10, border: '1px solid #e5e7eb' }}/>
                    </div>
                    <div>
                      <label style={labelStyle}>Até</label>
                      <input type="time" value={formBloqueio.hora_fim}
                        onChange={e => setFormBloqueio(p => ({ ...p, hora_fim: e.target.value }))}
                        style={{ width: '100%', padding: '10px 14px', fontSize: 14, borderRadius: 10, border: '1px solid #e5e7eb' }}/>
                    </div>
                  </div>
                </>
              )}

              {formBloqueio.tipo === 'dia' && (
                <div>
                  <label style={labelStyle}>Data</label>
                  <input type="date" value={formBloqueio.data}
                    onChange={e => setFormBloqueio(p => ({ ...p, data: e.target.value }))}
                    style={{ width: '100%', padding: '10px 14px', fontSize: 14, borderRadius: 10, border: '1px solid #e5e7eb' }}/>
                  <p style={{ fontSize: 11, color: '#9ca3af', margin: '6px 0 0' }}>Dia inteiro indisponível</p>
                </div>
              )}

              {formBloqueio.tipo === 'periodo' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={labelStyle}>De</label>
                    <input type="date" value={formBloqueio.data_inicio}
                      onChange={e => setFormBloqueio(p => ({ ...p, data_inicio: e.target.value }))}
                      style={{ width: '100%', padding: '10px 14px', fontSize: 14, borderRadius: 10, border: '1px solid #e5e7eb' }}/>
                  </div>
                  <div>
                    <label style={labelStyle}>Até</label>
                    <input type="date" value={formBloqueio.data_fim}
                      onChange={e => setFormBloqueio(p => ({ ...p, data_fim: e.target.value }))}
                      style={{ width: '100%', padding: '10px 14px', fontSize: 14, borderRadius: 10, border: '1px solid #e5e7eb' }}/>
                  </div>
                </div>
              )}

              {/* Motivo */}
              <div>
                <label style={labelStyle}>Motivo (opcional)</label>
                <input value={formBloqueio.motivo}
                  onChange={e => setFormBloqueio(p => ({ ...p, motivo: e.target.value }))}
                  placeholder="Ex: Almoço, Reunião, Férias..."
                  style={{ width: '100%', padding: '10px 14px', fontSize: 14, borderRadius: 10, border: '1px solid #e5e7eb' }}/>
              </div>

              {/* Recorrência (só pra tipo horário/dia) */}
              {(formBloqueio.tipo === 'horario' || formBloqueio.tipo === 'dia') && (
                <div style={{ background: '#F9FAFB', borderRadius: 10, padding: 14 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                    <input type="checkbox" checked={formBloqueio.recorrente}
                      onChange={e => setFormBloqueio(p => ({ ...p, recorrente: e.target.checked }))}
                      style={{ width: 18, height: 18, cursor: 'pointer' }}/>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: '#111827', margin: 0 }}>Repetir semanalmente</p>
                      <p style={{ fontSize: 11, color: '#9ca3af', margin: '2px 0 0' }}>Bloqueio toda semana nos dias escolhidos</p>
                    </div>
                  </label>

                  {formBloqueio.recorrente && (
                    <div style={{ marginTop: 12 }}>
                      <p style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' as const, letterSpacing: '0.04em', marginBottom: 8 }}>Dias da semana</p>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {([
                          { v: '0', label: 'D' },
                          { v: '1', label: 'S' },
                          { v: '2', label: 'T' },
                          { v: '3', label: 'Q' },
                          { v: '4', label: 'Q' },
                          { v: '5', label: 'S' },
                          { v: '6', label: 'S' },
                        ] as const).map(d => {
                          const ativo = formBloqueio.dias_semana.includes(d.v)
                          return (
                            <button key={d.v} type="button"
                              onClick={() => setFormBloqueio(p => ({
                                ...p,
                                dias_semana: ativo ? p.dias_semana.filter(x => x !== d.v) : [...p.dias_semana, d.v],
                              }))}
                              style={{
                                width: 36, height: 36, borderRadius: 8,
                                border: ativo ? '1.5px solid #dc2626' : '1.5px solid #e5e7eb',
                                background: ativo ? '#dc2626' : 'white',
                                color: ativo ? 'white' : '#6b7280',
                                fontSize: 13, fontWeight: 700, cursor: 'pointer',
                              }}>{d.label}</button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Botões */}
              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button onClick={() => setModalBloqueio(false)}
                  style={{ padding: '11px 18px', borderRadius: 10, border: '1px solid #e5e7eb', background: 'white', color: '#6b7280', fontSize: 13, cursor: 'pointer' }}>
                  Cancelar
                </button>
                <button onClick={salvarBloqueio} disabled={salvandoBloqueio}
                  style={{ flex: 1, padding: '11px', borderRadius: 10, border: 'none', background: salvandoBloqueio ? '#9ca3af' : '#dc2626', color: 'white', fontSize: 14, fontWeight: 700, cursor: salvandoBloqueio ? 'not-allowed' : 'pointer' }}>
                  {salvandoBloqueio ? 'Bloqueando...' : 'Bloquear'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {modal.open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 24 }}
          onClick={e => { if (e.target === e.currentTarget) setModal({ open: false }) }}>
          <div style={{ background: 'white', borderRadius: 16, width: '100%', maxWidth: 480, overflow: 'hidden' }}>
            <div style={{ padding: '18px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: '#ede9fb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#6043C1" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                </div>
                <div>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: 0 }}>{modal.ag ? 'Editar agendamento' : 'Novo agendamento'}</h3>
                  {modal.date && <p style={{ fontSize: 11, color: '#9ca3af', margin: 0 }}>{fmtDia(modal.date)}</p>}
                </div>
              </div>
              <button onClick={() => setModal({ open: false })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 20, lineHeight: 1, padding: 4 }}>✕</button>
            </div>
            <form onSubmit={salvar} style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={labelStyle}>Tipo</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6 }}>
                  {Object.entries(TIPOS).map(([k, v]) => (
                    <button key={k} type="button" onClick={() => setForm(f => ({...f, tipo: k}))}
                      style={{ padding: '7px 4px', borderRadius: 8, border: `1.5px solid ${form.tipo === k ? v.dot : '#e5e7eb'}`, background: form.tipo === k ? v.bg : 'white', color: form.tipo === k ? v.text : '#6b7280', fontSize: 12, fontWeight: form.tipo === k ? 700 : 500, cursor: 'pointer', transition: 'all 0.15s' }}>
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>
              {/* Profissional — read-only se médico logado, dropdown se clinica admin */}
              {(() => {
                const ehAdminClinica = typeof window !== 'undefined' && !!localStorage.getItem('clinica_admin')
                if (!ehAdminClinica) {
                  return (
                    <div>
                      <label style={labelStyle}>Profissional</label>
                      <div style={{ padding: '9px 12px', fontSize: 13, borderRadius: 8, background: '#f9fafb', color: '#111827', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: medico?.cor || '#6043C1' }}/>
                        Dr(a). {medico?.nome || '...'}
                      </div>
                    </div>
                  )
                }
                return (
                  <div>
                    <label style={labelStyle}>Profissional</label>
                    <select value={form.medico_id} onChange={e => setForm(f => ({...f, medico_id: e.target.value}))}
                      style={{ width: '100%', padding: '9px 12px', fontSize: 13, borderRadius: 8, background: 'white', color: '#111827' }}>
                      <option value="">Selecionar médico</option>
                      {medicosClinica.filter((m: any) => (m.cargo === 'medico' || m.cargo === 'admin' || !m.cargo) && m.ativo !== false).map((m: any) => (
                        <option key={m.id} value={m.id}>Dr(a). {m.nome}</option>
                      ))}
                    </select>
                  </div>
                )
              })()}
              {procedimentos.length > 0 && (
                <div>
                  <label style={labelStyle}>Procedimento</label>
                  <select
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
                    }}
                    style={{ width: '100%', padding: '9px 12px', fontSize: 13, borderRadius: 8, background: 'white', color: '#111827' }}>
                    <option value="">Nenhum (consulta padrão)</option>
                    {procedimentos.map((p: any) => (
                      <option key={p.id} value={p.id}>
                        {p.nome}{p.duracao ? ' · ' + p.duracao + 'min' : ''}{p.valor ? ' · R$ ' + Number(p.valor).toFixed(2).replace('.', ',') : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label style={labelStyle}>Paciente</label>
                <select value={form.paciente_id} onChange={e => setForm(f => ({...f, paciente_id: e.target.value}))}
                  style={{ width: '100%', padding: '9px 12px', fontSize: 13, borderRadius: 8, background: 'white', color: '#111827' }}>
                  <option value="">Selecionar paciente (opcional)</option>
                  {pacientes.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
                {!form.paciente_id && (
                  <p style={{ fontSize: 11, color: '#9ca3af', margin: '5px 2px 0', fontStyle: 'italic' }}>
                    Deixe em branco para criar um encaixe rápido
                  </p>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 10 }}>
                <div>
                  <label style={labelStyle}>Data e hora *</label>
                  <input type="datetime-local" required value={form.data_hora} onChange={e => setForm(f => ({...f, data_hora: e.target.value}))}
                    style={{ width: '100%', padding: '9px 12px', fontSize: 13, borderRadius: 8 }}/>
                </div>
                <div>
                  <label style={labelStyle}>Duração</label>
                  <select value={form.duracao} onChange={e => setForm(f => ({...f, duracao: e.target.value}))}
                    style={{ width: '100%', padding: '9px 12px', fontSize: 13, borderRadius: 8, background: 'white' }}>
                    <option value="15">15 min</option>
                    <option value="30">30 min</option>
                    <option value="45">45 min</option>
                    <option value="60">1 hora</option>
                    <option value="90">1h30</option>
                  </select>
                </div>
              </div>
              <div>
                <label style={labelStyle}>Motivo</label>
                <input value={form.motivo} onChange={e => setForm(f => ({...f, motivo: e.target.value}))}
                  style={{ width: '100%', padding: '9px 12px', fontSize: 13, borderRadius: 8 }}
                  placeholder="Ex: Consulta de rotina, dor abdominal..."/>
              </div>
              <div>
                <label style={labelStyle}>Observações</label>
                <textarea value={form.observacoes} onChange={e => setForm(f => ({...f, observacoes: e.target.value}))}
                  style={{ width: '100%', padding: '9px 12px', fontSize: 13, borderRadius: 8, minHeight: 56, resize: 'none' }}
                  placeholder="Observações adicionais..."/>
              </div>
              {modal.ag && (
                <div style={{ background: 'white', borderRadius: 10, padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 500 }}>Status atual: <strong style={{ color: '#111827' }}>{modal.ag.status}</strong></span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {modal.ag.status !== 'confirmado' && (
                      <button type="button" onClick={() => { atualizarStatus(modal.ag.id, 'confirmado'); setModal(m => ({...m, ag: {...m.ag, status: 'confirmado'}})) }}
                        style={{ fontSize: 11, color: '#16a34a', background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '3px 10px', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>Confirmar</button>
                    )}
                    {modal.ag.status !== 'cancelado' && (
                      <button type="button" onClick={() => { atualizarStatus(modal.ag.id, 'cancelado'); setModal({ open: false }) }}
                        style={{ fontSize: 11, color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', padding: '3px 10px', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>Cancelar</button>
                    )}
                  </div>
                </div>
              )}
              {!modal.ag && !salaLink && (
                <button type="button" onClick={criarSalaAgora}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '11px 14px', background: 'white', border: '1px solid #e5e7eb', borderRadius: 10, cursor: 'pointer', textAlign: 'left' as const }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: '#ede9fb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#6043C1" strokeWidth="2"><path d="M15 10l4.553-2.169A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14v-4zM3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"/></svg>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#6043C1' }}>Adicionar videoconferência</span>
                </button>
              )}
              {!modal.ag && salaLink && (
                <div style={{ background: '#faf8ff', border: '1px solid #ddd3f7', borderRadius: 10, padding: '10px 12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <div style={{ width: 30, height: 30, borderRadius: 8, background: '#ede9fb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#6043C1" strokeWidth="2"><path d="M15 10l4.553-2.169A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14v-4zM3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"/></svg>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: '#6043C1', margin: '0 0 2px' }}>Entrar na sala</p>
                      <p style={{ fontSize: 11, color: '#6b7280', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{salaLink}</p>
                    </div>
                    <button type="button" onClick={removerSala} title="Remover sala"
                      style={{ padding: 6, background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button type="button" onClick={copiarLinkSala}
                      style={{ flex: 1, padding: '7px 10px', borderRadius: 8, background: 'white', border: '1px solid #e5e7eb', fontSize: 12, color: '#374151', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                      Copiar link
                    </button>
                    <button type="button" onClick={enviarSalaWhatsApp}
                      style={{ flex: 1, padding: '7px 10px', borderRadius: 8, background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                      WhatsApp
                    </button>
                  </div>
                </div>
              )}
              {modal.ag && modal.ag.paciente_id && (
                <div style={{ background: preConsultaEnviada || modal.ag.pre_consulta_enviada ? '#f0fdf4' : '#f0ebff', border: '1px solid ' + (preConsultaEnviada || modal.ag.pre_consulta_enviada ? '#bbf7d0' : '#b9a9ef'), borderRadius: 10, padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={preConsultaEnviada || modal.ag.pre_consulta_enviada ? '#16a34a' : '#6043C1'} strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: preConsultaEnviada || modal.ag.pre_consulta_enviada ? '#16a34a' : '#6043C1', margin: 0 }}>Pré-consulta WhatsApp</p>
                      <p style={{ fontSize: 11, color: '#9ca3af', margin: 0 }}>{preConsultaEnviada || modal.ag.pre_consulta_enviada ? 'Perguntas enviadas ao paciente' : 'Enviar perguntas antes da consulta'}</p>
                    </div>
                  </div>
                  {!(preConsultaEnviada || modal.ag.pre_consulta_enviada) && (
                    <button type="button" onClick={() => enviarPreConsulta(modal.ag.id)} disabled={enviandoPreConsulta}
                      style={{ fontSize: 12, color: '#6043C1', background: 'white', padding: '5px 12px', borderRadius: 7, cursor: 'pointer', fontWeight: 600 }}>
                      {enviandoPreConsulta ? 'Enviando...' : 'Enviar'}
                    </button>
                  )}
                </div>
              )}
              <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
                <button type="submit" disabled={salvando}
                  style={{ flex: 1, padding: '11px', borderRadius: 9, border: 'none', background: '#6043C1', color: 'white', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                  {salvando ? 'Salvando...' : modal.ag ? 'Salvar alterações' : 'Criar agendamento'}
                </button>
                {modal.ag && (
                  <>
                    <button type="button" onClick={() => {
                      const ag = modal.ag
                      const params = new URLSearchParams()
                      if (ag.paciente_id) params.set('paciente_id', ag.paciente_id)
                      if (ag.pacientes?.nome) params.set('paciente_nome', ag.pacientes.nome)
                      if (ag.pacientes?.telefone) params.set('paciente_tel', ag.pacientes.telefone || '')
                      router.push('/nova-consulta?' + params.toString())
                    }}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: 'none', background: '#059669', color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/></svg>
                      Iniciar consulta
                    </button>
                    <button type="button" onClick={() => deletar(modal.ag.id)}
                      style={{ padding: '11px 16px', borderRadius: 9, border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
                    </button>
                  </>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
