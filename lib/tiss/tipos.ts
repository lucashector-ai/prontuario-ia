/**
 * Tipos e tabelas de domínio do faturamento TISS (ANS).
 * Sem imports de alias (`@/`) para rodar também nos testes do vitest.
 */

export type TipoGuia = 'consulta' | 'sp_sadt'
export type StatusGuia = 'rascunho' | 'pronta' | 'em_lote' | 'enviada' | 'paga' | 'glosada' | 'paga_parcial'
export type StatusLote = 'aberto' | 'enviado' | 'processado'

export type Procedimento = {
  codigo_tuss: string
  descricao: string
  quantidade: number
  valor_unitario: number
}

export type Profissional = {
  nome?: string
  conselho?: string   // tabela 26 — 06 = CRM
  numero?: string     // número no conselho
  uf?: string         // código IBGE da UF (tabela 59) — 35 = SP
  cbos?: string       // CBO-S (tabela 24) — 225125 = médico clínico
}

export type Operadora = {
  id: string
  clinica_id?: string | null
  medico_id?: string | null
  nome: string
  registro_ans: string
  codigo_prestador?: string | null
  cnpj_operadora?: string | null
  cnes?: string | null
  nome_contratado?: string | null
  versao_tiss?: string | null
  prazo_pagamento_dias?: number | null
  ativo?: boolean
  criado_em?: string
}

export type ItemPreco = {
  id: string
  operadora_id: string
  codigo_tuss: string
  descricao: string
  valor: number
}

export type HistoricoGuia = { em: string; evento: string; detalhe?: string }

export type Guia = {
  id: string
  operadora_id: string
  medico_id?: string | null
  paciente_id?: string | null
  consulta_id?: string | null
  agendamento_id?: string | null
  tipo: TipoGuia
  numero_guia_prestador: string
  numero_guia_operadora?: string | null
  numero_carteira?: string | null
  nome_beneficiario?: string | null
  data_atendimento: string // yyyy-mm-dd
  cid_principal?: string | null
  procedimentos: Procedimento[]
  valor_total: number
  tipo_consulta?: string | null
  tipo_atendimento?: string | null
  indicacao_acidente?: string | null
  carater_atendimento?: string | null
  profissional?: Profissional | null
  observacao?: string | null
  status: StatusGuia
  valor_pago?: number | null
  valor_glosado?: number | null
  motivo_glosa?: string | null
  retorno_em?: string | null
  historico?: HistoricoGuia[] | null
  lote_id?: string | null
  criado_em?: string
  atualizado_em?: string
}

export type Lote = {
  id: string
  operadora_id: string
  numero_lote: number
  tipo_guia: TipoGuia
  competencia: string // yyyy-mm
  quantidade_guias: number
  valor_total: number
  status: StatusLote
  enviado_em?: string | null
  protocolo?: string | null
  xml_hash?: string | null
  criado_em?: string
}

export const STATUS_GUIA: Record<StatusGuia, { label: string; tom: 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'pending' | 'accent' }> = {
  rascunho: { label: 'Rascunho', tom: 'neutral' },
  pronta: { label: 'Pronta', tom: 'accent' },
  em_lote: { label: 'Em lote', tom: 'info' },
  enviada: { label: 'Enviada', tom: 'pending' },
  paga: { label: 'Paga', tom: 'success' },
  glosada: { label: 'Glosada', tom: 'danger' },
  paga_parcial: { label: 'Paga parcial', tom: 'warning' },
}

export const STATUS_LOTE: Record<StatusLote, { label: string; tom: 'neutral' | 'info' | 'success' | 'pending' }> = {
  aberto: { label: 'Aberto', tom: 'info' },
  enviado: { label: 'Enviado', tom: 'pending' },
  processado: { label: 'Processado', tom: 'success' },
}

export const TIPOS_CONSULTA: Record<string, string> = {
  '1': 'Primeira consulta',
  '2': 'Seguimento',
  '3': 'Pré-natal',
  '4': 'Por encaminhamento',
}

