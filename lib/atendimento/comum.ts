/**
 * Fluxo de atendimento (recepção → senha → painel → consultório) — tipos e regras
 * usados tanto no servidor quanto nas telas.
 */

export type StatusAtendimento = 'aguardando' | 'chamado' | 'em_atendimento' | 'finalizado' | 'ausente' | 'cancelado'
export type Prioridade = 'normal' | 'prioritario' | 'prioritario_80' | 'doador'
export type ExibicaoPainel = 'senha' | 'senha_nome' | 'nome_completo'

export type Setor = {
  id: string; nome: string; ordem: number; ativo: boolean
  painel_token: string; painel_exibicao: ExibicaoPainel; painel_voz: boolean; painel_mensagem: string | null; avisar_whatsapp: boolean
}
export type Consultorio = { id: string; setor_id: string; nome: string; ordem: number; ativo: boolean }

export type Atendimento = {
  id: string; clinica_id: string; medico_id: string; paciente_id: string | null; agendamento_id: string | null
  setor_id: string | null; consultorio_id: string | null; dia: string; senha: string
  status: StatusAtendimento; prioridade: Prioridade; origem: 'recepcao' | 'whatsapp' | 'totem' | 'encaixe'
  horario_previsto: string | null; chegada_em: string; chamado_em: string | null; chamadas: number
  inicio_em: string | null; fim_em: string | null; observacao: string | null
  paciente?: { id: string; nome: string; telefone: string | null; data_nascimento: string | null } | null
  medico?: { id: string; nome: string } | null
  consultorio?: { id: string; nome: string } | null
}

/** Agendamento do dia que ainda não fez check-in (aparece na recepção como "esperado"). */
export type Esperado = {
  id: string; data_hora: string; medico_id: string; tipo: string | null; motivo: string | null; status: string
  paciente: { id: string; nome: string; telefone: string | null; data_nascimento: string | null } | null
  medico: { id: string; nome: string } | null
}

export const PRIORIDADES: { valor: Prioridade; label: string; curto: string }[] = [
  { valor: 'normal', label: 'Normal', curto: 'Normal' },
  { valor: 'prioritario', label: 'Prioritário (60+, gestante, lactante, PCD, TEA, criança de colo, obeso, mobilidade reduzida)', curto: 'Prioritário' },
  { valor: 'prioritario_80', label: 'Prioridade especial (80 anos ou mais)', curto: '80+' },
  { valor: 'doador', label: 'Doador de sangue', curto: 'Doador' },
]

/** Ordem da fila: 80+ → prioritários → doador de sangue → demais (Lei 10.048/2000 e alterações). */
export const RANK_PRIORIDADE: Record<Prioridade, number> = { prioritario_80: 0, prioritario: 1, doador: 2, normal: 3 }

export function ordenarFila<T extends Pick<Atendimento, 'prioridade' | 'horario_previsto' | 'chegada_em'>>(lista: T[]): T[] {
  return [...lista].sort((a, b) =>
    RANK_PRIORIDADE[a.prioridade] - RANK_PRIORIDADE[b.prioridade]
    || (a.horario_previsto || a.chegada_em).localeCompare(b.horario_previsto || b.chegada_em)
    || a.chegada_em.localeCompare(b.chegada_em))
}

/** Prefixo da senha: P para qualquer prioridade, A para os demais. */
export const prefixoSenha = (p: Prioridade) => (p === 'normal' ? 'A' : 'P')

/** Sugere a prioridade pela idade (60+ / 80+). Os outros casos a recepção marca. */
export function prioridadePelaIdade(nascimento?: string | null, hoje = new Date()): Prioridade {
  if (!nascimento) return 'normal'
  const n = new Date(nascimento + 'T12:00:00')
  if (isNaN(n.getTime())) return 'normal'
  let idade = hoje.getFullYear() - n.getFullYear()
  const m = hoje.getMonth() - n.getMonth()
  if (m < 0 || (m === 0 && hoje.getDate() < n.getDate())) idade--
  return idade >= 80 ? 'prioritario_80' : idade >= 60 ? 'prioritario' : 'normal'
}

/** Nome para o painel da TV conforme a escolha da clínica (LGPD: o padrão é primeiro nome + inicial). */
export function nomeNoPainel(nome: string | null | undefined, modo: ExibicaoPainel): string | null {
  if (modo === 'senha' || !nome) return null
  const partes = nome.trim().split(/\s+/)
  if (modo === 'nome_completo') return partes.join(' ')
  const primeiro = partes[0]
  const ultimo = partes.length > 1 ? partes[partes.length - 1] : ''
  return ultimo ? `${primeiro} ${ultimo[0].toUpperCase()}.` : primeiro
}

/** Frase falada pela TV: "Senha A 23, Maria S. Consultório 3." (sem os zeros à esquerda). */
export function fraseChamada(c: { senha: string; nome_exibicao: string | null; local: string }) {
  const letra = c.senha.replace(/\d+/g, '')
  const numero = Number(c.senha.replace(/\D+/g, ''))
  const nome = c.nome_exibicao?.replace(/\.+$/, '')
  return `Senha ${letra} ${numero}${nome ? `, ${nome}` : ''}. ${c.local}.`
}

/** Data de hoje (YYYY-MM-DD) no fuso de São Paulo. */
export function hojeSP(d = new Date()): string {
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
}

/** Início e fim do dia (em UTC ISO) para um YYYY-MM-DD de São Paulo (UTC-3, sem horário de verão). */
export function limitesDoDiaSP(dia: string) {
  return { de: new Date(`${dia}T00:00:00-03:00`).toISOString(), ate: new Date(`${dia}T23:59:59.999-03:00`).toISOString() }
}

export const minutosDesde = (iso: string | null | undefined, agora = Date.now()) =>
  iso ? Math.max(0, Math.floor((agora - new Date(iso).getTime()) / 60000)) : 0

export const ROTULO_STATUS: Record<StatusAtendimento, string> = {
  aguardando: 'Aguardando', chamado: 'Chamado', em_atendimento: 'Em atendimento',
  finalizado: 'Finalizado', ausente: 'Não compareceu', cancelado: 'Cancelado',
}

/** "Cheguei", "já estou aqui", "bom dia, cheguei"… (mensagens curtas de chegada no WhatsApp). */
const CHEGADA = /^(oi|ola|olá|bom dia|boa tarde|boa noite)?[\s,!.]*(ja |já )?(cheguei|chegei|cheguei aqui|to aqui|tô aqui|estou aqui|acabei de chegar|ja estou na clinica|já estou na clínica|check-?in)\b/i

export const ehMensagemDeChegada = (texto: string) => texto.trim().length <= 60 && CHEGADA.test(texto.trim().normalize('NFC'))
