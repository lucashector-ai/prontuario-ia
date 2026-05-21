import React from 'react'
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'

const brl = (v: number) =>
  'R$ ' + (Number(v) || 0).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')

export interface ReciboData {
  clinicaNome: string
  reciboNum: string
  pacienteNome: string
  pacienteCpf?: string | null
  itens: { descricao: string; valor: number }[]
  totalRecebido: number
  formaPagamento: string
  data: string
}

const s = StyleSheet.create({
  page: { padding: 48, fontFamily: 'Helvetica', fontSize: 10, color: '#111827' },
  clinica: { fontSize: 15, fontWeight: 700 },
  reciboNum: { fontSize: 9, color: '#6B7280', marginTop: 3 },
  divisor: { borderBottomWidth: 1, borderBottomColor: '#E5E7EB', marginTop: 14, marginBottom: 18 },
  secaoLabel: { fontSize: 8, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  pacienteNome: { fontSize: 11, fontWeight: 700 },
  pacienteCpf: { fontSize: 9, color: '#6B7280', marginTop: 2 },
  tabelaHeader: {
    flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
    paddingBottom: 6, marginTop: 22,
  },
  thDesc: { flex: 1, fontSize: 8, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 1 },
  thValor: { width: 90, fontSize: 8, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 1, textAlign: 'right' },
  linha: {
    flexDirection: 'row', paddingVertical: 7,
    borderBottomWidth: 1, borderBottomColor: '#F3F2F3',
  },
  tdDesc: { flex: 1, fontSize: 10 },
  tdValor: { width: 90, fontSize: 10, textAlign: 'right' },
  totalLinha: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 14 },
  totalLabel: { fontSize: 10, color: '#6B7280', marginRight: 16, marginTop: 2 },
  totalValor: { fontSize: 14, fontWeight: 700 },
  meta: { flexDirection: 'row', marginTop: 28 },
  metaItem: { marginRight: 40 },
  metaLabel: { fontSize: 8, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 3 },
  metaValor: { fontSize: 10 },
  rodape: {
    marginTop: 46, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#E5E7EB',
    fontSize: 9, color: '#6B7280', lineHeight: 1.5,
  },
})

export default function ReciboPDF(d: ReciboData) {
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <Text style={s.clinica}>{d.clinicaNome}</Text>
        <Text style={s.reciboNum}>Recibo nº {d.reciboNum}</Text>
        <View style={s.divisor} />

        <Text style={s.secaoLabel}>Recebido de</Text>
        <Text style={s.pacienteNome}>{d.pacienteNome}</Text>
        {d.pacienteCpf ? <Text style={s.pacienteCpf}>CPF: {d.pacienteCpf}</Text> : null}

        <View style={s.tabelaHeader}>
          <Text style={s.thDesc}>Descrição</Text>
          <Text style={s.thValor}>Valor</Text>
        </View>
        {d.itens.map((it, i) => (
          <View key={i} style={s.linha}>
            <Text style={s.tdDesc}>{it.descricao}</Text>
            <Text style={s.tdValor}>{brl(it.valor)}</Text>
          </View>
        ))}

        <View style={s.totalLinha}>
          <Text style={s.totalLabel}>Total recebido</Text>
          <Text style={s.totalValor}>{brl(d.totalRecebido)}</Text>
        </View>

        <View style={s.meta}>
          <View style={s.metaItem}>
            <Text style={s.metaLabel}>Forma de pagamento</Text>
            <Text style={s.metaValor}>{d.formaPagamento}</Text>
          </View>
          <View style={s.metaItem}>
            <Text style={s.metaLabel}>Data</Text>
            <Text style={s.metaValor}>{d.data}</Text>
          </View>
        </View>

        <Text style={s.rodape}>
          Recebi a importância acima referente aos serviços prestados, dando plena
          e geral quitação do valor.
        </Text>
      </Page>
    </Document>
  )
}
