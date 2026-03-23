'use client'

interface Medicamento {
  nome: string
  dose: string
  via: string
  frequencia: string
  duracao: string
  instrucoes: string
}

interface Receita {
  medicamentos: Medicamento[]
  observacoes: string
}

interface Props {
  receita: Receita
  nomeMedico?: string
  onImprimir: () => void
}

export function ReceitaCard({ receita, nomeMedico, onImprimir }: Props) {
  const hoje = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'long', year: 'numeric'
  })

  return (
    <div className="space-y-4">
      <div id="receita-impressao" className="bg-white border border-slate-200 rounded-2xl p-6">
        <div className="border-b border-slate-200 pb-4 mb-4">
          <h2 className="text-lg font-semibold text-slate-900">Receituário Médico</h2>
          <p className="text-sm text-slate-500 mt-1">{nomeMedico || 'Dr(a). —'}</p>
          <p className="text-xs text-slate-400 mt-0.5">{hoje}</p>
        </div>
        <div className="space-y-4 mb-6">
          {receita.medicamentos.map((med, i) => (
            <div key={i} className="flex gap-3">
              <span className="text-slate-400 font-mono text-sm mt-0.5 w-5 shrink-0">{i + 1}.</span>
              <div>
                <p className="font-medium text-slate-900 text-sm">{med.nome} {med.dose}</p>
                <p className="text-slate-600 text-sm">
                  {med.via} — {med.frequencia}
                  {med.duracao && med.duracao !== 'conforme orientação médica' && ` — por ${med.duracao}`}
                </p>
                {med.instrucoes && med.instrucoes !== 'conforme orientação médica' && (
                  <p className="text-slate-400 text-xs mt-0.5 italic">{med.instrucoes}</p>
                )}
              </div>
            </div>
          ))}
        </div>
        {receita.observacoes && (
          <div className="bg-slate-50 rounded-xl p-3 mb-4">
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-1">Observações</p>
            <p className="text-sm text-slate-700">{receita.observacoes}</p>
          </div>
        )}
        <div className="border-t border-slate-200 pt-4 mt-4">
          <div className="flex justify-end">
            <div className="text-center">
              <div className="w-48 border-t border-slate-400 pt-2">
                <p className="text-xs text-slate-500">{nomeMedico || 'Assinatura do médico'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <button
        onClick={onImprimir}
        className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-medium transition-colors">
        Imprimir receita
      </button>
    </div>
  )
}
