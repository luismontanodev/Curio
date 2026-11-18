// Esquema de dominio de Curio.
// Todo lo que llega de una API externa se normaliza a `Card` antes de guardarse.

export type Topic =
  | 'ciencia'
  | 'arte'
  | 'cultura'
  | 'historia'
  | 'naturaleza'
  | 'espacio'
  | 'musica'
  | 'tecnologia';

/** Idiomas de contenido que la app sabe pedir a sus fuentes. La interfaz sigue en español. */
export type Lang = 'es' | 'en' | 'fr' | 'pt';

/**
 * Texto completo para leer dentro de la app. Solo bloques simples: sin HTML ni enlaces,
 * para que se pinte con componentes nativos y nada lleve fuera de la app.
 */
export type ContentBlock =
  | { kind: 'p' | 'h' | 'quote'; text: string }
  | { kind: 'img'; src: string; caption?: string };

export type CardType = 'artwork' | 'article' | 'event' | 'image' | 'paper';

/** Qué tan confiable es el tipo de fuente. Determina el multiplicador del score. */
export type SourceKind = 'museum' | 'encyclopedia' | 'journal' | 'magazine' | 'news';

export interface Source {
  id: string; // 'met', 'wikipedia-es', 'nasa-apod'…
  name: string; // texto que se muestra en la tarjeta: "The Met"
  kind: SourceKind;
  license?: string; // licencia por defecto de la fuente
}

/** Categoría de una señal: el usuario puede apagar cada una por separado. */
export type SignalCategory = 'sensationalism' | 'clickbait' | 'blocked';

export interface Signal {
  id: string; // 'caps-ratio', 'exclamation', 'phrase:no creeras'…
  category: SignalCategory;
  points: number;
}

export interface QualityScore {
  /** Puntos de sensacionalismo ya multiplicados por la confianza de la fuente. */
  sensationalism: number;
  /** Puntos de clickbait ya multiplicados por la confianza de la fuente. */
  clickbait: number;
  signals: Signal[];
  scorerVersion: number;
}

export interface Card {
  id: string; // `${sourceId}:${externalId}`, estable para deduplicar
  sourceId: string;
  externalId: string;
  type: CardType;
  topic: Topic;
  lang: Lang;
  title: string;
  summary?: string;
  imageUrl?: string;
  url: string; // original: se muestra como atribución; la lectura ocurre dentro de la app
  /** Texto completo cuando la fuente lo entrega y su licencia permite mostrarlo (p. ej. The Conversation). */
  body?: ContentBlock[];
  license?: string;
  readMinutes?: number;
  publishedAt?: string; // ISO 8601
  ingestedAt: string; // ISO 8601
  quality: QualityScore;
}

/** Card antes de pasar por el scorer (lo que devuelve un normalizador). */
export type RawCard = Omit<Card, 'quality' | 'ingestedAt'>;

export type FilterLevel = 'suave' | 'moderado' | 'estricto';

/** Preferencias de la pantalla de Filtros. */
export interface FilterPrefs {
  topics: Topic[];
  level: FilterLevel;
  hideSensational: boolean; // "Ocultar títulos sensacionalistas"
  hideClickbait: boolean; // "Ocultar clickbait"
  onlyVerified: boolean; // "Solo fuentes verificadas" (excluye 'news')
  blockedWords: string[]; // "Palabras bloqueadas"
  languages: Lang[]; // "Idiomas del contenido": solo se muestran tarjetas en estos idiomas
}

/** Todo lo que el usuario configura. Vive en su teléfono y viaja en su respaldo JSON. */
export interface AppPrefs extends FilterPrefs {
  pauseEvery: number | null; // "Pausa sugerida": cada N tarjetas, null = apagado
  theme: ThemePref; // tema de la interfaz; 'system' sigue al teléfono
}

export type ThemePref = 'system' | 'light' | 'dark';

export const TOPICS: readonly Topic[] = [
  'ciencia', 'tecnologia', 'arte', 'cultura', 'historia', 'naturaleza', 'espacio', 'musica',
];
export const LANGS: readonly Lang[] = ['es', 'en', 'fr', 'pt'];
export const CARD_TYPES: readonly CardType[] = ['artwork', 'article', 'event', 'image', 'paper'];
export const FILTER_LEVELS: readonly FilterLevel[] = ['suave', 'moderado', 'estricto'];
export const THEME_PREFS: readonly ThemePref[] = ['system', 'light', 'dark'];
