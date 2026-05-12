'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const STORAGE_KEY = 'clinical360.portal.session'

export type PortalSession = {
  email: string
  pacienteId: string
  pacientePortalId: string
  nome?: string
}

export function savePortalSession(session: PortalSession) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
}

export function clearPortalSession() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(STORAGE_KEY)
}

export function readPortalSession(): PortalSession | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as PortalSession
  } catch {
    return null
  }
}

export function usePortalSession() {
  const [session, setSession] = useState<PortalSession | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setSession(readPortalSession())
    setLoading(false)

    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setSession(readPortalSession())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  return { session, loading }
}

/**
 * Magic link: gera token, salva em pacientes_portal e (via API route) dispara
 * email. Por simplicidade no MVP, o login é "passwordless leve" — sem Supabase
 * Auth, usando email como identidade direta. Pode ser trocado por
 * supabase.auth.signInWithOtp depois.
 */
export async function requestMagicLink(email: string) {
  const normalized = email.trim().toLowerCase()
  if (!normalized.includes('@')) throw new Error('Email inválido.')

  const res = await fetch('/api/portal/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: normalized }),
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || 'Não consegui enviar o link agora.')
  }
}

export async function verifyMagicLink(email: string, token: string): Promise<PortalSession | null> {
  const res = await fetch('/api/portal/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim().toLowerCase(), token }),
  })
  if (!res.ok) return null
  const data = await res.json()
  if (!data?.session) return null
  savePortalSession(data.session)
  return data.session as PortalSession
}
