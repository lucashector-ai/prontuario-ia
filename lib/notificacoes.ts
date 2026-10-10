/**
 * Notificações do app — usado pelo sino do Topbar e pela central /notificacoes.
 *
 * Nada é apagado: "lida" só tira o destaque. A lista vem paginada por data.
 *
 *   const pg = await listarNotificacoes({ filtro: 'todas' })
 *   const mais = await listarNotificacoes({ filtro: 'todas', antes: pg.cursor })
 *   await marcarNotificacao(id, false)   // volta para não lida
 */
import type { LucideIcon } from 'lucide-react'
import { Bell, DoorOpen, Siren, CalendarClock, CalendarCheck, CalendarX, ClipboardCheck, ListChecks, RefreshCw, Sun, Video } from 'lucide-react'
import { tokens as T } from '@/lib/design-tokens'

export type Notificacao = {
  id: string
  tipo: string | null
  titulo: string
  descricao: string | null
  link: string | null
  lida: boolean
  criada_em: string
  agendamento_id: string | null
  paciente_id: string | null
}

export type FiltroNotificacoes = 'todas' | 'nao_lidas'
export type PaginaNotificacoes = { itens: Notificacao[]; naoLidas: number; temMais: boolean; cursor: string | null }

const ehDemo = () => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('demo') === '1'

// ── Aparência e destino ──────────────────────────────────────────────────────

export function estiloDaNotificacao(n: Pick<Notificacao, 'tipo' | 'titulo'>): { icon: LucideIcon; cor: string } {
  switch (n.tipo) {
    case 'consulta_iniciando': return { icon: /online/i.test(n.titulo) ? Video : CalendarClock, cor: T.brand.primary }
    case 'confirmacao_pendente': return { icon: CalendarCheck, cor: T.data.orange }
    case 'confirmacao_recusada':
    case 'confirmacao_ignorada': return { icon: CalendarX, cor: T.status.danger }
    case 'reagendamento_solicitado': return { icon: RefreshCw, cor: T.data.orange }
    case 'lista_espera_agendado': return { icon: ListChecks, cor: T.status.success }
    case 'formulario_preenchido': return { icon: ClipboardCheck, cor: T.status.success }
    case 'resumo_dia': return { icon: Sun, cor: T.data.orange }
    case 'saida_recepcao': return { icon: DoorOpen, cor: T.data.orange }
    case 'triagem_urgente': return { icon: Siren, cor: T.status.danger }
    default: return { icon: Bell, cor: T.brand.primary }
  }
}

export function destinoDaNotificacao(n: Notificacao): string {
  if (n.link) return n.link
  if (n.agendamento_id) return '/agenda?ag=' + n.agendamento_id
  if (n.paciente_id) return '/pacientes/' + n.paciente_id
  return '/agenda'
}

export function tempoRelativo(iso: string, agora = Date.now()): string {
  const min = (agora - new Date(iso).getTime()) / 60000
  if (min < 1) return 'agora'
  if (min < 60) return `${Math.round(min)} min`
  if (min < 1440) return `${Math.round(min / 60)} h`
  const dias = Math.floor(min / 1440)
  if (dias < 7) return `${dias} d`
  if (dias < 35) return `${Math.floor(dias / 7)} sem`
  return new Date(iso).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })
}

/** Separa a lista em blocos por data: Hoje, Ontem, Esta semana, Anteriores. */
export function agruparPorData(itens: Notificacao[], agora = new Date()): { titulo: string; itens: Notificacao[] }[] {
  const hoje = new Date(agora); hoje.setHours(0, 0, 0, 0)
  const ontem = new Date(hoje); ontem.setDate(ontem.getDate() - 1)
  const semana = new Date(hoje); semana.setDate(semana.getDate() - 6)
  const grupos: { titulo: string; itens: Notificacao[] }[] = []
  for (const n of itens) {
    const d = new Date(n.criada_em)
    const titulo = d >= hoje ? 'Hoje' : d >= ontem ? 'Ontem' : d >= semana ? 'Esta semana' : 'Anteriores'
    const ult = grupos[grupos.length - 1]
    if (ult?.titulo === titulo) ult.itens.push(n)
    else grupos.push({ titulo, itens: [n] })
  }
  return grupos
}

