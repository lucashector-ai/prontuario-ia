'use client'
/** Caixa obrigatória antes de gravar: o paciente autorizou a gravação (LGPD). O registro vai junto com a consulta. */
import { tokens as T } from '@/lib/design-tokens'

export function ConsentimentoGravacao({ marcado, onChange, nome }: { marcado: boolean; onChange: (v: boolean) => void; nome?: string }) {
  return (
    <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: T.text.secondary, cursor: 'pointer', lineHeight: 1.4, maxWidth: 420 }}>
      <input type="checkbox" checked={marcado} onChange={e => onChange(e.target.checked)} style={{ marginTop: 2 }} />
      <span><b style={{ color: T.text.primary }}>{nome ? `${nome} autorizou` : 'O paciente autorizou'} a gravação</b> da consulta para gerar o prontuário. O áudio não fica guardado.</span>
    </label>
  )
}

/** Campos que acompanham a consulta salva quando houve gravação autorizada. */
export const camposConsentimento = (autorizado: boolean) => autorizado ? { gravacao_autorizada: true, gravacao_autorizada_em: new Date().toISOString() } : {}
