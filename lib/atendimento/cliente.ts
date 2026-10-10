'use client'
/**
 * Chamadas das telas de recepção, consultório, painel e configuração.
 *
 * Com ?demo=1 tudo roda no navegador (localStorage), inclusive entre abas:
 * chamar no consultório de uma aba faz a TV de outra aba (/painel/demo?demo=1) falar.
 */
import {
  hojeSP, nomeNoPainel, ordenarFila, prefixoSenha, prioridadePelaIdade,
  type Atendimento, type Consultorio, type Esperado, type Prioridade, type Setor,
} from './comum'

export const ehDemo = () => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('demo') === '1'

export type Fila = { dia: string; atendimentos: Atendimento[]; esperados: Esperado[]; medicos: { id: string; nome: string; consultorio_id: string | null }[] }
export type Config = { setores: Setor[]; consultorios: Consultorio[] }
export type Chamada = { id: string; senha: string; nome_exibicao: string | null; local: string; criado_em: string }
export type DadosPainel = { setor: { nome: string; voz: boolean; mensagem: string | null }; clinica: { nome: string | null; logo_url: string | null }; chamadas: Chamada[] }
export type AcaoMudar = 'iniciar' | 'finalizar' | 'ausente' | 'voltar_fila' | 'cancelar' | 'prioridade'

export class ErroApi extends Error {
  constructor(msg: string, public faltaMigration = false) { super(msg) }
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) } })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new ErroApi(d.error || 'Não foi possível concluir. Tente de novo.', !!d.falta_migration)
  return d as T
}
const post = <T,>(url: string, corpo: any, metodo = 'POST') => api<T>(url, { method: metodo, body: JSON.stringify(corpo) })

// ── Fila ─────────────────────────────────────────────────────────────────────

export async function carregarFila(medicoId?: string | null): Promise<Fila> {
  if (ehDemo()) return demo.fila(medicoId)
  return api<Fila>('/api/atendimento' + (medicoId ? `?medico_id=${medicoId}` : ''))
}

export async function checkin(p: { agendamento_id?: string; paciente_id?: string; medico_id?: string; prioridade?: Prioridade }) {
  if (ehDemo()) return demo.checkin(p)
  return post<{ atendimento: Atendimento; ja_existia: boolean }>('/api/atendimento', { acao: 'checkin', ...p })
}

export async function chamar(p: { medico_id: string; consultorio_id: string | null; atendimento_id?: string; rechamar?: boolean }) {
  if (ehDemo()) return demo.chamar(p)
  return post<{ atendimento: Atendimento | null; fila_vazia: boolean }>('/api/atendimento', { acao: 'chamar', ...p })
}

export async function mudar(id: string, para: AcaoMudar, extra: { prioridade?: Prioridade; retorno?: { dias: number; motivo?: string } | null } = {}) {
  if (ehDemo()) return demo.mudar(id, para, extra)
  return post<{ atendimento: Atendimento }>('/api/atendimento', { acao: 'mudar', id, para, ...extra })
}

// ── Recepção: paciente novo, dados, falta, lista de espera ──────────────────

export type PacienteResumo = { id: string; nome: string; telefone: string | null; cpf?: string | null; data_nascimento: string | null; convenio?: string | null }

export async function novoPaciente(d: { nome: string; telefone?: string; cpf?: string; data_nascimento?: string; convenio?: string; medico_id?: string }) {
  if (ehDemo()) {
    const p = { id: 'demo-pac-n' + Date.now(), nome: d.nome, telefone: d.telefone || null, cpf: d.cpf || null, data_nascimento: d.data_nascimento || null, convenio: d.convenio || null }
    PACIENTES_EXTRA.push(p as any)
    return { paciente: p as PacienteResumo, ja_existia: false }
  }
  return post<{ paciente: PacienteResumo; ja_existia: boolean }>('/api/atendimento', { acao: 'novo_paciente', ...d })
}

export async function atualizarPaciente(pacienteId: string, d: Partial<Record<'telefone' | 'cpf' | 'data_nascimento' | 'convenio' | 'nr_carteirinha', string>>) {
  if (ehDemo()) return { ok: true }
  return post<{ ok: true }>('/api/atendimento', { acao: 'atualizar_paciente', paciente_id: pacienteId, ...d })
}

export async function marcarFalta(agendamentoId: string) {
  if (ehDemo()) {
    const e = demo.estado(); e.esperados = e.esperados.filter(x => x.id !== agendamentoId); demo.gravar(e); return { ok: true }
  }
  return post<{ ok: true }>('/api/atendimento', { acao: 'faltou', agendamento_id: agendamentoId })
}

