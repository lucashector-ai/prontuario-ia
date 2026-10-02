'use client'
import { useEffect } from 'react'
import { notFound } from 'next/navigation'

// Sessão local de teste — SÓ em desenvolvimento (`npm run dev`).
// Em produção (`next build`) a rota responde 404.
// Grava uma sessão fake no localStorage e entra no app sem login.
// Os dados vêm vazios: os ids não existem no banco.
export default function DevLogin() {
  if (process.env.NODE_ENV === 'production') notFound()

  useEffect(() => {
    const clinica = { id: '00000000-0000-0000-0000-000000000002', nome: 'Clínica Teste' }
    localStorage.setItem('medico', JSON.stringify({
      id: '00000000-0000-0000-0000-000000000001', nome: 'Dra. Teste', email: 'teste@exemplo.test',
      especialidade: 'Clínica Geral', onboarding_concluido: true, clinica_id: clinica.id,
    }))
    localStorage.setItem('clinica', JSON.stringify(clinica))
    localStorage.setItem('clinica_admin', JSON.stringify({
      id: '00000000-0000-0000-0000-000000000003', nome: 'Admin Teste', clinica_id: clinica.id, onboarding_concluido: true,
    }))
    const destino = new URLSearchParams(location.search).get('para') || '/dashboard'
    location.replace(destino)
  }, [])

  return <p style={{ padding: 24, fontSize: 14 }}>Entrando com sessão de teste…</p>
}
