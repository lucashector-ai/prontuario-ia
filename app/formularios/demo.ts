/**
 * Formulários do modo demonstração (lib/demo.ts): modelos, envios e respostas fictícios.
 * Nada é lido nem gravado no banco.
 */
import type { Campo, Template } from '@/lib/formularios/types'
import { MEDICO_DEMO, CLINICA_DEMO } from '@/lib/demo'
import { PACIENTES_DEMO } from '@/lib/demo-dados'

const diasAtras = (n: number, h = 10) => { const d = new Date(Date.now() - n * 864e5); d.setHours(h, 0, 0, 0); return d.toISOString() }

const ANAMNESE: Campo[] = [
  { id: 'queixa_principal', tipo: 'textarea', label: 'Qual o motivo da consulta?', obrigatorio: true },
  { id: 'inicio', tipo: 'select', label: 'Há quanto tempo?', obrigatorio: false, opcoes: ['Menos de 1 semana', '1 a 4 semanas', '1 a 6 meses', 'Mais de 6 meses'] },
  { id: 'doencas', tipo: 'multipla', label: 'Tem alguma destas condições?', obrigatorio: false, opcoes: ['Hipertensão', 'Diabetes', 'Asma', 'Colesterol alto', 'Nenhuma'] },
  { id: 'medicamentos', tipo: 'textarea', label: 'Remédios que usa hoje', obrigatorio: false },
  { id: 'alergia', tipo: 'sim_nao', label: 'Tem alergia a algum remédio?', obrigatorio: true },
  { id: 'dor', tipo: 'escala', label: 'De 0 a 10, quanto isso incomoda?', obrigatorio: false, min: 0, max: 10, passo: 1 },
]

const CONSENTIMENTO: Campo[] = [
  { id: 'ciente', tipo: 'sim_nao', label: 'Li e entendi as informações sobre o procedimento', obrigatorio: true },
  { id: 'autoriza_imagens', tipo: 'sim_nao', label: 'Autorizo o registro de imagens para o prontuário', obrigatorio: false },
  { id: 'data', tipo: 'data', label: 'Data', obrigatorio: true },
]

const PESQUISA: Campo[] = [
  { id: 'nota', tipo: 'escala', label: 'De 0 a 10, quanto você recomendaria a clínica?', obrigatorio: true, min: 0, max: 10, passo: 1 },
  { id: 'comentario', tipo: 'textarea', label: 'Quer deixar um comentário?', obrigatorio: false },
]

export const TEMPLATES_DEMO: Template[] = [
  { id: 'demo-form-1', clinica_id: CLINICA_DEMO.id, nome: 'Anamnese de primeira consulta', especialidade: 'Clínica médica', descricao: 'Histórico de saúde antes da primeira consulta', campos: ANAMNESE, publico: false, criado_em: diasAtras(120) },
  { id: 'demo-form-2', clinica_id: CLINICA_DEMO.id, nome: 'Pré-consulta de retorno', especialidade: null, descricao: 'Como o paciente está desde a última consulta', campos: ANAMNESE.slice(0, 2).concat(ANAMNESE[5]), publico: false, criado_em: diasAtras(90) },
  { id: 'demo-form-3', clinica_id: CLINICA_DEMO.id, nome: 'Termo de consentimento — pequenos procedimentos', especialidade: null, descricao: 'Autorização antes de procedimentos no consultório', campos: CONSENTIMENTO, publico: false, criado_em: diasAtras(60) },
  { id: 'demo-form-4', clinica_id: CLINICA_DEMO.id, nome: 'Pesquisa de satisfação', especialidade: null, descricao: 'Enviada no dia seguinte ao atendimento', campos: PESQUISA, publico: false, criado_em: diasAtras(30) },
]

type EnvioDemo = {
  id: string; template_id: string; nome_paciente: string; telefone: string | null; email: string | null; paciente_id: string
  status: 'pendente' | 'preenchido' | 'expirado'; enviado_em: string; preenchido_em: string | null; expira_em: string; origem: string
  respostas?: Record<string, any>; resumo_ia?: string
}

