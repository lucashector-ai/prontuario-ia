/**
 * Para onde a pessoa vai depois de entrar (login, confirmação de email, troca de senha).
 * Uma regra só para o sistema todo:
 *   primeiro acesso → /onboarding · recepção → /recepcao · demais → /dashboard (Início)
 */
export function destinoInicial(tipo: 'clinica' | 'medico', dados: { onboarding_concluido?: boolean | null; cargo?: string | null } | null | undefined) {
  if (!dados?.onboarding_concluido) return '/onboarding'
  if (tipo === 'medico' && dados.cargo === 'recepcionista') return '/atendimento/recepcao'
  return '/dashboard'
}
