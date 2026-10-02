/**
 * Modelos de prontuário (seções que a IA usa para estruturar a consulta).
 *
 * Os modelos do SISTEMA ficam aqui no código — não dependem do banco.
 * Os personalizados ficam na tabela `modelos_prontuario` (migration 0014).
 * Arquivo seguro para cliente e servidor (sem imports de servidor).
 */

/** Campo SOAP que recebe o conteúdo da seção (compatibilidade com quem lê o prontuário). */
export type CampoSoap = 'subjetivo' | 'objetivo' | 'avaliacao' | 'plano'

export type SecaoModelo = {
  id: string
  titulo: string
  /** O que a IA deve escrever nesta seção */
  instrucao: string
  obrigatoria: boolean
  /** Opcional: em qual campo SOAP o conteúdo entra quando o modelo não é SOAP */
  soap?: CampoSoap
}

export type ModeloProntuario = {
  id: string
  nome: string
  especialidade: string
  descricao?: string
  secoes: SecaoModelo[]
  /** true = embutido no código, não editável */
  sistema?: boolean
  padrao?: boolean
  medico_id?: string | null
  clinica_id?: string | null
  criado_em?: string
}

export const ID_MODELO_SOAP = 'soap'

const s = (id: string, titulo: string, instrucao: string, soap?: CampoSoap, obrigatoria = true): SecaoModelo =>
  ({ id, titulo, instrucao, obrigatoria, soap })

