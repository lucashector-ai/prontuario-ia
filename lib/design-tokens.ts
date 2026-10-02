/**
 * Design Tokens — ponto único de verdade para cores, raios e sombras da plataforma.
 *
 * Use SEMPRE os tokens semânticos (tokens.bg.page, tokens.brand.primary, etc.)
 * em vez de hex literais espalhados pelo código.
 *
 * Se um valor visual precisar mudar, altera AQUI e o resto da plataforma acompanha.
 */

export const tokens = {
  // ── Backgrounds ────────────────────────────────────────────────────────
  bg: {
    page: '#F7F7F8',           // fundo da plataforma e páginas
    card: '#FFFFFF',           // fundo de cards / superfícies elevadas
    cardSubtle: '#FAFAFB',     // cards aninhados / itens em listas
    hover: '#F5F5F7',          // hover de items clicáveis
    hoverStrong: '#F0F0F3',    // hover mais marcante
    overlay: 'rgba(28,27,34,0.32)',// modais / overlays
    muted: '#FAFAFB',          // áreas neutras (tabelas, sub-headers)
    chatPattern: '#E5DDD5',    // fundo padrão whatsapp (chat)
    chatBg: '#F0F2F5',         // fundo lista de chats
  },

  // ── Borders ────────────────────────────────────────────────────────────
  border: {
    default: '#EBEAEF',        // border padrão (inputs, cards)
    subtle: '#EBEAEF',         // bordas de cards/inputs e separadores — visível e suave
    strong: '#DCDAE3',         // borders mais marcantes
    muted: '#F3F2F6',          // border alternativa neutra
    focus: '#5B3FD0',          // border de foco (alinhada à brand)
    chat: '#D1D7DB',           // bordas em UI estilo whatsapp
    chatStrong: '#54656F',     // ícones/headers chat
  },

  // ── Text ───────────────────────────────────────────────────────────────
  text: {
    primary: '#1C1B22',        // texto principal
    secondary: '#6B6977',      // texto secundário / labels
    tertiary: '#A09EAB',       // placeholder, texto auxiliar
    quaternary: '#8C8A96',     // metadados muito leves
    inverse: '#FFFFFF',        // texto sobre fundos coloridos
    muted: '#4A4855',          // textos médios alternativos
    strong: '#2E2C36',         // textos enfáticos não-primary
    chatPrimary: '#111B21',    // estilo whatsapp
    chatSecondary: '#667781',  // metadados chat
    chatHeader: '#41525D',
    slate900: '#0F172A',
    slate800: '#1E293B',
    slate700: '#334155',
    slate600: '#475569',
    slate500: '#64748B',
    slate400: '#94A3B8',
    slate300: '#CBD5E1',
    slate200: '#E2E8F0',
  },

  // ── Brand (Clinical 360 — roxo) ───────────────────────────────────────
  brand: {
    primary: '#5B3FD0',        // roxo principal
    primaryHover: '#4C32BD',   // hover do botão
    primaryDark: '#3B2A96',    // tons mais escuros
    primaryDarker: '#3C3489',
    primaryDeep: '#1E1344',
    primaryLight: '#EFECFB',   // bg leve (badges, hover suave)
    primaryLighter: '#EFECFB', // bg de chips/cards do roxo
    primarySubtle: '#F3F0FD',  // bg ainda mais leve
    primaryAccent: '#CFC8F2',  // bordas/accents do roxo
    primaryAccentSoft: '#D9D4F3',
    primaryAccentLight: '#E6E1FA',
    primarySoftBg: '#FAF9FF',
    primaryDarkText: '#4C32BD',
    legacyGreenDark: '#176F44', // valor herdado de variável CSS antiga
  },

  // ── Status (semântico) ─────────────────────────────────────────────────
  status: {
    success: '#1F8A5B',
    successHover: '#15803D',
    successDark: '#166534',
    successDarker: '#14532D',
    successDeep: '#1E3A2F',
    successText: '#1F8A5B',
    successLight: '#BBF7D0',
    successLightAlt: '#A7F3D0',
    successBg: '#E7F5EE',
    successBgAlt: '#DCFCE7',
    successBgSoft: '#E7F5EE',
    successBgChat: '#D9FDD3',

    warning: '#9A5B00',
    warningAlt: '#D97706',
    warningStrong: '#B45309',
    warningText: '#92400E',
    warningTextAlt: '#854D0E',
    warningTextStrong: '#854F0B',
    warningTextDark: '#78350F',
    warningLight: '#FED7AA',
    warningLightAlt: '#FDE68A',
    warningLightSoft: '#FEF3C7',
    warningLightSofter: '#FCD34D',
    warningBg: '#FDF1E0',
    warningBgAlt: '#FFFBEB',
    warningBgSoft: '#FEF9F0',
    warningBgIvory: '#FEF9C3',
    warningAmber: '#F59E0B',
    warningAmberStrong: '#A16207',
    warningOrange: '#FBBF24',
    warningOrangeSoft: '#FAEEDA',
    warningOrangePeach: '#F5DEB6',

    danger: '#C2413B',
    dangerHover: '#B91C1C',
    dangerDark: '#991B1B',
    dangerDarker: '#7F1D1D',
    dangerText: '#991B1B',
    dangerLight: '#FECACA',
    dangerLightAlt: '#FCA5A5',
    dangerBg: '#FDECEA',
    dangerBgAlt: '#FEE2E2',
    dangerSoft: '#F87171',
    dangerStrong: '#E5484D',
    dangerCrimson: '#E11D48',
    dangerHotPink: '#F15C6D',

    info: '#3B82F6',
    infoStrong: '#2563EB',
    infoDark: '#1D4ED8',
    infoDarker: '#1E40AF',
    infoLight: '#BFDBFE',
    infoLighter: '#DBEAFE',
    infoBg: '#EFF6FF',
    infoBgAlt: '#E8F0FE',
    infoSky: '#0EA5E9',
    infoSkyStrong: '#0284C7',
    infoSkyDark: '#0369A1',
    infoSkyDarker: '#075985',
    infoSkyBg: '#E0F2FE',
    infoSkyBgSoft: '#F0F9FF',
    infoSkyMid: '#BAE6FD',
    infoBlue: '#60A5FA',
    infoBlueLight: '#93C5FD',
    infoBlueDeepest: '#0066CC',
    infoBlueElectric: '#0099FF',
    infoBluePastel: '#D1E7FF',
    infoCyan: '#0891B2',
    infoCyanBg: '#CFFAFE',
    infoTeal: '#0D9488',
    infoTealLight: '#99F6E4',
    infoTealBg: '#F0FDFA',
  },

  // ── Tipos de agendamento ───────────────────────────────────────────────
  appointment: {
    consulta: { dot: '#5B3FD0', bg: '#EFECFB', text: '#3B2A96', border: '#CFC8F2' },
    retorno:  { dot: '#7C3AED', bg: '#F3EFFD', text: '#5B42B0', border: '#DFD3F5' },
    exame:    { dot: '#8B5CF6', bg: '#F5F3FF', text: '#6D28D9', border: '#DDD6FE' },
    urgencia: { dot: '#DC2626', bg: '#FEE2E2', text: '#991B1B', border: '#FCA5A5' },
  },

  // ── Whatsapp (UI estilo nativo) ───────────────────────────────────────
  whatsapp: {
    green: '#00A884',
    greenLight: '#25D366',
    greenDark: '#075E54',
    greenDeep: '#128C7E',
    greenTeal: '#53BDEB',
    bubble: '#D9FDD3',
    bubbleBorder: '#86EFAC',
    chatBg: '#F0F2F5',
    chatPattern: '#E5DDD5',
    headerBg: '#F0F2F5',
    panelBg: '#F5F6F6',
    border: '#D1D7DB',
    iconHeader: '#54656F',
    iconMuted: '#667781',
    metadata: '#AEBAC1',
    inputBorder: '#E9EDEF',
    listHover: '#F5F6F6',
    dfe: '#DFE5E7',
  },

  // ── Outros / Marcas ────────────────────────────────────────────────────
  external: {
    google: '#4285F4',
    googleAlt: '#34A853',
    googleYellow: '#FBBC05',
    googleRed: '#EA4335',
    facebookGrad1: '#FD5949',
    facebookGrad2: '#D6249F',
    instagramPink: '#DB2777',
    instagramPinkSoft: '#FCE7F3',
    instagramPinkText: '#BE185D',
    pinkAccent: '#EC4899',
    purpleViolet: '#9333EA',
    blueElectric: '#6161FF',
    grayApple: '#1F0000',
  },

  // ── Neutros (escala neutral / zinc) ────────────────────────────────────
  neutral: {
    50: '#F2F2F2',
    100: '#F5F5F5',
    150: '#F0F0F0',
    200: '#E5E5E5',
    300: '#D4D4D4',
    400: '#A3A3A3',
    500: '#737373',
    600: '#525252',
    700: '#404040',
    800: '#262626',
    900: '#0A0A0A',
    zinc500: '#71717A',
    gray100: '#F3F4F6',
    gray200: '#E5E7EB',
    gray300: '#D1D5DB',
    gray400: '#9CA3AF',
    gray500: '#6B7280',
    gray600: '#4B5563',
    gray700: '#374151',
    gray800: '#1F2937',
    gray900: '#111827',
    grayBg: '#F9FAFB',
    grayWhiteSmoke: '#F8F9FA',
    grayPaper: '#F8FAFB',
    grayMist: '#F8FAFC',
    grayChrome: '#C1C9CD',
    purplePastel: '#E0D4FF',
  },

  // ── Misc / accents extras ─────────────────────────────────────────────
  accent: {
    lime: '#84CC16',
    limeStrong: '#65A30D',
    yellow: '#EAB308',
    emerald: '#10B981',
    emeraldMid: '#34D399',
    emeraldBg: '#D1FAE5',
    violet: '#A78BFA',
    violetSoft: '#C4B5FD',
    blueRoyal: '#285AEB',
  },

  // ── Paleta de dados (gráficos, tipos de agendamento, tiles de KPI) ────
  // Use a cor cheia em ícone/linha e `tint(cor, 0.1)` no fundo.
  data: {
    purple: 'oklch(0.56 0.19 285)',
    pink: 'oklch(0.68 0.17 350)',
    green: 'oklch(0.68 0.15 160)',
    orange: 'oklch(0.75 0.14 65)',
    blue: 'oklch(0.64 0.15 245)',
  },

  // ── Superfícies escuras (teleconsulta) ─────────────────────────────────
  night: { 900: '#141318', 800: '#1C1B22', 700: '#2A2833', 600: '#3B3460' },

  font: {
    sans: "var(--font-sans), 'Manrope', system-ui, sans-serif",
    mono: "var(--font-mono), 'JetBrains Mono', ui-monospace, monospace",
  },

  motion: {
    spring: 'cubic-bezier(.3,1.6,.5,1)',
  },

  // ── Radii ──────────────────────────────────────────────────────────────
  radius: {
    sm: 6,
    md: 8,
    lg: 10,
    input: 12,  // inputs, tiles de ícone
    xl: 14,     // menus / popovers
    '2xl': 16,  // cards
    '3xl': 20,  // painéis, modais
    full: 9999,
  },

  // ── Shadows ────────────────────────────────────────────────────────────
  shadow: {
    sm: '0 1px 2px rgba(28,27,34,0.05)',          // item ativo do menu
    md: '0 1px 2px rgba(28,27,34,0.1)',           // segmento ativo
    lg: '0 18px 44px -14px rgba(28,27,34,0.22)',  // popovers / menus
    modal: '0 30px 80px -20px rgba(28,27,34,0.4)',
    card: 'none',                                 // cards: sem sombra em repouso (só borda)
    cardHover: '0 8px 24px -10px rgba(40,30,80,0.2)',
    accent: '0 14px 30px -12px rgba(91,63,208,0.6)', // CTA de gravação
    island: 'none',
    focusRing: '0 0 0 4px rgba(91,63,208,0.1)',
  },
} as const

/** Tint de uma cor oklch da paleta de dados: tint(tokens.data.pink, 0.1) */
export function tint(cor: string, alpha = 0.1) {
  return cor.replace(')', ` / ${alpha})`)
}

// Aliases convenientes para imports menores
export const colors = {
  bg: tokens.bg,
  text: tokens.text,
  brand: tokens.brand,
  status: tokens.status,
  border: tokens.border,
  whatsapp: tokens.whatsapp,
  neutral: tokens.neutral,
  appointment: tokens.appointment,
}

export type Tokens = typeof tokens
