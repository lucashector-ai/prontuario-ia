'use client'
/**
 * Pré-visualização em formato de formulário da guia (modelo de campos numerados
 * da guia de consulta / SP-SADT da ANS) para imprimir com window.print().
 * Na impressão, só o elemento .tiss-impressao aparece (CSS de impressão abaixo).
 */
import React from 'react'
import { createPortal } from 'react-dom'
import type { Guia, Operadora } from '@/lib/tiss/tipos'
import { CONSELHOS, INDICACAO_ACIDENTE, TIPOS_CONSULTA, TIPOS_ATENDIMENTO, CARATER_ATENDIMENTO, UF_POR_CODIGO, totalProcedimentos } from '@/lib/tiss/tipos'
import { brl, dataBR } from './comum'

const CSS = `
.tiss-impressao { font-family: Arial, Helvetica, sans-serif; color: #000; background: #fff; }
.tiss-impressao .tg-titulo { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #000; padding-bottom: 6px; margin-bottom: 8px; }
.tiss-impressao .tg-titulo h1 { font-size: 15px; margin: 0; letter-spacing: .02em; }
.tiss-impressao .tg-sec { font-size: 10px; font-weight: 700; background: #E9E9EC; padding: 3px 6px; margin: 8px 0 4px; text-transform: uppercase; letter-spacing: .04em; }
.tiss-impressao .tg-linha { display: flex; gap: 4px; margin-bottom: 4px; }
.tiss-impressao .tg-campo { border: 1px solid #555; border-radius: 3px; padding: 2px 5px 4px; min-height: 30px; box-sizing: border-box; flex: 1; min-width: 0; }
.tiss-impressao .tg-campo label { display: block; font-size: 8.5px; color: #333; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tiss-impressao .tg-campo span { display: block; font-size: 11.5px; font-weight: 600; min-height: 14px; word-break: break-word; }
.tiss-impressao table { width: 100%; border-collapse: collapse; font-size: 10.5px; }
.tiss-impressao th, .tiss-impressao td { border: 1px solid #555; padding: 3px 5px; text-align: left; }
.tiss-impressao th { font-size: 8.5px; font-weight: 600; background: #F4F4F6; }
.tiss-impressao .tg-ass { height: 48px; }
.tiss-print-root { display: none; }
@media print {
  @page { size: A4 landscape; margin: 10mm; }
  body > *:not(.tiss-print-root) { display: none !important; }
  .tiss-print-root { display: block !important; }
}
`

function Campo({ n, rotulo, valor, flex = 1 }: { n: number | string; rotulo: string; valor?: React.ReactNode; flex?: number }) {
  return (
    <div className="tg-campo" style={{ flex }}>
      <label>{n} - {rotulo}</label>
      <span>{valor ?? ''}</span>
    </div>
  )
}

