import type { MetadataRoute } from 'next'

const SITE = (process.env.NEXT_PUBLIC_APP_URL || 'https://clinical360.vercel.app').replace(/\/$/, '')

export default function sitemap(): MetadataRoute.Sitemap {
  return ['', '/cadastro', '/login', '/privacidade', '/termos'].map(p => ({ url: SITE + p, changeFrequency: 'monthly', priority: p ? 0.5 : 1 }))
}
