// Tokens de diseño de Curio. Fuente única de verdad para colores, tipografía y forma.
// Estilo "oscuro vibrante" (2026-11-19): fondo casi negro, temas con color sólido y títulos
// sobre la foto. Acento en degradado morado (claro, texto blanco) o lila (oscuro, texto oscuro).
// Explicación y uso por pantalla: docs/DESIGN.md. Contraste verificado ≥ 4.5:1 en todos los pares de texto.

import type { Topic } from '../core/types.ts';

export type ThemeName = 'light' | 'dark';

export interface ColorTokens {
  bg: string;
  card: string;
  soft: string;
  border: string;
  text: string;
  muted: string;
  primary: string;
  primaryText: string;
  onPrimary: string;
  trackOff: string;
  /** Fondo mientras carga una imagen a pantalla completa. */
  image: string;
  /** Degradado del acento (botones, chip activo, selector): texto `onPrimary` encima (≥ 4.5:1). */
  accent: readonly [string, string];
}

export const colors: Record<ThemeName, ColorTokens> = {
  light: {
    bg: '#FFFFFF',
    card: '#FFFFFF',
    soft: '#F3EDFC',
    border: '#E6DCF7',
    text: '#15131D',
    muted: '#5C5869',
    primary: '#6D3FD0',
    primaryText: '#6B4FB8',
    onPrimary: '#FFFFFF',
    trackOff: '#D9CFEA',
    image: '#E9E0FA',
    accent: ['#6D3FD0', '#9D3BC9'],
  },
  dark: {
    bg: '#0C0B12',
    card: '#17151F',
    soft: '#221C30',
    border: '#2D2740',
    text: '#F5F4FA',
    muted: '#A6A3B8',
    primary: '#C3AEF6',
    primaryText: '#C9B6F8',
    onPrimary: '#1A1426',
    trackOff: '#3A3350',
    image: '#17151F',
    accent: ['#C3AEF6', '#E2A9F3'],
  },
};

/**
 * Color por tema: da identidad visual sin competir con el lila (que sigue marcando selección
 * y acción). `fg` es para texto y etiquetas (contraste ≥ 4.5:1 sobre `card` y sobre `bg` del
 * propio tema); `bg` es un tinte suave para fondos (placeholder de imagen, mosaicos sin foto).
 */
export interface TopicColor {
  fg: string;
  bg: string;
  /** Relleno sólido de la etiqueta sobre fotos y del mosaico sin foto; texto blanco (≥ 4.5:1). */
  solid: string;
}

const SOLID: Record<Topic, string> = {
  ciencia: '#0F766E',
  tecnologia: '#1D4ED8',
  arte: '#C2410C',
  cultura: '#A15C07',
  historia: '#8B5A34',
  naturaleza: '#15803D',
  espacio: '#4F46E5',
  musica: '#BE185D',
};
const withSolid = (m: Record<Topic, Omit<TopicColor, 'solid'>>) =>
  Object.fromEntries(Object.entries(m).map(([k, v]) => [k, { ...v, solid: SOLID[k as Topic] }])) as Record<Topic, TopicColor>;

export const topicColors: Record<ThemeName, Record<Topic, TopicColor>> = {
  light: withSolid({
    ciencia: { fg: '#0F766E', bg: '#E3F4F1' },
    tecnologia: { fg: '#1D4ED8', bg: '#E6EDFC' },
    arte: { fg: '#B23A0B', bg: '#FDEBE1' },
    cultura: { fg: '#9A5B06', bg: '#FBF0D9' },
    historia: { fg: '#8B5A34', bg: '#F4EAE1' },
    naturaleza: { fg: '#166534', bg: '#E4F4E8' },
    espacio: { fg: '#4338CA', bg: '#EAE9FB' },
    musica: { fg: '#BE185D', bg: '#FCE7F0' },
  }),
  dark: withSolid({
    ciencia: { fg: '#5EEAD4', bg: '#12302D' },
    tecnologia: { fg: '#93C5FD', bg: '#172345' },
    arte: { fg: '#FDBA74', bg: '#3A2216' },
    cultura: { fg: '#FCD34D', bg: '#382C12' },
    historia: { fg: '#E2BC94', bg: '#33261C' },
    naturaleza: { fg: '#86EFAC', bg: '#14301D' },
    espacio: { fg: '#A5B4FC', bg: '#1F1C48' },
    musica: { fg: '#F9A8D4', bg: '#3A1228' },
  }),
};

