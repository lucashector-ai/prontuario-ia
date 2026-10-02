// Cria uma conta de teste com clínica, pacientes, agenda (passada e futura), prontuários,
// retornos, lista de espera e convênios.
//
//   EMAIL=voce@exemplo.com SENHA='...' node scripts/seed-teste.mjs
//
// Telefones dos pacientes usam DDD 00 (inexistente) para nenhuma automação mandar
// WhatsApp a pessoas reais. Usa SUPABASE_SERVICE_ROLE_KEY do .env.local.
import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'

const env = Object.fromEntries(
  fs.readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter(l => /^[A-Z_]+=/.test(l))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).trim().replace(/^"|"$/g, '')] }),
)
const EMAIL = (process.env.EMAIL || '').trim().toLowerCase()
const SENHA = process.env.SENHA || ''
const NOME_MEDICO = process.env.NOME_MEDICO || 'Dr. Lucas Hector'
const NOME_CLINICA = process.env.NOME_CLINICA || 'Clínica Clinical 360'
if (!EMAIL || !SENHA) { console.error('Informe EMAIL e SENHA'); process.exit(1) }

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const ok = (r, o) => { if (r.error) { console.error(`Erro em ${o}:`, r.error.message); process.exit(1) } return r.data }

// ── Conta ────────────────────────────────────────────────────────────────
const { data: existe } = await db.from('medicos').select('id').ilike('email', EMAIL).maybeSingle()
const { data: admin } = await db.from('clinica_admins').select('id, clinica_id').ilike('email', EMAIL).maybeSingle()
if (existe) { console.error('Já existe um médico com esse e-mail — nada foi alterado.'); process.exit(1) }

let clinica, medico
if (admin) {
  // Conta de administrador já existe: atualiza a senha e preenche a clínica dela
  ok(await db.from('clinica_admins').update({ senha_hash: await bcrypt.hash(SENHA, 10), ativo: true }).eq('id', admin.id), 'clinica_admins')
  clinica = ok(await db.from('clinicas').select().eq('id', admin.clinica_id).single(), 'clinicas')
  const { data: meds } = await db.from('medicos').select().eq('clinica_id', clinica.id).eq('ativo', true).order('criado_em')
  medico = meds?.[0]
  if (!medico) {
    medico = ok(await db.from('medicos').insert({
      clinica_id: clinica.id, nome: NOME_MEDICO, email: null, especialidade: 'Clínica Médica',
      cargo: 'medico', ativo: true, verificado: true, onboarding_concluido: true,
    }).select().single(), 'medicos')
  }
} else {
  clinica = ok(await db.from('clinicas').insert({
    nome: NOME_CLINICA, tipo: 'autonomo', telefone: '(00) 3000-0000',
    endereco: 'Av. Paulista, 1000 — São Paulo/SP', horarios: 'Seg a Sex 8h–18h',
  }).select().single(), 'clinicas')
  medico = ok(await db.from('medicos').insert({
    clinica_id: clinica.id, nome: NOME_MEDICO, email: EMAIL,
    senha_hash: await bcrypt.hash(SENHA, 10), crm: '123456', especialidade: 'Clínica Médica',
    empresa_nome: clinica.nome, cargo: 'admin', ativo: true, verificado: true, onboarding_concluido: true,
  }).select().single(), 'medicos')
}

// ── Pacientes ────────────────────────────────────────────────────────────
const P = [
  ['Ana Beatriz Souza', 'F', '1988-03-14', 'Unimed', 'Hipertensão', 'Dipirona'],
  ['Carlos Eduardo Lima', 'M', '1975-07-22', 'Particular', 'Diabetes tipo 2', null],
  ['Fernanda Oliveira', 'F', '1992-11-02', 'Bradesco Saúde', null, null],
  ['João Pedro Martins', 'M', '2001-01-30', 'Particular', 'Asma', null],
  ['Mariana Albuquerque', 'F', '1969-05-18', 'SulAmérica', 'Hipotireoidismo', 'Penicilina'],
  ['Rafael Nogueira', 'M', '1983-09-09', 'Unimed', null, null],
  ['Juliana Ferreira Costa', 'F', '1995-12-24', 'Amil', 'Enxaqueca', null],
  ['Roberto Almeida', 'M', '1958-02-11', 'Bradesco Saúde', 'Hipertensão, dislipidemia', null],
  ['Patrícia Ramos', 'F', '1979-06-05', 'Particular', null, 'Sulfa'],
  ['Thiago Alves', 'M', '1990-04-17', 'Unimed', null, null],
  ['Luiza Barros', 'F', '1986-08-28', 'SulAmérica', 'Ansiedade', null],
  ['Eduardo Pires', 'M', '1972-10-13', 'Amil', 'Gota', null],
  ['Camila Torres', 'F', '1998-02-08', 'Particular', null, null],
  ['Marcos Vinícius Andrade', 'M', '1965-12-01', 'Unimed', 'Diabetes tipo 2, hipertensão', null],
  ['Beatriz Nogueira', 'F', '2004-07-19', 'Bradesco Saúde', null, null],
  ['Gustavo Henrique Reis', 'M', '1980-03-03', 'Particular', 'Lombalgia crônica', null],
  ['Isabela Moura', 'F', '1993-09-25', 'Unimed', null, 'Ibuprofeno'],
  ['Antônio Carlos Silva', 'M', '1950-11-11', 'SulAmérica', 'DPOC', null],
]
const pacientes = ok(await db.from('pacientes').insert(P.map(([nome, sexo, nasc, convenio, comorb, alergia], i) => ({
  medico_id: medico.id, clinica_id: clinica.id, nome, sexo, data_nascimento: nasc, convenio,
  nr_carteirinha: convenio === 'Particular' ? null : String(10000000000000 + i * 7919).slice(0, 14),
  telefone: `(00) 9${String(8000 + i).padStart(4, '0')}-${String(1000 + i * 37).slice(-4)}`,
  email: nome.split(' ')[0].toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '') + '.teste@exemplo.com',
  comorbidades: comorb, alergias: alergia,
  criado_em: new Date(Date.now() - (120 - i * 4) * 864e5).toISOString(),
}))).select(), 'pacientes')

