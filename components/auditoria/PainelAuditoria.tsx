'use client'
/**
 * Painel "Registro de acessos" (Minha clínica → Privacidade & LGPD).
 *
 *   <PainelAuditoria />                          // escopo do usuário logado
 *   <PainelAuditoria clinicaId={c.id} />         // clínica inteira
 *   <PainelAuditoria pacienteId={p.id} />        // um paciente
 *   <PainelAuditoria demo />                     // dados de exemplo (também com ?demo=1)
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Download, ShieldCheck, ChevronLeft, ChevronRight, TriangleAlert, RotateCcw } from 'lucide-react'
import { tokens } from '@/lib/design-tokens'
import { Badge, Button, Card, EmptyState, Field, Input, SearchInput, Select, Avatar, Icon } from '@/components/ui'
import { notificar } from '@/components/ui/dialogos'
import {
  usuarioAtualAuditoria, ROTULO_ACAO, ROTULO_RECURSO, ROTULO_USUARIO, ACOES_AUDITORIA, RECURSOS_AUDITORIA,
  type RegistroAuditoria,
} from '@/lib/auditoria'
import {
  buscarAuditoria, dadosDemoAuditoria, fmtDataHora, gerarCSV, baixarArquivo, resumoUA, TOM_ACAO, type FiltrosAuditoria,
} from './util'

const T = tokens
const POR_PAGINA = 50

function useEstreito(limite = 760) {
  const [estreito, setEstreito] = useState(false)
  useEffect(() => {
    const f = () => setEstreito(window.innerWidth < limite)
    f(); window.addEventListener('resize', f)
    return () => window.removeEventListener('resize', f)
  }, [limite])
  return estreito
}

export default function PainelAuditoria({ clinicaId, medicoId, pacienteId, demo }: {
  clinicaId?: string | null
  medicoId?: string | null
  pacienteId?: string | null
  demo?: boolean
}) {
  const estreito = useEstreito()
  const [modoDemo, setModoDemo] = useState(!!demo)
  const [escopo, setEscopo] = useState<{ clinicaId?: string | null; medicoId?: string | null; pacienteId?: string | null } | null>(null)
  const [registros, setRegistros] = useState<RegistroAuditoria[]>([])
  const [total, setTotal] = useState(0)
  const [pagina, setPagina] = useState(1)
  const [carregando, setCarregando] = useState(true)
  const [tabelaAusente, setTabelaAusente] = useState(false)
  const [erro, setErro] = useState('')
  const [exportando, setExportando] = useState(false)

  const [busca, setBusca] = useState('')
  const [acao, setAcao] = useState('')
  const [recurso, setRecurso] = useState('')
  const [usuarioTipo, setUsuarioTipo] = useState('')
  const [de, setDe] = useState('')
  const [ate, setAte] = useState('')

  // Escopo: props explícitas ou usuário logado
  useEffect(() => {
    let d = !!demo
    try { if (new URLSearchParams(window.location.search).get('demo') === '1') d = true } catch {}
    setModoDemo(d)
    if (clinicaId || medicoId || pacienteId) { setEscopo({ clinicaId, medicoId, pacienteId }); return }
    const u = usuarioAtualAuditoria()
    setEscopo(u ? { clinicaId: u.clinica_id, medicoId: u.medico_id } : {})
  }, [clinicaId, medicoId, pacienteId, demo])

  const filtros: FiltrosAuditoria | null = useMemo(() => escopo && ({
    ...escopo, acao, recurso, usuarioTipo, de, ate,
  }), [escopo, acao, recurso, usuarioTipo, de, ate])

  const carregar = useCallback(async () => {
    if (!filtros) return
    setCarregando(true); setErro('')
    if (modoDemo) {
      let lista = dadosDemoAuditoria(filtros.pacienteId)
      if (filtros.pacienteId) lista = lista.filter(r => r.paciente_id === filtros.pacienteId)
      if (acao) lista = lista.filter(r => r.acao === acao)
      if (recurso) lista = lista.filter(r => r.recurso === recurso)
      if (usuarioTipo) lista = lista.filter(r => r.usuario_tipo === usuarioTipo)
      if (de) lista = lista.filter(r => r.criado_em >= new Date(de + 'T00:00:00').toISOString())
      if (ate) lista = lista.filter(r => r.criado_em <= new Date(ate + 'T23:59:59').toISOString())
      setRegistros(lista); setTotal(lista.length); setTabelaAusente(false); setCarregando(false)
      return
    }
    if (!filtros.clinicaId && !filtros.medicoId && !filtros.pacienteId) {
      setRegistros([]); setTotal(0); setCarregando(false); return
    }
    try {
      const r = await buscarAuditoria(filtros, pagina, POR_PAGINA)
      setRegistros(r.registros); setTotal(r.total); setTabelaAusente(!!r.tabela_ausente)
      if (r.error) setErro(r.error)
    } catch (e: any) {
      setErro(e?.message || 'Falha ao carregar')
    } finally {
      setCarregando(false)
    }
  }, [filtros, pagina, modoDemo, acao, recurso, usuarioTipo, de, ate])

  useEffect(() => { carregar() }, [carregar])
  useEffect(() => { setPagina(1) }, [acao, recurso, usuarioTipo, de, ate])

  // Busca por texto: só na página carregada (quem / paciente / IP)
  const visiveis = useMemo(() => {
    const t = busca.trim().toLowerCase()
    if (!t) return registros
    return registros.filter(r =>
      [r.usuario_nome, r.paciente_nome, r.ip].some(v => (v || '').toLowerCase().includes(t)))
  }, [registros, busca])

  const temFiltro = !!(acao || recurso || usuarioTipo || de || ate || busca)
  const limpar = () => { setAcao(''); setRecurso(''); setUsuarioTipo(''); setDe(''); setAte(''); setBusca('') }
  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA))

  const exportarCSV = async () => {
    if (!filtros) return
    setExportando(true)
    try {
      let todos: RegistroAuditoria[] = []
      if (modoDemo) todos = registros
      else {
        for (let p = 1; p <= 20; p++) {
          const r = await buscarAuditoria(filtros, p, 1000)
          todos = todos.concat(r.registros)
          if (r.error || todos.length >= r.total || r.registros.length < 1000) break
        }
      }
      const t = busca.trim().toLowerCase()
      if (t) todos = todos.filter(r => [r.usuario_nome, r.paciente_nome, r.ip].some(v => (v || '').toLowerCase().includes(t)))
      if (!todos.length) { notificar('Nada para exportar com estes filtros', 'info'); return }
      const hoje = new Date().toISOString().slice(0, 10)
      baixarArquivo(gerarCSV(todos), `registro-de-acessos-${hoje}.csv`)
      notificar(`${todos.length} ${todos.length === 1 ? 'registro exportado' : 'registros exportados'}`)
    } catch {
      notificar('Não foi possível exportar', 'erro')
    } finally {
      setExportando(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 260px', minWidth: 0 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: T.text.primary }}>Registro de acessos</h3>
          <p style={{ margin: '4px 0 0', fontSize: 12.5, color: T.text.quaternary, lineHeight: 1.45 }}>
            Quem abriu, editou ou exportou dados de pacientes. Exigido pela LGPD e pelo CFM; os registros não podem ser alterados.
          </p>
        </div>
        <Button variant="secondary" icon={Download} onClick={exportarCSV} disabled={exportando || carregando || total === 0}>
          {exportando ? 'Exportando...' : 'Exportar CSV'}
        </Button>
      </div>

      {modoDemo && <Badge tone="pending" dot style={{ alignSelf: 'flex-start' }}>Modo demonstração — dados de exemplo</Badge>}

      {tabelaAusente && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px', borderRadius: 12, background: T.status.warningBg, color: T.status.warningText, fontSize: 12.5, lineHeight: 1.45 }}>
          <Icon icon={TriangleAlert} size={15} />
          <span>A tabela de auditoria ainda não existe no banco. Rode a migration <b className="mono">0013_auditoria_acessos.sql</b> para começar a registrar os acessos.</span>
        </div>
      )}

      {/* Filtros */}
      <div style={{ display: 'grid', gridTemplateColumns: estreito ? '1fr 1fr' : 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10, alignItems: 'end' }}>
        <div style={{ gridColumn: estreito ? '1 / -1' : 'span 2', minWidth: 0 }}>
          <Field label="Buscar">
            <SearchInput value={busca} onChange={setBusca} placeholder="Usuário, paciente ou IP" />
          </Field>
        </div>
        <Field label="Ação">
          <Select value={acao} onChange={e => setAcao(e.target.value)}>
            <option value="">Todas</option>
            {ACOES_AUDITORIA.map(a => <option key={a} value={a}>{ROTULO_ACAO[a]}</option>)}
          </Select>
        </Field>
        <Field label="O quê">
          <Select value={recurso} onChange={e => setRecurso(e.target.value)}>
            <option value="">Tudo</option>
            {RECURSOS_AUDITORIA.map(r => <option key={r} value={r}>{ROTULO_RECURSO[r]}</option>)}
          </Select>
        </Field>
        <Field label="Perfil">
          <Select value={usuarioTipo} onChange={e => setUsuarioTipo(e.target.value)}>
            <option value="">Todos</option>
            {Object.entries(ROTULO_USUARIO).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </Select>
        </Field>
        <Field label="De">
          <Input type="date" value={de} onChange={e => setDe(e.target.value)} />
        </Field>
        <Field label="Até">
          <Input type="date" value={ate} onChange={e => setAte(e.target.value)} />
        </Field>
      </div>

      <Card padding={0} style={{ overflow: 'hidden' }}>
        {carregando ? (
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[0, 1, 2, 3, 4].map(i => <div key={i} className="c360-skel" style={{ height: 40, borderRadius: 10 }} />)}
          </div>
        ) : erro ? (
          <EmptyState icon={TriangleAlert} titulo="Não foi possível carregar os registros" descricao={erro}
            acao={<Button variant="secondary" size="sm" icon={RotateCcw} onClick={carregar}>Tentar de novo</Button>} />
        ) : visiveis.length === 0 ? (
          <EmptyState icon={ShieldCheck}
            titulo={temFiltro ? 'Nenhum acesso com estes filtros' : 'Nenhum acesso registrado ainda'}
            descricao={temFiltro ? 'Ajuste ou limpe os filtros para ver mais registros.' : 'Cada vez que alguém abrir, editar ou exportar dados de um paciente, o acesso aparece aqui.'}
            acao={temFiltro ? <Button variant="secondary" size="sm" onClick={limpar}>Limpar filtros</Button> : undefined} />
        ) : estreito ? (
          <div>
            {visiveis.map((r, i) => (
              <div key={r.id} style={{ display: 'flex', gap: 10, padding: '12px 14px', borderTop: i ? `1px solid ${T.border.muted}` : 'none' }}>
                <Avatar nome={r.usuario_nome || '?'} size={32} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: T.text.primary }}>{r.usuario_nome || 'Usuário'}</span>
                    <Badge tone={TOM_ACAO[r.acao] || 'neutral'}>{ROTULO_ACAO[r.acao] || r.acao}</Badge>
                  </div>
                  <p style={{ margin: '3px 0 0', fontSize: 12.5, color: T.text.secondary, overflowWrap: 'anywhere' }}>
                    {ROTULO_RECURSO[r.recurso] || r.recurso}{r.paciente_nome ? ' · ' + r.paciente_nome : ''}
                  </p>
                  <p className="mono" style={{ margin: '3px 0 0', fontSize: 11.5, color: T.text.tertiary }}>
                    {fmtDataHora(r.criado_em)}{r.ip ? ' · ' + r.ip : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: T.bg.page }}>
                  {['Quando', 'Quem', 'Ação', 'Paciente', 'IP / navegador'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontSize: 11, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: T.text.quaternary, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visiveis.map(r => {
                  const det = r.detalhes && Object.keys(r.detalhes).length
                    ? Object.entries(r.detalhes).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : typeof v === 'object' ? JSON.stringify(v) : v}`).join(' · ')
                    : ''
                  return (
                    <tr key={r.id} style={{ borderTop: `1px solid ${T.border.muted}` }}>
                      <td className="mono" style={{ padding: '10px 14px', fontSize: 12, color: T.text.secondary, whiteSpace: 'nowrap', verticalAlign: 'top' }}>{fmtDataHora(r.criado_em)}</td>
                      <td style={{ padding: '10px 14px', verticalAlign: 'top' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Avatar nome={r.usuario_nome || '?'} size={26} />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 600, color: T.text.primary }}>{r.usuario_nome || 'Usuário'}</div>
                            <div style={{ fontSize: 11.5, color: T.text.quaternary }}>{ROTULO_USUARIO[r.usuario_tipo] || r.usuario_tipo}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '10px 14px', verticalAlign: 'top' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <Badge tone={TOM_ACAO[r.acao] || 'neutral'}>{ROTULO_ACAO[r.acao] || r.acao}</Badge>
                          <span style={{ color: T.text.strong }}>{ROTULO_RECURSO[r.recurso] || r.recurso}</span>
                        </div>
                        {det && <div style={{ marginTop: 4, fontSize: 11.5, color: T.text.quaternary, maxWidth: 280 }}>{det}</div>}
                      </td>
                      <td style={{ padding: '10px 14px', verticalAlign: 'top', color: T.text.strong }}>
                        {r.paciente_id && !String(r.paciente_id).startsWith('demo') ? (
                          <a href={'/pacientes/' + r.paciente_id} style={{ color: T.text.strong, textDecoration: 'none', fontWeight: 500 }}>{r.paciente_nome || 'Paciente'}</a>
                        ) : (r.paciente_nome || <span style={{ color: T.text.tertiary }}>—</span>)}
                      </td>
                      <td style={{ padding: '10px 14px', verticalAlign: 'top' }}>
                        <div className="mono" style={{ fontSize: 12, color: T.text.secondary }}>{r.ip || '—'}</div>
                        {r.user_agent && <div style={{ fontSize: 11.5, color: T.text.tertiary }}>{resumoUA(r.user_agent)}</div>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {!carregando && !erro && total > POR_PAGINA && !modoDemo && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12.5, color: T.text.quaternary }}>
            {total} registros · página {pagina} de {totalPaginas}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="secondary" size="sm" icon={ChevronLeft} disabled={pagina <= 1} onClick={() => setPagina(p => p - 1)}>Anterior</Button>
            <Button variant="secondary" size="sm" iconRight={ChevronRight} disabled={pagina >= totalPaginas} onClick={() => setPagina(p => p + 1)}>Próxima</Button>
          </div>
        </div>
      )}
    </div>
  )
}
