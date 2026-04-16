'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const ADMIN_EMAIL = 'lucashector@gmail.com' // seu email

type Medico = {
  id: string
  nome: string
  email: string
  especialidade: string
  plano_ativo: boolean
  criado_em: string
  conversas_count?: number
  pacientes_count?: number
}

export default function AdminPage() {
  const [autenticado, setAutenticado] = useState(false)
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [medicos, setMedicos] = useState<Medico[]>([])
  const [loading, setLoading] = useState(false)
  const [notif, setNotif] = useState({ titulo: '', mensagem: '', destinatario: 'todos' })
  const [tab, setTab] = useState<'contas' | 'notificacoes' | 'stats'>('contas')
  const [stats, setStats] = useState({ total: 0, ativos: 0, inativos: 0, conversas: 0, pacientes: 0 })
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [feedback, setFeedback] = useState('')

  const ADMIN_SENHA = 'MedIA@Admin2026' // troque aqui

  function login() {
    if (senha === ADMIN_SENHA) {
      setAutenticado(true)
      carregarDados()
    } else {
      setErro('Senha incorreta')
    }
  }

  async function carregarDados() {
    setLoading(true)
    try {
      const { data: medicosData } = await supabase
        .from('medicos')
        .select('*')
        .order('criado_em', { ascending: false })

      if (!medicosData) return

      // Conta conversas e pacientes por médico
      const medicosCompletos = await Promise.all(
        medicosData.map(async (m) => {
          const [{ count: conv }, { count: pac }] = await Promise.all([
            supabase.from('whatsapp_conversas').select('id', { count: 'exact', head: true }).eq('medico_id', m.id),
            supabase.from('pacientes').select('id', { count: 'exact', head: true }).eq('medico_id', m.id),
          ])
          return { ...m, conversas_count: conv || 0, pacientes_count: pac || 0 }
        })
      )

      setMedicos(medicosCompletos)
      setStats({
        total: medicosCompletos.length,
        ativos: medicosCompletos.filter(m => m.plano_ativo).length,
        inativos: medicosCompletos.filter(m => !m.plano_ativo).length,
        conversas: medicosCompletos.reduce((a, m) => a + (m.conversas_count || 0), 0),
        pacientes: medicosCompletos.reduce((a, m) => a + (m.pacientes_count || 0), 0),
      })
    } finally {
      setLoading(false)
    }
  }

  async function togglePlano(id: string, atual: boolean) {
    await supabase.from('medicos').update({ plano_ativo: !atual }).eq('id', id)
    setFeedback(atual ? 'Conta desativada' : 'Conta ativada')
    setTimeout(() => setFeedback(''), 3000)
    carregarDados()
  }

  async function deletarConta(id: string) {
    await supabase.from('medicos').delete().eq('id', id)
    setConfirmDelete(null)
    setFeedback('Conta deletada')
    setTimeout(() => setFeedback(''), 3000)
    carregarDados()
  }

  async function enviarNotificacao() {
    if (!notif.titulo || !notif.mensagem) {
      setFeedback('Preencha título e mensagem')
      return
    }
    // Salva notificação na tabela (crie a tabela se não existir)
    const destinatarios = notif.destinatario === 'todos'
      ? medicos.map(m => m.id)
      : [notif.destinatario]

    await Promise.all(
      destinatarios.map(medico_id =>
        supabase.from('notificacoes_admin').insert({
          medico_id, titulo: notif.titulo, mensagem: notif.mensagem, lida: false
        })
      )
    )
    setNotif({ titulo: '', mensagem: '', destinatario: 'todos' })
    setFeedback(`Notificação enviada para ${destinatarios.length} conta(s)`)
    setTimeout(() => setFeedback(''), 3000)
  }

  if (!autenticado) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="bg-gray-900 p-8 rounded-2xl w-full max-w-sm border border-gray-800">
          <div className="text-center mb-6">
            <div className="text-3xl mb-2">🔐</div>
            <h1 className="text-white text-xl font-bold">Admin MedIA</h1>
            <p className="text-gray-400 text-sm mt-1">Acesso restrito</p>
          </div>
          <input
            type="password"
            placeholder="Senha de administrador"
            value={senha}
            onChange={e => setSenha(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && login()}
            className="w-full bg-gray-800 text-white px-4 py-3 rounded-lg border border-gray-700 focus:border-purple-500 focus:outline-none mb-3"
          />
          {erro && <p className="text-red-400 text-sm mb-3">{erro}</p>}
          <button
            onClick={login}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-lg font-medium transition-colors"
          >
            Entrar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">⚕️</span>
          <div>
            <h1 className="font-bold text-lg">MedIA Admin</h1>
            <p className="text-gray-400 text-xs">Painel de administração</p>
          </div>
        </div>
        <button onClick={() => setAutenticado(false)} className="text-gray-400 hover:text-white text-sm">
          Sair
        </button>
      </div>

      {/* Feedback */}
      {feedback && (
        <div className="fixed top-4 right-4 bg-green-600 text-white px-4 py-2 rounded-lg text-sm z-50">
          ✓ {feedback}
        </div>
      )}

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Stats cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          {[
            { label: 'Total contas', value: stats.total, color: 'purple' },
            { label: 'Ativas', value: stats.ativos, color: 'green' },
            { label: 'Inativas', value: stats.inativos, color: 'red' },
            { label: 'Conversas', value: stats.conversas, color: 'blue' },
            { label: 'Pacientes', value: stats.pacientes, color: 'yellow' },
          ].map(s => (
            <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold">{s.value}</div>
              <div className="text-gray-400 text-xs mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-gray-800">
          {(['contas', 'notificacoes'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
                tab === t ? 'border-purple-500 text-purple-400' : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              {t === 'contas' ? '👥 Contas' : '🔔 Notificações'}
            </button>
          ))}
        </div>

        {/* Tab: Contas */}
        {tab === 'contas' && (
          <div className="space-y-3">
            {loading ? (
              <div className="text-center text-gray-400 py-12">Carregando...</div>
            ) : medicos.length === 0 ? (
              <div className="text-center text-gray-400 py-12">Nenhuma conta encontrada</div>
            ) : (
              medicos.map(m => (
                <div key={m.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center font-bold text-sm">
                        {m.nome?.substring(0, 2).toUpperCase() || 'DR'}
                      </div>
                      <div>
                        <div className="font-medium">{m.nome || 'Sem nome'}</div>
                        <div className="text-gray-400 text-sm">{m.email || 'Sem email'}</div>
                        <div className="text-gray-500 text-xs mt-1">
                          {m.especialidade || 'Especialidade não informada'} • 
                          Criado {new Date(m.criado_em).toLocaleDateString('pt-BR')}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-sm text-gray-400">
                      <span>💬 {m.conversas_count} conv.</span>
                      <span>🧑‍⚕️ {m.pacientes_count} pac.</span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        m.plano_ativo ? 'bg-green-900 text-green-400' : 'bg-red-900 text-red-400'
                      }`}>
                        {m.plano_ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => togglePlano(m.id, m.plano_ativo)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          m.plano_ativo
                            ? 'bg-orange-900 hover:bg-orange-800 text-orange-400'
                            : 'bg-green-900 hover:bg-green-800 text-green-400'
                        }`}
                      >
                        {m.plano_ativo ? 'Desativar' : 'Ativar'}
                      </button>

                      {confirmDelete === m.id ? (
                        <div className="flex items-center gap-2">
                          <span className="text-red-400 text-xs">Confirmar?</span>
                          <button
                            onClick={() => deletarConta(m.id)}
                            className="px-3 py-1.5 bg-red-700 hover:bg-red-600 text-white rounded-lg text-xs"
                          >
                            Sim, deletar
                          </button>
                          <button
                            onClick={() => setConfirmDelete(null)}
                            className="px-3 py-1.5 bg-gray-700 text-white rounded-lg text-xs"
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDelete(m.id)}
                          className="px-3 py-1.5 bg-gray-800 hover:bg-red-900 text-gray-400 hover:text-red-400 rounded-lg text-xs transition-colors"
                        >
                          🗑 Deletar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab: Notificações */}
        {tab === 'notificacoes' && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 max-w-2xl">
            <h2 className="text-lg font-bold mb-4">Enviar notificação</h2>

            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Destinatário</label>
                <select
                  value={notif.destinatario}
                  onChange={e => setNotif({...notif, destinatario: e.target.value})}
                  className="w-full bg-gray-800 text-white px-4 py-3 rounded-lg border border-gray-700 focus:border-purple-500 focus:outline-none"
                >
                  <option value="todos">Todos os usuários</option>
                  {medicos.map(m => (
                    <option key={m.id} value={m.id}>{m.nome || m.email}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm text-gray-400 mb-1 block">Título</label>
                <input
                  value={notif.titulo}
                  onChange={e => setNotif({...notif, titulo: e.target.value})}
                  placeholder="Ex: Nova funcionalidade disponível"
                  className="w-full bg-gray-800 text-white px-4 py-3 rounded-lg border border-gray-700 focus:border-purple-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-sm text-gray-400 mb-1 block">Mensagem</label>
                <textarea
                  value={notif.mensagem}
                  onChange={e => setNotif({...notif, mensagem: e.target.value})}
                  placeholder="Escreva sua mensagem aqui..."
                  rows={4}
                  className="w-full bg-gray-800 text-white px-4 py-3 rounded-lg border border-gray-700 focus:border-purple-500 focus:outline-none resize-none"
                />
              </div>

              <button
                onClick={enviarNotificacao}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-lg font-medium transition-colors"
              >
                🔔 Enviar notificação
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
