/**
 * Lista curada de códigos TUSS (tabela 22 — procedimentos e eventos em saúde)
 * frequentes em clínicas e consultórios. É uma REFERÊNCIA RÁPIDA para o
 * autocomplete: a fonte da verdade é a tabela TUSS vigente da ANS e a tabela
 * de preços negociada com cada operadora (cadastrada em Faturamento › Operadoras).
 */

export type ItemTuss = { codigo: string; descricao: string; grupo: 'Consulta' | 'Exame laboratorial' | 'Exame cardiológico' | 'Imagem' | 'Procedimento' | 'Terapia' }

export const CODIGO_CONSULTA_CONSULTORIO = '10101012'

export const TUSS_COMUNS: ItemTuss[] = [
  // Consultas e visitas
  { codigo: '10101012', descricao: 'Consulta em consultório (no horário normal ou preestabelecido)', grupo: 'Consulta' },
  { codigo: '10101020', descricao: 'Consulta em domicílio', grupo: 'Consulta' },
  { codigo: '10101039', descricao: 'Consulta em pronto-socorro', grupo: 'Consulta' },
  { codigo: '10102019', descricao: 'Visita hospitalar (paciente internado)', grupo: 'Consulta' },
  // Laboratório
  { codigo: '40304361', descricao: 'Hemograma com contagem de plaquetas ou frações', grupo: 'Exame laboratorial' },
  { codigo: '40302040', descricao: 'Glicose - pesquisa e/ou dosagem', grupo: 'Exame laboratorial' },
  { codigo: '40302075', descricao: 'Hemoglobina glicada (fração A1c) - pesquisa e/ou dosagem', grupo: 'Exame laboratorial' },
  { codigo: '40301630', descricao: 'Creatinina - pesquisa e/ou dosagem', grupo: 'Exame laboratorial' },
  { codigo: '40302580', descricao: 'Ureia - pesquisa e/ou dosagem', grupo: 'Exame laboratorial' },
  { codigo: '40301583', descricao: 'Colesterol total - pesquisa e/ou dosagem', grupo: 'Exame laboratorial' },
  { codigo: '40301567', descricao: 'Colesterol (HDL) - pesquisa e/ou dosagem', grupo: 'Exame laboratorial' },
  { codigo: '40302733', descricao: 'Triglicerídeos - pesquisa e/ou dosagem', grupo: 'Exame laboratorial' },
  { codigo: '40301150', descricao: 'Ácido úrico - pesquisa e/ou dosagem', grupo: 'Exame laboratorial' },
  { codigo: '40302504', descricao: 'Transaminase oxalacética (TGO/AST) - pesquisa e/ou dosagem', grupo: 'Exame laboratorial' },
  { codigo: '40302512', descricao: 'Transaminase pirúvica (TGP/ALT) - pesquisa e/ou dosagem', grupo: 'Exame laboratorial' },
  { codigo: '40302318', descricao: 'Potássio - pesquisa e/ou dosagem', grupo: 'Exame laboratorial' },
  { codigo: '40302423', descricao: 'Sódio - pesquisa e/ou dosagem', grupo: 'Exame laboratorial' },
  { codigo: '40316491', descricao: 'Hormônio tireoestimulante (TSH) - pesquisa e/ou dosagem', grupo: 'Exame laboratorial' },
  { codigo: '40316521', descricao: 'Tiroxina livre (T4 livre) - pesquisa e/ou dosagem', grupo: 'Exame laboratorial' },
  { codigo: '40302830', descricao: '25-hidroxivitamina D - pesquisa e/ou dosagem', grupo: 'Exame laboratorial' },
  { codigo: '40311210', descricao: 'Urina - rotina (EAS)', grupo: 'Exame laboratorial' },
  { codigo: '40308391', descricao: 'Proteína C reativa, quantitativa', grupo: 'Exame laboratorial' },
  { codigo: '40601137', descricao: 'Citopatológico cérvico-vaginal oncótico (Papanicolaou)', grupo: 'Exame laboratorial' },
  // Cardiologia
  { codigo: '40101010', descricao: 'ECG convencional de até 12 derivações', grupo: 'Exame cardiológico' },
  { codigo: '40101037', descricao: 'Holter de 24 horas - 2 ou mais canais', grupo: 'Exame cardiológico' },
  // Imagem
  { codigo: '40805026', descricao: 'RX - Tórax - 2 incidências (PA e perfil)', grupo: 'Imagem' },
  { codigo: '40901114', descricao: 'US - Abdome superior', grupo: 'Imagem' },
  { codigo: '40901122', descricao: 'US - Abdome total', grupo: 'Imagem' },
  { codigo: '40901203', descricao: 'US - Tireoide', grupo: 'Imagem' },
  { codigo: '40808041', descricao: 'Mamografia convencional bilateral', grupo: 'Imagem' },
  // Procedimentos em consultório e terapias
  { codigo: '20104090', descricao: 'Infiltração / aplicação intra-articular', grupo: 'Procedimento' },
  { codigo: '31601014', descricao: 'Acupuntura - sessão', grupo: 'Terapia' },
  { codigo: '50000470', descricao: 'Sessão de psicoterapia individual', grupo: 'Terapia' },
]

const sem = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/**
 * Busca por código (prefixo, ignorando pontos/traços) ou por palavras da descrição.
 * `extras` (ex.: tabela de preços da operadora) vem primeiro e tem prioridade.
 */
export function buscarTuss(
  termo: string,
  extras: Array<{ codigo: string; descricao: string; valor?: number }> = [],
  limite = 8,
): Array<{ codigo: string; descricao: string; valor?: number; daTabela: boolean }> {
  const t = sem(termo.trim())
  const digitos = t.replace(/[\s.\-]/g, '')
  const palavras = t.split(/\s+/).filter(Boolean)
  const casa = (codigo: string, descricao: string) => {
    if (!t) return true
    if (/^\d+$/.test(digitos)) return codigo.startsWith(digitos)
    const d = sem(descricao)
    return palavras.every(p => d.includes(p))
  }
  const vistos = new Set<string>()
  const saida: Array<{ codigo: string; descricao: string; valor?: number; daTabela: boolean }> = []
  for (const e of extras) {
    if (casa(e.codigo, e.descricao) && !vistos.has(e.codigo)) { vistos.add(e.codigo); saida.push({ ...e, daTabela: true }) }
  }
  for (const e of TUSS_COMUNS) {
    if (casa(e.codigo, e.descricao) && !vistos.has(e.codigo)) { vistos.add(e.codigo); saida.push({ codigo: e.codigo, descricao: e.descricao, daTabela: false }) }
  }
  return saida.slice(0, limite)
}

export function descricaoTuss(codigo: string): string | undefined {
  return TUSS_COMUNS.find(t => t.codigo === codigo)?.descricao
}
