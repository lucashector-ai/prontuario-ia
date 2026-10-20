/**
 * Portal do paciente, etapa 2: arquivos enviados pelo paciente e documentos liberados pelo médico.
 * Arquivos vão direto do celular para o bucket privado (URL assinada de upload), sem passar pelo
 * servidor; a equipe abre por link assinado de 5 minutos.
 */
import { supabaseServidor as db } from '@/lib/servidor'
import { ErroAtendimento } from '@/lib/atendimento/servidor'
import { medicoDaClinica, type Contexto as ContextoAcesso } from '@/lib/acesso'

export const BUCKET_ANEXOS = 'paciente-anexos'
export const TIPOS_ANEXO = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']
export const TAMANHO_MAX = 15 * 1024 * 1024

async function garantirBucket() {
  const { data } = await db.storage.getBucket(BUCKET_ANEXOS)
  if (!data) await db.storage.createBucket(BUCKET_ANEXOS, { public: false, fileSizeLimit: TAMANHO_MAX })
}

/** Reserva o arquivo e devolve a URL assinada para o celular enviar direto ao storage. */
export async function prepararUpload(pacienteId: string, clinicaChave: string, nome: string, tipo: string, tamanho: number) {
  if (!TIPOS_ANEXO.includes(tipo)) throw new ErroAtendimento('Envie foto (JPG, PNG) ou PDF.', 422)
  if (!(tamanho > 0) || tamanho > TAMANHO_MAX) throw new ErroAtendimento('Arquivo muito grande (até 15 MB).', 422)
  const { count } = await db.from('paciente_anexos').select('id', { count: 'exact', head: true }).eq('paciente_id', pacienteId)
    .gte('criado_em', new Date(Date.now() - 86400000).toISOString())
  if ((count || 0) >= 20) throw new ErroAtendimento('Limite de 20 arquivos por dia. Fale com a clínica.', 429)
  await garantirBucket()
  const ext = (nome.split('.').pop() || (tipo === 'application/pdf' ? 'pdf' : 'jpg')).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5)
  const caminho = `${clinicaChave}/${pacienteId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const { data: up, error } = await db.storage.from(BUCKET_ANEXOS).createSignedUploadUrl(caminho)
  if (error || !up) throw new ErroAtendimento('Não foi possível preparar o envio. Tente de novo.', 500)
  const { data: anexo, error: e2 } = await db.from('paciente_anexos').insert({
    paciente_id: pacienteId, clinica_chave: clinicaChave, caminho, nome_arquivo: String(nome || 'arquivo').slice(0, 120), tipo_mime: tipo, tamanho, origem: 'portal',
  }).select('id').single()
  if (e2) throw e2
  return { id: (anexo as any).id as string, caminho, token: up.token }
}

/** Marca o upload como concluído (só se o arquivo existe no storage). */
export async function concluirUpload(pacienteId: string, anexoId: string) {
  const { data: a } = await db.from('paciente_anexos').select('id, caminho').eq('id', anexoId).eq('paciente_id', pacienteId).maybeSingle()
  if (!a) throw new ErroAtendimento('Arquivo não encontrado.', 404)
  const pasta = (a as any).caminho.split('/').slice(0, -1).join('/')
  const nome = (a as any).caminho.split('/').pop()
  const { data: lista } = await db.storage.from(BUCKET_ANEXOS).list(pasta, { search: nome })
  if (!lista?.some(f => f.name === nome)) throw new ErroAtendimento('O envio não terminou. Tente de novo.', 409)
  await db.from('paciente_anexos').update({ enviado: true }).eq('id', anexoId)
  return { ok: true }
}

export async function anexosDoPaciente(pacienteId: string, comLink = false) {
  const { data } = await db.from('paciente_anexos').select('id, nome_arquivo, tipo_mime, tamanho, origem, caminho, criado_em')
    .eq('paciente_id', pacienteId).eq('enviado', true).order('criado_em', { ascending: false }).limit(50)
  const lista = (data || []) as any[]
  if (!comLink) return lista.map(({ caminho, ...r }) => r)
  return Promise.all(lista.map(async ({ caminho, ...r }) => {
    const { data: s } = await db.storage.from(BUCKET_ANEXOS).createSignedUrl(caminho, 300)
    return { ...r, url: s?.signedUrl || null }
  }))
}

export async function documentosLiberados(pacienteId: string) {
  const { data } = await db.from('documentos_paciente').select('id, tipo, titulo, criado_em')
    .eq('paciente_id', pacienteId).eq('liberado_portal', true).order('criado_em', { ascending: false }).limit(30)
  return (data || []) as any[]
}

export async function documentoDoPaciente(pacienteId: string, documentoId: string) {
  const { data } = await db.from('documentos_paciente').select('html').eq('id', documentoId).eq('paciente_id', pacienteId).eq('liberado_portal', true).maybeSingle()
  return (data as any)?.html as string | undefined
}

/** Guarda o documento emitido para o paciente ver no portal (pedido pela tela com liberar_portal). */
export async function guardarDocumento(ctx: ContextoAcesso, p: { pacienteId?: string | null; medicoId?: string | null; tipo: string; titulo: string; html: string }) {
  if (!p.pacienteId) return
  const { data: pac } = await db.from('pacientes').select('clinica_id, medico_id').eq('id', p.pacienteId).maybeSingle()
  const pa: any = pac
  const chave = pa?.clinica_id || pa?.medico_id
  if (!chave) return
  const daClinica = (ctx.clinica_id && pa.clinica_id === ctx.clinica_id) || (ctx.medico_id && pa.medico_id === ctx.medico_id)
    || (ctx.clinica_id && pa.medico_id && (await medicoDaClinica(pa.medico_id, ctx.clinica_id)))
  if (!daClinica) return
  // O botão "Imprimir" no topo do documento não faz sentido no portal: vira impressão do próprio paciente
  await db.from('documentos_paciente').insert({ paciente_id: p.pacienteId, clinica_chave: chave, medico_id: p.medicoId || ctx.medico_id || null, tipo: p.tipo, titulo: p.titulo, html: p.html })
}
