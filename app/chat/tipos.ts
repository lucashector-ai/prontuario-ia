import { tokens } from '@/lib/design-tokens'

export type Canal = 'whatsapp' | 'instagram' | 'messenger'
export type EtapaId = 'novo' | 'atendimento' | 'aguardando' | 'agendado' | 'concluido'

export type Conversa = {
  id: string
  medico_id: string
  telefone: string
  nome_contato: string | null
  foto_url?: string | null
  paciente_id?: string | null
  ultimo_contato: string
  status?: 'ativa' | 'encerrada' | null
  modo?: 'ia' | 'humano' | null
  atendente_nome?: string | null
  canal?: Canal | null
  etapa?: EtapaId | null
  fixada?: boolean | null
  arquivada?: boolean | null
  silenciada_ate?: string | null
  bloqueada?: boolean | null
  // derivados no cliente
  ultima?: { conteudo: string; criado_em: string; tipo: 'recebida' | 'enviada'; lida?: boolean; metadata?: any }
  naoLidas: number
}

export type Mensagem = {
  id: string
  conversa_id: string
  tipo: 'recebida' | 'enviada'
  conteudo: string
  criado_em: string
  lida?: boolean
  metadata?: any
}

export type RespostaRapida = { id: string; atalho: string; texto: string }

export const ETAPAS: { id: EtapaId; label: string; cor: string }[] = [
  { id: 'novo', label: 'Novo contato', cor: tokens.data.blue },
  { id: 'atendimento', label: 'Em atendimento', cor: tokens.data.purple },
  { id: 'aguardando', label: 'Aguardando paciente', cor: tokens.data.orange },
  { id: 'agendado', label: 'Agendado', cor: tokens.data.pink },
  { id: 'concluido', label: 'Concluído', cor: tokens.data.green },
]

/** Etapa salva ou deduzida do estado da conversa (antes da migration 0009 não existe a coluna). */
export function etapaDe(c: Conversa): EtapaId {
  if (c.etapa && ETAPAS.some(e => e.id === c.etapa)) return c.etapa
  if (c.status === 'encerrada') return 'concluido'
  if (c.modo === 'humano' && c.atendente_nome) return 'atendimento'
  return 'novo'
}

export const canalDe = (c: Pick<Conversa, 'canal'>): Canal => (c.canal || 'whatsapp') as Canal

export const CANAIS: { id: Canal; label: string; cor: string }[] = [
  { id: 'whatsapp', label: 'WhatsApp', cor: '#25D366' },
  { id: 'instagram', label: 'Instagram', cor: '#E1306C' },
  { id: 'messenger', label: 'Messenger', cor: '#0084FF' },
]

export const iniciais = (nome?: string | null) =>
  (nome || '?').split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase()

export const nomeDe = (c: Conversa) => c.nome_contato || (canalDe(c) === 'whatsapp' ? '+' + c.telefone : 'Contato')

export function quando(iso?: string) {
  if (!iso) return ''
  const d = new Date(iso), hoje = new Date()
  if (d.toDateString() === hoje.toDateString()) return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const ontem = new Date(); ontem.setDate(hoje.getDate() - 1)
  if (d.toDateString() === ontem.toDateString()) return 'Ontem'
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

export const hora = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

export function silenciada(c: Conversa) {
  return !!c.silenciada_ate && new Date(c.silenciada_ate).getTime() > Date.now()
}

/** Markdown simples do WhatsApp (*negrito*, _itálico_), com escape de HTML. */
export function md(texto: string) {
  return (texto || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<strong>$1</strong>')
    .replace(/_(.*?)_/g, '<em>$1</em>')
    .split('\n').join('<br/>')
}

export const ehNota = (m: Mensagem) => m.metadata?.nota === true
export const ehSistema = (m: Mensagem) => !!m.metadata?.sistema

/** Erro de coluna/tabela inexistente → migration 0009 não foi rodada. */
export const faltaMigration = (erro: any) =>
  !!erro && /column|relation|does not exist|schema cache/i.test(String(erro.message || erro))
