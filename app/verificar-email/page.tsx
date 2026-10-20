'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { MailCheck, CircleCheck, CircleAlert, ArrowLeft } from 'lucide-react'
import { tokens } from '@/lib/design-tokens'
import { TelaAcesso } from '@/components/TelaAcesso'
import { Button } from '@/components/ui'
import { guardarToken } from '@/lib/sessao'
import { destinoInicial } from '@/lib/destino'

function VerificarContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<'carregando' | 'ok' | 'erro'>('carregando')
  const [mensagem, setMensagem] = useState('')

  useEffect(() => {
    const token = searchParams?.get('token')
    const tipo = searchParams?.get('tipo') || 'medico'

    if (!token) {
      setStatus('erro')
      setMensagem('Link incompleto. Abra de novo o link do email.')
      return
    }

    fetch('/api/verificar-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, tipo }),
    })
      .then(r => r.json())
      .then(data => {
        if (!data.ok) {
          setStatus('erro')
          setMensagem(data.error || 'Não foi possível verificar o email')
          return
        }

        // Auto-login: grava localStorage
        guardarToken(data.token)
        if (data.tipo_conta === 'clinica') {
          localStorage.setItem('clinica_admin', JSON.stringify(data.admin))
          localStorage.setItem('clinica', JSON.stringify(data.clinica))
          localStorage.removeItem('medico')
        } else {
          localStorage.setItem('medico', JSON.stringify(data.medico))
          if (data.clinica) localStorage.setItem('clinica', JSON.stringify(data.clinica))
          localStorage.removeItem('clinica_admin')
        }

        setStatus('ok')
        setMensagem('Email confirmado! Redirecionando...')

        setTimeout(() => router.push(destinoInicial(data.tipo_conta === 'clinica' ? 'clinica' : 'medico', data.tipo_conta === 'clinica' ? data.admin : data.medico)), 1200)
      })
      .catch(() => {
        setStatus('erro')
        setMensagem('Sem conexão com a internet. Confira e tente de novo.')
      })
  }, [searchParams, router])

  if (status === 'ok') {
    return (
      <TelaAcesso titulo="Conta confirmada" descricao={mensagem}
        icone={<CircleCheck size={22} strokeWidth={1.6} />} tomIcone="success" />
    )
  }

  if (status === 'erro') {
    return (
      <TelaAcesso titulo="Não foi possível verificar" descricao={mensagem}
        icone={<CircleAlert size={22} strokeWidth={1.6} />} tomIcone="danger">
        <Button variant="secondary" size="lg" block icon={ArrowLeft} onClick={() => router.push('/login')}>
          Voltar ao login
        </Button>
      </TelaAcesso>
    )
  }

  return (
    <TelaAcesso titulo="Confirmando sua conta" descricao="Aguarde só um instante…"
      icone={<MailCheck size={22} strokeWidth={1.6} />}>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: 28, height: 28, border: `3px solid ${tokens.brand.primaryLight}`, borderTopColor: tokens.brand.primary, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
      <style dangerouslySetInnerHTML={{ __html: '@keyframes spin{to{transform:rotate(360deg)}}' }} />
    </TelaAcesso>
  )
}

export default function VerificarEmailPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100dvh', background: tokens.bg.page }} />}>
      <VerificarContent />
    </Suspense>
  )
}
