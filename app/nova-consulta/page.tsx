'use client'
import { log } from '@/lib/logger'

import { useState, useCallback, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Mic, Zap, Pause, Play, Sparkles, AudioLines, CircleCheck, CircleDashed, LoaderCircle, CircleAlert,
  Copy, Download, Check, Plus, FlaskConical, FileBadge, Printer, MessageCircle, RefreshCw, TriangleAlert, Lightbulb, Target,
} from 'lucide-react'
import { useTranscricao } from '@/lib/transcricao/useTranscricao'
import { useToast } from '@/components/Toast'
import { supabase } from '@/lib/supabase'
import { ProntuarioCard, exportarProntuarioPdf } from '@/components/ProntuarioCard'
import { PacienteBanner } from '@/components/PacienteBanner'
import { MemedPrescricao } from '@/components/MemedPrescricao'
import { BotaoMemed } from '@/components/BotaoMemed'
import { SidebarContextoPaciente } from '@/components/SidebarContextoPaciente'
import { ModalDadosPacienteAvulso } from '@/components/ModalDadosPacienteAvulso'
import { ModalSelecionarPaciente } from '@/components/ModalSelecionarPaciente'
// import ComandaDrawer from '@/components/financeiro/ComandaDrawer' // Financeiro desligado pra rebuild. Sprint 1 pré-beta.
import { tokens } from '@/lib/design-tokens'
import { Badge, Button, Card, Icon, IconButton, Input, Modal, Overline, ProgressBar, Textarea } from '@/components/ui'
import { notificar } from '@/components/ui/dialogos'
import { ResumoPreConsulta } from '@/components/ia/ResumoPreConsulta'
import { SeletorModeloProntuario } from '@/components/ia/SeletorModeloProntuario'
import { modeloParaRequisicao, type ModeloProntuario } from '@/lib/ai/modelos-prontuario'
import CardAgendarRetorno from '@/components/retornos/CardAgendarRetorno'
import { BotaoGerarGuia } from '@/components/tiss/BotaoGerarGuia'
import { registrarAcesso } from '@/lib/auditoria'
import ConversaConsulta from '@/components/ia/ConversaConsulta'

const T = tokens
const ONDA = '#8B74E8' // roxo médio da onda de áudio (protótipo)

type Estado = 'idle' | 'gravando' | 'processando' | 'pronto' | 'erro'
type SecaoSoap = 'subjetivo' | 'objetivo' | 'avaliacao' | 'plano'

const ETAPAS_GERACAO = ['Finalizando transcrição', 'Organizando no formato SOAP', 'Sugerindo CID-10', 'Identificando hipóteses e alertas']

function SearchParamsReader({ onParams }: { onParams: (pid: string | null, pnome: string | null, ptel: string | null) => void }) {
  const searchParams = useSearchParams()
  useEffect(() => {
    onParams(searchParams.get('paciente_id'), searchParams.get('paciente_nome'), searchParams.get('paciente_tel'))
  }, [searchParams, onParams])
  return null
}

const mmss = (s: number) => String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0')

/** Onda de áudio com o volume real do microfone (histórico rolando da direita para a esquerda). */
function OndaAudio({ ativa, nivel }: { ativa: boolean; nivel: number }) {
  const N = 84
  const hist = useRef<number[]>(Array(N).fill(0))
  const [, tique] = useState(0)
  useEffect(() => {
    hist.current = [...hist.current.slice(1), ativa ? nivel : 0]
    tique(x => x + 1)
  }, [nivel, ativa])
  return (
    <div aria-hidden style={{ display: 'flex', alignItems: 'center', gap: 2, height: 28, flex: 1, minWidth: 0, overflow: 'hidden' }}>
      {hist.current.map((v, i) => (
        <span key={i} style={{
          width: 3, flexShrink: 0, borderRadius: 2,
          height: ativa ? Math.max(3, Math.round(3 + v * 25)) : 3,
          background: ativa ? (i > N - 12 ? T.brand.primaryAccent : ONDA) : T.border.strong,
          transition: 'height .12s linear, background .2s',
        }} />
      ))}
    </div>
  )
}

/** Selo do estado da transcrição ao vivo. */
function StatusConexao({ conexao, fase }: { conexao: string; fase: string }) {
  if (fase === 'finalizando' || fase === 'revisando') return null
  const mapa: Record<string, [string, string, string]> = {
    conectando: ['Conectando…', T.text.tertiary, T.bg.page],
    ao_vivo: ['Ao vivo', T.status.success, T.status.successBg],
    reconectando: ['Reconectando…', T.status.warning, T.status.warningBg],
    sem_ao_vivo: ['Gravando — o texto aparece ao encerrar', T.status.warning, T.status.warningBg],
  }
  const m = mapa[conexao]
  if (!m) return null
  return (
    <span title="Transcrição ao vivo" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: m[1], background: m[2], padding: '4px 10px', borderRadius: 99, whiteSpace: 'nowrap' }}>
      <span style={{ width: 6, height: 6, borderRadius: 99, background: m[1] }} />{m[0]}
    </span>
  )
}


