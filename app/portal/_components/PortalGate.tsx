'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { usePortalSession } from '@/lib/portal/session'
import { tokens } from '@/lib/design-tokens'
import { Skeleton } from '@/components/ui/Skeleton'

export function PortalGate({ children }: { children: React.ReactNode }) {
  const { session, loading } = usePortalSession()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (loading) return
    if (!session && pathname !== '/portal/login') {
      router.replace('/portal/login')
    }
  }, [session, loading, pathname, router])

  if (loading) {
    return (
      <div style={{ padding: '40px 24px', maxWidth: 800 }}>
        <Skeleton width={120} height={18} style={{ marginBottom: 16 }} />
        <Skeleton width="60%" height={32} style={{ marginBottom: 28 }} />
        <Skeleton height={140} style={{ marginBottom: 16, borderRadius: tokens.radius['3xl'] }} />
        <Skeleton height={140} style={{ borderRadius: tokens.radius['3xl'] }} />
      </div>
    )
  }

  if (!session && pathname !== '/portal/login') {
    return null
  }

  return <>{children}</>
}
