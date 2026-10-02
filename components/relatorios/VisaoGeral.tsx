'use client'
import { Stethoscope, CircleCheck, UserX, CalendarX, UserPlus, Repeat, TriangleAlert } from 'lucide-react'
import type { Resumo } from '@/lib/relatorios/calculos'
import { variacao } from '@/lib/relatorios/calculos'
import { KpiRel, Secao, T, nf, pctTxt } from './comuns'

export interface DadosVisao {
  atual: Resumo
  antes: Resumo
  novos: [number, number]
  retornos: { previstos: number; concluidos: number; fonte: 'tabela' | 'agenda' }
  retornosAntes: { previstos: number; concluidos: number }
}

export function VisaoGeral({ d, comparacao, carregando, onCsv }: {
  d: DadosVisao | null
  comparacao: string
  carregando: boolean
  onCsv: () => void
}) {
  const a = d?.atual, b = d?.antes
  const v = (x: number | null | undefined, y: number | null | undefined, pp = false) => variacao(x ?? null, y ?? null, pp) ?? undefined
  const real = v(a?.realizados, b?.realizados)
  const comp = v(a?.taxaComparecimento, b?.taxaComparecimento, true)
  const falta = v(a?.taxaFalta, b?.taxaFalta, true)
  const canc = v(a?.cancelados, b?.cancelados)
  const novos = v(d?.novos[0], d?.novos[1])
  const ret = v(d?.retornos.concluidos, d?.retornosAntes.concluidos)
  return (
    <Secao id="visao" titulo="Visão geral" descricao="Indicadores do período comparados ao período anterior de mesmo tamanho." onCsv={onCsv}>
      <style dangerouslySetInnerHTML={{ __html: `@media (max-width: 759px) {
        .rel-kpis > .rel-kpi { flex: 1 1 calc(50% - 6px) !important; padding: 13px !important; }
        .rel-kpis .rel-kpi-cmp { display: none; }
      }` }} />
      <div className="rel-kpis" style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        <KpiRel label="Atendimentos realizados" icon={Stethoscope} cor={T.data.purple} carregando={carregando}
          valor={nf(a?.realizados ?? 0)} delta={real?.delta} sinal={real?.sinal} comparacao={comparacao} />
        <KpiRel label="Comparecimento" icon={CircleCheck} cor={T.data.green} carregando={carregando}
          valor={pctTxt(a?.taxaComparecimento ?? null, 1)} delta={comp?.delta} sinal={comp?.sinal} comparacao={comparacao}
          dica="Realizados ÷ (realizados + faltas). Cancelamentos e agendamentos sem desfecho marcado ficam de fora." />
        <KpiRel label="Taxa de falta" icon={UserX} cor={T.data.pink} carregando={carregando} bomQuando="menor"
          valor={pctTxt(a?.taxaFalta ?? null, 1)} sub={a ? `${nf(a.faltas)} faltas` : undefined}
          delta={falta?.delta} sinal={falta?.sinal} comparacao={comparacao} />
        <KpiRel label="Cancelamentos" icon={CalendarX} cor={T.data.orange} carregando={carregando} bomQuando="menor"
          valor={nf(a?.cancelados ?? 0)} sub={a ? `${pctTxt(a.taxaCancelamento)} da agenda` : undefined}
          delta={canc?.delta} sinal={canc?.sinal} comparacao={comparacao} />
        <KpiRel label="Pacientes novos" icon={UserPlus} cor={T.data.blue} carregando={carregando}
          valor={nf(d?.novos[0] ?? 0)} delta={novos?.delta} sinal={novos?.sinal} comparacao={comparacao} />
        <KpiRel label="Retornos" icon={Repeat} cor={T.data.purple} carregando={carregando}
          valor={nf(d?.retornos.concluidos ?? 0)} sub={d ? `de ${nf(d.retornos.previstos)} previstos` : undefined}
          delta={ret?.delta} sinal={ret?.sinal} comparacao={comparacao}
          dica={d?.retornos.fonte === 'tabela'
            ? 'Retornos com data prevista no período (lista de retornos). Concluídos = marcados como concluídos.'
            : 'Agendamentos do tipo retorno no período. Concluídos = marcados como realizados.'} />
      </div>
      {!carregando && a && a.semDesfecho > 0 && (
        <div role="note" style={{ display: 'flex', gap: 9, alignItems: 'flex-start', padding: '10px 12px', borderRadius: 12, background: T.status.warningBg, color: T.status.warning, fontSize: 12.5, lineHeight: 1.45 }}>
          <TriangleAlert size={15} strokeWidth={1.6} style={{ flexShrink: 0, marginTop: 1 }} aria-hidden />
          <span>
            <b>{nf(a.semDesfecho)}</b> {a.semDesfecho === 1 ? 'agendamento passado está' : 'agendamentos passados estão'} sem desfecho (realizado ou faltou) e não {a.semDesfecho === 1 ? 'entra' : 'entram'} nas taxas.
            Marque na agenda para deixar o relatório mais preciso.
          </span>
        </div>
      )}
    </Secao>
  )
}
