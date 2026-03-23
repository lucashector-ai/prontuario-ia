'use client'

interface CID { codigo: string; descricao: string; justificativa: string }
interface Prontuario {
  subjetivo: string; objetivo: string; avaliacao: string; plano: string
  cids: CID[]; alertas: string[]
}
interface Props { prontuario: Prontuario; onCopiar: () => void; nomeMedico?: string; crm?: string }

export function ProntuarioCard({ prontuario, onCopiar, nomeMedico, crm }: Props) {
  const hoje = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })

  return (
    <div className="space-y-3">
      {prontuario.alertas?.length > 0 && (
        <div className="bg-red-50 border-l-4 border-red-500 rounded-r-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-4 h-4 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5C2.57 18.333 3.532 20 5.072 20z"/>
            </svg>
            <p className="text-red-700 font-semibold text-xs uppercase tracking-wide">Alertas clínicos</p>
          </div>
          <ul className="space-y-1">
            {prontuario.alertas.map((a, i) => <li key={i} className="text-red-700 text-sm flex items-start gap-2"><span className="text-red-400 mt-0.5">•</span>{a}</li>)}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3">
        {[
          { key: 'subjetivo', letra: 'S', titulo: 'Subjetivo', sub: 'Queixas e história', cor: 'blue' },
          { key: 'objetivo',  letra: 'O', titulo: 'Objetivo',  sub: 'Exame físico e sinais', cor: 'teal' },
          { key: 'avaliacao', letra: 'A', titulo: 'Avaliação',  sub: 'Hipótese diagnóstica', cor: 'violet' },
          { key: 'plano',     letra: 'P', titulo: 'Plano',      sub: 'Conduta e prescrição', cor: 'orange' },
        ].map(({ key, letra, titulo, sub, cor }) => {
          const cores: Record<string, string> = {
            blue:   'bg-blue-50 border-blue-200 text-blue-900 ring-blue-400',
            teal:   'bg-teal-50 border-teal-200 text-teal-900 ring-teal-400',
            violet: 'bg-violet-50 border-violet-200 text-violet-900 ring-violet-400',
            orange: 'bg-orange-50 border-orange-200 text-orange-900 ring-orange-400',
          }
          const letraCores: Record<string, string> = {
            blue: 'bg-blue-600 text-white', teal: 'bg-teal-600 text-white',
            violet: 'bg-violet-600 text-white', orange: 'bg-orange-500 text-white',
          }
          return (
            <div key={key} className={`${cores[cor].split(' ').slice(0,2).join(' ')} border rounded-xl p-4`}>
              <div className="flex items-center gap-3 mb-2">
                <span className={`${letraCores[cor]} w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0`}>{letra}</span>
                <div>
                  <p className="font-semibold text-sm text-slate-800">{titulo}</p>
                  <p className="text-xs text-slate-500">{sub}</p>
                </div>
              </div>
              <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-line pl-10">
                {(prontuario as any)[key] || 'Não mencionado na consulta'}
              </p>
            </div>
          )
        })}
      </div>

      {prontuario.cids?.length > 0 && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
          <p className="text-slate-500 font-semibold text-xs uppercase tracking-wide mb-3">CID-10 sugeridos</p>
          <div className="space-y-2">
            {prontuario.cids.map((cid, i) => (
              <div key={i} className="flex items-start gap-3 bg-white rounded-lg p-2.5 border border-slate-100">
                <span className="bg-slate-800 text-white text-xs font-mono px-2 py-1 rounded-md shrink-0 mt-0.5">{cid.codigo}</span>
                <div>
                  <p className="text-slate-800 text-sm font-medium">{cid.descricao}</p>
                  <p className="text-slate-400 text-xs mt-0.5">{cid.justificativa}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {(nomeMedico || crm) && (
        <div className="border border-slate-200 rounded-xl p-4 bg-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 mb-1">{hoje}</p>
              <p className="text-sm font-medium text-slate-800">{nomeMedico}</p>
              {crm && <p className="text-xs text-slate-500">{crm}</p>}
            </div>
            <div className="w-24 border-t-2 border-slate-300 text-center pt-1">
              <p className="text-xs text-slate-400">assinatura</p>
            </div>
          </div>
        </div>
      )}

      <button onClick={onCopiar}
        className="w-full py-2.5 border border-slate-200 rounded-xl text-slate-500 text-sm hover:bg-slate-50 transition-colors flex items-center justify-center gap-2">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
        </svg>
        Copiar prontuário completo
      </button>
    </div>
  )
}