/** Linha de documento do painel lateral (ícone, rótulo, estado). */
function LinhaDocumento({ icon, label, estado, onClick, disabled, children }: {
  icon: any
  label: string
  estado: 'novo' | 'gerando' | 'pronto'
  onClick?: () => void
  disabled?: boolean
  children?: React.ReactNode
}) {
  const [h, setH] = useState(false)
  const clicavel = !!onClick && !disabled
  return (
    <div style={{ border: `1px solid ${T.border.default}`, borderRadius: 10, overflow: 'hidden' }}>
      <button
        type="button"
        onClick={clicavel ? onClick : undefined}
        onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
        style={{
          all: 'unset', boxSizing: 'border-box', width: '100%', cursor: clicavel ? 'pointer' : 'default',
          display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', fontSize: 13, fontWeight: 600, color: T.text.strong,
          background: clicavel && h ? T.bg.page : 'transparent', transition: 'background .15s',
        }}
      >
        <Icon icon={icon} size={15} color={T.text.secondary} />
        <span style={{ flex: 1 }}>{label}</span>
        {estado === 'gerando'
          ? <Icon icon={LoaderCircle} size={15} color={T.brand.primary} style={{ animation: 'spin .8s linear infinite' }} />
          : estado === 'pronto'
            ? <Icon icon={CircleCheck} size={15} color={T.status.success} />
            : <Icon icon={Plus} size={15} color={T.text.tertiary} />}
      </button>
      {children && <div style={{ padding: '0 10px 10px' }}>{children}</div>}
    </div>
  )
}

export default function Home() {
  const router = useRouter()
  const { toast } = useToast()
  const [medico, setMedico] = useState<any>(null)
  const [transcricao, setTranscricao] = useState('')
  const [prontuario, setProntuario] = useState<any>(null)
  const [estado, setEstado] = useState<Estado>('idle')
  const [erroMsg, setErroMsg] = useState('')
  const [consultaSalva, setConsultaSalva] = useState(false)
  const [consultaId, setConsultaId] = useState<string | null>(null)
  // Modelo de prontuário escolhido (SOAP, Pediatria, Dermatologia…) — enviado à IA ao estruturar
  const [modelo, setModelo] = useState<ModeloProntuario | null>(null)
  const [editado, setEditado] = useState(false)
  const [salvandoEdicao, setSalvandoEdicao] = useState(false)
  const [copiloto, setCopiloto] = useState<any>(null)
  const [resumoPaciente, setResumoPaciente] = useState('')
  const [gerandoResumo, setGerandoResumo] = useState(false)
  const [exames, setExames] = useState<any>(null)
  const [atestado, setAtestado] = useState<any>(null)
  const [gerandoDoc, setGerandoDoc] = useState(false)
  const [diasAtestado, setDiasAtestado] = useState(1)
  const [modoPerfeita, setModoPerfeita] = useState(false)
  const [sugestoes, setSugestoes] = useState<string[]>([])
  const [alertasRT, setAlertasRT] = useState<string[]>([])
  const [focoConsulta, setFocoConsulta] = useState('')
  const [carregandoSugestoes, setCarregandoSugestoes] = useState(false)
  const [modalPaciente, setModalPaciente] = useState(false)
  const [modalAvulso, setModalAvulso] = useState(false)
  const [modalTranscricao, setModalTranscricao] = useState(false)
  const [textoTranscricaoModal, setTextoTranscricaoModal] = useState('')
  const [pacienteAvulso, setPacienteAvulso] = useState<any>(null)
  const [pacientes, setPacientes] = useState<any[]>([])
  const [pacienteSelecionado, setPacienteSelecionado] = useState<any>(null)
  const [memedAberto, setMemedAberto] = useState(false)
  const [segundos, setSegundos] = useState(0)
  const [etapaGeracao, setEtapaGeracao] = useState(0)

  useEffect(() => {
    (async () => {
      const ca_ = localStorage.getItem('clinica_admin')
      const m = ca_ || localStorage.getItem('medico')
      if (!m) { router.push('/login'); return }
      const med = JSON.parse(m)
      if (ca_ && med.clinica_id) {
        const { data: medicos } = await supabase
          .from('medicos').select('*')
          .eq('clinica_id', med.clinica_id)
          .order('criado_em', { ascending: true }).limit(1)
        if (medicos && medicos.length > 0) {
          setMedico(medicos[0])
        } else {
          setMedico(med)
        }
      } else {
        setMedico(med)
      }
      let url = ''
      if (ca_) {
        const admin = JSON.parse(ca_)
        if (admin.clinica_id) url = '/api/pacientes?clinica_id=' + admin.clinica_id
      } else if (med.clinica_id) {
        url = '/api/pacientes?clinica_id=' + med.clinica_id
      } else {
        url = '/api/pacientes?medico_id=' + med.id
      }
      try {
        const r = await fetch(url)
        const data = await r.json()
        const lista = Array.isArray(data) ? data : (data?.pacientes || data?.data || [])
        setPacientes(lista)
      } catch (err) {
        log.error('[nova-consulta] erro carregando pacientes:', err)
        setPacientes([])
      }
    })()
  }, [router])

  const handleSearchParams = useCallback((pid: string | null, pnome: string | null, ptel: string | null) => {
    if (pid && pnome) {
      setPacienteSelecionado({ id: pid, nome: pnome, telefone: ptel || '' })
      setModalPaciente(false)
    }
  }, [])

  const handleNovoTexto = useCallback((t: string) => setTranscricao(t), [])
  const { gravando, transcrevendo, iniciarGravacao, pararGravacao, pausarGravacao, gravandoPausado, limpar, erro, fase, parcial, nivel, vozBaixa, conexao } = useTranscricao(handleNovoTexto, { medicoId: medico?.id })

  // Cronômetro da gravação (só visual)
  useEffect(() => {
    if (estado !== 'gravando' || !gravando || gravandoPausado) return
    const t = setInterval(() => setSegundos(s => s + 1), 1000)
    return () => clearInterval(t)
  }, [estado, gravando, gravandoPausado])

  // Etapas da geração (só visual — a API responde de uma vez)
  useEffect(() => {
    if (estado !== 'processando') return
    setEtapaGeracao(0)
    const t = setInterval(() => setEtapaGeracao(e => Math.min(e + 1, ETAPAS_GERACAO.length - 1)), 2200)
    return () => clearInterval(t)
  }, [estado])

  const handleIniciar = async () => {
    limpar(); setProntuario(null)
    setConsultaSalva(false); setConsultaId(null); setEditado(false); setSegundos(0); setEstado('gravando')
    await iniciarGravacao()
  }

  const handleParar = async () => {
    // Espera as últimas frases e a revisão do áudio inteiro antes de gerar o prontuário
    const final = await pararGravacao()
    if (final && final.trim().length > 10) handleEstruturar(final)
    else setEstado('idle')
  }

  const handleEstruturar = async (textoParam?: string) => {
    const texto = textoParam ?? transcricao
    if (!texto.trim()) return
    setEstado('processando'); setErroMsg('')
    try {
      const res = await fetch('/api/estruturar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcricao: texto, ...(modelo ? { modelo: modeloParaRequisicao(modelo) } : {}) }),
      })
      const data = await res.json()
      if (data.prontuario) {
        setProntuario(data.prontuario); setEstado('pronto'); setEditado(false)
        salvarConsulta(data.prontuario, texto)
      } else throw new Error(data.error)
    } catch (e: any) { setEstado('erro'); setErroMsg(e.message) }
  }

  const salvarConsulta = async (p: any, textoTranscricao: string = transcricao) => {
    if (!medico) return
    try {
      const r = await fetch('/api/consultas', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ medico_id: medico.id, transcricao: textoTranscricao, paciente_id: pacienteSelecionado?.id || null, ...p }),
      })
      const d = await r.json().catch(() => null)
      if (d?.id) {
        setConsultaId(d.id)
        registrarAcesso({ acao: 'editou', recurso: 'consulta', recursoId: d.id, pacienteId: pacienteSelecionado?.id || null, detalhes: { criada: true } })
      }
      setConsultaSalva(true)
      toast('Consulta salva com sucesso!')
    if (p.paciente_id) {
      fetch('/api/copiloto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paciente_id: p.paciente_id, medico_id: medico.id, prontuario_atual: p })
      }).then(r => r.json()).then(d => setCopiloto(d)).catch(() => {})
    }
    } catch (e) { log.error(e) }
  }

  // Edição das seções SOAP depois de gerado (atualiza a consulta já salva)
  const editarSecao = (key: SecaoSoap, valor: string) => {
    setProntuario((p: any) => ({ ...p, [key]: valor }))
    setEditado(true)
  }

  const salvarAlteracoes = async () => {
    if (!prontuario) return
    if (!consultaId) { await salvarConsulta(prontuario); setEditado(false); return }
    setSalvandoEdicao(true)
    const { error } = await supabase
      .from('consultas')
      .update({ subjetivo: prontuario.subjetivo, objetivo: prontuario.objetivo, avaliacao: prontuario.avaliacao, plano: prontuario.plano })
      .eq('id', consultaId)
    // Seções do modelo (coluna da migration 0014 — se não existir, ignora sem quebrar)
    if (!error && Array.isArray(prontuario.secoes)) {
      await supabase.from('consultas').update({ secoes: prontuario.secoes }).eq('id', consultaId)
    }
    if (!error) registrarAcesso({ acao: 'editou', recurso: 'consulta', recursoId: consultaId, pacienteId: pacienteSelecionado?.id || null })
    setSalvandoEdicao(false)
    if (error) { toast('Erro ao salvar alterações', 'error'); return }
    setEditado(false)
    toast('Alterações salvas no histórico')
  }

