/**
 * Modo demonstração de /pacientes e /pacientes/[id]: pacientes fictícios de lib/demo-dados.ts
 * no formato que as telas usam. Nada é gravado.
 */
import { MEDICO_DEMO } from '@/lib/demo'
import { PACIENTES_DEMO, pacienteDemo, consultasDemo, type PacienteDemo } from '@/lib/demo-dados'

const diasAtras = (n: number, h = 10) => { const d = new Date(Date.now() - n * 864e5); d.setHours(h, 0, 0, 0); return d.toISOString() }

/** Paciente no formato da tabela `pacientes`. */
export function pacienteRegistroDemo(p: PacienteDemo) {
  return {
    id: p.id, nome: p.nome, telefone: p.telefone, email: p.email, cpf: p.cpf, data_nascimento: p.data_nascimento,
    sexo: p.sexo === 'F' ? 'Feminino' : 'Masculino',
    convenio: p.convenio || 'Particular', nr_carteirinha: p.convenio ? '0012345678' : null,
    alergias: p.alergias, comorbidades: p.comorbidades, medicamentos_uso: p.medicamentos_uso,
    cidade: p.cidade, endereco: null, foto_url: null,
    medico_id: MEDICO_DEMO.id, clinica_id: MEDICO_DEMO.clinica_id, criado_em: p.criado_em,
    medico: { id: MEDICO_DEMO.id, nome: MEDICO_DEMO.nome.replace(/^Dra?\.\s*/, '') },
  }
}

export const pacientesListaDemo = () => PACIENTES_DEMO.map(pacienteRegistroDemo)

/** Ficha completa: paciente, consultas e agendamentos coerentes com o histórico. */
export function fichaDemo(id: string) {
  const p = pacienteDemo(id)
  if (!p) return null
  const consultas = consultasDemo(p).map(c => ({
    ...c, medicos: { nome: MEDICO_DEMO.nome }, transcricao: null, prescricao: null, exames_solicitados: null,
  }))
  const agendamentos: any[] = []
  if (p.ultimaHaDias != null) {
    agendamentos.push({ id: 'demo-ag-pass-' + p.id, paciente_id: p.id, medico_id: MEDICO_DEMO.id, data_hora: diasAtras(p.ultimaHaDias, 9), tipo: 'consulta', status: 'realizado', motivo: p.ultimoMotivo, duracao: '30' })
  }
  // Próximo compromisso: retorno para quem já consultou, primeira consulta para quem acabou de chegar
  agendamentos.push({
    id: 'demo-ag-prox-' + p.id, paciente_id: p.id, medico_id: MEDICO_DEMO.id, data_hora: diasAtras(-(5 + (p.nome.length % 9)), 9 + (p.nome.length % 7)),
    tipo: p.ultimaHaDias != null ? 'retorno' : 'consulta', status: 'agendado',
    motivo: p.ultimaHaDias != null ? 'Retorno — ' + (p.ultimoMotivo || 'acompanhamento') : 'Primeira consulta', duracao: '30',
  })
  return { paciente: pacienteRegistroDemo(p), consultas, agendamentos }
}
