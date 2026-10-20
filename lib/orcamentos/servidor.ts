/**
 * Orçamentos digitais (migration 0030). A recepção monta a partir dos procedimentos, envia pelo
 * WhatsApp com o link do portal do paciente e ele aprova lá (aceite eletrônico simples:
 * nome, data/hora, IP, navegador e hash do conteúdo). Expirado = validade passou sem resposta
 * (calculado na leitura). Tudo com service role, sempre partindo da clínica da sessão ou do token.
 */
import { createHash } from 'crypto'
import { supabaseServidor as db } from '@/lib/servidor'
import { ErroAtendimento } from '@/lib/atendimento/servidor'
import { medicoDaClinica, type Contexto } from '@/lib/acesso'
import { FILTRO_APOIO } from '@/lib/cargos'
import { linkDoPortalDoPaciente } from '@/lib/portal/link'
import { statusVisivel, totalDe, type ItemOrcamento } from './calculos'
export * from './calculos'

const arred = (n: number) => Math.round(n * 100) / 100

export function chaveDaSessao(ctx: Contexto) {
  const chave = ctx.clinica_id || ctx.medico_id
  if (!chave) throw new ErroAtendimento('Sessão sem clínica.', 403)
  return chave
}

/** Status mostrado: rascunho/enviado/visto com validade vencida viram "expirado". */
async function pacienteDaClinica(ctx: Contexto, pacienteId: string) {
  const { data: p } = await db.from('pacientes').select('id, nome, telefone, clinica_id, medico_id').eq('id', pacienteId).maybeSingle()
  const pa: any = p
  const ok = pa && ((ctx.clinica_id && pa.clinica_id === ctx.clinica_id) || (ctx.medico_id && pa.medico_id === ctx.medico_id)
    || (ctx.clinica_id && pa.medico_id && (await medicoDaClinica(pa.medico_id, ctx.clinica_id))))
  if (!ok) throw new ErroAtendimento('Paciente não encontrado.', 404)
  return pa as { id: string; nome: string; telefone: string | null }
}

async function orcamentoDaClinica(ctx: Contexto, id: string) {
  const { data } = await db.from('orcamentos').select('*').eq('id', id).eq('clinica_chave', chaveDaSessao(ctx)).maybeSingle()
  if (!data) throw new ErroAtendimento('Orçamento não encontrado.', 404)
  return data as any
}

const SELECT_LISTA = 'id, numero, status, validade, total, desconto, condicoes, condicao_escolhida, observacoes, enviado_em, visto_em, respondido_em, motivo_recusa, agendado, criado_em, paciente_id, medico_id, paciente:pacientes(nome, telefone), itens:orcamento_itens(id, procedimento_id, descricao, quantidade, valor_unitario, ordem)'

export async function listarOrcamentos(ctx: Contexto, filtro: { pacienteId?: string | null } = {}) {
  let q = db.from('orcamentos').select(SELECT_LISTA).eq('clinica_chave', chaveDaSessao(ctx)).order('criado_em', { ascending: false }).limit(300)
  if (filtro.pacienteId) q = q.eq('paciente_id', filtro.pacienteId)
  const { data, error } = await q
  if (error) throw error
  return (data || []).map((o: any) => ({ ...o, status_visivel: statusVisivel(o), itens: (o.itens || []).sort((a: any, b: any) => a.ordem - b.ordem) }))
}

