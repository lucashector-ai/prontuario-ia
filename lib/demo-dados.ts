/**
 * Dados fictícios compartilhados pelo modo demonstração (lib/demo.ts).
 * Nomes, telefones e documentos são inventados — nenhum dado real.
 * Os ids `demo-pac-0…8` são os mesmos da Central de atendimento (lib/atendimento/cliente.ts),
 * então o mesmo paciente aparece igual na fila, na busca, na lista de pacientes e na ficha.
 */
import { MEDICO_DEMO } from '@/lib/demo'

export type PacienteDemo = {
  id: string
  nome: string
  telefone: string
  email: string | null
  data_nascimento: string
  sexo: 'F' | 'M'
  cpf: string
  convenio: string | null
  cidade: string
  comorbidades: string | null
  alergias: string | null
  medicamentos_uso: string | null
  /** dias atrás da última consulta (null = ainda não consultou) */
  ultimaHaDias: number | null
  /** motivo / diagnóstico da última consulta */
  ultimoMotivo: string | null
  medico_id: string
  criado_em: string
}

const diasAtras = (n: number) => new Date(Date.now() - n * 864e5).toISOString()

const P = (
  id: string, nome: string, telefone: string, data_nascimento: string, sexo: 'F' | 'M', convenio: string | null,
  comorbidades: string | null, alergias: string | null, medicamentos_uso: string | null,
  ultimaHaDias: number | null, ultimoMotivo: string | null, cadastroHaDias: number,
): PacienteDemo => ({
  id, nome, telefone, data_nascimento, sexo, convenio, comorbidades, alergias, medicamentos_uso, ultimaHaDias, ultimoMotivo,
  email: nome.split(' ')[0].normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase() + '@exemplo.com.br',
  cpf: '000.000.' + String(100 + Number(id.replace(/\D/g, '') || 0) * 7).padStart(3, '0') + '-00',
  cidade: 'São Paulo', medico_id: MEDICO_DEMO.id, criado_em: diasAtras(cadastroHaDias),
})

export const PACIENTES_DEMO: PacienteDemo[] = [
  P('demo-pac-0', 'Mariana Costa Ribeiro', '(11) 90000-1001', '1988-04-12', 'F', 'Unimed', null, null, null, 35, 'Check-up anual', 420),
  P('demo-pac-1', 'João Pereira Santos', '(11) 90000-1002', '1957-09-03', 'M', 'Bradesco Saúde', 'Hipertensão arterial', null, 'Losartana 50 mg 1x/dia', 42, 'Controle da pressão', 900),
  P('demo-pac-2', 'Ana Beatriz Lima', '(11) 90000-1003', '1995-12-20', 'F', null, null, 'Dipirona', null, null, null, 6),
  P('demo-pac-3', 'Antônia Ferreira', '(11) 90000-1004', '1939-01-15', 'F', 'SulAmérica', 'Diabetes tipo 2; hipertensão arterial', null, 'Metformina 850 mg 2x/dia; Anlodipino 5 mg', 28, 'Retorno com exames', 1300),
  P('demo-pac-4', 'Carlos Eduardo Nunes', '(11) 90000-1005', '1979-06-07', 'M', 'Unimed', null, null, null, 120, 'Dor lombar', 610),
  P('demo-pac-5', 'Fernanda Rocha Alves', '(11) 90000-1006', '1992-03-28', 'F', 'Amil', null, 'Penicilina', 'Ácido fólico 5 mg', 21, 'Pré-natal (20 semanas)', 200),
  P('demo-pac-6', 'Paulo Henrique Souza', '(11) 90000-1007', '1966-11-02', 'M', null, 'Dislipidemia', null, 'Sinvastatina 20 mg', 190, 'Check-up', 760),
  P('demo-pac-7', 'Juliana Martins', '(11) 90000-1008', '2001-08-19', 'F', 'Unimed', 'Asma leve', null, 'Salbutamol se necessário', 60, 'Crise de asma leve', 330),
  P('demo-pac-8', 'Ricardo Alves Moreira', '(11) 90000-1009', '1984-05-25', 'M', null, null, null, null, null, null, 2),
  P('demo-pac-x1', 'Rodrigo Teixeira Lima', '(11) 90000-1010', '1990-02-11', 'M', 'Porto Seguro Saúde', null, null, null, 75, 'Gastrite', 400),
  P('demo-pac-x2', 'Lourdes Prado', '(11) 90000-1011', '1941-07-30', 'F', 'SulAmérica', 'Osteoporose', 'Sulfa', 'Alendronato 70 mg 1x/semana', 14, 'Dor no joelho', 1500),
  P('demo-pac-9', 'Beatriz Alves Cardoso', '(11) 90000-1012', '1997-10-09', 'F', null, null, null, null, 260, 'Rinite alérgica', 520),
  P('demo-pac-10', 'Rafael Mendes Duarte', '(11) 90000-1013', '1975-01-22', 'M', 'Bradesco Saúde', 'Hipotireoidismo', null, 'Levotiroxina 75 mcg', 9, 'Ajuste de levotiroxina', 980),
  P('demo-pac-11', 'Lúcia Martins Oliveira', '(11) 90000-1014', '1960-04-03', 'F', 'Unimed', 'Hipertensão arterial', null, 'Enalapril 10 mg 2x/dia', 400, 'Controle da pressão', 1700),
]

export const pacienteDemo = (id: string | null | undefined) => PACIENTES_DEMO.find(p => p.id === id) || null