export async function entrarListaEspera(d: { medico_id: string; paciente_id?: string; nome: string; telefone?: string | null; preferencia_periodo: string; observacao?: string }) {
  if (ehDemo()) return { ok: true }
  return post('/api/lista-espera', { ...d, tipo: 'consulta', preferencia_dias: [1, 2, 3, 4, 5], prioridade: 0 })
}

export type Ficha = {
  paciente: { id: string; nome: string; telefone: string | null; data_nascimento: string | null; sexo: string | null; convenio: string | null; alergias: string | null; comorbidades: string | null; medicamentos_uso: string | null }
  consultas: { id: string; criado_em: string; data_hora: string | null; avaliacao: string | null; diagnostico_principal: string | null; plano: string | null; cids: any }[]
  agendamento: { motivo: string | null; tipo: string | null; pre_consulta_contexto: string | null } | null
}

export async function carregarFicha(pacienteId: string, agendamentoId?: string | null): Promise<Ficha> {
  if (ehDemo()) {
    await espera()
    const e = demo.estado()
    const p = [...e.esperados.map(x => x.paciente), ...PACIENTES_EXTRA].find(x => x?.id === pacienteId)
    const dias = (n: number) => new Date(Date.now() - n * 864e5).toISOString()
    return {
      paciente: { id: pacienteId, nome: p?.nome || 'Paciente', telefone: null, data_nascimento: p?.data_nascimento || null, sexo: null, convenio: 'Unimed', alergias: 'Dipirona', comorbidades: 'Hipertensão arterial', medicamentos_uso: 'Losartana 50 mg 1x/dia' },
      consultas: [
        { id: 'd1', criado_em: dias(42), data_hora: null, avaliacao: 'Hipertensão arterial controlada. Solicitados exames de rotina.', diagnostico_principal: 'Hipertensão essencial', plano: 'Manter losartana. Retorno com exames.', cids: [{ codigo: 'I10', descricao: 'Hipertensão essencial' }] },
        { id: 'd2', criado_em: dias(160), data_hora: null, avaliacao: 'Cefaleia tensional.', diagnostico_principal: 'Cefaleia tensional', plano: 'Analgesia e higiene do sono.', cids: [{ codigo: 'G44.2', descricao: 'Cefaleia tensional' }] },
      ],
      agendamento: { motivo: 'Retorno com exames', tipo: 'retorno', pre_consulta_contexto: 'Diz que a pressão tem ficado em 13x8. Dor de cabeça leve 2x na semana. Trouxe os exames de sangue.' },
    }
  }
  const q = new URLSearchParams({ ficha: pacienteId, ...(agendamentoId ? { agendamento_id: agendamentoId } : {}) })
  return api<Ficha>('/api/atendimento?' + q)
}

// ── Configuração ─────────────────────────────────────────────────────────────

export async function carregarConfig(): Promise<Config> {
  if (ehDemo()) { const e = demo.estado(); return { setores: e.setores, consultorios: e.consultorios } }
  return api<Config>('/api/atendimento/config')
}
export async function salvarConfig(metodo: 'POST' | 'PATCH', corpo: any): Promise<{ item: any }> {
  if (ehDemo()) return demo.salvarConfig(metodo, corpo)
  return post('/api/atendimento/config', corpo, metodo)
}
export async function excluirConfig(tipo: 'setor' | 'consultorio', id: string) {
  if (ehDemo()) return demo.excluirConfig(tipo, id)
  return api(`/api/atendimento/config?tipo=${tipo}&id=${id}`, { method: 'DELETE' })
}

// ── Painel ───────────────────────────────────────────────────────────────────

export async function carregarPainel(token: string): Promise<DadosPainel | null> {
  if (token === 'demo' || ehDemo()) return demo.painel()
  const r = await fetch(`/api/painel/${encodeURIComponent(token)}`, { cache: 'no-store' })
  if (r.status === 404) return null
  if (!r.ok) throw new Error('indisponivel')
  return r.json()
}

// Mudanças avisadas entre telas (a recepção atualiza quando o consultório chama, etc.)
export const EVENTO_FILA = 'c360:fila'
export const avisarFila = () => { if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENTO_FILA)) }

// ── Demonstração ─────────────────────────────────────────────────────────────

type EstadoDemo = Fila & Config & { chamadas: (Chamada & { setor_id: string })[]; contador: Record<string, number> }
const CHAVE = 'c360-demo-fila-v1'

