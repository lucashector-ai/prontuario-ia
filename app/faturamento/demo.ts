/**
 * Dados do modo demonstração (/faturamento?demo=1). Nada é gravado no banco.
 * Datas relativas a hoje.
 */
import type { Guia, ItemPreco, Lote, Operadora, Procedimento, StatusGuia } from '@/lib/tiss/tipos'
import { totalProcedimentos } from '@/lib/tiss/tipos'

const dia = (delta: number) => {
  const d = new Date()
  d.setDate(d.getDate() + delta)
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
}
const mesPassado = (d: number) => {
  const x = new Date()
  x.setDate(1); x.setMonth(x.getMonth() - 1); x.setDate(d)
  return x.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
}
const iso = (data: string) => `${data}T13:00:00.000Z`

export const DEMO_OPERADORAS: Operadora[] = [
  {
    id: 'op-unimed', nome: 'Unimed', registro_ans: '339679', codigo_prestador: '0045821', cnpj_operadora: '',
    cnes: '2077485', nome_contratado: 'Clínica Bem Viver Ltda', versao_tiss: '4.01.00', prazo_pagamento_dias: 30, ativo: true,
  },
  {
    id: 'op-bradesco', nome: 'Bradesco Saúde', registro_ans: '421715', codigo_prestador: '882134', cnpj_operadora: '',
    cnes: '2077485', nome_contratado: 'Clínica Bem Viver Ltda', versao_tiss: '4.01.00', prazo_pagamento_dias: 45, ativo: true,
  },
]

export const DEMO_PRECOS: Record<string, ItemPreco[]> = {
  'op-unimed': [
    { id: 'p1', operadora_id: 'op-unimed', codigo_tuss: '10101012', descricao: 'Consulta em consultório', valor: 120 },
    { id: 'p2', operadora_id: 'op-unimed', codigo_tuss: '40101010', descricao: 'ECG convencional de até 12 derivações', valor: 45 },
    { id: 'p3', operadora_id: 'op-unimed', codigo_tuss: '40304361', descricao: 'Hemograma com contagem de plaquetas', valor: 14.8 },
    { id: 'p4', operadora_id: 'op-unimed', codigo_tuss: '40302040', descricao: 'Glicose', valor: 6.4 },
  ],
  'op-bradesco': [
    { id: 'p5', operadora_id: 'op-bradesco', codigo_tuss: '10101012', descricao: 'Consulta em consultório', valor: 150 },
    { id: 'p6', operadora_id: 'op-bradesco', codigo_tuss: '40101010', descricao: 'ECG convencional de até 12 derivações', valor: 52 },
  ],
}

const PROF = { nome: 'Dra. Camila Andrade', conselho: '06', numero: '145872', uf: '35', cbos: '225120' }
const consulta = (valor: number): Procedimento[] => [{ codigo_tuss: '10101012', descricao: 'Consulta em consultório', quantidade: 1, valor_unitario: valor }]

function g(n: number, op: string, nome: string, carteira: string, data: string, status: StatusGuia, extra: Partial<Guia> = {}): Guia {
  const procedimentos = extra.procedimentos || consulta(op === 'op-unimed' ? 120 : 150)
  return {
    id: `guia-${n}`, operadora_id: op, medico_id: 'demo', paciente_id: `pac-${n}`, consulta_id: `cons-${n}`, tipo: 'consulta',
    numero_guia_prestador: String(n), numero_carteira: carteira, nome_beneficiario: nome, data_atendimento: data,
    cid_principal: null, procedimentos, valor_total: totalProcedimentos(procedimentos), tipo_consulta: '2',
    indicacao_acidente: '9', carater_atendimento: '1', profissional: PROF, status,
    criado_em: iso(data), atualizado_em: iso(data), historico: [{ em: iso(data), evento: 'criada', detalhe: 'Gerada a partir da consulta' }],
    ...extra,
  }
}