export const MODELOS_SISTEMA: ModeloProntuario[] = [
  {
    id: 'soap', nome: 'SOAP', especialidade: 'Geral', sistema: true,
    descricao: 'Subjetivo, objetivo, avaliação e plano. Padrão para a maioria das consultas.',
    secoes: [
      s('subjetivo', 'Subjetivo', 'Queixa principal, história da doença atual, antecedentes relevantes e medicações em uso, na voz do paciente organizada tecnicamente.', 'subjetivo'),
      s('objetivo', 'Objetivo', 'Sinais vitais, exame físico e resultados de exames citados na consulta.', 'objetivo'),
      s('avaliacao', 'Avaliação', 'Hipóteses diagnósticas e raciocínio clínico que as sustenta.', 'avaliacao'),
      s('plano', 'Plano', 'Conduta: medicamentos com posologia, exames solicitados, orientações e retorno.', 'plano'),
    ],
  },
  {
    id: 'livre', nome: 'Livre', especialidade: 'Geral', sistema: true,
    descricao: 'Resumo corrido da consulta, em texto contínuo, sem divisão rígida.',
    secoes: [
      s('resumo', 'Resumo da consulta', 'Texto corrido, em parágrafos curtos, narrando motivo da consulta, achados relevantes, impressão diagnóstica e conduta, na ordem em que aparecem.', 'subjetivo'),
      s('conduta', 'Conduta e próximos passos', 'Lista objetiva do que foi prescrito, solicitado e orientado, e quando retornar.', 'plano'),
    ],
  },
  {
    id: 'pediatria', nome: 'Pediatria', especialidade: 'Pediatria', sistema: true,
    descricao: 'Inclui crescimento, desenvolvimento, vacinação e orientações aos responsáveis.',
    secoes: [
      s('identificacao', 'Identificação e acompanhante', 'Idade em anos e meses, quem acompanha a criança e quem é o informante.', 'subjetivo'),
      s('queixa', 'Queixa e história atual', 'Queixa principal e evolução, com duração, febre, alimentação, sono, diurese e evacuações.', 'subjetivo'),
      s('antecedentes', 'Antecedentes', 'Gestação, parto, período neonatal, internações, alergias e medicações em uso.', 'subjetivo', false),
      s('crescimento', 'Crescimento', 'Peso, estatura, perímetro cefálico (se citado) e percentis ou escore-z quando mencionados.', 'objetivo'),
      s('desenvolvimento', 'Desenvolvimento neuropsicomotor', 'Marcos do desenvolvimento esperados para a idade e se estão adequados; atrasos citados.', 'objetivo'),
      s('vacinacao', 'Vacinação', 'Situação da caderneta vacinal e vacinas pendentes ou aplicadas.', 'objetivo'),
      s('exame', 'Exame físico', 'Estado geral, hidratação, sinais vitais e achados por sistema.', 'objetivo'),
      s('avaliacao', 'Avaliação', 'Hipóteses diagnósticas e raciocínio.', 'avaliacao'),
      s('conduta', 'Conduta', 'Medicamentos com dose por peso (mg/kg) quando houver, exames e retorno.', 'plano'),
      s('orientacoes', 'Orientações aos responsáveis', 'Cuidados em casa e sinais de alarme que exigem retorno imediato, em linguagem simples.', 'plano'),
    ],
  },
  {
    id: 'psiquiatria', nome: 'Psiquiatria / Psicologia', especialidade: 'Psiquiatria', sistema: true,
    descricao: 'Com exame do estado mental e avaliação de risco.',
    secoes: [
      s('queixa', 'Queixa e história atual', 'Motivo da consulta, início e evolução dos sintomas, gatilhos e impacto no funcionamento.', 'subjetivo'),
      s('historia', 'História psiquiátrica e social', 'Tratamentos e internações anteriores, uso de substâncias, rede de apoio, trabalho e relações.', 'subjetivo', false),
      s('medicacoes', 'Medicações em uso', 'Psicofármacos e outras medicações com dose, adesão e efeitos adversos relatados.', 'subjetivo', false),
      s('eem', 'Exame do estado mental', 'Aparência, atitude, consciência, orientação, atenção, memória, humor e afeto, pensamento (curso, forma e conteúdo), sensopercepção, juízo crítico e insight.', 'objetivo'),
      s('risco', 'Avaliação de risco', 'Ideação, planejamento ou tentativas de suicídio, autolesão e heteroagressividade; fatores de risco e de proteção. Se não foi avaliado, escreva "Não avaliado na consulta".', 'avaliacao'),
      s('avaliacao', 'Hipótese diagnóstica', 'Hipóteses (CID-10/DSM) e raciocínio.', 'avaliacao'),
      s('plano', 'Plano terapêutico', 'Ajustes de medicação, psicoterapia, encaminhamentos, plano de segurança e retorno.', 'plano'),
    ],
  },
  {
    id: 'dermatologia', nome: 'Dermatologia', especialidade: 'Dermatologia', sistema: true,
    descricao: 'Descrição padronizada da lesão: tipo, localização, tamanho e cor.',
    secoes: [
      s('queixa', 'Queixa e evolução', 'Tempo de evolução, sintomas (prurido, dor, ardor), fatores desencadeantes e tratamentos já usados.', 'subjetivo'),
      s('antecedentes', 'Antecedentes', 'Doenças de pele prévias, alergias, exposição solar, fototipo e histórico familiar relevante.', 'subjetivo', false),
      s('lesao', 'Descrição da lesão', 'Para cada lesão: tipo (mácula, pápula, placa, nódulo, vesícula, úlcera…), localização, tamanho, cor, bordas, número, distribuição e arranjo.', 'objetivo'),
      s('dermatoscopia', 'Dermatoscopia', 'Achados dermatoscópicos, se realizados.', 'objetivo', false),
      s('avaliacao', 'Hipóteses diagnósticas', 'Diagnóstico principal e diferenciais.', 'avaliacao'),
      s('plano', 'Conduta', 'Tratamento tópico/sistêmico com modo de uso, biópsia ou exames, fotoproteção e retorno.', 'plano'),
    ],
  },
  {
    id: 'ginecologia', nome: 'Ginecologia / Obstetrícia', especialidade: 'Ginecologia e Obstetrícia', sistema: true,
    descricao: 'Com DUM, idade gestacional e história obstétrica (G P A).',
    secoes: [
      s('queixa', 'Queixa e história atual', 'Motivo da consulta e evolução.', 'subjetivo'),
      s('menstrual', 'História menstrual', 'DUM, ciclo (duração e regularidade), fluxo, dismenorreia e método contraceptivo.', 'subjetivo'),
      s('obstetrica', 'História obstétrica', 'Gestações, partos (tipo) e abortos no formato G P A; intercorrências.', 'subjetivo'),
      s('gestacao', 'Gestação atual', 'Se gestante: idade gestacional pela DUM e/ou USG, data provável do parto, pré-natal e movimentação fetal. Se não, escreva "Não se aplica".', 'objetivo', false),
      s('preventivos', 'Rastreamento', 'Último Papanicolau, mamografia e resultados citados.', 'subjetivo', false),
      s('exame', 'Exame físico e ginecológico', 'Sinais vitais, exame das mamas, abdome, especular e toque, quando realizados; BCF e altura uterina na gestante.', 'objetivo'),
      s('avaliacao', 'Avaliação', 'Hipóteses diagnósticas.', 'avaliacao'),
      s('plano', 'Conduta', 'Prescrição, exames, orientações e retorno.', 'plano'),
    ],
  },
  {
    id: 'cardiologia', nome: 'Cardiologia', especialidade: 'Cardiologia', sistema: true,
    descricao: 'Fatores de risco, sintomas cardiovasculares e exame direcionado.',
    secoes: [
      s('queixa', 'Queixa e história atual', 'Dor torácica (caráter, irradiação, relação com esforço), dispneia (classe NYHA), palpitações, síncope, edema.', 'subjetivo'),
      s('risco', 'Fatores de risco', 'HAS, diabetes, dislipidemia, tabagismo, obesidade, sedentarismo, história familiar precoce.', 'subjetivo'),
      s('medicacoes', 'Medicações em uso', 'Anti-hipertensivos, antiagregantes, anticoagulantes, estatinas, com dose.', 'subjetivo', false),
      s('exame', 'Exame físico', 'PA (ambos os braços se citado), FC, ritmo, ausculta cardíaca e pulmonar, pulsos, edema, estase jugular.', 'objetivo'),
      s('exames', 'Exames complementares', 'ECG, ecocardiograma, teste ergométrico, laboratório (lipídios, glicemia, função renal) citados.', 'objetivo', false),
      s('avaliacao', 'Avaliação', 'Hipóteses diagnósticas e estratificação de risco cardiovascular.', 'avaliacao'),
      s('plano', 'Conduta', 'Ajustes de medicação, metas (PA, LDL), exames, mudanças de estilo de vida e retorno.', 'plano'),
    ],
  },
  {
    id: 'ortopedia', nome: 'Ortopedia', especialidade: 'Ortopedia e Traumatologia', sistema: true,
    descricao: 'Mecanismo de lesão, dor (EVA) e exame físico por segmento.',
    secoes: [
      s('queixa', 'Queixa e mecanismo', 'Localização exata da dor, início, mecanismo de lesão/trauma, EVA (0–10), fatores de piora e melhora, limitação funcional.', 'subjetivo'),
      s('antecedentes', 'Antecedentes', 'Cirurgias e lesões prévias, atividade física/profissão, tratamentos já realizados.', 'subjetivo', false),
      s('exame', 'Exame físico por segmento', 'Por segmento examinado (ex.: coluna, ombro, joelho): inspeção, palpação, amplitude de movimento, força, testes especiais e exame neurovascular.', 'objetivo'),
      s('imagem', 'Exames de imagem', 'Radiografia, USG, RM ou TC citados e seus achados.', 'objetivo', false),
      s('avaliacao', 'Avaliação', 'Hipóteses diagnósticas.', 'avaliacao'),
      s('plano', 'Conduta', 'Analgesia, imobilização, fisioterapia, afastamento, indicação cirúrgica e retorno.', 'plano'),
    ],
  },
  {
    id: 'nutricao', nome: 'Nutrição', especialidade: 'Nutrição', sistema: true,
    descricao: 'Antropometria, hábitos alimentares e plano alimentar.',
    secoes: [
      s('objetivo_paciente', 'Objetivo do paciente', 'O que o paciente busca (emagrecimento, ganho de massa, controle de doença…) e motivação.', 'subjetivo'),
      s('historia', 'História clínica e hábitos', 'Doenças, medicações, sono, atividade física, ingestão hídrica, hábito intestinal, álcool e tabaco.', 'subjetivo'),
      s('alimentar', 'Anamnese alimentar', 'Recordatório 24h ou rotina alimentar, preferências, aversões, intolerâncias e alergias alimentares.', 'subjetivo'),
      s('antropometria', 'Antropometria', 'Peso, altura, IMC, circunferências, % de gordura e outras medidas citadas.', 'objetivo'),
      s('exames', 'Exames laboratoriais', 'Resultados citados relevantes para o plano.', 'objetivo', false),
      s('diagnostico', 'Diagnóstico nutricional', 'Estado nutricional e principais problemas.', 'avaliacao'),
      s('plano', 'Plano alimentar e metas', 'Estratégia, distribuição de refeições, suplementação, metas mensuráveis e retorno.', 'plano'),
    ],
  },
]

