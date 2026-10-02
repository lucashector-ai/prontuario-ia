import type { LucideIcon } from 'lucide-react'
import { ClipboardList, FilePenLine, ListChecks, MessageSquareHeart, FileText } from 'lucide-react'
import { tokens } from '@/lib/design-tokens'
import type { Template } from '@/lib/formularios/types'

/**
 * Tipo visual do formulário (Anamnese, Consentimento…). O banco não guarda esse
 * campo, então é inferido do nome/especialidade só para agrupar e colorir os cards.
 */
export type TipoFormulario = 'Anamnese' | 'Consentimento' | 'Pré-consulta' | 'Pesquisa' | 'Outros'

export const TIPOS_FORMULARIO: Record<TipoFormulario, { cor: string; icon: LucideIcon }> = {
  Anamnese: { cor: tokens.data.purple, icon: ClipboardList },
  Consentimento: { cor: tokens.data.blue, icon: FilePenLine },
  'Pré-consulta': { cor: tokens.data.green, icon: ListChecks },
  Pesquisa: { cor: tokens.data.orange, icon: MessageSquareHeart },
  Outros: { cor: tokens.data.pink, icon: FileText },
}

const norm = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

export function tipoDoTemplate(t: Pick<Template, 'nome' | 'especialidade' | 'descricao'>): TipoFormulario {
  const s = norm([t.nome, t.especialidade, t.descricao].filter(Boolean).join(' '))
  if (/consentimento|termo|autoriza/.test(s)) return 'Consentimento'
  if (/satisfacao|pesquisa|avaliacao do atendimento|nps|feedback/.test(s)) return 'Pesquisa'
  if (/pre-consulta|pre consulta|preconsulta|triagem|retorno|check-?in/.test(s)) return 'Pré-consulta'
  if (/anamnese|historico|ficha/.test(s)) return 'Anamnese'
  return 'Outros'
}

export function normalizarBusca(t: string) {
  return norm(t)
}