export function GuiaImpressao({ guia: g, operadora: op }: { guia: Guia; operadora?: Operadora }) {
  const p = g.profissional || {}
  const consulta = g.tipo === 'consulta'
  const proc = g.procedimentos[0]
  return (
    <div className="tiss-impressao" style={{ padding: 4 }}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="tg-titulo">
        <div style={{ fontSize: 11 }}>{op?.nome || ''}</div>
        <h1>{consulta ? 'GUIA DE CONSULTA' : 'GUIA DE SP/SADT'}</h1>
        <div style={{ fontSize: 11 }}>2 - Nº guia no prestador: <b>{g.numero_guia_prestador || '—'}</b></div>
      </div>
      <div className="tg-linha">
        <Campo n={1} rotulo="Registro ANS" valor={op?.registro_ans} />
        <Campo n={3} rotulo="Nº guia atribuído pela operadora" valor={g.numero_guia_operadora} flex={2} />
      </div>

      <div className="tg-sec">Dados do beneficiário</div>
      <div className="tg-linha">
        <Campo n={4} rotulo="Número da carteira" valor={g.numero_carteira} flex={2} />
        <Campo n={5} rotulo="Validade da carteira" />
        <Campo n={6} rotulo="Atendimento a RN" valor="N" flex={0.6} />
      </div>
      <div className="tg-linha">
        <Campo n={7} rotulo="Nome" valor={g.nome_beneficiario} flex={3} />
        <Campo n={8} rotulo="Cartão Nacional de Saúde" />
      </div>

      <div className="tg-sec">Dados do contratado</div>
      <div className="tg-linha">
        <Campo n={9} rotulo="Código na operadora" valor={op?.codigo_prestador} />
        <Campo n={10} rotulo="Nome do contratado" valor={op?.nome_contratado} flex={3} />
        <Campo n={11} rotulo="Código CNES" valor={op?.cnes || '9999999'} />
      </div>
      <div className="tg-linha">
        <Campo n={12} rotulo="Nome do profissional executante" valor={p.nome} flex={3} />
        <Campo n={13} rotulo="Conselho profissional" valor={p.conselho ? `${p.conselho} - ${CONSELHOS[p.conselho] || ''}` : ''} />
        <Campo n={14} rotulo="Número no conselho" valor={p.numero} />
        <Campo n={15} rotulo="UF" valor={p.uf ? `${p.uf} - ${UF_POR_CODIGO[p.uf] || ''}` : ''} flex={0.7} />
        <Campo n={16} rotulo="Código CBO" valor={p.cbos} />
      </div>

      <div className="tg-sec">Dados do atendimento / procedimento realizado</div>
      <div className="tg-linha">
        <Campo n={17} rotulo="Indicação de acidente" valor={`${g.indicacao_acidente || '9'} - ${INDICACAO_ACIDENTE[g.indicacao_acidente || '9']}`} flex={1.4} />
        <Campo n={18} rotulo="Data do atendimento" valor={dataBR(g.data_atendimento)} />
        {consulta
          ? <Campo n={19} rotulo="Tipo de consulta" valor={`${g.tipo_consulta || '1'} - ${TIPOS_CONSULTA[g.tipo_consulta || '1']}`} flex={1.4} />
          : <Campo n={19} rotulo="Tipo de atendimento" valor={`${g.tipo_atendimento || '05'} - ${TIPOS_ATENDIMENTO[g.tipo_atendimento || '05'] || ''}`} flex={1.4} />}
        {!consulta && <Campo n="19a" rotulo="Caráter do atendimento" valor={`${g.carater_atendimento || '1'} - ${CARATER_ATENDIMENTO[g.carater_atendimento || '1']}`} />}
      </div>
      {consulta ? (
        <div className="tg-linha">
          <Campo n={20} rotulo="Tabela" valor="22" flex={0.5} />
          <Campo n={21} rotulo="Código do procedimento" valor={proc?.codigo_tuss} />
          <Campo n="21a" rotulo="Descrição" valor={proc?.descricao} flex={3} />
          <Campo n={22} rotulo="Valor do procedimento" valor={brl(totalProcedimentos(g.procedimentos))} />
        </div>
      ) : (
        <table style={{ marginBottom: 4 }}>
          <thead><tr><th>#</th><th>Data</th><th>Tabela</th><th>Código</th><th>Descrição</th><th>Qtde</th><th>Valor unitário</th><th>Valor total</th></tr></thead>
          <tbody>
            {g.procedimentos.map((x, i) => (
              <tr key={i}>
                <td>{i + 1}</td><td>{dataBR(g.data_atendimento)}</td><td>22</td><td>{x.codigo_tuss}</td><td>{x.descricao}</td>
                <td>{x.quantidade}</td><td>{brl(x.valor_unitario)}</td><td>{brl(x.quantidade * x.valor_unitario)}</td>
              </tr>
            ))}
            <tr><td colSpan={7} style={{ textAlign: 'right', fontWeight: 700 }}>Valor total geral</td><td style={{ fontWeight: 700 }}>{brl(totalProcedimentos(g.procedimentos))}</td></tr>
          </tbody>
        </table>
      )}
      <div className="tg-linha">
        <Campo n={23} rotulo="Observação / justificativa" valor={g.observacao} />
      </div>
      <div className="tg-linha">
        <div className="tg-campo tg-ass"><label>24 - Assinatura do profissional executante</label></div>
        <div className="tg-campo tg-ass"><label>25 - Assinatura do beneficiário ou responsável</label></div>
      </div>
    </div>
  )
}

/** Cópia da guia montada direto no <body> — é o que aparece na impressão. */
export function RaizImpressao({ guia, operadora }: { guia: Guia; operadora?: Operadora }) {
  if (typeof document === 'undefined') return null
  return createPortal(
    <div className="tiss-print-root"><GuiaImpressao guia={guia} operadora={operadora} /></div>,
    document.body,
  )
}
