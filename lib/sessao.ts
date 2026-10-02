/**
 * Sessão no navegador (localStorage + cookies do middleware).
 * Use `sairDaConta()` em todo botão "Sair" — limpa médico, admin, clínica e atendente.
 */

/** Atendente da equipe de chat (login em /login-atendente): só tem acesso ao Chat. */
export function ehAtendente(): boolean {
  if (typeof window === 'undefined') return false
  try {
    if (localStorage.getItem('atendente')) return true
    const m = localStorage.getItem('medico')
    return !!(m && JSON.parse(m).is_atendente)
  } catch { return false }
}

/** Limpa a sessão e devolve a rota de login adequada. */
export function sairDaConta(): string {
  const atendente = ehAtendente()
  for (const k of ['medico', 'clinica_admin', 'clinica', 'atendente']) {
    try { localStorage.removeItem(k) } catch {}
  }
  document.cookie = 'is_atendente=; path=/; max-age=0'
  document.cookie = 'medico_id=; path=/; max-age=0'
  return atendente ? '/login-atendente' : '/login'
}
