'use client'
/**
 * Compatibilidade: o gravador antigo (pedaços de 4 s enviados um a um) foi substituído
 * pela transcrição contínua com revisão final — ver lib/transcricao/useTranscricao.ts.
 */
import { useTranscricao } from '@/lib/transcricao/useTranscricao'

export function useGravador(onNovoTexto: (texto: string) => void) {
  return useTranscricao(onNovoTexto)
}
