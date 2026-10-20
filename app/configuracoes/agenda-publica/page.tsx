'use client'

import { useEffect, useState } from 'react'
import { Stethoscope } from 'lucide-react'
import { EmptyState } from '@/components/ui'
import { supabase } from '@/lib/supabase'
import { useMedicoLogado } from '@/lib/agenda-publica/use-medico'
import { CONFIG_DEFAULT, parseConfig, type AgendaConfig } from '@/lib/agenda-publica/slots'
import { normalizarSlug, validarFormatoSlug } from '@/lib/agenda-publica/slug'
import { listarTemplatesClinica } from '@/lib/formularios/templates'
import type { Template } from '@/lib/formularios/types'
import Conteudo from './Conteudo'
import { confirmar } from '@/components/ui/dialogos'
import { avisoDemo, ehDemo, MEDICO_DEMO } from '@/lib/demo'
import { TEMPLATES_DEMO } from '@/app/formularios/demo'

/** Demonstração: pedidos de exemplo vindos da agenda online. */
function solicitacoesDemo() {
  const em = (dias: number, h: number) => { const d = new Date(); d.setDate(d.getDate() + dias); d.setHours(h, 0, 0, 0); return d.toISOString() }
  return [
    { id: 'demo-sol-1', nome_paciente: 'Larissa Gomes', telefone: '(11) 90000-2001', email: 'larissa@exemplo.com.br', data_hora: em(2, 9), motivo: 'Check-up anual', primeira_consulta: true, status: 'aguardando_confirmacao', criada_em: em(0, 8) },
    { id: 'demo-sol-2', nome_paciente: 'Paulo Henrique Souza', telefone: '(11) 90000-1007', email: null, data_hora: em(3, 14), motivo: 'Retorno com exames', primeira_consulta: false, status: 'aguardando_confirmacao', criada_em: em(-1, 19) },
  ]
}

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

