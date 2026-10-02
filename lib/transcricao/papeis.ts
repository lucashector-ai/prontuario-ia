/**
 * Conversa da consulta com papéis (Médico / Paciente / Acompanhante).
 *
 * A IA não reescreve nada: o texto é dividido em frases numeradas e ela só diz quem
 * falou cada uma. A conversa é remontada com o texto original — palavra por palavra.
 */
export type Papel = 'medico' | 'paciente' | 'acompanhante'
export type Frase = { falante?: number; texto: string }
export type Turno = { papel: Papel | null; rotulo: string; texto: string }

export const ROTULO_PAPEL: Record<Papel, string> = {
  medico: 'Médico',
  paciente: 'Paciente',
  acompanhante: 'Acompanhante',
}
const CODIGO: Record<string, Papel> = { M: 'medico', P: 'paciente', A: 'acompanhante' }

/** Quebra o texto (com ou sem "Falante N:") em frases, guardando o falante quando houver. */
export function frasesDe(texto: string): Frase[] {
  const frases: Frase[] = []
  for (const linha of texto.split('\n')) {
    const m = /^Falante (\d+):\s*(.*)$/.exec(linha.trim())
    const falante = m ? Number(m[1]) : undefined
    const corpo = (m ? m[2] : linha).trim()
    if (!corpo) continue
    for (const f of corpo.split(/(?<=[.!?…])\s+/)) {
      if (f.trim()) frases.push({ falante, texto: f.trim() })
    }
  }
  return frases
}

/** Junta frases seguidas do mesmo papel em turnos e gera o texto "Médico: …\nPaciente: …". */
export function montarConversa(frases: Frase[], codigos: string[]): { texto: string; turnos: Turno[] } {
  const turnos: Turno[] = []
  frases.forEach((f, i) => {
    const papel = CODIGO[(codigos[i] || '').toUpperCase()] || null
    const ult = turnos[turnos.length - 1]
    if (ult && ult.papel === papel) ult.texto += ' ' + f.texto
    else turnos.push({ papel, rotulo: papel ? ROTULO_PAPEL[papel] : 'Fala', texto: f.texto })
  })
  return { turnos, texto: turnos.map(t => `${t.rotulo}: ${t.texto}`).join('\n') }
}

/** Lê um texto já rotulado ("Médico: …", "Paciente: …", "Falante 2: …") em turnos para exibir. */
export function lerConversa(texto: string): Turno[] {
  const turnos: Turno[] = []
  for (const linha of (texto || '').split('\n')) {
    const l = linha.trim()
    if (!l) continue
    const m = /^(Médico|Medico|Paciente|Acompanhante|Falante \d+):\s*(.*)$/.exec(l)
    if (!m) { turnos.push({ papel: null, rotulo: '', texto: l }); continue }
    const r = m[1]
    const papel: Papel | null = /^M[ée]dico$/.test(r) ? 'medico' : r === 'Paciente' ? 'paciente' : r === 'Acompanhante' ? 'acompanhante' : null
    turnos.push({ papel, rotulo: papel ? ROTULO_PAPEL[papel] : r, texto: m[2] })
  }
  return turnos
}

/** O texto já tem papéis identificados? */
export function temPapeis(texto: string) {
  return /^(Médico|Paciente|Acompanhante):/m.test(texto || '')
}

/** Pedido à IA: um código (M/P/A) por frase numerada. */
export function promptPapeis(frases: Frase[]): string {
  const temFalantes = frases.some(f => f.falante !== undefined)
  const lista = frases.map((f, i) => `${i + 1}. ${f.falante !== undefined ? `[voz ${f.falante}] ` : ''}${f.texto}`).join('\n')
  return [
    'Abaixo está a transcrição de uma consulta médica, dividida em frases numeradas.',
    temFalantes
      ? 'O sistema de reconhecimento de voz marcou [voz N] em cada frase. Essa marcação costuma estar certa, mas pode errar: use-a como pista forte, não como verdade absoluta.'
      : 'Não há marcação de quem fala — deduza pelo conteúdo.',
    '',
    'Diga quem falou CADA frase:',
    '- M = médico(a): faz perguntas clínicas, examina, explica diagnóstico, prescreve, pede exames, orienta.',
    '- P = paciente: relata sintomas, histórico, responde sobre si mesmo.',
    '- A = acompanhante: fala do paciente em 3ª pessoa (ex.: mãe de criança, filho de idoso). Só use se houver indício claro.',
    'Perguntas costumam vir do médico e as respostas do paciente; uma mesma pessoa pode dizer várias frases seguidas.',
    '',
    `Responda SOMENTE um JSON: {"papeis": ["M","P",...]} com exatamente ${frases.length} itens, na ordem das frases.`,
    '',
    lista,
  ].join('\n')
}
