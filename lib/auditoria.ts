/**
 * Registro de acessos ao prontuário (LGPD / CFM) — lado do NAVEGADOR.
 *
 *   registrarAcesso({ acao: 'visualizou', recurso: 'paciente', recursoId: id, pacienteId: id })
 *
 * Fire-and-forget: nunca lança erro, nunca bloqueia a tela, não precisa de await.
 * Mesmo (usuário, ação, recurso, recurso_id) é registrado no máximo 1x a cada 5 min.
 * Em `?demo=1` não grava nada.
 * Grava via POST /api/auditoria (tabela auditoria_acessos — migration 0013).
 */

export type AcaoAuditoria = 'visualizou' | 'editou' | 'exportou' | 'imprimiu' | 'excluiu'
export type RecursoAuditoria = 'paciente' | 'consulta' | 'prontuario' | 'exame' | 'conversa'
export type TipoUsuarioAuditoria = 'medico' | 'admin' | 'recepcionista' | 'atendente'

export const ACOES_AUDITORIA: AcaoAuditoria[] = ['visualizou', 'editou', 'exportou', 'imprimiu', 'excluiu']
export const RECURSOS_AUDITORIA: RecursoAuditoria[] = ['paciente', 'consulta', 'prontuario', 'exame', 'conversa']

export type RegistroAuditoria = {
  id: string
  clinica_id: string | null
  medico_id: string | null
  usuario_id: string | null
  usuario_nome: string | null
  usuario_tipo: TipoUsuarioAuditoria
  acao: AcaoAuditoria
  recurso: RecursoAuditoria
  recurso_id: string | null
  paciente_id: string | null
  paciente_nome?: string | null
  detalhes: Record<string, any> | null
  ip: string | null
  user_agent: string | null
  criado_em: string
}

export type UsuarioAuditoria = {
  usuario_id: string | null
  usuario_nome: string | null
  usuario_tipo: TipoUsuarioAuditoria
  clinica_id: string | null
  medico_id: string | null
}

const JANELA_MS = 5 * 60 * 1000
const CHAVE_CACHE = 'c360_auditoria_recentes'
const memoria: Record<string, number> = {}

function lerJSON(chave: string): any {
  try { const v = localStorage.getItem(chave); return v ? JSON.parse(v) : null } catch { return null }
}

/** Quem está usando o app agora (mesmo padrão de app/chat/useChat.ts). */
export function usuarioAtualAuditoria(): UsuarioAuditoria | null {
  if (typeof window === 'undefined') return null
  const admin = lerJSON('clinica_admin')
  if (admin) {
    return {
      usuario_id: admin.id || null, usuario_nome: admin.nome || admin.email || null,
      usuario_tipo: 'admin', clinica_id: admin.clinica_id || null, medico_id: null,
    }
  }
  const medico = lerJSON('medico')
  const atendente = lerJSON('atendente')
  if (atendente) {
    return {
      usuario_id: atendente.id || null, usuario_nome: atendente.nome || null,
      usuario_tipo: 'atendente', clinica_id: medico?.clinica_id || null,
      medico_id: atendente.medico_id || medico?.id || null,
    }
  }
  if (!medico) return null
  const tipo: TipoUsuarioAuditoria = medico.is_atendente ? 'atendente'
    : medico.cargo === 'recepcionista' ? 'recepcionista' : 'medico'
  return {
    usuario_id: medico.id || null, usuario_nome: medico.nome || null, usuario_tipo: tipo,
    clinica_id: medico.clinica_id || null, medico_id: tipo === 'medico' ? medico.id || null : null,
  }
}

function emModoDemo(): boolean {
  try { return new URLSearchParams(window.location.search).get('demo') === '1' } catch { return false }
}

/** true se já registrou essa mesma chave nos últimos 5 min (e marca agora se não). */
function jaRegistradoRecente(chave: string): boolean {
  const agora = Date.now()
  let cache: Record<string, number> = memoria
  try {
    const s = sessionStorage.getItem(CHAVE_CACHE)
    if (s) cache = { ...JSON.parse(s), ...memoria }
  } catch {}
  if (cache[chave] && agora - cache[chave] < JANELA_MS) return true
  // limpa entradas vencidas para o cache não crescer
  for (const k of Object.keys(cache)) if (agora - cache[k] >= JANELA_MS) delete cache[k]
  cache[chave] = agora
  memoria[chave] = agora
  try { sessionStorage.setItem(CHAVE_CACHE, JSON.stringify(cache)) } catch {}
  return false
}

export function registrarAcesso(params: {
  acao: AcaoAuditoria
  recurso: RecursoAuditoria
  recursoId?: string | null
  pacienteId?: string | null
  detalhes?: Record<string, any>
  /** Ignora a janela de 5 min (ex.: exclusão). */
  forcar?: boolean
}): void {
  try {
    if (typeof window === 'undefined' || emModoDemo()) return
    const usuario = usuarioAtualAuditoria()
    if (!usuario) return
    const recursoId = params.recursoId ?? null
    const chave = [usuario.usuario_id, params.acao, params.recurso, recursoId ?? params.pacienteId ?? ''].join('|')
    if (!params.forcar && jaRegistradoRecente(chave)) return

    fetch('/api/auditoria', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true, // sobrevive a navegação (ex.: abrir PDF / trocar de página)
      body: JSON.stringify({
        ...usuario,
        acao: params.acao,
        recurso: params.recurso,
        recurso_id: recursoId,
        paciente_id: params.pacienteId ?? null,
        detalhes: params.detalhes || {},
      }),
    }).catch(() => {})
  } catch {
    // auditoria nunca pode quebrar a tela
  }
}

// ── Rótulos para a interface ────────────────────────────────────────────────
export const ROTULO_ACAO: Record<AcaoAuditoria, string> = {
  visualizou: 'Visualizou', editou: 'Editou', exportou: 'Exportou', imprimiu: 'Imprimiu', excluiu: 'Excluiu',
}
export const ROTULO_RECURSO: Record<RecursoAuditoria, string> = {
  paciente: 'Ficha do paciente', consulta: 'Consulta', prontuario: 'Prontuário', exame: 'Exame', conversa: 'Conversa',
}
export const ROTULO_USUARIO: Record<TipoUsuarioAuditoria, string> = {
  medico: 'Médico', admin: 'Administrador', recepcionista: 'Recepção', atendente: 'Atendente',
}