export function obterModeloSistema(id: string | null | undefined): ModeloProntuario | null {
  if (!id) return null
  return MODELOS_SISTEMA.find(m => m.id === id) || null
}

const SUGESTOES: Array<[RegExp, string]> = [
  [/pediatr|neonat|hebiatr/i, 'pediatria'],
  [/psiqu|psicol|psicot/i, 'psiquiatria'],
  [/dermat/i, 'dermatologia'],
  [/gineco|obstet|mastolog/i, 'ginecologia'],
  [/cardio/i, 'cardiologia'],
  [/ortop|traumat|medicina esportiva|fisiatr|reabilita/i, 'ortopedia'],
  [/nutri|nutrolog/i, 'nutricao'],
]

/** Id do modelo do sistema que combina com a especialidade (SOAP se nenhum). */
export function sugerirModeloPorEspecialidade(especialidade?: string | null): string {
  const e = especialidade || ''
  for (const [re, id] of SUGESTOES) if (re.test(e)) return id
  return ID_MODELO_SOAP
}

export function ehModeloSoap(m: ModeloProntuario | null | undefined): boolean {
  return !m || m.id === ID_MODELO_SOAP
}

/** Gera id curto para seção nova */
export function novoIdSecao(titulo = ''): string {
  const base = titulo.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 24)
  return (base || 'secao') + '_' + Math.random().toString(36).slice(2, 6)
}

