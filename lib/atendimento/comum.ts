/**
 * Fluxo de atendimento (recepção → senha → painel → consultório) — tipos e regras
 * usados tanto no servidor quanto nas telas.
 */

export type StatusAtendimento = 'aguardando_triagem' | 'em_triagem' | 'aguardando' | 'chamado' | 'em_atendimento' | 'finalizado' | 'ausente' | 'cancelado'
export type Risco = 'vermelho' | 'laranja' | 'amarelo' | 'verde' | 'azul'
export type Prioridade = 'normal' | 'prioritario' | 'prioritario_80' | 'doador'
export type ExibicaoPainel = 'senha' | 'senha_nome' | 'nome_completo'

export type Setor = {
  id: string; nome: string; ordem: number; ativo: boolean
  painel_token: string; painel_exibicao: ExibicaoPainel; painel_voz: boolean; painel_mensagem: string | null; avisar_whatsapp: boolean; usa_triagem?: boolean
}
export type Consultorio = { id: string; setor_id: string; nome: string; ordem: number; ativo: boolean }

export type Atendimento = {
  id: string; clinica_id: string; medico_id: string; paciente_id: string | null; agendamento_id: string | null
  setor_id: string | null; consultorio_id: string | null; dia: string; senha: string
  status: StatusAtendimento; prioridade: Prioridade; origem: 'recepcao' | 'whatsapp' | 'totem' | 'encaixe'
  horario_previsto: string | null; chegada_em: string; chamado_em: string | null; chamadas: number
  inicio_em: string | null; fim_em: string | null; observacao: string | null; risco?: Risco | null
  paciente?: { id: string; nome: string; telefone: string | null; data_nascimento: string | null } | null
  medico?: { id: string; nome: string } | null
  consultorio?: { id: string; nome: string } | null
}

/** Agendamento do dia que ainda não fez check-in (aparece na recepção como "esperado"). */
export type Esperado = {
  id: string; data_hora: string; medico_id: string; tipo: string | null; motivo: string | null; status: string
  paciente: { id: string; nome: string; telefone: string | null; data_nascimento: string | null; cpf?: string | null; convenio?: string | null } | null
  medico: { id: string; nome: string } | null
}

/** (11) 98765-4321 */
export function formatarTelefone(t?: string | null) {
  const d = String(t || '').replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '')
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return t || ''
}

export const PRIORIDADES: { valor: Prioridade; label: string; curto: string }[] = [
  { valor: 'normal', label: 'Normal', curto: 'Normal' },
  { valor: 'prioritario', label: 'Prioritário (60+, gestante, lactante, PCD, TEA, criança de colo, obeso, mobilidade reduzida)', curto: 'Prioritário' },
  { valor: 'prioritario_80', label: 'Prioridade especial (80 anos ou mais)', curto: '80+' },
  { valor: 'doador', label: 'Doador de sangue', curto: 'Doador' },
]

/** Ordem da fila: 80+ → prioritários → doador de sangue → demais (Lei 10.048/2000 e alterações). */
export const RANK_PRIORIDADE: Record<Prioridade, number> = { prioritario_80: 0, prioritario: 1, doador: 2, normal: 3 }

/** Gravidade da triagem: vermelho → laranja → amarelo → demais. */
export const RANK_RISCO: Record<string, number> = { vermelho: 0, laranja: 1, amarelo: 2 }
const rankRisco = (r?: string | null) => (r && r in RANK_RISCO ? RANK_RISCO[r] : 3)

