'use client'
import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [enviado, setEnviado] = useState(false)
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)

  async function enviar() {
    if (!email) return setErro('Digite seu email')
    setLoading(true); setErro('')
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setLoading(false)
    if (error) setErro(error.message)
    else setEnviado(true)
  }

  return (
    <div className="min-h-screen bg-[#F9FAFC] flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-[#6043C1]/10 rounded-xl flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-[#6043C1]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-gray-900">Recuperar senha</h1>
          <p className="text-gray-500 text-sm mt-1">Enviaremos um link para seu email</p>
        </div>
        {enviado ? (
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-gray-700 font-medium">Email enviado!</p>
            <p className="text-gray-500 text-sm mt-1">Verifique sua caixa de entrada e spam.</p>
            <Link href="/login" className="mt-4 inline-block text-[#6043C1] text-sm hover:underline">← Voltar ao login</Link>
          </div>
        ) : (
          <>
            <input type="email" placeholder="seu@email.com" value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && enviar()}
              className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-[#6043C1] mb-3" />
            {erro && <p className="text-red-500 text-sm mb-3">{erro}</p>}
            <button onClick={enviar} disabled={loading}
              className="w-full bg-[#6043C1] hover:bg-[#5035a8] text-white py-3 rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
              {loading ? 'Enviando...' : 'Enviar link de recuperação'}
            </button>
            <Link href="/login" className="mt-3 block text-center text-gray-500 text-sm hover:text-gray-700">← Voltar ao login</Link>
          </>
        )}
      </div>
    </div>
  )
}
