import { Marca } from '@/components/Marca'
import { tokens } from '@/lib/design-tokens'

/**
 * Layout padrão das telas de acesso (fora da casca do app): esqueci a senha,
 * nova senha, verificação de e-mail, conta criada, trocar senha, login de atendente…
 *
 *   <TelaAcesso titulo="Recuperar senha" descricao="…" icone={<KeyRound/>}>…form…</TelaAcesso>
 */
export function TelaAcesso({ titulo, descricao, icone, tomIcone = 'brand', children, rodape, largura = 420 }: {
  titulo: React.ReactNode
  descricao?: React.ReactNode
  icone?: React.ReactNode
  tomIcone?: 'brand' | 'success' | 'danger'
  children?: React.ReactNode
  rodape?: React.ReactNode
  largura?: number
}) {
  const T = tokens
  const cores = {
    brand: [T.brand.primaryLight, T.brand.primary],
    success: [T.status.successBg, T.status.success],
    danger: [T.status.dangerBg, T.status.danger],
  }[tomIcone]
  return (
    <div style={{ minHeight: '100dvh', background: T.bg.page, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 16px' }}>
      <Marca altura={28} style={{ marginBottom: 24 }} />
      <div style={{
        width: `min(${largura}px, 100%)`, background: '#fff', border: `1px solid ${T.border.default}`, borderRadius: 20,
        padding: '28px 28px 24px', display: 'flex', flexDirection: 'column', gap: 18,
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 8 }}>
          {icone && (
            <span style={{ width: 48, height: 48, borderRadius: 15, background: cores[0], color: cores[1], display: 'grid', placeItems: 'center', marginBottom: 4 }}>
              {icone}
            </span>
          )}
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: '-.02em', color: T.text.primary }}>{titulo}</h1>
          {descricao && <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55, color: T.text.quaternary, maxWidth: 340 }}>{descricao}</p>}
        </div>
        {children}
      </div>
      {rodape && <div style={{ marginTop: 18, fontSize: 13, color: T.text.quaternary, textAlign: 'center' }}>{rodape}</div>}
    </div>
  )
}
