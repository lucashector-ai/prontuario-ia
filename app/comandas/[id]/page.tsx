import { redirect } from 'next/navigation'

// Comanda faz parte do módulo financeiro, desligado pra rebuild. Sprint 1 pré-beta.
// Conteúdo original preservado no histórico do git.
export default function Page() {
  redirect('/dashboard')
}
