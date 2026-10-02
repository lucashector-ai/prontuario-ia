'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

/**
 * Quantas conversas do Chat têm mensagem recebida não lida (para o selo no menu).
 * Usa a mesma caixa de entrada do /chat: médico logado, ou 1º médico ativo da clínica
 * para admin/recepcionista. Ignora conversas arquivadas e silenciadas.
 * Em /chat?demo=1 devolve um número de exemplo (prints/apresentação).
 */
export function useChatNaoLidas() {
  const [total, setTotal] = useState(0)

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('demo') === '1') { setTotal(3); return }
    let medicoId: string | null = null
    let parar = false

    const resolverMedico = async () => {
      try {
        const ca = localStorage.getItem('clinica_admin')
        const m = localStorage.getItem('medico')
        const pessoa = ca ? JSON.parse(ca) : m ? JSON.parse(m) : null
        if (!pessoa) return null
        if (!ca && pessoa.cargo !== 'recepcionista') return pessoa.id as string
        if (!pessoa.clinica_id) return null
        const { data } = await supabase.from('medicos').select('id').eq('clinica_id', pessoa.clinica_id)
          .eq('cargo', 'medico').eq('ativo', true).order('criado_em', { ascending: true }).limit(1).maybeSingle()
        return data?.id || null
      } catch { return null }
    }

    const contar = async () => {
      if (!medicoId || parar) return
      const { data, error } = await supabase
        .from('whatsapp_mensagens')
        .select('conversa_id, whatsapp_conversas!inner(medico_id, arquivada, silenciada_ate)')
        .eq('tipo', 'recebida').eq('lida', false)
        .eq('whatsapp_conversas.medico_id', medicoId)
        .limit(500)
      if (error) {
        // Antes da migration 0009 não existem arquivada/silenciada_ate: conta sem esses filtros
        const r = await supabase.from('whatsapp_mensagens').select('conversa_id, whatsapp_conversas!inner(medico_id)')
          .eq('tipo', 'recebida').eq('lida', false).eq('whatsapp_conversas.medico_id', medicoId).limit(500)
        if (!parar) setTotal(new Set((r.data || []).map((x: any) => x.conversa_id)).size)
        return
      }
      const agora = Date.now()
      const ids = new Set((data || []).filter((x: any) => {
        const c = x.whatsapp_conversas
        if (c?.arquivada) return false
        if (c?.silenciada_ate && new Date(c.silenciada_ate).getTime() > agora) return false
        return true
      }).map((x: any) => x.conversa_id))
      if (!parar) setTotal(ids.size)
    }

    let canal: ReturnType<typeof supabase.channel> | null = null
    let timer: any
    resolverMedico().then(id => {
      medicoId = id
      if (!id || parar) return
      contar()
      timer = setInterval(contar, 20000)
      canal = supabase.channel('menu-chat-naolidas-' + id)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_mensagens' }, () => contar())
        .subscribe()
    })
    return () => { parar = true; clearInterval(timer); if (canal) supabase.removeChannel(canal) }
  }, [])

  return total
}
