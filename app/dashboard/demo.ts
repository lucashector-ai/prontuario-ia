/**
 * Números fictícios do Início no modo demonstração (lib/demo.ts). Nada vem do banco.
 * Os valores são estáveis para o mesmo período (semente pela data), então trocar de
 * período e voltar mostra os mesmos números.
 */
import { MEDICO_DEMO } from '@/lib/demo'
import { PACIENTES_DEMO } from '@/lib/demo-dados'

export const MEDICOS_DEMO = [
  { id: MEDICO_DEMO.id, nome: MEDICO_DEMO.nome },
  { id: 'demo-medico-2', nome: 'Dr. Marcos Vieira' },
]

type Serie = { presencial: number; retorno: number; tele: number; exame: number }

/** Pseudo-aleatório determinístico (0..1) a partir de um número. */
function rnd(seed: number) {
  const x = Math.sin(seed * 9301 + 49297) * 233280
  return x - Math.floor(x)
}

/** Quantidade de consultas num intervalo, proporcional aos dias úteis (≈ 16 por dia, 2 médicos). */
function volume(ini: Date, fim: Date, salt: number) {
  let total = 0
  const d = new Date(ini)
  const hoje = new Date()
  while (d < fim && d <= hoje) {
    const dow = d.getDay()
    if (dow !== 0) total += dow === 6 ? 5 : 14 + Math.round(rnd(d.getTime() / 864e5 + salt) * 5)
    d.setDate(d.getDate() + 1)
  }
  return total
}

export function dadosDashboardDemo(r: { ini: Date; fim: Date }, p: { ini: Date; fim: Date }, anoRef: number) {
  const cR = volume(r.ini, r.fim, 1), cP = volume(p.ini, p.fim, 1)
  const kpis = {
    consultas: [cR, cP],
    novos: [Math.round(cR * 0.18), Math.round(cP * 0.16)],
    tele: [Math.round(cR * 0.12), Math.round(cP * 0.1)],
    comparecimento: [cR ? 91 : null, cP ? 88 : null] as (number | null)[],
  }

  const porMes: Serie[] = Array.from({ length: 12 }, (_, m) => {
    const ini = new Date(anoRef, m, 1), fim = new Date(anoRef, m + 1, 1)
    const n = volume(ini, fim, 7)
    if (!n) return { presencial: 0, retorno: 0, tele: 0, exame: 0 }
    return { presencial: Math.round(n * 0.52), retorno: Math.round(n * 0.26), tele: Math.round(n * 0.12), exame: Math.round(n * 0.1) }
  })

  // Próximos atendimentos: a partir de agora, em horários redondos
  const proximos: any[] = []
  const base = new Date(); base.setMinutes(base.getMinutes() < 30 ? 30 : 60, 0, 0)
  const nomes = PACIENTES_DEMO.slice(0, 5)
  const tipos = ['consulta', 'retorno', 'consulta', 'exame', 'consulta']
  const motivos = ['Check-up anual', 'Retorno com exames', 'Dor lombar', 'Eletrocardiograma', 'Controle da pressão']
  nomes.forEach((pac, i) => {
    const d = new Date(base.getTime() + i * 45 * 60000)
    if (d.getHours() >= 19 || d.getHours() < 8) { d.setDate(d.getDate() + (d.getHours() >= 19 ? 1 : 0)); d.setHours(8 + i, 0, 0, 0) }
    proximos.push({
      id: 'demo-ag-dash-' + i, data_hora: d.toISOString(), tipo: tipos[i], status: i % 2 ? 'confirmado' : 'agendado',
      meet_link: null, motivo: motivos[i],
      medico_id: MEDICOS_DEMO[i % 2].id, pacientes: { nome: pac.nome },
    })
  })
  proximos.sort((a, b) => a.data_hora.localeCompare(b.data_hora))

  const esc = (x: number) => Math.max(0, Math.round(x * Math.max(cR, 1) / 300))
  const escP = (x: number) => Math.max(0, Math.round(x * Math.max(cP, 1) / 300))
  const cids = cR ? [
    { codigo: 'I10', descricao: 'Hipertensão essencial', n: esc(38), antes: escP(34) },
    { codigo: 'E11.9', descricao: 'Diabetes mellitus tipo 2', n: esc(24), antes: escP(26) },
    { codigo: 'Z00.0', descricao: 'Exame médico geral', n: esc(21), antes: escP(17) },
    { codigo: 'M54.5', descricao: 'Dor lombar baixa', n: esc(15), antes: escP(16) },
    { codigo: 'J45.9', descricao: 'Asma', n: esc(9), antes: escP(7) },
  ].filter(c => c.n > 0) : []

  const convenios = cR ? [
    { label: 'Unimed', n: Math.round(cR * 0.34) },
    { label: 'Particular', n: Math.round(cR * 0.26) },
    { label: 'Bradesco Saúde', n: Math.round(cR * 0.18) },
    { label: 'SulAmérica', n: Math.round(cR * 0.12) },
    { label: 'Outros', n: Math.round(cR * 0.1) },
  ] : []

  return { kpis, porMes, proximos, cids, convenios }
}
