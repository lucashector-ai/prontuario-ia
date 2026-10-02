/**
 * Marca oficial do Clinical 360 — use sempre este componente (menu, login, cadastro, onboarding…).
 *   <Marca />                 logo completo (símbolo + "Clinical 360")
 *   <Marca simbolo size={30}/> só o símbolo (menu recolhido, avatares, favicon)
 */
export function Marca({ simbolo, altura = 26, size = 30, style }: {
  simbolo?: boolean
  altura?: number   // altura do logo completo
  size?: number     // lado do símbolo
  style?: React.CSSProperties
}) {
  if (simbolo) {
    return <img src="/logo-simbolo.svg" alt="Clinical 360" width={size} height={size} style={{ display: 'block', flexShrink: 0, ...style }} />
  }
  return <img src="/logo-clinical-360.svg" alt="Clinical 360" style={{ display: 'block', height: altura, width: 'auto', flexShrink: 0, ...style }} />
}
