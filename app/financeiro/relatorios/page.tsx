import { redirect } from 'next/navigation'

// Financeiro desligado pra rebuild (Financeiro 2.0). Sprint 1 pré-beta.
// Conteúdo original preservado no histórico do git.
export default function Page() {
  redirect('/dashboard')
}
