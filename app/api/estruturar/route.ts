import { log } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { MODELOS } from '@/lib/ai/models'
import { resolverModelo, ehModeloSoap, type ModeloProntuario, type CampoSoap } from '@/lib/ai/modelos-prontuario'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const TEMPLATES: Record<string, string> = {
  psiquiatria: 'Enfatize: humor e afeto, padroes de pensamento, avaliacao de risco (suicida/heteroagressividade), medicamentos psiquiatricos em uso.',
  cardiologia: 'Enfatize: fatores de risco cardiovascular (HAS, DM, tabagismo, dislipidemia), sintomas cardiacos (precordialgia, dispneia, palpitacoes), ausculta e PA em ambos os bracos.',
  dermatologia: 'Enfatize: descricao das lesoes (morfologia, distribuicao, cor, tamanho), tempo de evolucao, fatores desencadeantes, tratamentos topicos em uso.',
  pediatria: 'Enfatize: idade em meses/anos, peso e altura com percentis, vacinacao em dia, desenvolvimento neuropsicomotor, quem acompanha a crianca.',
  ginecologia: 'Enfatize: data da ultima menstruacao (DUM), regularidade, ultimo Papanicolau, anticoncepcional em uso, historico obstetrico (G P A).',
  ortopedia: 'Enfatize: localizacao exata da dor, mecanismo de lesao, EVA (escala 0-10), limitacao funcional.',
}

