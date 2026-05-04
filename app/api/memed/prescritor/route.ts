import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

const MEMED_API_URL = process.env.MEMED_API_URL || 'https://integrations.api.memed.com.br/v1'
const MEMED_API_KEY = process.env.MEMED_API_KEY || ''
const MEMED_SECRET_KEY = process.env.MEMED_SECRET_KEY || ''

// Em homologacao, forcamos cidade SP (id 5213) e especialidade Generalista (id 59)
// Em producao deveremos usar a cidade/especialidade real do medico
const CIDADE_HOMOLOG = 5213
const ESPECIALIDADE_HOMOLOG = 59

const eHomolog = MEMED_API_URL.includes('integrations.api.memed.com.br/v1') &&
                 MEMED_API_KEY === 'iJGiB4kjDGOLeDFPWMG3no9VnN7Abpqe3w1jEFm6olkhkZD6oSfSmYCm'

// Limpa CPF (memed quer só numeros)
function limparCpf(cpf: string | null | undefined): string {
  return (cpf || '').replace(/\D/g, '')
}

// Quebra nome em primeiro + sobrenome
function splitNome(nomeCompleto: string): { nome: string; sobrenome: string } {
  const partes = (nomeCompleto || '').trim().split(/\s+/)
  if (partes.length === 1) return { nome: partes[0] || 'Medico', sobrenome: 'Teste' }
  return { nome: partes[0], sobrenome: partes.slice(1).join(' ') }
}

// Valida data de nascimento (DD/MM/YYYY) — Memed exige
function dataParaMemed(iso: string | null | undefined): string {
  if (!iso) return '01/01/1985'
  try {
    const d = new Date(iso)
    const dd = String(d.getDate()).padStart(2, '0')
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const yyyy = d.getFullYear()
    return `${dd}/${mm}/${yyyy}`
  } catch {
    return '01/01/1985'
  }
}

/**
 * POST /api/memed/prescritor
 * Body: { medico_id }
 * 
 * Fluxo:
 * 1. Verifica cache em memed_tokens (atualizado nas ultimas 6h)
 * 2. Se cache valido, retorna token
 * 3. Senao, busca medico no DB, tenta cadastrar/atualizar no Memed via /sinapse-prescricao/usuarios
 * 4. Salva token retornado em memed_tokens
 * 5. Retorna { token, status }
 */
