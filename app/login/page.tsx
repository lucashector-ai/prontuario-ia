'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function Login() {
  const router = useRouter()
  const [form, setForm] = useState({ email: '', senha: '' })
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setCarregando(true)
    setErro('')
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (data.medico) {
        localStorage.setItem('medico', JSON.stringify(data.medico))
        router.push('/')
      } else {
        setErro(data.error || 'Erro ao fazer login')
      }
    } catch {
      setErro('Erro de conexão')
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl border border-slate-200 p-8 w-full max-w-sm">
        <div className="mb-8">
          <h1 className="text-xl font-semibold text-slate-900">Prontuário IA</h1>
          <p className="text-sm text-slate-400 mt-1">Acesse sua conta</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wide block mb-1.5">E-mail</label>
            <input type="email" required value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
              placeholder="seu@email.com" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wide block mb-1.5">Senha</label>
            <input type="password" required value={form.senha}
              onChange={e => setForm(f => ({ ...f, senha: e.target.value }))}
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
              placeholder="••••••••" />
          </div>

          {erro && <p className="text-red-500 text-sm bg-red-50 rounded-xl px-4 py-3">{erro}</p>}

          <button type="submit" disabled={carregando}
            className="w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white font-medium py-3 rounded-xl transition-colors text-sm">
            {carregando ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <p className="text-center text-sm text-slate-400 mt-6">
          Não tem conta?{' '}
          <a href="/cadastro" className="text-slate-700 hover:underline font-medium">Cadastre-se</a>
        </p>
      </div>
    </div>
  )
}