function getTemplate(especialidade: string): string {
  const esp = (especialidade || '').toLowerCase()
  for (const [key, tmpl] of Object.entries(TEMPLATES)) {
    if (esp.includes(key)) return tmpl
  }
  return ''
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { transcricao, especialidade, pre_consulta } = body
    // `modelo` opcional: id de modelo do sistema ou objeto { nome, secoes }.
    // Sem modelo (ou SOAP) → comportamento e formato de resposta originais.
    const modelo = resolverModelo(body.modelo)

    if (!transcricao || transcricao.trim().length < 20) {
      return NextResponse.json({ error: 'Transcricao muito curta' }, { status: 400 })
    }

    const template = getTemplate(especialidade || modelo?.especialidade || '')

    if (modelo && !ehModeloSoap(modelo)) {
      const prontuario = await estruturarComModelo(modelo, transcricao, template, pre_consulta)
      return NextResponse.json({ prontuario })
    }

    const partes = [
      'Voce e um assistente medico especializado em documentacao clinica brasileira.',
      'Analise a transcricao abaixo e estruture um prontuario completo no formato SOAP.',
      '',
      'REGRAS:',
      '- Escreva em portugues brasileiro formal e tecnico',
      '- Use apenas informacoes presentes na transcricao',
      '- Se alguma secao nao tiver informacoes, escreva "Nao mencionado na consulta"',
      '- Sugira de 1 a 3 CIDs mais provaveis',
      template ? 'INSTRUCOES ESPECIFICAS: ' + template : '',
      '',
      'Retorne EXATAMENTE este JSON sem texto antes ou depois:',
      '{',
      '  "subjetivo": "Queixas e historia da doenca",',
      '  "objetivo": "Exame fisico e achados objetivos",',
      '  "avaliacao": "Hipoteses diagnosticas e raciocinio clinico",',
      '  "plano": "Conduta: medicamentos, exames, orientacoes, retorno",',
      '  "cids": [{ "codigo": "X00", "descricao": "Nome", "justificativa": "Por que" }],',
      '  "alertas": ["alertas importantes se houver"],',
      '  "hipoteses": [{ "nome": "Nome", "probabilidade": "alta|media|baixa", "justificativa": "Breve" }],',
      '  "resumo_copiloto": "Uma frase descrevendo o caso clinico principal"',
      '}',
      '',
      'TRANSCRICAO:',
      transcricao,
    ]

    if (pre_consulta) {
      partes.push('')
      partes.push('PRE-CONSULTA (respondido pelo paciente antes):')
      partes.push(pre_consulta)
    }

    const prompt = partes.filter(Boolean).join('\n')

    const message = await anthropic.messages.create({
      model: MODELOS.apoio,
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    })

    const conteudo = message.content[0].type === 'text' ? message.content[0].text : ''
    const inicio = conteudo.indexOf('{')
    const fim = conteudo.lastIndexOf('}')
    const jsonStr = inicio >= 0 && fim >= 0 ? conteudo.slice(inicio, fim + 1) : conteudo
    const prontuario = JSON.parse(jsonStr)

    return NextResponse.json({ prontuario })
  } catch (error: any) {
    log.error('Erro Claude:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// ── Estruturação com modelo de prontuário (não-SOAP) ─────────────────────────

const CAMPOS_SOAP: CampoSoap[] = ['subjetivo', 'objetivo', 'avaliacao', 'plano']

async function estruturarComModelo(modelo: ModeloProntuario, transcricao: string, template: string, preConsulta?: string) {
  const listaSecoes = modelo.secoes.map((sec, i) =>
    `${i + 1}. "${sec.titulo}"${sec.obrigatoria ? '' : ' (opcional)'}${sec.instrucao ? ' — ' + sec.instrucao : ''}`
  ).join('\n')

  const partes = [
    'Voce e um assistente medico especializado em documentacao clinica brasileira.',
    `Analise a transcricao abaixo e estruture o prontuario no modelo "${modelo.nome}"${modelo.especialidade ? ' (' + modelo.especialidade + ')' : ''}, seguindo EXATAMENTE estas secoes, nesta ordem:`,
    listaSecoes,
    '',
    'REGRAS:',
    '- Escreva em portugues brasileiro formal e tecnico',
    '- Use apenas informacoes presentes na transcricao',
    '- Se uma secao nao tiver informacoes, escreva "Nao mencionado na consulta" (secoes opcionais sem informacao podem ficar com esse texto tambem)',
    '- Os campos subjetivo, objetivo, avaliacao e plano devem redistribuir o MESMO conteudo das secoes no formato SOAP (para compatibilidade)',
    '- Sugira de 1 a 3 CIDs mais provaveis',
    template ? 'INSTRUCOES ESPECIFICAS: ' + template : '',
    '',
    'Retorne EXATAMENTE este JSON sem texto antes ou depois:',
    '{',
    '  "secoes": [{ "titulo": "Titulo da secao, igual ao modelo", "conteudo": "Texto da secao" }],',
    '  "subjetivo": "Queixas e historia da doenca",',
    '  "objetivo": "Exame fisico e achados objetivos",',
    '  "avaliacao": "Hipoteses diagnosticas e raciocinio clinico",',
    '  "plano": "Conduta: medicamentos, exames, orientacoes, retorno",',
    '  "cids": [{ "codigo": "X00", "descricao": "Nome", "justificativa": "Por que" }],',
    '  "alertas": ["alertas importantes se houver"],',
    '  "hipoteses": [{ "nome": "Nome", "probabilidade": "alta|media|baixa", "justificativa": "Breve" }],',
    '  "resumo_copiloto": "Uma frase descrevendo o caso clinico principal"',
    '}',
    '',
    'TRANSCRICAO:',
    transcricao,
  ]
  if (preConsulta) {
    partes.push('')
    partes.push('PRE-CONSULTA (respondido pelo paciente antes):')
    partes.push(preConsulta)
  }

  const message = await anthropic.messages.create({
    model: MODELOS.apoio,
    max_tokens: 3000,
    messages: [{ role: 'user', content: partes.filter(Boolean).join('\n') }],
  })

  const conteudo = message.content[0].type === 'text' ? message.content[0].text : ''
  const inicio = conteudo.indexOf('{')
  const fim = conteudo.lastIndexOf('}')
  const prontuario = JSON.parse(inicio >= 0 && fim >= 0 ? conteudo.slice(inicio, fim + 1) : conteudo)

  // Garante as seções na ordem do modelo
  const recebidas: Array<{ titulo: string; conteudo: string }> = Array.isArray(prontuario.secoes) ? prontuario.secoes : []
  const norm = (t: string) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
  prontuario.secoes = modelo.secoes.map((sec, i) => {
    const achada = recebidas.find(r => norm(r?.titulo) === norm(sec.titulo)) || recebidas[i]
    return { titulo: sec.titulo, conteudo: typeof achada?.conteudo === 'string' ? achada.conteudo : 'Nao mencionado na consulta' }
  })

  // Preenche SOAP ausente a partir das seções (quem lê subjetivo/objetivo/... não quebra)
  for (const campo of CAMPOS_SOAP) {
    if (typeof prontuario[campo] === 'string' && prontuario[campo].trim()) continue
    const doCampo = modelo.secoes
      .map((sec, i) => ({ sec, conteudo: prontuario.secoes[i].conteudo }))
      .filter(x => x.sec.soap === campo)
      .map(x => `${x.sec.titulo}: ${x.conteudo}`)
    prontuario[campo] = doCampo.length ? doCampo.join('\n\n')
      : campo === 'subjetivo' ? prontuario.secoes.map((x: any) => `${x.titulo}: ${x.conteudo}`).join('\n\n')
      : 'Nao mencionado na consulta'
  }
  if (!Array.isArray(prontuario.cids)) prontuario.cids = []
  if (!Array.isArray(prontuario.alertas)) prontuario.alertas = []
  if (!Array.isArray(prontuario.hipoteses)) prontuario.hipoteses = []
  return prontuario
}
