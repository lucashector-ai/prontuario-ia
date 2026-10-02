'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Conversa, EtapaId, Mensagem, RespostaRapida } from './tipos'
import { faltaMigration, nomeDe } from './tipos'
import { confirmar } from '@/components/ui/dialogos'

import { registrarAcesso } from '@/lib/auditoria'
/**
 * Estado e ações do Chat omnicanal.
 * Identificação do usuário (mesma regra do antigo /whatsapp-app):
 *   clinica_admin / recepcionista → caixa do 1º médico ativo da clínica
 *   médico → a própria caixa; atendente (localStorage.atendente) → caixa do médico dele
 */
export function useChat() {
  const router = useRouter()
  const [medico, setMedico] = useState<any>(null)
  const [usuario, setUsuario] = useState<any>(null)
  const [clinicaNome, setClinicaNome] = useState<string>('')
  const [config, setConfig] = useState<any>(null)
  const [atendentes, setAtendentes] = useState<any[]>([])
  const [conversas, setConversas] = useState<Conversa[]>([])
  const [carregando, setCarregando] = useState(true)
  const [ativaId, setAtivaId] = useState<string | null>(null)
  const [mensagens, setMensagens] = useState<Mensagem[]>([])
  const [respostas, setRespostas] = useState<RespostaRapida[]>([])
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<any>(null)
  const ativaRef = useRef<string | null>(null)
  const conversasRef = useRef<Conversa[]>([])
  ativaRef.current = ativaId
  // Modo demonstração (/chat?demo=1): conversas de exemplo, nada é gravado no banco — para prints/apresentação
  const demo = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('demo') === '1'

  const avisar = useCallback((t: string) => {
    clearTimeout(toastTimer.current)
    setToast(t)
    toastTimer.current = setTimeout(() => setToast(null), 2600)
  }, [])

  const tratarErro = useCallback((erro: any, acao: string) => {
    if (!erro) return false
    avisar(faltaMigration(erro)
      ? `${acao} · rode a migration 0009_chat_omnicanal no Supabase`
      : `${acao} · ${erro.message || 'erro'}`)
    return true
  }, [avisar])

  // ── Bootstrap ────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const primeiroMedicoDa = async (clinicaId: string) => (await supabase
        .from('medicos').select('*').eq('clinica_id', clinicaId).eq('cargo', 'medico').eq('ativo', true)
        .order('criado_em', { ascending: true }).limit(1).maybeSingle()).data

      const ca = localStorage.getItem('clinica_admin')
      const c = localStorage.getItem('clinica')
      if (c) try { setClinicaNome(JSON.parse(c).nome || '') } catch {}
      let med: any = null
      if (ca) {
        const admin = JSON.parse(ca)
        if (!admin.clinica_id) { router.push('/login'); return }
        setUsuario(admin)
        med = await primeiroMedicoDa(admin.clinica_id)
      } else {
        const m = localStorage.getItem('medico')
        if (!m) { router.push('/login'); return }
        const parsed = JSON.parse(m)
        if (parsed.cargo === 'recepcionista') {
          setUsuario(parsed)
          med = parsed.clinica_id ? await primeiroMedicoDa(parsed.clinica_id) : null
        } else {
          med = parsed
          const at = localStorage.getItem('atendente')
          setUsuario(at ? JSON.parse(at) : parsed)
        }
      }
      if (!med) { setCarregando(false); return }
      setMedico(med)
      supabase.from('whatsapp_config').select('*').eq('medico_id', med.id).maybeSingle().then(({ data }) => setConfig(data))
      if (demo) {
        setAtendentes([{ nome: 'Recepção Ana', ativo: true }, { nome: 'Carla (atendimento)', ativo: true }])
        setRespostas([
          { id: 'r1', atalho: 'horarios', texto: 'Atendemos de segunda a sexta, das 8h às 18h, e aos sábados das 8h às 12h.' },
          { id: 'r2', atalho: 'endereco', texto: 'Estamos na Av. Paulista, 1000 — conj. 52. Há estacionamento conveniado no prédio.' },
          { id: 'r3', atalho: 'valor', texto: 'A consulta particular custa R$ 350. Aceitamos Pix, cartão e os principais convênios.' },
        ])
        return
      }
      fetch('/api/atendentes?medico_id=' + med.id).then(r => r.json()).then(d => setAtendentes(d.atendentes || [])).catch(() => {})
      supabase.from('chat_respostas_rapidas').select('id, atalho, texto').eq('medico_id', med.id).order('atalho')
        .then(({ data }) => setRespostas(data || []))
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  // ── Conversas ────────────────────────────────────────────────────────────
  const carregarConversas = useCallback(async () => {
    if (!medico) return
    if (demo) { setConversas(prev => prev.length ? prev : conversasDemo(medico)); setCarregando(false); return }
    const { data } = await supabase.from('whatsapp_conversas')
      .select('*, whatsapp_mensagens(conteudo, criado_em, tipo, lida, metadata)')
      .eq('medico_id', medico.id)
      .order('ultimo_contato', { ascending: false })
    if (!data) { setCarregando(false); return }
    // Deduplica por canal+telefone (mantém a mais recente) — mesmo critério do app antigo
    const mapa = new Map<string, any>()
    data.forEach((cv: any) => {
      const k = (cv.canal || 'whatsapp') + ':' + cv.telefone
      const ex = mapa.get(k)
      if (!ex || new Date(cv.ultimo_contato) > new Date(ex.ultimo_contato)) mapa.set(k, cv)
    })
    setConversas(Array.from(mapa.values()).map((cv: any) => {
      const msgs = (cv.whatsapp_mensagens || []).filter((m: any) => m.metadata?.nota !== true)
      const ultima = msgs.sort((a: any, b: any) => new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime())[0]
      const { whatsapp_mensagens, ...resto } = cv
      return { ...resto, ultima, naoLidas: msgs.filter((m: any) => !m.lida && m.tipo === 'recebida').length }
    }))
    setCarregando(false)
  }, [medico, demo])

  const carregarMensagens = useCallback(async (id: string, marcarLidas = true) => {
    if (demo) {
      setMensagens(prev => prev.length && prev[0].conversa_id === id ? prev : mensagensDemo(id, medico?.nome))
      setConversas(p => p.map(c => c.id === id ? { ...c, naoLidas: 0 } : c))
      return
    }
    const { data } = await supabase.from('whatsapp_mensagens').select('*').eq('conversa_id', id).order('criado_em', { ascending: true })
    if (ativaRef.current !== id) return
    setMensagens(data || [])
    if (marcarLidas && (data || []).some((m: any) => m.tipo === 'recebida' && !m.lida)) {
      await supabase.from('whatsapp_mensagens').update({ lida: true }).eq('conversa_id', id).eq('tipo', 'recebida')
      setConversas(p => p.map(c => c.id === id ? { ...c, naoLidas: 0 } : c))
    }
  }, [demo, medico])

  useEffect(() => { carregarConversas() }, [carregarConversas])

  // Realtime + polling de segurança (o realtime pode não estar habilitado nas tabelas)
  useEffect(() => {
    if (!medico || demo) return
    const canal = supabase.channel('chat-omnicanal-' + medico.id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_conversas', filter: `medico_id=eq.${medico.id}` }, () => carregarConversas())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'whatsapp_mensagens' }, (p: any) => {
        if (p.new?.conversa_id === ativaRef.current) carregarMensagens(p.new.conversa_id)
        carregarConversas()
      })
      .subscribe()
    const tLista = setInterval(carregarConversas, 6000)
    const tMsgs = setInterval(() => { if (ativaRef.current) carregarMensagens(ativaRef.current) }, 3000)
    return () => { supabase.removeChannel(canal); clearInterval(tLista); clearInterval(tMsgs) }
  }, [medico, demo, carregarConversas, carregarMensagens])

  const abrir = useCallback((id: string | null) => {
    setAtivaId(id)
    setMensagens([])
    if (id) {
      carregarMensagens(id)
      if (!demo) {
        const c = conversasRef.current.find(x => x.id === id)
        registrarAcesso({ acao: 'visualizou', recurso: 'conversa', recursoId: id, pacienteId: c?.paciente_id || null })
      }
    }
  }, [carregarMensagens, demo])

  conversasRef.current = conversas
  const ativa = conversas.find(c => c.id === ativaId) || null
  const nomeUsuario = usuario?.nome || medico?.nome || ''

  // ── Ações da conversa ──────────────────────────────────────────────────────
  const atualizar = useCallback(async (id: string, campos: Partial<Conversa>, acao: string) => {
    const antes = conversas
    setConversas(p => p.map(c => c.id === id ? { ...c, ...campos } : c))
    if (demo) return true
    const { error } = await supabase.from('whatsapp_conversas').update(campos).eq('id', id)
    if (tratarErro(error, acao)) { setConversas(antes); return false }
    return true
  }, [conversas, tratarErro, demo])

  const enviar = useCallback(async (texto: string) => {
    if (!ativa || !texto.trim()) return
    const conteudo = texto.trim()
    if (demo) {
      const m: any = { id: 'd' + Date.now(), conversa_id: ativa.id, tipo: 'enviada', conteudo, criado_em: new Date().toISOString(), metadata: { manual: true, remetente: nomeUsuario } }
      setMensagens(p => [...p, m])
      setConversas(p => p.map(c => c.id === ativa.id ? { ...c, ultima: m, ultimo_contato: m.criado_em } : c))
      return
    }
    const { data: nova, error } = await supabase.from('whatsapp_mensagens').insert({
      conversa_id: ativa.id, tipo: 'enviada', conteudo, metadata: { manual: true, remetente: nomeUsuario, canal: ativa.canal || 'whatsapp' },
    }).select().single()
    if (error) { avisar('Não foi possível enviar'); return }
    setMensagens(p => [...p, nova])
    // No modo humano o nome do atendente vai em negrito no começo (igual ao app antigo)
    const entrega = ativa.modo === 'humano' && nomeUsuario ? `*${nomeUsuario}:* ${conteudo}` : conteudo
    const r = await fetch('/api/chat/enviar', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversa_id: ativa.id, texto: entrega }),
    }).then(x => x.json()).catch(() => ({ error: 'Falha de rede' }))
    if (r?.error) {
      await supabase.from('whatsapp_mensagens').update({ metadata: { ...nova.metadata, falhou: true, erro: r.error } }).eq('id', nova.id)
      setMensagens(p => p.map(m => m.id === nova.id ? { ...m, metadata: { ...m.metadata, falhou: true, erro: r.error } } : m))
      avisar('Não entregue · ' + r.error)
    }
    await supabase.from('whatsapp_conversas').update({ ultimo_contato: new Date().toISOString() }).eq('id', ativa.id)
  }, [ativa, nomeUsuario, avisar, demo])

  const anotar = useCallback(async (texto: string) => {
    if (!ativa || !texto.trim()) return
    if (demo) {
      setMensagens(p => [...p, { id: 'd' + Date.now(), conversa_id: ativa.id, tipo: 'enviada', conteudo: texto.trim(), criado_em: new Date().toISOString(), metadata: { nota: true, remetente: nomeUsuario } } as any])
      avisar('Nota interna salva · só a equipe vê'); return
    }
    const { data: nova, error } = await supabase.from('whatsapp_mensagens').insert({
      conversa_id: ativa.id, tipo: 'enviada', conteudo: texto.trim(), lida: true,
      metadata: { nota: true, remetente: nomeUsuario },
    }).select().single()
    if (error) { avisar('Não foi possível salvar a nota'); return }
    setMensagens(p => [...p, nova])
    avisar('Nota interna salva · só a equipe vê')
  }, [ativa, nomeUsuario, avisar, demo])

  const mudarEtapa = (c: Conversa, etapa: EtapaId) => {
    const extra: Partial<Conversa> = etapa === 'concluido' ? { status: 'encerrada' } : (c.status === 'encerrada' ? { status: 'ativa' } : {})
    return atualizar(c.id, { etapa, ...extra }, 'Mover etapa').then(ok => { if (ok) avisar('Etapa atualizada') })
  }

  const transferir = async (c: Conversa, nome: string | null) => {
    const ok = await atualizar(c.id, nome ? { atendente_nome: nome, modo: 'humano' } : { atendente_nome: null }, 'Transferir')
    if (ok) avisar(nome ? `Transferida · ${nome}` : 'Conversa sem atendente')
  }
  const assumir = (c: Conversa) => transferir(c, nomeUsuario)
  const devolverIA = async (c: Conversa) => {
    const ok = await atualizar(c.id, { modo: 'ia', atendente_nome: null }, 'Devolver para a Sofia')
    if (ok) avisar('Sofia IA voltou a responder')
  }

  const marcarNaoLida = async (c: Conversa) => {
    if (demo) { setConversas(p => p.map(x => x.id === c.id ? { ...x, naoLidas: Math.max(1, x.naoLidas) } : x)); if (ativaId === c.id) setAtivaId(null); return }
    const { data } = await supabase.from('whatsapp_mensagens').select('id').eq('conversa_id', c.id).eq('tipo', 'recebida')
      .order('criado_em', { ascending: false }).limit(1)
    if (data?.[0]) await supabase.from('whatsapp_mensagens').update({ lida: false }).eq('id', data[0].id)
    setConversas(p => p.map(x => x.id === c.id ? { ...x, naoLidas: Math.max(1, x.naoLidas) } : x))
    if (ativaId === c.id) setAtivaId(null)
  }
  const fixar = (c: Conversa) => atualizar(c.id, { fixada: !c.fixada }, 'Fixar').then(ok => ok && avisar(c.fixada ? 'Conversa desafixada' : 'Fixada no topo'))
  const arquivar = (c: Conversa) => atualizar(c.id, { arquivada: !c.arquivada }, 'Arquivar').then(ok => {
    if (!ok) return
    avisar(c.arquivada ? 'Conversa desarquivada' : 'Conversa arquivada')
    if (!c.arquivada && ativaId === c.id) setAtivaId(null)
  })
  const silenciar = (c: Conversa, horas: number | null) => {
    const ate = horas === null ? null : horas === Infinity ? 'infinity' : new Date(Date.now() + horas * 3600_000).toISOString()
    return atualizar(c.id, { silenciada_ate: ate }, 'Silenciar').then(ok => ok && avisar(ate ? 'Conversa silenciada' : 'Som reativado'))
  }
  const bloquear = async (c: Conversa) => {
    if (!c.bloqueada && !(await confirmar({ titulo: `Bloquear ${nomeDe(c)}?`, mensagem: 'A Sofia e a equipe não poderão mais enviar mensagens para este contato. Você pode desbloquear depois.', confirmar: 'Bloquear', perigo: true }))) return
    return atualizar(c.id, { bloqueada: !c.bloqueada, ...(c.bloqueada ? {} : { modo: 'humano' as const }) }, 'Bloquear')
      .then(ok => ok && avisar(c.bloqueada ? 'Contato desbloqueado' : 'Contato bloqueado'))
  }
  const exportar = async (c: Conversa) => {
    const { data } = demo ? { data: mensagensDemo(c.id, medico?.nome) } : await supabase.from('whatsapp_mensagens').select('*').eq('conversa_id', c.id).order('criado_em')
    const linhas = (data || []).map((m: any) => {
      const quem = m.metadata?.nota ? '[NOTA] ' + (m.metadata?.remetente || 'Equipe')
        : m.tipo === 'recebida' ? nomeDe(c) : (m.metadata?.ia ? 'Sofia IA' : m.metadata?.remetente || 'Clínica')
      return `[${new Date(m.criado_em).toLocaleString('pt-BR')}] ${quem}: ${m.conteudo}`
    })
    const blob = new Blob([linhas.join('\n')], { type: 'text/plain;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `conversa-${nomeDe(c).replace(/\W+/g, '-').toLowerCase()}.txt`
    a.click()
    avisar('Conversa exportada')
  }
  const limpar = async (c: Conversa) => {
    if (!(await confirmar({ titulo: 'Limpar esta conversa?', mensagem: 'Todas as mensagens serão apagadas. A conversa continua na lista.', confirmar: 'Limpar', perigo: true }))) return
    if (demo) { if (ativaId === c.id) setMensagens([]); avisar('Conversa limpa'); return }
    await supabase.from('whatsapp_mensagens').delete().eq('conversa_id', c.id)
    if (ativaId === c.id) setMensagens([])
    carregarConversas()
    avisar('Conversa limpa')
  }
  const apagar = async (c: Conversa) => {
    if (!(await confirmar({ titulo: `Apagar a conversa com ${nomeDe(c)}?`, mensagem: 'A conversa e todas as mensagens serão removidas. Essa ação não pode ser desfeita.', confirmar: 'Apagar', perigo: true }))) return
    if (demo) { if (ativaId === c.id) setAtivaId(null); setConversas(p => p.filter(x => x.id !== c.id)); avisar('Conversa apagada'); return }
    await supabase.from('whatsapp_mensagens').delete().eq('conversa_id', c.id)
    await supabase.from('whatsapp_conversas').delete().eq('id', c.id)
    if (ativaId === c.id) setAtivaId(null)
    setConversas(p => p.filter(x => x.id !== c.id))
    avisar('Conversa apagada')
  }

  const novaConversa = async (telefone: string, nome: string, texto: string) => {
    if (!medico) return
    const tel = telefone.replace(/\D/g, '')
    if (demo) {
      const id = 'd' + Date.now(), agora = new Date().toISOString()
      const ultima: any = texto.trim() ? { conteudo: texto.trim(), criado_em: agora, tipo: 'enviada' } : undefined
      setConversas(p => [{ id, medico_id: medico.id, telefone: tel, nome_contato: nome || null, ultimo_contato: agora, modo: 'humano', atendente_nome: nomeUsuario, canal: 'whatsapp', etapa: 'novo', naoLidas: 0, ultima } as any, ...p])
      setAtivaId(id); setMensagens(ultima ? [{ id: id + 'm', conversa_id: id, ...ultima, metadata: { manual: true, remetente: nomeUsuario } }] : [])
      avisar('Conversa iniciada'); return
    }
    const { data: cv, error } = await supabase.from('whatsapp_conversas').insert({
      medico_id: medico.id, telefone: tel, nome_contato: nome || null, modo: 'humano', atendente_nome: nomeUsuario,
      status: 'ativa', ultimo_contato: new Date().toISOString(), canal: 'whatsapp',
    }).select().single()
    if (error || !cv) { avisar('Não foi possível criar a conversa'); return }
    await carregarConversas()
    setAtivaId(cv.id)
    if (texto.trim()) {
      const { data: nova } = await supabase.from('whatsapp_mensagens').insert({
        conversa_id: cv.id, tipo: 'enviada', conteudo: texto.trim(), metadata: { manual: true, remetente: nomeUsuario, canal: 'whatsapp' },
      }).select().single()
      if (nova) setMensagens([nova])
      const r = await fetch('/api/chat/enviar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conversa_id: cv.id, texto: texto.trim() }) })
        .then(x => x.json()).catch(() => ({ error: 'Falha de rede' }))
      if (r?.error) avisar('Conversa criada · mensagem não entregue: ' + r.error)
      else avisar('Conversa iniciada')
    } else {
      avisar('Conversa criada')
    }
  }

  // ── Respostas rápidas ───────────────────────────────────────────────────────
  const salvarResposta = async (atalho: string, texto: string, id?: string) => {
    if (!medico) return
    const limpo = atalho.trim().replace(/^\//, '').replace(/\s+/g, '-').toLowerCase()
    if (demo) {
      setRespostas(p => (id ? p.map(r => r.id === id ? { id, atalho: limpo, texto } : r) : [...p, { id: 'd' + Date.now(), atalho: limpo, texto }]).sort((a, b) => a.atalho.localeCompare(b.atalho)))
      avisar('Resposta rápida salva'); return
    }
    const q = id
      ? supabase.from('chat_respostas_rapidas').update({ atalho: limpo, texto }).eq('id', id).select('id, atalho, texto').single()
      : supabase.from('chat_respostas_rapidas').insert({ medico_id: medico.id, atalho: limpo, texto }).select('id, atalho, texto').single()
    const { data, error } = await q
    if (tratarErro(error, 'Salvar resposta')) return
    setRespostas(p => (id ? p.map(r => r.id === id ? data! : r) : [...p, data!]).sort((a, b) => a.atalho.localeCompare(b.atalho)))
    avisar('Resposta rápida salva')
  }
  const removerResposta = async (id: string) => {
    if (demo) { setRespostas(p => p.filter(r => r.id !== id)); return }
    const { error } = await supabase.from('chat_respostas_rapidas').delete().eq('id', id)
    if (tratarErro(error, 'Remover resposta')) return
    setRespostas(p => p.filter(r => r.id !== id))
  }

  return {
    demo, medico, usuario, nomeUsuario, clinicaNome, config, atendentes, conversas, carregando,
    ativa, ativaId, abrir, mensagens, respostas, toast, avisar,
    enviar, anotar, mudarEtapa, transferir, assumir, devolverIA,
    marcarNaoLida, fixar, arquivar, silenciar, bloquear, exportar, limpar, apagar, novaConversa,
    salvarResposta, removerResposta,
  }
}

export type ChatApi = ReturnType<typeof useChat>

// ── Dados de demonstração (/chat?demo=1) ──────────────────────────────────────

const minAtras = (min: number) => new Date(Date.now() - min * 60000).toISOString()

function conversasDemo(medico: any): Conversa[] {
  const base = { medico_id: medico.id }
  return [
    { ...base, id: 'demo-1', telefone: '5511912570058', nome_contato: 'Mariana Souza', ultimo_contato: minAtras(3), modo: 'humano', atendente_nome: medico.nome, canal: 'whatsapp', etapa: 'atendimento', naoLidas: 2, fixada: true, paciente_id: null, ultima: { conteudo: 'Consigo remarcar para quinta à tarde?', criado_em: minAtras(3), tipo: 'recebida' } },
    { ...base, id: 'demo-2', telefone: '178445213', nome_contato: 'Carlos Lima', ultimo_contato: minAtras(40), modo: 'ia', canal: 'instagram', etapa: 'novo', naoLidas: 0, ultima: { conteudo: 'Claro! Temos horários amanhã às 9h ou 14h. Qual prefere?', criado_em: minAtras(40), tipo: 'enviada', metadata: { ia: true } } },
    { ...base, id: 'demo-3', telefone: '99812734', nome_contato: 'Beatriz Alves', ultimo_contato: minAtras(180), modo: 'humano', atendente_nome: null, canal: 'messenger', etapa: 'aguardando', naoLidas: 1, ultima: { conteudo: 'Qual o valor da consulta particular?', criado_em: minAtras(180), tipo: 'recebida' } },
    { ...base, id: 'demo-4', telefone: '5511988887777', nome_contato: 'João Pereira', ultimo_contato: minAtras(1500), modo: 'humano', atendente_nome: 'Recepção Ana', canal: 'whatsapp', etapa: 'agendado', naoLidas: 0, ultima: { conteudo: 'Consulta confirmada para 03/10 às 10h ✅', criado_em: minAtras(1500), tipo: 'enviada' } },
    { ...base, id: 'demo-5', telefone: '5511966665555', nome_contato: 'Fernanda Rocha', ultimo_contato: minAtras(2200), modo: 'ia', canal: 'whatsapp', etapa: 'agendado', naoLidas: 0, ultima: { conteudo: 'Perfeito, te espero na sexta às 15h!', criado_em: minAtras(2200), tipo: 'enviada', metadata: { ia: true } } },
    { ...base, id: 'demo-6', telefone: '5511977776666', nome_contato: 'Lúcia Martins', ultimo_contato: minAtras(4000), modo: 'ia', status: 'encerrada', canal: 'whatsapp', etapa: 'concluido', naoLidas: 0, ultima: { conteudo: 'Obrigada pelo atendimento!', criado_em: minAtras(4000), tipo: 'recebida' } },
    { ...base, id: 'demo-7', telefone: '33221144', nome_contato: 'Rafael Mendes', ultimo_contato: minAtras(5200), modo: 'humano', atendente_nome: 'Carla (atendimento)', canal: 'instagram', etapa: 'concluido', naoLidas: 0, ultima: { conteudo: 'Recebi o pedido de exame, obrigado!', criado_em: minAtras(5200), tipo: 'recebida' } },
  ] as Conversa[]
}

function mensagensDemo(id: string, medicoNome?: string): Mensagem[] {
  const m = (i: number, tipo: 'recebida' | 'enviada', conteudo: string, min: number, metadata?: any) =>
    ({ id: id + '-' + i, conversa_id: id, tipo, conteudo, criado_em: minAtras(min), lida: true, metadata }) as Mensagem
  if (id === 'demo-3') return [
    m(1, 'recebida', 'Boa tarde! Vocês atendem pelo convênio Unimed?', 200),
    m(2, 'enviada', 'Olá, Beatriz! Sou a *Sofia*, assistente da clínica 😊 Atendemos Unimed, Bradesco Saúde e SulAmérica.', 199, { ia: true }),
    m(3, 'recebida', 'Qual o valor da consulta particular?', 180),
    m(4, 'enviada', 'Paciente pediu valor — transferido para a recepção confirmar a tabela atual.', 179, { nota: true, remetente: 'Sofia IA' }),
  ]
  if (id === 'demo-2') return [
    m(1, 'recebida', 'Oi! Queria marcar uma consulta com a dermatologista', 45),
    m(2, 'enviada', 'Oi, Carlos! Claro 😊 Você prefere manhã ou tarde?', 44, { ia: true }),
    m(3, 'recebida', 'Manhã, se possível', 42),
    m(4, 'enviada', 'Claro! Temos horários amanhã às 9h ou 14h. Qual prefere?', 40, { ia: true, botoes: ['Amanhã 9h', 'Amanhã 14h'] }),
  ]
  return [
    m(1, 'recebida', 'Oi, boa tarde! Tenho consulta marcada amanhã.', 1500),
    m(2, 'enviada', 'Olá, Mariana! Sou a *Sofia*, assistente da clínica. Encontrei sua consulta de amanhã às 10h com a Dra. Ana. Posso ajudar em algo?', 1499, { ia: true }),
    m(3, 'recebida', 'Preciso falar com alguém da recepção', 30),
    m(4, 'enviada', 'Conversa transferida para atendimento humano', 29, { sistema: true }),
    m(5, 'enviada', 'Paciente pediu remarcação — verificar agenda de quinta à tarde.', 20, { nota: true, remetente: 'Recepção Ana' }),
    m(6, 'recebida', 'Surgiu um imprevisto no trabalho 😔', 5),
    m(7, 'recebida', 'Consigo remarcar para quinta à tarde?', 3),
    m(8, 'enviada', 'Consigo sim! Tenho 14h ou 16h30. Qual fica melhor pra você?', 1, { manual: true, remetente: medicoNome || 'Recepção' }),
  ]
}
