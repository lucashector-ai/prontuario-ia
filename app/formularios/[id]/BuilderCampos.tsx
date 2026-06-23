'use client'

import { useState } from 'react'
import { tokens } from '@/lib/design-tokens'
import { gerarIdCampo, TIPOS_CAMPO_LABELS } from '@/lib/formularios/templates'
import type { Campo, TipoCampo } from '@/lib/formularios/types'
import EditorCampo from './EditorCampo'

type Props = {
  campos: Campo[]
  onChange: (campos: Campo[]) => void
}

const TIPOS_CAMPO_ORDEM: TipoCampo[] = ['texto', 'textarea', 'numero', 'select', 'multipla', 'escala', 'data', 'sim_nao']

export default function BuilderCampos({ campos, onChange }: Props) {
  const [seletorAberto, setSeletorAberto] = useState(false)
  const [expandido, setExpandido] = useState<string | null>(null)

  function adicionarCampo(tipo: TipoCampo) {
    const novo: Campo = {
      id: gerarIdCampo('pergunta'),
      tipo,
      label: '',
      obrigatorio: false,
    }
    if (tipo === 'select' || tipo === 'multipla') novo.opcoes = ['Opção 1', 'Opção 2']
    if (tipo === 'escala') { novo.min = 0; novo.max = 10; novo.passo = 1 }
    if (tipo === 'numero') { novo.min = 0; novo.max = 100 }
    
    onChange([...campos, novo])
    setExpandido(novo.id)
    setSeletorAberto(false)
  }

  function atualizarCampo(idx: number, novo: Campo) {
    const lista = [...campos]
    lista[idx] = novo
    onChange(lista)
  }

  function removerCampo(idx: number) {
    if (!confirm('Remover essa pergunta?')) return
    onChange(campos.filter((_, i) => i !== idx))
  }

  function moverCampo(idx: number, direcao: 'cima' | 'baixo') {
    const novo = direcao === 'cima' ? idx - 1 : idx + 1
    if (novo < 0 || novo >= campos.length) return
    const lista = [...campos]
    ;[lista[idx], lista[novo]] = [lista[novo], lista[idx]]
    onChange(lista)
  }

  function duplicarCampo(idx: number) {
    const original = campos[idx]
    const copia: Campo = {
      ...JSON.parse(JSON.stringify(original)),
      id: gerarIdCampo(original.label || 'pergunta'),
      label: original.label + ' (cópia)',
    }
    const lista = [...campos]
    lista.splice(idx + 1, 0, copia)
    onChange(lista)
    setExpandido(copia.id)
  }

  return (
    <div style={{
      background: '#fff',
      borderRadius: 16,
      padding: 24,
      border: `1px solid ${tokens.border.subtle}`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <h3 style={{ fontSize: 17, fontWeight: 600, color: tokens.text.primary, margin: 0 }}>
          Perguntas
        </h3>
        <div style={{ fontSize: 13, color: tokens.text.tertiary }}>
          {campos.length} {campos.length === 1 ? 'pergunta' : 'perguntas'}
        </div>
      </div>
      <p style={{ fontSize: 13, color: tokens.text.secondary, margin: '0 0 20px' }}>
        Adicione as perguntas que o paciente vai responder. Clique numa pergunta pra editar.
      </p>

      {campos.length === 0 ? (
        <div style={{
          padding: 32,
          textAlign: 'center',
          background: tokens.bg.cardSubtle,
          borderRadius: 12,
          fontSize: 14,
          color: tokens.text.tertiary,
        }}>
          Nenhuma pergunta ainda. Adicione a primeira abaixo.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {campos.map((campo, idx) => (
            <ItemCampo
              key={campo.id}
              campo={campo}
              idx={idx}
              total={campos.length}
              expandido={expandido === campo.id}
              onExpandir={() => setExpandido(expandido === campo.id ? null : campo.id)}
              onAtualizar={(novo: Campo) => atualizarCampo(idx, novo)}
              onRemover={() => removerCampo(idx)}
              onMoverCima={() => moverCampo(idx, 'cima')}
              onMoverBaixo={() => moverCampo(idx, 'baixo')}
              onDuplicar={() => duplicarCampo(idx)}
            />
          ))}
        </div>
      )}

      {/* Botão adicionar */}
      <div style={{ marginTop: 16, position: 'relative' }}>
        {seletorAberto ? (
          <div style={{
            background: '#fff',
            border: '1px solid ' + tokens.border.default,
            borderRadius: 12,
            padding: 8,
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
          }}>
            <div style={{ padding: '8px 8px 4px', fontSize: 12, fontWeight: 600, color: tokens.text.tertiary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Tipo da pergunta
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 4 }}>
              {TIPOS_CAMPO_ORDEM.map(tipo => (
                <button
                  key={tipo}
                  type="button"
                  onClick={() => adicionarCampo(tipo)}
                  style={{
                    textAlign: 'left',
                    padding: '10px 12px',
                    background: 'transparent',
                    border: 'none',
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 500,
                    color: tokens.text.primary,
                    cursor: 'pointer',
                    transition: 'background 0.12s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = tokens.brand.primaryLight}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  {TIPOS_CAMPO_LABELS[tipo]}
                </button>
              ))}
            </div>
            <div style={{ padding: '8px 8px 4px', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setSeletorAberto(false)}
                style={{ background: 'none', border: 'none', color: tokens.text.tertiary, fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 4 }}
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setSeletorAberto(true)}
            style={{
              width: '100%',
              padding: '12px',
              background: tokens.brand.primaryLight,
              border: '1.5px dashed ' + tokens.brand.primary,
              borderRadius: 12,
              color: tokens.brand.primary,
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Adicionar pergunta
          </button>
        )}
      </div>
    </div>
  )
}

function ItemCampo({ campo, idx, total, expandido, onExpandir, onAtualizar, onRemover, onMoverCima, onMoverBaixo, onDuplicar }: any) {
  return (
    <div style={{
      background: '#fff',
      border: '1px solid ' + (expandido ? tokens.brand.primary : tokens.border.default),
      borderRadius: 12,
      overflow: 'hidden',
      transition: 'all 0.15s',
    }}>
      {/* Header da pergunta */}
      <div
        style={{
          padding: '14px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          cursor: 'pointer',
        }}
        onClick={onExpandir}
      >
        <div style={{
          width: 24,
          height: 24,
          borderRadius: 6,
          background: tokens.brand.primary,
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 12,
          fontWeight: 700,
          flexShrink: 0,
        }}>
          {idx + 1}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: tokens.text.primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {campo.label || <span style={{ color: tokens.text.tertiary, fontStyle: 'italic', fontWeight: 500 }}>Pergunta sem título</span>}
          </div>
          <div style={{ fontSize: 12, color: tokens.text.tertiary, marginTop: 2 }}>
            {TIPOS_CAMPO_LABELS[campo.tipo]}
            {campo.obrigatorio && <span style={{ marginLeft: 8, color: '#EF4444', fontWeight: 600 }}>· Obrigatória</span>}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <BtnIcon onClick={(e: any) => { e.stopPropagation(); onMoverCima() }} disabled={idx === 0} title="Mover pra cima">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="18 15 12 9 6 15" /></svg>
          </BtnIcon>
          <BtnIcon onClick={(e: any) => { e.stopPropagation(); onMoverBaixo() }} disabled={idx === total - 1} title="Mover pra baixo">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
          </BtnIcon>
          <BtnIcon onClick={(e: any) => { e.stopPropagation(); onDuplicar() }} title="Duplicar">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
          </BtnIcon>
          <BtnIcon onClick={(e: any) => { e.stopPropagation(); onRemover() }} title="Remover">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
          </BtnIcon>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={tokens.text.tertiary} strokeWidth="2" style={{ marginLeft: 4, transform: expandido ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </div>

      {/* Editor expandido */}
      {expandido && (
        <div style={{
          padding: 16,
          background: '#fff',
          borderTop: '1px solid ' + tokens.border.subtle,
        }}>
          <EditorCampo campo={campo} onChange={onAtualizar} />
        </div>
      )}
    </div>
  )
}

function BtnIcon({ onClick, disabled, title, children }: any) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        background: 'none',
        border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        padding: 6,
        borderRadius: 6,
        color: disabled ? tokens.text.tertiary : tokens.text.secondary,
        opacity: disabled ? 0.4 : 1,
        display: 'flex',
        transition: 'background 0.12s',
      }}
      onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.background = tokens.bg.cardSubtle }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
    >
      {children}
    </button>
  )
}
