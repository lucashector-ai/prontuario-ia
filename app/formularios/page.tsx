'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { tokens } from '@/lib/design-tokens'
import { PageHeader, Tabs, Button } from '@/components/ui'
import { listarTemplatesClinica, deletarTemplate } from '@/lib/formularios/templates'
import type { Template } from '@/lib/formularios/types'
import { useToast } from '@/components/Toast'
import ModalNovoTemplate from './ModalNovoTemplate'
import ListaEnvios from './ListaEnvios'

type Auth = {
  tipo: 'medico' | 'admin' | null
  clinicaId: string | null
  loading: boolean
}

export default function FormulariosPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [auth, setAuth] = useState<Auth>({ tipo: null, clinicaId: null, loading: true })
  const [templates, setTemplates] = useState<Template[]>([])
  const [loadingTemplates, setLoadingTemplates] = useState(true)
  const [busca, setBusca] = useState('')
  const [modalAberto, setModalAberto] = useState(false)
  const [aba, setAba] = useState<'modelos' | 'envios'>('modelos')

  useEffect(() => {
    try {
      const rawMedico = localStorage.getItem('medico')
      const rawAdmin = localStorage.getItem('clinica_admin')

      if (rawMedico) {
        const m = JSON.parse(rawMedico)
        setAuth({ tipo: 'medico', clinicaId: m.clinica_id, loading: false })
        if (m.clinica_id) carregarTemplates(m.clinica_id)
      } else if (rawAdmin) {
        const a = JSON.parse(rawAdmin)
        setAuth({ tipo: 'admin', clinicaId: a.clinica_id, loading: false })
        if (a.clinica_id) carregarTemplates(a.clinica_id)
      } else {
        router.replace('/login')
      }
    } catch {
      router.replace('/login')
    }
  }, [router])

  async function carregarTemplates(clinicaId: string) {
    setLoadingTemplates(true)
    try {
      const lista = await listarTemplatesClinica(clinicaId)
      setTemplates(lista)
    } finally {
      setLoadingTemplates(false)
    }
  }

  async function handleDeletar(t: Template) {
    if (!confirm('Excluir o formulário "' + t.nome + '"? Essa ação não pode ser desfeita.')) return
    const { erro } = await deletarTemplate(t.id)
    if (erro) {
      toast(erro, 'error')
    } else {
      toast('Formulário excluído.', 'success')
      if (auth.clinicaId) carregarTemplates(auth.clinicaId)
    }
  }

  if (auth.loading) {
    return (
      <div style={{ padding: 64, display: 'flex', justifyContent: 'center' }}>
        <Spinner />
      </div>
    )
  }

  const templatesFiltrados = busca
    ? templates.filter(t => 
        t.nome.toLowerCase().includes(busca.toLowerCase()) ||
        (t.especialidade || '').toLowerCase().includes(busca.toLowerCase())
      )
    : templates

  return (
    <div style={{ padding: 24 }}>
      <div>
        {/* Header */}
        <PageHeader
          titulo="Formulários"
          descricao="Crie formulários pra enviar ao paciente antes da consulta. A IA gera um resumo das respostas pra você ler em 30 segundos."
          acao={
            <Button variant="primary" onClick={() => setModalAberto(true)} style={{ flexShrink: 0 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Novo formulário
            </Button>
          }
        />

        {/* Tabs */}
        <Tabs
          ativa={aba}
          onChange={(id) => setAba(id as 'modelos' | 'envios')}
          tabs={[
            { id: 'modelos', label: 'Meus formulários' },
            { id: 'envios', label: 'Envios' },
          ]}
        />

        {aba === 'envios' && auth.clinicaId && (
          <ListaEnvios clinicaId={auth.clinicaId} />
        )}

        {aba === 'modelos' && <>

        {/* Busca */}
        {templates.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 14px',
              background: '#fff',
              borderRadius: 10,
              border: `1px solid ${tokens.border.subtle}`,
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={tokens.text.tertiary} strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                value={busca}
                onChange={e => setBusca(e.target.value)}
                placeholder="Buscar por nome ou especialidade"
                style={{
                  flex: 1,
                  border: 'none',
                  outline: 'none',
                  fontSize: 14,
                  background: 'transparent',
                  color: tokens.text.primary,
                }}
              />
            </div>
          </div>
        )}

        {/* Lista */}
        {loadingTemplates ? (
          <div style={{ padding: 64, display: 'flex', justifyContent: 'center' }}>
            <Spinner />
          </div>
        ) : templates.length === 0 ? (
          <EstadoVazio onClick={() => setModalAberto(true)} />
        ) : templatesFiltrados.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: tokens.text.tertiary, fontSize: 14 }}>
            Nenhum formulário encontrado.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {templatesFiltrados.map(t => (
              <CardTemplate
                key={t.id}
                template={t}
                onEditar={() => router.push('/formularios/' + t.id)}
                onDeletar={() => handleDeletar(t)}
              />
            ))}
          </div>
        )}
        </>}
      </div>

      {modalAberto && auth.clinicaId && (
        <ModalNovoTemplate
          clinicaId={auth.clinicaId}
          onFechar={() => setModalAberto(false)}
          onCriado={(id) => {
            setModalAberto(false)
            router.push('/formularios/' + id)
          }}
        />
      )}
    </div>
  )
}

