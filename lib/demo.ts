/**
 * Modo demonstração (sem login, dados fictícios, nada é gravado).
 *
 * Entra com `?demo=1` em qualquer tela. A partir daí o modo fica guardado na aba
 * (sessionStorage 'c360-demo'), então navegar pelo menu não perde o demo.
 * Sai com `?demo=0`, ao fazer login de verdade (guardarToken) ou ao sair da conta.
 *
 *   if (ehDemo()) { setDados(DADOS_FICTICIOS); return }
 *   router.push(comDemo('/pacientes'))
 *   const demo = useDemo()            // em componentes (evita diferença servidor × navegador)
 *   avisoDemo()                       // "Demonstração: nada foi gravado"
 */
import { useEffect, useState } from 'react'

export const CHAVE_DEMO = 'c360-demo'
export const AVISO_DEMO = 'Demonstração: nada foi gravado.'

/** Está em modo demonstração? (URL ?demo=1 ou modo já ativado nesta aba) */
export function ehDemo(): boolean {
  if (typeof window === 'undefined') return false
  let p: string | null = null
  try { p = new URLSearchParams(window.location.search).get('demo') } catch {}
  try {
    if (p === '1') { sessionStorage.setItem(CHAVE_DEMO, '1'); return true }
    if (p === '0') { sessionStorage.removeItem(CHAVE_DEMO); return false }
    return sessionStorage.getItem(CHAVE_DEMO) === '1'
  } catch {
    return p === '1'
  }
}

/** Sai do modo demonstração (login de verdade, sair da conta). */
export function sairDoDemo() {
  try { sessionStorage.removeItem(CHAVE_DEMO) } catch {}
}

/** Acrescenta `demo=1` ao endereço quando está em demonstração (links internos). */
export function comDemo(href: string, demo: boolean = ehDemo()): string {
  if (!demo || !href.startsWith('/') || href.startsWith('/api/')) return href
  if (/[?&]demo=1(&|#|$)/.test(href)) return href
  const [semHash, hash] = href.split('#')
  return semHash + (semHash.includes('?') ? '&' : '?') + 'demo=1' + (hash !== undefined ? '#' + hash : '')
}

/** Hook: true em demonstração (false no servidor e no primeiro render, para não dar diferença de hidratação). */
export function useDemo(): boolean {
  const [demo, setDemo] = useState(false)
  useEffect(() => { setDemo(ehDemo()) }, [])
  return demo
}

/** Aviso padrão para ações que gravariam algo. Devolve true (para `if (avisoDemo()) return`). */
export function avisoDemo(texto: string = AVISO_DEMO): true {
  if (typeof window !== 'undefined') {
    import('@/components/ui/dialogos').then(m => m.notificar(texto, 'info')).catch(() => {})
  }
  return true
}

// ── Personagens do demo (fictícios) ─────────────────────────────────────────

export const CLINICA_DEMO = { id: 'demo', nome: 'Clínica Bem Viver', logo_url: null as string | null, tipo: 'clinica' }

/** Quem "está logado" no demo: médica com acesso de gestora (vê tudo). Mesmo id da Central de atendimento. */
export const MEDICO_DEMO = {
  id: 'demo-medico',
  nome: 'Dra. Helena Duarte',
  email: 'helena.duarte@exemplo.com.br',
  cargo: 'admin',
  especialidade: 'Clínica médica',
  crm: '123456',
  crm_uf: 'SP',
  telefone: '(11) 90000-0000',
  clinica_id: CLINICA_DEMO.id,
  foto_url: null as string | null,
  is_atendente: false,
  ativo: true,
  onboarding_completo: true,
}

/** Médico logado, ou o médico fictício no demo. Não grava nada no navegador. */
export function medicoOuDemo<T = any>(): T | null {
  if (ehDemo()) return MEDICO_DEMO as unknown as T
  try { const m = localStorage.getItem('medico'); return m ? JSON.parse(m) : null } catch { return null }
}

// ── Rede: no demo, nada sai para escrita ─────────────────────────────────────

const LEITURA = new Set(['GET', 'HEAD', 'OPTIONS'])

/**
 * fetch do cliente Supabase do navegador: no demo não vai ao banco.
 * Leituras voltam vazias e escritas são descartadas (com aviso).
 */
export function fetchSupabaseDemo(base: typeof fetch): typeof fetch {
  return (async (input: any, init?: RequestInit) => {
    if (!ehDemo()) return base(input, init)
    const metodo = (init?.method || (typeof input === 'object' && input?.method) || 'GET').toUpperCase()
    const headers = new Headers(init?.headers || (typeof input === 'object' ? input?.headers : undefined))
    const umObjeto = (headers.get('Accept') || '').includes('vnd.pgrst.object')
    if (!LEITURA.has(metodo)) avisoDemo()
    if (umObjeto) {
      return new Response(JSON.stringify({ code: 'PGRST116', message: 'Modo demonstração', details: null, hint: null }), { status: 406, headers: { 'Content-Type': 'application/json' } })
    }
    return new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json', 'Content-Range': '*/0' } })
  }) as typeof fetch
}

const API_LEITURA_PUBLICA = ['/api/public', '/api/agenda-publica/', '/api/painel/', '/api/totem/', '/api/portal/', '/api/sala/', '/api/formularios/buscar']

let protegido = false
/**
 * Instala uma trava no window.fetch: no demo, nenhuma chamada de escrita a /api sai do navegador.
 * Escritas respondem { ok: true, demo: true } e mostram o aviso; leituras de /api privadas voltam 401
 * (assim o demo nunca mistura dados reais, mesmo se houver uma sessão aberta neste navegador).
 */
export function protegerRedeNoDemo() {
  if (typeof window === 'undefined' || protegido) return
  protegido = true
  const original = window.fetch.bind(window)
  window.fetch = (async (input: any, init?: RequestInit) => {
    if (ehDemo()) {
      try {
        const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input?.url, window.location.href)
        const metodo = (init?.method || (typeof input === 'object' && input?.method) || 'GET').toUpperCase()
        if (url.origin === window.location.origin && url.pathname.startsWith('/api/')) {
          if (!LEITURA.has(metodo)) {
            avisoDemo()
            return new Response(JSON.stringify({ ok: true, demo: true }), { status: 200, headers: { 'Content-Type': 'application/json' } })
          }
          // Leituras: só as públicas. As demais não saem (mesmo se houver uma sessão real neste navegador).
          if (!API_LEITURA_PUBLICA.some(p => url.pathname.startsWith(p))) {
            return new Response(JSON.stringify({ error: 'Modo demonstração: dados de exemplo.', demo: true }), { status: 401, headers: { 'Content-Type': 'application/json' } })
          }
        }
      } catch {}
    }
    return original(input, init)
  }) as typeof fetch
}

// A trava é instalada assim que este módulo carrega no navegador (antes dos efeitos das páginas).
// Ela só age quando ehDemo() é true; fora do demo o fetch segue intacto.
if (typeof window !== 'undefined') protegerRedeNoDemo()
