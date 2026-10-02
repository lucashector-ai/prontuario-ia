'use client'

/**
 * Modelos de prontuário — seções que a IA usa para estruturar a consulta.
 * Modelos do sistema (código) + personalizados (tabela modelos_prontuario, migration 0014).
 * `?demo=1`: dados de exemplo, nada é gravado.
 */
import React, { useEffect, useMemo, useState } from 'react'
import {
  Plus, Copy, Trash2, ChevronUp, ChevronDown, GripVertical, FileText, Lock, Star, Eye, PencilLine, Info, Sparkles,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { tokens } from '@/lib/design-tokens'
import { usePageHeader } from '@/components/shell/header-context'
import {
  Button, IconButton, Badge, Input, Textarea, Field, Select, Checkbox, Switch, EmptyState, Icon, Overline, SegmentedControl,
} from '@/components/ui'
import { confirmar, notificar } from '@/components/ui/dialogos'
import { ESPECIALIDADES_CFM } from '@/lib/especialidades'
import {
  CHAVE_MODELO_PADRAO, ID_MODELO_SOAP, novoIdSecao, sugerirModeloPorEspecialidade,
  type CampoSoap, type ModeloProntuario, type SecaoModelo,
} from '@/lib/ai/modelos-prontuario'
import { useModelosProntuario } from '@/components/ia/useModelosProntuario'

const T = tokens

const CAMPOS_SOAP: Array<{ value: '' | CampoSoap; label: string }> = [
  { value: '', label: 'Automático' },
  { value: 'subjetivo', label: 'Subjetivo' },
  { value: 'objetivo', label: 'Objetivo' },
  { value: 'avaliacao', label: 'Avaliação' },
  { value: 'plano', label: 'Plano' },
]

const ehNovo = (id: string) => id.startsWith('novo-')
const lerLS = (k: string) => { try { return localStorage.getItem(k) } catch { return null } }
const gravarLS = (k: string, v: string) => { try { localStorage.setItem(k, v) } catch {} }

export default function ModelosProntuarioPage() {
  usePageHeader('Modelos de prontuário', 'Escolha como a IA organiza o prontuário de cada consulta')

  const [demo, setDemo] = useState(false)
  const [pronto, setPronto] = useState(false)
  useEffect(() => {
    setDemo(new URLSearchParams(window.location.search).get('demo') === '1')
    setPronto(true)
  }, [])

  return pronto ? <Conteudo demo={demo} /> : <Esqueleto />
}

function Conteudo({ demo }: { demo: boolean }) {
  const { sistema, personalizados, setPersonalizados, carregando, semTabela, dono } = useModelosProntuario({ demo })
  const [selId, setSelId] = useState<string>(ID_MODELO_SOAP)
  const [rascunho, setRascunho] = useState<ModeloProntuario | null>(null)
  const [sujo, setSujo] = useState(false)
  const [aba, setAba] = useState<'editar' | 'previa'>('editar')
  const [salvando, setSalvando] = useState(false)
  const [padraoLS, setPadraoLS] = useState<string | null>(null)

  useEffect(() => { setPadraoLS(lerLS(CHAVE_MODELO_PADRAO)) }, [])

  const sugeridoId = sugerirModeloPorEspecialidade(dono.especialidade)
  const padraoId = personalizados.find(m => m.padrao)?.id || padraoLS || ID_MODELO_SOAP
  const todos = useMemo(() => [...sistema, ...personalizados], [sistema, personalizados])
  const selecionado = rascunho && rascunho.id === selId ? rascunho : todos.find(m => m.id === selId) || sistema[0]
  const podeGravar = demo || (!semTabela && (!!dono.medicoId || !!dono.clinicaId))

  const pedirDescarte = async () => {
    if (!sujo) return true
    return confirmar({ titulo: 'Descartar alterações?', mensagem: 'As mudanças neste modelo ainda não foram salvas.', confirmar: 'Descartar', perigo: true })
  }

  const abrir = async (m: ModeloProntuario) => {
    if (m.id === selId) return
    if (!(await pedirDescarte())) return
    setSelId(m.id)
    setRascunho(m.sistema ? null : clonar(m))
    setSujo(false)
    setAba(m.sistema ? 'previa' : 'editar')
  }

  const novo = async (base?: ModeloProntuario) => {
    if (!(await pedirDescarte())) return
    const m: ModeloProntuario = base
      ? { ...clonar(base), id: 'novo-' + Date.now(), nome: base.nome + ' (cópia)', sistema: false, padrao: false }
      : {
        id: 'novo-' + Date.now(), nome: '', especialidade: dono.especialidade || '', padrao: false,
        secoes: [
          { id: novoIdSecao('queixa'), titulo: 'Queixa principal', instrucao: '', obrigatoria: true, soap: 'subjetivo' },
          { id: novoIdSecao('conduta'), titulo: 'Conduta', instrucao: '', obrigatoria: true, soap: 'plano' },
        ],
      }
    m.secoes = m.secoes.map(s => ({ ...s, id: novoIdSecao(s.titulo) }))
    setRascunho(m); setSelId(m.id); setSujo(true); setAba('editar')
  }

  const alterar = (patch: Partial<ModeloProntuario>) => {
    setRascunho(r => (r ? { ...r, ...patch } : r)); setSujo(true)
  }
  const alterarSecao = (i: number, patch: Partial<SecaoModelo>) => {
    setRascunho(r => (r ? { ...r, secoes: r.secoes.map((s, j) => (j === i ? { ...s, ...patch } : s)) } : r)); setSujo(true)
  }
  const mover = (de: number, para: number) => {
    setRascunho(r => {
      if (!r || para < 0 || para >= r.secoes.length || de === para) return r
      const secoes = [...r.secoes]
      const [x] = secoes.splice(de, 1)
      secoes.splice(para, 0, x)
      return { ...r, secoes }
    })
    setSujo(true)
  }
  const removerSecao = (i: number) => {
    setRascunho(r => (r ? { ...r, secoes: r.secoes.filter((_, j) => j !== i) } : r)); setSujo(true)
  }
  const adicionarSecao = () => {
    setRascunho(r => (r ? { ...r, secoes: [...r.secoes, { id: novoIdSecao(), titulo: '', instrucao: '', obrigatoria: false }] } : r)); setSujo(true)
  }

  const salvar = async () => {
    if (!rascunho) return
    const secoes = rascunho.secoes.filter(s => s.titulo.trim())
    if (!rascunho.nome.trim()) { notificar('Dê um nome ao modelo', 'erro'); return }
    if (!secoes.length) { notificar('Adicione pelo menos uma seção com título', 'erro'); return }
    const limpo: ModeloProntuario = { ...rascunho, nome: rascunho.nome.trim(), secoes: secoes.map(s => ({ ...s, titulo: s.titulo.trim() })) }

    if (demo) {
      const final = ehNovo(limpo.id) ? { ...limpo, id: 'demo-' + Date.now(), criado_em: new Date().toISOString() } : limpo
      setPersonalizados(p => ehNovo(limpo.id) ? [final, ...p] : p.map(x => (x.id === final.id ? final : x)))
      setRascunho(final); setSelId(final.id); setSujo(false)
      notificar('Modelo salvo (demonstração — nada foi gravado)', 'info')
      return
    }
    if (!podeGravar) { notificar('Não foi possível salvar: rode a migration 0014', 'erro'); return }

    setSalvando(true)
    const linha = {
      nome: limpo.nome,
      especialidade: limpo.especialidade || null,
      secoes: limpo.secoes,
      padrao: !!limpo.padrao,
      medico_id: dono.medicoId,
      clinica_id: dono.clinicaId,
    }
    const res = ehNovo(limpo.id)
      ? await supabase.from('modelos_prontuario').insert(linha).select('*').single()
      : await supabase.from('modelos_prontuario').update(linha).eq('id', limpo.id).select('*').single()
    setSalvando(false)
    if (res.error || !res.data) { notificar('Erro ao salvar o modelo', 'erro'); return }
    const final: ModeloProntuario = { ...limpo, id: res.data.id, criado_em: res.data.criado_em }
    setPersonalizados(p => ehNovo(limpo.id) ? [final, ...p] : p.map(x => (x.id === final.id ? final : x)))
    setRascunho(final); setSelId(final.id); setSujo(false)
    notificar('Modelo salvo')
  }

  const excluir = async () => {
    if (!rascunho) return
    if (ehNovo(rascunho.id)) { setRascunho(null); setSelId(ID_MODELO_SOAP); setSujo(false); return }
    const ok = await confirmar({ titulo: 'Excluir modelo?', mensagem: `"${rascunho.nome}" deixará de aparecer na nova consulta. Prontuários já gerados não mudam.`, confirmar: 'Excluir', perigo: true })
    if (!ok) return
    if (!demo) {
      const { error } = await supabase.from('modelos_prontuario').delete().eq('id', rascunho.id)
      if (error) { notificar('Erro ao excluir', 'erro'); return }
    }
    setPersonalizados(p => p.filter(x => x.id !== rascunho.id))
    if (padraoLS === rascunho.id) { gravarLS(CHAVE_MODELO_PADRAO, ID_MODELO_SOAP); setPadraoLS(ID_MODELO_SOAP) }
    setRascunho(null); setSelId(ID_MODELO_SOAP); setSujo(false)
    notificar(demo ? 'Modelo excluído (demonstração)' : 'Modelo excluído')
  }

  const tornarPadrao = async (m: ModeloProntuario) => {
    if (m.id === padraoId) return
    if (ehNovo(m.id)) { notificar('Salve o modelo antes de torná-lo padrão', 'info'); return }
    if (!demo && !m.sistema && podeGravar) {
      // Só um personalizado padrão por dono
      const anteriores = personalizados.filter(x => x.padrao && x.id !== m.id).map(x => x.id)
      if (anteriores.length) await supabase.from('modelos_prontuario').update({ padrao: false }).in('id', anteriores)
      const { error } = await supabase.from('modelos_prontuario').update({ padrao: true }).eq('id', m.id)
      if (error) { notificar('Erro ao marcar como padrão', 'erro'); return }
    } else if (!demo && m.sistema && podeGravar) {
      const anteriores = personalizados.filter(x => x.padrao).map(x => x.id)
      if (anteriores.length) await supabase.from('modelos_prontuario').update({ padrao: false }).in('id', anteriores)
    }
    setPersonalizados(p => p.map(x => ({ ...x, padrao: !m.sistema && x.id === m.id })))
    if (rascunho) setRascunho(r => (r ? { ...r, padrao: !m.sistema && r.id === m.id } : r))
    gravarLS(CHAVE_MODELO_PADRAO, m.id); setPadraoLS(m.id)
    notificar(`"${m.nome}" agora é o modelo padrão${demo ? ' (demonstração)' : ''}`)
  }

  const editavel = !!rascunho && rascunho.id === selId

  return (
    <div style={{ padding: '4px 0 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <style dangerouslySetInnerHTML={{ __html: `
        .mp-grid { display: grid; grid-template-columns: minmax(260px, 320px) minmax(0, 1fr); gap: 16px; align-items: start; }
        .mp-lista { position: sticky; top: 12px; }
        @media (max-width: 860px) { .mp-grid { grid-template-columns: minmax(0, 1fr); } .mp-lista { position: static; } }
        .mp-secao-top { display: flex; align-items: center; gap: 8px; }
        .mp-secao-meta { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
      ` }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <p style={{ margin: 0, flex: 1, minWidth: 220, fontSize: 13, color: T.text.secondary, lineHeight: 1.5 }}>
          O modelo define as seções do prontuário que a IA gera na nova consulta. Use os do sistema ou crie os seus.
        </p>
        {demo && <Badge tone="accent" dot>Demonstração</Badge>}
        <Button icon={Plus} onClick={() => novo()}>Novo modelo</Button>
      </div>

      {semTabela && !demo && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 12, background: T.status.warningBg, color: T.status.warning, fontSize: 12.5 }}>
          <Icon icon={Info} size={14} />
          Modelos personalizados indisponíveis: rode a migration 0014 no Supabase. Os modelos do sistema funcionam normalmente.
        </div>
      )}

      <div className="mp-grid">
        {/* ── Lista ─────────────────────────────────────────────────────────── */}
        <div className="mp-lista" style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Overline style={{ padding: '0 4px' }}>Do sistema</Overline>
            {sistema.map(m => (
              <ItemLista key={m.id} m={m} ativo={selId === m.id} padrao={padraoId === m.id} sugerido={m.id === sugeridoId && m.id !== ID_MODELO_SOAP} onClick={() => abrir(m)} />
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Overline style={{ padding: '0 4px' }}>Meus modelos</Overline>
            {carregando ? (
              [1, 2].map(i => <div key={i} className="c360-skel" style={{ height: 58, borderRadius: 12 }} />)
            ) : (
              <>
                {rascunho && ehNovo(rascunho.id) && (
                  <ItemLista m={{ ...rascunho, nome: rascunho.nome || 'Novo modelo' }} ativo={selId === rascunho.id} padrao={false} onClick={() => {}} novo />
                )}
                {personalizados.map(m => (
                  <ItemLista key={m.id} m={rascunho && rascunho.id === m.id ? rascunho : m} ativo={selId === m.id} padrao={padraoId === m.id} onClick={() => abrir(m)} />
                ))}
                {!personalizados.length && !(rascunho && ehNovo(rascunho.id)) && (
                  <div style={{ padding: '14px 12px', borderRadius: 12, border: `1px dashed ${T.border.strong}`, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 12.5, color: T.text.secondary, lineHeight: 1.5 }}>Crie um modelo do seu jeito ou duplique um do sistema para ajustar.</span>
                    <Button size="sm" variant="secondary" icon={Plus} onClick={() => novo()}>Criar modelo</Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── Detalhe ───────────────────────────────────────────────────────── */}
        <div style={{ background: T.bg.card, border: `1px solid ${T.border.default}`, borderRadius: 16, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          {/* Cabeçalho */}
          <div style={{ padding: '16px 18px', borderBottom: `1px solid ${T.border.muted}`, display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 200, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, letterSpacing: '-.015em', color: T.text.primary }}>
                  {selecionado.nome || 'Novo modelo'}
                </h2>
                {selecionado.sistema && <Badge tone="neutral" icon={Lock}>Sistema</Badge>}
                {padraoId === selecionado.id && <Badge tone="success" icon={Star}>Padrão</Badge>}
                {sujo && <Badge tone="pending" dot>Não salvo</Badge>}
              </div>
              <span style={{ fontSize: 12.5, color: T.text.quaternary }}>
                {selecionado.especialidade || 'Geral'} · {selecionado.secoes.length} seç{selecionado.secoes.length === 1 ? 'ão' : 'ões'}
                {selecionado.descricao ? ' · ' + selecionado.descricao : ''}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              {editavel && (
                <SegmentedControl<'editar' | 'previa'> size="sm" value={aba} onChange={setAba}
                  options={[{ value: 'editar', label: <Rotulo icon={PencilLine}>Editar</Rotulo> }, { value: 'previa', label: <Rotulo icon={Eye}>Prévia</Rotulo> }]} />
              )}
              <Button size="sm" variant="secondary" icon={Copy} onClick={() => novo(selecionado)}>Duplicar</Button>
              {padraoId !== selecionado.id && !ehNovo(selecionado.id) && (
                <Button size="sm" variant="secondary" icon={Star} onClick={() => tornarPadrao(selecionado)}>Tornar padrão</Button>
              )}
              {editavel && <IconButton icon={Trash2} tone="danger" variant="outline" size={32} title="Excluir modelo" onClick={excluir} />}
            </div>
          </div>

          {/* Corpo */}
          <div style={{ padding: 18 }}>
            {editavel && aba === 'editar' && rascunho ? (
              <Editor
                m={rascunho} padrao={padraoId === rascunho.id}
                onAlterar={alterar} onAlterarSecao={alterarSecao} onMover={mover} onRemover={removerSecao} onAdicionar={adicionarSecao}
                onPadrao={() => tornarPadrao(rascunho)}
              />
            ) : (
              <Previa m={selecionado} />
            )}
          </div>

          {editavel && (
            <div style={{ padding: '12px 18px', borderTop: `1px solid ${T.border.muted}`, display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
              {sujo && !ehNovo(rascunho!.id) && (
                <Button variant="ghost" onClick={() => { const orig = personalizados.find(x => x.id === rascunho!.id); if (orig) setRascunho(clonar(orig)); setSujo(false) }}>
                  Descartar
                </Button>
              )}
              <Button onClick={salvar} disabled={salvando || !sujo}>{salvando ? 'Salvando…' : 'Salvar modelo'}</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Editor ──────────────────────────────────────────────────────────────────

function Editor({ m, padrao, onAlterar, onAlterarSecao, onMover, onRemover, onAdicionar, onPadrao }: {
  m: ModeloProntuario
  padrao: boolean
  onAlterar: (p: Partial<ModeloProntuario>) => void
  onAlterarSecao: (i: number, p: Partial<SecaoModelo>) => void
  onMover: (de: number, para: number) => void
  onRemover: (i: number) => void
  onAdicionar: () => void
  onPadrao: () => void
}) {
  const [arrastando, setArrastando] = useState<number | null>(null)
  const [sobre, setSobre] = useState<number | null>(null)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        <Field label="Nome do modelo">
          <Input value={m.nome} placeholder="Ex.: Retorno de diabetes" onChange={e => onAlterar({ nome: e.target.value })} />
        </Field>
        <Field label="Especialidade">
          <Input value={m.especialidade} list="mp-especialidades" placeholder="Ex.: Endocrinologia" onChange={e => onAlterar({ especialidade: e.target.value })} />
          <datalist id="mp-especialidades">
            {['Geral', 'Nutrição', 'Psicologia', ...ESPECIALIDADES_CFM].map(e => <option key={e} value={e} />)}
          </datalist>
        </Field>
      </div>

      <Switch checked={padrao} onChange={v => { if (v) onPadrao() }} label="Modelo padrão"
        descricao="Usado na nova consulta quando você ainda não escolheu outro." />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Overline style={{ flex: 1 }}>Seções ({m.secoes.length})</Overline>
          <span style={{ fontSize: 11.5, color: T.text.tertiary }}>Arraste ou use as setas para ordenar</span>
        </div>

        {m.secoes.length === 0 && (
          <EmptyState icon={FileText} titulo="Nenhuma seção" descricao="Adicione as partes que o prontuário deve ter."
            acao={<Button size="sm" icon={Plus} onClick={onAdicionar}>Adicionar seção</Button>} />
        )}

        {m.secoes.map((s, i) => (
          <div key={s.id}
            draggable
            onDragStart={e => { setArrastando(i); e.dataTransfer.effectAllowed = 'move' }}
            onDragOver={e => { e.preventDefault(); if (sobre !== i) setSobre(i) }}
            onDragLeave={() => setSobre(x => (x === i ? null : x))}
            onDrop={e => { e.preventDefault(); if (arrastando != null) onMover(arrastando, i); setArrastando(null); setSobre(null) }}
            onDragEnd={() => { setArrastando(null); setSobre(null) }}
            style={{
              border: `1px solid ${sobre === i && arrastando !== i ? T.brand.primary : T.border.default}`,
              background: arrastando === i ? T.bg.cardSubtle : '#fff', opacity: arrastando === i ? 0.6 : 1,
              borderRadius: 14, padding: 12, display: 'flex', flexDirection: 'column', gap: 10, transition: 'border-color .15s',
            }}>
            <div className="mp-secao-top">
              <span title="Arrastar" style={{ cursor: 'grab', color: T.text.tertiary, display: 'grid', placeItems: 'center' }}>
                <GripVertical size={16} strokeWidth={1.6} />
              </span>
              <span className="mono" style={{ fontSize: 11.5, color: T.text.tertiary, width: 18, textAlign: 'center' }}>{i + 1}</span>
              <Input value={s.titulo} placeholder="Título da seção" onChange={e => onAlterarSecao(i, { titulo: e.target.value })}
                style={{ flex: 1, minWidth: 0, fontWeight: 600 }} />
              <IconButton icon={ChevronUp} size={30} title="Subir" disabled={i === 0} onClick={() => onMover(i, i - 1)} style={{ opacity: i === 0 ? 0.35 : 1 }} />
              <IconButton icon={ChevronDown} size={30} title="Descer" disabled={i === m.secoes.length - 1} onClick={() => onMover(i, i + 1)} style={{ opacity: i === m.secoes.length - 1 ? 0.35 : 1 }} />
              <IconButton icon={Trash2} size={30} tone="danger" title="Remover seção" onClick={() => onRemover(i)} />
            </div>
            <Textarea value={s.instrucao} rows={2} placeholder="Instrução para a IA: o que escrever nesta seção (opcional)"
              onChange={e => onAlterarSecao(i, { instrucao: e.target.value })} style={{ resize: 'vertical', fontSize: 13 }} />
            <div className="mp-secao-meta">
              <Checkbox checked={s.obrigatoria} onChange={v => onAlterarSecao(i, { obrigatoria: v })} label="Obrigatória" />
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: T.text.secondary }}>
                Entra no SOAP como
                <Select value={s.soap || ''} onChange={e => onAlterarSecao(i, { soap: (e.target.value || undefined) as CampoSoap | undefined })}
                  style={{ height: 32, fontSize: 12.5, width: 'auto', padding: '0 28px 0 10px' }}>
                  {CAMPOS_SOAP.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </Select>
              </label>
            </div>
          </div>
        ))}

        {m.secoes.length > 0 && (
          <button type="button" onClick={onAdicionar}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, height: 42, borderRadius: 12,
              border: `1px dashed ${T.border.strong}`, background: 'transparent', color: T.brand.primary,
              fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
            }}>
            <Plus size={15} strokeWidth={1.6} />Adicionar seção
          </button>
        )}
      </div>
    </div>
  )
}

// ── Prévia ──────────────────────────────────────────────────────────────────

function Previa({ m }: { m: ModeloProntuario }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: T.text.secondary }}>
        <Icon icon={Sparkles} size={14} color={T.brand.primary} />
        Assim o prontuário gerado pela IA será organizado:
      </div>
      <div style={{ border: `1px solid ${T.border.default}`, borderRadius: 14, padding: '18px 20px', background: T.bg.cardSubtle, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, paddingBottom: 12, borderBottom: `1px solid ${T.border.muted}` }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: T.text.primary, flex: 1 }}>{m.nome || 'Novo modelo'}</span>
          <span className="mono" style={{ fontSize: 11.5, color: T.text.tertiary }}>{new Date().toLocaleDateString('pt-BR')}</span>
        </div>
        {m.secoes.filter(s => s.titulo.trim()).map(s => (
          <div key={s.id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: T.text.strong }}>{s.titulo}</span>
              {!s.obrigatoria && <span style={{ fontSize: 11, color: T.text.tertiary }}>opcional</span>}
            </div>
            <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.55, color: T.text.quaternary, fontStyle: 'italic' }}>
              {s.instrucao || 'A IA preenche com o que for dito sobre este tema na consulta.'}
            </p>
          </div>
        ))}
        {!m.secoes.some(s => s.titulo.trim()) && <span style={{ fontSize: 12.5, color: T.text.tertiary }}>Adicione seções para ver a prévia.</span>}
      </div>
    </div>
  )
}

// ── Peças ───────────────────────────────────────────────────────────────────

function ItemLista({ m, ativo, padrao, sugerido, novo, onClick }: {
  m: ModeloProntuario; ativo: boolean; padrao: boolean; sugerido?: boolean; novo?: boolean; onClick: () => void
}) {
  return (
    <button type="button" onClick={onClick}
      style={{
        all: 'unset', boxSizing: 'border-box', width: '100%', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 12px', borderRadius: 12,
        border: `1px solid ${ativo ? T.brand.primaryAccentSoft : T.border.default}`,
        background: ativo ? T.brand.primarySoftBg : '#fff', transition: 'background .15s, border-color .15s',
      }}
      onMouseEnter={e => { if (!ativo) e.currentTarget.style.background = T.bg.hover }}
      onMouseLeave={e => { e.currentTarget.style.background = ativo ? T.brand.primarySoftBg : '#fff' }}>
      <span style={{
        width: 32, height: 32, borderRadius: 9, flexShrink: 0, display: 'grid', placeItems: 'center',
        background: ativo ? T.brand.primaryLight : T.bg.page, color: ativo ? T.brand.primary : T.text.secondary,
      }}><FileText size={15} strokeWidth={1.6} /></span>
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: ativo ? T.brand.primary : T.text.primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.nome}</span>
          {padrao && <Star size={12} strokeWidth={1.6} fill={T.status.warningAmber} color={T.status.warningAmber} style={{ flexShrink: 0 }} />}
        </span>
        <span style={{ fontSize: 11.5, color: T.text.quaternary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {novo ? 'Rascunho' : (m.especialidade || 'Geral') + ' · ' + m.secoes.length + ' seç' + (m.secoes.length === 1 ? 'ão' : 'ões')}
        </span>
      </span>
      {sugerido && <Badge tone="accent">Sugerido</Badge>}
    </button>
  )
}

function Rotulo({ icon, children }: { icon: typeof FileText; children: React.ReactNode }) {
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Icon icon={icon} size={13} />{children}</span>
}

function Esqueleto() {
  return (
    <div className="mp-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 320px) minmax(0, 1fr)', gap: 16, paddingTop: 4 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[1, 2, 3, 4].map(i => <div key={i} className="c360-skel" style={{ height: 56, borderRadius: 12 }} />)}
      </div>
      <div className="c360-skel" style={{ height: 360, borderRadius: 16 }} />
    </div>
  )
}

function clonar(m: ModeloProntuario): ModeloProntuario {
  return { ...m, secoes: m.secoes.map(s => ({ ...s })) }
}
