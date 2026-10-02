'use client'
import { log } from '@/lib/logger'
import React, { useEffect, useRef, useState } from 'react'
import { supabase as sb } from '@/lib/supabase'
import { useTranscricao } from '@/lib/transcricao/useTranscricao'
import { MemedPrescricao } from '@/components/MemedPrescricao'
import { BotaoMemed } from '@/components/BotaoMemed'
import { tokens } from '@/lib/design-tokens'
import {
  Avatar, Badge, Button, Field, Icon, IconButton, IconTile, Overline, ProgressBar,
  SegmentedControl, Select, Switch, Textarea,
} from '@/components/ui'
import type { LucideIcon } from 'lucide-react'
import {
  Activity, CalendarPlus, Check, CircleX, Copy, FileText, History, Lightbulb, Link as LinkIcon, Lock,
  MessageSquare, Mic, MicOff, Paperclip, PhoneOff, Save, Send, Sparkles, Square, Target, TriangleAlert,
  UserRound, Users, Video, VideoOff, X,
} from 'lucide-react'
import { notificar } from '@/components/ui/dialogos'

import { registrarAcesso } from '@/lib/auditoria'
import ConversaConsulta from '@/components/ia/ConversaConsulta'
const ICE = { iceServers: [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
]}

type Tela = 'carregando' | 'precall' | 'espera' | 'chamada' | 'encerrado' | 'encerrada_paciente' | 'erro'