const demo = {
  estado(): EstadoDemo {
    try {
      const salvo = JSON.parse(localStorage.getItem(CHAVE) || 'null')
      if (salvo?.dia === hojeSP()) return salvo
    } catch {}
    const e = semente()
    this.gravar(e)
    return e
  },
  gravar(e: EstadoDemo) {
    try { localStorage.setItem(CHAVE, JSON.stringify(e)) } catch {}
    avisarFila()
  },
  async fila(medicoId?: string | null): Promise<Fila> {
    await espera()
    const e = this.estado()
    const so = <T extends { medico_id: string }>(l: T[]) => (medicoId ? l.filter(x => x.medico_id === medicoId) : l)
    const comCheckin = new Set(e.atendimentos.map(a => a.agendamento_id))
    return { dia: e.dia, medicos: e.medicos, atendimentos: so(e.atendimentos), esperados: so(e.esperados).filter(x => !comCheckin.has(x.id)) }
  },
  async checkin(p: { agendamento_id?: string; paciente_id?: string; medico_id?: string; prioridade?: Prioridade }) {
    await espera()
    const e = this.estado()
    const ja = e.atendimentos.find(a => p.agendamento_id && a.agendamento_id === p.agendamento_id)
    if (ja) return { atendimento: ja, ja_existia: true }
    const ag = e.esperados.find(x => x.id === p.agendamento_id)
    const paciente = ag?.paciente || PACIENTES_EXTRA.find(x => x.id === p.paciente_id) || null
    const medicoId = ag?.medico_id || p.medico_id || e.medicos[0].id
    const prioridade = p.prioridade || prioridadePelaIdade(paciente?.data_nascimento)
    const pref = prefixoSenha(prioridade)
    e.contador[pref] = (e.contador[pref] || 0) + 1
    const med = e.medicos.find(m => m.id === medicoId)!
    const at: Atendimento = {
      id: 'demo-at-' + Date.now(), clinica_id: 'demo', medico_id: medicoId, paciente_id: paciente?.id || null,
      agendamento_id: ag?.id || null, setor_id: e.setores[0].id, consultorio_id: med.consultorio_id, dia: e.dia,
      senha: pref + String(e.contador[pref]).padStart(3, '0'), status: 'aguardando', prioridade,
      origem: ag ? 'recepcao' : 'encaixe', horario_previsto: ag?.data_hora || null, chegada_em: new Date().toISOString(),
      chamado_em: null, chamadas: 0, inicio_em: null, fim_em: null, observacao: null,
      paciente, medico: { id: med.id, nome: med.nome }, consultorio: e.consultorios.find(c => c.id === med.consultorio_id) || null,
    }
    e.atendimentos.push(at)
    this.gravar(e)
    return { atendimento: at, ja_existia: false }
  },
  async chamar(p: { medico_id: string; consultorio_id: string | null; atendimento_id?: string; rechamar?: boolean }) {
    await espera()
    const e = this.estado()
    const consultorio = e.consultorios.find(c => c.id === p.consultorio_id) || null
    const med = e.medicos.find(m => m.id === p.medico_id)
    if (med && consultorio) med.consultorio_id = consultorio.id
    const at = p.atendimento_id
      ? e.atendimentos.find(a => a.id === p.atendimento_id)
      : ordenarFila(e.atendimentos.filter(a => a.medico_id === p.medico_id && a.status === 'aguardando'))[0]
    if (!at) return { atendimento: null, fila_vazia: true }
    Object.assign(at, { status: 'chamado', chamado_em: new Date().toISOString(), chamadas: at.chamadas + 1, consultorio_id: consultorio?.id || at.consultorio_id, consultorio: consultorio ? { id: consultorio.id, nome: consultorio.nome } : at.consultorio })
    const setor = e.setores.find(s => s.id === (consultorio?.setor_id || at.setor_id)) || e.setores[0]
    e.chamadas.unshift({ id: 'demo-ch-' + Date.now(), setor_id: setor.id, senha: at.senha, nome_exibicao: nomeNoPainel(at.paciente?.nome, setor.painel_exibicao), local: at.consultorio?.nome || 'Consultório', criado_em: new Date().toISOString() })
    this.gravar(e)
    return { atendimento: at, fila_vazia: false }
  },
  async mudar(id: string, para: AcaoMudar, extra: { prioridade?: Prioridade }) {
    await espera()
    const e = this.estado()
    const at = e.atendimentos.find(a => a.id === id)
    if (!at) throw new ErroApi('Atendimento não encontrado.')
    const agora = new Date().toISOString()
    if (para === 'prioridade' && extra.prioridade) at.prioridade = extra.prioridade
    if (para === 'iniciar') Object.assign(at, { status: 'em_atendimento', inicio_em: agora })
    if (para === 'finalizar') Object.assign(at, { status: 'finalizado', fim_em: agora, inicio_em: at.inicio_em || agora })
    if (para === 'ausente') at.status = 'ausente'
    if (para === 'voltar_fila') at.status = 'aguardando'
    if (para === 'cancelar') at.status = 'cancelado'
    this.gravar(e)
    return { atendimento: at }
  },
  async salvarConfig(metodo: 'POST' | 'PATCH', b: any) {
    const e = this.estado()
    const lista: any[] = b.tipo === 'setor' ? e.setores : e.consultorios
    let item: any
    if (metodo === 'POST') {
      item = b.tipo === 'setor'
        ? { id: 'demo-setor-' + Date.now(), nome: b.nome, ordem: lista.length, ativo: true, painel_token: 'demo', painel_exibicao: 'senha_nome', painel_voz: true, painel_mensagem: null, avisar_whatsapp: true }
        : { id: 'demo-cons-' + Date.now(), setor_id: b.setor_id, nome: b.nome, ordem: lista.length, ativo: true }
      lista.push(item)
    } else {
      item = lista.find(x => x.id === b.id)
      const { tipo, id, novo_link, ...resto } = b
      Object.assign(item, resto)
    }
    this.gravar(e)
    return { item }
  },
  async excluirConfig(tipo: 'setor' | 'consultorio', id: string) {
    const e = this.estado()
    if (tipo === 'setor') { e.setores = e.setores.filter(s => s.id !== id); e.consultorios = e.consultorios.filter(c => c.setor_id !== id) }
    else e.consultorios = e.consultorios.filter(c => c.id !== id)
    this.gravar(e)
    return { ok: true }
  },
  async painel(): Promise<DadosPainel> {
    const e = this.estado()
    const s = e.setores[0]
    return {
      setor: { nome: s?.nome || 'Recepção', voz: s?.painel_voz ?? true, mensagem: s?.painel_mensagem || 'Aguarde ser chamado. Mantenha o celular por perto: avisamos pelo WhatsApp quando estiver chegando a sua vez.' },
      clinica: { nome: 'Clínica Demonstração', logo_url: null },
      chamadas: e.chamadas.filter(c => !s || c.setor_id === s.id).slice(0, 8),
    }
  },
}

