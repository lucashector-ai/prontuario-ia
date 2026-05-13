'use client'

import { tokens } from '@/lib/design-tokens'
import type { Campo } from '@/lib/formularios/types'

type Props = {
  campo: Campo
  valor: any
  onChange: (valor: any) => void
}

export default function RenderizadorCampo({ campo, valor, onChange }: Props) {
  switch (campo.tipo) {
    case 'texto':
      return (
        <input
          type="text"
          value={valor || ''}
          onChange={e => onChange(e.target.value)}
          placeholder={campo.placeholder}
          style={inputStyle}
        />
      )

    case 'textarea':
      return (
        <textarea
          value={valor || ''}
          onChange={e => onChange(e.target.value)}
          placeholder={campo.placeholder}
          rows={4}
          style={{ ...inputStyle, fontFamily: 'inherit', resize: 'vertical', minHeight: 90 }}
        />
      )

    case 'numero':
      return (
        <input
          type="number"
          value={valor ?? ''}
          onChange={e => onChange(e.target.value === '' ? null : Number(e.target.value))}
          placeholder={campo.placeholder}
          min={campo.min}
          max={campo.max}
          style={inputStyle}
        />
      )

    case 'data':
      return (
        <input
          type="date"
          value={valor || ''}
          onChange={e => onChange(e.target.value)}
          style={inputStyle}
        />
      )

    case 'sim_nao':
      return (
        <div style={{ display: 'flex', gap: 10 }}>
          <BotaoEscolha
            ativo={valor === true}
            onClick={() => onChange(true)}
            label="Sim"
          />
          <BotaoEscolha
            ativo={valor === false}
            onClick={() => onChange(false)}
            label="Não"
          />
        </div>
      )

    case 'select': {
      const opcoes = campo.opcoes || []
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {opcoes.map((opcao, idx) => (
            <BotaoOpcao
              key={idx}
              ativo={valor === opcao}
              onClick={() => onChange(opcao)}
              label={opcao}
              tipo="radio"
            />
          ))}
        </div>
      )
    }

    case 'multipla': {
      const opcoes = campo.opcoes || []
      const valoresAtuais: string[] = Array.isArray(valor) ? valor : []
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {opcoes.map((opcao, idx) => {
            const ativo = valoresAtuais.includes(opcao)
            return (
              <BotaoOpcao
                key={idx}
                ativo={ativo}
                onClick={() => {
                  if (ativo) {
                    onChange(valoresAtuais.filter(v => v !== opcao))
                  } else {
                    onChange([...valoresAtuais, opcao])
                  }
                }}
                label={opcao}
                tipo="checkbox"
              />
            )
          })}
        </div>
      )
    }

    case 'escala': {
      const min = campo.min ?? 0
      const max = campo.max ?? 10
      const passo = campo.passo ?? 1
      const valoresPossiveis: number[] = []
      for (let v = min; v <= max; v += passo) valoresPossiveis.push(v)
      const valorAtual = typeof valor === 'number' ? valor : null

      return (
        <div>
          <div style={{ 
            display: 'flex', 
            gap: 6, 
            flexWrap: 'wrap',
          }}>
            {valoresPossiveis.map(v => {
              const ativo = valorAtual === v
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => onChange(v)}
                  style={{
                    width: 44,
                    height: 44,
                    border: '1.5px solid ' + (ativo ? tokens.brand.primary : tokens.border.default),
                    borderRadius: 10,
                    background: ativo ? tokens.brand.primary : '#fff',
                    color: ativo ? '#fff' : tokens.text.primary,
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.12s',
                  }}
                >
                  {v}
                </button>
              )
            })}
          </div>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: 8,
            fontSize: 12,
            color: tokens.text.tertiary,
          }}>
            <span>{min} = mínimo</span>
            <span>{max} = máximo</span>
          </div>
        </div>
      )
    }

    default:
      return (
        <div style={{ fontSize: 13, color: tokens.text.tertiary, fontStyle: 'italic' }}>
          Tipo não suportado: {campo.tipo}
        </div>
      )
  }
}

function BotaoEscolha({ ativo, onClick, label }: { ativo: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1,
        padding: '14px',
        border: '1.5px solid ' + (ativo ? tokens.brand.primary : tokens.border.default),
        borderRadius: 12,
        background: ativo ? tokens.brand.primaryLight : '#fff',
        color: ativo ? tokens.brand.primary : tokens.text.primary,
        fontSize: 15,
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'all 0.12s',
      }}
    >
      {label}
    </button>
  )
}

function BotaoOpcao({ ativo, onClick, label, tipo }: { ativo: boolean; onClick: () => void; label: string; tipo: 'radio' | 'checkbox' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        textAlign: 'left',
        padding: '12px 14px',
        border: '1.5px solid ' + (ativo ? tokens.brand.primary : tokens.border.default),
        borderRadius: 10,
        background: ativo ? tokens.brand.primaryLight : '#fff',
        color: tokens.text.primary,
        fontSize: 14,
        fontWeight: 500,
        cursor: 'pointer',
        transition: 'all 0.12s',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <div style={{
        width: 20,
        height: 20,
        border: '1.5px solid ' + (ativo ? tokens.brand.primary : tokens.border.strong),
        borderRadius: tipo === 'radio' ? '50%' : 5,
        background: '#fff',
        flexShrink: 0,
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {ativo && tipo === 'radio' && (
          <div style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: tokens.brand.primary,
          }} />
        )}
        {ativo && tipo === 'checkbox' && (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={tokens.brand.primary} strokeWidth="3">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </div>
      {label}
    </button>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  fontSize: 14,
  color: tokens.text.primary,
  border: '1px solid ' + tokens.border.default,
  borderRadius: 10,
  background: '#fff',
  outline: 'none',
  boxSizing: 'border-box',
}
