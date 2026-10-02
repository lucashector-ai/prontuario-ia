import { NextRequest, NextResponse } from 'next/server'
import { supabaseServidor as db } from '@/lib/servidor'
import { enviarWhatsApp, normalizarTelefone } from '@/lib/whatsapp/enviar'
import { nomesMedicoClinica } from '@/lib/sofia/confirmacao'
import {
  BOTOES_OFERTA_VAGA, MODELO_OFERTA_VAGA, dataHoraSP, ehErroDeSchema, preencher, primeiroNomeDe,
} from '@/components/confirmacoes/modelos'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Oferece um horário liberado a um paciente da lista de espera pelo WhatsApp.
 *   POST { item_id, data_hora (ISO), duracao?, medico_id? }
 * Botões: 'Quero esse horário' | 'Não posso' — a resposta é tratada no webhook
 * (lib/sofia/confirmacao.ts → tratarRespostaListaEspera), que cria o agendamento.
 */
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}))
  if (!b.item_id || !b.data_hora) return NextResponse.json({ error: 'item_id e data_hora obrigatórios' }, { status: 400 })
  const quando = new Date(b.data_hora)
  if (isNaN(quando.getTime())) return NextResponse.json({ error: 'data_hora inválida' }, { status: 400 })
  if (quando.getTime() < Date.now()) return NextResponse.json({ error: 'Esse horário já passou' }, { status: 400 })

  const { data: item, error } = await db.from('lista_espera').select('*').eq('id', b.item_id).maybeSingle()
  if (error) return NextResponse.json({ error: ehErroDeSchema(error) ? 'Rode a migration 0010.' : error.message }, { status: ehErroDeSchema(error) ? 409 : 500 })
  if (!item) return NextResponse.json({ error: 'Item não encontrado' }, { status: 404 })

  let telefone: string | null = item.telefone
  if (!telefone && item.paciente_id) {
    const { data: p } = await db.from('pacientes').select('telefone').eq('id', item.paciente_id).maybeSingle()
    telefone = p?.telefone || null
  }
  if (!normalizarTelefone(telefone)) return NextResponse.json({ error: 'Paciente sem telefone válido' }, { status: 422 })

  // A oferta sai pelo WhatsApp do médico do horário liberado (ou do item)
  const medicoId: string = b.medico_id || item.medico_id
  const nomes = await nomesMedicoClinica(medicoId)
  const { data, hora } = dataHoraSP(quando)
  const texto = preencher(MODELO_OFERTA_VAGA, { nome: primeiroNomeDe(item.nome), data, hora, medico: nomes.medico, clinica: nomes.clinica })

  const r = await enviarWhatsApp({
    medicoId, telefone: telefone!, texto, botoes: BOTOES_OFERTA_VAGA,
    registrar: { nome: item.nome, pacienteId: item.paciente_id, metadata: { lista_espera: true, oferta_vaga: true, item_id: item.id } },
  })
  if (!r.ok) return NextResponse.json({ error: r.erro || 'Falha ao enviar' }, { status: 502 })

  const { data: atualizado } = await db.from('lista_espera').update({
    status: 'oferecido', oferecido_em: new Date().toISOString(), oferta_data_hora: quando.toISOString(),
    oferta_duracao: Number(b.duracao) || 30, medico_id: medicoId,
  }).eq('id', item.id).select('*').single()

  return NextResponse.json({ ok: true, item: atualizado || item })
}
