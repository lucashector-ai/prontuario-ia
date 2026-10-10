'use client'
/**
 * Peças compartilhadas pela recepção e pelo consultório: selos de status e
 * prioridade, escolha de prioridade e o comprovante de senha (tela + impressão).
 */
import { Accessibility, Droplet, Printer, Ticket } from 'lucide-react'
import { tokens as T } from '@/lib/design-tokens'
import { Badge, Button, Modal, ModalAcoes, type BadgeTone } from '@/components/ui'
import { PRIORIDADES, RISCOS, ROTULO_STATUS, type Atendimento, type Prioridade, type StatusAtendimento } from '@/lib/atendimento/comum'

const TOM_STATUS: Record<StatusAtendimento, BadgeTone> = {
  aguardando_triagem: 'pending', em_triagem: 'info', aguardando: 'pending', chamado: 'accent', em_atendimento: 'info', finalizado: 'success', ausente: 'danger', cancelado: 'neutral',
}

export function SeloStatus({ status }: { status: StatusAtendimento }) {
  return <Badge tone={TOM_STATUS[status]} dot>{ROTULO_STATUS[status]}</Badge>
}

export function SeloPrioridade({ prioridade }: { prioridade: Prioridade }) {
  if (prioridade === 'normal') return null
  const p = PRIORIDADES.find(x => x.valor === prioridade)!
  return <Badge tone="warning" icon={prioridade === 'doador' ? Droplet : Accessibility}>{p.curto}</Badge>
}

export function idade(nascimento?: string | null): number | null {
  if (!nascimento) return null
  const n = new Date(nascimento + 'T12:00:00'); const h = new Date()
  if (isNaN(n.getTime())) return null
  let i = h.getFullYear() - n.getFullYear()
  if (h.getMonth() < n.getMonth() || (h.getMonth() === n.getMonth() && h.getDate() < n.getDate())) i--
  return i
}

export const horaCurta = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }) : '—'

export function esperaTexto(min: number) {
  if (min < 1) return 'agora'
  if (min < 60) return `${min} min`
  return `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}`
}

/** Lista de prioridades em botões grandes (rápido para a recepção). */
export function EscolhaPrioridade({ valor, onChange, sugerida }: { valor: Prioridade; onChange: (p: Prioridade) => void; sugerida?: Prioridade }) {
  return (
    <div role="radiogroup" aria-label="Prioridade" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {PRIORIDADES.map(p => {
        const ativo = valor === p.valor
        return (
          <button key={p.valor} role="radio" aria-checked={ativo} onClick={() => onChange(p.valor)} style={{
            display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', padding: '10px 12px', borderRadius: 11, cursor: 'pointer',
            fontFamily: 'inherit', fontSize: 13, color: T.text.primary, background: ativo ? T.brand.primarySubtle : '#fff',
            border: `1px solid ${ativo ? T.brand.primaryAccent : T.border.default}`,
          }}>
            <span style={{ width: 16, height: 16, borderRadius: '50%', flexShrink: 0, border: `2px solid ${ativo ? T.brand.primary : T.border.strong || '#C9C7D1'}`, display: 'grid', placeItems: 'center' }}>
              {ativo && <span style={{ width: 7, height: 7, borderRadius: '50%', background: T.brand.primary }} />}
            </span>
            <span style={{ flex: 1 }}>{p.label}</span>
            {sugerida === p.valor && p.valor !== 'normal' && <Badge tone="accent">pela idade</Badge>}
          </button>
        )
      })}
    </div>
  )
}