const p = (i: number) => PACIENTES_DEMO[i]
const ENVIOS: EnvioDemo[] = [
  { id: 'demo-envio-1', template_id: 'demo-form-1', nome_paciente: p(2).nome, telefone: p(2).telefone, email: p(2).email, paciente_id: p(2).id, status: 'preenchido', enviado_em: diasAtras(2, 9), preenchido_em: diasAtras(1, 20), expira_em: diasAtras(-5), origem: 'agenda_publica',
    respostas: { queixa_principal: 'Cansaço e dor de cabeça no fim do dia.', inicio: '1 a 4 semanas', doencas: ['Nenhuma'], medicamentos: 'Nenhum', alergia: true, dor: 4 },
    resumo_ia: 'Primeira consulta. Cansaço e cefaleia vespertina há 1 a 4 semanas, intensidade 4/10. Sem doenças crônicas nem medicamentos. Relata alergia a medicamento (dipirona no cadastro).' },
  { id: 'demo-envio-2', template_id: 'demo-form-2', nome_paciente: p(3).nome, telefone: p(3).telefone, email: p(3).email, paciente_id: p(3).id, status: 'preenchido', enviado_em: diasAtras(3, 9), preenchido_em: diasAtras(3, 15), expira_em: diasAtras(-4), origem: 'agendamento_interno',
    respostas: { queixa_principal: 'Retorno com os exames de sangue.', inicio: 'Mais de 6 meses', dor: 1 },
    resumo_ia: 'Retorno para mostrar exames. Sem queixas novas.' },
  { id: 'demo-envio-3', template_id: 'demo-form-1', nome_paciente: p(8).nome, telefone: p(8).telefone, email: p(8).email, paciente_id: p(8).id, status: 'pendente', enviado_em: diasAtras(0, 8), preenchido_em: null, expira_em: diasAtras(-7), origem: 'manual' },
  { id: 'demo-envio-4', template_id: 'demo-form-4', nome_paciente: p(0).nome, telefone: p(0).telefone, email: p(0).email, paciente_id: p(0).id, status: 'preenchido', enviado_em: diasAtras(34, 9), preenchido_em: diasAtras(34, 18), expira_em: diasAtras(27), origem: 'manual',
    respostas: { nota: 10, comentario: 'Atendimento pontual e muito atencioso.' }, resumo_ia: 'Nota 10. Elogio à pontualidade e à atenção.' },
  { id: 'demo-envio-5', template_id: 'demo-form-3', nome_paciente: p(6).nome, telefone: p(6).telefone, email: p(6).email, paciente_id: p(6).id, status: 'expirado', enviado_em: diasAtras(20, 9), preenchido_em: null, expira_em: diasAtras(13), origem: 'manual' },
]

/** Lista de envios no formato da aba "Envios". */
export const enviosDemo = () => ENVIOS.map(e => ({
  id: e.id, nome_paciente: e.nome_paciente, telefone: e.telefone, status: e.status, enviado_em: e.enviado_em,
  preenchido_em: e.preenchido_em, expira_em: e.expira_em, origem: e.origem,
  template: { nome: TEMPLATES_DEMO.find(t => t.id === e.template_id)?.nome || 'Formulário' },
}))

/** Envio + modelo + resposta (tela /formularios/respostas/[envioId]). */
export function respostaDemo(envioId: string) {
  const e = ENVIOS.find(x => x.id === envioId) || ENVIOS[0]
  const t = TEMPLATES_DEMO.find(x => x.id === e.template_id)!
  return {
    envio: { id: e.id, nome_paciente: e.nome_paciente, telefone: e.telefone, email: e.email, enviado_em: e.enviado_em, preenchido_em: e.preenchido_em, paciente_id: e.paciente_id, medico_id: MEDICO_DEMO.id },
    template: { id: t.id, nome: t.nome, descricao: t.descricao, campos: t.campos },
    resposta: e.respostas ? { id: 'demo-resp-' + e.id, respostas: e.respostas, resumo_ia: e.resumo_ia || null, preenchido_em: e.preenchido_em! } : null,
  }
}
