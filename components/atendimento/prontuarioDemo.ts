/**
 * Modo demonstração: conversa "gravada" de exemplo e prontuário fictício gerado a partir do texto.
 * Nada vai para a IA nem para o banco. Usado pela Nova consulta e pelo gravador do Consultório.
 *
 * O prontuário segue o assunto da conversa (alguns temas comuns); se o texto não bate com nenhum,
 * sai um registro neutro, sem diagnóstico nem CID forçados.
 */

export type ProntuarioDemo = {
  subjetivo: string; objetivo: string; avaliacao: string; plano: string
  cids: { codigo: string; descricao: string }[]
}

/** Falas da consulta de exemplo (entram aos poucos, como se estivessem sendo transcritas). */
export const FALAS_DEMO = [
  'Médico: Bom dia! O que trouxe você hoje?',
  'Paciente: Bom dia, doutora. Estou com dor de cabeça há uma semana, mais no fim do dia.',
  'Médico: Como é essa dor? Aperta, lateja?',
  'Paciente: Parece um aperto dos dois lados. Piora depois de muitas horas no computador.',
  'Médico: Teve febre, enjoo, alteração na visão ou fraqueza em algum lado do corpo?',
  'Paciente: Não, nada disso. Só tenho dormido pouco, umas cinco horas por noite.',
  'Médico: Tomou alguma medicação?',
  'Paciente: Um analgésico comum, que melhora bem.',
  'Médico: Sua pressão está 122 por 78 e o exame neurológico está normal. Vamos ajustar a rotina de sono e fazer pausas no trabalho.',
]

type Tema = { chaves: RegExp; p: ProntuarioDemo }

const TEMAS: Tema[] = [
  {
    chaves: /dor de cabe|cefal[eé]ia|enxaqueca/i,
    p: {
      subjetivo: 'Cefaleia há cerca de 1 semana, em aperto, bilateral, pior no fim do dia e após longos períodos ao computador. Nega febre, náuseas, alterações visuais ou déficit motor. Sono reduzido (~5 h/noite). Melhora com analgésico comum.',
      objetivo: 'Bom estado geral. PA 122x78 mmHg. Exame neurológico sumário sem alterações.',
      avaliacao: 'Quadro compatível com cefaleia do tipo tensional, sem sinais de alarme.',
      plano: 'Analgésico simples se necessário. Pausas regulares no trabalho e higiene do sono. Orientado a procurar atendimento se surgirem sinais de alarme. Reavaliar se não houver melhora.',
      cids: [{ codigo: 'G44.2', descricao: 'Cefaleia tensional' }],
    },
  },
  {
    chaves: /tosse|garganta|coriza|resfriad|gripe/i,
    p: {
      subjetivo: 'Sintomas respiratórios altos há poucos dias (tosse/coriza/dor de garganta). Nega falta de ar.',
      objetivo: 'Bom estado geral, afebril no momento. Orofaringe levemente hiperemiada. Ausculta pulmonar sem alterações.',
      avaliacao: 'Quadro compatível com infecção de vias aéreas superiores, sem sinais de gravidade.',
      plano: 'Hidratação, repouso e sintomáticos. Retornar se houver febre persistente ou falta de ar.',
      cids: [{ codigo: 'J06.9', descricao: 'Infecção aguda das vias aéreas superiores' }],
    },
  },
  {
    chaves: /lombar|costas|coluna/i,
    p: {
      subjetivo: 'Dor lombar após esforço, sem irradiação para as pernas.',
      objetivo: 'Dor à palpação da musculatura paravertebral. Sem déficit neurológico.',
      avaliacao: 'Lombalgia mecânica.',
      plano: 'Analgesia, calor local e alongamentos. Reavaliar se piorar ou surgir irradiação.',
      cids: [{ codigo: 'M54.5', descricao: 'Dor lombar baixa' }],
    },
  },
  {
    chaves: /rotina|check-?up|preventiv/i,
    p: {
      subjetivo: 'Consulta de rotina. Sem queixas no momento.',
      objetivo: 'Bom estado geral. Sinais vitais dentro da normalidade.',
      avaliacao: 'Sem achados relevantes.',
      plano: 'Exames de rotina conforme idade. Manter hábitos saudáveis.',
      cids: [{ codigo: 'Z00.0', descricao: 'Exame médico geral' }],
    },
  },
]

/** Prontuário fictício a partir do texto da consulta (gravado ou digitado). */
export function prontuarioDemo(texto: string): ProntuarioDemo {
  const tema = TEMAS.find(t => t.chaves.test(texto))
  if (tema) return { ...tema.p, cids: [...tema.p.cids] }
  // Neutro: resume o que foi dito pelo paciente, sem diagnóstico inventado
  const doPaciente = texto.split('\n')
    .filter(l => !/^\s*(m[eé]dic[oa]|dr[a]?\.?)\s*:/i.test(l))
    .map(l => l.replace(/^\s*[^:]{1,20}:\s*/, '').trim())
    .filter(Boolean).join(' ')
  const relato = (doPaciente || texto).replace(/\s+/g, ' ').trim()
  return {
    subjetivo: relato.length > 280 ? relato.slice(0, 277) + '…' : relato,
    objetivo: 'Bom estado geral. Sem outros dados de exame registrados na conversa.',
    avaliacao: 'Queixa registrada para acompanhamento. Sem sinais de alarme no relato.',
    plano: 'Orientações gerais. Reavaliar conforme a evolução.',
    cids: [],
  }
}

/** Liga a "transcrição" de exemplo: chama onTexto com as falas, uma a uma. Devolve a função de parar. */
export function simularTranscricaoDemo(onTexto: (t: string) => void, intervaloMs = 1400): () => void {
  let i = 0
  const t = setInterval(() => {
    i = Math.min(i + 1, FALAS_DEMO.length)
    onTexto(FALAS_DEMO.slice(0, i).join('\n'))
    if (i >= FALAS_DEMO.length) clearInterval(t)
  }, intervaloMs)
  return () => clearInterval(t)
}
