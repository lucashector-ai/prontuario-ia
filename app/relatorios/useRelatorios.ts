'use client'
/**
 * Carregamento dos dados dos Relatórios.
 * Identificação (padrão do app): localStorage.clinica_admin → médicos ativos da clínica;
 * localStorage.medico → o próprio médico (recepcionista → médicos da clínica).
 * ?demo=1 → dados gerados localmente (lib/relatorios/demo), sem login e sem tocar no banco.
 */
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { parseConfig } from '@/lib/agenda-publica/slots'
import { normalizarConvenio } from '@/lib/convenios'
import { gerarDemo } from '@/lib/relatorios/demo'
import { paraInputData } from '@/lib/relatorios/periodo'
import type { AgRel, DadosRelatorio, EsperaRel, Intervalo, MedRel, PacRel, RetornoRel } from '@/lib/relatorios/tipos'

const faltaTabela = (e: any) => !!e && /column|relation|does not exist|schema cache|42P01|42703/i.test(String(e.message || e.code || e))

/** Busca paginada (o Supabase devolve no máximo 1000 linhas por chamada). */
async function paginar<R>(montar: (de: number, ate: number) => PromiseLike<{ data: R[] | null; error: any }>) {
  const out: R[] = []
  for (let de = 0; de < 100000; de += 1000) {
    const { data, error } = await montar(de, de + 999)
    if (error) return { data: out, error }
    out.push(...(data || []))
    if (!data || data.length < 1000) break
  }
  return { data: out, error: null }
}

function paraMedico(m: any): MedRel {
  const cfg = parseConfig(m.agenda_publica_config)
  return {
    id: m.id, nome: m.nome || 'Médico', cor: m.cor || null, especialidade: m.especialidade || null,
    jornada: { dias_semana: cfg.dias_semana, horario_inicio: cfg.horario_inicio, horario_fim: cfg.horario_fim, intervalo_almoco: cfg.intervalo_almoco },
  }
}

async function buscarMedicos(filtro: (q: any) => any): Promise<any[]> {
  for (const campos of ['id, nome, cor, especialidade, agenda_publica_config', 'id, nome, especialidade, agenda_publica_config', 'id, nome, agenda_publica_config', 'id, nome']) {
    const { data, error } = await filtro(supabase.from('medicos').select(campos))
    if (!error) return data || []
    if (!faltaTabela(error)) return []
  }
  return []
}

