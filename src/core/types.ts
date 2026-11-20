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

export type CardType = 'artwork' | 'article' | 'event' | 'image' | 'paper' | 'video';

/** Formatos de video que la app reproduce en iOS y Android (MP4 H.264 y MPEG-4 en QuickTime). */
export type VideoMime = 'video/mp4' | 'video/quicktime';

/** Video corto de una tarjeta. `url` es la variante más ligera que da la fuente; el póster va en `imageUrl`. */
export interface VideoInfo {
  url: string;
  mime: VideoMime;
  durationSec: number;
  width?: number;
  height?: number;
}

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
  /** Video (tarjetas `type: 'video'`): el póster es `imageUrl`. */
  video?: VideoInfo;
  /** Autor o crédito de la obra/video, para la atribución. */
  credit?: string;
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
  /**
   * "Ahorro de datos": videos solo al tocar, imágenes más pequeñas y sin precarga.
   * 'cellular' (por defecto) lo activa solo con datos móviles; 'always' y 'off' no miran la red.
   */
  dataSaver: DataSaverMode;
}

export type DataSaverMode = 'off' | 'cellular' | 'always';
export const DATA_SAVER_MODES: readonly DataSaverMode[] = ['off', 'cellular', 'always'];

export type ThemePref = 'system' | 'light' | 'dark';

export const TOPICS: readonly Topic[] = [
  'ciencia', 'tecnologia', 'arte', 'cultura', 'historia', 'naturaleza', 'espacio', 'musica',
];
export const LANGS: readonly Lang[] = ['es', 'en', 'fr', 'pt'];
export const CARD_TYPES: readonly CardType[] = ['artwork', 'article', 'event', 'image', 'paper', 'video'];
export const FILTER_LEVELS: readonly FilterLevel[] = ['suave', 'moderado', 'estricto'];
export const THEME_PREFS: readonly ThemePref[] = ['system', 'light', 'dark'];

// --- v2: momentos (docs/PRODUCTO.md) -------------------------------------------

export type MomentFormat = 'image-fact' | 'detail-zoom' | 'which-first' | 'timeline' | 'text-fact' | 'sound' | 'event' | 'video';
export const MOMENT_FORMATS: readonly MomentFormat[] = [
  'image-fact', 'detail-zoom', 'which-first', 'timeline', 'text-fact', 'sound', 'event', 'video',
];

/** De dónde sale el gancho: calculado de los datos, curado a mano o el título de la fuente. */
export type HookOrigin = 'computed' | 'curated' | 'source';
export const HOOK_ORIGINS: readonly HookOrigin[] = ['computed', 'curated', 'source'];

export interface MomentSource {
  sourceId: string;
  url: string;
  license?: string;
}

/**
 * Un momento: un visual, un gancho honesto y su payoff en la misma pantalla.
 * Todo gancho debe sostenerse con `sources` (filosofía 6).
 */
export interface Moment {
  id: string;
  format: MomentFormat;
  topic: Topic;
  lang: Lang;
  hook: string; // ≤ ~90 caracteres
  payoff: string; // cierra la duda del gancho; nunca vacío
  hookOrigin: HookOrigin;
  /** Etiqueta corta sobre el gancho ("La gran ola de Kanagawa"). */
  label?: string;
  depth?: { short?: string };
  media?: {
    imageUrl?: string; // en videos, el póster
    focus?: { x: number; y: number; r: number };
    videoUrl?: string;
    durationSec?: number;
    mimeType?: VideoMime;
  };
  /** Autor o crédito (atribución). */
  credit?: string;
  choices?: { label: string; detail: string; correct: boolean }[]; // which-first
  timeline?: { label: string; year: number; note?: string }[]; // años negativos = a. C.
  sources: MomentSource[]; // al menos una
  /** Tarjeta de origen: guardar, leer más y "visto" se resuelven con ella. */
  cardId?: string;
  quality: QualityScore;
}
