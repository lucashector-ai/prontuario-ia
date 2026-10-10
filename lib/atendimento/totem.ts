/**
 * Totem de autoatendimento e senhas de balcão (servidor).
 *
 * O totem é público, aberto por link secreto (setores.totem_token) e só funciona com
 * totem_ativo. Mostra o mínimo (primeiro nome + inicial, hora, médico) e confere o CPF
 * de novo no check-in. Senhas de balcão (R001/RP001) são para quem chega sem horário.
 */
import { supabaseServidor as db } from '@/lib/servidor'
import { ErroAtendimento, fazerCheckin, medicosDaClinica, type Contexto } from './servidor'
import { cpfValido, hojeSP, limitesDoDiaSP, nomeMinimo, ordenarFila, type Prioridade } from './comum'

const soDigitos = (s?: string | null) => String(s || '').replace(/\D/g, '')

async function setorDoTotem(token: string) {
  if (!/^[a-f0-9]{24,64}$/i.test(token || '')) return null
  const { data } = await db.from('setores').select('id, clinica_id, nome, ativo, totem_ativo').eq('totem_token', token).maybeSingle()
  if (!data || !data.ativo || !data.totem_ativo) return null
  return data as { id: string; clinica_id: string; nome: string }
}

/** Contexto "do sistema" para o totem agir em nome da clínica dona do link. */
async function contextoDoTotem(setor: { id: string; clinica_id: string }): Promise<Contexto> {
  const { data: autonomo } = await db.from('medicos').select('id').eq('id', setor.clinica_id).maybeSingle()
  return { clinica: setor.clinica_id, usuario: setor.id, medicoId: autonomo ? autonomo.id : null, tipo: autonomo ? 'medico' : 'clinica' }
}

export async function dadosDoTotem(token: string) {
  const setor = await setorDoTotem(token)
  if (!setor) return null
  const { data: clinica } = await db.from('clinicas').select('nome, logo_url').eq('id', setor.clinica_id).maybeSingle()
  return { setor: setor.nome, clinica: clinica?.nome || null, logo_url: clinica?.logo_url || null }
}

/** Agendamentos de hoje do dono do CPF (dados mínimos para ele se reconhecer). */
export async function buscarNoTotem(token: string, cpf: string) {
  const setor = await setorDoTotem(token)
  if (!setor) throw new ErroAtendimento('Totem desativado.', 404)
  if (!cpfValido(cpf)) throw new ErroAtendimento('CPF inválido. Confira os números.')
  const ctx = await contextoDoTotem(setor)
  const ids = (await medicosDaClinica(ctx)).map((m: any) => m.id)
  if (!ids.length) return { agendamentos: [] }
  const d = soDigitos(cpf)
  const formatado = d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
  const { data: pacs } = await db.from('pacientes').select('id, nome').in('medico_id', ids).or(`cpf.eq.${d},cpf.eq.${formatado}`).limit(5)
  if (!pacs?.length) return { agendamentos: [] }
  const { de, ate } = limitesDoDiaSP(hojeSP())
  const { data: ags } = await db.from('agendamentos').select('id, data_hora, paciente_id, medico:medicos(nome)')
    .in('paciente_id', pacs.map(p => p.id)).in('medico_id', ids).gte('data_hora', de).lte('data_hora', ate)
    .not('status', 'in', '(cancelado,faltou,realizado)').order('data_hora')
  const { data: feitos } = (ags || []).length
    ? await db.from('atendimentos').select('agendamento_id, senha').in('agendamento_id', (ags || []).map((a: any) => a.id))
    : { data: [] as any[] }
  return {
    agendamentos: (ags || []).map((a: any) => ({
      id: a.id,
      hora: new Date(a.data_hora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }),
      medico: a.medico?.nome || null,
      paciente: nomeMinimo(pacs.find(p => p.id === a.paciente_id)?.nome),
      senha: (feitos || []).find((f: any) => f.agendamento_id === a.id)?.senha || null,
    })),
  }
}

/** Check-in pelo totem: confere o CPF de novo e gera a senha. */
export async function checkinNoTotem(token: string, cpf: string, agendamentoId: string, prioridade: Prioridade | null) {
  const setor = await setorDoTotem(token)
  if (!setor) throw new ErroAtendimento('Totem desativado.', 404)
  const { data: ag } = await db.from('agendamentos').select('id, paciente:pacientes(cpf)').eq('id', agendamentoId).maybeSingle()
  if (!ag || soDigitos((ag as any).paciente?.cpf) !== soDigitos(cpf)) throw new ErroAtendimento('Não encontramos este agendamento. Procure a recepção.', 404)
  const ctx = await contextoDoTotem(setor)
  const { atendimento, jaExistia } = await fazerCheckin(ctx, { agendamentoId, prioridade, origem: 'totem' })
  return { senha: atendimento.senha, ja_existia: jaExistia, medico: atendimento.medico?.nome || null, nome: nomeMinimo(atendimento.paciente?.nome), prioridade: atendimento.prioridade }
}

