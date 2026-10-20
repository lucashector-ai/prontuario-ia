/**
 * Base dos documentos impressos (atestado, pedido de exames): dados da clínica, do médico e do
 * paciente lidos do banco pela SESSÃO (nunca confiando no que a tela manda), datas no horário de
 * Brasília, número por extenso e HTML escapado.
 * Referências: Res. CFM 1.658/2002 (atestado: identificação do paciente, dias, CID só com
 * autorização, data, assinatura e CRM).
 */
import { supabaseServidor as db } from '@/lib/servidor'
import type { Contexto } from '@/lib/acesso'

export const esc = (s: any) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))

const TZ = 'America/Sao_Paulo'
export const dataLonga = (d = new Date()) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', timeZone: TZ })
export const dataCurta = (d = new Date()) => d.toLocaleDateString('pt-BR', { timeZone: TZ })
export const hora = (d = new Date()) => d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: TZ })

const UNID = ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove']
const DEZ = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa']
/** 0–99 por extenso (dias de atestado). */
export function porExtenso(n: number) {
  n = Math.max(0, Math.min(99, Math.round(n)))
  if (n < 20) return UNID[n]
  const d = Math.floor(n / 10), u = n % 10
  return DEZ[d] + (u ? ' e ' + UNID[u] : '')
}

export type DadosDocumento = {
  clinica: { nome: string; endereco: string | null; telefone: string | null; cidade: string | null }
  medico: { nome: string; crm: string | null; especialidade: string | null }
  paciente: { nome: string; cpf: string | null; nascimento: string | null }
}

/** Busca clínica, médico (da sessão ou o informado, desde que da clínica) e paciente (da clínica). */
export async function dadosDoDocumento(ctx: Contexto, p: { medicoId?: string | null; pacienteId?: string | null; pacienteAvulso?: { nome?: string; cpf?: string; data_nascimento?: string } | null }): Promise<DadosDocumento | null> {
  if (!ctx.clinica_id) return null
  const medicoId = ctx.tipo === 'medico' ? ctx.medico_id : p.medicoId
  const [{ data: c }, { data: m }, pac] = await Promise.all([
    db.from('clinicas').select('nome, endereco, telefone').eq('id', ctx.clinica_id).maybeSingle(),
    medicoId ? db.from('medicos').select('nome, crm, especialidade, clinica_id').eq('id', medicoId).maybeSingle() : Promise.resolve({ data: null }),
    p.pacienteId ? db.from('pacientes').select('nome, cpf, data_nascimento, clinica_id, medico_id').eq('id', p.pacienteId).maybeSingle() : Promise.resolve({ data: null }),
  ])
  const med: any = m
  if (!med || (med.clinica_id && med.clinica_id !== ctx.clinica_id)) return null
  const pa: any = (pac as any)?.data
  const pacienteOk = pa && (pa.clinica_id === ctx.clinica_id || pa.medico_id === medicoId)
  const avulso = p.pacienteAvulso || null
  const endereco = (c as any)?.endereco || null
  return {
    clinica: { nome: (c as any)?.nome || '', endereco, telefone: (c as any)?.telefone || null, cidade: endereco?.split(/[—–-]/).pop()?.trim().split('/')[0]?.trim() || null },
    medico: { nome: med.nome, crm: med.crm, especialidade: med.especialidade },
    paciente: pacienteOk
      ? { nome: pa.nome, cpf: pa.cpf, nascimento: pa.data_nascimento }
      : { nome: avulso?.nome || '', cpf: avulso?.cpf || null, nascimento: avulso?.data_nascimento || null },
  }
}

const telFmt = (t: string | null) => { const d = String(t || '').replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, ''); return d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : d.length === 10 ? `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}` : (t || '') }
const cpfFmt = (c: string | null) => { const d = String(c || '').replace(/\D/g, ''); return d.length === 11 ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}` : (c || '') }
const nascFmt = (n: string | null) => n ? new Date(n + 'T12:00:00').toLocaleDateString('pt-BR') : ''

/** Página A4 com cabeçalho da clínica, conteúdo, local/data e assinatura. */
export function paginaDocumento(titulo: string, d: DadosDocumento, corpo: string) {
  const agora = new Date()
  const idPaciente = [d.paciente.cpf ? `CPF ${esc(cpfFmt(d.paciente.cpf))}` : '', d.paciente.nascimento ? `nascido(a) em ${esc(nascFmt(d.paciente.nascimento))}` : ''].filter(Boolean).join(' · ')
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/><title>${esc(titulo)} — ${esc(d.paciente.nome)}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,Helvetica,sans-serif;color:#111;padding:56px;max-width:760px;margin:0 auto;font-size:14px;line-height:1.8}
@page{size:A4;margin:18mm}@media print{.no-print{display:none!important}body{padding:0}}
.btn{position:fixed;top:20px;right:20px;padding:10px 20px;background:#5B3FD0;color:#fff;border:none;border-radius:8px;font-size:13px;cursor:pointer;font-weight:600}
.cab{text-align:center;border-bottom:2px solid #111;padding-bottom:16px;margin-bottom:28px}
.cab .clin{font-size:16px;font-weight:700}.cab .info{font-size:11.5px;color:#444;line-height:1.5}
h1{font-size:17px;letter-spacing:.12em;text-transform:uppercase;text-align:center;margin:0 0 22px}
.pac{font-size:12.5px;color:#333;margin-bottom:18px;padding:10px 12px;border:1px solid #ddd;border-radius:6px}
.corpo p{margin-bottom:12px;text-align:justify}.corpo ol{margin:0 0 12px 22px}.corpo li{margin-bottom:6px}
.rod{display:flex;justify-content:space-between;align-items:flex-end;margin-top:64px;gap:24px}
.local{font-size:12.5px;color:#333}.ass{text-align:center;min-width:260px}.linha{border-top:1.5px solid #111;margin-bottom:6px}
.ass .nome{font-size:13px;font-weight:700}.ass .crm{font-size:11.5px;color:#444}
</style></head><body>
<button class="btn no-print" onclick="window.print()">Imprimir / Salvar PDF</button>
<div class="cab">
  <div class="clin">${esc(d.clinica.nome || d.medico.nome)}</div>
  <div class="info">${[d.clinica.endereco, d.clinica.telefone ? 'Tel. ' + telFmt(d.clinica.telefone) : ''].filter(Boolean).map(esc).join(' · ')}</div>
</div>
<h1>${esc(titulo)}</h1>
<div class="pac"><b>Paciente:</b> ${esc(d.paciente.nome || '—')}${idPaciente ? ' · ' + idPaciente : ''}</div>
<div class="corpo">${corpo}</div>
<div class="rod">
  <div class="local">${esc(d.clinica.cidade ? d.clinica.cidade + ', ' : '')}${esc(dataLonga(agora))}, às ${esc(hora(agora))}</div>
  <div class="ass"><div class="linha"></div><div class="nome">${esc(d.medico.nome)}</div>
  <div class="crm">${[d.medico.especialidade, d.medico.crm ? (/crm/i.test(d.medico.crm) ? d.medico.crm : 'CRM ' + d.medico.crm) : ''].filter(Boolean).map(esc).join(' · ')}</div></div>
</div>
</body></html>`
}
