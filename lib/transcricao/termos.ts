/**
 * Vocabulário que o Deepgram (Nova-3) deve priorizar ("keyterm prompting").
 * Limite da Deepgram: ~500 tokens somando todos os termos — mantenha a lista enxuta
 * e prefira palavras que a IA costuma errar (nomes de remédios, exames, siglas).
 */
export const TERMOS_MEDICOS_BASE = [
  // medicamentos frequentes
  'losartana', 'metformina', 'omeprazol', 'pantoprazol', 'atenolol', 'sinvastatina', 'atorvastatina', 'rosuvastatina',
  'amoxicilina', 'azitromicina', 'cefalexina', 'ciprofloxacino', 'dipirona', 'ibuprofeno', 'paracetamol', 'nimesulida',
  'enalapril', 'captopril', 'anlodipino', 'hidroclorotiazida', 'furosemida', 'espironolactona', 'carvedilol',
  'levotiroxina', 'prednisona', 'prednisolona', 'dexametasona', 'insulina', 'glicazida', 'empagliflozina', 'dapagliflozina',
  'sertralina', 'escitalopram', 'fluoxetina', 'clonazepam', 'alprazolam', 'amitriptilina', 'quetiapina',
  'AAS', 'clopidogrel', 'varfarina', 'rivaroxabana', 'apixabana', 'salbutamol', 'budesonida', 'loratadina', 'desloratadina',
  'ondansetrona', 'bromoprida', 'domperidona', 'escopolamina', 'tramadol', 'ciclobenzaprina',
  // exames
  'hemograma', 'creatinina', 'ureia', 'HbA1c', 'hemoglobina glicada', 'TSH', 'T4 livre', 'PCR', 'VHS', 'TGO', 'TGP',
  'gama GT', 'colesterol total', 'HDL', 'LDL', 'triglicerídeos', 'ferritina', 'vitamina D', 'B12', 'EAS', 'urocultura',
  'eletrocardiograma', 'ecocardiograma', 'ultrassonografia', 'tomografia', 'ressonância', 'espirometria', 'MAPA', 'Holter',
  // termos clínicos
  'hipertensão', 'diabetes', 'dislipidemia', 'hipotireoidismo', 'DPOC', 'asma', 'enxaqueca', 'lombalgia', 'cefaleia',
  'dispneia', 'disúria', 'polaciúria', 'epigastralgia', 'pirose', 'mialgia', 'artralgia', 'parestesia', 'síncope',
  'anamnese', 'prescrição', 'posologia', 'miligramas', 'comprimido', 'de 12 em 12 horas', 'de 8 em 8 horas',
]

/** Parâmetro `keyterm=` repetido, sem estourar o limite. */
export function paramsTermos(termos: string[], max = 100): string {
  const vistos = new Set<string>()
  const lista: string[] = []
  for (const t of termos) {
    const k = t.trim()
    if (!k || k.length > 40 || vistos.has(k.toLowerCase())) continue
    vistos.add(k.toLowerCase())
    lista.push(k)
    if (lista.length >= max) break
  }
  return lista.map(t => `keyterm=${encodeURIComponent(t)}`).join('&')
}

/** Parâmetros do Deepgram comuns ao ao vivo e à revisão final. */
export const PARAMS_DEEPGRAM = 'model=nova-3&language=pt-BR&smart_format=true&punctuate=true&diarize=true&numerals=true'

/**
 * Monta o texto com troca de falante: "Falante 1: ...\nFalante 2: ..."
 * `palavras` no formato da Deepgram ({ punctuated_word, word, speaker }).
 */
export function textoComFalantes(palavras: { word: string; punctuated_word?: string; speaker?: number }[]): string {
  let texto = ''
  let atual: number | undefined
  for (const p of palavras) {
    const w = p.punctuated_word || p.word
    if (p.speaker !== undefined && p.speaker !== atual) {
      atual = p.speaker
      texto += (texto ? '\n' : '') + `Falante ${atual + 1}: `
    } else if (texto) texto += ' '
    texto += w
  }
  return texto.trim()
}
