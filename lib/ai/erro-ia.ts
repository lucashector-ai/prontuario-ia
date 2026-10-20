/** Erro da API de IA → mensagem para quem está atendendo (o detalhe técnico fica só no log). */
export function mensagemErroIA(e: any): { mensagem: string; status: number; codigo: string } {
  const txt = String(e?.message || e || '')
  const st = Number(e?.status) || 0
  if (/credit balance|billing|quota/i.test(txt)) return { mensagem: 'A IA está indisponível no momento. Você pode salvar o texto da consulta sem a IA e gerar o prontuário depois. A equipe do Clinical 360 já foi avisada.', status: 503, codigo: 'ia_sem_credito' }
  if (st === 529 || /overloaded/i.test(txt)) return { mensagem: 'A IA está sobrecarregada agora. Tente de novo em alguns segundos, ou salve o texto sem a IA.', status: 503, codigo: 'ia_ocupada' }
  if (st === 429 || /rate limit/i.test(txt)) return { mensagem: 'Muitos pedidos à IA ao mesmo tempo. Tente de novo em alguns segundos.', status: 429, codigo: 'ia_limite' }
  if (st === 401 || /api key|authentication/i.test(txt)) return { mensagem: 'A IA está indisponível no momento. Salve o texto sem a IA e avise o suporte.', status: 503, codigo: 'ia_config' }
  return { mensagem: 'Não foi possível gerar o prontuário agora. Tente de novo ou salve o texto sem a IA.', status: 500, codigo: 'ia_erro' }
}
