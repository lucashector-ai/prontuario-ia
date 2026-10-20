/**
 * Dados fictícios de "Minha clínica" e "Equipe" no modo demonstração (lib/demo.ts).
 * Nenhum dado real; nada é gravado.
 */
import { CLINICA_DEMO, MEDICO_DEMO } from '@/lib/demo'

const desde = (dias: number) => new Date(Date.now() - dias * 864e5).toISOString()

export const CLINICA_DEMO_COMPLETA = {
  ...CLINICA_DEMO,
  telefone: '(11) 3000-0000',
  endereco: 'Rua Exemplo, 100 - Centro, São Paulo/SP',
  site: 'www.clinicabemviver.exemplo.com.br',
  horarios: 'Seg-Sex 7h-19h, Sáb 8h-12h',
  descricao: 'Clínica médica com atendimento em clínica geral, cardiologia e pediatria. Convênios e particular.',
  criado_em: desde(540),
}

/** Equipe fictícia (ids iguais aos da Central de atendimento quando existem lá). */
export const EQUIPE_DEMO = [
  { ...MEDICO_DEMO, cargo: 'admin', especialidade: 'Clínica médica', crm: '123456', ativo: true, criado_em: desde(540) },
  { id: 'demo-medico-2', nome: 'Dr. Marcos Vieira', email: 'marcos.vieira@exemplo.com.br', cargo: 'medico', especialidade: 'Cardiologia', crm: '234567', crm_uf: 'SP', telefone: '(11) 90000-2002', clinica_id: CLINICA_DEMO.id, foto_url: null, ativo: true, criado_em: desde(400) },
  { id: 'demo-medico-3', nome: 'Dra. Paula Rezende', email: 'paula.rezende@exemplo.com.br', cargo: 'medico', especialidade: 'Pediatria', crm: '345678', crm_uf: 'SP', telefone: '(11) 90000-2003', clinica_id: CLINICA_DEMO.id, foto_url: null, ativo: true, criado_em: desde(210) },
  { id: 'demo-recep-1', nome: 'Ana Souza', email: 'ana.recepcao@exemplo.com.br', cargo: 'recepcionista', especialidade: null, crm: null, crm_uf: null, telefone: '(11) 90000-2004', clinica_id: CLINICA_DEMO.id, foto_url: null, ativo: true, criado_em: desde(380) },
  { id: 'demo-enf-1', nome: 'Cláudia Ramos', email: 'claudia.enfermagem@exemplo.com.br', cargo: 'enfermagem', especialidade: 'Enfermagem', crm: null, crm_uf: null, telefone: '(11) 90000-2005', clinica_id: CLINICA_DEMO.id, foto_url: null, ativo: true, criado_em: desde(150) },
]

export const PROCEDIMENTOS_DEMO = [
  { id: 'demo-proc-1', nome: 'Consulta clínica geral', duracao: 30, valor: 280, custo_insumos: 5, custo_operacional: 60, ativo: true },
  { id: 'demo-proc-2', nome: 'Consulta cardiológica', duracao: 40, valor: 380, custo_insumos: 5, custo_operacional: 70, ativo: true },
  { id: 'demo-proc-3', nome: 'Eletrocardiograma', duracao: 20, valor: 120, custo_insumos: 15, custo_operacional: 25, ativo: true },
  { id: 'demo-proc-4', nome: 'Retorno', duracao: 20, valor: 0, custo_insumos: 0, custo_operacional: 30, ativo: true },
  { id: 'demo-proc-5', nome: 'Consulta pediátrica', duracao: 30, valor: 300, custo_insumos: 5, custo_operacional: 60, ativo: true },
  { id: 'demo-proc-6', nome: 'Teste ergométrico', duracao: 45, valor: 350, custo_insumos: 30, custo_operacional: 90, ativo: false },
]

export const PACIENTES_TOTAL_DEMO = 1284
