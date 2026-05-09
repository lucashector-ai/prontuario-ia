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
    page: '#FFFFFF',           // fundo das paginas (branco - cards usam border)
    card: '#FFFFFF',           // fundo de cards / superfícies elevadas
    cardSubtle: '#FAFAFA',     // cards aninhados / itens em listas (cinza muito leve)
    hover: '#F5F5F5',          // hover de items clicáveis
    hoverStrong: '#F3F4F6',    // hover mais marcante
    overlay: 'rgba(0,0,0,0.4)',// modais / overlays
    muted: '#F9FAFB',          // áreas neutras (tabelas, sub-headers)
    chatPattern: '#E5DDD5',    // fundo padrão whatsapp (chat)
    chatBg: '#F0F2F5',         // fundo lista de chats
  },

  // ── Borders ────────────────────────────────────────────────────────────
  border: {
    default: '#E5E7EB',        // border padrão (inputs, cards)
    subtle: '#F3F4F6',         // separadores leves
    strong: '#D1D5DB',         // borders mais marcantes
    muted: '#E5E5E5',          // border alternativa neutra
    focus: '#6043C1',          // border de foco (alinhada à brand)
    chat: '#D1D7DB',           // bordas em UI estilo whatsapp
    chatStrong: '#54656F',     // ícones/headers chat
  },

  // ── Text ───────────────────────────────────────────────────────────────
  text: {
    primary: '#111827',        // texto principal
    secondary: '#6B7280',      // texto secundário / labels
    tertiary: '#9CA3AF',       // placeholder, texto auxiliar
    quaternary: '#737373',     // metadados muito leves
    inverse: '#FFFFFF',        // texto sobre fundos coloridos
    muted: '#525252',          // textos médios alternativos
    strong: '#374151',         // textos enfáticos não-primary
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
    primary: '#6043C1',        // roxo principal
    primaryHover: '#4C2F9F',   // hover do botão
    primaryDark: '#4C1D95',    // tons mais escuros
    primaryDarker: '#3C3489',
    primaryDeep: '#1E1344',
    primaryLight: '#F0EBFF',   // bg leve (badges, hover suave)
    primaryLighter: '#EDE9FB', // bg de chips/cards do roxo
    primarySubtle: '#F3EEFB',  // bg ainda mais leve
    primaryAccent: '#B9A9EF',  // bordas/accents do roxo
    primaryAccentSoft: '#D4C9F7',
    primaryAccentLight: '#DDD3F7',
    primarySoftBg: '#FAF8FF',
    primaryDarkText: '#5B42B0',
    legacyGreenDark: '#176F44', // valor herdado de variável CSS antiga
  },

  // ── Status (semântico) ─────────────────────────────────────────────────
  status: {
    success: '#16A34A',
    successHover: '#15803D',
    successDark: '#166534',
    successDarker: '#14532D',
    successDeep: '#1E3A2F',
    successText: '#065F46',
    successLight: '#BBF7D0',
    successLightAlt: '#A7F3D0',
    successBg: '#F0FDF4',
    successBgAlt: '#DCFCE7',
    successBgSoft: '#ECFDF5',
    successBgChat: '#D9FDD3',

    warning: '#EA580C',
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
    warningBg: '#FFF7ED',
    warningBgAlt: '#FFFBEB',
    warningBgSoft: '#FEF9F0',
    warningBgIvory: '#FEF9C3',
    warningAmber: '#F59E0B',
    warningAmberStrong: '#A16207',
    warningOrange: '#FBBF24',
    warningOrangeSoft: '#FAEEDA',
    warningOrangePeach: '#F5DEB6',

    danger: '#DC2626',
    dangerHover: '#B91C1C',
    dangerDark: '#991B1B',
    dangerDarker: '#7F1D1D',
    dangerText: '#991B1B',
    dangerLight: '#FECACA',
    dangerLightAlt: '#FCA5A5',
    dangerBg: '#FEF2F2',
    dangerBgAlt: '#FEE2E2',
    dangerSoft: '#F87171',
    dangerStrong: '#EF4444',
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
    consulta: { dot: '#6043C1', bg: '#EDE9FB', text: '#4C1D95', border: '#B9A9EF' },
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

  // ── Radii ──────────────────────────────────────────────────────────────
  radius: {
    sm: 6,
    md: 8,
    lg: 10,
    xl: 14,
    '2xl': 16,
    '3xl': 20,
    full: 9999,
  },

  // ── Shadows ────────────────────────────────────────────────────────────
  shadow: {
    sm: '0 1px 2px rgba(0,0,0,0.04)',
    md: '0 1px 3px rgba(0,0,0,0.06)',
    lg: '0 4px 12px rgba(0,0,0,0.08)',
    card: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
    island: '0 1px 3px rgba(0,0,0,0.04)',
  },
} as const

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
