'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { tokens } from '@/lib/design-tokens'
import { buscarTemplate, atualizarTemplate } from '@/lib/formularios/templates'
import type { Template, Campo } from '@/lib/formularios/types'
import { useToast } from '@/components/Toast'
import BuilderCampos from './BuilderCampos'

export default function EditarTemplatePage() {
  const router = useRouter()
  const params = useParams()
  const { toast } = useToast()
  const id = params.id as string

  const [loading, setLoading] = useState(true)
  const [template, setTemplate] = useState<Template | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const [nome, setNome] = useState('')
  const [especialidade, setEspecialidade] = useState('')
  const [descricao, setDescricao] = useState('')
  const [campos, setCampos] = useState<Campo[]>([])

  const [salvando, setSalvando] = useState(false)
  const [modificado, setModificado] = useState(false)

  useEffect(() => {
    async function carregar() {
      try {
        const rawMedico = localStorage.getItem('medico')
        const rawAdmin = localStorage.getItem('clinica_admin')
        if (!rawMedico && !rawAdmin) {
          router.replace('/login')
          return
        }

        const t = await buscarTemplate(id)
        if (!t) {
          setErro('Formulário não encontrado')
          return
        }
        if (t.publico) {
          setErro('Este formulário é um modelo da biblioteca e não pode ser editado. Crie um novo a partir dele.')
          return
        }

        setTemplate(t)
        setNome(t.nome)
        setEspecialidade(t.especialidade || '')
        setDescricao(t.descricao || '')
        setCampos(Array.isArray(t.campos) ? t.campos : [])
      } catch (e: any) {
        setErro(e.message || 'Erro ao carregar')
      } finally {
        setLoading(false)
      }
    }
    carregar()
  }, [id, router])

  async function salvar() {
    if (!nome.trim()) {
      toast('Dê um nome ao formulário', 'error')
      return
    }
    setSalvando(true)
    try {
      const { erro: erroSalvar } = await atualizarTemplate(id, {
        nome: nome.trim(),
        especialidade: especialidade.trim() || null,
        descricao: descricao.trim() || null,
        campos,
      })
      if (erroSalvar) {
        toast(erroSalvar, 'error')
      } else {
        toast('Formulário salvo', 'success')
        setModificado(false)
      }
    } finally {
      setSalvando(false)
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 64, display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: 28, height: 28, border: '2.5px solid ' + tokens.brand.primaryLight, borderTopColor: tokens.brand.primary, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{'@keyframes spin { to { transform: rotate(360deg) } }'}</style>
      </div>
    )
  }

  if (erro || !template) {
    return (
      <div style={{ padding: 32, maxWidth: 640, margin: '64px auto', textAlign: 'center' }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, color: tokens.text.primary, marginBottom: 8 }}>
          {erro || 'Formulário não encontrado'}
        </h2>
        <button
          type="button"
          onClick={() => router.push('/formularios')}
          style={{
            marginTop: 16,
            padding: '10px 18px',
            background: tokens.brand.primary,
            color: '#fff',
            border: 'none',
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Voltar pra lista
        </button>
      </div>
    )
  }

  return (
    <div style={{ padding: '32px 32px 96px' }}>
      <div style={{ maxWidth: 880, margin: '0 auto' }}>
        {/* Breadcrumb */}
        <button
          type="button"
          onClick={() => router.push('/formularios')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: 'none',
            border: 'none',
            color: tokens.text.secondary,
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            padding: 0,
            marginBottom: 16,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Formulários
        </button>

        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: tokens.brand.primary, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 8 }}>
            Editando formulário
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 600, color: tokens.text.primary, letterSpacing: '-0.02em', margin: 0 }}>
            {nome || 'Sem título'}
          </h1>
        </div>

        {/* Card 1: Informações */}
        <Card>
          <h3 style={{ fontSize: 17, fontWeight: 600, color: tokens.text.primary, margin: 0, marginBottom: 16 }}>
            Informações
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Field label="Nome do formulário" required>
              <input
                type="text"
                value={nome}
                onChange={e => { setNome(e.target.value); setModificado(true) }}
                placeholder="Ex: Triagem pré-consulta"
                style={inputStyle}
              />
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <Field label="Especialidade (opcional)">
                <input
                  type="text"
                  value={especialidade}
                  onChange={e => { setEspecialidade(e.target.value); setModificado(true) }}
                  placeholder="Ex: Dermatologia"
                  style={inputStyle}
                />
              </Field>
              <Field label="Descrição interna (opcional)">
                <input
                  type="text"
                  value={descricao}
                  onChange={e => { setDescricao(e.target.value); setModificado(true) }}
                  placeholder="Pra equipe lembrar pra que serve"
                  style={inputStyle}
                />
              </Field>
            </div>
          </div>
        </Card>

        {/* Card 2: Builder de campos */}
        <div style={{ marginTop: 16 }}>
          <BuilderCampos
            campos={campos}
            onChange={(novos) => { setCampos(novos); setModificado(true) }}
          />
        </div>
      </div>

      {/* Barra de save fixa */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 240, // largura do sidebar
        right: 0,
        background: '#fff',
        borderTop: '1px solid ' + tokens.border.subtle,
        padding: '14px 32px',
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'center',
        gap: 12,
        zIndex: 10,
      }}>
        {modificado && (
          <span style={{ fontSize: 13, color: tokens.text.tertiary }}>
            Alterações não salvas
          </span>
        )}
        <button
          type="button"
          onClick={salvar}
          disabled={salvando || !nome.trim()}
          style={{
            padding: '11px 22px',
            background: (!nome.trim() || salvando) ? tokens.text.tertiary : tokens.brand.primary,
            color: '#fff',
            border: 'none',
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 600,
            cursor: (!nome.trim() || salvando) ? 'not-allowed' : 'pointer',
            boxShadow: '0 2px 8px rgba(96, 67, 193, 0.15)',
          }}
        >
          {salvando ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </div>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: '#fff',
      borderRadius: 16,
      padding: 24,
      border: `1px solid ${tokens.border.subtle}`,
    }}>
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '11px 14px',
  fontSize: 14,
  color: tokens.text.primary,
  border: '1px solid ' + tokens.border.default,
  borderRadius: 10,
  background: '#fff',
  outline: 'none',
  boxSizing: 'border-box',
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ fontSize: 13, fontWeight: 600, color: tokens.text.primary, display: 'block', marginBottom: 6 }}>
        {label} {required && <span style={{ color: '#EF4444' }}>*</span>}
      </label>
      {children}
    </div>
  )
}