const espera = () => new Promise(r => setTimeout(r, 180))

const PACIENTES_EXTRA = [
  { id: 'demo-pac-x1', nome: 'Rodrigo Teixeira Lima', telefone: null, data_nascimento: '1990-02-11' },
  { id: 'demo-pac-x2', nome: 'Helena Prado', telefone: null, data_nascimento: '1941-07-30' },
]
export const pacientesDemo = () => PACIENTES_EXTRA

function semente(): EstadoDemo {
  const dia = hojeSP()
  const hora = (h: number, m = 0) => new Date(`${dia}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00-03:00`).toISOString()
  const setores: Setor[] = [{ id: 'demo-setor-1', nome: 'Ambulatório — 2º andar', ordem: 0, ativo: true, painel_token: 'demo', painel_exibicao: 'senha_nome', painel_voz: true, painel_mensagem: null, avisar_whatsapp: true }]
  const consultorios: Consultorio[] = [1, 2, 3].map(n => ({ id: 'demo-cons-' + n, setor_id: 'demo-setor-1', nome: 'Consultório ' + n, ordem: n, ativo: true }))
  const medicos = [
    { id: 'demo-medico', nome: 'Dra. Helena Duarte', consultorio_id: 'demo-cons-1' },
    { id: 'demo-medico-2', nome: 'Dr. Marcos Vieira', consultorio_id: 'demo-cons-2' },
  ]
  const pac = (id: string, nome: string, nasc: string) => ({ id, nome, telefone: null, data_nascimento: nasc })
  const lista: [string, string, string, number, number, number][] = [
    ['Mariana Costa Ribeiro', '1988-04-12', 'Retorno — exames', 8, 0, 0],
    ['João Pereira Santos', '1957-09-03', 'Hipertensão', 8, 30, 0],
    ['Ana Beatriz Lima', '1995-12-20', 'Primeira consulta', 9, 0, 1],
    ['Antônia Ferreira', '1939-01-15', 'Retorno', 9, 30, 0],
    ['Carlos Eduardo Nunes', '1979-06-07', 'Dor lombar', 10, 0, 1],
    ['Fernanda Rocha Alves', '1992-03-28', 'Pré-natal', 10, 30, 0],
    ['Paulo Henrique Souza', '1966-11-02', 'Check-up', 11, 0, 1],
    ['Juliana Martins', '2001-08-19', 'Retorno', 13, 0, 0],
    ['Ricardo Alves Moreira', '1984-05-25', 'Primeira consulta', 13, 30, 1],
  ]
  const esperados: Esperado[] = lista.map(([nome, nasc, motivo, h, m, med], i) => ({
    id: 'demo-ag-' + i, data_hora: hora(h, m), medico_id: medicos[med].id, tipo: /Retorno/.test(motivo) ? 'retorno' : 'consulta',
    motivo, status: 'confirmado', paciente: pac('demo-pac-' + i, nome, nasc), medico: { id: medicos[med].id, nome: medicos[med].nome },
  }))
  return { dia, setores, consultorios, medicos, esperados, atendimentos: [], chamadas: [], contador: {} }
}
