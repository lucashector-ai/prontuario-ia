/**
 * Validações de guias/operadora ANTES de exportar o XML TISS.
 * Erros bloqueiam a exportação; avisos só alertam.
 * Cada mensagem traz `campo` para o editor destacar o campo em vermelho.
 */
import type { Guia, Operadora } from './tipos'
import { totalProcedimentos, TIPOS_CONSULTA, UF_POR_CODIGO } from './tipos'

export type Problema = { campo: string; mensagem: string }
export type ResultadoValidacao = { ok: boolean; erros: Problema[]; avisos: Problema[] }

const reData = /^\d{4}-\d{2}-\d{2}$/
export const reCid = /^[A-Z]\d{2}(\.?\d{1,2})?$/
export const reTuss = /^\d{8}$/

function dataValida(s?: string | null): boolean {
  if (!s || !reData.test(s)) return false
  const d = new Date(s + 'T12:00:00Z')
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s
}

export function validarOperadora(op: Partial<Operadora> | null | undefined): ResultadoValidacao {
  const erros: Problema[] = []
  const avisos: Problema[] = []
  if (!op) return { ok: false, erros: [{ campo: 'operadora_id', mensagem: 'Selecione a operadora.' }], avisos }
  if (!op.nome?.trim()) erros.push({ campo: 'nome', mensagem: 'Informe o nome da operadora.' })
  if (!/^\d{6}$/.test(op.registro_ans || '')) erros.push({ campo: 'registro_ans', mensagem: 'Registro ANS deve ter 6 dígitos.' })
  if (!op.codigo_prestador?.trim()) erros.push({ campo: 'codigo_prestador', mensagem: 'Informe o código do prestador na operadora (consta no contrato/credenciamento).' })
  else if (op.codigo_prestador.trim().length > 14) erros.push({ campo: 'codigo_prestador', mensagem: 'Código do prestador tem no máximo 14 caracteres.' })
  if (op.cnpj_operadora && op.cnpj_operadora.replace(/\D/g, '').length !== 14) avisos.push({ campo: 'cnpj_operadora', mensagem: 'CNPJ da operadora deve ter 14 dígitos.' })
  if (op.cnes && !/^\d{7}$/.test(op.cnes)) erros.push({ campo: 'cnes', mensagem: 'CNES deve ter 7 dígitos (use 9999999 se não possuir).' })
  return { ok: erros.length === 0, erros, avisos }
}

