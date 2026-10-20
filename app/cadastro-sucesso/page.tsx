import { redirect } from 'next/navigation'

// Tela antiga de "confirme seu email" (o cadastro hoje entra direto no onboarding).
// Links antigos caem no login.
export default function Page() {
  redirect('/login')
}
