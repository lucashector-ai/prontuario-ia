'use client'

/**
 * Título/subtítulo da página exibidos no cabeçalho do app (fora do painel branco).
 *
 * Cada rota tem um título padrão (TITULOS_ROTA). Páginas que precisam de título
 * dinâmico usam <PageHeader titulo descricao /> ou usePageHeader(), que sobrescrevem
 * o padrão enquanto estão montadas.
 */
import { createContext, useContext, useEffect, useState } from 'react'

export type HeaderInfo = { titulo: string; descricao?: string }

const Ctx = createContext<{ header: HeaderInfo | null; setHeader: (h: HeaderInfo | null) => void }>({
  header: null,
  setHeader: () => {},
})

export function HeaderProvider({ children }: { children: React.ReactNode }) {
  const [header, setHeader] = useState<HeaderInfo | null>(null)
  return <Ctx.Provider value={{ header, setHeader }}>{children}</Ctx.Provider>
}

export function useHeaderInfo() {
  return useContext(Ctx).header
}

/** Define o título do cabeçalho enquanto o componente estiver montado. */
export function usePageHeader(titulo: string, descricao?: string) {
  const { setHeader } = useContext(Ctx)
  useEffect(() => {
    setHeader({ titulo, descricao })
  }, [titulo, descricao, setHeader])
  useEffect(() => () => setHeader(null), [setHeader])
}

// Títulos padrão por rota (prefixo mais longo vence)
const TITULOS_ROTA: Array<[string, HeaderInfo]> = [
  ['/dashboard', { titulo: 'Dashboard', descricao: 'Visão geral dos atendimentos da sua clínica' }],
  ['/agenda', { titulo: 'Agenda', descricao: 'Consultas e horários da equipe' }],
  ['/pacientes', { titulo: 'Pacientes', descricao: 'Cadastro e acompanhamento dos seus pacientes' }],
  ['/historico', { titulo: 'Histórico de consultas', descricao: 'Prontuários gerados e registros anteriores' }],
  ['/nova-consulta', { titulo: 'Nova consulta', descricao: 'Grave a consulta e gere o prontuário automaticamente' }],
  ['/teleconsulta', { titulo: 'Teleconsulta', descricao: 'Atenda seus pacientes por vídeo' }],
  ['/exames', { titulo: 'Analisar exames', descricao: 'Envie exames e receba uma leitura organizada' }],
  ['/assistente-ia', { titulo: 'Assistente IA', descricao: 'Pergunte sobre condutas, doses e diagnósticos' }],
  ['/chat', { titulo: 'Chat', descricao: 'WhatsApp, Instagram e Messenger' }],
  ['/minha-clinica', { titulo: 'Minha clínica', descricao: 'Dados, procedimentos, automações e privacidade' }],
  ['/admin', { titulo: 'Painel admin', descricao: 'Equipe, permissões e uso da plataforma' }],
  ['/formularios', { titulo: 'Formulários', descricao: 'Anamnese, consentimentos e pré-consulta' }],
  ['/configuracoes/agenda-publica', { titulo: 'Agenda pública', descricao: 'Página de agendamento online para pacientes' }],
  ['/configuracoes', { titulo: 'Configurações', descricao: 'Preferências da clínica' }],
  ['/perfil', { titulo: 'Perfil', descricao: 'Seus dados e preferências' }],
  ['/ditado', { titulo: 'Ditado', descricao: 'Digite ou dite o relato e gere o prontuário' }],
  ['/dicionario', { titulo: 'Dicionário', descricao: 'Termos e abreviações da sua prática' }],
  ['/procedimentos', { titulo: 'Procedimentos', descricao: 'Serviços oferecidos pela clínica' }],
  ['/automacoes', { titulo: 'Automações', descricao: 'Mensagens e relatórios automáticos' }],
  ['/insights', { titulo: 'Insights', descricao: 'Indicadores da sua prática' }],
  ['/lgpd', { titulo: 'Privacidade e LGPD', descricao: 'Seus dados e consentimentos' }],
]

export function tituloDaRota(pathname: string): HeaderInfo {
  let melhor: HeaderInfo | null = null
  let tam = 0
  for (const [prefixo, info] of TITULOS_ROTA) {
    if ((pathname === prefixo || pathname.startsWith(prefixo + '/')) && prefixo.length > tam) {
      melhor = info
      tam = prefixo.length
    }
  }
  return melhor || { titulo: 'Clinical 360' }
}
