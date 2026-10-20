/**
 * Planos do Clinical 360. Por enquanto só o GRÁTIS tem limites aplicados pelo sistema;
 * contas antigas (plano vazio) e os planos pagos seguem sem limite até a cobrança existir.
 *
 * clinicas.plano: 'gratis' | 'solo' | 'clinica' | 'pro' | null
 * O superadmin muda o plano em /superadmin (ação change_plano).
 */
export type Recurso =
  | 'equipe'        // convidar outros profissionais e recepção
  | 'atendimento'   // recepção, fila, triagem, TV e totem
  | 'sofia'         // Sofia e automações no WhatsApp
  | 'tiss'          // faturamento de convênios
  | 'exames'        // análise de exames com IA
  | 'teleconsulta'

export const PLANO_GRATIS = {
  nome: 'Grátis',
  /** Consultas com prontuário pela IA por mês (somando a clínica). */
  consultasIaMes: 10,
  /** Pessoas com acesso (o próprio dono incluído). */
  usuarios: 1,
  /** O que fica fora do grátis. */
  bloqueados: ['equipe', 'atendimento', 'sofia', 'tiss', 'exames'] as Recurso[],
  incluso: [
    'Agenda e cadastro de pacientes',
    '10 consultas por mês com prontuário escrito pela IA',
    'Receitas Memed e documentos',
    'Teleconsulta',
    'Chat do WhatsApp (sem a Sofia)',
  ],
}

export const NOME_RECURSO: Record<Recurso, string> = {
  equipe: 'Equipe com mais pessoas',
  atendimento: 'Recepção, fila, triagem e TV',
  sofia: 'Sofia e automações no WhatsApp',
  tiss: 'Faturamento de convênios',
  exames: 'Análise de exames com IA',
  teleconsulta: 'Teleconsulta',
}

export const ehGratis = (plano?: string | null) => plano === 'gratis'

export function recursoLiberado(plano: string | null | undefined, r: Recurso) {
  return !ehGratis(plano) || !PLANO_GRATIS.bloqueados.includes(r)
}

/** Rotas do app que cada recurso cobre (para o menu e o aviso de "plano completo"). */
export const ROTAS_RECURSO: Record<string, Recurso> = {
  '/atendimento': 'atendimento', '/gestao': 'atendimento',
  '/faturamento': 'tiss',
  '/exames': 'exames',
  '/admin': 'equipe',
}

export function recursoDaRota(pathname: string): Recurso | null {
  const r = Object.keys(ROTAS_RECURSO).find(p => pathname === p || pathname.startsWith(p + '/'))
  return r ? ROTAS_RECURSO[r] : null
}

/** Primeiro dia do mês corrente (fuso de São Paulo) em ISO, para contar o uso do mês. */
export function inicioDoMesSP(agora = new Date()) {
  const [a, m] = agora.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }).split('-')
  return new Date(`${a}-${m}-01T00:00:00-03:00`).toISOString()
}