// ── Agenda ───────────────────────────────────────────────────────────────
const MOTIVOS = ['Check-up anual', 'Dor de cabeça recorrente', 'Controle de pressão', 'Resultado de exames',
  'Dor lombar', 'Tosse persistente', 'Controle de glicemia', 'Renovação de receita', 'Cansaço e indisposição', 'Dor no ombro']
let semente = 7
const rnd = () => (semente = (semente * 16807) % 2147483647) / 2147483647
const escolher = a => a[Math.floor(rnd() * a.length)]

const ags = []
const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
for (let d = -45; d <= 21; d++) {
  const dia = new Date(hoje); dia.setDate(dia.getDate() + d)
  if (dia.getDay() === 0 || dia.getDay() === 6) continue
  const horas = [8, 9, 10, 11, 14, 15, 16, 17].filter(() => rnd() < (d < 0 ? 0.45 : 0.4))
  for (const h of horas) {
    const quando = new Date(dia); quando.setHours(h, rnd() < 0.5 ? 0 : 30, 0, 0)
    const passado = quando.getTime() < Date.now()
    const tipo = rnd() < 0.25 ? 'retorno' : rnd() < 0.1 ? 'exame' : 'consulta'
    const r = rnd()
    const status = passado ? (r < 0.78 ? 'realizado' : r < 0.9 ? 'faltou' : 'cancelado')
      : (d <= 2 ? (r < 0.5 ? 'confirmado' : 'agendado') : (r < 0.2 ? 'confirmado' : 'agendado'))
    const emBreve = !passado && quando.getTime() - Date.now() < 48 * 3600e3
    ags.push({
      medico_id: medico.id, paciente_id: escolher(pacientes).id, data_hora: quando.toISOString(),
      duracao: '30', tipo, status, motivo: escolher(MOTIVOS),
      confirmacao_24h_enviada: emBreve && status === 'agendado' ? rnd() < 0.6 : false,
      confirmacao_24h_status: status === 'confirmado' ? 'confirmado' : null,
      lembrete_48h_enviado: emBreve, confirmado_via: status === 'confirmado' ? (rnd() < 0.7 ? 'whatsapp' : 'manual') : null,
      confirmado_em: status === 'confirmado' ? new Date(quando.getTime() - 20 * 3600e3).toISOString() : null,
    })
  }
}
const agendamentos = ok(await db.from('agendamentos').insert(ags).select('id, paciente_id, data_hora, status, tipo, motivo'), 'agendamentos')

