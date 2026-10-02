'use client'

/**
 * Seletor do modelo de prontuário usado pela IA ao estruturar a consulta.
 *
 *   <SeletorModeloProntuario
 *     especialidade={medico.especialidade}
 *     onChange={m => setModelo(m)} />
 *
 * Depois, no fetch de /api/estruturar:  body: { transcricao, modelo: modeloParaRequisicao(modelo) }
 *
 * - Lembra o último usado (localStorage).
 * - Sem histórico: usa o padrão marcado em /modelos-prontuario, senão o da especialidade, senão SOAP.
 * - `variante="segmentado"`: atalhos rápidos (SOAP · Livre · especialidade) + "Mais".
 */
import React, { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { FileText, ChevronDown, Check, Settings2, Sparkles, MoreHorizontal } from 'lucide-react'
import { tokens } from '@/lib/design-tokens'
import { Icon, SegmentedControl } from '@/components/ui'
import {
  CHAVE_MODELO_PADRAO, CHAVE_ULTIMO_MODELO, ID_MODELO_SOAP, sugerirModeloPorEspecialidade,
  type ModeloProntuario,
} from '@/lib/ai/modelos-prontuario'
import { useModelosProntuario } from './useModelosProntuario'

const T = tokens

type Props = {
  /** Modelo selecionado (controlado). Se omitido, o componente escolhe e avisa via onChange. */
  value?: string
  onChange: (modelo: ModeloProntuario) => void
  /** Especialidade do médico — define o modelo sugerido */
  especialidade?: string | null
  medicoId?: string | null
  clinicaId?: string | null
  variante?: 'select' | 'segmentado'
  demo?: boolean
  disabled?: boolean
  style?: React.CSSProperties
}

const lerLS = (k: string) => { try { return localStorage.getItem(k) } catch { return null } }
const gravarLS = (k: string, v: string) => { try { localStorage.setItem(k, v) } catch {} }

export function SeletorModeloProntuario({ value, onChange, especialidade, medicoId, clinicaId, variante = 'select', demo, disabled, style }: Props) {
  const { sistema, personalizados, carregando, dono } = useModelosProntuario({ demo, medicoId, clinicaId })
  const [interno, setInterno] = useState<string | null>(null)
  const [aberto, setAberto] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const avisouInicial = useRef(false)

  const todos = useMemo(() => [...sistema, ...personalizados], [sistema, personalizados])
  const sugeridoId = sugerirModeloPorEspecialidade(especialidade ?? dono.especialidade)
  const selecionadoId = value ?? interno
  const selecionado = todos.find(m => m.id === selecionadoId) || null

  // Escolha inicial (uma vez, depois de carregar os personalizados)
  useEffect(() => {
    if (carregando || avisouInicial.current) return
    avisouInicial.current = true
    if (value) {
      const m = todos.find(x => x.id === value)
      if (m) onChange(m)
      return
    }
    const existe = (id: string | null) => !!id && todos.some(m => m.id === id)
    const ultimo = lerLS(CHAVE_ULTIMO_MODELO)
    const padraoLS = lerLS(CHAVE_MODELO_PADRAO)
    const padraoDb = personalizados.find(m => m.padrao)?.id || null
    const id = [ultimo, padraoDb, padraoLS, sugeridoId, ID_MODELO_SOAP].find(existe) || ID_MODELO_SOAP
    setInterno(id)
    const m = todos.find(x => x.id === id)
    if (m) onChange(m)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carregando])

  useEffect(() => {
    if (!aberto) return
    const fora = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setAberto(false) }
    document.addEventListener('mousedown', fora)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', fora); document.removeEventListener('keydown', esc) }
  }, [aberto])

  const escolher = (m: ModeloProntuario) => {
    setInterno(m.id)
    gravarLS(CHAVE_ULTIMO_MODELO, m.id)
    setAberto(false)
    onChange(m)
  }

  const padraoId = personalizados.find(m => m.padrao)?.id || (typeof window !== 'undefined' ? lerLS(CHAVE_MODELO_PADRAO) : null)

  const item = (m: ModeloProntuario) => {
    const on = m.id === selecionadoId
    return (
      <button key={m.id} type="button" role="option" aria-selected={on} onClick={() => escolher(m)}
        style={{
          all: 'unset', boxSizing: 'border-box', width: '100%', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
          padding: '8px 10px', borderRadius: 10, background: on ? T.brand.primarySoftBg : 'transparent',
        }}
        onMouseEnter={e => { if (!on) e.currentTarget.style.background = T.bg.hover }}
        onMouseLeave={e => { e.currentTarget.style.background = on ? T.brand.primarySoftBg : 'transparent' }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: on ? T.brand.primary : T.text.primary }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.nome}</span>
            {m.id === sugeridoId && m.id !== ID_MODELO_SOAP && <Tag cor={T.brand.primary} bg={T.brand.primaryLight}>Sugerido</Tag>}
            {m.id === padraoId && <Tag cor={T.status.success} bg={T.status.successBg}>Padrão</Tag>}
          </span>
          <span style={{ fontSize: 11.5, color: T.text.quaternary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {m.especialidade || 'Geral'} · {m.secoes.length} seç{m.secoes.length === 1 ? 'ão' : 'ões'}
          </span>
        </div>
        {on && <Check size={15} strokeWidth={2} color={T.brand.primary} />}
      </button>
    )
  }

  const popover = aberto && (
    <div role="listbox" style={{
      position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 50, width: 'min(340px, calc(100vw - 32px))',
      maxHeight: 380, overflowY: 'auto', background: '#fff', borderRadius: 14, border: `1px solid ${T.border.default}`,
      boxShadow: T.shadow.lg, padding: 6, display: 'flex', flexDirection: 'column', gap: 2,
    }}>
      <GrupoTitulo>Modelos do sistema</GrupoTitulo>
      {sistema.map(item)}
      <GrupoTitulo>Meus modelos</GrupoTitulo>
      {personalizados.length ? personalizados.map(item) : (
        <span style={{ fontSize: 12, color: T.text.tertiary, padding: '4px 10px 6px' }}>Nenhum modelo personalizado ainda.</span>
      )}
      <div style={{ height: 1, background: T.border.muted, margin: '4px 4px' }} />
      <Link href={demo ? '/modelos-prontuario?demo=1' : '/modelos-prontuario'} onClick={() => setAberto(false)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 10, fontSize: 12.5, fontWeight: 600, color: T.brand.primary, textDecoration: 'none' }}>
        <Icon icon={Settings2} size={14} />Gerenciar modelos
      </Link>
    </div>
  )

  if (variante === 'segmentado') {
    const rapidos = Array.from(new Set([ID_MODELO_SOAP, 'livre', sugeridoId]))
      .map(id => todos.find(m => m.id === id)).filter(Boolean) as ModeloProntuario[]
    const foraDosRapidos = selecionado && !rapidos.some(r => r.id === selecionado.id)
    return (
      <div ref={ref} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', ...style }}>
        <SegmentedControl<string>
          size="sm"
          value={foraDosRapidos ? '__mais' : (selecionadoId || '')}
          onChange={id => { const m = todos.find(x => x.id === id); if (m) escolher(m) }}
          options={rapidos.map(m => ({ value: m.id, label: m.nome.split(' / ')[0] }))}
        />
        <button type="button" disabled={disabled} onClick={() => setAberto(a => !a)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, height: 32, padding: '0 10px', borderRadius: 10, fontFamily: 'inherit',
            fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
            border: `1px solid ${foraDosRapidos ? T.brand.primaryAccentSoft : T.border.default}`,
            background: foraDosRapidos ? T.brand.primarySubtle : '#fff', color: foraDosRapidos ? T.brand.primary : T.text.muted,
          }}>
          {foraDosRapidos ? selecionado!.nome : <><MoreHorizontal size={14} strokeWidth={1.6} />Mais</>}
        </button>
        {popover}
      </div>
    )
  }

  return (
    <div ref={ref} style={{ position: 'relative', minWidth: 0, ...style }}>
      <button type="button" disabled={disabled || carregando} onClick={() => setAberto(a => !a)} aria-haspopup="listbox" aria-expanded={aberto}
        style={{
          display: 'flex', alignItems: 'center', gap: 9, width: '100%', minWidth: 200, height: 40, padding: '0 10px 0 12px',
          borderRadius: 12, border: `1px solid ${aberto ? T.brand.primary : T.border.default}`, background: '#fff', fontFamily: 'inherit',
          cursor: disabled ? 'default' : 'pointer', boxShadow: aberto ? T.shadow.focusRing : 'none', transition: 'border-color .15s, box-shadow .15s',
          textAlign: 'left',
        }}>
        <Icon icon={selecionado && selecionado.id === sugeridoId && sugeridoId !== ID_MODELO_SOAP ? Sparkles : FileText} size={15} color={T.brand.primary} />
        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
          <span style={{ fontSize: 10.5, fontWeight: 600, color: T.text.quaternary }}>Modelo de prontuário</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: T.text.primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {carregando ? 'Carregando…' : selecionado?.nome || 'SOAP'}
          </span>
        </span>
        <ChevronDown size={15} strokeWidth={1.6} color={T.text.tertiary} style={{ transform: aberto ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
      </button>
      {popover}
    </div>
  )
}

function GrupoTitulo({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: T.text.tertiary, padding: '8px 10px 4px' }}>{children}</div>
}

function Tag({ children, cor, bg }: { children: React.ReactNode; cor: string; bg: string }) {
  return <span style={{ fontSize: 10.5, fontWeight: 600, color: cor, background: bg, padding: '1px 6px', borderRadius: 6, flexShrink: 0 }}>{children}</span>
}

export default SeletorModeloProntuario
