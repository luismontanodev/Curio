// Tokens de diseño de Curio. Fuente única de verdad para colores, tipografía y forma.
// Explicación y uso por pantalla: docs/DESIGN.md. Contraste verificado ≥ 4.5:1 en todos los pares de texto.

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
}

export const colors: Record<ThemeName, ColorTokens> = {
  light: {
    bg: '#FFFFFF',
    card: '#FFFFFF',
    soft: '#F3EDFC',
    border: '#E6DCF7',
    text: '#1F1633',
    muted: '#5F5675',
    primary: '#7B5CC6',
    primaryText: '#6B4FB8',
    onPrimary: '#FFFFFF',
    trackOff: '#D9CFEA',
    image: '#E9E0FA',
  },
  dark: {
    bg: '#14101E',
    card: '#1E182D',
    soft: '#2A2140',
    border: '#352B4F',
    text: '#F3EEFC',
    muted: '#B5AACB',
    primary: '#C3AEF6',
    primaryText: '#C9B6F8',
    onPrimary: '#1F1633',
    trackOff: '#463B60',
    image: '#2A2140',
  },
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
  cardImageHeight: 168,
  momentSheet: 300,
  depthSheet: 640,
  chapterSegments: 10,
  progressBar: 4,
  focusRing: 72,
  choiceHeight: 172,
  switch: { width: 48, height: 28, knob: 22 },
} as const;

export function theme(name: ThemeName) {
  return { name, colors: colors[name], fonts, type, space, radius, size };
}

export type Theme = ReturnType<typeof theme>;
