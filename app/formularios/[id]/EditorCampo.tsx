'use client'

import { tokens } from '@/lib/design-tokens'
import { TIPOS_CAMPO_LABELS } from '@/lib/formularios/templates'
import type { Campo, TipoCampo } from '@/lib/formularios/types'

type Props = {
  campo: Campo
  onChange: (campo: Campo) => void
}

const TIPOS: TipoCampo[] = ['texto', 'textarea', 'numero', 'select', 'multipla', 'escala', 'data', 'sim_nao']

export default function EditorCampo({ campo, onChange }: Props) {
  function atualizar<K extends keyof Campo>(chave: K, valor: Campo[K]) {
    onChange({ ...campo, [chave]: valor })
  }

  function atualizarOpcao(idx: number, novoTexto: string) {
    const opcoes = [...(campo.opcoes || [])]
    opcoes[idx] = novoTexto
    atualizar('opcoes', opcoes)
  }

  function adicionarOpcao() {
    const opcoes = [...(campo.opcoes || []), 'Nova opção']
    atualizar('opcoes', opcoes)
  }

  function removerOpcao(idx: number) {
    const opcoes = (campo.opcoes || []).filter((_, i) => i !== idx)
    atualizar('opcoes', opcoes)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Tipo */}
      <Field label="Tipo da pergunta">
        <select
          value={campo.tipo}
          onChange={e => {
            const novoTipo = e.target.value as TipoCampo
            const atualizado: Campo = { ...campo, tipo: novoTipo }
            // Reset campos especificos quando muda o tipo
            if (novoTipo === 'select' || novoTipo === 'multipla') {
              if (!atualizado.opcoes) atualizado.opcoes = ['Opção 1', 'Opção 2']
            } else {
              delete atualizado.opcoes
            }
            if (novoTipo === 'escala') {
              atualizado.min = 0
              atualizado.max = 10
              atualizado.passo = 1
            } else if (novoTipo === 'numero') {
              if (atualizado.min === undefined) atualizado.min = 0
              if (atualizado.max === undefined) atualizado.max = 100
              delete atualizado.passo
            } else {
              delete atualizado.min
              delete atualizado.max
              delete atualizado.passo
            }
            onChange(atualizado)
          }}
          style={selectStyle}
        >
          {TIPOS.map(t => (
            <option key={t} value={t}>{TIPOS_CAMPO_LABELS[t]}</option>
          ))}
        </select>
      </Field>

      {/* Label da pergunta */}
      <Field label="Pergunta" required>
        <input
          type="text"
          value={campo.label}
          onChange={e => atualizar('label', e.target.value)}
          placeholder="Ex: Qual o motivo da consulta?"
          style={inputStyle}
        />
      </Field>

      {/* Descrição/hint */}
      <Field label="Texto de ajuda (opcional)" hint="Aparece abaixo da pergunta pra dar contexto.">
        <input
          type="text"
          value={campo.descricao || ''}
          onChange={e => atualizar('descricao', e.target.value)}
          placeholder="Ex: Descreva sintomas, dores ou o que te trouxe aqui"
          style={inputStyle}
        />
      </Field>

      {/* Específico: placeholder pra texto/textarea/numero */}
      {(campo.tipo === 'texto' || campo.tipo === 'textarea' || campo.tipo === 'numero') && (
        <Field label="Texto de exemplo (placeholder)">
          <input
            type="text"
            value={campo.placeholder || ''}
            onChange={e => atualizar('placeholder', e.target.value)}
            placeholder="Ex: Digite aqui..."
            style={inputStyle}
          />
        </Field>
      )}

      {/* Específico: opcões pra select/multipla */}
      {(campo.tipo === 'select' || campo.tipo === 'multipla') && (
        <Field label="Opções" hint={campo.tipo === 'multipla' ? 'Paciente pode marcar mais de uma.' : 'Paciente escolhe apenas uma.'}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(campo.opcoes || []).map((opcao, idx) => (
              <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="text"
                  value={opcao}
                  onChange={e => atualizarOpcao(idx, e.target.value)}
                  placeholder={'Opção ' + (idx + 1)}
                  style={{ ...inputStyle, flex: 1 }}
                />
                <button
                  type="button"
                  onClick={() => removerOpcao(idx)}
                  disabled={(campo.opcoes || []).length <= 1}
                  aria-label="Remover opção"
                  style={{
                    width: 36,
                    height: 36,
                    border: '1px solid ' + tokens.border.default,
                    borderRadius: 8,
                    background: '#fff',
                    color: tokens.text.tertiary,
                    cursor: (campo.opcoes || []).length <= 1 ? 'not-allowed' : 'pointer',
                    opacity: (campo.opcoes || []).length <= 1 ? 0.4 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={adicionarOpcao}
              style={{
                padding: '10px 12px',
                border: '1px dashed ' + tokens.border.default,
                borderRadius: 8,
                background: 'transparent',
                color: tokens.text.secondary,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
              Adicionar opção
            </button>
          </div>
        </Field>
      )}

      {/* Específico: min/max pra numero/escala */}
      {(campo.tipo === 'numero' || campo.tipo === 'escala') && (
        <div style={{ display: 'grid', gridTemplateColumns: campo.tipo === 'escala' ? '1fr 1fr 1fr' : '1fr 1fr', gap: 12 }}>
          <Field label="Valor mínimo">
            <input
              type="number"
              value={campo.min ?? ''}
              onChange={e => atualizar('min', e.target.value === '' ? undefined : Number(e.target.value))}
              style={inputStyle}
            />
          </Field>
          <Field label="Valor máximo">
            <input
              type="number"
              value={campo.max ?? ''}
              onChange={e => atualizar('max', e.target.value === '' ? undefined : Number(e.target.value))}
              style={inputStyle}
            />
          </Field>
          {campo.tipo === 'escala' && (
            <Field label="Passo">
              <input
                type="number"
                value={campo.passo ?? 1}
                min={1}
                onChange={e => atualizar('passo', e.target.value === '' ? 1 : Number(e.target.value))}
                style={inputStyle}
              />
            </Field>
          )}
        </div>
      )}

      {/* Obrigatorio */}
      <div style={{
        padding: 12,
        background: tokens.bg.cardSubtle,
        borderRadius: 10,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
      }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: tokens.text.primary }}>
            Pergunta obrigatória
          </div>
          <div style={{ fontSize: 12, color: tokens.text.secondary, marginTop: 2 }}>
            O paciente não consegue enviar o formulário sem responder.
          </div>
        </div>
        <button
          type="button"
          onClick={() => atualizar('obrigatorio', !campo.obrigatorio)}
          style={{
            width: 40,
            height: 24,
            borderRadius: 100,
            background: campo.obrigatorio ? tokens.brand.primary : '#D1D5DB',
            position: 'relative',
            border: 'none',
            cursor: 'pointer',
            transition: 'background 0.2s',
            flexShrink: 0,
          }}
        >
          <div style={{
            position: 'absolute',
            top: 3,
            left: campo.obrigatorio ? 19 : 3,
            width: 18,
            height: 18,
            background: '#fff',
            borderRadius: '50%',
            transition: 'left 0.2s',
            boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
          }} />
        </button>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  fontSize: 14,
  color: tokens.text.primary,
  border: '1px solid ' + tokens.border.default,
  borderRadius: 8,
  background: '#fff',
  outline: 'none',
  boxSizing: 'border-box',
}

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: 'pointer',
  appearance: 'none',
  backgroundImage: 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%23999\' stroke-width=\'2\'><polyline points=\'6 9 12 15 18 9\'/></svg>")',
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 12px center',
  paddingRight: 36,
}

function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ marginBottom: 6 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: tokens.text.primary, display: 'block' }}>
          {label} {required && <span style={{ color: '#EF4444' }}>*</span>}
        </label>
        {hint && (
          <div style={{ fontSize: 12, color: tokens.text.tertiary, marginTop: 2 }}>
            {hint}
          </div>
        )}
      </div>
      {children}
    </div>
  )
}
