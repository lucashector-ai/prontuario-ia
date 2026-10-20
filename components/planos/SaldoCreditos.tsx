'use client'
/** Saldo de créditos de IA do mês: cartão completo (página de Planos) e linha curta (menu da conta). */
import { useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { tokens as T } from '@/lib/design-tokens'
import { Card, ProgressBar } from '@/components/ui'
import { tokenSessao } from '@/lib/supabase'
import { fmtCreditos, type Saldo } from '@/lib/creditos'
import { ehDemo } from '@/lib/demo'

type Dados = { saldo: Saldo | null; porMotivo: Record<string, { vezes: number; creditos: number }> }

const NOME_MOTIVO: Record<string, string> = { consulta: 'Consultas com IA', exame: 'Análises de exame', assistente: 'Perguntas ao assistente', sofia: 'Conversas da Sofia' }
const NOME_PLANO: Record<string, string> = { gratis: 'Grátis', solo: 'Solo', clinica: 'Clínica', pro: 'Pro' }

export function useCreditos() {
  const [dados, setDados] = useState<Dados | null>(null)
  useEffect(() => {
    // Demonstração: saldo de exemplo
    if (ehDemo()) { setDados({ saldo: { plano: 'clinica', limite: 1000, extras: 0, usados: 386, disponivel: 614 }, porMotivo: { consulta: { vezes: 92, creditos: 276 }, exame: { vezes: 18, creditos: 54 }, assistente: { vezes: 31, creditos: 31 }, sofia: { vezes: 250, creditos: 25 } } }); return }
    const t = tokenSessao()
    fetch('/api/creditos', { headers: t ? { Authorization: `Bearer ${t}` } : {} })
      .then(r => r.ok ? r.json() : null).then(setDados).catch(() => {})
  }, [])
  return dados
}

/** "128 de 250 créditos" — para o menu da conta. Nada aparece em conta sem limite. */
export function SaldoCurto() {
  const d = useCreditos()
  const s = d?.saldo
  if (!s || s.limite === null || s.disponivel === null) return null
  const total = s.limite + s.extras
  const baixo = s.disponivel <= total * 0.1
  return (
    <span style={{ fontSize: 11.5, fontWeight: 600, color: baixo ? T.status.danger : T.text.tertiary }}>
      {fmtCreditos(s.disponivel)} de {fmtCreditos(total)} créditos de IA
    </span>
  )
}

export function CartaoSaldo() {
  const d = useCreditos()
  const s = d?.saldo
  if (!s) return null
  const semLimite = s.limite === null
  const total = (s.limite || 0) + s.extras
  const baixo = !semLimite && (s.disponivel || 0) <= total * 0.1
  const virada = new Date(); virada.setMonth(virada.getMonth() + 1, 1)
  return (
    <Card style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ width: 34, height: 34, borderRadius: 10, display: 'grid', placeItems: 'center', background: T.brand.primaryLight, color: T.brand.primary }}><Sparkles size={17} /></span>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: T.text.primary }}>Créditos de IA deste mês</div>
          <div style={{ fontSize: 12.5, color: T.text.tertiary }}>
            {s.plano ? `Plano ${NOME_PLANO[s.plano] || s.plano}` : 'Sua conta'}{semLimite ? ' · sem limite de créditos' : ` · renova em ${virada.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}`}
          </div>
        </div>
        {!semLimite && (
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: 26, fontWeight: 750, color: baixo ? T.status.danger : T.text.primary, letterSpacing: '-.02em' }}>{fmtCreditos(s.disponivel || 0)}</span>
            <span style={{ fontSize: 13, color: T.text.tertiary }}> de {fmtCreditos(total)}</span>
          </div>
        )}
      </div>
      {!semLimite && <ProgressBar valor={total ? Math.min(100, (s.usados / total) * 100) : 0} cor={baixo ? T.status.danger : T.brand.primary} />}
      {s.extras > 0 && <div style={{ fontSize: 12.5, color: T.text.secondary }}>Inclui {fmtCreditos(s.extras)} créditos de pacotes extras.</div>}
      {d && Object.keys(d.porMotivo).length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 8 }}>
          {Object.entries(d.porMotivo).map(([m, v]) => (
            <div key={m} style={{ padding: '8px 10px', borderRadius: 10, border: `1px solid ${T.border.default}` }}>
              <div style={{ fontSize: 12, color: T.text.tertiary }}>{NOME_MOTIVO[m] || m}</div>
              <div style={{ fontSize: 14, fontWeight: 650, color: T.text.primary }}>{v.vezes} · {fmtCreditos(v.creditos)} créditos</div>
            </div>
          ))}
        </div>
      )}
      {baixo && <div style={{ fontSize: 13, fontWeight: 600, color: T.status.danger }}>Seus créditos estão acabando. Adicione um pacote abaixo para não parar a IA.</div>}
    </Card>
  )
}
