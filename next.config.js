/**
 * Cabeçalhos de segurança (apontados pelo teste OWASP ZAP):
 *   CSP                    de onde a página pode carregar coisas; sem plugins, sem <base> estranho,
 *                          e só o próprio site pode colocá-la num iframe (anti-clickjacking)
 *   X-Frame-Options        o mesmo anti-clickjacking para navegadores antigos
 *   X-Content-Type-Options o navegador não "adivinha" o tipo de arquivo
 *   Referrer-Policy        links externos não recebem a URL completa (pode ter ids de paciente)
 *   Permissions-Policy     câmera/microfone só no próprio site (consulta gravada e teleconsulta)
 *   CORS                   páginas só para o próprio domínio (a Vercel manda "*" por padrão)
 *
 * script-src ainda aceita inline/eval: o Next injeta scripts inline e Memed/Meta carregam SDKs
 * externos. Apertar isso exige nonce por requisição — fica para uma próxima etapa.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:",
  "style-src 'self' 'unsafe-inline' https:",
  "font-src 'self' data: https:",
  "img-src 'self' data: blob: https:",
  "media-src 'self' data: blob: https:",
  "connect-src 'self' https: wss:",
  "frame-src 'self' https:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
  ...(process.env.NODE_ENV === 'production' ? ['upgrade-insecure-requests'] : []),
].join('; ')

const SEGURANCA = [
  { key: 'Content-Security-Policy', value: CSP },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), display-capture=(self), geolocation=(), payment=(), usb=()' },
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@react-pdf/renderer'],
  },
  // Recepção, Triagem e Consultório viraram abas da Central de atendimento (links antigos continuam valendo)
  async redirects() {
    return ['recepcao', 'triagem', 'consultorio'].map(t => ({ source: `/${t}`, destination: `/atendimento/${t}`, permanent: false }))
  },
  async headers() {
    return [
      { source: '/:path*', headers: SEGURANCA },
      // Páginas e arquivos (fora da /api): CORS só para o próprio site
      {
        source: '/((?!api/).*)',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: process.env.NEXT_PUBLIC_APP_URL || 'https://clinical360.vercel.app' },
          { key: 'Vary', value: 'Origin' },
        ],
      },
    ]
  },
}
module.exports = nextConfig
