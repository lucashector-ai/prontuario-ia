'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Sidebar } from '@/components/Sidebar'
import { Topbar } from '@/components/Topbar'
import { tokens } from '@/lib/design-tokens'
import { supabase } from '@/lib/supabase'
import { useMedicoLogado } from '@/lib/agenda-publica/use-medico'
import { CONFIG_DEFAULT, parseConfig, type AgendaConfig } from '@/lib/agenda-publica/slots'
import { normalizarSlug, validarFormatoSlug } from '@/lib/agenda-publica/slug'
import Conteudo from './Conteudo'

type SolicitacaoPendente = {
  id: string
  nome_paciente: string
  telefone: string
  email: string | null
  data_hora: string
  motivo: string | null
  primeira_consulta: boolean
  status: string
  criada_em: string
}

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

const HORAS = Array.from({ length: 24 }, (_, h) => {
  return [`${String(h).padStart(2, '0')}:00`, `${String(h).padStart(2, '0')}:30`]
}).flat()

export default function AgendaPublicaPage() {
  const router = useRouter()
  const { medico, setMedico, loading: loadingMedico } = useMedicoLogado()
  
  // Estado da agenda
  const [ativa, setAtiva] = useState(false)
  const [slug, setSlug] = useState('')
  const [config, setConfig] = useState<AgendaConfig>(CONFIG_DEFAULT)
  const [usarAlmoco, setUsarAlmoco] = useState(true)
  
  // Estado de UI
  const [salvando, setSalvando] = useState(false)
  const [mensagem, setMensagem] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)
  
  // Validação de slug
  const [validandoSlug, setValidandoSlug] = useState(false)
  const [statusSlug, setStatusSlug] = useState<'ok' | 'erro' | 'idle'>('idle')
  const [erroSlug, setErroSlug] = useState<string | null>(null)
  const [sugestaoSlug, setSugestaoSlug] = useState<string | null>(null)
  
  // Solicitações pendentes
  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoPendente[]>([])
  const [loadingSolicitacoes, setLoadingSolicitacoes] = useState(false)
  
  const [copiado, setCopiado] = useState(false)

  // Carrega dados iniciais do médico
  useEffect(() => {
    if (!medico) return
    setAtiva(medico.agenda_publica_ativa || false)
    setSlug(medico.slug_publico || normalizarSlug(medico.nome || ''))
    const cfg = parseConfig(medico.agenda_publica_config)
    setConfig(cfg)
    setUsarAlmoco(cfg.intervalo_almoco !== null)
    carregarSolicitacoes(medico.id)
  }, [medico])

  // Carrega solicitações pendentes
  async function carregarSolicitacoes(medicoId: string) {
    setLoadingSolicitacoes(true)
    try {
      const { data } = await supabase
        .from('agenda_publica_solicitacoes')
        .select('*')
        .eq('medico_id', medicoId)
        .eq('status', 'aguardando_confirmacao')
        .order('data_hora', { ascending: true })
      
      setSolicitacoes(data || [])
    } finally {
      setLoadingSolicitacoes(false)
    }
  }

  // Validação de slug em tempo real (debounce)
  useEffect(() => {
    if (!medico || !slug || slug === medico.slug_publico) {
      setStatusSlug('idle')
      setErroSlug(null)
      setSugestaoSlug(null)
      return
    }

    const formato = validarFormatoSlug(slug)
    if (!formato.valido) {
      setStatusSlug('erro')
      setErroSlug(formato.erro || 'Formato inválido')
      setSugestaoSlug(null)
      return
    }

    setValidandoSlug(true)
    const timeoutId = setTimeout(async () => {
      try {
        const res = await fetch('/api/agenda-publica/check-slug', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug, tipo: 'medico', id: medico.id }),
        })
        const data = await res.json()
        if (data.disponivel) {
          setStatusSlug('ok')
          setErroSlug(null)
          setSugestaoSlug(null)
        } else {
          setStatusSlug('erro')
          setErroSlug(data.erro)
          setSugestaoSlug(data.sugestao || null)
        }
      } catch (e: any) {
        setStatusSlug('erro')
        setErroSlug('Erro ao validar')
      } finally {
        setValidandoSlug(false)
      }
    }, 500)

    return () => clearTimeout(timeoutId)
  }, [slug, medico])

  // Salvar configurações
  async function salvar() {
    if (!medico) return
    if (statusSlug === 'erro') {
      setMensagem({ tipo: 'erro', texto: 'Corrija o link público antes de salvar.' })
      return
    }

    setSalvando(true)
    setMensagem(null)

    try {
      const configFinal: AgendaConfig = {
        ...config,
        intervalo_almoco: usarAlmoco ? config.intervalo_almoco : null,
      }

      const updates: any = {
        slug_publico: slug,
        agenda_publica_ativa: ativa,
        agenda_publica_config: configFinal,
      }

      const { error } = await supabase
        .from('medicos')
        .update(updates)
        .eq('id', medico.id)

      if (error) throw error

      const novoMedico = { ...medico, ...updates }
      setMedico(novoMedico)
      localStorage.setItem('medico', JSON.stringify(novoMedico))

      setMensagem({ tipo: 'ok', texto: 'Configurações salvas com sucesso.' })
    } catch (e: any) {
      setMensagem({ tipo: 'erro', texto: e.message || 'Erro ao salvar' })
    } finally {
      setSalvando(false)
    }
  }

  // Confirmar solicitação manualmente
  async function confirmarSolicitacao(s: SolicitacaoPendente) {
    if (!medico) return
    try {
      const observacoes = 'Agendado via link público. Paciente: ' + s.nome_paciente + ' · ' + s.telefone + (s.email ? ' · ' + s.email : '')
      
      const { data: agendamento } = await supabase
        .from('agendamentos')
        .insert({
          medico_id: medico.id,
          data_hora: s.data_hora,
          tipo: 'consulta',
          status: 'agendado',
          motivo: s.motivo,
          duracao: String(config.duracao_consulta_min),
          observacoes,
        })
        .select()
        .single()

      await supabase
        .from('agenda_publica_solicitacoes')
        .update({ 
          status: 'confirmado',
          agendamento_id: agendamento?.id 
        })
        .eq('id', s.id)

      carregarSolicitacoes(medico.id)
      setMensagem({ tipo: 'ok', texto: 'Consulta confirmada e adicionada à agenda.' })
    } catch (e: any) {
      setMensagem({ tipo: 'erro', texto: e.message || 'Erro ao confirmar' })
    }
  }

  async function rejeitarSolicitacao(s: SolicitacaoPendente) {
    if (!confirm('Rejeitar essa solicitação? O paciente será notificado.')) return
    try {
      await supabase
        .from('agenda_publica_solicitacoes')
        .update({ status: 'rejeitado' })
        .eq('id', s.id)
      
      if (medico) carregarSolicitacoes(medico.id)
      setMensagem({ tipo: 'ok', texto: 'Solicitação rejeitada.' })
    } catch (e: any) {
      setMensagem({ tipo: 'erro', texto: e.message || 'Erro ao rejeitar' })
    }
  }

  function copiarLink() {
    const url = 'https://clinical360.vercel.app/agenda/' + slug
    navigator.clipboard.writeText(url)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  function aplicarSugestao() {
    if (sugestaoSlug) {
      setSlug(sugestaoSlug)
      setSugestaoSlug(null)
    }
  }

  function toggleDiaSemana(dia: number) {
    const novoDias = config.dias_semana.includes(dia)
      ? config.dias_semana.filter(d => d !== dia)
      : [...config.dias_semana, dia].sort((a, b) => a - b)
    setConfig({ ...config, dias_semana: novoDias })
  }

  if (loadingMedico || !medico) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 32, height: 32, border: `2px solid ${tokens.brand.primary}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{'@keyframes spin { to { transform: rotate(360deg) } }'}</style>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', height: '100vh', background: tokens.bg.page, overflow: 'hidden' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' as const, overflow: 'hidden' }}>
        <Topbar />
        <main style={{ flex: 1, overflow: 'auto', padding: '32px 32px 64px' }}>
          <Conteudo
            medico={medico}
            ativa={ativa}
            setAtiva={setAtiva}
            slug={slug}
            setSlug={setSlug}
            config={config}
            setConfig={setConfig}
            usarAlmoco={usarAlmoco}
            setUsarAlmoco={setUsarAlmoco}
            salvar={salvar}
            salvando={salvando}
            mensagem={mensagem}
            statusSlug={statusSlug}
            validandoSlug={validandoSlug}
            erroSlug={erroSlug}
            sugestaoSlug={sugestaoSlug}
            aplicarSugestao={aplicarSugestao}
            copiado={copiado}
            copiarLink={copiarLink}
            toggleDiaSemana={toggleDiaSemana}
            solicitacoes={solicitacoes}
            loadingSolicitacoes={loadingSolicitacoes}
            confirmarSolicitacao={confirmarSolicitacao}
            rejeitarSolicitacao={rejeitarSolicitacao}
          />
        </main>
      </div>
    </div>
  )
}