/** Tabela 50 (TISS 4) — tipos de atendimento mais usados em clínica. */
export const TIPOS_ATENDIMENTO: Record<string, string> = {
  '04': 'Consulta',
  '05': 'Exame ambulatorial',
  '03': 'Outras terapias',
  '02': 'Pequena cirurgia',
  '11': 'Pronto-socorro',
}

/** Tabela 36 — indicação de acidente. */
export const INDICACAO_ACIDENTE: Record<string, string> = {
  '9': 'Não acidente',
  '0': 'Trabalho',
  '1': 'Trânsito',
  '2': 'Outros acidentes',
}

export const CARATER_ATENDIMENTO: Record<string, string> = { '1': 'Eletivo', '2': 'Urgência/emergência' }

/** Tabela 26 — conselho profissional. */
export const CONSELHOS: Record<string, string> = {
  '06': 'CRM', '08': 'CRO', '09': 'CRP', '05': 'CREFITO', '07': 'CRN', '04': 'CRFa', '02': 'COREN',
}

/** Tabela 59 — UF pelo código IBGE. */
export const UF_IBGE: Record<string, string> = {
  AC: '12', AL: '27', AP: '16', AM: '13', BA: '29', CE: '23', DF: '53', ES: '32', GO: '52', MA: '21',
  MT: '51', MS: '50', MG: '31', PA: '15', PB: '25', PR: '41', PE: '26', PI: '22', RJ: '33', RN: '24',
  RS: '43', RO: '11', RR: '14', SC: '42', SP: '35', SE: '28', TO: '17', EX: '98',
}
export const UF_POR_CODIGO: Record<string, string> = Object.fromEntries(Object.entries(UF_IBGE).map(([s, c]) => [c, s]))

/** CBO-S sugerido pela especialidade (o médico pode corrigir no editor). */
const CBOS_ESPECIALIDADE: Array<[RegExp, string]> = [
  [/cardio/, '225120'], [/pediat/, '225124'], [/gineco|obstet/, '225250'], [/dermat/, '225135'],
  [/ortop|traumat/, '225270'], [/psiquiat/, '225133'], [/endocrin/, '225155'], [/neuro/, '225112'],
  [/oftalm/, '225265'], [/otorrin/, '225275'], [/urolog/, '225285'], [/gastro/, '225165'],
  [/pneumo/, '225127'], [/geriat/, '225180'], [/famil|comunidade/, '225142'], [/clinic|geral|interna/, '225125'],
]
export function cbosDaEspecialidade(especialidade?: string | null): string {
  const e = (especialidade || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  return CBOS_ESPECIALIDADE.find(([r]) => r.test(e))?.[1] || '225125'
}

/** "CRM-SP 123456", "123456/SP", "123.456 SP" → { numero: '123456', uf: '35' } */
export function interpretarCrm(crm?: string | null): { numero: string; uf: string } {
  const s = (crm || '').toUpperCase()
  const numero = (s.match(/\d[\d.]*/)?.[0] || '').replace(/\D/g, '')
  const sigla = (s.replace(/CRM/g, '').match(/\b([A-Z]{2})\b/)?.[1]) || ''
  return { numero, uf: UF_IBGE[sigla] || '' }
}

/** Profissional pré-preenchido a partir do cadastro do médico. */
export function profissionalDoMedico(m?: { nome?: string; crm?: string; especialidade?: string } | null): Profissional {
  const { numero, uf } = interpretarCrm(m?.crm)
  return { nome: m?.nome || '', conselho: '06', numero, uf, cbos: cbosDaEspecialidade(m?.especialidade) }
}

export const arred2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100

export function totalProcedimentos(p: Procedimento[] | null | undefined): number {
  return arred2((p || []).reduce((s, x) => s + (Number(x.quantidade) || 0) * (Number(x.valor_unitario) || 0), 0))
}

/** yyyy-mm a partir de uma data yyyy-mm-dd. */
export const competenciaDe = (data: string) => (data || '').slice(0, 7)

/** Nome comparável de operadora/convênio (sem acento, minúsculo, sem espaços extras). */
export const chaveNome = (s?: string | null) =>
  (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