export const fonts = {
  heading: { medium: 'SpaceGrotesk_500Medium', semibold: 'SpaceGrotesk_600SemiBold', bold: 'SpaceGrotesk_700Bold' },
  body: { regular: 'Inter_400Regular', medium: 'Inter_500Medium', semibold: 'Inter_600SemiBold' },
} as const;

export const type = {
  logo: { fontFamily: fonts.heading.bold, fontSize: 22, letterSpacing: -0.44 },
  // v2 — momentos
  welcome: { fontFamily: fonts.heading.bold, fontSize: 34, lineHeight: 37, letterSpacing: -0.68 },
  hook: { fontFamily: fonts.heading.semibold, fontSize: 24, lineHeight: 29 },
  hookLarge: { fontFamily: fonts.heading.bold, fontSize: 30, lineHeight: 35 },
  payoff: { fontFamily: fonts.body.regular, fontSize: 15, lineHeight: 22 },
  depthBody: { fontFamily: fonts.body.regular, fontSize: 15, lineHeight: 23 },
  screenTitle: { fontFamily: fonts.heading.bold, fontSize: 22 },
  cardTitleLarge: { fontFamily: fonts.heading.semibold, fontSize: 20, lineHeight: 25 },
  cardTitle: { fontFamily: fonts.heading.semibold, fontSize: 18, lineHeight: 23 },
  body: { fontFamily: fonts.body.regular, fontSize: 14, lineHeight: 20 },
  // Lector: texto largo, más grande y con más aire que en la tarjeta.
  readerTitle: { fontFamily: fonts.heading.bold, fontSize: 26, lineHeight: 32 },
  readerHeading: { fontFamily: fonts.heading.semibold, fontSize: 19, lineHeight: 25 },
  reading: { fontFamily: fonts.body.regular, fontSize: 16, lineHeight: 26 },
  readingQuote: { fontFamily: fonts.body.medium, fontSize: 15, lineHeight: 23 },
  topicLabel: { fontFamily: fonts.body.semibold, fontSize: 11, letterSpacing: 0.88, textTransform: 'uppercase' },
  sectionLabel: { fontFamily: fonts.body.semibold, fontSize: 13, letterSpacing: 0.78, textTransform: 'uppercase' },
  meta: { fontFamily: fonts.body.regular, fontSize: 12 },
  chip: { fontFamily: fonts.body.regular, fontSize: 14 },
  chipActive: { fontFamily: fonts.body.semibold, fontSize: 14 },
  rowTitle: { fontFamily: fonts.body.medium, fontSize: 15 },
  button: { fontFamily: fonts.body.semibold, fontSize: 16 },
  tab: { fontFamily: fonts.body.regular, fontSize: 11 },
  tabActive: { fontFamily: fonts.body.semibold, fontSize: 11 },
} as const;

export const space = {
  screenX: 20,
  feedX: 16,
  cardGap: 16,
  sectionGap: 22,
  chipGap: 8,
  cardPadding: 16,
} as const;

export const radius = {
  sheet: 28,
  card: 20,
  group: 16,
  button: 14,
  input: 14,
  segmented: 14,
  iconButton: 12,
  segment: 10,
  logo: 10,
  pill: 999,
} as const;

export const size = {
  touch: 44,
  chipHeight: 36,
  wordChipHeight: 32,
  buttonHeight: 50,
  inputHeight: 44,
  cardImageHeight: 280,
  momentSheet: 300,
  depthSheet: 640,
  chapterSegments: 10,
  progressBar: 4,
  focusRing: 72,
  choiceHeight: 172,
  switch: { width: 48, height: 28, knob: 22 },
} as const;

export function theme(name: ThemeName) {
  return { name, colors: colors[name], topics: topicColors[name], fonts, type, space, radius, size };
}

export type Theme = ReturnType<typeof theme>;
