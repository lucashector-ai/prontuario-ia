'use client'
/**
 * Estado e ações do Faturamento de convênios (TISS).
 * Modo real → rotas /api/tiss/*. Modo demonstração (?demo=1) → só estado local.
 *
 * Identificação (padrão do app): localStorage.clinica_admin → escopo da clínica;
 * localStorage.medico → clínica dele (se tiver) ou o próprio médico (autônomo).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { notificar } from '@/components/ui/dialogos'
import { normalizarConvenio } from '@/lib/convenios'
import type { Guia, ItemPreco, Lote, Operadora } from '@/lib/tiss/tipos'
import { arred2, totalProcedimentos, profissionalDoMedico } from '@/lib/tiss/tipos'
import { validarGuia, type Problema } from '@/lib/tiss/validar'
import { agruparParaLote, statusRetorno } from '@/lib/tiss/lotes'
import { gerarXmlLote, xmlParaBytes } from '@/lib/tiss/xml'
import { interpretarCsvPrecos } from '@/lib/tiss/csv'
import { DEMO_OPERADORAS, DEMO_PRECOS, demoGuias, demoLotes, demoPendentes } from './demo'

export type Pendente = { consulta_id: string; paciente: string; convenio: string; data: string; carteira?: string | null }
export type Resultado = { ok: boolean; erros?: Problema[]; guia?: Guia; mensagem?: string }

const faltaMig = (msg: string) => /migration 0012|does not exist|relation|schema cache/i.test(msg)
const agoraIso = () => new Date().toISOString()

export function useFaturamento() {
  const router = useRouter()
  const [demo, setDemo] = useState(false)
  const [escopo, setEscopo] = useState<{ clinica_id?: string; medico_id?: string } | null>(null)
  const [medicos, setMedicos] = useState<any[]>([])
  const [operadoras, setOperadoras] = useState<Operadora[]>([])
  const [guias, setGuias] = useState<Guia[]>([])
  const [lotes, setLotes] = useState<Lote[]>([])
  const [precos, setPrecos] = useState<Record<string, ItemPreco[]>>({})
  const [pendentes, setPendentes] = useState<Pendente[]>([])
  const [carregando, setCarregando] = useState(true)
  const [semMigration, setSemMigration] = useState(false)
  const [guiaInicial, setGuiaInicial] = useState<string | null>(null)
  const seq = useRef(1000)

  // ── chamadas à API ───────────────────────────────────────────────────────
  const api = useCallback(async (caminho: string, metodo = 'GET', corpo?: any) => {
    const esc = escopo || {}
    let url = `/api/tiss/${caminho}`
    if (metodo === 'GET' || metodo === 'DELETE') {
      const sp = new URLSearchParams(Object.entries(esc).filter(([, v]) => v) as [string, string][])
      url += (url.includes('?') ? '&' : '?') + sp.toString()
    }
    const r = await fetch(url, {
      method: metodo,
      headers: corpo ? { 'Content-Type': 'application/json' } : undefined,
      body: corpo ? JSON.stringify({ ...esc, ...corpo }) : undefined,
    })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) {
      if (r.status === 503 || faltaMig(j.error || '')) setSemMigration(true)
      const e: any = new Error(j.error || 'Erro inesperado')
      e.dados = j
      throw e
    }
    return j
  }, [escopo])

  // ── bootstrap ────────────────────────────────────────────────────────────
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search)
    const ehDemo = sp.get('demo') === '1'
    setDemo(ehDemo)
    setGuiaInicial(sp.get('guia'))
    if (ehDemo) {
      setOperadoras(DEMO_OPERADORAS)
      setPrecos(DEMO_PRECOS)
      setGuias(demoGuias())
      setLotes(demoLotes())
      setPendentes(demoPendentes())
      setMedicos([{ id: 'demo', nome: 'Dra. Camila Andrade', crm: 'CRM-SP 145872', especialidade: 'Cardiologia' }])
      setEscopo({ clinica_id: 'demo' })
      setCarregando(false)
      return
    }
    ;(async () => {
      const ca = localStorage.getItem('clinica_admin')
      const m = localStorage.getItem('medico')
      if (ca) {
        const admin = JSON.parse(ca)
        if (!admin.clinica_id) { router.push('/login'); return }
        setEscopo({ clinica_id: admin.clinica_id })
        const { data } = await supabase.from('medicos').select('id, nome, crm, especialidade').eq('clinica_id', admin.clinica_id).eq('cargo', 'medico')
        setMedicos(data || [])
      } else if (m) {
        const med = JSON.parse(m)
        if (med.clinica_id) {
          setEscopo({ clinica_id: med.clinica_id })
          const { data } = await supabase.from('medicos').select('id, nome, crm, especialidade').eq('clinica_id', med.clinica_id).eq('cargo', 'medico')
          setMedicos(data?.length ? data : [med])
        } else {
          setEscopo({ medico_id: med.id })
          setMedicos([med])
        }
      } else {
        router.push('/login')
      }
    })()
  }, [router])

  const carregar = useCallback(async () => {
    if (demo || !escopo) return
    setCarregando(true)
    try {
      const [o, g, l] = await Promise.all([api('operadoras'), api('guias'), api('lotes')])
      setOperadoras(o.operadoras)
      setGuias(g.guias)
      setLotes(l.lotes)
      setSemMigration(false)
    } catch (e: any) {
      if (!faltaMig(e.message)) notificar(e.message, 'erro')
    } finally {
      setCarregando(false)
    }
  }, [api, demo, escopo])

  useEffect(() => { carregar() }, [carregar])

  // Consultas de convênio sem guia (últimos 60 dias)
  const carregarPendentes = useCallback(async () => {
    if (demo || !escopo || !medicos.length) return
    const ids = escopo.medico_id ? [escopo.medico_id] : medicos.map(m => m.id)
    const desde = new Date(Date.now() - 60 * 86400000).toISOString()
    const { data, error } = await supabase.from('consultas').select('id, criado_em, paciente_id, pacientes(nome, convenio, nr_carteirinha)')
      .in('medico_id', ids).gte('criado_em', desde).order('criado_em', { ascending: false }).limit(300)
    if (error) return
    const comGuia = new Set(guias.map(g => g.consulta_id).filter(Boolean))
    setPendentes((data || []).filter((c: any) => c.pacientes && normalizarConvenio(c.pacientes.convenio) !== 'Particular' && !comGuia.has(c.id))
      .map((c: any) => ({
        consulta_id: c.id, paciente: c.pacientes.nome, convenio: normalizarConvenio(c.pacientes.convenio),
        data: new Date(c.criado_em).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }), carteira: c.pacientes.nr_carteirinha,
      })))
  }, [demo, escopo, medicos, guias])

  useEffect(() => { carregarPendentes() }, [carregarPendentes])

  const opMap = useMemo(() => Object.fromEntries(operadoras.map(o => [o.id, o])), [operadoras])

  // ── preços ───────────────────────────────────────────────────────────────
  const carregarPrecos = useCallback(async (opId: string) => {
    if (demo || precos[opId]) return
    try {
      const j = await api(`precos?operadora_id=${opId}`)
      setPrecos(p => ({ ...p, [opId]: j.precos }))
    } catch { /* aviso já tratado */ }
  }, [api, demo, precos])

  const salvarPreco = useCallback(async (opId: string, item: { codigo_tuss: string; descricao: string; valor: number }): Promise<Resultado> => {
    if (demo) {
      setPrecos(p => {
        const lista = (p[opId] || []).filter(x => x.codigo_tuss !== item.codigo_tuss)
        return { ...p, [opId]: [...lista, { id: `p${seq.current++}`, operadora_id: opId, ...item }].sort((a, b) => a.codigo_tuss.localeCompare(b.codigo_tuss)) }
      })
      notificar('Preço salvo (demonstração)')
      return { ok: true }
    }
    try {
      const j = await api('precos', 'POST', { operadora_id: opId, ...item })
      setPrecos(p => ({ ...p, [opId]: [...(p[opId] || []).filter(x => x.codigo_tuss !== j.preco.codigo_tuss), j.preco].sort((a, b) => a.codigo_tuss.localeCompare(b.codigo_tuss)) }))
      notificar('Preço salvo')
      return { ok: true }
    } catch (e: any) { notificar(e.message, 'erro'); return { ok: false, mensagem: e.message } }
  }, [api, demo])

  const excluirPreco = useCallback(async (opId: string, id: string) => {
    if (!demo) {
      try { await api(`precos?id=${id}`, 'DELETE') } catch (e: any) { notificar(e.message, 'erro'); return }
    }
    setPrecos(p => ({ ...p, [opId]: (p[opId] || []).filter(x => x.id !== id) }))
    notificar(demo ? 'Item removido (demonstração)' : 'Item removido')
  }, [api, demo])

  const importarCsv = useCallback(async (opId: string, csv: string): Promise<{ importados: number; ignorados: Array<{ linha: number; motivo: string }> } | null> => {
    if (demo) {
      const { itens, ignorados } = interpretarCsvPrecos(csv)
      setPrecos(p => {
        const mapa = new Map((p[opId] || []).map(x => [x.codigo_tuss, x]))
        itens.forEach(i => mapa.set(i.codigo_tuss, { id: `p${seq.current++}`, operadora_id: opId, ...i }))
        return { ...p, [opId]: Array.from(mapa.values()).sort((a, b) => a.codigo_tuss.localeCompare(b.codigo_tuss)) }
      })
      return { importados: itens.length, ignorados }
    }
    try {
      const j = await api('precos/importar', 'POST', { operadora_id: opId, csv })
      const l = await api(`precos?operadora_id=${opId}`)
      setPrecos(p => ({ ...p, [opId]: l.precos }))
      return j
    } catch (e: any) {
      notificar(e.message, 'erro')
      return e.dados?.ignorados ? { importados: 0, ignorados: e.dados.ignorados } : null
    }
  }, [api, demo])

  // ── operadoras ───────────────────────────────────────────────────────────
  const salvarOperadora = useCallback(async (op: Partial<Operadora>): Promise<Resultado> => {
    if (demo) {
      if (op.id) setOperadoras(l => l.map(o => o.id === op.id ? { ...o, ...op } as Operadora : o))
      else setOperadoras(l => [...l, { ativo: true, versao_tiss: '4.01.00', ...op, id: `op-${seq.current++}` } as Operadora])
      notificar('Operadora salva (demonstração)')
      return { ok: true }
    }
    try {
      const j = await api('operadoras', op.id ? 'PATCH' : 'POST', op)
      setOperadoras(l => op.id ? l.map(o => o.id === op.id ? j.operadora : o) : [...l, j.operadora])
      notificar('Operadora salva')
      return { ok: true }
    } catch (e: any) { return { ok: false, erros: e.dados?.erros, mensagem: e.message } }
  }, [api, demo])

  const excluirOperadora = useCallback(async (id: string) => {
    if (demo) {
      if (guias.some(g => g.operadora_id === id)) setOperadoras(l => l.map(o => o.id === id ? { ...o, ativo: false } : o))
      else setOperadoras(l => l.filter(o => o.id !== id))
      notificar('Operadora atualizada (demonstração)')
      return
    }
    try {
      const j = await api(`operadoras?id=${id}`, 'DELETE')
      if (j.desativada) { setOperadoras(l => l.map(o => o.id === id ? { ...o, ativo: false } : o)); notificar('Operadora tem guias — foi desativada') }
      else { setOperadoras(l => l.filter(o => o.id !== id)); notificar('Operadora excluída') }
    } catch (e: any) { notificar(e.message, 'erro') }
  }, [api, demo, guias])

  // ── guias ────────────────────────────────────────────────────────────────
  const proximoNumeroDemo = (opId: string) =>
    String(Math.max(0, ...guias.filter(g => g.operadora_id === opId).map(g => Number(g.numero_guia_prestador) || 0)) + 1)

  const novaGuia = useCallback((opId?: string): Guia => {
    const med = medicos[0]
    const op = opId || operadoras.find(o => o.ativo !== false)?.id || ''
    const preco = (precos[op] || []).find(p => p.codigo_tuss === '10101012')
    return {
      id: '', operadora_id: op, tipo: 'consulta', numero_guia_prestador: '', numero_carteira: '', nome_beneficiario: '',
      data_atendimento: new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }),
      procedimentos: [{ codigo_tuss: '10101012', descricao: preco?.descricao || 'Consulta em consultório', quantidade: 1, valor_unitario: Number(preco?.valor) || 0 }],
      valor_total: Number(preco?.valor) || 0, tipo_consulta: '1', tipo_atendimento: '05', indicacao_acidente: '9', carater_atendimento: '1',
      profissional: profissionalDoMedico(med), status: 'rascunho', medico_id: med?.id || null,
    }
  }, [medicos, operadoras, precos])

  /** Salva (cria ou atualiza). `acao: 'pronta'` valida e marca como pronta. */
  const salvarGuia = useCallback(async (g: Guia, acao?: 'pronta' | 'rascunho'): Promise<Resultado> => {
    const dados = { ...g, valor_total: totalProcedimentos(g.procedimentos) }
    if (acao === 'pronta') {
      const v = validarGuia(dados, { operadora: opMap[g.operadora_id] })
      if (!v.ok) return { ok: false, erros: v.erros, mensagem: 'A guia tem pendências.' }
    }
    if (demo) {
      const ev = { em: agoraIso(), evento: acao === 'pronta' ? 'pronta' : 'editada' }
      let salva: Guia
      if (!g.id) {
        salva = { ...dados, id: `guia-${seq.current++}`, numero_guia_prestador: proximoNumeroDemo(g.operadora_id), status: acao === 'pronta' ? 'pronta' : 'rascunho', historico: [{ em: agoraIso(), evento: 'criada' }] }
        setGuias(l => [salva, ...l])
      } else {
        const quebrou = !acao && dados.status === 'pronta' && !validarGuia(dados, { operadora: opMap[g.operadora_id] }).ok
        salva = { ...dados, status: acao === 'pronta' ? 'pronta' : acao === 'rascunho' || quebrou ? 'rascunho' : dados.status, historico: [...(dados.historico || []), ev] }
        setGuias(l => l.map(x => x.id === g.id ? salva : x))
      }
      notificar(acao === 'pronta' ? 'Guia pronta para lote (demonstração)' : 'Guia salva (demonstração)')
      return { ok: true, guia: salva }
    }
    try {
      let salva: Guia
      if (!g.id) {
        const { id, numero_guia_prestador, status, ...resto } = dados
        salva = (await api('guias', 'POST', resto)).guia
        if (acao === 'pronta') salva = (await api('guias', 'PATCH', { id: salva.id, acao: 'pronta' })).guia
        setGuias(l => [salva, ...l])
      } else {
        const { numero_guia_prestador, status, historico, lote_id, valor_pago, valor_glosado, motivo_glosa, retorno_em, criado_em, atualizado_em, operadora_id, ...resto } = dados
        salva = (await api('guias', 'PATCH', { ...resto, acao })).guia
        setGuias(l => l.map(x => x.id === g.id ? salva : x))
      }
      notificar(acao === 'pronta' ? 'Guia pronta para lote' : 'Guia salva')
      return { ok: true, guia: salva }
    } catch (e: any) {
      return { ok: false, erros: e.dados?.erros, mensagem: e.message }
    }
  }, [api, demo, opMap, guias])

  const excluirGuia = useCallback(async (id: string) => {
    if (!demo) {
      try { await api(`guias?id=${id}`, 'DELETE') } catch (e: any) { notificar(e.message, 'erro'); return false }
    }
    setGuias(l => l.filter(g => g.id !== id))
    notificar(demo ? 'Guia excluída (demonstração)' : 'Guia excluída')
    return true
  }, [api, demo])

  /** Valida e marca várias guias como prontas. Retorna as que ficaram com pendência. */
  const marcarProntas = useCallback(async (ids: string[]) => {
    const alvo = guias.filter(g => ids.includes(g.id) && g.status === 'rascunho')
    let ok = 0
    const falhas: Guia[] = []
    for (const g of alvo) {
      const r = await salvarGuia(g, 'pronta')
      if (r.ok) ok++
      else falhas.push(g)
    }
    if (falhas.length) notificar(`${ok} pronta(s) · ${falhas.length} com pendências`, 'erro')
    return falhas
  }, [guias, salvarGuia])

  const gerarDaConsulta = useCallback(async (p: Pendente): Promise<Resultado> => {
    if (demo) {
      const op = operadoras.find(o => normalizarConvenio(o.nome) === p.convenio)
      if (!op) return { ok: false, mensagem: `Cadastre a operadora "${p.convenio}" antes.` }
      const base = novaGuia(op.id)
      const guia: Guia = {
        ...base, id: `guia-${seq.current++}`, numero_guia_prestador: proximoNumeroDemo(op.id), consulta_id: p.consulta_id,
        nome_beneficiario: p.paciente, numero_carteira: p.carteira || '', data_atendimento: p.data, tipo_consulta: '2',
        historico: [{ em: agoraIso(), evento: 'criada', detalhe: 'Gerada a partir da consulta' }],
      }
      setGuias(l => [guia, ...l])
      setPendentes(l => l.filter(x => x.consulta_id !== p.consulta_id))
      return { ok: true, guia }
    }
    try {
      const j = await api('guias/gerar', 'POST', { consulta_id: p.consulta_id })
      setGuias(l => l.some(x => x.id === j.guia.id) ? l : [j.guia, ...l])
      setPendentes(l => l.filter(x => x.consulta_id !== p.consulta_id))
      return { ok: true, guia: j.guia }
    } catch (e: any) { return { ok: false, mensagem: e.message } }
  }, [api, demo, operadoras, novaGuia, guias])

  // ── lotes ────────────────────────────────────────────────────────────────
  const montarLote = useCallback(async (ids: string[]): Promise<Resultado & { lotes?: Lote[] }> => {
    const prontas = guias.filter(g => ids.includes(g.id) && g.status === 'pronta')
    if (!prontas.length) return { ok: false, mensagem: 'Selecione guias prontas para montar o lote.' }
    if (demo) {
      const novos: Lote[] = []
      const numeros: Record<string, number> = {}
      for (const grp of agruparParaLote(prontas)) {
        const n = (numeros[grp.operadora_id] ??= Math.max(0, ...lotes.filter(l => l.operadora_id === grp.operadora_id).map(l => l.numero_lote))) + 1
        numeros[grp.operadora_id] = n
        novos.push({
          id: `lote-${seq.current++}`, operadora_id: grp.operadora_id, numero_lote: n, tipo_guia: grp.tipo_guia, competencia: grp.competencia,
          quantidade_guias: grp.guias.length, valor_total: grp.valor_total, status: 'aberto', criado_em: agoraIso(),
        })
      }
      setLotes(l => [...novos, ...l])
      setGuias(l => l.map(g => {
        const lote = novos.find(n => n.operadora_id === g.operadora_id && n.tipo_guia === g.tipo && n.competencia === g.data_atendimento.slice(0, 7))
        return prontas.some(p => p.id === g.id) && lote ? { ...g, status: 'em_lote', lote_id: lote.id } : g
      }))
      notificar(`${novos.length} lote(s) montado(s) (demonstração)`)
      return { ok: true, lotes: novos }
    }
    try {
      const j = await api('lotes', 'POST', { guia_ids: prontas.map(g => g.id) })
      notificar(`${j.lotes.length} lote(s) montado(s)`)
      await carregar()
      return { ok: true, lotes: j.lotes }
    } catch (e: any) {
      const pend = e.dados?.guias as Array<{ numero: string; erros: Problema[] }> | undefined
      return { ok: false, mensagem: pend?.length ? `${e.message} Guias: ${pend.map(p => p.numero).join(', ')}` : e.message }
    }
  }, [api, carregar, demo, guias, lotes])

  const baixar = (bytes: Uint8Array | Blob, nome: string) => {
    const blob = bytes instanceof Blob ? bytes : new Blob([bytes as BlobPart], { type: 'application/xml;charset=ISO-8859-1' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = nome
    document.body.appendChild(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 2000)
  }

  const exportarXml = useCallback(async (lote: Lote): Promise<Resultado> => {
    if (demo) {
      const gs = guias.filter(g => g.lote_id === lote.id)
      const pend = gs.map(g => ({ g, v: validarGuia(g, { operadora: opMap[lote.operadora_id] }) })).filter(x => !x.v.ok)
      if (pend.length) return { ok: false, mensagem: `Guias com pendências: ${pend.map(p => p.g.numero_guia_prestador).join(', ')}` }
      try {
        const { xml, hash, nomeArquivo } = gerarXmlLote({ operadora: opMap[lote.operadora_id], lote, guias: gs })
        baixar(xmlParaBytes(xml), nomeArquivo)
        setLotes(l => l.map(x => x.id === lote.id ? { ...x, xml_hash: hash } : x))
        notificar('XML gerado (demonstração)')
        return { ok: true }
      } catch (e: any) { return { ok: false, mensagem: e.message } }
    }
    const sp = new URLSearchParams(Object.entries(escopo || {}).filter(([, v]) => v) as [string, string][])
    const r = await fetch(`/api/tiss/lotes/${lote.id}/xml?${sp}`)
    if (!r.ok) {
      const j = await r.json().catch(() => ({}))
      const pend = j.guias as Array<{ numero: string }> | undefined
      return { ok: false, mensagem: pend?.length ? `${j.error} Guias: ${pend.map(p => p.numero).join(', ')}` : j.error || 'Erro ao gerar XML' }
    }
    const nome = /filename="([^"]+)"/.exec(r.headers.get('Content-Disposition') || '')?.[1] || `lote-${lote.numero_lote}.xml`
    baixar(await r.blob(), nome)
    const hash = r.headers.get('X-Tiss-Hash')
    if (hash) setLotes(l => l.map(x => x.id === lote.id ? { ...x, xml_hash: hash } : x))
    notificar('XML exportado')
    return { ok: true }
  }, [demo, escopo, guias, opMap])

  const marcarEnviado = useCallback(async (lote: Lote, protocolo: string): Promise<Resultado> => {
    if (demo) {
      setLotes(l => l.map(x => x.id === lote.id ? { ...x, status: 'enviado', enviado_em: agoraIso(), protocolo: protocolo || null } : x))
      setGuias(l => l.map(g => g.lote_id === lote.id && g.status === 'em_lote' ? { ...g, status: 'enviada' } : g))
      notificar('Lote marcado como enviado (demonstração)')
      return { ok: true }
    }
    try {
      await api('lotes', 'PATCH', { id: lote.id, acao: 'enviar', protocolo })
      notificar('Lote marcado como enviado')
      await carregar()
      return { ok: true }
    } catch (e: any) { return { ok: false, mensagem: e.message } }
  }, [api, carregar, demo])

  const salvarProtocolo = useCallback(async (lote: Lote, protocolo: string) => {
    if (!demo) {
      try { await api('lotes', 'PATCH', { id: lote.id, acao: 'protocolo', protocolo }) } catch (e: any) { notificar(e.message, 'erro'); return }
    }
    setLotes(l => l.map(x => x.id === lote.id ? { ...x, protocolo: protocolo || null } : x))
    notificar('Protocolo salvo')
  }, [api, demo])

  const desfazerLote = useCallback(async (lote: Lote) => {
    if (!demo) {
      try { await api(`lotes?id=${lote.id}`, 'DELETE') } catch (e: any) { notificar(e.message, 'erro'); return }
    }
    setLotes(l => l.filter(x => x.id !== lote.id))
    setGuias(l => l.map(g => g.lote_id === lote.id ? { ...g, status: 'pronta', lote_id: null } : g))
    notificar(demo ? 'Lote desfeito (demonstração)' : 'Lote desfeito — guias voltaram para "pronta"')
  }, [api, demo])

  // ── retorno financeiro ───────────────────────────────────────────────────
  const registrarRetorno = useCallback(async (g: Guia, valorPago: number, motivo: string): Promise<Resultado> => {
    if (demo) {
      const { status, valor_glosado } = statusRetorno(g.valor_total, valorPago)
      if (valor_glosado > 0 && !motivo.trim()) return { ok: false, mensagem: 'Informe o motivo da glosa.' }
      const nova: Guia = { ...g, status, valor_pago: arred2(valorPago), valor_glosado, motivo_glosa: valor_glosado > 0 ? motivo : null, retorno_em: agoraIso() }
      setGuias(l => {
        const lista = l.map(x => x.id === g.id ? nova : x)
        if (g.lote_id && lista.filter(x => x.lote_id === g.lote_id).every(x => ['paga', 'glosada', 'paga_parcial'].includes(x.status))) {
          setLotes(ls => ls.map(lt => lt.id === g.lote_id ? { ...lt, status: 'processado' } : lt))
        }
        return lista
      })
      notificar('Retorno registrado (demonstração)')
      return { ok: true, guia: nova }
    }
    try {
      const j = await api('retorno', 'POST', { guia_id: g.id, valor_pago: valorPago, motivo_glosa: motivo })
      setGuias(l => l.map(x => x.id === g.id ? j.guia : x))
      notificar('Retorno registrado')
      if (g.lote_id) api('lotes').then(r => setLotes(r.lotes)).catch(() => {})
      return { ok: true, guia: j.guia }
    } catch (e: any) { return { ok: false, mensagem: e.message } }
  }, [api, demo])

  const reapresentar = useCallback(async (g: Guia): Promise<Resultado> => {
    if (demo) {
      const valor = Number(g.valor_glosado) || 0
      const fator = valor / (Number(g.valor_total) || 1)
      const procs = g.procedimentos.map(p => ({ ...p, valor_unitario: arred2(p.valor_unitario * fator) }))
      const nova: Guia = {
        ...g, id: `guia-${seq.current++}`, numero_guia_prestador: proximoNumeroDemo(g.operadora_id), consulta_id: null, lote_id: null,
        status: 'rascunho', procedimentos: procs, valor_total: totalProcedimentos(procs), valor_pago: null, valor_glosado: null,
        motivo_glosa: null, retorno_em: null, observacao: `Reapresentação da guia ${g.numero_guia_prestador}`,
        historico: [{ em: agoraIso(), evento: 'criada', detalhe: `Reapresentação da guia ${g.numero_guia_prestador}` }],
      }
      setGuias(l => [nova, ...l.map(x => x.id === g.id ? { ...x, historico: [...(x.historico || []), { em: agoraIso(), evento: 'reapresentada', detalhe: `Nova guia ${nova.numero_guia_prestador}` }] } : x)])
      notificar('Nova guia criada para reapresentação (demonstração)')
      return { ok: true, guia: nova }
    }
    try {
      const j = await api('retorno', 'POST', { guia_id: g.id, acao: 'reapresentar' })
      setGuias(l => [j.guia, ...l])
      notificar('Nova guia criada para reapresentação')
      return { ok: true, guia: j.guia }
    } catch (e: any) { return { ok: false, mensagem: e.message } }
  }, [api, demo, guias])

  return {
    demo, escopo, medicos, operadoras, opMap, guias, lotes, precos, pendentes, carregando, semMigration, guiaInicial,
    recarregar: carregar, carregarPrecos, salvarPreco, excluirPreco, importarCsv, salvarOperadora, excluirOperadora,
    novaGuia, salvarGuia, excluirGuia, marcarProntas, gerarDaConsulta, montarLote, exportarXml, marcarEnviado, salvarProtocolo,
    desfazerLote, registrarRetorno, reapresentar,
  }
}

export type Faturamento = ReturnType<typeof useFaturamento>