const handleCopiar = () => {
    if (!prontuario) return
    const t = [
      `PRONTUÁRIO  -  ${new Date().toLocaleDateString('pt-BR')}`,
      medico ? `${medico.nome} | ${medico.crm}` : '', '',
      'SUBJETIVO', prontuario.subjetivo, '',
      'OBJETIVO', prontuario.objetivo, '',
      'AVALIAÇÃO', prontuario.avaliacao, '',
      'PLANO', prontuario.plano, '',
      'CID-10', ...(prontuario.cids||[]).map((c:any) => `${c.codigo}  -  ${c.descricao}`),
    ].join('\n')
    navigator.clipboard.writeText(t)
    toast('Prontuário copiado!')
  }

  const handleGerarResumo = async () => {
    if (!prontuario) return
    setGerandoResumo(true)
    try {
      const res = await fetch('/api/resumo-paciente', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prontuario, medico })
      })
      const data = await res.json()
      if (data.resumo) { setResumoPaciente(data.resumo) }
    } catch (e) { log.error(e) }
    finally { setGerandoResumo(false) }
  }

  const handleGerarExames = async () => {
    if (!prontuario) return
    setGerandoDoc(true)
    try {
      const res = await fetch('/api/documentos', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: 'exames', prontuario, medico })
      })
      const data = await res.json()
      if (data.exames) { setExames(data) }
    } catch (e) { log.error(e) }
    finally { setGerandoDoc(false) }
  }

  const handleGerarAtestado = async () => {
    if (!prontuario) return
    setGerandoDoc(true)
    try {
      const res = await fetch('/api/documentos', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: 'atestado', prontuario, medico, paciente: null })
      })
      const data = await res.json()
      if (data.dias !== undefined) { setAtestado({ ...data, dias: diasAtestado }) }
    } catch (e) { log.error(e) }
    finally { setGerandoDoc(false) }
  }

  const imprimirAtestado = async () => {
    if (!atestado || !medico) return
    const res = await fetch('/api/pdf-atestado', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ medico, paciente: null, atestado })
    })
    const html = await res.text()
    const win = window.open('', '_blank')
    if (win) { win.document.write(html); win.document.close(); setTimeout(() => win.print(), 500) }
  }

  const buscarSugestoes = async (texto: string) => {
    if (!texto || texto.trim().length < 50 || carregandoSugestoes) return
    setCarregandoSugestoes(true)
    try {
      const res = await fetch('/api/sugestoes-consulta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcricao: texto, especialidade: medico?.especialidade || '' })
      })
      const data = await res.json()
      if (data.sugestoes) setSugestoes(data.sugestoes)
      if (data.alertas) setAlertasRT(data.alertas)
      if (data.foco) setFocoConsulta(data.foco)
    } catch (e) { log.error(e) }
    finally { setCarregandoSugestoes(false) }
  }

  // Dispara sugestoes quando transcricao muda (com debounce)
  useEffect(() => {
    if (!modoPerfeita || !transcricao || transcricao.trim().length < 50) return
    const timer = setTimeout(() => buscarSugestoes(transcricao), 3000)
    return () => clearTimeout(timer)
  }, [transcricao, modoPerfeita])

  const enviarWhatsApp = async (tipo: string, conteudo: string) => {
    if (!pacienteSelecionado?.telefone) { notificar('Paciente sem telefone cadastrado', 'erro'); return }
    const tel = pacienteSelecionado.telefone.replace(/[^0-9]/g, '')
    const telWpp = tel.startsWith('55') ? tel : '55' + tel
    const m = localStorage.getItem('medico')
    const med = m ? JSON.parse(m) : null
    await fetch('/api/whatsapp/enviar', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({telefone:telWpp,texto:conteudo,medico_id:med?.id})})
    notificar('Orientações enviadas pelo WhatsApp')
  }

  const handleNovo = () => {
    limpar(); setTranscricao(''); setProntuario(null)
    setEstado('idle'); setErroMsg(''); setConsultaSalva(false)
    setConsultaId(null); setEditado(false); setSegundos(0)
    setResumoPaciente(''); setExames(null); setAtestado(null); setCopiloto(null)
    setPacienteSelecionado(null); setModalPaciente(true)
  }

  const abrirModalTranscricao = () => {
    setTextoTranscricaoModal(transcricao)
    setModalTranscricao(true)
  }

  const gerarDaTranscricao = () => {
    const t = textoTranscricaoModal.trim()
    if (!t) return
    setModalTranscricao(false)
    setProntuario(null); setConsultaSalva(false); setConsultaId(null); setSegundos(0)
    setTranscricao(t)
    handleEstruturar(t)
  }

  if (!medico) return null

  const palavras = transcricao.split(' ').filter(Boolean).length
  const temContexto = !!(pacienteSelecionado && medico)

  // ── Cards reutilizados ───────────────────────────────────────────────────
  const cardContexto = temContexto ? (
    <Card titulo={<span style={{ fontSize: 14 }}>Contexto do paciente</span>} style={{ minWidth: 0 }}>
      <SidebarContextoPaciente pacienteId={pacienteSelecionado.id} medicoId={medico.id} />
    </Card>
  ) : null

  const cardSugestoes = (
    <Card style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Icon icon={Sparkles} size={15} color={T.brand.primary} />
        <h3 style={{ margin: 0, flex: 1, fontSize: 14, fontWeight: 700, letterSpacing: '-.01em', color: T.text.primary }}>Sugestões da IA</h3>
        {carregandoSugestoes && <Icon icon={LoaderCircle} size={14} color={T.brand.primary} style={{ animation: 'spin .8s linear infinite' }} />}
      </div>
      {!modoPerfeita ? (
        <>
          <span style={{ fontSize: 12.5, color: T.text.tertiary, lineHeight: 1.5 }}>
            Ative o modo perfeita para receber foco, alertas e sugestões enquanto a consulta acontece.
          </span>
          <Button variant="secondary" size="sm" icon={Zap} onClick={() => setModoPerfeita(true)} style={{ alignSelf: 'flex-start' }}>Ativar modo perfeita</Button>
        </>
      ) : !(sugestoes.length > 0 || focoConsulta || alertasRT.length > 0) ? (
        <span style={{ fontSize: 12.5, color: T.text.tertiary, lineHeight: 1.5 }}>
          Foco, alertas e perguntas sugeridas aparecem aqui conforme a conversa avança.
        </span>
      ) : (
        <>
          {focoConsulta && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Overline>Foco</Overline>
              <span style={{ display: 'flex', gap: 8, fontSize: 12.5, lineHeight: 1.5, color: T.brand.primaryDark, background: T.brand.primarySubtle, padding: '8px 10px', borderRadius: 8 }}>
                <Icon icon={Target} size={14} style={{ marginTop: 2 }} />{focoConsulta}
              </span>
            </div>
          )}
          {alertasRT.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Overline>Alertas</Overline>
              {alertasRT.map((a, i) => (
                <span key={i} style={{ display: 'flex', gap: 8, fontSize: 12.5, lineHeight: 1.5, color: T.status.danger, background: T.status.dangerBg, padding: '8px 10px', borderRadius: 8 }}>
                  <Icon icon={TriangleAlert} size={14} style={{ marginTop: 2 }} />{a}
                </span>
              ))}
            </div>
          )}
          {sugestoes.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Overline>Sugestões</Overline>
              {sugestoes.slice(0, 3).map((sug, i) => (
                <span key={i} style={{ display: 'flex', gap: 8, fontSize: 12.5, lineHeight: 1.5, color: T.text.strong, background: T.bg.page, padding: '8px 10px', borderRadius: 8 }}>
                  <Icon icon={Lightbulb} size={14} color={T.brand.primary} style={{ marginTop: 2 }} />{sug}
                </span>
              ))}
            </div>
          )}
        </>
      )}
    </Card>
  )

  const cardBase: React.CSSProperties = { background: T.bg.card, border: `1px solid ${T.border.default}`, borderRadius: 16, minWidth: 0 }
  const cardCentro: React.CSSProperties = {
    ...cardBase, padding: '40px 24px', minHeight: 520, boxSizing: 'border-box',
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
  }

  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Suspense fallback={null}>
        <SearchParamsReader onParams={handleSearchParams} />
      </Suspense>

      {/* ComandaDrawer removido — módulo financeiro desligado pra rebuild. Sprint 1 pré-beta. */}

      {/* Modal seleção de paciente */}
      {modalPaciente && (
        <ModalSelecionarPaciente
          pacientes={pacientes}
          onSelecionar={(p) => { setPacienteSelecionado(p); setModalPaciente(false) }}
          onFechar={() => setModalPaciente(false)}
          titulo={pacienteSelecionado ? 'Trocar paciente' : 'Selecionar paciente'}
        />
      )}

      {/* Modal: gerar a partir de transcrição */}
      {modalTranscricao && (
        <Modal
          titulo="Gerar a partir de transcrição"
          onClose={() => setModalTranscricao(false)}
          largura={560}
          rodape={<>
            <Button variant="secondary" onClick={() => setModalTranscricao(false)}>Cancelar</Button>
            <Button icon={Sparkles} onClick={gerarDaTranscricao} disabled={!textoTranscricaoModal.trim()}>Gerar prontuário</Button>
          </>}
        >
          <p style={{ fontSize: 12.5, color: T.text.quaternary, lineHeight: 1.5, margin: '-4px 0 12px' }}>
            Cole a transcrição de uma gravação anterior ou de outro aplicativo.
          </p>
          <Textarea
            value={textoTranscricaoModal}
            onChange={e => setTextoTranscricaoModal(e.target.value)}
            placeholder={'Médico: Bom dia, o que trouxe você hoje?\nPaciente: …'}
            autoFocus
            style={{ minHeight: 200, fontSize: 13 }}
          />
        </Modal>
      )}

      {/* Barra do paciente */}
      <PacienteBanner
        pacienteId={pacienteSelecionado?.id || null}
        medicoId={medico?.id || ''}
        onTrocar={() => setModalPaciente(true)}
        acoes={
          <>
            {estado === 'gravando' && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 8, padding: '7px 12px', borderRadius: 99, fontSize: 12.5, fontWeight: 700,
                background: gravandoPausado ? T.status.warningBg : T.status.dangerBg,
                color: gravandoPausado ? T.status.warning : T.status.dangerStrong,
              }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'currentColor', animation: gravandoPausado ? 'none' : 'pulse-record 1.5s ease-in-out infinite' }} />
                {gravandoPausado ? 'Pausado' : 'Gravando'}
                <span className="mono" style={{ fontWeight: 500 }}>{mmss(segundos)}</span>
              </span>
            )}
            {consultaSalva && <Badge tone="success" icon={Check}>Salvo</Badge>}
            <Button
              variant="secondary"
              icon={Zap}
              onClick={() => setModoPerfeita(m => !m)}
              title="Sugestões da IA em tempo real durante a gravação"
              style={modoPerfeita ? { background: T.brand.primarySubtle, color: T.brand.primary, borderColor: T.brand.primaryAccentSoft } : undefined}
            >
              {modoPerfeita ? 'Modo perfeita ativo' : 'Modo perfeita'}
            </Button>
            <BotaoMemed onClick={() => { if (pacienteSelecionado) { setMemedAberto(true) } else { setModalAvulso(true) } }} variant="primary" />
          </>
        }
      />

      {/* ── Idle ─────────────────────────────────────────────────────────── */}
      {estado === 'idle' && !prontuario && (
        <div className={'nc-grid' + (temContexto || pacienteSelecionado?.id ? '' : ' solo')}>
          <div style={{ ...cardCentro, gap: 22 }}>
            <span style={{
              width: 76, height: 76, borderRadius: 24, background: T.brand.primarySubtle, color: T.brand.primary,
              display: 'grid', placeItems: 'center', border: `1px solid ${T.brand.primaryAccentLight}`,
            }}><Icon icon={Mic} size={32} /></span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700, letterSpacing: '-.025em', color: T.text.primary }}>Pronto para iniciar a consulta?</h2>
              <p style={{ margin: 0, fontSize: 14, color: T.text.quaternary, lineHeight: 1.6, maxWidth: 460 }}>
                Fale normalmente com o paciente. A IA transcreve em tempo real e, ao final, gera o prontuário SOAP, sugere CIDs e hipóteses diagnósticas.
              </p>
            </div>
            {medico && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: T.text.secondary }}>Modelo do prontuário</span>
                <SeletorModeloProntuario especialidade={medico.especialidade} medicoId={medico.id} clinicaId={medico.clinica_id} value={modelo?.id} onChange={setModelo} />
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
              <Button
                size="lg"
                icon={Mic}
                onClick={handleIniciar}
                style={{ height: 50, padding: '0 28px', borderRadius: 14, fontSize: 15, boxShadow: T.shadow.accent }}
              >
                Iniciar gravação
              </Button>
              <Button variant="ghost" onClick={abrirModalTranscricao}>
                {transcricao ? 'Tenho transcrição salva — gerar prontuário' : 'Já tenho uma transcrição — gerar prontuário'}
              </Button>
            </div>
          </div>
          {(cardContexto || (pacienteSelecionado?.id && medico)) && (
            <div className="nc-lateral">
              {pacienteSelecionado?.id && medico && <ResumoPreConsulta pacienteId={pacienteSelecionado.id} medicoId={medico.id} />}
              {cardContexto}
            </div>
          )}
        </div>
      )}

      {/* ── Gravando ─────────────────────────────────────────────────────── */}
      {estado === 'gravando' && !prontuario && (
        <div className="nc-grid">
          <div style={{ ...cardBase, height: 'max(520px, calc(100vh - 300px))', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', borderBottom: `1px solid ${T.border.muted}` }}>
              <OndaAudio ativa={gravando && !gravandoPausado} nivel={nivel} />
              <StatusConexao conexao={conexao} fase={fase} />
              <span style={{ fontSize: 12, fontWeight: 600, color: T.text.quaternary, background: T.bg.page, padding: '4px 10px', borderRadius: 99, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                {palavras} palavras
              </span>
            </div>

            <div style={{ flex: 1, overflow: 'auto', padding: '20px 22px', background: T.bg.cardSubtle, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {erro && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 12, background: T.status.dangerBg, color: T.status.danger, fontSize: 13 }}>
                  <Icon icon={CircleAlert} size={16} />
                  <span style={{ flex: 1 }}>{erro}</span>
                  <Button variant="secondary" size="sm" onClick={() => { pararGravacao(); setEstado('idle') }}>Voltar</Button>
                </div>
              )}
              {vozBaixa && !gravandoPausado && (
                <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 12, background: T.status.warningBg, color: T.status.warning, fontSize: 13 }}>
                  <Icon icon={TriangleAlert} size={16} />
                  <span>O som está chegando bem baixo. Estamos amplificando, mas aproxime o microfone se puder.</span>
                </div>
              )}
              {(transcricao || parcial) ? <ConversaConsulta texto={transcricao} parcial={gravandoPausado ? '' : parcial} /> : null}
              {transcrevendo ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: T.text.secondary }}>
                  <Icon icon={LoaderCircle} size={15} color={ONDA} style={{ animation: 'spin 1s linear infinite' }} />
                  {fase === 'identificando' ? 'Identificando quem é o médico e quem é o paciente…' : fase === 'revisando' ? 'Revisando o áudio inteiro para máxima precisão…' : 'Finalizando as últimas frases…'}
                </span>
              ) : !gravandoPausado && !erro && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: T.text.tertiary }}>
                  <Icon icon={AudioLines} size={15} color={ONDA} />
                  {transcricao || parcial ? 'Ouvindo…' : 'Aguardando a conversa começar…'}
                </span>
              )}
            </div>

            <div style={{ display: 'flex', gap: 10, padding: '14px 18px', borderTop: `1px solid ${T.border.muted}`, flexWrap: 'wrap' }}>
              <Button
                variant="secondary"
                icon={gravandoPausado ? Play : Pause}
                onClick={pausarGravacao}
                disabled={transcrevendo}
                style={{ height: 46, flex: '1 1 140px', borderRadius: 12, fontSize: 14 }}
              >
                {gravandoPausado ? 'Retomar' : 'Pausar'}
              </Button>
              <Button onClick={handleParar} disabled={transcrevendo} style={{ height: 46, flex: '3 1 260px', borderRadius: 12, fontSize: 14 }}>
                {transcrevendo
                  ? <><Icon icon={LoaderCircle} size={16} style={{ animation: 'spin 1s linear infinite' }} />Finalizando transcrição…</>
                  : <><span style={{ width: 11, height: 11, borderRadius: 3, background: '#fff' }} />Encerrar e gerar prontuário</>}
              </Button>
            </div>
          </div>
          <div className="nc-lateral">
            {cardSugestoes}
            {cardContexto}
          </div>
        </div>
      )}

      {/* ── Gerando ──────────────────────────────────────────────────────── */}
      {estado === 'processando' && (
        <div style={{ ...cardCentro, gap: 20 }}>
          <span style={{ width: 64, height: 64, borderRadius: 20, background: T.brand.primaryLight, color: T.brand.primary, display: 'grid', placeItems: 'center' }}>
            <Icon icon={Sparkles} size={28} active />
          </span>
          <span style={{ fontSize: 19, fontWeight: 700, letterSpacing: '-.01em', color: T.text.primary }}>Gerando o prontuário…</span>
          <div style={{ width: 'min(340px, 100%)', display: 'flex', flexDirection: 'column', gap: 12, textAlign: 'left' }}>
            {ETAPAS_GERACAO.map((label, i) => {
              const feita = etapaGeracao > i, atual = etapaGeracao === i
              return (
                <span key={label} style={{
                  display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5,
                  color: feita ? T.status.success : atual ? T.text.primary : T.text.tertiary, fontWeight: atual ? 600 : 500,
                }}>
                  <Icon
                    icon={feita ? CircleCheck : atual ? LoaderCircle : CircleDashed}
                    size={17}
                    style={atual ? { animation: 'spin 1s linear infinite' } : undefined}
                  />
                  {label}
                </span>
              )
            })}
          </div>
          <div style={{ width: 'min(340px, 100%)' }}>
            <ProgressBar valor={etapaGeracao / ETAPAS_GERACAO.length * 100 + 8} />
          </div>
        </div>
      )}

      {/* ── Erro ─────────────────────────────────────────────────────────── */}
      {estado === 'erro' && (
        <div style={{ ...cardCentro, gap: 14 }}>
          <span style={{ width: 48, height: 48, borderRadius: 15, background: T.status.dangerBg, color: T.status.danger, display: 'grid', placeItems: 'center' }}>
            <Icon icon={CircleAlert} size={22} />
          </span>
          <div>
            <p style={{ fontSize: 14.5, fontWeight: 700, color: T.text.primary, margin: '0 0 4px' }}>Erro ao processar</p>
            <p style={{ fontSize: 12.5, color: T.text.quaternary, margin: 0 }}>{erroMsg || 'Tente novamente.'}</p>
          </div>
          <Button variant="secondary" onClick={handleNovo}>Recomeçar</Button>
        </div>
      )}

      {/* ── Pronto ───────────────────────────────────────────────────────── */}
      {estado === 'pronto' && prontuario && (
        <div className="nc-grid">
          <div style={{ ...cardBase, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', borderBottom: `1px solid ${T.border.muted}`, flexWrap: 'wrap' }}>
              <Badge tone="success" icon={CircleCheck} style={{ fontSize: 12.5, fontWeight: 700, padding: '6px 12px' }}>Prontuário pronto</Badge>
              <span style={{ fontSize: 12.5, color: T.text.quaternary }}>
                {[segundos > 0 ? mmss(segundos) + ' de gravação' : null, palavras + ' palavras', 'edite o texto direto nas seções'].filter(Boolean).join(' · ')}
              </span>
              <span style={{ flex: 1 }} />
              <IconButton icon={Copy} variant="outline" title="Copiar texto" aria-label="Copiar texto" onClick={handleCopiar} />
              <IconButton icon={Download} variant="outline" title="Exportar PDF" aria-label="Exportar PDF" onClick={() => exportarProntuarioPdf(prontuario, { nome: medico?.nome, crm: medico?.crm })} />
            </div>
            <div style={{ padding: '0 20px 12px' }}>
              {Array.isArray(prontuario.secoes) && prontuario.secoes.length > 0 && (
                <SecoesModelo
                  secoes={prontuario.secoes}
                  nomeModelo={modelo?.nome}
                  onEditar={(i, conteudo) => {
                    setProntuario((p: any) => ({ ...p, secoes: p.secoes.map((x: any, j: number) => j === i ? { ...x, conteudo } : x) }))
                    setEditado(true)
                  }}
                />
              )}
              <ProntuarioCard
                prontuario={prontuario}
                nomeMedico={medico?.nome}
                crm={medico?.crm}
                insights={copiloto?.insights}
                padroes={copiloto?.padroes}
                totalConsultas={copiloto?.total_consultas}
                onEditarSecao={editarSecao}
              />
            </div>
          </div>

          <div className="nc-lateral">
            {/* Prescrição (Memed) */}
            <Card style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, letterSpacing: '-.01em', color: T.text.primary }}>Prescrição</h3>
              <span style={{ fontSize: 12.5, color: T.text.quaternary, lineHeight: 1.5 }}>
                Receita digital com validade ICP-Brasil e envio direto para a farmácia, via Memed.
              </span>
              <div>
                <BotaoMemed onClick={() => setMemedAberto(true)} disabled={!pacienteSelecionado} disabledReason="Selecione um paciente primeiro" />
              </div>
            </Card>

            {/* Documentos */}
            <Card style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <h3 style={{ margin: '0 0 2px', fontSize: 14, fontWeight: 700, letterSpacing: '-.01em', color: T.text.primary }}>Documentos</h3>
              <LinhaDocumento
                icon={FlaskConical}
                label="Pedido de exames"
                estado={exames ? 'pronto' : gerandoDoc ? 'gerando' : 'novo'}
                onClick={!exames ? handleGerarExames : undefined}
                disabled={gerandoDoc}
              >
                {exames?.exames?.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {exames.exames.map((e: any, i: number) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, padding: '8px 0', borderTop: `1px solid ${T.border.muted}` }}>
                        <div style={{ minWidth: 0 }}>
                          <p style={{ fontSize: 12.5, fontWeight: 600, color: T.text.primary, margin: 0 }}>{e.nome}</p>
                          {e.indicacao && <p style={{ fontSize: 11.5, color: T.text.quaternary, margin: '2px 0 0', lineHeight: 1.4 }}>{e.indicacao}</p>}
                        </div>
                        {e.urgencia && <Badge tone={e.urgencia === 'urgente' ? 'danger' : 'success'}>{e.urgencia}</Badge>}
                      </div>
                    ))}
                  </div>
                )}
              </LinhaDocumento>
              <LinhaDocumento icon={FileBadge} label="Atestado" estado={atestado ? 'pronto' : 'novo'}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <Input
                    type="number" min={1} max={30} value={diasAtestado}
                    onChange={e => setDiasAtestado(Number(e.target.value))}
                    aria-label="Dias de atestado"
                    style={{ width: 64, minHeight: 32, height: 32, padding: '4px 8px', textAlign: 'center', fontSize: 13, borderRadius: 9 }}
                  />
                  <span style={{ fontSize: 12.5, color: T.text.secondary, flex: 1 }}>dia{diasAtestado !== 1 ? 's' : ''}</span>
                  {!atestado ? (
                    <Button variant="secondary" size="sm" onClick={handleGerarAtestado} disabled={gerandoDoc}>{gerandoDoc ? 'Gerando…' : 'Gerar'}</Button>
                  ) : (
                    <Button size="sm" icon={Printer} onClick={imprimirAtestado}>Imprimir</Button>
                  )}
                </div>
              </LinhaDocumento>
            </Card>

            {/* Resumo / orientações ao paciente */}
            <Card style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <h3 style={{ margin: 0, flex: 1, fontSize: 14, fontWeight: 700, letterSpacing: '-.01em', color: T.text.primary }}>Orientações ao paciente</h3>
                {resumoPaciente && (
                  <>
                    <IconButton icon={Copy} size={30} title="Copiar" aria-label="Copiar" onClick={() => { navigator.clipboard.writeText(resumoPaciente) }} />
                    <IconButton icon={RefreshCw} size={30} title="Regenerar" aria-label="Regenerar" onClick={() => setResumoPaciente('')} />
                  </>
                )}
              </div>
              {!resumoPaciente ? (
                <>
                  <span style={{ fontSize: 12.5, color: T.text.quaternary, lineHeight: 1.5 }}>Explica a consulta em linguagem simples e acolhedora.</span>
                  <Button variant="secondary" icon={Sparkles} onClick={handleGerarResumo} disabled={gerandoResumo} style={{ alignSelf: 'flex-start' }}>
                    {gerandoResumo ? 'Gerando…' : 'Gerar resumo'}
                  </Button>
                </>
              ) : (
                <>
                  <p style={{ margin: 0, fontSize: 12.5, color: T.text.strong, lineHeight: 1.6, whiteSpace: 'pre-wrap', background: T.bg.page, borderRadius: 12, padding: '10px 12px', maxHeight: 260, overflow: 'auto' }}>
                    {resumoPaciente}
                  </p>
                  <Button variant="secondary" icon={MessageCircle} onClick={() => enviarWhatsApp('resumo', resumoPaciente)} block>
                    Enviar por WhatsApp
                  </Button>
                </>
              )}
            </Card>

            {/* Retorno do paciente (sugestão da IA a partir do plano) */}
            {medico && (
              <CardAgendarRetorno
                pacienteId={pacienteSelecionado?.id || null}
                pacienteNome={pacienteSelecionado?.nome || null}
                medicoId={medico.id}
                consultaId={consultaId || undefined}
                plano={prontuario.plano}
                avaliacao={prontuario.avaliacao}
              />
            )}

            {/* Salvar / nova */}
            <Card style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {!consultaSalva ? (
                <Button icon={Check} onClick={() => salvarConsulta(prontuario)} style={{ height: 44, borderRadius: 12, fontSize: 14 }}>
                  Salvar no histórico
                </Button>
              ) : editado ? (
                <Button icon={Check} onClick={salvarAlteracoes} disabled={salvandoEdicao} style={{ height: 44, borderRadius: 12, fontSize: 14 }}>
                  {salvandoEdicao ? 'Salvando…' : 'Salvar alterações no histórico'}
                </Button>
              ) : (
                <span style={{ height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 14, fontWeight: 600, color: T.status.success, background: T.status.successBg }}>
                  <Icon icon={CircleCheck} size={16} />Salvo no histórico
                </span>
              )}
              {consultaSalva && consultaId && (
                <BotaoGerarGuia
                  consultaId={consultaId}
                  size="md"
                  pacienteConvenio={pacienteSelecionado?.convenio ?? pacientes.find((p: any) => p.id === pacienteSelecionado?.id)?.convenio}
                />
              )}
              <Button variant="secondary" icon={Plus} onClick={handleNovo} style={{ height: 40, borderRadius: 12 }}>Nova consulta</Button>
            </Card>

            {cardContexto}
          </div>
        </div>
      )}

      {modalAvulso && (
        <ModalDadosPacienteAvulso
          onFechar={() => setModalAvulso(false)}
          onConfirmar={(dados) => {
            setPacienteAvulso({
              id: 'avulso-' + Date.now(),
              nome: dados.nome,
              cpf: dados.cpf,
              data_nascimento: dados.data_nascimento,
              sexo: dados.sexo,
              telefone: null,
              email: null,
              endereco: null,
            })
            setModalAvulso(false)
            setMemedAberto(true)
          }}
        />
      )}
      {memedAberto && medico && (pacienteSelecionado || pacienteAvulso) && (
        <MemedPrescricao
          medicoId={medico.id}
          paciente={pacienteSelecionado ? {
            id: pacienteSelecionado.id,
            nome: pacienteSelecionado.nome,
            cpf: pacienteSelecionado.cpf,
            data_nascimento: pacienteSelecionado.data_nascimento,
            sexo: pacienteSelecionado.sexo,
            telefone: pacienteSelecionado.telefone,
            email: pacienteSelecionado.email,
            endereco: pacienteSelecionado.endereco,
          } : pacienteAvulso}
          onClose={() => setMemedAberto(false)}
          onPrescricaoGerada={(dados) => {
            // Salva prescricao no banco (Memed compliance)
            fetch('/api/prescricoes', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                paciente_id: pacienteSelecionado?.id,
                medico_id: medico?.id,
                clinica_id: medico?.clinica_id || null,
                dados_memed: dados,
              }),
            }).catch(err => log.error('Erro ao salvar prescricao:', err))
            setMemedAberto(false)
          }}
        />
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .nc-grid { display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: 12px; align-items: start; }
        .nc-grid.solo { grid-template-columns: minmax(0, 1fr); }
        .nc-lateral { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
        @media (max-width: 1100px) { .nc-grid { grid-template-columns: minmax(0, 1fr); } }
        @keyframes nc-onda { from { transform: scaleY(.25); } to { transform: scaleY(1); } }
      ` }} />
    </div>
  )
}

/** Seções do modelo de prontuário escolhido (quando não é SOAP) — editáveis. */
function SecoesModelo({ secoes, nomeModelo, onEditar }: {
  secoes: { titulo: string; conteudo: string }[]
  nomeModelo?: string
  onEditar: (i: number, conteudo: string) => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '16px 0 4px' }}>
      <Overline>{nomeModelo ? `Modelo · ${nomeModelo}` : 'Seções do modelo'}</Overline>
      {secoes.map((sec, i) => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: T.text.primary }}>{sec.titulo}</span>
          <Textarea
            value={sec.conteudo || ''}
            onChange={e => onEditar(i, e.target.value)}
            rows={Math.min(8, Math.max(2, Math.ceil((sec.conteudo || '').length / 90)))}
            style={{ fontSize: 13.5, lineHeight: 1.55 }}
          />
        </div>
      ))}
      <div style={{ height: 1, background: T.border.muted, margin: '6px 0 2px' }} />
      <Overline>Resumo SOAP (usado no histórico e nos relatórios)</Overline>
    </div>
  )
}