export default function AgendaPublicaPage() {
  const { 
    tipo, 
    medicoAtivo, 
    medicosDisponiveis, 
    trocarMedicoAtivo, 
    atualizarMedicoAtivo, 
    loading: loadingAuth 
  } = useMedicoLogado()
  
  const [ativa, setAtiva] = useState(false)
  const [slug, setSlug] = useState('')
  const [config, setConfig] = useState<AgendaConfig>(CONFIG_DEFAULT)
  const [usarAlmoco, setUsarAlmoco] = useState(true)
  
  const [salvando, setSalvando] = useState(false)
  const [mensagem, setMensagem] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)
  
  const [validandoSlug, setValidandoSlug] = useState(false)
  const [statusSlug, setStatusSlug] = useState<'ok' | 'erro' | 'idle'>('idle')
  const [erroSlug, setErroSlug] = useState<string | null>(null)
  const [sugestaoSlug, setSugestaoSlug] = useState<string | null>(null)
  
  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoPendente[]>([])
  const [loadingSolicitacoes, setLoadingSolicitacoes] = useState(false)
  
  const [copiado, setCopiado] = useState(false)
  const [templates, setTemplates] = useState<Template[]>([])

  useEffect(() => {
    if (!medicoAtivo) return
    setAtiva(medicoAtivo.agenda_publica_ativa || false)
    setSlug(medicoAtivo.slug_publico || normalizarSlug(medicoAtivo.nome || ''))
    const cfg = parseConfig(medicoAtivo.agenda_publica_config)
    setConfig(cfg)
    setUsarAlmoco(cfg.intervalo_almoco !== null)
    setMensagem(null)
    setStatusSlug('idle')
    setErroSlug(null)
    setSugestaoSlug(null)
    carregarSolicitacoes(medicoAtivo.id)
    if (ehDemo()) { setTemplates(TEMPLATES_DEMO); return }
    if (medicoAtivo.clinica_id) {
      listarTemplatesClinica(medicoAtivo.clinica_id).then(setTemplates)
    }
  }, [medicoAtivo?.id])

  async function carregarSolicitacoes(medicoId: string) {
    if (ehDemo()) { setSolicitacoes(medicoId === MEDICO_DEMO.id ? solicitacoesDemo() : []); return }
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

  useEffect(() => {
    if (!medicoAtivo || !slug || slug === medicoAtivo.slug_publico) {
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

    // Demonstração: não consulta o servidor
    if (ehDemo()) { setStatusSlug('ok'); setErroSlug(null); setSugestaoSlug(null); return }

    setValidandoSlug(true)
    const timeoutId = setTimeout(async () => {
      try {
        const res = await fetch('/api/agenda-publica/check-slug', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug, tipo: 'medico', id: medicoAtivo.id }),
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
        setErroSlug('Não foi possível conferir este endereço agora. Tente de novo.')
      } finally {
        setValidandoSlug(false)
      }
    }, 500)

    return () => clearTimeout(timeoutId)
  }, [slug, medicoAtivo])

  async function salvar() {
    if (!medicoAtivo) return
    if (statusSlug === 'erro') {
      setMensagem({ tipo: 'erro', texto: 'Corrija o link público antes de salvar.' })
      return
    }

    if (ehDemo()) {
      atualizarMedicoAtivo({ slug_publico: slug, agenda_publica_ativa: ativa, agenda_publica_config: { ...config, intervalo_almoco: usarAlmoco ? config.intervalo_almoco : null } })
      avisoDemo(); return
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
        .eq('id', medicoAtivo.id)

      if (error) throw error

      atualizarMedicoAtivo(updates)
      setMensagem({ tipo: 'ok', texto: 'Configurações salvas com sucesso.' })
    } catch (e: any) {
      setMensagem({ tipo: 'erro', texto: e.message || 'Não foi possível salvar. Confira a conexão e tente de novo.' })
    } finally {
      setSalvando(false)
    }
  }

  // Confirmar/rejeitar pelo servidor: liga (ou cadastra) o paciente pelo telefone e cria o agendamento
  async function responderSolicitacao(s: SolicitacaoPendente, acao: 'confirmar' | 'rejeitar') {
    const r = await fetch('/api/agenda-publica/pedidos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: s.id, acao }) })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(j.error || 'Não foi possível responder o pedido.')
  }

  async function confirmarSolicitacao(s: SolicitacaoPendente) {
    if (!medicoAtivo) return
    if (ehDemo()) { setSolicitacoes(l => l.filter(x => x.id !== s.id)); avisoDemo(); return }
    try {
      await responderSolicitacao(s, 'confirmar')
      carregarSolicitacoes(medicoAtivo.id)
      setMensagem({ tipo: 'ok', texto: 'Consulta confirmada e adicionada à agenda.' })
    } catch (e: any) {
      setMensagem({ tipo: 'erro', texto: e.message || 'Erro ao confirmar' })
    }
  }

  async function rejeitarSolicitacao(s: SolicitacaoPendente) {
    if (!(await confirmar({ titulo: 'Recusar este pedido?', mensagem: 'O horário volta a ficar livre na agenda online. Se quiser, avise o paciente pelo Chat.', confirmar: 'Recusar', perigo: true }))) return
    if (ehDemo()) { setSolicitacoes(l => l.filter(x => x.id !== s.id)); avisoDemo(); return }
    try {
      await responderSolicitacao(s, 'rejeitar')
      if (medicoAtivo) carregarSolicitacoes(medicoAtivo.id)
      setMensagem({ tipo: 'ok', texto: 'Pedido recusado.' })
    } catch (e: any) {
      setMensagem({ tipo: 'erro', texto: e.message || 'Erro ao recusar' })
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

  // Loading inicial
  if (loadingAuth) {
    return (
      <Carregando />
    )
  }

  // Admin sem médicos
  if (tipo === 'admin' && medicosDisponiveis.length === 0) {
    return (
      <div style={{ padding: 20 }}>
        <EmptyState
          icon={Stethoscope}
          titulo="Nenhum médico cadastrado"
          descricao="Cadastre os médicos em Equipe antes de configurar a agenda online."
        />
      </div>
    )
  }

  if (!medicoAtivo) {
    return (
      <Carregando />
    )
  }

  return (
    <Conteudo
      medico={medicoAtivo}
      medicosDisponiveis={tipo === 'admin' ? medicosDisponiveis : []}
      trocarMedicoAtivo={trocarMedicoAtivo}
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
      templates={templates}
    />
  )
}


function Carregando() {
  return (
    <div style={{ padding: 20, display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: 16 }}>
      <div className="c360-skel" style={{ height: 40, width: 360, maxWidth: '100%', borderRadius: 10 }} />
      <div className="c360-skel" style={{ height: 120, borderRadius: 16 }} />
      <div className="c360-skel" style={{ height: 260, borderRadius: 16 }} />
    </div>
  )
}
