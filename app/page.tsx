'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useGravador } from '@/lib/useGravador'
import { ProntuarioCard } from '@/components/ProntuarioCard'
import { ReceitaCard } from '@/components/ReceitaCard'

type Estado = 'idle' | 'gravando' | 'processando' | 'pronto' | 'erro'
type AbaDir = 'prontuario' | 'receita'

export default function Home() {
  const router = useRouter()
  const [medico, setMedico] = useState<any>(null)
  const [transcricao, setTranscricao] = useState('')
  const [prontuario, setProntuario] = useState<any>(null)
  const [receita, setReceita] = useState<any>(null)
  const [estado, setEstado] = useState<Estado>('idle')
  const [gerandoReceita, setGerandoReceita] = useState(false)
  const [erroMsg, setErroMsg] = useState('')
  const [copiado, setCopiado] = useState(false)
  const [abaDir, setAbaDir] = useState<AbaDir>('prontuario')
  const [consultaSalva, setConsultaSalva] = useState(false)

  useEffect(() => {
    const m = localStorage.getItem('medico')
    if (!m) { router.push('/login'); return }
    setMedico(JSON.parse(m))
  }, [router])

  const handleNovoTexto = useCallback((texto: string) => setTranscricao(texto), [])
  const { gravando, transcrevendo, iniciarGravacao, pararGravacao, limpar, erro } = useGravador(handleNovoTexto)

  const handleIniciar = async () => {
    limpar(); setProntuario(null); setReceita(null)
    setConsultaSalva(false); setEstado('gravando')
    await iniciarGravacao()
  }

  const handleParar = () => { pararGravacao(); setEstado('idle') }

  const handleEstruturar = async () => {
    if (!transcricao.trim()) return
    setEstado('processando'); setErroMsg('')
    try {
      const res = await fetch('/api/estruturar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcricao }),
      })
      const data = await res.json()
      if (data.prontuario) {
        setProntuario(data.prontuario)
        setEstado('pronto')
        setAbaDir('prontuario')
        salvarConsulta(data.prontuario)
      } else throw new Error(data.error || 'Erro ao processar')
    } catch (e: any) { setEstado('erro'); setErroMsg(e.message) }
  }

  const salvarConsulta = async (p: any) => {
    if (!medico) return
    try {
      await fetch('/api/consultas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          medico_id: medico.id,
          transcricao,
          subjetivo: p.subjetivo,
          objetivo: p.objetivo,
          avaliacao: p.avaliacao,
          plano: p.plano,
          cids: p.cids,
          alertas: p.alertas,
        }),
      })
      setConsultaSalva(true)
    } catch (e) { console.error('Erro ao salvar:', e) }
  }

  const handleGerarReceita = async () => {
    if (!prontuario) return
    setGerandoReceita(true)
    try {
      const res = await fetch('/api/receita', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prontuario }),
      })
      const data = await res.json()
      if (data.receita) { setReceita(data.receita); setAbaDir('receita') }
    } catch (e) { console.error(e) }
    finally { setGerandoReceita(false) }
  }

  const handleCopiar = () => {
    if (!prontuario) return
    const texto = [
      `PRONTUÁRIO — ${new Date().toLocaleDateString('pt-BR')}`,
      medico ? `Médico: ${medico.nome} | ${medico.crm}` : '', '',
      'SUBJETIVO', prontuario.subjetivo, '',
      'OBJETIVO', prontuario.objetivo, '',
      'AVALIAÇÃO', prontuario.avaliacao, '',
      'PLANO', prontuario.plano, '',
      'CID-10', ...(prontuario.cids || []).map((c: any) => `${c.codigo} — ${c.descricao}`),
    ].join('\n')
    navigator.clipboard.writeText(texto)
    setCopiado(true); setTimeout(() => setCopiado(false), 2000)
  }

  const handleNovo = () => {
    limpar(); setTranscricao(''); setProntuario(null)
    setReceita(null); setEstado('idle'); setErroMsg('')
    setConsultaSalva(false)
  }

  const handleLogout = () => {
    localStorage.removeItem('medico')
    router.push('/login')
  }

  if (!medico) return null

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Prontuário IA</h1>
            <p className="text-xs text-slate-400">Transcrição e estruturação por inteligência artificial</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-medium text-slate-700">{medico.nome}</p>
              <p className="text-xs text-slate-400">{medico.especialidade || medico.crm}</p>
            </div>
            <button onClick={handleLogout}
              className="text-xs text-slate-400 hover:text-slate-600 border border-slate-200 px-3 py-1.5 rounded-lg transition-colors">
              Sair
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <p className="text-slate-500 text-sm mb-6">Clique em <strong>Iniciar gravação</strong> antes de começar a consulta.</p>
            <div className="flex justify-center mb-4">
              {!gravando ? (
                <button onClick={handleIniciar} disabled={estado === 'processando'}
                  className="flex items-center gap-3 bg-red-500 hover:bg-red-600 disabled:bg-slate-300 text-white font-medium px-8 py-4 rounded-2xl transition-colors text-sm">
                  <span className="w-3 h-3 bg-white rounded-full" />Iniciar gravação
                </button>
              ) : (
                <button onClick={handleParar}
                  className="flex items-center gap-3 bg-slate-800 hover:bg-slate-900 text-white font-medium px-8 py-4 rounded-2xl transition-colors text-sm">
                  <span className="w-3 h-3 bg-red-400 rounded-sm" />Parar gravação
                </button>
              )}
            </div>
            {gravando && (
              <div className="flex items-center justify-center gap-2 mb-2">
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                <span className="text-red-500 text-xs font-medium">Gravando — fale normalmente com o paciente</span>
              </div>
            )}
            {transcrevendo && (
              <div className="flex items-center justify-center gap-2">
                <svg className="animate-spin w-3 h-3 text-slate-400" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                <span className="text-slate-400 text-xs">Transcrevendo...</span>
              </div>
            )}
            {erro && <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-600 text-xs mt-3">{erro}</div>}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-slate-500 text-xs font-medium uppercase tracking-wide">Transcrição</p>
              {transcricao && <span className="text-xs text-slate-400">{transcricao.split(' ').length} palavras</span>}
            </div>
            <div className="min-h-[140px] max-h-[240px] overflow-y-auto">
              {transcricao
                ? <p className="text-slate-700 text-sm leading-relaxed">{transcricao}</p>
                : <p className="text-slate-300 text-sm italic">{gravando ? 'Aguardando fala...' : 'A transcrição aparecerá aqui durante a gravação.'}</p>}
            </div>
          </div>

          {transcricao && estado !== 'gravando' && (
            <div className="flex gap-3">
              <button onClick={handleEstruturar} disabled={estado === 'processando'}
                className="flex-1 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white font-medium py-3 rounded-xl transition-colors text-sm">
                {estado === 'processando' ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>Gerando prontuário...
                  </span>
                ) : 'Gerar prontuário'}
              </button>
              <button onClick={handleNovo} className="px-4 py-3 border border-slate-200 hover:bg-slate-100 text-slate-500 rounded-xl transition-colors text-sm">Limpar</button>
            </div>
          )}
          {estado === 'erro' && <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-600 text-sm">Erro: {erroMsg}</div>}
        </div>

        <div>
          {estado === 'processando' && (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 flex flex-col items-center justify-center gap-4 min-h-[300px]">
              <svg className="animate-spin w-8 h-8 text-slate-400" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
              <p className="text-slate-400 text-sm">Analisando e estruturando prontuário...</p>
            </div>
          )}

          {estado === 'pronto' && prontuario && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <div className="flex gap-1 mb-4 bg-slate-100 p-1 rounded-xl">
                <button onClick={() => setAbaDir('prontuario')}
                  className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors ${abaDir === 'prontuario' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                  Prontuário {consultaSalva && '✓'}
                </button>
                <button onClick={() => setAbaDir('receita')}
                  className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors ${abaDir === 'receita' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                  Receita {receita && '✓'}
                </button>
              </div>

              {abaDir === 'prontuario' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-slate-500 text-xs font-medium uppercase tracking-wide">Prontuário gerado</p>
                    <div className="flex items-center gap-2">
                      {consultaSalva && <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">Salvo</span>}
                      <span className="text-xs text-slate-400">{new Date().toLocaleDateString('pt-BR')}</span>
                    </div>
                  </div>
                  <ProntuarioCard prontuario={prontuario} onCopiar={handleCopiar} />
                  {copiado && <p className="text-center text-green-600 text-xs">Copiado!</p>}
                  <button onClick={handleGerarReceita} disabled={gerandoReceita}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-xl text-sm font-medium transition-colors">
                    {gerandoReceita ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                        </svg>Gerando receita...
                      </span>
                    ) : 'Gerar receita médica'}
                  </button>
                </div>
              )}

              {abaDir === 'receita' && (
                <div>
                  {receita ? (
                    <ReceitaCard receita={receita} nomeMedico={medico?.nome} onImprimir={() => window.print()} />
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-3 py-12">
                      <p className="text-slate-400 text-sm">Nenhuma receita gerada ainda.</p>
                      <button onClick={() => setAbaDir('prontuario')} className="text-blue-600 text-sm hover:underline">Voltar ao prontuário</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {(estado === 'idle' || estado === 'gravando') && !prontuario && (
            <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-8 flex flex-col items-center justify-center gap-3 min-h-[300px]">
              <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="text-slate-400 text-sm text-center">O prontuário estruturado<br />aparecerá aqui após a consulta</p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
