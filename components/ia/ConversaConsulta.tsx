'use client'
/**
 * Transcrição exibida como conversa: médico à esquerda, paciente/acompanhante à direita.
 * Aceita texto rotulado ("Médico: …", "Paciente: …", "Falante 2: …") ou texto corrido.
 *
 *   <ConversaConsulta texto={transcricao} parcial={parcial} />
 */
import { Stethoscope, UserRound, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { tokens as T, tint } from '@/lib/design-tokens'
import { lerConversa, type Papel } from '@/lib/transcricao/papeis'

const ESTILO: Record<Papel, { icon: LucideIcon; cor: string; fundo: string; borda: string; direita: boolean }> = {
  medico: { icon: Stethoscope, cor: T.brand.primary, fundo: T.brand.primarySubtle, borda: T.brand.primaryAccent, direita: false },
  paciente: { icon: UserRound, cor: T.text.strong, fundo: T.bg.card, borda: T.border.default, direita: true },
  acompanhante: { icon: Users, cor: 'oklch(0.55 0.13 55)', fundo: tint(T.data.orange, 0.1), borda: tint(T.data.orange, 0.35), direita: true },
}

export default function ConversaConsulta({ texto, parcial, compacto }: { texto: string; parcial?: string; compacto?: boolean }) {
  const turnos = lerConversa(texto)
  const temPapel = turnos.some(t => t.papel)
  const fonte = compacto ? 13.5 : 14

  // Texto corrido (sem marcação de quem fala)
  if (!temPapel && !turnos.some(t => t.rotulo)) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {turnos.map((t, i) => <p key={i} style={{ fontSize: fonte, color: T.text.primary, lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap' }}>{t.texto}</p>)}
        {parcial ? <p style={{ fontSize: fonte, color: T.text.tertiary, lineHeight: 1.7, margin: 0, fontStyle: 'italic' }}>{parcial}</p> : null}
      </div>
    )
  }

  return (
    <div role="log" aria-label="Conversa da consulta" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {turnos.map((t, i) => {
        const e = t.papel ? ESTILO[t.papel] : null
        const direita = e?.direita ?? false
        const Icone = e?.icon
        const mesmoAnterior = i > 0 && turnos[i - 1].rotulo === t.rotulo
        return (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: direita ? 'flex-end' : 'flex-start', marginTop: mesmoAnterior ? -4 : 0 }}>
            {!mesmoAnterior && t.rotulo && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 650, color: e?.cor || T.text.secondary, margin: '0 6px 4px' }}>
                {Icone && <Icone size={13} strokeWidth={1.8} />}{t.rotulo}
              </span>
            )}
            <div style={{
              maxWidth: 'min(85%, 640px)', padding: compacto ? '8px 12px' : '10px 14px',
              borderRadius: 14, [direita ? 'borderTopRightRadius' : 'borderTopLeftRadius']: mesmoAnterior ? 14 : 4,
              background: e?.fundo || T.bg.page, border: `1px solid ${e?.borda || T.border.default}`,
              fontSize: fonte, lineHeight: 1.6, color: T.text.primary, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere',
            }}>
              {t.texto}
            </div>
          </div>
        )
      })}
      {parcial ? (
        <p style={{ fontSize: fonte, color: T.text.tertiary, lineHeight: 1.6, margin: '2px 6px 0', fontStyle: 'italic' }}>{parcial}</p>
      ) : null}
    </div>
  )
}