/** Comprovante depois do check-in: senha grande, para onde ir, e botão de imprimir. */
export function ModalSenha({ at, setor, onClose }: { at: Atendimento; setor?: string | null; onClose: () => void }) {
  return (
    <Modal titulo="Chegada confirmada" onClose={onClose} largura={400}>
      <div style={{ textAlign: 'center', padding: '6px 0 2px' }}>
        <div style={{ fontSize: 12.5, color: T.text.secondary, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.08em' }}>Senha</div>
        <div className="mono" style={{ fontSize: 64, fontWeight: 800, letterSpacing: '-.02em', color: T.brand.primary, lineHeight: 1.1 }}>{at.senha}</div>
        <div style={{ fontSize: 15, fontWeight: 650, marginTop: 6 }}>{at.paciente?.nome}</div>
        <div style={{ fontSize: 13, color: T.text.secondary, marginTop: 4 }}>
          {at.medico?.nome}{setor ? ` · aguardar em ${setor}` : ''}
        </div>
        {at.horario_previsto && <div style={{ fontSize: 13, color: T.text.secondary, marginTop: 2 }}>Horário agendado: {horaCurta(at.horario_previsto)}</div>}
        <div style={{ marginTop: 10 }}><SeloPrioridade prioridade={at.prioridade} /></div>
      </div>
      <ModalAcoes>
        <Button variant="secondary" icon={Printer} onClick={() => imprimirSenha(at, setor)}>Imprimir senha</Button>
        <Button onClick={onClose}>Pronto</Button>
      </ModalAcoes>
    </Modal>
  )
}

/** Imprime a senha em papel de 80 mm (impressora térmica) ou A4, sem sair da tela. */
export function imprimirSenha(at: Atendimento, setor?: string | null) {
  const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))
  const nomeClinica = (() => { try { return JSON.parse(localStorage.getItem('clinica') || '{}').nome || '' } catch { return '' } })()
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Senha ${esc(at.senha)}</title><style>
    @page { size: 80mm auto; margin: 4mm }
    body { font-family: system-ui, sans-serif; text-align: center; margin: 0; color: #000 }
    .c { font-size: 13px; font-weight: 700 } .s { font-size: 54px; font-weight: 800; margin: 6px 0 } .l { font-size: 12px; margin: 2px 0 }
    hr { border: 0; border-top: 1px dashed #000; margin: 8px 0 }
  </style></head><body>
    <div class="c">${esc(nomeClinica)}</div><hr>
    <div class="l">SENHA</div><div class="s">${esc(at.senha)}</div>
    ${at.prioridade !== 'normal' ? '<div class="l"><b>ATENDIMENTO PRIORITÁRIO</b></div>' : ''}
    <div class="l">${esc(at.medico?.nome || '')}</div>
    ${setor ? `<div class="l">Aguarde em: ${esc(setor)}</div>` : ''}
    <hr><div class="l">Chegada ${horaCurta(at.chegada_em)} · ${new Date().toLocaleDateString('pt-BR')}</div>
    <div class="l">Fique atento ao painel. Avisaremos quando for a sua vez.</div>
  </body></html>`
  const f = document.createElement('iframe')
  f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'
  document.body.appendChild(f)
  const doc = f.contentWindow!.document
  doc.open(); doc.write(html); doc.close()
  setTimeout(() => { f.contentWindow!.focus(); f.contentWindow!.print(); setTimeout(() => f.remove(), 1000) }, 150)
}

export function SenhaChip({ senha, destaque }: { senha: string; destaque?: boolean }) {
  return (
    <span className="mono" style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px', borderRadius: 8, fontSize: 13, fontWeight: 700,
      background: destaque ? T.brand.primary : T.brand.primarySubtle, color: destaque ? '#fff' : T.brand.primary, flexShrink: 0,
    }}>
      <Ticket size={13} strokeWidth={2} />{senha}
    </span>
  )
}

/** Cor da triagem (classificação de risco). */
export function SeloRisco({ risco, completo }: { risco?: string | null; completo?: boolean }) {
  const r = RISCOS.find(x => x.valor === risco)
  if (!r) return null
  return (
    <span title={`${r.label} · ${r.prazo}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 8px', borderRadius: 999, fontSize: 11.5, fontWeight: 700, background: `color-mix(in srgb, ${r.cor} 14%, #fff)`, color: r.cor, flexShrink: 0 }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: r.cor }} />{completo ? r.label : r.valor[0].toUpperCase() + r.valor.slice(1)}
    </span>
  )
}