export function validarGuia(g: Partial<Guia>, opts: { hoje?: string; operadora?: Partial<Operadora> | null } = {}): ResultadoValidacao {
  const erros: Problema[] = []
  const avisos: Problema[] = []
  const hoje = opts.hoje || new Date().toISOString().slice(0, 10)

  if (!g.operadora_id) erros.push({ campo: 'operadora_id', mensagem: 'Selecione a operadora.' })
  if (opts.operadora) {
    const vo = validarOperadora(opts.operadora)
    vo.erros.forEach(e => erros.push({ campo: 'operadora', mensagem: `Operadora: ${e.mensagem}` }))
  }

  // Beneficiário
  const carteira = (g.numero_carteira || '').replace(/\s/g, '')
  if (!carteira) erros.push({ campo: 'numero_carteira', mensagem: 'Informe o número da carteirinha do paciente.' })
  else if (carteira.length > 20) erros.push({ campo: 'numero_carteira', mensagem: 'Carteirinha tem no máximo 20 caracteres.' })
  else if (!/^[0-9A-Za-z.\-]+$/.test(carteira)) erros.push({ campo: 'numero_carteira', mensagem: 'Carteirinha só pode ter letras, números, ponto e traço.' })
  if (!g.nome_beneficiario?.trim()) avisos.push({ campo: 'nome_beneficiario', mensagem: 'Nome do beneficiário em branco (necessário na guia impressa).' })

  // Guia
  if (!g.numero_guia_prestador?.trim()) erros.push({ campo: 'numero_guia_prestador', mensagem: 'Número da guia no prestador é obrigatório.' })
  else if (g.numero_guia_prestador.length > 20) erros.push({ campo: 'numero_guia_prestador', mensagem: 'Número da guia tem no máximo 20 caracteres.' })

  // Data
  if (!dataValida(g.data_atendimento)) erros.push({ campo: 'data_atendimento', mensagem: 'Data do atendimento inválida.' })
  else if (g.data_atendimento! > hoje) erros.push({ campo: 'data_atendimento', mensagem: 'Data do atendimento não pode ser no futuro.' })
  else {
    const dias = (new Date(hoje).getTime() - new Date(g.data_atendimento!).getTime()) / 86400000
    if (dias > 90) avisos.push({ campo: 'data_atendimento', mensagem: `Atendimento de ${Math.floor(dias)} dias atrás — confira o prazo de apresentação da operadora.` })
  }

  // CID (opcional; as guias de consulta/SP-SADT TISS 4 não levam CID, mas validamos o formato)
  if (g.cid_principal && !reCid.test(g.cid_principal.trim().toUpperCase())) {
    erros.push({ campo: 'cid_principal', mensagem: 'CID inválido — use o formato A00 ou A00.0.' })
  }

  // Profissional
  const p = g.profissional || {}
  if (!(p.numero || '').replace(/\D/g, '')) erros.push({ campo: 'profissional.numero', mensagem: 'Informe o número no conselho (CRM) do profissional.' })
  if (!p.uf || !UF_POR_CODIGO[p.uf]) erros.push({ campo: 'profissional.uf', mensagem: 'Informe a UF do conselho profissional.' })
  if (!/^\d{6}$/.test(p.cbos || '')) erros.push({ campo: 'profissional.cbos', mensagem: 'CBO-S deve ter 6 dígitos (ex.: 225125 médico clínico).' })

  // Tipo
  if (g.tipo === 'consulta') {
    if (!TIPOS_CONSULTA[g.tipo_consulta || '']) erros.push({ campo: 'tipo_consulta', mensagem: 'Selecione o tipo de consulta.' })
  }

  // Procedimentos
  const procs = g.procedimentos || []
  if (!procs.length) erros.push({ campo: 'procedimentos', mensagem: 'Inclua ao menos um procedimento.' })
  if (g.tipo === 'consulta' && procs.length > 1) erros.push({ campo: 'procedimentos', mensagem: 'A guia de consulta aceita apenas um procedimento. Use SP/SADT para exames e procedimentos.' })
  procs.forEach((pr, i) => {
    const n = `Procedimento ${i + 1}`
    if (!reTuss.test(String(pr.codigo_tuss || '').trim())) {
      erros.push({ campo: `procedimentos.${i}.codigo_tuss`, mensagem: `${n}: código TUSS deve ter 8 dígitos.` })
    }
    if (!(Number(pr.quantidade) > 0) || !Number.isInteger(Number(pr.quantidade))) erros.push({ campo: `procedimentos.${i}.quantidade`, mensagem: `${n}: quantidade deve ser um número inteiro maior que zero.` })
    if (!(Number(pr.valor_unitario) > 0)) erros.push({ campo: `procedimentos.${i}.valor_unitario`, mensagem: `${n}: valor deve ser maior que zero.` })
  })
  if (procs.length && !(totalProcedimentos(procs) > 0)) erros.push({ campo: 'valor_total', mensagem: 'O valor total da guia deve ser maior que zero.' })

  return { ok: erros.length === 0, erros, avisos }
}

/** Valida várias guias; devolve só as que têm problema, com nome para a mensagem. */
export function validarGuias(guias: Partial<Guia>[], operadoras: Record<string, Partial<Operadora>>, hoje?: string) {
  return guias.map(g => ({ guia: g, r: validarGuia(g, { hoje, operadora: operadoras[g.operadora_id || ''] }) }))
    .filter(x => !x.r.ok)
}

/** Mensagens de erro de um campo (para destacar inline no editor). */
export const errosDoCampo = (r: ResultadoValidacao | null, campo: string) =>
  (r?.erros || []).filter(e => e.campo === campo).map(e => e.mensagem)