export function ordenarFila<T extends Pick<Atendimento, 'prioridade' | 'horario_previsto' | 'chegada_em'> & { risco?: string | null }>(lista: T[]): T[] {
  return [...lista].sort((a, b) =>
    rankRisco(a.risco) - rankRisco(b.risco)
    || RANK_PRIORIDADE[a.prioridade] - RANK_PRIORIDADE[b.prioridade]
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

/** Nome para o painel da TV conforme a escolha da clínica. Padrão: primeiro e segundo nome ("Maria Aparecida"), sem "da/de/dos". */
const PARTICULAS = new Set(['da', 'de', 'do', 'das', 'dos', 'e', 'di', 'du'])
export function nomeNoPainel(nome: string | null | undefined, modo: ExibicaoPainel): string | null {
  if (modo === 'senha' || !nome) return null
  const partes = nome.trim().split(/\s+/)
  if (modo === 'nome_completo') return partes.join(' ')
  const [primeiro, ...resto] = partes
  const segundo = resto.find(p => !PARTICULAS.has(p.toLowerCase()))
  return segundo ? `${primeiro} ${segundo}` : primeiro
}

/** Frase falada pela TV: "Senha A 23, Maria Silva. Consultório 3." (sem os zeros à esquerda). */
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
  aguardando_triagem: 'Aguardando triagem', em_triagem: 'Em triagem',
  aguardando: 'Aguardando', chamado: 'Chamado', em_atendimento: 'Em atendimento',
  finalizado: 'Finalizado', ausente: 'Não compareceu', cancelado: 'Cancelado',
}

/** "Cheguei", "já estou aqui", "bom dia, cheguei"… (mensagens curtas de chegada no WhatsApp). */
const CHEGADA = /^(oi|ola|olá|bom dia|boa tarde|boa noite)?[\s,!.]*(ja |já )?(cheguei|chegei|cheguei aqui|to aqui|tô aqui|estou aqui|acabei de chegar|ja estou na clinica|já estou na clínica|check-?in)\b/i

export const ehMensagemDeChegada = (texto: string) => texto.trim().length <= 60 && CHEGADA.test(texto.trim().normalize('NFC'))

// ── Triagem: classificação de risco própria por cores ───────────────────────

export const RISCOS: { valor: Risco; label: string; descricao: string; cor: string; prazo: string }[] = [
  { valor: 'vermelho', label: 'Emergência', descricao: 'Risco de vida — atender agora', cor: '#D92D20', prazo: 'imediato' },
  { valor: 'laranja', label: 'Muito urgente', descricao: 'Sinais alterados importantes', cor: '#F27A1A', prazo: 'até 10 min' },
  { valor: 'amarelo', label: 'Urgente', descricao: 'Sinais alterados, estável', cor: '#E3B008', prazo: 'até 1 h' },
  { valor: 'verde', label: 'Pouco urgente', descricao: 'Estável, queixa leve', cor: '#16A34A', prazo: 'até 2 h' },
  { valor: 'azul', label: 'Não urgente', descricao: 'Rotina, retorno, renovação', cor: '#2F7DE1', prazo: 'por ordem' },
]

export type SinaisVitais = {
  pa_sistolica?: number | null; pa_diastolica?: number | null; fc?: number | null; fr?: number | null
  temperatura?: number | null; spo2?: number | null; glicemia?: number | null; dor?: number | null
}

/**
 * Sugere a cor pelos sinais vitais e mostra o porquê. É só sugestão: quem tria decide
 * (e pode subir a cor pela queixa). Faixas de referência usuais para adultos.
 */
export function sugerirRisco(v: SinaisVitais): { risco: Risco; motivos: string[] } {
  const m: { r: Risco; t: string }[] = []
  const n = (x?: number | null) => (typeof x === 'number' && !isNaN(x) ? x : null)
  const pas = n(v.pa_sistolica), pad = n(v.pa_diastolica), fc = n(v.fc), fr = n(v.fr), t = n(v.temperatura), sat = n(v.spo2), gli = n(v.glicemia), dor = n(v.dor)
  if (sat !== null && sat < 90) m.push({ r: 'vermelho', t: `Saturação ${sat}%` })
  else if (sat !== null && sat < 94) m.push({ r: 'laranja', t: `Saturação ${sat}%` })
  if (pas !== null && pas < 90) m.push({ r: 'vermelho', t: `Pressão baixa ${pas}${pad !== null ? 'x' + pad : ''}` })
  else if ((pas !== null && pas >= 180) || (pad !== null && pad >= 120)) m.push({ r: 'laranja', t: `Pressão muito alta ${pas ?? '?'}x${pad ?? '?'}` })
  else if ((pas !== null && pas >= 160) || (pad !== null && pad >= 100)) m.push({ r: 'amarelo', t: `Pressão alta ${pas ?? '?'}x${pad ?? '?'}` })
  if (fc !== null && (fc > 130 || fc < 40)) m.push({ r: 'vermelho', t: `Frequência cardíaca ${fc}` })
  else if (fc !== null && (fc > 110 || fc < 50)) m.push({ r: 'laranja', t: `Frequência cardíaca ${fc}` })
  if (fr !== null && (fr > 30 || fr < 8)) m.push({ r: 'vermelho', t: `Frequência respiratória ${fr}` })
  else if (fr !== null && fr > 24) m.push({ r: 'laranja', t: `Frequência respiratória ${fr}` })
  if (t !== null && (t >= 40 || t < 35)) m.push({ r: 'laranja', t: `Temperatura ${t}°C` })
  else if (t !== null && t >= 38.5) m.push({ r: 'amarelo', t: `Febre ${t}°C` })
  if (gli !== null && (gli < 60 || gli > 400)) m.push({ r: 'laranja', t: `Glicemia ${gli}` })
  else if (gli !== null && gli > 250) m.push({ r: 'amarelo', t: `Glicemia ${gli}` })
  if (dor !== null && dor >= 8) m.push({ r: 'laranja', t: `Dor ${dor}/10` })
  else if (dor !== null && dor >= 5) m.push({ r: 'amarelo', t: `Dor ${dor}/10` })
  const ordem: Risco[] = ['vermelho', 'laranja', 'amarelo', 'verde', 'azul']
  const pior = m.reduce<Risco>((acc, x) => (ordem.indexOf(x.r) < ordem.indexOf(acc) ? x.r : acc), 'verde')
  return { risco: pior, motivos: m.map(x => x.t) }
}

/** IMC (peso em kg, altura em cm). */
export const imc = (peso?: number | null, altura?: number | null) =>
  peso && altura ? Math.round((peso / Math.pow(altura / 100, 2)) * 10) / 10 : null