export async function POST(req: NextRequest) {
  try {
    const { medico_id } = await req.json()
    if (!medico_id) {
      return NextResponse.json({ error: 'medico_id required' }, { status: 400 })
    }

    if (!MEMED_API_KEY || !MEMED_SECRET_KEY) {
      return NextResponse.json({
        error: 'Memed nao configurada. Configure MEMED_API_KEY e MEMED_SECRET_KEY no Vercel.'
      }, { status: 501 })
    }

    // 1. Verifica cache
    const { data: cache } = await supabase
      .from('memed_tokens')
      .select('memed_token, external_id, status, atualizado_em')
      .eq('medico_id', medico_id)
      .maybeSingle()

    const cacheValido = cache && cache.atualizado_em &&
      (Date.now() - new Date(cache.atualizado_em).getTime()) < 6 * 60 * 60 * 1000  // 6h

    if (cacheValido && cache.memed_token) {
      return NextResponse.json({
        token: cache.memed_token,
        status: cache.status,
        from_cache: true,
      })
    }

    // 2. Busca dados do medico no DB
    const { data: medico, error: errMed } = await supabase
      .from('medicos')
      .select('id, nome, email, crm, cpf, sexo, data_nascimento, especialidade')
      .eq('id', medico_id)
      .single()

    if (errMed || !medico) {
      return NextResponse.json({ error: 'Medico nao encontrado' }, { status: 404 })
    }

    // 3. Valida campos obrigatorios pro Memed
    const cpfLimpo = limparCpf(medico.cpf)
    if (!cpfLimpo || cpfLimpo.length !== 11) {
      return NextResponse.json({
        error: 'CPF do medico ausente ou invalido. Atualize o perfil antes de usar a Memed.'
      }, { status: 400 })
    }
    if (!medico.crm) {
      return NextResponse.json({
        error: 'CRM do medico ausente. Atualize o perfil antes de usar a Memed.'
      }, { status: 400 })
    }

    // 4. Monta payload pra Memed
    const { nome, sobrenome } = splitNome(medico.nome)
    const externalId = String(medico.id).slice(0, 32)
    // CRM costuma vir em formato "12345/SP" — extraimos numero e UF
    const crmMatch = String(medico.crm).match(/(\d+)[^A-Z]*([A-Z]{2})?/i)
    const crmNumero = crmMatch?.[1] || String(medico.crm).replace(/\D/g, '')
    const crmUf = crmMatch?.[2]?.toUpperCase() || 'SP'

    const payload: any = {
      data: {
        type: 'usuarios',
        attributes: {
          external_id: externalId,
          nome,
          sobrenome,
          data_nascimento: dataParaMemed(medico.data_nascimento),
          cpf: cpfLimpo,
          uf: crmUf,
          sexo: (medico.sexo || 'M').slice(0, 1).toUpperCase(),
          crm: crmNumero,
          email: medico.email,
        },
        relationships: {
          especialidade: { data: { id: eHomolog ? ESPECIALIDADE_HOMOLOG : ESPECIALIDADE_HOMOLOG } },
          cidade:        { data: { id: eHomolog ? CIDADE_HOMOLOG       : CIDADE_HOMOLOG } },
        },
      },
    }

    // 5. Chama Memed
    const url = `${MEMED_API_URL}/sinapse-prescricao/usuarios?api-key=${MEMED_API_KEY}&secret-key=${MEMED_SECRET_KEY}`
    let res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.api+json',
      },
      body: JSON.stringify(payload),
    })
    const respText = await res.text()
    let memedData: any
    try {
      memedData = JSON.parse(respText)
    } catch {
      console.error('[memed/prescritor] Memed retornou nao-JSON. Status:', res.status, 'Body:', respText.slice(0, 500))
      return NextResponse.json({
        error: 'Memed nao retornou JSON valido. Status: ' + res.status + '. Resposta: ' + respText.slice(0, 200),
        debug: {
          api_key_configurada: !!MEMED_API_KEY,
          api_key_preview: MEMED_API_KEY.slice(0, 8) + '...',
          api_url: MEMED_API_URL,
          status: res.status,
        }
      }, { status: 502 })
    }

    // Se erro 422/409 indica que ja existe, tenta GET pra recuperar
    // (Memed retorna conflito quando external_id ja existe)
    if (!res.ok) {
      // Tenta buscar via GET para recuperar o token de um medico ja cadastrado
      const getUrl = `${MEMED_API_URL}/sinapse-prescricao/usuarios/${externalId}?api-key=${MEMED_API_KEY}&secret-key=${MEMED_SECRET_KEY}`
      const getRes = await fetch(getUrl, {
        headers: { 'Accept': 'application/vnd.api+json' }
      })
      if (getRes.ok) {
        memedData = await getRes.json()
      } else {
        console.error('[memed/prescritor] erro Memed:', JSON.stringify(memedData).slice(0, 500))
        return NextResponse.json({
          error: 'Erro ao cadastrar/buscar prescritor na Memed: ' +
            (memedData?.errors?.[0]?.detail || memedData?.message || 'desconhecido')
        }, { status: 500 })
      }
    }

    const token = memedData?.data?.attributes?.token
    const status = memedData?.data?.attributes?.status

    if (!token) {
      return NextResponse.json({
        error: 'Memed nao retornou token. Resposta: ' + JSON.stringify(memedData).slice(0, 300)
      }, { status: 500 })
    }

    // 6. Salva no cache (upsert)
    await supabase.from('memed_tokens').upsert({
      medico_id,
      memed_token: token,
      external_id: externalId,
      status: status || null,
      atualizado_em: new Date().toISOString(),
    }, { onConflict: 'medico_id' })

    return NextResponse.json({ token, status, from_cache: false })
  } catch (e: any) {
    console.error('[memed/prescritor] exception:', e)
    return NextResponse.json({ error: e?.message || 'erro desconhecido' }, { status: 500 })
  }
}
