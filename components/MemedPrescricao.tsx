'use client'

import { useEffect, useState } from 'react'

const MEMED_SCRIPT_URL = process.env.NEXT_PUBLIC_MEMED_SCRIPT_URL ||
  'https://integrations.memed.com.br/modulos/plataforma.sinapse-prescricao/build/sinapse-prescricao.min.js'

declare global {
  interface Window {
    MdSinapsePrescricao?: any
    MdHub?: any
  }
}

interface PacienteMemed {
  /** ID externo do paciente (UUID do MedIA) */
  id: string
  nome: string
  cpf?: string | null
  data_nascimento?: string | null  // ISO YYYY-MM-DD
  sexo?: string | null
  telefone?: string | null
  email?: string | null
  endereco?: string | null
  cidade?: string | null
}

interface Props {
  medicoId: string
  paciente: PacienteMemed
  onClose?: () => void
  onPrescricaoGerada?: (dados: any) => void
}

export function MemedPrescricao({ medicoId, paciente, onClose, onPrescricaoGerada }: Props) {
  const [estado, setEstado] = useState<'carregando' | 'pronto' | 'erro'>('carregando')
  const [erro, setErro] = useState('')

  useEffect(() => {
    let abortou = false

    const carregar = async () => {
      try {
        // 1. Busca token do prescritor
        const tokRes = await fetch('/api/memed/prescritor', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ medico_id: medicoId }),
        })
        const tokData = await tokRes.json()
        if (abortou) return
        if (!tokRes.ok || !tokData.token) {
          setErro(tokData.error || 'Não foi possível obter token Memed')
          setEstado('erro')
          return
        }

        // 2. Carrega script Memed com data-token
        // Remove qualquer script Memed anterior (caso paciente trocou)
        const scriptAnterior = document.querySelector('script[data-memed]')
        if (scriptAnterior) scriptAnterior.remove()

        const script = document.createElement('script')
        script.src = MEMED_SCRIPT_URL
        script.async = true
        script.setAttribute('data-token', tokData.token)
        script.setAttribute('data-memed', 'true')

        script.onerror = () => {
          if (abortou) return
          setErro('Falha ao carregar script Memed')
          setEstado('erro')
        }

        document.body.appendChild(script)

        // 3. Aguarda evento 'core:moduleInit' pra saber quando módulo prescrição está pronto
        const checkReady = setInterval(() => {
          if (abortou) { clearInterval(checkReady); return }
          if (window.MdSinapsePrescricao?.event?.add) {
            clearInterval(checkReady)
            inicializarPrescricao(tokData.token)
          }
        }, 200)

        // Timeout de 15s pra não ficar travado
        setTimeout(() => {
          clearInterval(checkReady)
          if (!abortou && estado === 'carregando') {
            setErro('Timeout ao carregar Memed (15s)')
            setEstado('erro')
          }
        }, 15000)
      } catch (e: any) {
        if (abortou) return
        setErro('Erro ao iniciar Memed: ' + (e?.message || 'desconhecido'))
        setEstado('erro')
      }
    }

    const inicializarPrescricao = (token: string) => {
      const md = window.MdSinapsePrescricao
      if (!md) return

      md.event.add('core:moduleInit', async (module: any) => {
        if (module.name !== 'plataforma.prescricao') return
        if (abortou) return

        try {
          // Configura paciente
          const sexoMemed = paciente.sexo === 'F' ? 'Feminino' : paciente.sexo === 'M' ? 'Masculino' : (paciente.sexo || 'Masculino')

          const dataNasc = paciente.data_nascimento
            ? formatDataMemed(paciente.data_nascimento)
            : undefined

          const cpfLimpo = (paciente.cpf || '').replace(/\D/g, '')
          const telLimpo = (paciente.telefone || '').replace(/\D/g, '')

          const dadosPaciente: any = {
            idExterno: paciente.id,
            nome: paciente.nome,
            sexo: sexoMemed,
          }
          if (cpfLimpo.length === 11) dadosPaciente.cpf = cpfLimpo
          if (dataNasc) dadosPaciente.data_nascimento = dataNasc
          if (telLimpo) dadosPaciente.telefone = telLimpo
          if (paciente.email) dadosPaciente.email = paciente.email
          if (paciente.endereco) dadosPaciente.endereco = paciente.endereco
          if (paciente.cidade) dadosPaciente.cidade = paciente.cidade

          await window.MdHub.command.send('plataforma.prescricao', 'setPaciente', dadosPaciente)

          // Mostra módulo de prescrição
          window.MdHub.module.show('plataforma.prescricao')

          // Listener pra capturar prescrição gerada
          if (window.MdHub.event?.add) {
            window.MdHub.event.add('prescricaoImpressa', (dados: any) => {
              console.log('[Memed] Prescrição gerada:', dados)
              if (onPrescricaoGerada) onPrescricaoGerada(dados)
            })
          }

          setEstado('pronto')
        } catch (err: any) {
          console.error('[Memed] erro setPaciente:', err)
          setErro('Erro ao configurar paciente: ' + (err?.message || 'desconhecido'))
          setEstado('erro')
        }
      })
    }

    carregar()

    return () => {
      abortou = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [medicoId, paciente.id])

  // Loading
  if (estado === 'carregando') {
    return (
      <div style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16,
      }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.2)', borderTopColor: 'white', animation: 'spin 0.8s linear infinite' }}/>
        <p style={{ color: 'white', fontSize: 14, fontWeight: 600, margin: 0 }}>Carregando Memed...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (estado === 'erro') {
    return (
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}>
        <div onClick={e => e.stopPropagation()} style={{
          background: 'white', borderRadius: 14, padding: 24,
          maxWidth: 420, width: '100%',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            </div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: 0 }}>Não foi possível abrir a Memed</h3>
          </div>
          <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 16px', lineHeight: 1.5 }}>{erro}</p>
          <button onClick={onClose} style={{
            padding: '9px 18px', borderRadius: 8, border: 'none',
            background: '#6043C1', color: 'white', fontSize: 13, fontWeight: 600,
            cursor: 'pointer',
          }}>Fechar</button>
        </div>
      </div>
    )
  }

  // Quando estado === 'pronto', a interface Memed aparece sobre a página automaticamente
  // Renderizamos só um overlay opcional com botão de fechar
  return (
    <div style={{
      position: 'fixed', top: 12, right: 12, zIndex: 101,
    }}>
      {onClose && (
        <button onClick={onClose} style={{
          padding: '8px 14px', borderRadius: 8, border: 'none',
          background: 'white', color: '#374151', fontSize: 13, fontWeight: 600,
          cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
          Fechar Memed
        </button>
      )}
    </div>
  )
}

// Memed exige formato DD/MM/YYYY
function formatDataMemed(iso: string): string | undefined {
  try {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return undefined
    const dd = String(d.getDate()).padStart(2, '0')
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const yyyy = d.getFullYear()
    return `${dd}/${mm}/${yyyy}`
  } catch {
    return undefined
  }
}
