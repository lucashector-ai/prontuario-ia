'use client'

import { Check } from 'lucide-react'
import { tokens } from '@/lib/design-tokens'
import { Input, Textarea } from '@/components/ui'
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
        <Input
          type="text"
          value={valor || ''}
          onChange={e => onChange(e.target.value)}
          placeholder={campo.placeholder}
          style={inputStyle}
        />
      )

    case 'textarea':
      return (
        <Textarea
          value={valor || ''}
          onChange={e => onChange(e.target.value)}
          placeholder={campo.placeholder}
          rows={4}
          style={{ ...inputStyle, minHeight: 96 }}
        />
      )

    case 'numero':
      return (
        <Input
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
        <Input
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
                  aria-pressed={ativo}
                  style={{
                    width: 44,
                    height: 44,
                    border: '1.5px solid ' + (ativo ? tokens.brand.primary : tokens.border.default),
                    borderRadius: tokens.radius.lg,
                    background: ativo ? tokens.brand.primarySoftBg : tokens.bg.card,
                    color: ativo ? tokens.brand.primary : tokens.text.strong,
                    fontSize: 14,
                    fontWeight: ativo ? 700 : 600,
                    fontFamily: 'inherit',
                    fontVariantNumeric: 'tabular-nums',
                    cursor: 'pointer',
                    transition: 'all .15s',
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
            color: tokens.text.quaternary,
          }}>
            <span>{min} = mínimo</span>
            <span>{max} = máximo</span>
          </div>
        </div>
      )
    }

    default:
      return (
        <div style={{ fontSize: 13, color: tokens.text.quaternary }}>
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
      aria-pressed={ativo}
      style={{
        flex: 1,
        height: 46,
        padding: '0 14px',
        border: '1.5px solid ' + (ativo ? tokens.brand.primary : tokens.border.default),
        borderRadius: tokens.radius.input,
        background: ativo ? tokens.brand.primarySoftBg : tokens.bg.card,
        color: ativo ? tokens.brand.primary : tokens.text.strong,
        fontSize: 14,
        fontWeight: 600,
        fontFamily: 'inherit',
        cursor: 'pointer',
        transition: 'all .15s',
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
      aria-pressed={ativo}
      style={{
        textAlign: 'left',
        padding: '12px 14px',
        border: '1.5px solid ' + (ativo ? tokens.brand.primary : tokens.border.default),
        borderRadius: tokens.radius.input,
        background: ativo ? tokens.brand.primarySoftBg : tokens.bg.card,
        color: ativo ? tokens.brand.primary : tokens.text.strong,
        fontSize: 14,
        fontWeight: ativo ? 600 : 500,
        fontFamily: 'inherit',
        lineHeight: 1.4,
        cursor: 'pointer',
        transition: 'all .15s',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <div style={{
        width: 18,
        height: 18,
        border: '1.5px solid ' + (ativo ? tokens.brand.primary : tokens.border.strong),
        borderRadius: tipo === 'radio' ? '50%' : 5,
        background: ativo && tipo === 'checkbox' ? tokens.brand.primary : tokens.bg.card,
        flexShrink: 0,
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {ativo && tipo === 'radio' && (
          <div style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: tokens.brand.primary,
          }} />
        )}
        {ativo && tipo === 'checkbox' && (
          <Check size={12} strokeWidth={3} color={tokens.text.inverse} />
        )}
      </div>
      {label}
    </button>
  )
}

// Campos maiores para o toque no celular (base: Input/Textarea do design system)
const inputStyle: React.CSSProperties = {
  minHeight: 44,
  fontSize: 15,
}
