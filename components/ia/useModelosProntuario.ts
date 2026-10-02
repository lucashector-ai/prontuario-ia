'use client'

/**
 * Carrega os modelos de prontuário disponíveis: os do sistema (código) + os
 * personalizados do médico/clínica (tabela modelos_prontuario, migration 0014).
 * Tolera tabela inexistente (`semTabela = true`).
 */
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { MODELOS_SISTEMA, normalizarModelo, type ModeloProntuario } from '@/lib/ai/modelos-prontuario'

export type DonoModelos = { medicoId: string | null; clinicaId: string | null; especialidade: string | null; ehAdmin: boolean }

/** Lê quem está logado (padrão do app: clinica_admin ou medico no localStorage). */
export function lerDonoLocal(): DonoModelos {
  const vazio: DonoModelos = { medicoId: null, clinicaId: null, especialidade: null, ehAdmin: false }
  if (typeof window === 'undefined') return vazio
  try {
    const ca = localStorage.getItem('clinica_admin')
    if (ca) {
      const a = JSON.parse(ca)
      return { medicoId: null, clinicaId: a.clinica_id || null, especialidade: null, ehAdmin: true }
    }
    const m = localStorage.getItem('medico')
    if (m) {
      const p = JSON.parse(m)
      const recep = p.cargo === 'recepcionista'
      return { medicoId: recep ? null : p.id || null, clinicaId: p.clinica_id || null, especialidade: recep ? null : p.especialidade || null, ehAdmin: false }
    }
  } catch {}
  return vazio
}

export const MODELOS_DEMO: ModeloProntuario[] = [
  {
    id: 'demo-1', nome: 'Retorno de hipertensão', especialidade: 'Cardiologia', padrao: true,
    criado_em: new Date(Date.now() - 12 * 864e5).toISOString(),
    secoes: [
      { id: 'evolucao', titulo: 'Evolução desde o último retorno', instrucao: 'Adesão, efeitos adversos, sintomas novos e medidas de PA domiciliar.', obrigatoria: true, soap: 'subjetivo' },
      { id: 'pa', titulo: 'PA e exame', instrucao: 'PA sentado nos dois braços, FC, peso e IMC; ausculta.', obrigatoria: true, soap: 'objetivo' },
      { id: 'meta', titulo: 'Metas', instrucao: 'Comparar com a meta de PA e LDL do paciente.', obrigatoria: false, soap: 'avaliacao' },
      { id: 'ajustes', titulo: 'Ajustes e retorno', instrucao: 'Mudanças de dose, exames e prazo do próximo retorno.', obrigatoria: true, soap: 'plano' },
    ],
  },
  {
    id: 'demo-2', nome: 'Primeira consulta — check-up', especialidade: 'Clínica Médica',
    criado_em: new Date(Date.now() - 40 * 864e5).toISOString(),
    secoes: [
      { id: 'motivo', titulo: 'Motivo e queixas', instrucao: 'Motivo do check-up e queixas atuais.', obrigatoria: true, soap: 'subjetivo' },
      { id: 'habitos', titulo: 'Hábitos de vida', instrucao: 'Alimentação, atividade física, sono, álcool e tabaco.', obrigatoria: true, soap: 'subjetivo' },
      { id: 'rastreios', titulo: 'Rastreamentos em dia', instrucao: 'Exames preventivos por idade e sexo e quais estão pendentes.', obrigatoria: false, soap: 'avaliacao' },
      { id: 'plano', titulo: 'Plano', instrucao: 'Exames solicitados, vacinas e orientações.', obrigatoria: true, soap: 'plano' },
    ],
  },
]

export function useModelosProntuario(opcoes: { demo?: boolean; medicoId?: string | null; clinicaId?: string | null } = {}) {
  const [personalizados, setPersonalizados] = useState<ModeloProntuario[]>([])
  const [carregando, setCarregando] = useState(true)
  const [semTabela, setSemTabela] = useState(false)
  const [dono, setDono] = useState<DonoModelos>({ medicoId: null, clinicaId: null, especialidade: null, ehAdmin: false })

  const carregar = useCallback(async () => {
    const local = lerDonoLocal()
    const d: DonoModelos = {
      ...local,
      medicoId: opcoes.medicoId !== undefined ? opcoes.medicoId : local.medicoId,
      clinicaId: opcoes.clinicaId !== undefined ? opcoes.clinicaId : local.clinicaId,
    }
    setDono(d)
    if (opcoes.demo) { setPersonalizados(prev => prev.length ? prev : MODELOS_DEMO); setCarregando(false); return }
    if (!d.medicoId && !d.clinicaId) { setPersonalizados([]); setCarregando(false); return }
    setCarregando(true)
    try {
      let q = supabase.from('modelos_prontuario').select('*').order('criado_em', { ascending: false })
      if (d.medicoId && d.clinicaId) q = q.or(`medico_id.eq.${d.medicoId},and(medico_id.is.null,clinica_id.eq.${d.clinicaId})`)
      else if (d.medicoId) q = q.eq('medico_id', d.medicoId)
      else q = q.eq('clinica_id', d.clinicaId!)
      const { data, error } = await q
      if (error) {
        setSemTabela(/does not exist|relation|schema cache|not find/i.test(error.message || ''))
        setPersonalizados([])
      } else {
        setSemTabela(false)
        setPersonalizados((data || []).map(normalizarModelo).filter(Boolean) as ModeloProntuario[])
      }
    } catch {
      setPersonalizados([])
    } finally {
      setCarregando(false)
    }
  }, [opcoes.demo, opcoes.medicoId, opcoes.clinicaId])

  useEffect(() => { carregar() }, [carregar])

  return { sistema: MODELOS_SISTEMA, personalizados, setPersonalizados, carregando, semTabela, dono, recarregar: carregar }
}
