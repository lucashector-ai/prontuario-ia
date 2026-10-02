'use client'
/**
 * Card compacto "Últimos acessos a este prontuário" (ficha do paciente).
 *
 *   <AcessosDoPaciente pacienteId={id} />
 *   <AcessosDoPaciente pacienteId={id} limite={8} onVerTodos={() => ...} />
 */
import { useEffect, useState } from 'react'
import { ShieldCheck, ChevronRight } from 'lucide-react'
import { tokens } from '@/lib/design-tokens'
import { Avatar, Button, Card } from '@/components/ui'
import type { RegistroAuditoria } from '@/lib/auditoria'
import { ROTULO_USUARIO } from '@/lib/auditoria'
import { buscarAuditoria, dadosDemoAuditoria, fmtDataHora, fmtRelativo, fraseAcesso } from './util'

const T = tokens

export default function AcessosDoPaciente({ pacienteId, limite = 5, demo, onVerTodos }: {
  pacienteId: string
  limite?: number
  demo?: boolean
  onVerTodos?: () => void
}) {
  const [registros, setRegistros] = useState<RegistroAuditoria[]>([])
  const [carregando, setCarregando] = useState(true)
  const [ausente, setAusente] = useState(false)

  useEffect(() => {
    if (!pacienteId) return
    let vivo = true
    let ehDemo = !!demo
    try { if (new URLSearchParams(window.location.search).get('demo') === '1') ehDemo = true } catch {}
    if (ehDemo) {
      setRegistros(dadosDemoAuditoria(pacienteId).filter(r => r.paciente_id === pacienteId).slice(0, limite))
      setCarregando(false)
      return
    }
    setCarregando(true)
    buscarAuditoria({ pacienteId }, 1, limite)
      .then(r => { if (vivo) { setRegistros(r.registros); setAusente(!!r.tabela_ausente) } })
      .catch(() => {})
      .finally(() => { if (vivo) setCarregando(false) })
    return () => { vivo = false }
  }, [pacienteId, limite, demo])

  return (
    <Card padding={0}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '16px 18px 10px' }}>
        <h3 style={{ margin: 0, flex: 1, fontSize: 15, fontWeight: 700, color: T.text.primary }}>Últimos acessos a este prontuário</h3>
        {onVerTodos && registros.length > 0 && (
          <Button variant="ghost" size="sm" iconRight={ChevronRight} onClick={onVerTodos}>Ver todos</Button>
        )}
      </div>

      {carregando ? (
        <div style={{ padding: '4px 18px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[0, 1, 2].map(i => <div key={i} className="c360-skel" style={{ height: 30, borderRadius: 8 }} />)}
        </div>
      ) : registros.length === 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 18px 16px' }}>
          <ShieldCheck size={16} strokeWidth={1.6} color={T.text.tertiary} />
          <span style={{ fontSize: 12.5, color: T.text.quaternary, lineHeight: 1.45 }}>
            {ausente
              ? 'Registro de acessos desativado — rode a migration 0013 para ativar.'
              : 'Nenhum acesso registrado ainda.'}
          </span>
        </div>
      ) : (
        <div style={{ paddingBottom: 6 }}>
          {registros.map(r => (
            <div key={r.id} title={fmtDataHora(r.criado_em) + (r.ip ? ' · IP ' + r.ip : '')}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 18px', borderTop: `1px solid ${T.border.muted}` }}>
              <Avatar nome={r.usuario_nome || '?'} size={28} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 12.5, color: T.text.strong, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  <b style={{ fontWeight: 600, color: T.text.primary }}>{r.usuario_nome || 'Usuário'}</b> {fraseAcesso(r)}
                </p>
                <p style={{ margin: '1px 0 0', fontSize: 11.5, color: T.text.quaternary }}>
                  {ROTULO_USUARIO[r.usuario_tipo] || r.usuario_tipo}{r.ip ? <> · <span className="mono">{r.ip}</span></> : null}
                </p>
              </div>
              <span style={{ fontSize: 11.5, color: T.text.tertiary, whiteSpace: 'nowrap' }}>{fmtRelativo(r.criado_em)}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
