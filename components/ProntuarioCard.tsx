'use client'

interface CID {
  codigo: string
  descricao: string
  justificativa: string
}

interface Prontuario {
  subjetivo: string
  objetivo: string
  avaliacao: string
  plano: string
  cids: CID[]
  alertas: string[]
}

interface Props {
  prontuario: Prontuario
  onCopiar: () => void
}

const secoes = [
  { chave: 'subjetivo', titulo: 'S — Subjetivo', cor: 'border-blue-400', bg: 'bg-blue-50', texto: 'text-blue-800' },
  { chave: 'objetivo',  titulo: 'O — Objetivo',  cor: 'border-teal-400', bg: 'bg-teal-50', texto: 'text-teal-800' },
  { chave: 'avaliacao', titulo: 'A — Avaliação',  cor: 'border-violet-400', bg: 'bg-violet-50', texto: 'text-violet-800' },
  { chave: 'plano',     titulo: 'P — Plano',      cor: 'border-orange-400', bg: 'bg-orange-50', texto: 'text-orange-800' },
] as const

export function ProntuarioCard({ prontuario, onCopiar }: Props) {
  return (
    <div className="space-y-3">
      {/* Alertas — se houver */}
      {prontuario.alertas && prontuario.alertas.length > 0 && (
        <div className="bg-red-50 border border-red-300 rounded-xl p-4">
          <p className="text-red-700 font-medium text-sm mb-2">⚠ Alertas clínicos</p>
          <ul className="space-y-1">
            {prontuario.alertas.map((alerta, i) => (
              <li key={i} className="text-red-700 text-sm">{alerta}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Seções SOAP */}
      {secoes.map(({ chave, titulo, cor, bg, texto }) => (
        <div key={chave} className={`${bg} border-l-4 ${cor} rounded-r-xl p-4`}>
          <p className={`${texto} font-semibold text-xs uppercase tracking-wide mb-2`}>{titulo}</p>
          <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-line">
            {prontuario[chave] || 'Não mencionado na consulta'}
          </p>
        </div>
      ))}

      {/* CIDs sugeridos */}
      {prontuario.cids && prontuario.cids.length > 0 && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
          <p className="text-slate-500 font-medium text-xs uppercase tracking-wide mb-3">CID-10 sugeridos</p>
          <div className="space-y-2">
            {prontuario.cids.map((cid, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="bg-slate-700 text-white text-xs font-mono px-2 py-1 rounded shrink-0">
                  {cid.codigo}
                </span>
                <div>
                  <p className="text-slate-800 text-sm font-medium">{cid.descricao}</p>
                  <p className="text-slate-500 text-xs mt-0.5">{cid.justificativa}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Botão copiar */}
      <button
        onClick={onCopiar}
        className="w-full py-2.5 border border-slate-300 rounded-xl text-slate-600 text-sm hover:bg-slate-100 transition-colors"
      >
        Copiar prontuário completo
      </button>
    </div>
  )
}
