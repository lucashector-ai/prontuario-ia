'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function Cadastro() {
  const router = useRouter()
  const [form, setForm] = useState({ nome: '', crm: '', especialidade: '', email: '', senha: '' })
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState(false)
  const [carregando, setCarregando] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setCarregando(true)
    setErro('')
    try {
      const res = await fetch('/api/medicos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (data.medico) {
        setSucesso(true)
        setTimeout(() => router.push('/login'), 2000)
      } else {
        setErro(data.error || 'Erro ao cadastrar')
      }
    } catch {
      setErro('Erro de conexão')
    } finally {
      setCarregando(false)
    }
  }

  if (sucesso) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center max-w-sm w-full">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">Cadastro realizado!</h2>
          <p className="text-slate-500 text-sm">Redirecionando para o login...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-8">
      <div className="bg-white rounded-2xl border border-slate-200 p-8 w-full max-w-sm">
        <div className="mb-8">
          <h1 className="text-xl font-semibold text-slate-900">Criar conta</h1>
          <p className="text-sm text-slate-400 mt-1">Cadastre-se para usar o Prontuário IA</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {[
            { label: 'Nome completo', key: 'nome', type: 'text', placeholder: 'Dr. João Silva' },
            { label: 'CRM', key: 'crm', type: 'text', placeholder: 'CRM/SP 123456' },
            { label: 'Especialidade', key: 'especialidade', type: 'text', placeholder: 'Clínica Geral' },
            { label: 'E-mail', key: 'email', type: 'email', placeholder: 'seu@email.com' },
            { label: 'Senha', key: 'senha', type: 'password', placeholder: '••••••••' },
          ].map(({ label, key, type, placeholder }) => (
            <div key={key}>
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wide block mb-1.5">
                {label} {key !== 'especialidade' && <span className="text-red-400">*</span>}
              </label>
              <input type={type} required={key !== 'especialidade'}
                value={(form as any)[key]}
                onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                placeholder={placeholder} />
            </div>
          ))}

          {erro && <p className="text-red-500 text-sm bg-red-50 rounded-xl px-4 py-3">{erro}</p>}

          <button type="submit" disabled={carregando}
            className="w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white font-medium py-3 rounded-xl transition-colors text-sm">
            {carregando ? 'Cadastrando...' : 'Criar conta'}
          </button>
        </form>

        <p className="text-center text-sm text-slate-400 mt-6">
          Já tem conta?{' '}
          <a href="/login" className="text-slate-700 hover:underline font-medium">Entrar</a>
        </p>
      </div>
    </div>
  )
}