export function demoGuias(): Guia[] {
  return [
    // Lote 1 (Unimed, mês passado) — enviado, com retornos
    g(101, 'op-unimed', 'Maria Aparecida Santos', '00630012345678', mesPassado(3), 'paga', { lote_id: 'lote-1', valor_pago: 120, valor_glosado: 0, retorno_em: iso(dia(-4)), cid_principal: 'I10' }),
    g(102, 'op-unimed', 'José Carlos Oliveira', '00630098765432', mesPassado(5), 'paga', { lote_id: 'lote-1', valor_pago: 120, valor_glosado: 0, retorno_em: iso(dia(-4)), tipo_consulta: '1' }),
    g(103, 'op-unimed', 'Ana Beatriz Lima', '00630055501234', mesPassado(8), 'glosada', { lote_id: 'lote-1', valor_pago: 0, valor_glosado: 120, retorno_em: iso(dia(-4)), motivo_glosa: 'Carteirinha vencida na data do atendimento' }),
    g(104, 'op-unimed', 'Francisco Pereira', '00630077788899', mesPassado(12), 'paga_parcial', {
      lote_id: 'lote-1', valor_pago: 96, valor_glosado: 24, retorno_em: iso(dia(-4)), motivo_glosa: 'Valor acima da tabela negociada',
    }),
    g(105, 'op-unimed', 'Juliana Costa Ribeiro', '00630011122233', mesPassado(18), 'enviada', { lote_id: 'lote-1' }),
    g(106, 'op-unimed', 'Antônio Ferreira', '00630044455566', mesPassado(22), 'enviada', { lote_id: 'lote-1', cid_principal: 'E11.9' }),
    // Lote 2 (Bradesco, mês passado) — aberto, aguardando exportação
    g(201, 'op-bradesco', 'Luciana Almeida', '7788 1234 5566 0001', mesPassado(10), 'em_lote', { lote_id: 'lote-2', numero_carteira: '7788123455660001' }),
    g(202, 'op-bradesco', 'Rafael Gomes Martins', '7788123455660002', mesPassado(20), 'em_lote', { lote_id: 'lote-2', tipo_consulta: '1' }),
    // Mês atual
    g(203, 'op-bradesco', 'Patrícia Rocha', '7788123455660003', dia(-6), 'pronta'),
    g(107, 'op-unimed', 'Marcos Vinícius Souza', '00630033344455', dia(-3), 'pronta', { cid_principal: 'J06.9' }),
    g(108, 'op-unimed', 'Fernanda Carvalho', '', dia(-2), 'rascunho', { tipo_consulta: '1' }),
    g(204, 'op-bradesco', 'Paulo Henrique Dias', '7788123455660004', dia(-1), 'rascunho', {
      tipo: 'sp_sadt', tipo_atendimento: '05', consulta_id: null,
      procedimentos: [
        { codigo_tuss: '40101010', descricao: 'ECG convencional de até 12 derivações', quantidade: 1, valor_unitario: 52 },
        { codigo_tuss: '40302040', descricao: 'Glicose', quantidade: 1, valor_unitario: 0 },
      ],
    }),
  ]
}

export function demoLotes(): Lote[] {
  const comp = mesPassado(1).slice(0, 7)
  return [
    {
      id: 'lote-1', operadora_id: 'op-unimed', numero_lote: 12, tipo_guia: 'consulta', competencia: comp, quantidade_guias: 6,
      valor_total: 720, status: 'enviado', enviado_em: iso(dia(-28)), protocolo: '2025093000871', xml_hash: null, criado_em: iso(dia(-29)),
    },
    {
      id: 'lote-2', operadora_id: 'op-bradesco', numero_lote: 5, tipo_guia: 'consulta', competencia: comp, quantidade_guias: 2,
      valor_total: 300, status: 'aberto', criado_em: iso(dia(-1)),
    },
  ]
}

/** Consultas de convênio sem guia (para "gerar guias das consultas"). */
export function demoPendentes() {
  return [
    { consulta_id: 'cons-p1', paciente: 'Beatriz Nogueira', convenio: 'Unimed', data: dia(-1), carteira: '00630099988877' },
    { consulta_id: 'cons-p2', paciente: 'Eduardo Ramos', convenio: 'Bradesco Saúde', data: dia(0), carteira: '7788123455660009' },
  ]
}
