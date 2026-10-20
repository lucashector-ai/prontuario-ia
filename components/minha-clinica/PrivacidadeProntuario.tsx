'use client'
/**
 * Prontuário é de quem atendeu (migration 0023). Aqui o administrador decide se os médicos
 * da clínica podem ler os prontuários uns dos outros. Cada médico também pode compartilhar
 * uma consulta específica pelo Histórico.
 */
import { useEffect, useState } from 'react'
import { LockKeyhole } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { tokens as T } from '@/lib/design-tokens'
import { Card, IconTile, Switch } from '@/components/ui'
import { notificar } from '@/components/ui/dialogos'
import { avisoDemo, ehDemo } from '@/lib/demo'

export function PrivacidadeProntuario() {
  const [clinicaId, setClinicaId] = useState<string | null>(null)
  const [gestor, setGestor] = useState(false)
  const [valor, setValor] = useState<boolean | null>(null)
  const [indisponivel, setIndisponivel] = useState(false)

  useEffect(() => {
    if (ehDemo()) { setGestor(true); setValor(false); return } // demonstração: só na tela
    try {
      const ca = JSON.parse(localStorage.getItem('clinica_admin') || 'null')
      const m = JSON.parse(localStorage.getItem('medico') || 'null')
      setClinicaId(ca?.clinica_id || m?.clinica_id || null)
      setGestor(!!ca || m?.cargo === 'admin')
    } catch {}
  }, [])

  useEffect(() => {
    if (!clinicaId) return
    supabase.from('clinicas').select('prontuario_compartilhado').eq('id', clinicaId).maybeSingle()
      .then(({ data, error }) => {
        if (error) { setIndisponivel(true); return }
        setValor(!!(data as any)?.prontuario_compartilhado)
      })
  }, [clinicaId])

  async function mudar(v: boolean) {
    if (ehDemo()) { setValor(v); avisoDemo(); return }
    if (!clinicaId) return
    setValor(v)
    const { error } = await supabase.from('clinicas').update({ prontuario_compartilhado: v }).eq('id', clinicaId)
    if (error) { setValor(!v); notificar('Não foi possível salvar. Tente de novo.', 'erro'); return }
    notificar(v ? 'Médicos da clínica agora veem os prontuários uns dos outros' : 'Cada médico vê só os próprios prontuários')
  }

  if (!gestor) return null
  return (
    <Card style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <IconTile icon={LockKeyhole} size={34} radius={10} />
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, letterSpacing: '-.01em', color: T.text.primary }}>Quem vê o prontuário</h3>
            <p style={{ margin: '2px 0 0', fontSize: 12.5, color: T.text.quaternary, lineHeight: 1.5 }}>
              Por padrão, cada médico vê só os prontuários das consultas que ele fez. A recepção nunca vê o conteúdo do prontuário.
              O médico também pode compartilhar uma consulta específica pelo Histórico.
            </p>
          </div>
          {indisponivel ? (
            <p style={{ margin: 0, fontSize: 12.5, color: T.status.warning }}>Esta opção ainda não está ativa na sua conta. Fale com o suporte do Clinical 360 para liberar.</p>
          ) : (
            <Switch checked={!!valor} disabled={valor === null} onChange={mudar}
              label="Médicos da clínica veem os prontuários uns dos outros"
              descricao="Útil quando vários médicos acompanham os mesmos pacientes." />
          )}
        </div>
      </div>
    </Card>
  )
}
