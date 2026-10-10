/**
 * Leitura de CSV para importação (pacientes etc.).
 */
/** CSV com aspas ("Hipertensão, Diabetes"), separador vírgula ou ponto e vírgula, e BOM do Excel. */
export function parsearCSV(texto: string): Record<string, string>[] {
  const t = texto.replace(/^\uFEFF/, '')
  const primeira = t.split(/\r?\n/, 1)[0] || ''
  const sep = (primeira.match(/;/g) || []).length > (primeira.match(/,/g) || []).length ? ';' : ','
  const linhas: string[][] = []
  let campo = '', linha: string[] = [], aspas = false
  for (let i = 0; i < t.length; i++) {
    const c = t[i]
    if (aspas) {
      if (c === '"' && t[i + 1] === '"') { campo += '"'; i++ }
      else if (c === '"') aspas = false
      else campo += c
    } else if (c === '"') aspas = true
    else if (c === sep) { linha.push(campo); campo = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++
      linha.push(campo); campo = ''
      if (linha.some(v => v.trim())) linhas.push(linha)
      linha = []
    } else campo += c
  }
  linha.push(campo)
  if (linha.some(v => v.trim())) linhas.push(linha)
  if (linhas.length < 2) return []
  const cabecalho = linhas[0].map(c => c.trim())
  return linhas.slice(1).map(vals => {
    const obj: any = {}
    cabecalho.forEach((col, k) => { obj[col] = (vals[k] || '').trim() })
    return obj
  })
}