// ── Senhas de balcão ─────────────────────────────────────────────────────────

const PRIORIDADES_OK = ['normal', 'prioritario', 'prioritario_80', 'doador']

export async function senhaDeBalcao(token: string, prioridade: string, motivo: string) {
  const setor = await setorDoTotem(token)
  if (!setor) throw new ErroAtendimento('Totem desativado.', 404)
  return criarSenhaBalcao(setor.clinica_id, setor.id, prioridade, motivo, 'totem')
}

async function criarSenhaBalcao(clinica: string, setorId: string | null, prioridade: string, motivo: string, origem: string) {
  const prio = PRIORIDADES_OK.includes(prioridade) ? prioridade : 'normal'
  const dia = hojeSP()
  const { data: senha, error } = await db.rpc('c360_proxima_senha', { p_clinica: clinica, p_dia: dia, p_prefixo: prio === 'normal' ? 'R' : 'RP' })
  if (error) throw error
  const { error: e2 } = await db.from('senhas_balcao').insert({ clinica_id: clinica, setor_id: setorId, dia, senha, prioridade: prio, motivo: String(motivo || 'sem_horario').slice(0, 40), origem })
  if (e2) throw e2
  const { count } = await db.from('senhas_balcao').select('id', { count: 'exact', head: true }).eq('clinica_id', clinica).eq('dia', dia).eq('status', 'aguardando')
  return { senha: senha as string, na_frente: Math.max(0, (count || 1) - 1) }
}

/** Fila do balcão para a recepção (hoje). Sem a migration 0021, lista vazia. */
export async function balcaoDoDia(ctx: Contexto) {
  const { data, error } = await db.from('senhas_balcao').select('*').eq('clinica_id', ctx.clinica).eq('dia', hojeSP())
    .in('status', ['aguardando', 'chamado']).order('criado_em')
  if (error) return []
  const lista = (data || []).map((s: any) => ({ ...s, horario_previsto: null, chegada_em: s.criado_em }))
  return [...ordenarFila(lista.filter((s: any) => s.status === 'aguardando')), ...lista.filter((s: any) => s.status === 'chamado')]
}

/** Recepção chama a próxima senha de balcão (ou uma específica) — vai para a TV. */
export async function chamarBalcao(ctx: Contexto, p: { id?: string | null; guiche?: string | null }) {
  const guiche = String(p.guiche || 'Recepção').slice(0, 40)
  for (let t = 0; t < 5; t++) {
    let alvo: any = null
    if (p.id) {
      const { data } = await db.from('senhas_balcao').select('*').eq('id', p.id).eq('clinica_id', ctx.clinica).maybeSingle()
      alvo = data
    } else {
      alvo = (await balcaoDoDia(ctx)).find((s: any) => s.status === 'aguardando')
    }
    if (!alvo) return null
    const { data } = await db.from('senhas_balcao').update({ status: 'chamado', chamado_em: new Date().toISOString(), guiche })
      .eq('id', alvo.id).in('status', p.id ? ['aguardando', 'chamado'] : ['aguardando']).select('*').maybeSingle()
    if (data) {
      let setorId = data.setor_id
      if (!setorId) {
        const { data: s } = await db.from('setores').select('id').eq('clinica_id', ctx.clinica).eq('ativo', true).order('ordem').limit(1)
        setorId = s?.[0]?.id || null
      }
      await db.from('chamadas_painel').insert({ clinica_id: ctx.clinica, setor_id: setorId, senha: data.senha, nome_exibicao: null, local: guiche })
      return data
    }
    if (p.id) throw new ErroAtendimento('Esta senha já foi chamada.', 409)
  }
  throw new ErroAtendimento('Fila disputada agora. Tente de novo.', 409)
}

export async function concluirBalcao(ctx: Contexto, id: string, status: 'atendido' | 'desistiu') {
  const { data, error } = await db.from('senhas_balcao').update({ status, atendido_em: new Date().toISOString(), atendido_por: ctx.usuario })
    .eq('id', id).eq('clinica_id', ctx.clinica).select('id').maybeSingle()
  if (error) throw error
  if (!data) throw new ErroAtendimento('Senha não encontrada.', 404)
}

/** A recepção também pode tirar senha de balcão (ex.: paciente na fila do telefone). */
export async function senhaBalcaoManual(ctx: Contexto, prioridade: string) {
  return criarSenhaBalcao(ctx.clinica, null, prioridade, 'balcao', 'recepcao')
}
