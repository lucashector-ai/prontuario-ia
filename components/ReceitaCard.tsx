'use client'

interface Medicamento { nome: string; dose: string; via: string; frequencia: string; duracao: string; instrucoes: string }
interface Receita { medicamentos: Medicamento[]; observacoes: string }
interface Props { receita: Receita; nomeMedico?: string; crm?: string; especialidade?: string; onImprimir: () => void }

export function ReceitaCard({ receita, nomeMedico, crm, especialidade, onImprimir }: Props) {
  const hoje = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="bg-slate-800 px-5 py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white font-semibold text-base">{nomeMedico || 'Médico responsável'}</p>
              {especialidade && <p className="text-slate-300 text-xs mt-0.5">{especialidade}</p>}
              {crm && <p className="text-slate-400 text-xs">{crm}</p>}
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-400">Receituário médico</p>
              <p className="text-slate-300 text-xs mt-0.5">{hoje}</p>
            </div>
          </div>
        </div>

        <div className="px-5 py-4 space-y-3">
          {receita.medicamentos?.map((med, i) => (
            <div key={i} className="flex gap-3 pb-3 border-b border-slate-100 last:border-0 last:pb-0">
              <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-slate-600 text-xs font-bold">{i + 1}</span>
              </div>
              <div className="flex-1">
                <p className="font-semibold text-slate-900 text-sm">{med.nome} {med.dose}</p>
                <div className="flex flex-wrap gap-2 mt-1">
                  {med.via && med.via !== 'conforme orientação médica' && (
                    <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{med.via}</span>
                  )}
                  {med.frequencia && med.frequencia !== 'conforme orientação médica' && (
                    <span className="text-xs bg-teal-50 text-teal-700 px-2 py-0.5 rounded-full">{med.frequencia}</span>
                  )}
                  {med.duracao && med.duracao !== 'conforme orientação médica' && (
                    <span className="text-xs bg-orange-50 text-orange-700 px-2 py-0.5 rounded-full">{med.duracao}</span>
                  )}
                </div>
                {med.instrucoes && med.instrucoes !== 'conforme orientação médica' && (
                  <p className="text-xs text-slate-400 mt-1 italic">{med.instrucoes}</p>
                )}
              </div>
            </div>
          ))}
        </div>

        {receita.observacoes && (
          <div className="mx-5 mb-4 bg-amber-50 border border-amber-100 rounded-xl p-3">
            <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">Orientações</p>
            <p className="text-sm text-amber-800">{receita.observacoes}</p>
          </div>
        )}

        <div className="border-t border-slate-100 px-5 py-4">
          <div className="flex justify-between items-end">
            <p className="text-xs text-slate-400">Válido por 30 dias</p>
            <div className="text-center">
              <div className="w-36 border-t border-slate-400 pt-1">
                <p className="text-xs text-slate-500">{nomeMedico}</p>
                {crm && <p className="text-xs text-slate-400">{crm}</p>}
              </div>
            </div>
          </div>
        </div>
      </div>

      <button onClick={onImprimir}
        className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/>
        </svg>
        Imprimir receita
      </button>
    </div>
  )
}
