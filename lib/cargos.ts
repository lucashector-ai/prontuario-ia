/**
 * Cargos de quem tem login na tabela medicos.
 *   medico         atende, tem agenda e prontuário
 *   admin          médico que também administra a clínica (ou o autônomo)
 *   recepcionista  agenda, chegadas, senhas, retornos — não lê prontuário
 *   enfermagem     triagem e sinais vitais — não lê prontuário
 * "Equipe de apoio" = quem não atende como médico (não aparece nas listas de médicos).
 */
export type Cargo = 'medico' | 'admin' | 'recepcionista' | 'enfermagem'
export const CARGOS_APOIO = ['recepcionista', 'enfermagem'] as const
export const ehApoio = (cargo?: string | null) => cargo === 'recepcionista' || cargo === 'enfermagem'
/** Filtro do Supabase para listar só quem atende: .not('cargo', 'in', FILTRO_APOIO) */
export const FILTRO_APOIO = '(recepcionista,enfermagem)'
export const NOME_CARGO: Record<string, string> = { medico: 'Médico', admin: 'Administrador', recepcionista: 'Recepção', enfermagem: 'Enfermagem' }
