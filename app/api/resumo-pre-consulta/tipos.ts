export type ResumoPreConsulta = {
  destaque: string
  pontos: string[]
  alertas: string[]
  perguntas_sugeridas: string[]
}

export type RespostaResumoPreConsulta = {
  resumo: ResumoPreConsulta
  /** ia = gerado pela IA; dados = montado sem IA (falha/sem chave); primeira = sem histórico */
  fonte: 'ia' | 'dados' | 'primeira'
  paciente: { nome: string; idade: number | null; sexo: string | null; convenio: string | null }
  gerado_em: string
  cache?: boolean
}
