/** Contas do orçamento (sem banco): total, status visível e padrões. Usado na tela e no servidor. */
export type ItemOrcamento = { procedimento_id?: string | null; descricao: string; quantidade: number; valor_unitario: number }
export type StatusOrcamento = 'rascunho' | 'enviado' | 'visto' | 'aprovado' | 'recusado' | 'cancelado' | 'expirado'

const arred = (n: number) => Math.round(n * 100) / 100
export const hojeSP = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })

export const CONDICOES_PADRAO = ['À vista (Pix ou dinheiro)', 'Cartão de crédito em até 3x', 'Cartão de débito']

export function statusVisivel(o: { status: string; validade: string }): StatusOrcamento {
  if (['enviado', 'visto', 'rascunho'].includes(o.status) && o.validade < hojeSP()) return 'expirado'
  return o.status as StatusOrcamento
}

export function totalDe(itens: ItemOrcamento[], desconto: number) {
  const bruto = itens.reduce((s, i) => s + (Number(i.quantidade) || 0) * (Number(i.valor_unitario) || 0), 0)
  return { bruto: arred(bruto), total: arred(Math.max(0, bruto - Math.max(0, Number(desconto) || 0))) }
}