function Spinner() {
  return (
    <>
      <div style={{
        width: 28,
        height: 28,
        border: '2.5px solid ' + tokens.brand.primaryLight,
        borderTopColor: tokens.brand.primary,
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
      <style>{'@keyframes spin { to { transform: rotate(360deg) } }'}</style>
    </>
  )
}

function EstadoVazio({ onClick }: { onClick: () => void }) {
  return (
    <div style={{
      background: '#fff',
      borderRadius: 16,
      padding: '48px 32px',
      textAlign: 'center',
      border: `1px solid ${tokens.border.subtle}`,
    }}>
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={tokens.text.secondary} strokeWidth="1.5" style={{ display: 'block', margin: '0 auto 20px' }}>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </svg>
      <h2 style={{ fontSize: 19, fontWeight: 600, color: tokens.text.primary, margin: '0 0 8px' }}>
        Nenhum formulário ainda
      </h2>
      <p style={{ fontSize: 14, color: tokens.text.secondary, margin: '0 auto 24px', maxWidth: 380, lineHeight: 1.5 }}>
        Crie seu primeiro formulário pra começar a enviar pra pacientes antes das consultas. Você pode começar a partir de modelos prontos.
      </p>
      <button
        type="button"
        onClick={onClick}
        style={{
          padding: '12px 24px',
          background: tokens.brand.primary,
          color: '#fff',
          border: 'none',
          borderRadius: 10,
          fontSize: 14,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        Criar primeiro formulário
      </button>
    </div>
  )
}

function CardTemplate({ template, onEditar, onDeletar }: { template: Template; onEditar: () => void; onDeletar: () => void }) {
  const numCampos = Array.isArray(template.campos) ? template.campos.length : 0
  
  return (
    <div style={{
      background: '#fff',
      borderRadius: 14,
      padding: 20,
      border: `1px solid ${tokens.border.subtle}`,
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      transition: 'box-shadow 0.15s',
      cursor: 'pointer',
    }}
    onClick={onEditar}
    onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.06)'}
    onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'none'}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background: tokens.brand.primaryLight,
          color: tokens.brand.primary,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
        </div>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDeletar() }}
          aria-label="Excluir"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 6,
            color: tokens.text.tertiary,
            borderRadius: 6,
            display: 'flex',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
        </button>
      </div>
      <div>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: tokens.text.primary, margin: 0, marginBottom: 4 }}>
          {template.nome}
        </h3>
        {template.especialidade && (
          <div style={{ fontSize: 12, color: tokens.text.secondary }}>
            {template.especialidade}
          </div>
        )}
      </div>
      {template.descricao && (
        <p style={{ fontSize: 13, color: tokens.text.secondary, margin: 0, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {template.descricao}
        </p>
      )}
      <div style={{
        marginTop: 'auto',
        paddingTop: 12,
        borderTop: '1px solid ' + tokens.border.subtle,
        fontSize: 12,
        color: tokens.text.tertiary,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="8" y1="6" x2="21" y2="6" />
          <line x1="8" y1="12" x2="21" y2="12" />
          <line x1="8" y1="18" x2="21" y2="18" />
          <line x1="3" y1="6" x2="3.01" y2="6" />
          <line x1="3" y1="12" x2="3.01" y2="12" />
          <line x1="3" y1="18" x2="3.01" y2="18" />
        </svg>
        {numCampos} {numCampos === 1 ? 'pergunta' : 'perguntas'}
      </div>
    </div>
  )
}