export default function Sala({ params }: { params: { sala_id: string } }) {
  const { sala_id } = params
  const [tela, setTela] = useState<Tela>('carregando')
  const [memedAberto, setMemedAberto] = useState(false)
  const [pacienteSala, setPacienteSala] = useState<any>(null)
  const [medicoSala, setMedicoSala] = useState<any>(null)
  const [sala, setSala] = useState<any>(null)
  const [isMedico, setIsMedico] = useState(false)
  const [micOn, setMicOn] = useState(true)
  const [camOn, setCamOn] = useState(true)
  const [chatAberto, setChatAberto] = useState(false)
  const [chat, setChat] = useState<{de:string;msg:string;hora:string}[]>([])
  const [msgInput, setMsgInput] = useState('')
  const [naoLidas, setNaoLidas] = useState(0)
  const [timer, setTimer] = useState(0)
  const [erro, setErro] = useState('')
  const [micVol, setMicVol] = useState(0)
  const [camOkEspera, setCamOkEspera] = useState(false)
  const [micOkEspera, setMicOkEspera] = useState(false)
  const [entrando, setEntrando] = useState(false)
  const [remoteConectado, setRemoteConectado] = useState(false)
  const [anexos, setAnexos] = useState<{nome:string;url:string;tipo:string;de:string;hora:string}[]>([])
  const [enviandoAnexo, setEnviandoAnexo] = useState(false)
  const anexoInputRef = useRef<HTMLInputElement>(null)
  // Fase 4: Transcrio
  const [transcricaoFinal, setTranscriçãoFinal] = useState('')
  const [prontuarioFinal, setProntuarioFinal] = useState<any>(null)
  const [configAberto, setConfigAberto] = useState(false)
  const [audioInputId, setAudioInputId] = useState('')
  const [videoInputId, setVideoInputId] = useState('')
  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([])
  const [videoInputs, setVideoInputs] = useState<MediaDeviceInfo[]>([])
  const [transcricao, setTranscrição] = useState('')
  // Transcrição: voz do médico + voz do paciente (áudio da chamada) misturadas, ao vivo + revisão final
  const motor = useTranscricao(t => setTranscrição(t), { obterStream: () => streamRef.current })
  const gravando = motor.gravando
  const gravandoPausado = motor.gravandoPausado
  const [processando, setProcessando] = useState(false)
  const [prontuarioModal, setProntuarioModal] = useState(false)
  const [prontuarioData, setProntuarioData] = useState<any>(null)
  // Modo Perfeita — transcrição + IA ao vivo (estilo chat)
  const [modoPerfeita, setModoPerfeita] = useState(false)
  const [mensagensIA, setMensagensIA] = useState<{tipo:'foco'|'sugestao'|'alerta'; texto:string; hora:string}[]>([])
  const [carregandoSugestoes, setCarregandoSugestoes] = useState(false)
  const audioContextRef = useRef<AudioContext | null>(null)
  const mixDestinationRef = useRef<MediaStreamAudioDestinationNode | null>(null)
  const chatIARef = useRef<HTMLDivElement>(null)
  const mensagensVistasRef = useRef<Set<string>>(new Set())
  const [historicoIAAberto, setHistoricoIAAberto] = useState(false)
  const [toastsIA, setToastsIA] = useState<{id:string; tipo:'foco'|'sugestao'|'alerta'; texto:string; hora:string}[]>([])
  const [salvando, setSalvando] = useState(false)
  const [salvado, setSalvado] = useState(false)
  const camposRef = useRef<Record<string, string>>({})

  const localRef = useRef<HTMLVideoElement>(null)
  const remoteRef = useRef<HTMLVideoElement>(null)
  const esperaRef = useRef<HTMLVideoElement>(null)
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const esperaStreamRef = useRef<MediaStream | null>(null)
  const channelRef = useRef<any>(null)
  const timerRef = useRef<any>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const volFrameRef = useRef<number>(0)
  const papelRef = useRef('')
  const iceBufRef = useRef<RTCIceCandidateInit[]>([])
  const remoteSetRef = useRef(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const med = localStorage.getItem('medico')
    const adm = localStorage.getItem('clinica_admin')
    const ehMedico = !!(med || adm)
    papelRef.current = ehMedico ? 'medico' : 'paciente'
    setIsMedico(ehMedico)
    if (med) {
      try { setMedicoSala(JSON.parse(med)) } catch {}
    } else if (adm) {
      try {
        const a = JSON.parse(adm)
        if (a.clinica_id) {
          sb.from('medicos').select('*').eq('clinica_id', a.clinica_id).eq('cargo', 'medico').eq('ativo', true).limit(1).single().then(({ data }) => {
            if (data) setMedicoSala(data)
          })
        }
      } catch {}
    }
    carregarSala()
    return () => pararEspera()
  }, [sala_id])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chat])

  useEffect(() => {
    if (chatAberto) setNaoLidas(0)
  }, [chatAberto])

  // Conecta stream local ao PiP quando tela de chamada renderiza
  // Usa setTimeout pois o ref pode no estar pronto no primeiro tick
  useEffect(() => {
    if ((tela === 'chamada' || tela === 'precall') && streamRef.current) {
      const conectar = () => {
        if (localRef.current && streamRef.current) {
          localRef.current.srcObject = streamRef.current
        }
      }
      conectar()
      // Retry aps 100ms por segurana (ref pode estar null no primeiro tick)
      const t = setTimeout(conectar, 100)
      return () => clearTimeout(t)
    }
  }, [tela])

  const carregarSala = async () => {
    // Pelo servidor: o paciente entra sem login e não tem acesso direto ao banco
    const r = await fetch(`/api/sala/${encodeURIComponent(String(sala_id))}`).catch(() => null)
    const j = r ? await r.json().catch(() => ({})) : {}
    if (!r?.ok || !j.sala) { setErro('Sala nao encontrada ou link expirado.'); setTela('erro'); return }
    setSala(j.sala)
    if (j.paciente) setPacienteSala(j.paciente)
    iniciarEspera()
  }

  //  SALA DE ESPERA 
  const iniciarEspera = async () => {
    if (papelRef.current === 'medico') {
      setTela('precall')
    } else {
      entrarNaChamada()
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      esperaStreamRef.current = stream
      if (esperaRef.current) esperaRef.current.srcObject = stream
      setCamOkEspera(true)

      // Analisador de volume do mic
      const ctx = new AudioContext()
      const src = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      src.connect(analyser)
      analyserRef.current = analyser
      setMicOkEspera(true)

      const loop = () => {
        const buf = new Uint8Array(analyser.frequencyBinCount)
        analyser.getByteFrequencyData(buf)
        const avg = buf.reduce((a, b) => a + b, 0) / buf.length
        setMicVol(Math.min(100, avg * 2.5))
        volFrameRef.current = requestAnimationFrame(loop)
      }
      loop()
    } catch {
      setErro('Sem acesso a camera/microfone. Verifique as permissoes no browser.')
      setTela('erro')
    }
  }

  const pararEspera = () => {
    esperaStreamRef.current?.getTracks().forEach(t => t.stop())
    cancelAnimationFrame(volFrameRef.current)
  }

  //  ENTRAR NA CHAMADA 
  const entrarNaChamada = async () => {
    setEntrando(true)
    pararEspera()

    const papel = papelRef.current
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    } catch {
      setErro('Sem acesso a camera/microfone.')
      setTela('erro')
      return
    }
    streamRef.current = stream
    if (localRef.current) localRef.current.srcObject = stream

    const pc = new RTCPeerConnection(ICE)
    pcRef.current = pc
    stream.getTracks().forEach(t => pc.addTrack(t, stream))

    // Keepalive data channel
    try {
      const dc = pc.createDataChannel('keepalive')
      dc.onopen = () => {
        const ping = setInterval(() => {
          try { if (dc.readyState === 'open') dc.send('ping') } catch {}
          if (dc.readyState === 'closed') clearInterval(ping)
        }, 10000)
      }
    } catch {}

    pc.ontrack = (e) => {
      if (remoteRef.current && e.streams[0]) {
        remoteRef.current.srcObject = e.streams[0]
        // Paciente entrou com a gravação já rodando: mistura a voz dele também
        if (motor.gravando) motor.adicionarFonte(e.streams[0])
        setRemoteConectado(true)
        setTela('chamada')
        setEntrando(false)
        tocarSom('entrada')
        if (!timerRef.current) timerRef.current = setInterval(() => setTimer(t => t + 1), 1000)
        fetch(`/api/sala/${encodeURIComponent(String(sala_id))}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'em_andamento' }) }).catch(() => {})
      }
    }

    pc.onicecandidate = (e) => {
      if (e.candidate) send('ice', e.candidate.toJSON())
    }

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected') {
        // Queda momentanea  nao encerra
      }
      if (pc.connectionState === 'failed') pc.restartIce()
    }

    const channel = sb.channel('sala:' + sala_id, { config: { broadcast: { self: false } } })
      .on('broadcast', { event: 'offer' }, async ({ payload }) => {
        if (payload.de === papel) return
        await pc.setRemoteDescription(new RTCSessionDescription(payload.dados))
        remoteSetRef.current = true
        for (const c of iceBufRef.current) { try { await pc.addIceCandidate(new RTCIceCandidate(c)) } catch {} }
        iceBufRef.current = []
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        send('answer', { type: answer.type, sdp: answer.sdp })
      })
      .on('broadcast', { event: 'answer' }, async ({ payload }) => {
        if (payload.de === papel) return
        if (pc.signalingState === 'have-local-offer') {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.dados))
          remoteSetRef.current = true
          for (const c of iceBufRef.current) { try { await pc.addIceCandidate(new RTCIceCandidate(c)) } catch {} }
          iceBufRef.current = []
        }
      })
      .on('broadcast', { event: 'ice' }, async ({ payload }) => {
        if (payload.de === papel) return
        if (remoteSetRef.current) { try { await pc.addIceCandidate(new RTCIceCandidate(payload.dados)) } catch {} }
        else iceBufRef.current.push(payload.dados)
      })
      .on('broadcast', { event: 'pronto' }, ({ payload }) => {
        if (payload.de === papel) return
        if (pcRef.current && pcRef.current.signalingState === 'stable') fazerOffer(pcRef.current)
        if (papel === 'paciente' && !pcRef.current) entrarNaChamada()
      })
      .on('broadcast', { event: 'anexo' }, ({ payload }) => {
        if (payload.de === papelRef.current) return
        const hora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        const papel = papelRef.current
        setAnexos(p => [...p, { ...payload.dados, de: papel === 'medico' ? 'Paciente' : 'Medico', hora }])
        setNaoLidas(n => n + 1)
        tocarSom('mensagem')
        if (!chatAberto) setNaoLidas(n => n + 1)
      })
      .on('broadcast', { event: 'chat' }, ({ payload }) => {
        if (payload.de === papel) return
        const nova = { de: payload.de === 'medico' ? 'Medico' : 'Paciente', msg: payload.dados, hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) }
        setChat(p => [...p, nova])
        setNaoLidas(n => n + 1)
        tocarSom('mensagem')
      })
      .on('broadcast', { event: 'encerrar' }, () => {
        tocarSom('saida')
        if (papelRef.current === 'paciente') {
          // Limpa recursos mas NÃO fecha janela nem redireciona — mostra tela de fim
          clearInterval(timerRef.current as any)
          streamRef.current?.getTracks().forEach(t => t.stop())
          pcRef.current?.close()
          channelRef.current?.unsubscribe()
          if (localRef.current) localRef.current.srcObject = null
          if (remoteRef.current) remoteRef.current.srcObject = null
          setTela('encerrada_paciente')
        } else {
          encerrarLocal()
        }
      })
      .subscribe(async (s) => {
        if (s === 'SUBSCRIBED') {
          setTela('chamada')
          if (localRef.current && streamRef.current) localRef.current.srcObject = streamRef.current
          setEntrando(false)
          send('pronto', { papel })
          // Garante que o PiP recebe o stream aps render
          setTimeout(() => {
            if (localRef.current && streamRef.current) {
              localRef.current.srcObject = streamRef.current
            }
          }, 200)
          // Medico: inicia gravacao automaticamente
          if (papel === 'medico') setTimeout(() => iniciarGravação(), 500)
        }
      })

    channelRef.current = channel
  }

  const fazerOffer = async (pc: RTCPeerConnection) => {
    if (pc.signalingState !== 'stable') return
    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    send('offer', { type: offer.type, sdp: offer.sdp })
  }

  const send = (tipo: string, dados: any) => {
    channelRef.current?.send({ type: 'broadcast', event: tipo, payload: { dados, de: papelRef.current } })
  }

  const encerrarLocal = () => {
    clearInterval(timerRef.current)
    pcRef.current?.close()
    streamRef.current?.getTracks().forEach(t => t.stop())
    channelRef.current?.unsubscribe()
    if (localRef.current) localRef.current.srcObject = null
    if (remoteRef.current) remoteRef.current.srcObject = null
    setTela('encerrado')
  }

  const encerrar = async () => {
    send('encerrar', {})
    await fetch(`/api/sala/${encodeURIComponent(String(sala_id))}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'encerrada', duracao_segundos: timer }) }).catch(() => {})
    // Para a gravação (o texto final, já revisado, vem na promessa)
    const textoFinal = motor.gravando || motor.gravandoPausado ? motor.pararGravacao() : Promise.resolve(transcricao)
    encerrarLocal()
    if (papelRef.current === 'paciente') {
      setTimeout(() => { try { window.close() } catch {} }, 3000)
      return
    }
    // Medico: transcreve e gera prontuario
    if (papelRef.current === 'medico') {
      setProcessando(true)
      const texto = ((await textoFinal) || transcricao || '').trim()
      if (texto && texto.trim().length > 10) {
        await gerarProntuario(texto)
      } else {
        setProcessando(false)
      }
    }
  }

  const toggleMic = () => { streamRef.current?.getAudioTracks().forEach(t => { t.enabled = !t.enabled; setMicOn(t.enabled) }) }
  const toggleCam = () => { streamRef.current?.getVideoTracks().forEach(t => { t.enabled = !t.enabled; setCamOn(t.enabled) }) }
  // Inicia gravao  captura o udio local do mdico
  // Modo Perfeita: IA sugere durante a consulta (estilo chat)
  const buscarSugestoes = async (texto: string) => {
    if (!texto || texto.trim().length < 50 || carregandoSugestoes) return
    setCarregandoSugestoes(true)
    // Timeout de 8s pra não travar o fluxo se a API demorar
    const ctrl = new AbortController()
    const timeoutId = setTimeout(() => ctrl.abort(), 8000)
    try {
      const med = localStorage.getItem('medico')
      const medObj = med ? JSON.parse(med) : null
      // Limita texto enviado aos últimos 1500 chars (API já corta, mas evita payload grande)
      const trechoRecente = texto.slice(-1500)
      const res = await fetch('/api/sugestoes-consulta', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcricao: trechoRecente, especialidade: medObj?.especialidade || '' }),
        signal: ctrl.signal,
      })
      if (!res.ok) {
        log.warn('[ModoPerfeita] API retornou', res.status)
        return
      }
      const data = await res.json()
      if (data.error) {
        log.warn('[ModoPerfeita] API error:', data.error)
        return
      }
      const hora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      const novas: {tipo:'foco'|'sugestao'|'alerta'; texto:string; hora:string}[] = []
      if (data.foco && !mensagensVistasRef.current.has('foco:' + data.foco)) {
        mensagensVistasRef.current.add('foco:' + data.foco)
        novas.push({ tipo: 'foco', texto: data.foco, hora })
      }
      for (const s of (data.sugestoes || [])) {
        const key = 'sug:' + s
        if (!mensagensVistasRef.current.has(key)) {
          mensagensVistasRef.current.add(key)
          novas.push({ tipo: 'sugestao', texto: s, hora })
        }
      }
      for (const a of (data.alertas || [])) {
        const key = 'alt:' + a
        if (!mensagensVistasRef.current.has(key)) {
          mensagensVistasRef.current.add(key)
          novas.push({ tipo: 'alerta', texto: a, hora })
        }
      }
      // Evita crescimento infinito da ref de dedup (mantém últimos 50 hashes)
      if (mensagensVistasRef.current.size > 50) {
        const arr = Array.from(mensagensVistasRef.current).slice(-30)
        mensagensVistasRef.current = new Set(arr)
      }
      if (novas.length > 0) {
        // Mantém só últimos 30 insights no histórico (evita lag em consultas longas)
        setMensagensIA(prev => [...prev, ...novas].slice(-30))
        // Toasts flutuantes: mostra as novas por 20s no canto, máximo 4 simultâneas
        const novoToasts = novas.map(m => ({ ...m, id: Date.now() + '_' + Math.random().toString(36).slice(-4) }))
        setToastsIA(prev => [...prev, ...novoToasts].slice(-4))
        novoToasts.forEach(t => {
          setTimeout(() => setToastsIA(prev => prev.filter(x => x.id !== t.id)), 20000)
        })
      }
    } catch (e: any) {
      if (e?.name === 'AbortError') {
        log.warn('[ModoPerfeita] request timeout — próxima tentativa virá com mais contexto')
      } else {
        log.error('[ModoPerfeita] erro:', e?.message || e)
      }
    } finally {
      clearTimeout(timeoutId)
      setCarregandoSugestoes(false)
    }
  }

  useEffect(() => {
    if (!modoPerfeita || !transcricao || transcricao.trim().length < 50) return
    const timer = setTimeout(() => buscarSugestoes(transcricao), 500)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transcricao, modoPerfeita])

  // Ao ligar Modo Perfeita, garante que está gravando (paciente não sabe)
  useEffect(() => {
    if (modoPerfeita && !gravando && tela === 'chamada' && isMedico) {
      iniciarGravação()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modoPerfeita])

  // Auto-scroll no chat da IA quando chega mensagem nova
  useEffect(() => {
    chatIARef.current?.scrollTo({ top: chatIARef.current.scrollHeight, behavior: 'smooth' })
  }, [mensagensIA])

  const iniciarGravação = async () => {
    if (!streamRef.current) return
    await motor.iniciarGravacao()
    // Paciente já na chamada: inclui a voz dele
    const remoto = remoteRef.current?.srcObject as MediaStream | null
    if (remoto) motor.adicionarFonte(remoto)
  }

  const pararGravação = () => { motor.pararGravacao() }

  const toggleGravação = () => {
    if (gravando) pararGravação()
    else iniciarGravação()
  }

  const pausarGravação = () => motor.pausarGravacao()

  // Gera pronturio a partir da transcrio via Claude
  const gerarProntuario = async (textoTranscrição: string) => {
    if (!textoTranscrição.trim()) return
    setProcessando(true)
    try {
      const r = await fetch('/api/estruturar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcricao: textoTranscrição })
      })
      const d = await r.json()
      if (d.estruturado || d.prontuario || d) {
        setProntuarioData(d)
        setProntuarioModal(true)
      }
    } catch {}
    setProcessando(false)
  }

  const salvarProntuario = async () => {
    if (salvando || salvado) return
    setSalvando(true)
    try {
      const med = JSON.parse(localStorage.getItem('medico') || '{}')
      const campos = camposRef.current
      const pd = prontuarioData?.prontuario ?? prontuarioData ?? {}
      // Mesmo padrão da Nova Consulta: spread do prontuario inteiro vindo da IA,
      // mas sobrescrevendo S/O/A/P + receita com edições do médico (camposRef).
      const body = {
        medico_id: med.id,
        paciente_id: sala?.paciente_id || null,
        transcricao: transcricao || '',
        ...pd,
        // Edições manuais sobrescrevem o que veio da IA
        ...(campos.subjetivo !== undefined && { subjetivo: campos.subjetivo }),
        ...(campos.objetivo !== undefined && { objetivo: campos.objetivo }),
        ...(campos.avaliacao !== undefined && { avaliacao: campos.avaliacao }),
        ...(campos.plano !== undefined && { plano: campos.plano }),
        ...(campos.receita !== undefined && { receita: campos.receita }),
      }
      log.info('[salvar] body keys:', Object.keys(body))
      const r = await fetch('/api/consultas', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const d = await r.json()
      if (d.id) {
        registrarAcesso({ acao: 'editou', recurso: 'consulta', recursoId: d.id, pacienteId: sala?.paciente_id || null, detalhes: { origem: 'teleconsulta' } })
        setSalvado(true)
        setTimeout(() => { window.location.href = '/historico' }, 1500)
      }
    } catch (err) { log.error('Erro salvar:', err) }
    setSalvando(false)
  }

  const carregarDispositivos = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      setAudioInputs(devices.filter(d => d.kind === 'audioinput'))
      setVideoInputs(devices.filter(d => d.kind === 'videoinput'))
    } catch(e) {}
  }

  const tocarSom = (tipo: 'entrada' | 'saida' | 'mensagem') => {
    try {
      const ctx = new AudioContext()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      gain.gain.setValueAtTime(0.3, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6)
      if (tipo === 'entrada') {
        // Dois tons ascendentes  "ding dong"
        osc.frequency.setValueAtTime(520, ctx.currentTime)
        osc.frequency.setValueAtTime(660, ctx.currentTime + 0.15)
      } else if (tipo === 'saida') {
        // Dois tons descendentes
        osc.frequency.setValueAtTime(660, ctx.currentTime)
        osc.frequency.setValueAtTime(440, ctx.currentTime + 0.15)
      } else {
        // Mensagem  tom curto suave
        osc.frequency.setValueAtTime(880, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2)
      }
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 0.6)
    } catch {}
  }

  const fmtTimer = (s: number) => String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0')

  // Comprime imagem via canvas pra caber nos 512KB do broadcast Realtime
  const comprimirImagem = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      // Reduz dimensão se for muito grande (max 1600px no maior lado)
      const maxDim = 1600
      let { width, height } = img
      if (width > maxDim || height > maxDim) {
        const scale = maxDim / Math.max(width, height)
        width = Math.round(width * scale)
        height = Math.round(height * scale)
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('canvas ctx falhou')); return }
      ctx.drawImage(img, 0, 0, width, height)
      // JPEG quality 0.7 — equilíbrio entre qualidade visual e peso
      const dataUrl = canvas.toDataURL('image/jpeg', 0.7)
      resolve(dataUrl)
    }
    img.onerror = () => reject(new Error('falha ao carregar imagem'))
    img.src = URL.createObjectURL(file)
  })

  const fileToBase64 = (file: File): Promise<string> => new Promise((res, rej) => {
    const reader = new FileReader()
    reader.onload = () => res(reader.result as string)
    reader.onerror = rej
    reader.readAsDataURL(file)
  })

  const enviarAnexo = async (file: File) => {
    if (!file || enviandoAnexo) return
    setEnviandoAnexo(true)
    try {
      const ehImagem = file.type.startsWith('image/')
      let base64: string
      let nomeFinal = file.name
      let tipoFinal = file.type

      if (ehImagem) {
        // Sempre comprime imagens (cabe no broadcast 512KB)
        base64 = await comprimirImagem(file)
        tipoFinal = 'image/jpeg'
        // Renomeia pra .jpg pra refletir o formato comprimido
        nomeFinal = file.name.replace(/\.(png|webp|heic|heif|gif|bmp)$/i, '.jpg')
      } else {
        // Não-imagem: valida tamanho antes de codificar
        if (file.size > 400 * 1024) {
          notificar('Arquivo muito grande (máx. 400 KB). Comprima ou envie como imagem.', 'erro')
          setEnviandoAnexo(false)
          return
        }
        base64 = await fileToBase64(file)
      }

      // Verifica tamanho final do base64 antes de mandar
      if (base64.length > 500_000) {
        notificar('Arquivo ainda muito grande após compressão. Tente uma imagem menor.', 'erro')
        setEnviandoAnexo(false)
        return
      }

      const hora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      const anexo = { nome: nomeFinal, url: base64, tipo: tipoFinal, de: 'Voce', hora }
      setAnexos(p => [...p, anexo])
      send('anexo', { nome: nomeFinal, url: base64, tipo: tipoFinal })
      if (!chatAberto) { setChatAberto(true); setNaoLidas(0) }
    } catch (err) {
      log.error('Erro ao enviar anexo:', err)
      notificar('Erro ao enviar anexo. Tente novamente.', 'erro')
    }
    setEnviandoAnexo(false)
  }

  const enviarChat = () => {
    if (!msgInput.trim()) return
    const msg = msgInput.trim(); setMsgInput('')
    setChat(p => [...p, { de: 'Voce', msg, hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) }])
    send('chat', msg)
  }

  //  TELAS 

  useEffect(() => {
    if (tela === 'chamada' || tela === 'precall') {
      if (localRef.current && streamRef.current) {
        localRef.current.srcObject = streamRef.current
      }
    }
  }, [tela])

  // Conecta stream ao video na precall
  useEffect(() => {
    if (tela === 'precall' && localRef.current && streamRef.current) {
      localRef.current.srcObject = streamRef.current
    }
  }, [tela])

  useEffect(() => {
    if (tela === 'precall') carregarDispositivos()
  }, [tela])


  // ── Apresentação: painel lateral da chamada (IA / Chat / Pessoas) ──────────
  // `chatAberto` continua sendo a fonte de verdade de "chat visível" (usado nos
  // handlers); `abaPainel` só controla qual aba do painel está aberta.
  const [abaPainel, setAbaPainel] = useState<AbaPainel | null>(null)
  const [linkCopiado, setLinkCopiado] = useState(false)

  useEffect(() => {
    if (chatAberto) setAbaPainel('chat')
  }, [chatAberto])

  // Médico entra na chamada com a aba IA aberta (como no protótipo)
  useEffect(() => {
    if (tela === 'chamada' && isMedico) setAbaPainel(a => a ?? 'ia')
  }, [tela, isMedico])

  // Mensagens que chegam com o chat visível não contam como não lidas
  useEffect(() => {
    if (abaPainel === 'chat' && naoLidas > 0) setNaoLidas(0)
  }, [abaPainel, naoLidas])

  const selecionarAba = (a: AbaPainel) => {
    setAbaPainel(a)
    setChatAberto(a === 'chat')
    if (a === 'chat') setNaoLidas(0)
  }
  const alternarAba = (a: AbaPainel) => {
    if (abaPainel === a) fecharPainel()
    else selecionarAba(a)
  }
  const fecharPainel = () => { setAbaPainel(null); setChatAberto(false) }

  const copiarLink = () => {
    try {
      navigator.clipboard?.writeText(window.location.href)
      setLinkCopiado(true)
      setTimeout(() => setLinkCopiado(false), 2000)
    } catch {}
  }

  const T = tokens
  const N = T.night
  const codigoSala = String(sala_id).slice(-4).toUpperCase()

  if (tela === 'carregando') return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center', justifyContent: 'center', background: N[900], color: '#fff' }}>
      <Spinner size={40} cor={T.brand.primaryAccent} trilho={branco(0.12)} />
      <span style={{ fontSize: 13, color: TXT_ESCURO.secundario }}>Preparando a sala…</span>
      <style dangerouslySetInnerHTML={{ __html: ESTILOS_BASE }} />
    </div>
  )

  if (tela === 'erro') return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: N[900], padding: 16 }}>
      <div style={{ width: 'min(400px, 100%)', background: N[800], border: `1px solid ${branco(0.08)}`, borderRadius: T.radius['3xl'], padding: 28, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, textAlign: 'center' }}>
        <span style={{ width: 52, height: 52, borderRadius: 16, display: 'grid', placeItems: 'center', background: 'rgba(229,72,77,.16)', color: '#FF8A8E' }}>
          <Icon icon={CircleX} size={24} />
        </span>
        <span style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>Não foi possível entrar na sala</span>
        <span style={{ fontSize: 13.5, color: TXT_ESCURO.secundario, lineHeight: 1.5 }}>{erro}</span>
      </div>
      <style dangerouslySetInnerHTML={{ __html: ESTILOS_BASE }} />
    </div>
  )

  if (tela === 'encerrada_paciente') return (
    <div style={{ minHeight: '100dvh', background: N[900], display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ width: 'min(420px, 100%)', background: N[800], border: `1px solid ${branco(0.08)}`, borderRadius: T.radius['3xl'], padding: '32px 28px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center' }}>
        <span style={{ width: 64, height: 64, borderRadius: '50%', display: 'grid', placeItems: 'center', background: N[600], color: '#D9D2FF' }}>
          <Icon icon={Check} size={28} />
        </span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 20, fontWeight: 700, color: '#fff', letterSpacing: '-.01em' }}>Consulta finalizada</span>
          <span style={{ fontSize: 14, color: TXT_ESCURO.primario, lineHeight: 1.5 }}>Obrigado por usar nossa plataforma.</span>
          <span style={{ fontSize: 13, color: TXT_ESCURO.secundario, lineHeight: 1.5 }}>O médico encerrou esta videoconsulta. Você já pode fechar esta janela com segurança.</span>
        </div>
        <Button size="lg" onClick={() => { try { window.close() } catch {} }} style={{ marginTop: 4 }}>Fechar janela</Button>
        <span style={{ fontSize: 12, color: TXT_ESCURO.terciario, marginTop: 8 }}>Se tiver dúvidas, entre em contato com a clínica.</span>
      </div>
      <style dangerouslySetInnerHTML={{ __html: ESTILOS_BASE }} />
    </div>
  )

  if (tela === 'encerrado') {
    const pd = prontuarioData ? (prontuarioData?.prontuario ?? prontuarioData ?? {}) : null
    const palavras = transcricao ? transcricao.trim().split(/\s+/).length : 0
    return (
      <div style={{ minHeight: '100dvh', background: N[900], overflowY: 'auto', padding: '32px 16px' }}>
        <div style={{ width: 'min(680px, 100%)', margin: '0 auto', background: T.bg.card, borderRadius: T.radius['3xl'], boxShadow: T.shadow.modal, overflow: 'hidden' }}>
          {/* Cabeçalho */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '20px 22px 14px' }}>
            <IconTile icon={Check} color={T.status.success} size={40} />
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: T.text.primary }}>Teleconsulta encerrada</span>
              <span style={{ fontSize: 12.5, color: T.text.quaternary }}>Consulta <span className="mono">{codigoSala}</span>{pacienteSala?.nome ? ' · ' + pacienteSala.nome : ''}</span>
            </div>
          </div>

          <div style={{ padding: '0 22px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Resumo */}
            <div className="sala-resumo" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              <ResumoItem label="Duração" valor={<span className="mono" style={{ fontSize: 15 }}>{fmtTimer(timer)}</span>} />
              <ResumoItem label="Paciente" valor={pacienteSala?.nome || '—'} />
              <ResumoItem label="Transcrição" valor={palavras > 0 ? `${palavras} palavras` : 'Indisponível'} />
            </div>

            {/* Processando */}
            {processando && !prontuarioData && (
              <NotaIA>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                  <Spinner size={14} cor={T.brand.primary} trilho={T.brand.primaryAccent} />
                  <b style={{ fontWeight: 600 }}>Gerando prontuário com IA…</b>
                </span>
              </NotaIA>
            )}

            {/* Transcrição */}
            {transcricao ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Overline>Transcrição da consulta</Overline>
                <div style={{ background: T.bg.page, borderRadius: 12, padding: '12px 14px', maxHeight: 260, overflow: 'auto' }}><ConversaConsulta texto={transcricao} compacto /></div>
              </div>
            ) : !processando && (
              <div style={{ background: T.bg.page, borderRadius: 12, padding: '12px 14px', fontSize: 13, color: T.text.quaternary, textAlign: 'center' }}>
                Nenhuma transcrição disponível (Modo Perfeita não foi ativado)
              </div>
            )}

            {/* Prontuário SOAP editável */}
            {pd && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 4 }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <Icon icon={Sparkles} size={16} color={T.brand.primary} />
                  <span style={{ fontSize: 14, fontWeight: 700, color: T.text.primary }}>Prontuário gerado pela IA</span>
                  <span style={{ fontSize: 12, color: T.text.quaternary }}>edite antes de salvar</span>
                </div>
                {(['subjetivo', 'objetivo', 'avaliacao', 'plano'] as const).map(campo => {
                  const val = pd[campo] ?? ''
                  if (!val) return null
                  return (
                    <Field key={campo} label={ROTULO_SOAP[campo]}>
                      <Textarea defaultValue={val} rows={3} onChange={e => { camposRef.current[campo] = e.target.value }} style={{ fontSize: 13 }} />
                    </Field>
                  )
                })}
                {Array.isArray(pd.cids) && pd.cids.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <Overline>CIDs sugeridos</Overline>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {pd.cids.map((cid: any, i: number) => (
                        <Badge key={i} tone="accent"><span className="mono">{cid.codigo}</span> — {cid.descricao}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Ações */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end', padding: '14px 22px', borderTop: `1px solid ${T.border.muted}` }}>
            <Button variant="secondary" icon={CalendarPlus} onClick={() => window.location.href = '/agenda'}>Agendar retorno</Button>
            <Button variant="secondary" icon={History} onClick={() => window.location.href = '/historico'}>Ver histórico</Button>
            <Button variant="secondary" icon={Video} onClick={() => window.location.href = '/teleconsulta'}>Nova consulta</Button>
            {prontuarioData && <BotaoSalvar salvando={salvando} salvado={salvado} onClick={salvarProntuario} />}
          </div>
        </div>
        <style dangerouslySetInnerHTML={{ __html: ESTILOS_BASE + `@media (max-width: 520px) { .sala-resumo { grid-template-columns: 1fr !important; } }` }} />
      </div>
    )
  }

  if (tela === 'precall') return (
    <div style={{ minHeight: '100dvh', background: T.bg.page, display: 'flex', flexDirection: 'column' }}>
      {/* Cabeçalho */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px' }}>
        <span style={{ width: 32, height: 32, borderRadius: 10, background: T.brand.primary, color: '#fff', display: 'grid', placeItems: 'center' }}>
          <Icon icon={Activity} size={16} />
        </span>
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.25, minWidth: 0 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: T.text.primary }}>Clinical 360</span>
          <span style={{ fontSize: 12, color: T.text.quaternary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            Consulta <span className="mono">{codigoSala}</span>{pacienteSala?.nome ? ' · ' + pacienteSala.nome : ''}
          </span>
        </div>
      </div>

      {/* Conteúdo */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px 16px 32px' }}>
        <div style={{ width: 'min(940px, 100%)', background: T.bg.card, border: `1px solid ${T.border.default}`, borderRadius: T.radius['3xl'], padding: 20, display: 'flex', gap: 28, flexWrap: 'wrap', alignItems: 'stretch' }}>
          {/* Preview da câmera */}
          <div style={{ flex: '1 1 380px', minWidth: 0, aspectRatio: '16/10', borderRadius: T.radius['2xl'], overflow: 'hidden', background: `radial-gradient(circle at 50% 42%, #2f2a46, ${N[800]} 72%)`, position: 'relative' }}>
            <video ref={esperaRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)', display: 'block' }} />
            {!camOn && (
              <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: N[800] }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: TXT_ESCURO.primario }}>
                  <Icon icon={VideoOff} size={16} />Câmera desligada
                </span>
              </div>
            )}
            <div style={{ position: 'absolute', bottom: 14, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 10 }}>
              <BotaoRedondo icon={micOn ? Mic : MicOff} desligado={!micOn} onClick={toggleMic} title="Microfone" size={44} />
              <BotaoRedondo icon={camOn ? Video : VideoOff} desligado={!camOn} onClick={toggleCam} title="Câmera" size={44} />
            </div>
          </div>

          {/* Painel direito */}
          <div style={{ flex: '1 1 260px', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 16, justifyContent: 'center', padding: '4px 0' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Overline>Teleconsulta</Overline>
              <span style={{ fontSize: 22, fontWeight: 700, color: T.text.primary, letterSpacing: '-.02em' }}>Pronto para entrar?</span>
              <span style={{ fontSize: 13.5, color: T.text.quaternary, lineHeight: 1.5 }}>Verifique câmera e microfone antes de iniciar.</span>
            </div>

            {audioInputs.length > 0 && (
              <Field label="Microfone">
                <Select onChange={e => setAudioInputId(e.target.value)}>
                  {audioInputs.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || 'Microfone ' + d.deviceId.slice(0, 4)}</option>)}
                </Select>
              </Field>
            )}
            {micOkEspera && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: T.text.secondary }}>Nível do microfone</span>
                <ProgressBar valor={micVol} altura={6} />
              </div>
            )}
            {videoInputs.length > 0 && (
              <Field label="Câmera">
                <Select onChange={e => setVideoInputId(e.target.value)}>
                  {videoInputs.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || 'Câmera ' + d.deviceId.slice(0, 4)}</option>)}
                </Select>
              </Field>
            )}

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Badge tone={micOn ? 'accent' : 'danger'} icon={micOn ? Mic : MicOff}>{micOn ? 'Microfone ativo' : 'Microfone desligado'}</Badge>
              <Badge tone={camOn ? 'accent' : 'danger'} icon={camOn ? Video : VideoOff}>{camOn ? 'Câmera ativa' : 'Câmera desligada'}</Badge>
            </div>

            <Button size="lg" block icon={Video} onClick={() => { pararEspera(); entrarNaChamada() }}>Entrar na consulta</Button>
          </div>
        </div>
      </div>
      <style dangerouslySetInnerHTML={{ __html: ESTILOS_BASE }} />
    </div>
  )

  if (tela === 'espera') return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: N[900], gap: 18, padding: 24, textAlign: 'center' }}>
      <span style={{ width: 96, height: 96, borderRadius: '50%', background: N[600], color: '#D9D2FF', display: 'grid', placeItems: 'center', animation: 'salaAnel 2.4s ease-in-out infinite' }}>
        <Icon icon={papelRef.current === 'paciente' ? UserRound : Users} size={38} />
      </span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ color: '#fff', fontSize: 20, fontWeight: 700 }}>{papelRef.current === 'paciente' ? 'Aguardando o médico' : 'Sala de espera'}</span>
        <span style={{ color: TXT_ESCURO.secundario, fontSize: 14 }}>{papelRef.current === 'paciente' ? 'O médico entrará em breve. Por favor, aguarde.' : 'Aguardando o paciente conectar…'}</span>
      </div>
      {papelRef.current === 'paciente' && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '6px 12px', borderRadius: 99, background: branco(0.08), fontSize: 12.5, fontWeight: 600, color: '#4ADE80' }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#4ADE80' }} />Conectado
        </span>
      )}
      <style dangerouslySetInnerHTML={{ __html: ESTILOS_BASE }} />
    </div>
  )

  // ── TELA DA CHAMADA ─────────────────────────────────────────────────────────
  const nomeOutro = isMedico ? (pacienteSala?.nome || 'Paciente') : (medicoSala?.nome || 'Médico')
  const nomeVoce = isMedico ? (medicoSala?.nome || 'Você') : (pacienteSala?.nome || 'Você')
  const tituloChamada = isMedico && pacienteSala?.nome ? 'Teleconsulta com ' + pacienteSala.nome : 'Teleconsulta'
  const subtituloChamada = sala?.titulo || ('Consulta ' + codigoSala)
  const abas: { value: AbaPainel; label: string }[] = isMedico
    ? [{ value: 'ia', label: 'IA' }, { value: 'chat', label: 'Chat' }, { value: 'pessoas', label: 'Pessoas' }]
    : [{ value: 'chat', label: 'Chat' }, { value: 'pessoas', label: 'Pessoas' }]
  const botoesPainel: { aba: AbaPainel; icon: LucideIcon; title: string; badge?: boolean }[] = [
    ...(isMedico ? [{ aba: 'ia' as AbaPainel, icon: Sparkles, title: 'Transcrição e IA', badge: modoPerfeita && toastsIA.length > 0 && abaPainel !== 'ia' }] : []),
    { aba: 'chat', icon: MessageSquare, title: 'Chat', badge: naoLidas > 0 && abaPainel !== 'chat' },
    { aba: 'pessoas', icon: Users, title: 'Participantes' },
  ]
  const sair = () => {
    if (papelRef.current === 'paciente') {
      streamRef.current?.getTracks().forEach(t => t.stop()); pcRef.current?.close(); channelRef.current?.unsubscribe()
      try { window.close() } catch (e) {}
      window.location.href = '/login'
    } else {
      encerrar()
    }
  }
  const itensChat = [...chat.map(m => ({ ...m, _tipo: 'msg' })), ...anexos.map(a => ({ ...a, _tipo: 'anexo' }))]

  return (
    <div style={{ position: 'fixed', inset: 0, background: N[900], color: '#fff', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* Cabeçalho */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 20px', flexWrap: 'wrap', flexShrink: 0 }}>
        <span style={{ width: 30, height: 30, borderRadius: 9, background: N[700], display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          <Icon icon={Activity} size={15} />
        </span>
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.25, minWidth: 0, flex: '1 1 160px' }}>
          <span style={{ fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tituloChamada}</span>
          <span style={{ fontSize: 12, color: TXT_ESCURO.secundario, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{subtituloChamada}</span>
        </div>
        {isMedico && (
          <BotaoMemed onClick={() => setMemedAberto(true)} variant="compact" disabled={!medicoSala || !pacienteSala} disabledReason="Aguardando dados do paciente" />
        )}
        {isMedico && processando && (
          <PilulaEscura cor="#FDE68A" fundo="rgba(234,179,8,.14)">
            <Spinner size={11} cor="#FDE68A" trilho="rgba(253,230,138,.3)" />Gerando prontuário…
          </PilulaEscura>
        )}
        {isMedico && (
          <PilulaEscura
            onClick={toggleGravação}
            title={gravando ? 'Parar gravação' : 'Iniciar gravação'}
            cor={gravando ? '#FFB3B3' : TXT_ESCURO.primario}
            fundo={gravando ? 'rgba(255,107,107,.14)' : branco(0.08)}
          >
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: gravando ? '#FF6B6B' : TXT_ESCURO.terciario, animation: gravando ? 'salaPulso 1.2s infinite' : 'none' }} />
            {gravando ? 'Gravando' : 'Gravar'}
          </PilulaEscura>
        )}
        <PilulaEscura cor="#fff" fundo={branco(0.08)}>
          <Icon icon={Lock} size={13} color="#4ADE80" />
          <span className="mono" style={{ fontSize: 12.5 }}>{fmtTimer(timer)}</span>
        </PilulaEscura>
      </div>

      {/* Corpo: palco de vídeo + painel lateral */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 14, padding: '0 16px', position: 'relative' }}>

        {/* Palco */}
        <div style={{ flex: 1, minWidth: 0, position: 'relative', borderRadius: T.radius['3xl'], overflow: 'hidden', background: `radial-gradient(circle at 50% 42%, #2f2a46, ${N[800]} 72%)` }}>
          {/* Vídeo remoto: contain = letterbox para vídeo em retrato */}
          <video ref={remoteRef} autoPlay playsInline
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', background: 'transparent' }} />

          {/* Aguardando o outro participante */}
          {!remoteConectado && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18, padding: 20, background: `radial-gradient(circle at 50% 42%, #2f2a46, ${N[800]} 72%)` }}>
              <span style={{ width: 132, height: 132, borderRadius: '50%', background: N[600], color: '#D9D2FF', display: 'grid', placeItems: 'center', fontSize: 42, fontWeight: 700, animation: 'salaAnel 2.4s ease-in-out infinite' }}>
                {iniciais(nomeOutro) || <Icon icon={UserRound} size={48} />}
              </span>
              <span style={{ fontSize: 15, fontWeight: 600 }}>{isMedico ? 'Aguardando paciente entrar…' : 'Conectando…'}</span>
              {isMedico && (
                <div style={{ width: 'min(380px, 100%)', background: '#fff', color: T.text.primary, borderRadius: 18, padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <span style={{ fontSize: 15, fontWeight: 700 }}>Sua sala está pronta</span>
                  <span style={{ fontSize: 13, color: T.text.secondary, lineHeight: 1.5 }}>Envie o link para o paciente. Ele entra pelo navegador, sem instalar nada.</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 40, padding: '0 5px 0 12px', borderRadius: 11, background: T.bg.page }}>
                    <span className="mono" style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: T.text.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {typeof window !== 'undefined' ? window.location.host + window.location.pathname : ''}
                    </span>
                    <IconButton icon={linkCopiado ? Check : Copy} size={30} onClick={copiarLink} title="Copiar link" aria-label="Copiar link" />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Nome do participante remoto */}
          {remoteConectado && (
            <span style={{ position: 'absolute', left: 16, bottom: 16, display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderRadius: 10, background: 'rgba(0,0,0,.45)', fontSize: 13, fontWeight: 600, maxWidth: 'calc(100% - 280px)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              <Icon icon={Mic} size={14} color="#4ADE80" />{nomeOutro}
            </span>
          )}

          {/* Self-view (PiP) */}
          {(tela === 'chamada' || entrando) && (
            <div style={{ position: 'absolute', right: 16, bottom: 16, width: 'min(220px, 32%)', minWidth: 110, aspectRatio: '16/10', borderRadius: 14, overflow: 'hidden', background: camOn ? '#2B2840' : '#24232B', border: `1px solid ${branco(0.1)}`, zIndex: 10 }}>
              <video ref={localRef} autoPlay playsInline muted
                style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)', display: 'block' }} />
              {!camOn && (
                <div style={{ position: 'absolute', inset: 0, background: '#24232B', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, fontSize: 12, color: '#C3C1CC' }}>
                  <Icon icon={VideoOff} size={15} />Câmera desligada
                </div>
              )}
              <span style={{ position: 'absolute', left: 8, bottom: 8, display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px', borderRadius: 7, background: 'rgba(0,0,0,.45)', fontSize: 11.5, fontWeight: 600 }}>
                <Icon icon={micOn ? Mic : MicOff} size={12} />Você
              </span>
            </div>
          )}

          {/* Modo Perfeita: insights novos flutuando no topo do palco */}
          {modoPerfeita && isMedico && toastsIA.length > 0 && abaPainel !== 'ia' && (
            <div style={{ position: 'absolute', top: 16, right: 16, width: 'min(300px, calc(100% - 32px))', display: 'flex', flexDirection: 'column', gap: 8, zIndex: 15, pointerEvents: 'none' }}>
              {toastsIA.map(t => {
                const cfg = CFG_INSIGHT[t.tipo]
                return (
                  <div key={t.id} style={{ background: N[800], border: `1px solid ${branco(0.1)}`, borderRadius: 14, padding: '10px 12px', display: 'flex', gap: 10, animation: 'salaToast .3s ease-out', pointerEvents: 'auto', boxShadow: '0 12px 30px -12px rgba(0,0,0,.6)' }}>
                    <span style={{ width: 26, height: 26, borderRadius: 8, flexShrink: 0, display: 'grid', placeItems: 'center', background: cfg.fundoEscuro, color: cfg.corEscura }}>
                      <Icon icon={cfg.icon} size={14} />
                    </span>
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span style={{ display: 'flex', fontSize: 11.5, fontWeight: 700, color: cfg.corEscura }}>
                        {cfg.label}<span className="mono" style={{ marginLeft: 'auto', fontWeight: 500, color: TXT_ESCURO.terciario }}>{t.hora}</span>
                      </span>
                      <span style={{ fontSize: 13, lineHeight: 1.45, color: '#fff' }}>{t.texto}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Input de arquivo oculto */}
        <input ref={anexoInputRef} type="file" accept="image/*,.pdf" style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) enviarAnexo(f); e.target.value = '' }} />

        {/* Painel lateral */}
        {abaPainel && (
          <div className="sala-painel" style={{ width: 340, maxWidth: '44vw', flexShrink: 0, background: T.bg.card, color: T.text.primary, borderRadius: T.radius['3xl'], display: 'flex', flexDirection: 'column', overflow: 'hidden', animation: 'salaPainel .2s ease' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 14px 10px' }}>
              <SegmentedControl<AbaPainel> options={abas} value={abaPainel} onChange={selecionarAba} stretch size="sm" style={{ flex: 1 }} />
              <IconButton icon={X} size={32} onClick={fecharPainel} aria-label="Fechar painel" />
            </div>

            {/* Aba IA (só médico) */}
            {abaPainel === 'ia' && isMedico && (
              <div ref={chatIARef} style={{ flex: 1, overflow: 'auto', padding: '4px 16px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* Gravação */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12, border: `1px solid ${T.border.default}` }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: gravando ? T.status.dangerStrong : T.text.tertiary, animation: gravando ? 'salaPulso 1.2s infinite' : 'none' }} />
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', lineHeight: 1.3 }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{gravando ? 'Gravando a consulta' : 'Gravação parada'}</span>
                    <span style={{ fontSize: 12, color: T.text.quaternary }}>{gravando ? 'O prontuário é gerado ao encerrar' : 'Inicie para gerar o prontuário'}</span>
                  </div>
                  <Button size="sm" variant={gravando ? 'danger' : 'secondary'} icon={gravando ? Square : Mic} onClick={toggleGravação}>{gravando ? 'Parar' : 'Gravar'}</Button>
                </div>

                {/* Modo Perfeita */}
                <div style={{ padding: '10px 12px', borderRadius: 12, border: `1px solid ${modoPerfeita ? T.brand.primaryAccentSoft : T.border.default}`, background: modoPerfeita ? T.brand.primarySoftBg : T.bg.card }}>
                  <Switch
                    checked={modoPerfeita}
                    onChange={v => setModoPerfeita(v)}
                    label={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Icon icon={Sparkles} size={14} color={T.brand.primary} />Modo Perfeita{modoPerfeita && carregandoSugestoes ? <span style={{ fontSize: 12, fontWeight: 500, color: T.brand.primary }}>· analisando…</span> : null}</span>}
                    descricao="A IA acompanha a conversa e sugere focos, perguntas e alertas."
                  />
                </div>

                {processando && (
                  <NotaIA>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                      <Spinner size={13} cor={T.brand.primary} trilho={T.brand.primaryAccent} />Gerando prontuário…
                    </span>
                  </NotaIA>
                )}
                {prontuarioData && !processando && (
                  <Button variant="secondary" icon={FileText} onClick={() => setProntuarioModal(true)}>Revisar prontuário</Button>
                )}

                {/* Insights */}
                {modoPerfeita && (
                  <>
                    <Overline style={{ color: '#9A98A5' }}>Insights da IA{mensagensIA.length > 0 ? ` · ${mensagensIA.length}` : ''}</Overline>
                    {mensagensIA.length === 0 ? (
                      <NotaIA>Ouvindo a consulta… as sugestões aparecem em instantes.</NotaIA>
                    ) : mensagensIA.map((m, i) => {
                      const cfg = CFG_INSIGHT[m.tipo]
                      return (
                        <div key={i} style={{ display: 'flex', gap: 10, padding: '10px 12px', borderRadius: 12, background: cfg.fundo, border: `1px solid ${cfg.borda}` }}>
                          <Icon icon={cfg.icon} size={15} color={cfg.cor} style={{ marginTop: 2 }} />
                          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <span style={{ display: 'flex', fontSize: 11.5, fontWeight: 700, color: cfg.cor }}>
                              {cfg.label}<span className="mono" style={{ marginLeft: 'auto', fontWeight: 500, color: T.text.tertiary }}>{m.hora}</span>
                            </span>
                            <span style={{ fontSize: 13, lineHeight: 1.5, color: T.text.strong }}>{m.texto}</span>
                          </div>
                        </div>
                      )
                    })}
                  </>
                )}

                {/* Transcrição ao vivo */}
                <Overline style={{ color: '#9A98A5' }}>Transcrição ao vivo</Overline>
                {transcricao ? (
                  <span style={{ fontSize: 13, lineHeight: 1.55, color: T.text.strong, whiteSpace: 'pre-wrap' }}>{transcricao}</span>
                ) : (
                  <span style={{ fontSize: 12.5, color: T.text.quaternary, lineHeight: 1.5 }}>
                    {gravando ? 'A transcrição aparece aqui conforme a conversa acontece.' : 'Inicie a gravação para transcrever a consulta.'}
                  </span>
                )}
              </div>
            )}

            {/* Aba Chat */}
            {abaPainel === 'chat' && (
              <>
                <div style={{ flex: 1, overflow: 'auto', padding: '4px 16px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <span style={{ fontSize: 12, color: T.text.quaternary, textAlign: 'center', padding: '6px 0' }}>
                    {itensChat.length === 0 ? 'Nenhuma mensagem ainda' : 'As mensagens ficam visíveis só durante a chamada'}
                  </span>
                  {itensChat.map((item, i) => {
                    const meu = item.de === 'Voce'
                    const bolha: React.CSSProperties = {
                      maxWidth: '82%', padding: '8px 12px', fontSize: 13, lineHeight: 1.45,
                      borderRadius: meu ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                      background: meu ? T.brand.primary : T.border.muted, color: meu ? '#fff' : T.text.primary,
                    }
                    return (
                      <div key={(item._tipo === 'anexo' ? 'a' : 'm') + i} style={{ display: 'flex', flexDirection: 'column', alignItems: meu ? 'flex-end' : 'flex-start', gap: 3 }}>
                        <span style={{ fontSize: 11, color: T.text.tertiary }}>{meu ? 'Você' : item.de === 'Medico' ? 'Médico' : item.de} · <span className="mono">{item.hora}</span></span>
                        {item._tipo === 'anexo' ? (
                          (item as any).tipo?.startsWith('image/') ? (
                            <a href={(item as any).url} download={(item as any).nome || 'imagem'} style={{ ...bolha, padding: 4, textDecoration: 'none', display: 'block' }}
                              onClick={e => { e.preventDefault(); const link = document.createElement('a'); link.href = (item as any).url; link.download = (item as any).nome || 'imagem'; document.body.appendChild(link); link.click(); document.body.removeChild(link) }}>
                              <img src={(item as any).url} alt={(item as any).nome} style={{ width: '100%', borderRadius: 9, cursor: 'pointer', maxHeight: 160, objectFit: 'cover', display: 'block' }} />
                              <span style={{ display: 'block', fontSize: 11.5, padding: '4px 6px 2px', opacity: 0.85, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{(item as any).nome}</span>
                            </a>
                          ) : (
                            <a href={(item as any).url} download={(item as any).nome} style={{ ...bolha, display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
                              <Icon icon={FileText} size={16} />
                              <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                                <span style={{ fontSize: 12.5, fontWeight: 600, maxWidth: 170, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(item as any).nome}</span>
                                <span style={{ fontSize: 11, opacity: 0.75 }}>Clique para baixar</span>
                              </span>
                            </a>
                          )
                        ) : (
                          <div style={bolha}>{(item as any).msg}</div>
                        )}
                      </div>
                    )
                  })}
                  <div ref={endRef} />
                </div>
                <div style={{ padding: 12, borderTop: `1px solid ${T.border.muted}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: 5, borderRadius: 12, border: `1px solid ${T.border.default}` }}>
                    <IconButton icon={enviandoAnexo ? undefined : Paperclip} size={32} onClick={() => anexoInputRef.current?.click()} disabled={enviandoAnexo} title="Enviar arquivo" aria-label="Enviar arquivo">
                      {enviandoAnexo ? <Spinner size={13} cor={T.brand.primary} trilho={T.brand.primaryAccent} /> : null}
                    </IconButton>
                    <input value={msgInput} onChange={e => setMsgInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && enviarChat()}
                      placeholder="Enviar mensagem"
                      style={{ flex: 1, minWidth: 0, height: 32, border: 'none', outline: 'none', background: 'transparent', fontSize: 13, fontFamily: 'inherit', color: T.text.primary }} />
                    <button onClick={enviarChat} aria-label="Enviar" style={{ width: 32, height: 32, borderRadius: 9, border: 'none', background: T.brand.primary, color: '#fff', display: 'grid', placeItems: 'center', cursor: 'pointer', flexShrink: 0 }}>
                      <Icon icon={Send} size={14} />
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* Aba Pessoas */}
            {abaPainel === 'pessoas' && (
              <div style={{ flex: 1, overflow: 'auto', padding: '4px 16px 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <Participante nome={nomeVoce} papel={isMedico ? 'Você · médico' : 'Você · paciente'} tom="purple" icone={micOn ? Mic : MicOff} status={<Badge tone="success" dot>Conectado</Badge>} />
                <Participante nome={nomeOutro} papel={isMedico ? 'Paciente' : 'Médico'} tom="pink"
                  status={remoteConectado ? <Badge tone="success" dot>Conectado</Badge> : <Badge tone="pending" dot>Aguardando</Badge>} />
                {isMedico && (
                  <Button variant="secondary" icon={linkCopiado ? Check : LinkIcon} onClick={copiarLink} style={{ marginTop: 8 }}>
                    {linkCopiado ? 'Link copiado' : 'Copiar link da sala'}
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Controles */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px 18px', flexWrap: 'wrap', flexShrink: 0 }}>
        <span className="mono sala-rodape-info" style={{ flex: '1 1 160px', fontSize: 12.5, color: TXT_ESCURO.secundario, whiteSpace: 'nowrap' }}>
          {fmtTimer(timer)} · {codigoSala}
        </span>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', margin: '0 auto' }}>
          <BotaoRedondo icon={micOn ? Mic : MicOff} desligado={!micOn} onClick={toggleMic} title="Microfone" />
          <BotaoRedondo icon={camOn ? Video : VideoOff} desligado={!camOn} onClick={toggleCam} title="Câmera" />
          <BotaoEncerrar onClick={sair} label={isMedico ? 'Encerrar' : 'Sair'} />
        </div>
        <div style={{ flex: '1 1 160px', display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
          {botoesPainel.map(b => (
            <BotaoPainel key={b.aba} icon={b.icon} title={b.title} ativo={abaPainel === b.aba} badge={!!b.badge} onClick={() => alternarAba(b.aba)} />
          ))}
        </div>
      </div>

      {/* Modal prontuário pós-consulta */}
      {prontuarioModal && prontuarioData && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: 16 }}>
          <div style={{ background: T.bg.card, color: T.text.primary, borderRadius: T.radius['3xl'], width: 'min(600px, 100%)', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: T.shadow.modal, overflow: 'hidden' }}>
            <div style={{ padding: '18px 20px 14px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
              <IconTile icon={FileText} color={T.brand.primary} size={36} />
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 16, fontWeight: 700 }}>Prontuário gerado pela IA</span>
                <span style={{ fontSize: 12.5, color: T.text.quaternary }}>Baseado na transcrição da consulta · revise antes de salvar</span>
              </div>
              <IconButton icon={X} size={32} onClick={() => setProntuarioModal(false)} aria-label="Fechar" />
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: '0 20px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {transcricao && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <Overline>Transcrição</Overline>
                  <div style={{ background: T.bg.page, borderRadius: 12, padding: '10px 12px', fontSize: 12.5, color: T.text.muted, lineHeight: 1.6, maxHeight: 80, overflow: 'auto' }}>{transcricao}</div>
                </div>
              )}
              {(['subjetivo', 'objetivo', 'avaliacao', 'plano'] as const).map(campo => {
                const pd = prontuarioData?.prontuario ?? prontuarioData ?? {}
                const val = pd[campo] ?? ''
                if (!val) return null
                return (
                  <Field key={campo} label={ROTULO_SOAP[campo]}>
                    <Textarea defaultValue={val} rows={3} onChange={e => { camposRef.current[campo] = e.target.value }} style={{ fontSize: 13 }} />
                  </Field>
                )
              })}
            </div>
            <div style={{ padding: '14px 20px', borderTop: `1px solid ${T.border.muted}`, display: 'flex', gap: 8, justifyContent: 'flex-end', flexShrink: 0 }}>
              <Button variant="secondary" onClick={() => setProntuarioModal(false)}>Fechar</Button>
              <BotaoSalvar salvando={salvando} salvado={salvado} onClick={salvarProntuario} />
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: ESTILOS_BASE + `
        @keyframes salaToast { from { opacity: 0; transform: translateX(24px) } to { opacity: 1; transform: none } }
        @keyframes salaPainel { from { opacity: 0; transform: translateX(16px) } to { opacity: 1; transform: none } }
        html, body { margin: 0; padding: 0; background: ${N[900]}; overflow: hidden; }
        @media (max-width: 720px) {
          html, body { height: 100dvh; }
          .sala-painel { position: absolute; top: 0; bottom: 0; left: 12px; right: 12px; width: auto !important; max-width: none !important; z-index: 30; box-shadow: ${T.shadow.modal}; }
          .sala-rodape-info { display: none; }
        }
      ` }} />

      {memedAberto && medicoSala && pacienteSala && (
        <MemedPrescricao
          medicoId={medicoSala.id}
          paciente={{
            id: pacienteSala.id,
            nome: pacienteSala.nome,
            cpf: pacienteSala.cpf,
            data_nascimento: pacienteSala.data_nascimento,
            sexo: pacienteSala.sexo,
            telefone: pacienteSala.telefone,
            email: pacienteSala.email,
            endereco: pacienteSala.endereco,
          }}
          onClose={() => setMemedAberto(false)}
          onPrescricaoGerada={(dados: any) => {
            // Salva prescricao no banco (Memed compliance)
            fetch('/api/prescricoes', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                paciente_id: pacienteSala?.id,
                medico_id: medicoSala?.id,
                clinica_id: medicoSala?.clinica_id || null,
                dados_memed: dados,
              }),
            }).catch((err: any) => log.error('Erro ao salvar prescricao:', err))
            setMemedAberto(false)
          }}
        />
      )}
    </div>
  )
}

// ── Apresentação (componentes locais da sala) ────────────────────────────────

type AbaPainel = 'ia' | 'chat' | 'pessoas'

const branco = (a: number) => `rgba(255,255,255,${a})`

/** Texto sobre superfícies escuras (night). */
const TXT_ESCURO = { primario: '#D6D4DE', secundario: '#A8A5B8', terciario: '#7D7A8C' }

const ROTULO_SOAP: Record<'subjetivo' | 'objetivo' | 'avaliacao' | 'plano', string> = {
  subjetivo: 'S · Subjetivo',
  objetivo: 'O · Objetivo',
  avaliacao: 'A · Avaliação / CID',
  plano: 'P · Plano',
}

const CFG_INSIGHT: Record<'foco' | 'sugestao' | 'alerta', {
  icon: LucideIcon; label: string; cor: string; fundo: string; borda: string; corEscura: string; fundoEscuro: string
}> = {
  foco: { icon: Target, label: 'Foco', cor: tokens.status.infoStrong, fundo: tokens.status.infoBg, borda: '#DCE8FD', corEscura: '#93C5FD', fundoEscuro: 'rgba(96,165,250,.16)' },
  sugestao: { icon: Lightbulb, label: 'Sugestão', cor: tokens.brand.primary, fundo: tokens.brand.primarySoftBg, borda: '#ECE8FB', corEscura: '#C4B5FD', fundoEscuro: 'rgba(167,139,250,.18)' },
  alerta: { icon: TriangleAlert, label: 'Alerta', cor: tokens.status.danger, fundo: tokens.status.dangerBg, borda: '#F8D6D3', corEscura: '#FF9A9E', fundoEscuro: 'rgba(229,72,77,.18)' },
}

const ESTILOS_BASE = `
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes salaPulso { 0%, 100% { opacity: 1; } 50% { opacity: .35; } }
  @keyframes salaAnel {
    0%, 100% { box-shadow: 0 0 0 0 rgba(167,139,250,0); }
    50% { box-shadow: 0 0 0 6px rgba(167,139,250,.35), 0 0 0 14px rgba(167,139,250,.12); }
  }
  * { box-sizing: border-box; }
`

function iniciais(nome: string) {
  return (nome || '').split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

function Spinner({ size = 16, cor, trilho }: { size?: number; cor: string; trilho: string }) {
  return (
    <span style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0, display: 'inline-block',
      border: `${size >= 24 ? 3 : 2}px solid ${trilho}`, borderTopColor: cor, animation: 'spin .8s linear infinite',
    }} />
  )
}

/** Controle redondo da chamada (mic/câmera) — branco translúcido; vermelho quando desligado. */
function BotaoRedondo({ icon, desligado, onClick, title, size = 48 }: {
  icon: LucideIcon; desligado?: boolean; onClick: () => void; title: string; size?: number
}) {
  const [h, setH] = useState(false)
  return (
    <button type="button" onClick={onClick} title={title} aria-label={title} aria-pressed={desligado}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{
        width: size, height: size, borderRadius: '50%', border: 'none', cursor: 'pointer', flexShrink: 0,
        display: 'grid', placeItems: 'center', color: '#fff',
        background: desligado ? tokens.status.dangerStrong : branco(h ? 0.14 : 0.1),
        filter: desligado && h ? 'brightness(1.1)' : 'none', transition: 'background .15s, filter .15s',
      }}>
      <Icon icon={icon} size={size >= 48 ? 20 : 18} />
    </button>
  )
}

function BotaoEncerrar({ onClick, label }: { onClick: () => void; label: string }) {
  const [h, setH] = useState(false)
  return (
    <button type="button" onClick={onClick} title={label}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{
        height: 48, padding: '0 22px', borderRadius: 99, border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'inherit', fontSize: 13.5, fontWeight: 600,
        color: '#fff', background: h ? '#D63C41' : tokens.status.dangerStrong, transition: 'background .15s',
      }}>
      <Icon icon={PhoneOff} size={18} />{label}
    </button>
  )
}

/** Botão quadrado que abre uma aba do painel lateral. */
function BotaoPainel({ icon, title, ativo, badge, onClick }: {
  icon: LucideIcon; title: string; ativo: boolean; badge?: boolean; onClick: () => void
}) {
  const [h, setH] = useState(false)
  return (
    <button type="button" onClick={onClick} title={title} aria-label={title} aria-pressed={ativo}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{
        position: 'relative', width: 42, height: 42, borderRadius: 12, border: 'none', cursor: 'pointer',
        display: 'grid', placeItems: 'center', flexShrink: 0,
        background: ativo ? tokens.brand.primaryLight : branco(h ? 0.14 : 0.08),
        color: ativo ? tokens.brand.primary : '#fff', transition: 'background .15s',
      }}>
      <Icon icon={icon} size={18} active={ativo} />
      {badge && <span style={{ position: 'absolute', top: 6, right: 6, width: 8, height: 8, borderRadius: '50%', background: tokens.accent.violet }} />}
    </button>
  )
}

/** Pílula do cabeçalho escuro (timer, gravação, status). */
function PilulaEscura({ children, cor, fundo, onClick, title }: {
  children: React.ReactNode; cor: string; fundo: string; onClick?: () => void; title?: string
}) {
  const estilo: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 7, height: 30, padding: '0 12px', borderRadius: 99,
    background: fundo, color: cor, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', border: 'none', fontFamily: 'inherit',
  }
  if (onClick) return <button type="button" onClick={onClick} title={title} style={{ ...estilo, cursor: 'pointer' }}>{children}</button>
  return <span style={estilo}>{children}</span>
}

function NotaIA({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 10, padding: 12, borderRadius: 12, background: tokens.brand.primarySoftBg, border: '1px solid #ECE8FB', fontSize: 12.5, lineHeight: 1.5, color: tokens.text.strong }}>
      <Icon icon={Sparkles} size={16} color={tokens.brand.primary} style={{ marginTop: 1 }} />
      <span style={{ flex: 1, minWidth: 0 }}>{children}</span>
    </div>
  )
}

function ResumoItem({ label, valor }: { label: string; valor: React.ReactNode }) {
  return (
    <div style={{ padding: 12, borderRadius: 12, background: tokens.bg.page, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
      <span style={{ fontSize: 11.5, color: tokens.text.quaternary }}>{label}</span>
      <span style={{ fontSize: 13.5, fontWeight: 700, color: tokens.text.primary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{valor}</span>
    </div>
  )
}

function Participante({ nome, papel, tom, icone, status }: {
  nome: string; papel: string; tom: 'purple' | 'pink'; icone?: LucideIcon; status?: React.ReactNode
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0' }}>
      <Avatar nome={nome} size={34} tom={tom} />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', lineHeight: 1.3 }}>
        <span style={{ fontSize: 13.5, fontWeight: 600, color: tokens.text.primary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nome}</span>
        <span style={{ fontSize: 12, color: tokens.text.quaternary }}>{papel}</span>
      </div>
      {status}
      {icone && <Icon icon={icone} size={15} color={tokens.text.tertiary} />}
    </div>
  )
}

function BotaoSalvar({ salvando, salvado, onClick }: { salvando: boolean; salvado: boolean; onClick: () => void }) {
  return (
    <Button
      onClick={onClick}
      disabled={salvando}
      icon={salvado ? Check : salvando ? undefined : Save}
      style={salvado ? { background: tokens.status.success, borderColor: tokens.status.success, cursor: 'default' } : undefined}
    >
      {salvando && <Spinner size={14} cor="#fff" trilho="rgba(255,255,255,.3)" />}
      {salvado ? 'Salvo! Abrindo histórico…' : salvando ? 'Salvando…' : 'Salvar no histórico'}
    </Button>
  )
}
