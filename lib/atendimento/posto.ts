/** "Meu posto" na Central de atendimento: onde cada pessoa trabalha e qual aba abre primeiro. */
export type Posto = 'agora' | 'recepcao' | 'triagem' | 'consultorio' | 'saidas' | 'telas'
export type Perfil = 'gestor' | 'recepcao' | 'medico'
export const CHAVE_POSTO = 'c360-meu-posto'

export function perfilAtual(): Perfil {
  try {
    if (localStorage.getItem('clinica_admin')) return 'gestor'
    const m = JSON.parse(localStorage.getItem('medico') || 'null')
    if (m?.cargo === 'recepcionista') return 'recepcao'
    if (m?.cargo === 'admin') return 'gestor'
  } catch {}
  return 'medico'
}

/** Posto padrão de cada perfil (quando a pessoa ainda não fixou o dela). */
export function postoPadrao(p: Perfil): Posto {
  return p === 'recepcao' ? 'recepcao' : p === 'medico' ? 'consultorio' : 'agora'
}

/** Aba em que a Central abre para esta pessoa. */
export function postoInicial(): Posto {
  try { const v = localStorage.getItem(CHAVE_POSTO) as Posto | null; if (v) return v } catch {}
  return postoPadrao(perfilAtual())
}
