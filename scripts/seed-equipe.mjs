/**
 * Equipe de teste para uma clínica existente: 3 médicos + 2 recepcionistas, pacientes
 * de teste (telefones com DDD 00, para nenhum WhatsApp chegar a ninguém) e agenda de
 * hoje e amanhã para os médicos novos.
 *
 *   ADMIN_EMAIL=dono@clinica.com node scripts/seed-equipe.mjs
 *
 * Idempotente: quem já existe (mesmo e-mail) só tem a senha redefinida.
 * As credenciais vão para contas-teste/credenciais.txt (fora do git).
 */
import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'node:crypto'
import { mkdirSync, writeFileSync, chmodSync } from 'node:fs'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL, KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || '').trim().toLowerCase()
if (!URL || !KEY || !ADMIN_EMAIL) { console.error('Faltam NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY ou ADMIN_EMAIL'); process.exit(1) }
const db = createClient(URL, KEY, { auth: { persistSession: false } })
const ok = (r, o) => { if (r.error) { console.error('Erro em', o, r.error.message); process.exit(1) } return r.data }

// Senha forte, igual para toda a equipe de teste (fácil de testar trocando de conta)
const SENHA = process.env.SENHA || ('Teste-' + randomBytes(6).toString('base64url') + '9!')

const { data: admin } = await db.from('clinica_admins').select('id, clinica_id, nome').eq('email', ADMIN_EMAIL).maybeSingle()
if (!admin?.clinica_id) { console.error('Clínica não encontrada para', ADMIN_EMAIL); process.exit(1) }
const CLINICA = admin.clinica_id
const { data: clinica } = await db.from('clinicas').select('nome').eq('id', CLINICA).single()

const EQUIPE = [
  { nome: 'Dra. Camila Torres', email: 'camila.torres.teste@clinical360.app', cargo: 'medico', especialidade: 'Cardiologia', crm: '154321-SP', cor: '#2F7DE1' },
  { nome: 'Dr. Rafael Nogueira', email: 'rafael.nogueira.teste@clinical360.app', cargo: 'medico', especialidade: 'Pediatria', crm: '154322-SP', cor: '#1F8A5B' },
  { nome: 'Dra. Patrícia Lemos', email: 'patricia.lemos.teste@clinical360.app', cargo: 'medico', especialidade: 'Ginecologia e Obstetrícia', crm: '154323-SP', cor: '#C2417A' },
  { nome: 'Juliana Recepção', email: 'juliana.recepcao.teste@clinical360.app', cargo: 'recepcionista' },
  { nome: 'Marcos Recepção', email: 'marcos.recepcao.teste@clinical360.app', cargo: 'recepcionista' },
]

const hash = await bcrypt.hash(SENHA, 10)
const criados = []
for (const p of EQUIPE) {
  const { data: existe } = await db.from('medicos').select('id').eq('email', p.email).maybeSingle()
  const campos = {
    nome: p.nome, email: p.email, cargo: p.cargo, especialidade: p.especialidade || null, crm: p.crm || null, cor: p.cor || '#6043C1',
    clinica_id: CLINICA, senha_hash: hash, senha_provisoria: false, ativo: true, verificado: true, onboarding_concluido: true,
  }
  const linha = existe
    ? ok(await db.from('medicos').update(campos).eq('id', existe.id).select('id, nome, cargo').single(), 'medicos(update)')
    : ok(await db.from('medicos').insert(campos).select('id, nome, cargo').single(), 'medicos(insert)')
  criados.push({ ...linha, email: p.email, novo: !existe })
}
const medicos = criados.filter(c => c.cargo === 'medico')

