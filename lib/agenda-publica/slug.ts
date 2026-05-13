import { supabase } from '@/lib/supabase'

const FORMATO = /^[a-z0-9](?:[a-z0-9-]{1,48}[a-z0-9])?$/
const RESERVADOS = [
  'admin','api','app','clinica','medico','medicos','clinicas',
  'agenda','agendar','login','logout','cadastro','configuracoes',
  'dashboard','perfil','suporte','ajuda','teleconsulta','sobre',
  'planos','termos','privacidade','lgpd','blog','contato','sair'
]

export function normalizarSlug(input: string): string {
  return (input || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50)
}

export function validarFormatoSlug(slug: string): { valido: boolean; erro?: string } {
  if (!slug) return { valido: false, erro: 'Informe um slug' }
  if (slug.length < 3) return { valido: false, erro: 'Mínimo 3 caracteres' }
  if (slug.length > 50) return { valido: false, erro: 'Máximo 50 caracteres' }
  if (!FORMATO.test(slug)) {
    return { valido: false, erro: 'Use apenas letras minúsculas, números e hífens' }
  }
  if (RESERVADOS.includes(slug)) {
    return { valido: false, erro: 'Esse nome é reservado pelo sistema' }
  }
  return { valido: true }
}

export async function checarDisponibilidadeSlug(
  slug: string,
  excluirTipo?: 'medico' | 'clinica',
  excluirId?: string
): Promise<{ disponivel: boolean; ocupadoPor?: 'medico' | 'clinica' }> {
  let queryMedicos = supabase.from('medicos').select('id').eq('slug_publico', slug)
  if (excluirTipo === 'medico' && excluirId) {
    queryMedicos = queryMedicos.neq('id', excluirId)
  }
  const { data: medicos } = await queryMedicos.limit(1)
  if (medicos && medicos.length > 0) {
    return { disponivel: false, ocupadoPor: 'medico' }
  }

  let queryClinicas = supabase.from('clinicas').select('id').eq('slug_publico', slug)
  if (excluirTipo === 'clinica' && excluirId) {
    queryClinicas = queryClinicas.neq('id', excluirId)
  }
  const { data: clinicas } = await queryClinicas.limit(1)
  if (clinicas && clinicas.length > 0) {
    return { disponivel: false, ocupadoPor: 'clinica' }
  }

  return { disponivel: true }
}

export async function sugerirAlternativaSlug(slug: string): Promise<string> {
  for (let i = 2; i <= 99; i++) {
    const candidato = `${slug}-${i}`
    const { disponivel } = await checarDisponibilidadeSlug(candidato)
    if (disponivel) return candidato
  }
  return `${slug}-${Math.floor(Math.random() * 9000) + 1000}`
}