export const idadeDe = (nasc: string) => {
  const n = new Date(nasc), h = new Date()
  let i = h.getFullYear() - n.getFullYear()
  if (h.getMonth() < n.getMonth() || (h.getMonth() === n.getMonth() && h.getDate() < n.getDate())) i--
  return i
}

/** Busca simples (nome, telefone ou CPF) nos pacientes fictícios — usada pela busca ⌘K e listas. */
export function buscarPacientesDemo(termo: string, limite = 6): PacienteDemo[] {
  const sa = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const q = sa(termo.trim())
  const dig = termo.replace(/\D/g, '')
  if (!q) return PACIENTES_DEMO.slice(0, limite)
  return PACIENTES_DEMO.filter(p =>
    sa(p.nome).includes(q) || (dig.length >= 3 && (p.telefone.replace(/\D/g, '').includes(dig) || p.cpf.replace(/\D/g, '').includes(dig))),
  ).slice(0, limite)
}

/** Consultas fictícias de um paciente (SOAP coerente com o motivo da última consulta). */
export function consultasDemo(p: PacienteDemo) {
  if (p.ultimaHaDias == null) return []
  const quando = diasAtras(p.ultimaHaDias)
  const r = RESUMOS[p.ultimoMotivo || ''] || RESUMOS['Check-up']
  return [{
    id: 'demo-cons-' + p.id, paciente_id: p.id, medico_id: MEDICO_DEMO.id, criado_em: quando, data_hora: quando,
    motivo: p.ultimoMotivo, tipo: 'consulta', status: 'finalizada',
    subjetivo: r.s, objetivo: r.o, avaliacao: r.a, plano: r.p,
    diagnostico_principal: r.dx, cids: r.cid ? [{ codigo: r.cid, descricao: r.dx }] : [],
  }]
}

const RESUMOS: Record<string, { s: string; o: string; a: string; p: string; dx: string; cid: string | null }> = {
  'Check-up anual': { s: 'Sem queixas. Veio para avaliação de rotina.', o: 'PA 118/76 mmHg, FC 72 bpm. Exame físico sem alterações.', a: 'Paciente hígida.', p: 'Exames de rotina. Manter atividade física.', dx: 'Exame médico geral', cid: 'Z00.0' },
  'Check-up': { s: 'Sem queixas. Avaliação de rotina.', o: 'PA 124/80 mmHg. Exame físico sem alterações.', a: 'Sem achados relevantes.', p: 'Exames laboratoriais de rotina.', dx: 'Exame médico geral', cid: 'Z00.0' },
  'Controle da pressão': { s: 'Em uso regular da medicação. Nega dor no peito ou falta de ar.', o: 'PA 132/84 mmHg, FC 76 bpm.', a: 'Hipertensão arterial em acompanhamento.', p: 'Manter medicação. Retorno com exames.', dx: 'Hipertensão essencial', cid: 'I10' },
  'Retorno com exames': { s: 'Traz exames solicitados. Refere boa adesão à dieta.', o: 'Glicemia de jejum 128 mg/dL; HbA1c 7,1%.', a: 'Diabetes tipo 2 próximo da meta.', p: 'Manter metformina. Reforço de orientação alimentar.', dx: 'Diabetes mellitus tipo 2', cid: 'E11.9' },
  'Dor lombar': { s: 'Dor lombar há 10 dias após esforço, sem irradiação.', o: 'Lasègue negativo. Sem déficit neurológico.', a: 'Lombalgia mecânica.', p: 'Analgesia, calor local e alongamento. Reavaliar se piorar.', dx: 'Dor lombar baixa', cid: 'M54.5' },
  'Pré-natal (20 semanas)': { s: 'Gestação de 20 semanas, sem queixas. Movimentos fetais presentes.', o: 'PA 110/70 mmHg. Altura uterina compatível.', a: 'Gestação de baixo risco.', p: 'Manter ácido fólico. Ultrassom morfológico.', dx: 'Supervisão de gravidez normal', cid: 'Z34.9' },
  'Crise de asma leve': { s: 'Tosse e chiado há 2 dias, melhora com salbutamol.', o: 'Sibilos esparsos. SatO2 97%.', a: 'Asma leve, crise controlada.', p: 'Salbutamol se necessário. Orientado plano de ação.', dx: 'Asma', cid: 'J45.9' },
  'Gastrite': { s: 'Queimação no estômago após refeições há 3 semanas.', o: 'Dor leve à palpação do epigástrio.', a: 'Dispepsia.', p: 'Omeprazol por 4 semanas e orientação alimentar.', dx: 'Dispepsia', cid: 'K30' },
  'Dor no joelho': { s: 'Dor no joelho direito ao subir escadas.', o: 'Crepitação discreta, sem derrame.', a: 'Artrose de joelho.', p: 'Fisioterapia e analgesia. Raio-X do joelho.', dx: 'Gonartrose', cid: 'M17.9' },
  'Rinite alérgica': { s: 'Espirros e coriza pela manhã.', o: 'Mucosa nasal pálida.', a: 'Rinite alérgica.', p: 'Corticoide nasal e higiene do ambiente.', dx: 'Rinite alérgica', cid: 'J30.4' },
  'Ajuste de levotiroxina': { s: 'Cansaço leve. Em uso de levotiroxina.', o: 'TSH 5,8 mUI/L.', a: 'Hipotireoidismo com reposição insuficiente.', p: 'Ajustar levotiroxina para 88 mcg. TSH em 6 semanas.', dx: 'Hipotireoidismo', cid: 'E03.9' },
}
