import { redirect } from 'next/navigation'

// Página antiga duplicada — o conteúdo vive na aba de Minha clínica.
export default function Page() {
  redirect('/minha-clinica?aba=procedimentos')
}
