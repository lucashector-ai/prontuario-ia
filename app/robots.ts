import type { MetadataRoute } from 'next'

const SITE = (process.env.NEXT_PUBLIC_APP_URL || 'https://clinical360.vercel.app').replace(/\/$/, '')

/** Buscadores só veem as páginas públicas; o app e a API ficam de fora. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: ['/', '/cadastro', '/login', '/privacidade', '/termos'], disallow: ['/api/', '/painel/', '/totem/', '/sala/', '/formulario/', '/pre-consulta/', '/paciente-publico/'] },
    sitemap: `${SITE}/sitemap.xml`,
  }
}