// ── API ──────────────────────────────────────────────────────────────────────

export async function listarNotificacoes(p: { filtro: FiltroNotificacoes; antes?: string | null; limite?: number }): Promise<PaginaNotificacoes> {
  if (ehDemo()) return paginaDemo(p.filtro, p.antes || null, p.limite || 20)
  const q = new URLSearchParams({ filtro: p.filtro, limite: String(p.limite || 20) })
  if (p.antes) q.set('antes', p.antes)
  const r = await fetch('/api/notificacoes-sofia?' + q.toString())
  if (!r.ok) throw new Error('Não foi possível carregar as notificações')
  const d = await r.json()
  const itens: Notificacao[] = d.notificacoes || []
  return { itens, naoLidas: d.nao_lidas || 0, temMais: !!d.tem_mais, cursor: itens.length ? itens[itens.length - 1].criada_em : null }
}

export async function marcarNotificacao(id: string, lida: boolean) {
  if (ehDemo()) { const n = DEMO().find(x => x.id === id); if (n) n.lida = lida; return }
  await fetch('/api/notificacoes-sofia', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, lida }) })
}

export async function marcarTodasLidas() {
  if (ehDemo()) { DEMO().forEach(n => { n.lida = true }); return }
  await fetch('/api/notificacoes-sofia', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ todas: true }) })
}

/** Avisa outras partes da tela (sino ↔ central) que o estado mudou. */
export const EVENTO_NOTIFICACOES = 'c360:notificacoes'
export const avisarMudanca = () => { if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENTO_NOTIFICACOES)) }

// ── Demonstração (?demo=1) ───────────────────────────────────────────────────

let demoCache: Notificacao[] | null = null
function DEMO(): Notificacao[] {
  if (demoCache) return demoCache
  const nomes = ['Mariana Costa', 'João Pereira', 'Ana Beatriz Lima', 'Carlos Eduardo', 'Fernanda Rocha', 'Ricardo Alves', 'Juliana Martins', 'Paulo Henrique']
  const modelos: [string, (nome: string) => string, (nome: string) => string][] = [
    ['consulta_iniciando', () => 'Consulta em 10 min', nome => `${nome} — retorno`],
    ['confirmacao_pendente', nome => `${nome} ainda não confirmou`, () => 'Consulta amanhã às 9h30'],
    ['formulario_preenchido', () => 'Formulário preenchido', nome => `${nome} respondeu a anamnese`],
    ['confirmacao_recusada', nome => `${nome} cancelou a consulta`, () => 'Horário liberado na agenda'],
    ['lista_espera_agendado', nome => `${nome} aceitou o horário da lista de espera`, () => 'Consulta na sexta às 14h'],
    ['resumo_dia', () => 'Resumo do dia', () => '8 consultas, 2 sem confirmação'],
  ]
  const agora = Date.now()
  demoCache = Array.from({ length: 64 }, (_, i) => {
    const [tipo, titulo, descricao] = modelos[i % modelos.length]
    const nome = nomes[i % nomes.length]
    const minutos = i < 3 ? i * 25 + 2 : Math.round(60 * Math.pow(i, 1.75))
    return {
      id: 'demo-notif-' + i, tipo, titulo: titulo(nome), descricao: descricao(nome), link: null,
      lida: i >= 4, criada_em: new Date(agora - minutos * 60000).toISOString(), agendamento_id: null, paciente_id: null,
    }
  })
  return demoCache
}

async function paginaDemo(filtro: FiltroNotificacoes, antes: string | null, limite: number): Promise<PaginaNotificacoes> {
  await new Promise(r => setTimeout(r, 350))
  const base = DEMO().filter(n => (filtro === 'todas' || !n.lida) && (!antes || n.criada_em < antes))
  const itens = base.slice(0, limite).map(n => ({ ...n }))
  return { itens, naoLidas: DEMO().filter(n => !n.lida).length, temMais: base.length > limite, cursor: itens.length ? itens[itens.length - 1].criada_em : null }
}
