'use client'
/** Cartões dos planos com "Quero este plano" (vira pedido por email para a equipe liberar). */
import { useState } from 'react'
import { Check, Sparkles, Coins } from 'lucide-react'
import { tokens as T } from '@/lib/design-tokens'
import { Button, Card, SegmentedControl } from '@/components/ui'
import { PLANOS_PAGOS } from '@/lib/planos'
import { CUSTO, PACOTES, PROFISSIONAL_EXTRA, fmtCreditos } from '@/lib/creditos'
import { tokenSessao } from '@/lib/supabase'
import { usePlano } from '@/lib/usePlano'
import { avisoDemo, ehDemo } from '@/lib/demo'

export function TabelaPlanos({ recurso }: { recurso?: string }) {
  const [ciclo, setCiclo] = useState<'mensal' | 'anual'>('mensal')
  const [pedido, setPedido] = useState<string | null>(null)
  const [enviando, setEnviando] = useState<string | null>(null)
  const planoAtual = usePlano()

  async function pedir(id: string, nome: string) {
    if (ehDemo()) { avisoDemo('Demonstração: nenhum pedido foi enviado.'); return }
    setEnviando(id)
    try {
      const t = tokenSessao()
      await fetch('/api/planos/interesse', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) }, body: JSON.stringify({ recurso, plano: PLANOS_PAGOS.some(p => p.id === id) ? `${nome} (${ciclo})` : nome }) })
      setPedido(id)
    } finally { setEnviando(null) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <SegmentedControl value={ciclo} onChange={v => setCiclo(v as any)} options={[{ value: 'mensal', label: 'Mensal' }, { value: 'anual', label: 'Anual (10% menos)' }]} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
        {PLANOS_PAGOS.map(p => (
          <Card key={p.id} style={{ display: 'flex', flexDirection: 'column', gap: 14, border: p.destaque ? `1.5px solid ${T.brand.primary}` : undefined }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 17, fontWeight: 750, color: T.text.primary }}>{p.nome}</span>
                {p.destaque && <span style={{ fontSize: 11, fontWeight: 700, color: T.brand.primary, background: T.brand.primaryLight, padding: '2px 8px', borderRadius: 99 }}>Mais escolhido</span>}
              </div>
              <div style={{ fontSize: 13, color: T.text.tertiary, marginTop: 2 }}>{p.para}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span style={{ fontSize: 13, color: T.text.secondary }}>R$</span>
              <span style={{ fontSize: 32, fontWeight: 750, letterSpacing: '-.03em', color: T.text.primary }}>{ciclo === 'mensal' ? p.mensal : p.anualMes}</span>
              <span style={{ fontSize: 13, color: T.text.secondary }}>/mês{ciclo === 'anual' ? ', no plano anual' : ''}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 12, background: T.brand.primaryLight, color: T.brand.primary }}>
              <Coins size={16} />
              <span style={{ fontSize: 13.5, fontWeight: 700 }}>{p.creditos.toLocaleString('pt-BR')} créditos de IA por mês</span>
              <span style={{ fontSize: 12, fontWeight: 500, opacity: .85 }}>≈ {p.creditos.toLocaleString('pt-BR')} consultas</span>
            </div>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
              {p.itens.map(i => (
                <li key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13.5, color: T.text.strong }}>
                  <Check size={15} color={T.brand.primary} style={{ flexShrink: 0, marginTop: 2 }} />{i}
                </li>
              ))}
            </ul>
            {planoAtual === p.id ? (
              <div style={{ padding: '10px 12px', borderRadius: 12, border: `1px solid ${T.border.default}`, color: T.text.secondary, fontSize: 13, fontWeight: 600, textAlign: 'center' }}>Seu plano atual</div>
            ) : pedido === p.id ? (
              <div style={{ padding: '10px 12px', borderRadius: 12, background: T.status.successBg, color: T.status.success, fontSize: 13, fontWeight: 600 }}>Pedido recebido. A equipe do Clinical 360 fala com você para ativar.</div>
            ) : (
              <Button variant={p.destaque ? 'primary' : 'secondary'} icon={Sparkles} onClick={() => pedir(p.id, p.nome)} disabled={!!enviando}>{enviando === p.id ? 'Enviando…' : `Quero o ${p.nome}`}</Button>
            )}
          </Card>
        ))}
      </div>

      {/* Como funcionam os créditos */}
      <Card style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: T.text.primary }}>Como funcionam os créditos de IA</div>
        <div style={{ fontSize: 13.5, color: T.text.secondary, lineHeight: 1.55 }}>
          Cada plano traz créditos que renovam todo mês (não acumulam). Agenda, prontuário digitado à mão, confirmações e lembretes no WhatsApp não usam créditos.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8 }}>
          {[
            ['Consulta gravada com prontuário pela IA (até ~20 min)', CUSTO.consulta],
            ['Cada ~20 min a mais de consulta', CUSTO.bloco_extra],
            ['Ver o texto enquanto grava (opcional)', CUSTO.ao_vivo],
            ['Prontuário pela IA a partir de texto digitado ou ditado', CUSTO.digitado],
            ['Análise de exame', CUSTO.exame],
            ['3 perguntas ao assistente de IA', 1],
            ['Conversa atendida pela Sofia (por paciente, por dia)', CUSTO.sofia],
          ].map(([t, c]) => (
            <div key={t as string} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '8px 10px', borderRadius: 10, border: `1px solid ${T.border.default}`, fontSize: 13 }}>
              <span style={{ color: T.text.strong }}>{t}</span>
              <b style={{ color: T.brand.primary, whiteSpace: 'nowrap' }}>{fmtCreditos(c as number)} {(c as number) === 1 ? 'crédito' : 'créditos'}</b>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 12.5, color: T.text.tertiary }}>Gerar de novo o mesmo prontuário no mesmo dia não gasta outro crédito.</div>
      </Card>

      {/* Extras */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        {PACOTES.map(pc => (
          <Card key={pc.id} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: T.text.primary }}>+{pc.creditos} créditos</div>
            <div style={{ fontSize: 13, color: T.text.tertiary }}>Pacote extra, vale 60 dias</div>
            <div style={{ fontSize: 24, fontWeight: 750, color: T.text.primary }}>R$ {pc.preco}</div>
            {pedido === pc.id
              ? <div style={{ padding: '8px 10px', borderRadius: 10, background: T.status.successBg, color: T.status.success, fontSize: 13, fontWeight: 600 }}>Pedido recebido. Liberamos os créditos em seguida.</div>
              : <Button variant="secondary" onClick={() => pedir(pc.id, `pacote de ${pc.creditos} créditos`)} disabled={!!enviando}>{enviando === pc.id ? 'Enviando…' : 'Quero este pacote'}</Button>}
          </Card>
        ))}
        <Card style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: T.text.primary }}>Profissional adicional</div>
          <div style={{ fontSize: 13, color: T.text.tertiary }}>Mais um profissional atendendo, com +{PROFISSIONAL_EXTRA.creditos} créditos por mês</div>
          <div style={{ fontSize: 24, fontWeight: 750, color: T.text.primary }}>R$ {PROFISSIONAL_EXTRA.preco}<span style={{ fontSize: 13, fontWeight: 500, color: T.text.secondary }}>/mês</span></div>
          {pedido === 'prof'
            ? <div style={{ padding: '8px 10px', borderRadius: 10, background: T.status.successBg, color: T.status.success, fontSize: 13, fontWeight: 600 }}>Pedido recebido.</div>
            : <Button variant="secondary" onClick={() => pedir('prof', 'profissional adicional')} disabled={!!enviando}>{enviando === 'prof' ? 'Enviando…' : 'Quero adicionar'}</Button>}
        </Card>
      </div>
    </div>
  )
}
