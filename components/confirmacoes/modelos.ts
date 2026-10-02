/**
 * Confirmações / lista de espera — constantes e funções PURAS (sem banco, sem token),
 * usadas tanto no servidor (cron, webhook, rotas) quanto no cliente (pré-visualização).
 */

export const FUSO = 'America/Sao_Paulo'

export type ConfirmacaoConfig = {
  lembrete_48h: boolean
  confirmacao_24h: boolean
  lembrete_2h: boolean
  oferecer_vaga_lista: boolean
  modelo_48h: string
  modelo_24h: string
  modelo_2h: string
}

/** Placeholders: {nome} {data} {hora} {medico} {clinica} — e {online} (" (online)" em teleconsulta). */
export const MODELOS_PADRAO = {
  modelo_48h: 'Oi {nome}! Passando para lembrar da sua consulta com {medico} na {data}, às {hora}.\n\nSe precisar remarcar, é só responder esta mensagem.',
  modelo_24h: 'Oi {nome}! Lembrete aqui 💜\n\nAmanhã você tem consulta{online} no dia {data} às {hora}.\n\nConfirma que vai comparecer?',
  modelo_2h: 'Oi {nome}! Sua consulta com {medico} é hoje às {hora}. Até daqui a pouco!',
} as const

export const CONFIG_PADRAO: ConfirmacaoConfig = {
  lembrete_48h: true,
  confirmacao_24h: true,
  lembrete_2h: true,
  oferecer_vaga_lista: true,
  ...MODELOS_PADRAO,
}

/** Botões da confirmação 24h — o webhook reconhece a resposta por estes textos. */
export const BOTOES_CONFIRMACAO_24H = ['Sim confirmo', 'Preciso remarcar', 'Não poderei ir']

/** Botões da oferta de vaga da lista de espera (máx. 20 caracteres cada). */
export const BOTOES_OFERTA_VAGA = ['Quero esse horário', 'Não posso']

export const MODELO_OFERTA_VAGA =
  'Oi {nome}! Abriu um horário com {medico} na {data}, às {hora}.\n\nVocê está na nossa lista de espera — quer ficar com ele?'

/** Junta a linha do banco com os padrões (sem linha = tudo ligado + modelos padrão). */
export function mesclarConfig(linha?: Partial<Record<keyof ConfirmacaoConfig, any>> | null): ConfirmacaoConfig {
  const c = { ...CONFIG_PADRAO }
  if (!linha) return c
  for (const k of ['lembrete_48h', 'confirmacao_24h', 'lembrete_2h', 'oferecer_vaga_lista'] as const) {
    if (typeof linha[k] === 'boolean') c[k] = linha[k]
  }
  for (const k of ['modelo_48h', 'modelo_24h', 'modelo_2h'] as const) {
    if (typeof linha[k] === 'string' && linha[k].trim()) c[k] = linha[k]
  }
  return c
}

/** Data e hora no fuso de São Paulo: { data: "quinta-feira, 03/10", hora: "14:30" }. */
export function dataHoraSP(iso: string | Date) {
  const d = typeof iso === 'string' ? new Date(iso) : iso
  return {
    data: d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', timeZone: FUSO }),
    hora: d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: FUSO }),
  }
}

export function primeiroNomeDe(nome?: string | null) {
  return (nome || '').trim().split(/\s+/)[0] || ''
}

/** Preenche os placeholders conhecidos; desconhecidos ficam vazios. */
export function preencher(modelo: string, v: Record<string, string | undefined | null>) {
  return modelo.replace(/\{(\w+)\}/g, (_, k) => (v[k] ?? '').toString())
}

/** Período do dia de uma hora (0–23) — mesmo critério da lista de espera. */
export function periodoDaHora(h: number): 'manha' | 'tarde' | 'noite' {
  return h < 12 ? 'manha' : h < 18 ? 'tarde' : 'noite'
}

export const PERIODOS: { value: 'qualquer' | 'manha' | 'tarde' | 'noite'; label: string }[] = [
  { value: 'qualquer', label: 'Qualquer' },
  { value: 'manha', label: 'Manhã' },
  { value: 'tarde', label: 'Tarde' },
  { value: 'noite', label: 'Noite' },
]

/** Domingo = 0 … sábado = 6 (Date.getDay). */
export const DIAS_SEMANA_CURTOS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

/** Erro de tabela/coluna inexistente (migration não rodada). */
export function ehErroDeSchema(e: any) {
  const m = `${e?.code || ''} ${e?.message || ''}`.toLowerCase()
  return /42p01|42703|pgrst204|pgrst205|does not exist|could not find/.test(m)
}
