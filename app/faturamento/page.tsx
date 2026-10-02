'use client'
/**
 * Faturamento de convênios no padrão TISS (ANS).
 * Fluxo: operadora → guias → lote → XML exportado e enviado no portal da operadora → retorno (pagamento/glosa).
 * ?demo=1 mostra dados de exemplo sem gravar nada. ?guia=<id> abre a guia no editor.
 */
import React, { useEffect, useState } from 'react'
import { FileText, Layers, Wallet, Building2, Info } from 'lucide-react'
import { tokens as T } from '@/lib/design-tokens'
import { Tabs, Badge, Icon } from '@/components/ui'
import { usePageHeader } from '@/components/shell/header-context'
import type { Guia } from '@/lib/tiss/tipos'
import { useFaturamento } from './useFaturamento'
import { CSS_FATURAMENTO } from './comum'
import { AbaGuias } from './AbaGuias'
import { AbaLotes } from './AbaLotes'
import { AbaRecebimentos } from './AbaRecebimentos'
import { AbaOperadoras } from './AbaOperadoras'
import { EditorGuia } from './EditorGuia'

type Aba = 'guias' | 'lotes' | 'recebimentos' | 'operadoras'

export default function FaturamentoPage() {
  usePageHeader('Faturamento de convênios', 'Guias TISS, lotes, recebimentos e glosas')
  const fat = useFaturamento()
  const [aba, setAba] = useState<Aba>('guias')
  const [editando, setEditando] = useState<Guia | null>(null)

  // ?guia=<id> → abre o editor quando os dados chegarem
  useEffect(() => {
    if (!fat.guiaInicial || fat.carregando) return
    const g = fat.guias.find(x => x.id === fat.guiaInicial)
    if (g) setEditando(g)
    window.history.replaceState(null, '', window.location.pathname + (fat.demo ? '?demo=1' : ''))
  }, [fat.guiaInicial, fat.carregando]) // eslint-disable-line react-hooks/exhaustive-deps

  // Mantém o editor sincronizado com a guia atualizada na lista
  useEffect(() => {
    if (editando?.id) {
      const atual = fat.guias.find(g => g.id === editando.id)
      if (atual && atual !== editando) setEditando(atual)
    }
  }, [fat.guias]) // eslint-disable-line react-hooks/exhaustive-deps

  const abrirGuia = (g: Guia) => setEditando(g)
  const irPara = (a: string) => setAba(a as Aba)
  const nEnviadas = fat.guias.filter(g => g.status === 'enviada').length
  const nAbertos = fat.lotes.filter(l => l.status === 'aberto').length

  return (
    <div style={{ padding: '20px 24px 32px', maxWidth: 1240, margin: '0 auto', boxSizing: 'border-box' }}>
      <style dangerouslySetInnerHTML={{ __html: CSS_FATURAMENTO }} />

      {(fat.demo || fat.semMigration) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          {fat.demo && <Badge tone="accent" dot>Modo demonstração · nada é gravado</Badge>}
          {fat.semMigration && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: T.status.warning }}>
              <Icon icon={Info} size={14} /> Rode a migration 0012_faturamento_tiss no Supabase para usar o faturamento.
            </span>
          )}
        </div>
      )}

      <div style={{ overflowX: 'auto', scrollbarWidth: 'none' }}>
        <Tabs ativa={aba} onChange={(id) => setAba(id as Aba)} style={{ minWidth: 'max-content' }} tabs={[
          { id: 'guias', label: 'Guias', icon: <FileText size={15} strokeWidth={1.6} /> },
          { id: 'lotes', label: nAbertos ? `Lotes (${nAbertos})` : 'Lotes', icon: <Layers size={15} strokeWidth={1.6} /> },
          { id: 'recebimentos', label: nEnviadas ? `Recebimentos e glosas (${nEnviadas})` : 'Recebimentos e glosas', icon: <Wallet size={15} strokeWidth={1.6} /> },
          { id: 'operadoras', label: 'Operadoras', icon: <Building2 size={15} strokeWidth={1.6} /> },
        ]} />
      </div>

      {aba === 'guias' && <AbaGuias fat={fat} abrirGuia={abrirGuia} irPara={irPara} />}
      {aba === 'lotes' && <AbaLotes fat={fat} abrirGuia={abrirGuia} irPara={irPara} />}
      {aba === 'recebimentos' && <AbaRecebimentos fat={fat} abrirGuia={abrirGuia} />}
      {aba === 'operadoras' && <AbaOperadoras fat={fat} />}

      {editando && <EditorGuia fat={fat} guia={editando} onClose={() => setEditando(null)} />}
    </div>
  )
}