/** Valida/normaliza um modelo vindo de fora (banco ou requisição). */
export function normalizarModelo(bruto: any): ModeloProntuario | null {
  if (!bruto || typeof bruto !== 'object') return null
  const secoes: SecaoModelo[] = Array.isArray(bruto.secoes)
    ? bruto.secoes
      .filter((x: any) => x && typeof x.titulo === 'string' && x.titulo.trim())
      .slice(0, 20)
      .map((x: any, i: number) => ({
        id: typeof x.id === 'string' && x.id ? x.id : 'secao_' + i,
        titulo: String(x.titulo).trim().slice(0, 120),
        instrucao: typeof x.instrucao === 'string' ? x.instrucao.slice(0, 800) : '',
        obrigatoria: x.obrigatoria !== false,
        soap: ['subjetivo', 'objetivo', 'avaliacao', 'plano'].includes(x.soap) ? x.soap : undefined,
      }))
    : []
  if (secoes.length === 0) return null
  return {
    id: typeof bruto.id === 'string' && bruto.id ? bruto.id : 'personalizado',
    nome: typeof bruto.nome === 'string' && bruto.nome.trim() ? bruto.nome.trim().slice(0, 120) : 'Modelo personalizado',
    especialidade: typeof bruto.especialidade === 'string' ? bruto.especialidade : '',
    secoes,
    padrao: !!bruto.padrao,
    medico_id: bruto.medico_id ?? null,
    clinica_id: bruto.clinica_id ?? null,
    criado_em: bruto.criado_em,
  }
}

/**
 * Resolve o `modelo` aceito por /api/estruturar: id de sistema (string) ou objeto com seções.
 * Retorna null quando não veio nada (comportamento SOAP clássico).
 */
export function resolverModelo(entrada: unknown): ModeloProntuario | null {
  if (!entrada) return null
  if (typeof entrada === 'string') return obterModeloSistema(entrada)
  return normalizarModelo(entrada)
}

/** O que mandar no corpo de /api/estruturar para este modelo. */
export function modeloParaRequisicao(m: ModeloProntuario | null | undefined): string | { nome: string; especialidade: string; secoes: SecaoModelo[] } | undefined {
  if (!m) return undefined
  if (m.sistema) return m.id
  return { nome: m.nome, especialidade: m.especialidade, secoes: m.secoes }
}

/** Chaves de localStorage usadas pelo seletor e pela página de modelos. */
export const CHAVE_ULTIMO_MODELO = 'c360_modelo_prontuario_ultimo'
export const CHAVE_MODELO_PADRAO = 'c360_modelo_prontuario_padrao'