/** Cria ou atualiza (só rascunho/enviado/visto/expirado podem mudar). */
export async function salvarOrcamento(ctx: Contexto, b: {
  id?: string; paciente_id: string; medico_id?: string | null; itens: ItemOrcamento[]; desconto?: number
  validade?: string; condicoes?: string[]; observacoes?: string | null
}) {
  const chave = chaveDaSessao(ctx)
  await pacienteDaClinica(ctx, b.paciente_id)
  const itens = (b.itens || []).map(i => ({
    procedimento_id: i.procedimento_id || null, descricao: String(i.descricao || '').trim().slice(0, 200),
    quantidade: Math.max(0.01, Number(i.quantidade) || 1), valor_unitario: Math.max(0, arred(Number(i.valor_unitario) || 0)),
  })).filter(i => i.descricao)
  if (!itens.length) throw new ErroAtendimento('Inclua pelo menos um item.', 422)
  const desconto = Math.max(0, arred(Number(b.desconto) || 0))
  const { total } = totalDe(itens, desconto)
  const validade = /^\d{4}-\d{2}-\d{2}$/.test(b.validade || '') ? b.validade! : new Date(Date.now() + 15 * 864e5).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
  const medicoId = b.medico_id && (await medicoDaClinica(b.medico_id, ctx.clinica_id)) ? b.medico_id : (ctx.tipo === 'medico' ? ctx.medico_id : null)
  const campos = {
    paciente_id: b.paciente_id, medico_id: medicoId, validade, desconto, total,
    condicoes: (b.condicoes || []).map(c => String(c).slice(0, 80)).slice(0, 6),
    observacoes: b.observacoes ? String(b.observacoes).slice(0, 1000) : null, atualizado_em: new Date().toISOString(),
  }
  let id = b.id
  if (id) {
    const atual = await orcamentoDaClinica(ctx, id)
    if (['aprovado', 'recusado', 'cancelado'].includes(atual.status)) throw new ErroAtendimento('Este orçamento já foi respondido. Crie um novo.', 409)
    // Mudou depois de enviado: volta a "enviado" para o paciente ver a versão nova
    const { error } = await db.from('orcamentos').update({ ...campos, ...(atual.status === 'visto' ? { status: 'enviado' } : {}) }).eq('id', id)
    if (error) throw error
    await db.from('orcamento_itens').delete().eq('orcamento_id', id)
  } else {
    for (let t = 0; t < 4 && !id; t++) {
      const { data: ult } = await db.from('orcamentos').select('numero').eq('clinica_chave', chave).order('numero', { ascending: false }).limit(1)
      const numero = ((ult?.[0] as any)?.numero || 0) + 1
      const { data, error } = await db.from('orcamentos').insert({ ...campos, clinica_chave: chave, numero, status: 'rascunho', criado_por: ctx.medico_id || null }).select('id').maybeSingle()
      if (!error && data) id = (data as any).id
      else if (error && !/duplicate|unique/i.test(error.message)) throw error
    }
    if (!id) throw new ErroAtendimento('Não foi possível numerar o orçamento. Tente de novo.', 500)
  }
  const { error: eI } = await db.from('orcamento_itens').insert(itens.map((i, k) => ({ ...i, orcamento_id: id, ordem: k })))
  if (eI) throw eI
  return { id }
}