export function useRelatorios(carga: Intervalo) {
  const router = useRouter()
  const [demo, setDemo] = useState(false)
  const [pronto, setPronto] = useState(false)
  const [ehClinica, setEhClinica] = useState(false)
  const [medicos, setMedicos] = useState<MedRel[]>([])
  const [dados, setDados] = useState<DadosRelatorio | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [avisos, setAvisos] = useState<string[]>([])
  const [tentativa, setTentativa] = useState(0)

  // Bootstrap: quem é o usuário e quais médicos entram no relatório
  useEffect(() => {
    const ehDemo = new URLSearchParams(window.location.search).get('demo') === '1'
    setDemo(ehDemo)
    if (ehDemo) {
      const d = gerarDemo(new Date())
      setMedicos(d.medicos); setEhClinica(true); setPronto(true)
      return
    }
    const ca = localStorage.getItem('clinica_admin')
    const m = localStorage.getItem('medico')
    if (!ca && !m) { router.push('/login'); return }
    ;(async () => {
      try {
        let lista: any[] = []
        if (ca) {
          const admin = JSON.parse(ca)
          setEhClinica(true)
          lista = await buscarMedicos(q => q.eq('clinica_id', admin.clinica_id || admin.id).eq('cargo', 'medico').eq('ativo', true).order('nome'))
        } else {
          const med = JSON.parse(m!)
          if (med.cargo === 'recepcionista' && med.clinica_id) {
            setEhClinica(true)
            lista = await buscarMedicos(q => q.eq('clinica_id', med.clinica_id).eq('cargo', 'medico').eq('ativo', true).order('nome'))
          } else {
            lista = await buscarMedicos(q => q.eq('id', med.id))
            if (!lista.length) lista = [med]
          }
        }
        setMedicos(lista.map(paraMedico))
      } catch {
        setErro('Não foi possível identificar sua conta.')
      }
      setPronto(true)
    })()
  }, [router])

  const iniMs = carga.ini.getTime(), fimMs = carga.fim.getTime()

  // Dados do intervalo de carga (período + anterior + 6 meses de convênios)
  useEffect(() => {
    if (!pronto) return
    if (!medicos.length) { setDados(null); setCarregando(false); return }
    let cancelado = false
    setCarregando(true); setErro(null)
    ;(async () => {
      const ini = new Date(iniMs), fim = new Date(fimMs)
      if (demo) {
        const d = gerarDemo(new Date())
        if (!cancelado) { setDados(d); setAvisos([]); setCarregando(false) }
        return
      }
      const ids = medicos.map(m => m.id)
      const avs: string[] = []
      const consultaAgs = (campos: string) => paginar<any>((de, ate) => supabase.from('agendamentos').select(campos)
        .in('medico_id', ids).gte('data_hora', ini.toISOString()).lt('data_hora', fim.toISOString()).order('data_hora').range(de, ate))
      const camposBase = 'id, medico_id, paciente_id, data_hora, duracao, tipo, status, meet_link, pacientes:paciente_id(convenio)'

      const [agsR0, pacR, retR, espR] = await Promise.all([
        consultaAgs(camposBase + ', confirmacao_24h_status'),
        paginar<any>((de, ate) => supabase.from('pacientes').select('id, medico_id, criado_em, convenio')
          .in('medico_id', ids).gte('criado_em', ini.toISOString()).lt('criado_em', fim.toISOString()).range(de, ate)),
        paginar<any>((de, ate) => supabase.from('retornos').select('id, medico_id, status, data_prevista')
          .in('medico_id', ids).gte('data_prevista', paraInputData(ini)).lt('data_prevista', paraInputData(fim)).range(de, ate)),
        paginar<any>((de, ate) => supabase.from('lista_espera').select('id, medico_id, status').in('medico_id', ids).range(de, ate)),
      ])
      let agsR = agsR0
      if (agsR.error && faltaTabela(agsR.error)) agsR = await consultaAgs(camposBase)
      if (cancelado) return
      if (agsR.error) { setErro('Não foi possível carregar os agendamentos.'); setCarregando(false); return }

      let retornos: RetornoRel[] | null = retR.data as RetornoRel[]
      if (retR.error) { retornos = null; if (faltaTabela(retR.error)) avs.push('Retornos calculados pela agenda — rode a migration 0011 para usar a lista de retornos.') }
      let espera: EsperaRel[] | null = espR.data as EsperaRel[]
      if (espR.error) { espera = null; if (faltaTabela(espR.error)) avs.push('Lista de espera indisponível — rode a migration 0010.') }

      const agendamentos: AgRel[] = agsR.data.map((a: any) => ({
        id: a.id, medico_id: a.medico_id, paciente_id: a.paciente_id, data_hora: a.data_hora, duracao: a.duracao,
        tipo: a.tipo, status: a.status, meet_link: a.meet_link, confirmacao_24h_status: a.confirmacao_24h_status ?? null,
        convenio: normalizarConvenio(a.pacientes?.convenio),
      }))
      const pacientes: PacRel[] = (pacR.data || []).map((p: any) => ({ id: p.id, medico_id: p.medico_id, criado_em: p.criado_em, convenio: p.convenio }))
      setDados({ medicos, agendamentos, pacientes, retornos, listaEspera: espera })
      setAvisos(avs)
      setCarregando(false)
    })()
    return () => { cancelado = true }
  }, [pronto, medicos, demo, iniMs, fimMs, tentativa])

  return { demo, pronto, ehClinica, medicos, dados, carregando, erro, avisos, recarregar: () => setTentativa(t => t + 1) }
}
