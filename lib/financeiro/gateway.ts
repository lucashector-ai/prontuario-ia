import { supabase } from '@/lib/supabase'
import type { Resultado } from './types'

// ── Tipos ───────────────────────────────────────────────────────────────────

export type MetodoCobranca = 'pix' | 'cartao' | 'boleto' | 'link'
export type CobrancaStatus = 'pendente' | 'pago' | 'expirado' | 'cancelado' | 'erro'

export interface GatewayConfig {
  id: string
  clinica_id: string
  provedor: string | null
  ativo: boolean
  ambiente: 'sandbox' | 'producao'
  config: Record<string, any>
  created_at: string
  updated_at: string
}

export interface Cobranca {
  id: string
  clinica_id: string
  unidade_id: string | null
  recebimento_id: string | null
  paciente_id: string | null
  valor: number
  metodo: MetodoCobranca
  provedor: string | null
  status: CobrancaStatus
  link_pagamento: string | null
  qr_code: string | null
  external_id: string | null
  expira_em: string | null
  pago_em: string | null
  created_at: string
}

export interface CobrancaInput {
  clinica_id: string
  unidade_id?: string | null
  recebimento_id?: string | null
  paciente_id?: string | null
  valor: number
  metodo: MetodoCobranca
}

// Resultado que um provedor real deve devolver ao criar uma cobrança.
export interface RetornoProvedor {
  external_id: string
  link_pagamento?: string
  qr_code?: string
  expira_em?: string
}

// Contrato que qualquer integração de gateway precisa implementar.
// Ao conectar um provedor real (Mercado Pago, Asaas, Pagar.me, Stripe...),
// basta implementar esta interface e registrar em PROVEDORES.
export interface GatewayProvider {
  nome: string
  criarCobranca(input: CobrancaInput, config: GatewayConfig): Promise<RetornoProvedor>
}

// Provedores que a UI permite selecionar.
export const PROVEDORES_SUPORTADOS: { codigo: string; nome: string }[] = [
  { codigo: 'mercadopago', nome: 'Mercado Pago' },
  { codigo: 'asaas', nome: 'Asaas' },
  { codigo: 'pagarme', nome: 'Pagar.me' },
  { codigo: 'stripe', nome: 'Stripe' },
]

// Registro de integrações ATIVAS. Vazio até uma API real ser plugada.
// Exemplo futuro: PROVEDORES['asaas'] = criarProviderAsaas()
export const PROVEDORES: Record<string, GatewayProvider> = {}

// ── Configuração ────────────────────────────────────────────────────────────

export async function obterGatewayConfig(clinicaId: string): Promise<Resultado<GatewayConfig | null>> {
  const { data, error } = await supabase
    .from('gateway_config').select('*').eq('clinica_id', clinicaId).maybeSingle()
  return { data: (data as GatewayConfig) || null, error: error?.message || null }
}

export async function salvarGatewayConfig(
  clinicaId: string,
  campos: { provedor?: string | null; ativo?: boolean; ambiente?: 'sandbox' | 'producao' },
): Promise<Resultado<GatewayConfig>> {
  const { data, error } = await supabase
    .from('gateway_config')
    .upsert({ clinica_id: clinicaId, ...campos }, { onConflict: 'clinica_id' })
    .select()
    .single()
  return { data: data as GatewayConfig | null, error: error?.message || null }
}

// Indica se há provedor configurado, ativo E com integração implementada.
export function gatewayOperacional(config: GatewayConfig | null): boolean {
  return !!(config?.ativo && config.provedor && PROVEDORES[config.provedor])
}

// ── Cobranças ───────────────────────────────────────────────────────────────

export async function listarCobrancas(clinicaId: string): Promise<Resultado<Cobranca[]>> {
  const { data, error } = await supabase
    .from('cobrancas')
    .select('*')
    .eq('clinica_id', clinicaId)
    .order('created_at', { ascending: false })
    .limit(300)
  return { data: (data as Cobranca[]) || [], error: error?.message || null }
}

// Gera uma cobrança via gateway. Enquanto nenhum provedor real estiver
// plugado, devolve um erro claro — a estrutura (tabela, config, contrato)
// já está pronta para ativar.
export async function gerarCobranca(input: CobrancaInput): Promise<Resultado<Cobranca>> {
  const { data: config } = await obterGatewayConfig(input.clinica_id)
  if (!config || !config.ativo || !config.provedor) {
    return { data: null, error: 'Gateway de pagamento não configurado. Ative em Configurações.' }
  }
  const provider = PROVEDORES[config.provedor]
  if (!provider) {
    return { data: null, error: `Integração com ${config.provedor} ainda não conectada (aguardando credenciais da API).` }
  }

  try {
    const retorno = await provider.criarCobranca(input, config)
    const { data, error } = await supabase
      .from('cobrancas')
      .insert({
        clinica_id: input.clinica_id,
        unidade_id: input.unidade_id || null,
        recebimento_id: input.recebimento_id || null,
        paciente_id: input.paciente_id || null,
        valor: input.valor,
        metodo: input.metodo,
        provedor: config.provedor,
        status: 'pendente',
        external_id: retorno.external_id,
        link_pagamento: retorno.link_pagamento || null,
        qr_code: retorno.qr_code || null,
        expira_em: retorno.expira_em || null,
      })
      .select()
      .single()
    return { data: data as Cobranca | null, error: error?.message || null }
  } catch (e: any) {
    return { data: null, error: e?.message || 'falha ao gerar cobrança no provedor' }
  }
}