/** Marca como enviado e devolve o link do portal e o texto pronto para o WhatsApp. */
export async function enviarOrcamento(ctx: Contexto, id: string) {
  const o = await orcamentoDaClinica(ctx, id)
  if (['aprovado', 'recusado', 'cancelado'].includes(o.status)) throw new ErroAtendimento('Este orçamento já foi respondido.', 409)
  const pac = await pacienteDaClinica(ctx, o.paciente_id)
  const link = await linkDoPortalDoPaciente(o.paciente_id)
  if (!link) throw new ErroAtendimento('Não foi possível gerar o link do paciente.', 500)
  await db.from('orcamentos').update({ status: o.status === 'rascunho' ? 'enviado' : o.status, enviado_em: o.enviado_em || new Date().toISOString() }).eq('id', id)
  const primeiro = String(pac.nome || '').split(' ')[0]
  const valor = Number(o.total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const texto = `Olá${primeiro ? `, ${primeiro}` : ''}! Seu orçamento nº ${String(o.numero).padStart(4, '0')} (${valor}) está pronto. Veja os detalhes e aprove por aqui: ${link}`
  return { link, texto, telefone: pac.telefone }
}

export async function cancelarOrcamento(ctx: Contexto, id: string) {
  const o = await orcamentoDaClinica(ctx, id)
  if (o.status === 'aprovado') throw new ErroAtendimento('Orçamento aprovado não pode ser cancelado.', 409)
  await db.from('orcamentos').update({ status: 'cancelado', atualizado_em: new Date().toISOString() }).eq('id', id)
  return { ok: true }
}

export async function marcarAgendado(ctx: Contexto, id: string) {
  await orcamentoDaClinica(ctx, id)
  await db.from('orcamentos').update({ agendado: true, atualizado_em: new Date().toISOString() }).eq('id', id)
  return { ok: true }
}

// ── Portal do paciente ──────────────────────────────────────────────────────

/** Orçamentos enviados ao paciente (rascunhos e cancelados não aparecem). */
export async function orcamentosNoPortal(pacienteId: string, chave: string) {
  const { data } = await db.from('orcamentos').select('id, numero, status, validade, total, desconto, condicoes, condicao_escolhida, observacoes, respondido_em, aceite, itens:orcamento_itens(descricao, quantidade, valor_unitario, ordem)')
    .eq('paciente_id', pacienteId).eq('clinica_chave', chave).in('status', ['enviado', 'visto', 'aprovado', 'recusado'])
    .order('criado_em', { ascending: false }).limit(10)
  return (data || []).map((o: any) => ({
    id: o.id, numero: o.numero, status: statusVisivel(o), validade: o.validade, total: Number(o.total), desconto: Number(o.desconto),
    condicoes: o.condicoes || [], condicao_escolhida: o.condicao_escolhida, observacoes: o.observacoes, respondido_em: o.respondido_em,
    aceito_por: o.aceite?.nome || null,
    itens: (o.itens || []).sort((a: any, b: any) => a.ordem - b.ordem).map((i: any) => ({ descricao: i.descricao, quantidade: Number(i.quantidade), valor_unitario: Number(i.valor_unitario) })),
  }))
}

export async function marcarVisto(pacienteId: string, chave: string) {
  await db.from('orcamentos').update({ status: 'visto', visto_em: new Date().toISOString() })
    .eq('paciente_id', pacienteId).eq('clinica_chave', chave).eq('status', 'enviado')
}

/** Aprovar (com aceite) ou recusar pelo portal. Avisa a recepção no sino. */
export async function responderNoPortal(pacienteId: string, chave: string, p: {
  id: string; acao: 'aprovar' | 'recusar'; nome?: string; condicao?: string | null; motivo?: string | null; ip?: string | null; navegador?: string | null
}) {
  const { data } = await db.from('orcamentos').select('*, itens:orcamento_itens(descricao, quantidade, valor_unitario, ordem), paciente:pacientes(nome)')
    .eq('id', p.id).eq('paciente_id', pacienteId).eq('clinica_chave', chave).maybeSingle()
  const o: any = data
  if (!o) throw new ErroAtendimento('Orçamento não encontrado.', 404)
  const st = statusVisivel(o)
  if (st === 'expirado') throw new ErroAtendimento('Este orçamento venceu. Peça um novo à clínica.', 409)
  if (!['enviado', 'visto'].includes(st)) throw new ErroAtendimento('Este orçamento já foi respondido.', 409)
  const agora = new Date().toISOString()
  let update: any
  if (p.acao === 'aprovar') {
    const nome = String(p.nome || '').trim()
    if (nome.length < 5 || !nome.includes(' ')) throw new ErroAtendimento('Digite seu nome completo para aprovar.', 422)
    const condicoes: string[] = o.condicoes || []
    const condicao = condicoes.length ? (condicoes.includes(p.condicao || '') ? p.condicao : null) : null
    if (condicoes.length && !condicao) throw new ErroAtendimento('Escolha a forma de pagamento.', 422)
    const conteudo = JSON.stringify({ numero: o.numero, itens: o.itens, desconto: o.desconto, total: o.total, validade: o.validade, condicao })
    update = {
      status: 'aprovado', respondido_em: agora, condicao_escolhida: condicao,
      aceite: { nome: nome.slice(0, 120), ip: p.ip || null, navegador: String(p.navegador || '').slice(0, 300), hash: createHash('sha256').update(conteudo).digest('hex'), em: agora },
    }
  } else {
    update = { status: 'recusado', respondido_em: agora, motivo_recusa: p.motivo ? String(p.motivo).slice(0, 300) : null }
  }
  await db.from('orcamentos').update(update).eq('id', o.id)

  // Aviso no sino da recepção (pelo médico do orçamento ou o primeiro profissional da clínica)
  let medicoAviso = o.medico_id as string | null
  if (!medicoAviso) {
    const { data: m } = await db.from('medicos').select('id').or(`clinica_id.eq.${chave},id.eq.${chave}`).not('cargo', 'in', FILTRO_APOIO).limit(1)
    medicoAviso = (m?.[0] as any)?.id || null
  }
  if (medicoAviso) {
    const nomePac = String(o.paciente?.nome || 'Paciente').split(' ').slice(0, 2).join(' ')
    const valor = Number(o.total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    await db.from('notificacoes_medico').insert({
      medico_id: medicoAviso, paciente_id: pacienteId, tipo: p.acao === 'aprovar' ? 'orcamento_aprovado' : 'orcamento_recusado', lida: false,
      titulo: p.acao === 'aprovar' ? `${nomePac} aprovou o orçamento` : `${nomePac} recusou o orçamento`,
      descricao: `Orçamento nº ${String(o.numero).padStart(4, '0')} · ${valor}${p.acao === 'aprovar' ? (update.condicao_escolhida ? ` · ${update.condicao_escolhida}` : '') + ' · agende os procedimentos' : (update.motivo_recusa ? ` · “${update.motivo_recusa}”` : '')}`,
      link: `/orcamentos?id=${o.id}`,
    })
  }
  return { ok: true }
}
