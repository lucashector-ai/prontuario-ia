'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function Historico() {
  const router = useRouter()
  const [medico, setMedico] = useState<any>(null)
  const [consultas, setConsultas] = useState<any[]>([])
  const [carregando, setCarregando] = useState(true)
  const [selecionada, setSelecionada] = useState<any>(null)

  useEffect(() => {
    const m = localStorage.getItem('medico')
    if (!m) { router.push('/login'); return }
    const med = JSON.parse(m)
    setMedico(med)
    carregarConsultas(med.id)
  }, [router])

  const carregarConsultas = async (medicoId: string) => {
    const { data } = await supabase
      .from('consultas')
      .select('*')
      .eq('medico_id', medicoId)
      .order('criado_em', { ascending: false })
    setConsultas(data || [])
    setCarregando(false)
  }

  const formatarData = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  })

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/')} className="text-slate-400 hover:text-slate-600">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7"/>
              </svg>
            </button>
            <div>
              <h1 className="text-lg font-semibold text-slate-900">Histórico de consultas</h1>
              <p className="text-xs text-slate-400">{medico?.nome}</p>
            </div>
          </div>
          <span className="text-xs text-slate-400 bg-slate-100 px-3 py-1 rounded-full">{consultas.length} consultas</span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1 space-y-2">
          {carregando ? (
            <div className="text-center py-12 text-slate-400 text-sm">Carregando...</div>
          ) : consultas.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">Nenhuma consulta registrada</div>
          ) : consultas.map((c) => (
            <button key={c.id} onClick={() => setSelecionada(c)}
              className={`w-full text-left bg-white border rounded-xl p-4 transition-all ${selecionada?.id === c.id ? 'border-slate-800 shadow-sm' : 'border-slate-200 hover:border-slate-300'}`}>
              <p className="text-xs text-slate-400">{formatarData(c.criado_em)}</p>
              <p className="text-sm font-medium text-slate-800 mt-1 line-clamp-2">
                {c.subjetivo?.substring(0, 80) || 'Consulta sem detalhes'}...
              </p>
              {c.cids && c.cids.length > 0 && (
                <div className="flex gap-1 mt-2 flex-wrap">
                  {c.cids.slice(0, 2).map((cid: any, i: number) => (
                    <span key={i} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-mono">{cid.codigo}</span>
                  ))}
                </div>
              )}
            </button>
          ))}
        </div>

        <div className="lg:col-span-2">
          {selecionada ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <p className="text-sm font-medium text-slate-800">Consulta de {formatarData(selecionada.criado_em)}</p>
                <button onClick={() => window.print()} className="text-xs text-slate-500 border border-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-50">
                  Imprimir
                </button>
              </div>
              {[
                { key: 'subjetivo', titulo: 'S — Subjetivo', cor: 'blue' },
                { key: 'objetivo',  titulo: 'O — Objetivo',  cor: 'teal' },
                { key: 'avaliacao', titulo: 'A — Avaliação',  cor: 'violet' },
                { key: 'plano',     titulo: 'P — Plano',      cor: 'orange' },
              ].map(({ key, titulo, cor }) => {
                const bgs: Record<string,string> = { blue: 'bg-blue-50 border-blue-200', teal: 'bg-teal-50 border-teal-200', violet: 'bg-violet-50 border-violet-200', orange: 'bg-orange-50 border-orange-200' }
                const txts: Record<string,string> = { blue: 'text-blue-800', teal: 'text-teal-800', violet: 'text-violet-800', orange: 'text-orange-800' }
                return (
                  <div key={key} className={`${bgs[cor]} border rounded-xl p-3`}>
                    <p className={`${txts[cor]} font-semibold text-xs uppercase tracking-wide mb-1`}>{titulo}</p>
                    <p className="text-slate-700 text-sm leading-relaxed">{(selecionada as any)[key] || '—'}</p>
                  </div>
                )
              })}
              {selecionada.cids?.length > 0 && (
                <div className="bg-slate-50 rounded-xl p-3">
                  <p className="text-slate-500 text-xs font-semibold uppercase tracking-wide mb-2">CID-10</p>
                  <div className="flex gap-2 flex-wrap">
                    {selecionada.cids.map((cid: any, i: number) => (
                      <div key={i} className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-1.5">
                        <span className="font-mono text-xs font-bold text-slate-800">{cid.codigo}</span>
                        <span className="text-xs text-slate-500">{cid.descricao}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white border border-dashed border-slate-200 rounded-2xl p-12 flex flex-col items-center justify-center gap-3">
              <svg className="w-10 h-10 text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
              </svg>
              <p className="text-slate-400 text-sm">Selecione uma consulta para ver os detalhes</p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
