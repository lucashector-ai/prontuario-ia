import { hojeISO, somarDias } from '@/components/retornos/datas'

export type StatusRetorno = 'pendente' | 'lembrado' | 'agendado' | 'concluido' | 'descartado'

export type Retorno = {
  id: string
  medico_id: string
  paciente_id: string
  consulta_id?: string | null
  data_prevista: string
  motivo: string | null
  origem: 'manual' | 'ia' | 'consulta'
  status: StatusRetorno
  lembrete_enviado_em: string | null
  agendamento_id?: string | null
  criado_em: string
  paciente: { id: string; nome: string; telefone: string | null } | null
}

export type Inativo = {
  id: string
  nome: string
  telefone: string | null
  ultima_visita: string | null
  nunca_consultou: boolean
  janela_aberta: boolean
}

export type Campanha = {
  id: string
  nome: string
  mensagem: string
  filtro: any
  total_destinatarios: number
  enviados: number
  falhas: number
  respostas?: number
  pendentes?: number
  status: 'rascunho' | 'enviando' | 'concluida'
  criado_em: string
  concluida_em: string | null
}

export const MENSAGEM_PADRAO =
  'Olá, {nome}! Aqui é da {clinica}. Faz um tempo que não nos vemos e queremos saber como você está. ' +
  'Que tal agendar uma consulta de acompanhamento com {medico}? É só responder esta mensagem que a gente encontra o melhor horário.'

export const faltaMigration = (e: any) => !!e && /migration|column|relation|does not exist|schema cache/i.test(String(e?.message || e?.error || e))

// ── Modo demonstração (?demo=1) ─────────────────────────────────────────────

const NOMES = [
  ['Mariana Albuquerque', '11987654321'], ['João Pedro Nogueira', '11991234567'], ['Ana Clara Ribeiro', '21998761234'],
  ['Carlos Eduardo Lima', '11976543210'], ['Fernanda Costa Pires', '31988776655'], ['Rafael Moreira', '11955667788'],
  ['Beatriz Fontes', '11944332211'], ['Luiz Henrique Prado', '19997654321'], ['Patrícia Mendes', '11933221100'],
  ['Thiago Barbosa', '41999887766'], ['Juliana Teixeira', '11922113344'], ['Gustavo Sampaio', '11966554433'],
  ['Camila Rocha', '11912345678'], ['Roberto Antunes', '11923456789'],
] as const

export const PACIENTES_DEMO = NOMES.map(([nome, telefone], i) => ({ id: `pac-${i + 1}`, nome, telefone: telefone as string }))

export function retornosDemo(medicoId: string): Retorno[] {
  const h = hojeISO()
  const linhas: [number, number, string, StatusRetorno, Retorno['origem'], boolean?][] = [
    [0, -9, 'Reavaliar pressão arterial', 'lembrado', 'consulta', true],
    [1, -4, 'Resultado de exames laboratoriais', 'pendente', 'ia'],
    [2, -1, 'Controle de glicemia', 'lembrado', 'ia', true],
    [3, 0, 'Cefaleia tensional', 'pendente', 'consulta'],
    [4, 2, 'Ajuste de dose — levotiroxina', 'lembrado', 'ia', true],
    [5, 4, 'Retorno pós-procedimento', 'pendente', 'manual'],
    [6, 6, 'Avaliar resposta ao antibiótico', 'pendente', 'consulta'],
    [7, 12, 'Seguimento de dislipidemia', 'pendente', 'ia'],
    [8, 21, 'Rinite alérgica', 'pendente', 'manual'],
    [9, 33, 'Controle de asma', 'pendente', 'consulta'],
    [10, 58, 'Check-up anual', 'pendente', 'manual'],
    [11, 8, 'Lombalgia — reavaliação', 'agendado', 'consulta'],
    [12, 15, 'Pré-natal — 2º trimestre', 'agendado', 'manual'],
    [13, -20, 'Gastrite — controle', 'concluido', 'ia'],
  ]
  return linhas.map(([p, d, motivo, status, origem, lembrado], i) => ({
    id: `ret-${i + 1}`, medico_id: medicoId, paciente_id: PACIENTES_DEMO[p].id,
    data_prevista: somarDias(h, d), motivo, origem, status,
    lembrete_enviado_em: lembrado ? new Date(Date.now() - 86400000 * 2).toISOString() : null,
    criado_em: new Date(Date.now() - 86400000 * 40).toISOString(),
    paciente: PACIENTES_DEMO[p],
  }))
}

export function inativosDemo(meses: number): Inativo[] {
  const base: [string, string | null, number | null, boolean?][] = [
    ['Adriana Lopes Martins', '11981112233', 4],
    ['Bruno Carvalho', '11982223344', 5, true],
    ['Cecília Duarte', '21983334455', 7],
    ['Diego Fernandes', null, 8],
    ['Elaine Souza Campos', '11985556677', 9],
    ['Fábio Guimarães', '11986667788', 11],
    ['Gabriela Matos', '31987778899', 13],
    ['Heitor Vasconcelos', '11988889900', 14],
    ['Isabela Cunha', '11989990011', 16],
    ['Jorge Amaral', '11980001122', 19],
    ['Kátia Ramos', '11981234000', 22],
    ['Leonardo Pacheco', '11982345111', null],
    ['Márcia Figueiredo', '11983456222', 26],
  ]
  return base
    .filter(([, , m]) => m === null || m >= meses)
    .map(([nome, telefone, m, janela], i) => {
      const d = new Date(); if (m !== null) d.setMonth(d.getMonth() - m); d.setDate(d.getDate() - (i * 3) % 20)
      return { id: `ina-${i + 1}`, nome, telefone, ultima_visita: m === null ? null : d.toISOString(), nunca_consultou: m === null, janela_aberta: !!janela }
    })
}

export function campanhasDemo(): Campanha[] {
  const dias = (n: number) => new Date(Date.now() - n * 86400000).toISOString()
  return [
    { id: 'c1', nome: 'Reativação · pacientes de 6 meses', mensagem: MENSAGEM_PADRAO, filtro: { meses: 6 }, total_destinatarios: 48, enviados: 45, falhas: 3, respostas: 14, status: 'concluida', criado_em: dias(6), concluida_em: dias(6) },
    { id: 'c2', nome: 'Check-up anual — 12 meses', mensagem: 'Olá, {nome}! Já faz um ano da sua última consulta com {medico}. Vamos agendar o seu check-up?', filtro: { meses: 12 }, total_destinatarios: 31, enviados: 29, falhas: 2, respostas: 9, status: 'concluida', criado_em: dias(23), concluida_em: dias(23) },
    { id: 'c3', nome: 'Vacinação de gripe', mensagem: 'Olá, {nome}! A campanha de vacinação contra a gripe começou na {clinica}. Responda para reservar seu horário.', filtro: { meses: 3 }, total_destinatarios: 62, enviados: 51, falhas: 11, respostas: 22, status: 'concluida', criado_em: dias(58), concluida_em: dias(57) },
  ]
}
