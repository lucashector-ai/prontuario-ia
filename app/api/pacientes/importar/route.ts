import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type LinhaBruta = Record<string, any>

interface PacienteNormalizado {
  nome: string
  cpf: string | null
  data_nascimento: string | null
  telefone: string | null
  sexo: string | null
  email: string | null
}

interface LinhaProcessada {
  linha: number
  dados: PacienteNormalizado
  status: 'valido' | 'duplicado' | 'invalido'
  motivo?: string
}

// Normaliza nome de coluna: remove acentos, espaços, caixa baixa
function normalizarColuna(key: string): string {
  return (key || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

// Mapeia nomes alternativos pra chave canônica
const MAPA_COLUNAS: Record<string, string> = {
  nome: 'nome',
  nomecompleto: 'nome',
  paciente: 'nome',
  pacientenome: 'nome',
  cpf: 'cpf',
  documento: 'cpf',
  datanascimento: 'data_nascimento',
  nascimento: 'data_nascimento',
  datadenascimento: 'data_nascimento',
  dtnasc: 'data_nascimento',
  telefone: 'telefone',
  celular: 'telefone',
  whatsapp: 'telefone',
  fone: 'telefone',
  sexo: 'sexo',
  genero: 'sexo',
  email: 'email',
  emailcontato: 'email',
  mail: 'email',
}

function mapearChave(key: string): string | null {
  const norm = normalizarColuna(key)
  return MAPA_COLUNAS[norm] || null
}

function limparTexto(v: any): string {
  if (v === null || v === undefined) return ''
  return String(v).trim()
}

function formatarCPF(v: any): string | null {
  const raw = limparTexto(v).replace(/\D/g, '')
  if (!raw) return null
  if (raw.length !== 11) return null
  return raw.substring(0, 3) + '.' + raw.substring(3, 6) + '.' + raw.substring(6, 9) + '-' + raw.substring(9)
}

function formatarTelefone(v: any): string | null {
  const raw = limparTexto(v).replace(/\D/g, '')
  if (!raw) return null
  if (raw.length < 10 || raw.length > 11) return null
  const nums = raw.length === 11 ? raw : raw
  if (nums.length === 11) {
    return '(' + nums.substring(0, 2) + ') ' + nums.substring(2, 7) + '-' + nums.substring(7)
  }
  return '(' + nums.substring(0, 2) + ') ' + nums.substring(2, 6) + '-' + nums.substring(6)
}

function formatarDataNascimento(v: any): string | null {
  const raw = limparTexto(v)
  if (!raw) return null

  // Tenta ISO (YYYY-MM-DD)
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    const iso = raw.substring(0, 10)
    if (!isNaN(Date.parse(iso))) return iso
  }

  // Tenta BR (DD/MM/YYYY)
  const matchBR = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/)
  if (matchBR) {
    let [, dd, mm, yyyy] = matchBR
    if (yyyy.length === 2) yyyy = parseInt(yyyy) > 30 ? '19' + yyyy : '20' + yyyy
    const iso = yyyy + '-' + mm.padStart(2, '0') + '-' + dd.padStart(2, '0')
    if (!isNaN(Date.parse(iso))) return iso
  }

  return null
}

function normalizarSexo(v: any): string | null {
  const raw = limparTexto(v).toLowerCase()
  if (!raw) return null
  if (raw.startsWith('m') || raw.startsWith('h')) return 'Masculino'
  if (raw.startsWith('f')) return 'Feminino'
  if (raw.length > 0) return 'Outro'
  return null
}

function normalizarEmail(v: any): string | null {
  const raw = limparTexto(v).toLowerCase()
  if (!raw) return null
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) return null
  return raw
}

function normalizarLinha(raw: LinhaBruta): PacienteNormalizado {
  const out: PacienteNormalizado = {
    nome: '',
    cpf: null,
    data_nascimento: null,
    telefone: null,
    sexo: null,
    email: null,
  }

  for (const [k, v] of Object.entries(raw)) {
    const chave = mapearChave(k)
    if (!chave) continue
    if (chave === 'nome') out.nome = limparTexto(v)
    if (chave === 'cpf') out.cpf = formatarCPF(v)
    if (chave === 'data_nascimento') out.data_nascimento = formatarDataNascimento(v)
    if (chave === 'telefone') out.telefone = formatarTelefone(v)
    if (chave === 'sexo') out.sexo = normalizarSexo(v)
    if (chave === 'email') out.email = normalizarEmail(v)
  }

  return out
}