// ── Prontuários das consultas realizadas ────────────────────────────────
const SOAP = {
  'Controle de pressão': ['Paciente refere cefaleia occipital ocasional. Uso regular de losartana 50 mg.', 'PA 142/90 mmHg, FC 78 bpm. Ausculta cardíaca sem alterações.', 'Hipertensão arterial sistêmica com controle parcial.', 'Aumentar losartana para 100 mg/dia. MAPA em 30 dias. Retorno em 30 dias.', [{ codigo: 'I10', descricao: 'Hipertensão essencial (primária)' }]],
  'Controle de glicemia': ['Refere poliúria leve. Adesão irregular à dieta.', 'Glicemia capilar 182 mg/dL. Peso 88 kg, IMC 29,4.', 'Diabetes mellitus tipo 2 descompensado.', 'Ajustar metformina para 850 mg 2x/dia. Solicitar HbA1c. Retorno em 60 dias.', [{ codigo: 'E11', descricao: 'Diabetes mellitus tipo 2' }]],
  'Dor lombar': ['Dor lombar há 3 semanas, piora ao levantar peso. Sem irradiação.', 'Lasègue negativo. Contratura paravertebral à direita.', 'Lombalgia mecânica.', 'Fisioterapia 10 sessões, analgésico se dor. Retorno em 30 dias.', [{ codigo: 'M54.5', descricao: 'Dor lombar baixa' }]],
  'Tosse persistente': ['Tosse seca há 4 semanas, sem febre. Não fumante.', 'Ausculta pulmonar com sibilos esparsos. SatO2 97%.', 'Tosse crônica — investigar hiper-reatividade brônquica.', 'Radiografia de tórax e espirometria. Retorno com exames em 15 dias.', [{ codigo: 'R05', descricao: 'Tosse' }]],
}
const realizados = agendamentos.filter(a => a.status === 'realizado')
const consultas = ok(await db.from('consultas').insert(realizados.map(a => {
  const s = SOAP[a.motivo] || ['Paciente comparece para ' + a.motivo.toLowerCase() + '. Sem queixas agudas.', 'Bom estado geral, sinais vitais estáveis.', 'Avaliação clínica sem alterações relevantes.', 'Orientações gerais. Manter acompanhamento.', [{ codigo: 'Z00.0', descricao: 'Exame médico geral' }]]
  return {
    medico_id: medico.id, paciente_id: a.paciente_id, data_hora: a.data_hora, criado_em: a.data_hora,
    subjetivo: s[0], objetivo: s[1], avaliacao: s[2], plano: s[3], cids: s[4],
    transcricao: 'Transcrição de exemplo (dados de teste).',
  }
})).select('id, paciente_id, criado_em, plano'), 'consultas')

// ── Retornos ────────────────────────────────────────────────────────────
const dia = n => { const d = new Date(hoje); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }
const ret = consultas.filter(c => /Retorno em/.test(c.plano || '')).slice(0, 8)
const situacoes = [[-6, 'pendente'], [-2, 'lembrado'], [3, 'pendente'], [5, 'pendente'], [10, 'pendente'], [14, 'lembrado'], [20, 'pendente'], [-12, 'pendente']]
if (ret.length) ok(await db.from('retornos').insert(ret.map((c, i) => ({
  medico_id: medico.id, paciente_id: c.paciente_id, consulta_id: c.id, data_prevista: dia(situacoes[i][0]),
  motivo: (c.plano.match(/^[^.]+/) || ['Reavaliação'])[0], origem: 'ia', status: situacoes[i][1],
  lembrete_enviado_em: situacoes[i][1] === 'lembrado' ? new Date(Date.now() - 2 * 864e5).toISOString() : null,
}))), 'retornos')

// ── Lista de espera ─────────────────────────────────────────────────────
ok(await db.from('lista_espera').insert([
  { medico_id: medico.id, paciente_id: pacientes[12].id, nome: pacientes[12].nome, telefone: pacientes[12].telefone, tipo: 'consulta', preferencia_dias: [], preferencia_periodo: 'manha', prioridade: 1, observacao: 'Quer o primeiro horário que abrir' },
  { medico_id: medico.id, paciente_id: pacientes[15].id, nome: pacientes[15].nome, telefone: pacientes[15].telefone, tipo: 'retorno', preferencia_dias: [1, 3, 5], preferencia_periodo: 'tarde', prioridade: 0 },
  { medico_id: medico.id, paciente_id: null, nome: 'Renata Campos', telefone: '(00) 98777-1234', tipo: 'consulta', preferencia_dias: [], preferencia_periodo: 'qualquer', prioridade: 2, observacao: 'Dor abdominal — encaixe urgente' },
]), 'lista_espera')

// ── Convênios (faturamento TISS) ─────────────────────────────────────────
const ops = ok(await db.from('operadoras').insert([
  { clinica_id: clinica.id, medico_id: medico.id, nome: 'Unimed', registro_ans: '000001', codigo_prestador: '123456', nome_contratado: clinica.nome, prazo_pagamento_dias: 30 },
  { clinica_id: clinica.id, medico_id: medico.id, nome: 'Bradesco Saúde', registro_ans: '000002', codigo_prestador: '654321', nome_contratado: clinica.nome, prazo_pagamento_dias: 45 },
]).select(), 'operadoras')
ok(await db.from('tabela_precos').insert(ops.flatMap(o => [
  { operadora_id: o.id, codigo_tuss: '10101012', descricao: 'Consulta em consultório', valor: o.nome === 'Unimed' ? 120 : 140 },
  { operadora_id: o.id, codigo_tuss: '40304361', descricao: 'Hemograma completo', valor: 18 },
])), 'tabela_precos')

// ── Confirmações ligadas (sem WhatsApp configurado nada é enviado) ───────
await db.from('confirmacao_config').upsert({ medico_id: medico.id }, { onConflict: 'medico_id', ignoreDuplicates: true })

const futuros = agendamentos.filter(a => new Date(a.data_hora) > new Date()).length
console.log(JSON.stringify({
  conta: EMAIL, clinica: clinica.nome, medico: medico.nome, pacientes: pacientes.length,
  agendamentos: agendamentos.length, futuros, realizados: realizados.length,
  faltas: agendamentos.filter(a => a.status === 'faltou').length, consultas: consultas.length, retornos: ret.length,
}, null, 2))
