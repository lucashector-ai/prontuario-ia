'use client'

import { useEffect, useState } from 'react'
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
  }, [medicoAtivo?.id])

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
        setErroSlug('Erro ao validar')
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
      setMensagem({ tipo: 'erro', texto: e.message || 'Erro ao salvar' })
    } finally {
      setSalvando(false)
    }
  }

  async function confirmarSolicitacao(s: SolicitacaoPendente) {
    if (!medicoAtivo) return
    try {
      const observacoes = 'Agendado via link público. Paciente: ' + s.nome_paciente + ' · ' + s.telefone + (s.email ? ' · ' + s.email : '')
      
      const { data: agendamento } = await supabase
        .from('agendamentos')
        .insert({
          medico_id: medicoAtivo.id,
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

      carregarSolicitacoes(medicoAtivo.id)
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
      
      if (medicoAtivo) carregarSolicitacoes(medicoAtivo.id)
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

  // Loading inicial
  if (loadingAuth) {
    return (
      <div style={{ padding: '64px 0', display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: 32, height: 32, border: '2px solid ' + tokens.brand.primary, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{'@keyframes spin { to { transform: rotate(360deg) } }'}</style>
      </div>
    )
  }

  // Admin sem médicos
  if (tipo === 'admin' && medicosDisponiveis.length === 0) {
    return (
      <div style={{ maxWidth: 640, margin: '64px auto', textAlign: 'center', padding: 32, background: '#fff', borderRadius: 16, border: '1px solid ' + tokens.border.default }}>
        <h2 style={{ fontSize: 22, fontWeight: 600, color: tokens.text.primary, marginBottom: 8 }}>Nenhum médico cadastrado</h2>
        <p style={{ fontSize: 14, color: tokens.text.secondary, lineHeight: 1.5 }}>
          Cadastre médicos no Painel admin antes de configurar a agenda pública.
        </p>
      </div>
    )
  }

  if (!medicoAtivo) {
    return (
      <div style={{ padding: '64px 0', display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: 32, height: 32, border: '2px solid ' + tokens.brand.primary, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{'@keyframes spin { to { transform: rotate(360deg) } }'}</style>
      </div>
    )
  }

  return (
    <div style={{ padding: '32px 32px 64px' }}>
      {tipo === 'admin' && medicosDisponiveis.length > 0 && (
        <div style={{ maxWidth: 880, margin: '0 auto 24px' }}>
          <SeletorMedico 
            medicos={medicosDisponiveis} 
            medicoAtivoId={medicoAtivo.id}
            onChange={trocarMedicoAtivo}
          />
        </div>
      )}
      <Conteudo
        medico={medicoAtivo}
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
    </div>
  )
}

function SeletorMedico({ medicos, medicoAtivoId, onChange }: any) {
  return (
    <div style={{
      background: '#fff',
      border: '1px solid ' + tokens.border.default,
      borderRadius: 12,
      padding: 16,
      display: 'flex',
      alignItems: 'center',
      gap: 12,
    }}>
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
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: tokens.text.tertiary, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>
          Configurando agenda de
        </div>
        <select
          value={medicoAtivoId}
          onChange={(e) => onChange(e.target.value)}
          style={{
            width: '100%',
            padding: '4px 0',
            fontSize: 15,
            fontWeight: 600,
            color: tokens.text.primary,
            border: 'none',
            background: 'transparent',
            outline: 'none',
            cursor: 'pointer',
          }}
        >
          {medicos.map((m: any) => (
            <option key={m.id} value={m.id}>
              {m.nome}{m.especialidade ? ' · ' + m.especialidade : ''}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