// POST: preview ou import
// body: { medico_id, linhas: [{...}, ...], modo: 'preview' | 'import' }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { medico_id: medicoIdBody, clinica_id, linhas, modo } = body

    if (!Array.isArray(linhas)) {
      return NextResponse.json({ error: 'Dados insuficientes' }, { status: 400 })
    }

    // Resolve medico_id: se veio direto, valida. Se veio clinica_id, pega primeiro medico ativo
    let medico_id: string | null = null

    if (medicoIdBody) {
      // Verifica se existe na tabela medicos
      const { data: medicoCheck } = await supabase
        .from('medicos').select('id, clinica_id').eq('id', medicoIdBody).maybeSingle()
      if (medicoCheck) {
        medico_id = medicoCheck.id
      }
    }

    // Se nao resolveu e veio clinica_id, busca primeiro medico
    if (!medico_id && clinica_id) {
      const { data: primeiroMedico } = await supabase
        .from('medicos')
        .select('id')
        .eq('clinica_id', clinica_id)
        .eq('cargo', 'medico')
        .eq('ativo', true)
        .order('criado_em', { ascending: true })
        .limit(1)
        .maybeSingle()
      if (primeiroMedico) medico_id = primeiroMedico.id
    }

    if (!medico_id) {
      return NextResponse.json({ error: 'Nenhum medico ativo encontrado para vincular pacientes. Cadastre um medico antes de importar.' }, { status: 400 })
    }

    if (linhas.length === 0) {
      return NextResponse.json({ error: 'Arquivo vazio' }, { status: 400 })
    }

    if (linhas.length > 2000) {
      return NextResponse.json({ error: 'Limite de 2000 pacientes por importação' }, { status: 400 })
    }

    // Normaliza nome: lowercase, sem acentos, sem espacos duplos
    const normNome = (n: string) => (n || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().trim().replace(/\s+/g, ' ')

    // Busca existentes do médico (CPF, email, nome+data)
    const { data: existentes } = await supabase
      .from('pacientes')
      .select('cpf, email, nome, data_nascimento')
      .eq('medico_id', medico_id)

    const cpfsExistentes = new Set((existentes || []).map(p => p.cpf).filter(Boolean))
    const emailsExistentes = new Set((existentes || []).map(p => (p.email || '').toLowerCase()).filter(Boolean))
    // chave nome+data_nascimento (so conta se tiver ambos)
    const nomeDataExistente = new Set(
      (existentes || [])
        .filter(p => p.nome && p.data_nascimento)
        .map(p => normNome(p.nome) + '|' + p.data_nascimento)
    )

    // Processa cada linha
    const cpfsLote = new Set<string>()
    const emailsLote = new Set<string>()
    const nomeDataLote = new Set<string>()
    const nomeDataLote = new Set<string>()
    const resultado: LinhaProcessada[] = []

    for (let i = 0; i < linhas.length; i++) {
      const normalizada = normalizarLinha(linhas[i])
      let status: 'valido' | 'duplicado' | 'invalido' = 'valido'
      let motivo: string | undefined

      if (!normalizada.nome || normalizada.nome.length < 2) {
        status = 'invalido'
        motivo = 'Nome ausente ou muito curto'
      } else if (normalizada.cpf && cpfsExistentes.has(normalizada.cpf)) {
        status = 'duplicado'
        motivo = 'CPF já cadastrado'
      } else if (normalizada.email && emailsExistentes.has(normalizada.email)) {
        status = 'duplicado'
        motivo = 'Email já cadastrado'
      } else if (normalizada.cpf && cpfsLote.has(normalizada.cpf)) {
        status = 'duplicado'
        motivo = 'CPF duplicado na planilha'
      } else if (normalizada.email && emailsLote.has(normalizada.email)) {
        status = 'duplicado'
        motivo = 'Email duplicado na planilha'
      } else if (normalizada.nome && normalizada.data_nascimento) {
        const chave = normNome(normalizada.nome) + '|' + normalizada.data_nascimento
        if (nomeDataExistente.has(chave)) {
          status = 'duplicado'
          motivo = 'Paciente ja cadastrado (mesmo nome e data de nascimento)'
        } else if (nomeDataLote.has(chave)) {
          status = 'duplicado'
          motivo = 'Duplicado na planilha (mesmo nome e data de nascimento)'
        } else {
          nomeDataLote.add(chave)
          if (normalizada.cpf) cpfsLote.add(normalizada.cpf)
          if (normalizada.email) emailsLote.add(normalizada.email)
        }
      } else {
        if (normalizada.cpf) cpfsLote.add(normalizada.cpf)
        if (normalizada.email) emailsLote.add(normalizada.email)
      }

      resultado.push({
        linha: i + 2, // +2 porque linha 1 é cabeçalho
        dados: normalizada,
        status,
        motivo,
      })
    }

    // Se é preview, retorna só o resultado sem salvar
    if (modo === 'preview') {
      return NextResponse.json({
        total: resultado.length,
        validos: resultado.filter(r => r.status === 'valido').length,
        duplicados: resultado.filter(r => r.status === 'duplicado').length,
        invalidos: resultado.filter(r => r.status === 'invalido').length,
        linhas: resultado,
      })
    }

    // Modo import: insere os válidos
    const paraInserir = resultado
      .filter(r => r.status === 'valido')
      .map(r => ({
        medico_id,
        nome: r.dados.nome,
        cpf: r.dados.cpf,
        data_nascimento: r.dados.data_nascimento,
        telefone: r.dados.telefone,
        sexo: r.dados.sexo,
        email: r.dados.email,
      }))

    let inseridos = 0
    const errosInsert: string[] = []
    if (paraInserir.length > 0) {
      const tamLote = 100
      for (let i = 0; i < paraInserir.length; i += tamLote) {
        const lote = paraInserir.slice(i, i + tamLote)
        const { data, error } = await supabase.from('pacientes').insert(lote).select('id')
        if (error) {
          console.error('[IMPORTAR] Erro ao inserir lote:', error)
          errosInsert.push(error.message)
          // Tenta inserir 1 por 1 pra identificar qual linha quebra
          for (const p of lote) {
            const { data: d2, error: e2 } = await supabase.from('pacientes').insert(p).select('id').single()
            if (!e2 && d2) inseridos++
            else if (e2) console.error('[IMPORTAR] Linha com erro:', p.nome, e2.message)
          }
        } else if (data) {
          inseridos += data.length
        }
      }
    }

    return NextResponse.json({
      ok: true,
      inseridos,
      pulados: resultado.filter(r => r.status === 'duplicado').length,
      invalidos: resultado.filter(r => r.status === 'invalido').length,
      erros_insert: errosInsert.length > 0 ? errosInsert : undefined,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