// ── Pacientes de teste (DDD 00) ─────────────────────────────────────────────
const NOMES = [
  ['Beatriz Andrade Lopes', 'F', '1990-04-18', 'Unimed', 'Asma', null],
  ['Otávio Ramos Pereira', 'M', '1948-09-02', 'Bradesco Saúde', 'Hipertensão; Diabetes tipo 2', 'Penicilina'],
  ['Luana Martins Rocha', 'F', '1996-12-11', 'Particular', null, null],
  ['Henrique Duarte Silva', 'M', '2016-06-25', 'Amil', null, 'Amendoim'],
  ['Sofia Carvalho Neves', 'F', '2019-02-14', 'Unimed', 'Rinite alérgica', null],
  ['Rosa Maria Fagundes', 'F', '1941-01-30', 'SulAmérica', 'Insuficiência cardíaca', 'Dipirona'],
  ['Gabriel Teixeira Mota', 'M', '1985-08-08', 'Particular', null, null],
  ['Larissa Campos Freitas', 'F', '1993-03-21', 'Bradesco Saúde', 'Gestante 28 semanas', null],
  ['Eduardo Pinheiro Costa', 'M', '1962-11-05', 'Unimed', 'Arritmia', null],
  ['Clara Bastos Ribeiro', 'F', '1999-07-09', 'Amil', null, 'Sulfa'],
  ['Antônio Gomes Batista', 'M', '1937-05-17', 'SulAmérica', 'DPOC', null],
  ['Manuela Souza Prado', 'F', '2012-10-03', 'Particular', null, null],
]
const { data: jaPac } = await db.from('pacientes').select('id, nome').in('nome', NOMES.map(n => n[0])).in('medico_id', medicos.map(m => m.id))
let pacientes = jaPac || []
const faltam = NOMES.filter(n => !pacientes.some(p => p.nome === n[0]))
if (faltam.length) {
  const novos = ok(await db.from('pacientes').insert(faltam.map(([nome, sexo, nasc, convenio, comorb, alergia], i) => ({
    nome, sexo, data_nascimento: nasc, convenio, comorbidades: comorb, alergias: alergia,
    telefone: `(00) 9${String(81000000 + i * 1111).slice(0, 4)}-${String(1000 + i).slice(-4)}`,
    medico_id: medicos[NOMES.findIndex(n => n[0] === nome) % medicos.length].id, clinica_id: CLINICA,
  }))).select('id, nome'), 'pacientes')
  pacientes = pacientes.concat(novos)
}

// ── Agenda: hoje (a partir da próxima hora) e amanhã ─────────────────────────
const diaSP = (d) => d.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
const hojeSP = diaSP(new Date())
const amanhaSP = diaSP(new Date(Date.now() + 864e5))
const em = (dia, h, m) => new Date(`${dia}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00-03:00`)
// Hoje: começa no próximo quarto de hora e segue de 20 em 20 min (dá para testar a qualquer hora)
const inicio = new Date(Math.ceil(Date.now() / (15 * 60e3)) * 15 * 60e3)
const motivos = ['Consulta de rotina', 'Retorno com exames', 'Dor no peito ao esforço', 'Febre há 3 dias', 'Pré-natal', 'Check-up anual', 'Tosse persistente', 'Palpitações']
const ags = []
medicos.forEach((m, mi) => {
  const meus = pacientes.filter((_, i) => i % medicos.length === mi)
  meus.forEach((p, i) => {
    const hoje = new Date(inicio.getTime() + (i * 20 + mi * 5) * 60e3)
    if (diaSP(hoje) === hojeSP) ags.push({ medico_id: m.id, paciente_id: p.id, data_hora: hoje.toISOString(), duracao: '20', tipo: i % 3 === 1 ? 'retorno' : 'consulta', status: i % 2 ? 'confirmado' : 'agendado', motivo: motivos[(i + mi) % motivos.length] })
    ags.push({ medico_id: m.id, paciente_id: p.id, data_hora: em(amanhaSP, 9 + i, mi * 10).toISOString(), duracao: '30', tipo: 'consulta', status: 'agendado', motivo: motivos[(i + mi + 3) % motivos.length] })
  })
})
// Não duplica se rodar de novo no mesmo dia
const { data: jaAg } = await db.from('agendamentos').select('paciente_id, data_hora').in('medico_id', medicos.map(m => m.id)).gte('data_hora', em(hojeSP, 0, 0).toISOString())
const chave = a => a.paciente_id + new Date(a.data_hora).toISOString().slice(0, 13)
const existentes = new Set((jaAg || []).map(chave))
const novosAg = ags.filter(a => !existentes.has(chave(a)))
if (novosAg.length) ok(await db.from('agendamentos').insert(novosAg), 'agendamentos')

// ── Credenciais (só local) ────────────────────────────────────────────────────
mkdirSync('contas-teste', { recursive: true })
const linhas = [
  `Clínica: ${clinica?.nome} (${ADMIN_EMAIL})`, `Login: https://clinical360.vercel.app/login`, `Senha de todos: ${SENHA}`, '',
  ...criados.map(c => `${c.cargo === 'medico' ? 'Médico      ' : 'Recepcionista'}  ${c.nome.padEnd(22)} ${c.email}`),
]
writeFileSync('contas-teste/credenciais.txt', linhas.join('\n') + '\n')
chmodSync('contas-teste/credenciais.txt', 0o600)

console.log(`Equipe: ${criados.map(c => `${c.nome} (${c.cargo}${c.novo ? ', nova' : ', senha redefinida'})`).join(' · ')}`)
console.log(`Pacientes de teste: ${pacientes.length} (${faltam.length} novos) · Agendamentos criados: ${novosAg.length}`)
console.log('Credenciais em contas-teste/credenciais.txt')
