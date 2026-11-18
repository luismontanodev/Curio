// Scorer anti-sensacionalismo basado en reglas.
// Corre al ingerir (score base) y el feed solo compara contra el umbral del usuario.
// Si cambias reglas o pesos, sube SCORER_VERSION y recalcula las tarjetas viejas.

import type {
  Card,
  FilterLevel,
  FilterPrefs,
  QualityScore,
  RawCard,
  Signal,
  SourceKind,
} from './types.ts';

export const SCORER_VERSION = 1;

/** Máximo de puntos permitidos por categoría según el nivel elegido. */
export const THRESHOLDS: Record<FilterLevel, number> = {
  suave: 6,
  moderado: 4,
  estricto: 2.5,
};

/** Las fuentes curadas casi nunca hacen clickbait: sus puntos pesan menos. */
export const SOURCE_TRUST: Record<SourceKind, number> = {
  museum: 0.5,
  encyclopedia: 0.5,
  journal: 0.7,
  magazine: 1,
  news: 1.2,
};

/** Siglas legítimas que no cuentan como "gritar". */
const ACRONYMS = new Set([
  'NASA', 'ESA', 'ADN', 'ARN', 'DNA', 'RNA', 'ONU', 'UNESCO', 'UNAM', 'IPN',
  'CERN', 'MOMA', 'INAH', 'OMS', 'WHO', 'USA', 'EEUU', 'URSS', 'COVID', 'JWST',
]);

// Frases en forma normalizada (minúsculas, sin acentos).
const CLICKBAIT_PHRASES = [
  'no creeras', 'no vas a creer', 'te sorprendera', 'te dejara sin palabras',
  'lo que paso despues', 'esto es lo que', 'nadie te dice', 'nadie habla de',
  'la razon te', 'que no sabias', 'que nadie sabe', 'tienes que ver', 'antes de que lo borren',
  'you wont believe', 'what happened next', 'this is why',
  'will blow your mind', 'nobody tells you',
];

const EMOTIONAL_WORDS = [
  'impactante', 'escandalo', 'escandaloso', 'terrible', 'brutal', 'alarmante',
  'polemica', 'destroza', 'humilla', 'explota', 'arrasa', 'viral', 'urgente',
  'ultima hora', 'aterrador', 'devastador', 'increible', 'shocking', 'outrage',
  'slams', 'destroys', 'insane', 'terrifying', 'breaking',
];

const SUPERLATIVES = [
  'el mejor', 'la mejor', 'el peor', 'la peor', 'jamas visto', 'nunca antes',
  'de la historia', 'para siempre', 'the best ever', 'the worst ever',
];

const LISTICLE =
  /^\s*\d{1,3}\s+(cosas|razones|datos|formas|secretos|trucos|senales|errores|things|reasons|facts|ways|secrets|tricks|signs)\b/;

const EMOJI = /\p{Extended_Pictographic}/u;

/** Minúsculas y sin acentos, para comparar frases sin importar cómo se escriban. */
export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/['’‘`´]/g, '') // "won’t" y "won't" → "wont"
    .replace(/\s+/g, ' ')
    .trim();
}

function containsPhrase(normalized: string, phrase: string): boolean {
  // Límites de palabra para que "viral" no coincida dentro de "antiviral".
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}($|[^\\p{L}\\p{N}])`, 'u').test(normalized);
}

/** Detecta señales en un título. Puro y sin efectos: fácil de probar. */
export function detectSignals(title: string): Signal[] {
  const signals: Signal[] = [];
  const norm = normalize(title);

  // --- Sensacionalismo ---------------------------------------------------
  const words = title.match(/\p{L}{3,}/gu) ?? [];
  const shouting = words.filter(
    (w) => w.length >= 4 && w === w.toUpperCase() && w !== w.toLowerCase() && !ACRONYMS.has(w),
  );
  if (words.length > 0 && shouting.length / words.length >= 0.3) {
    signals.push({ id: 'caps-ratio', category: 'sensationalism', points: 3 });
  } else if (shouting.length > 0) {
    signals.push({
      id: 'caps-words',
      category: 'sensationalism',
      points: Math.min(shouting.length, 2),
    });
  }

  const bangs = (title.match(/[!¡]/g) ?? []).length;
  if (bangs > 0) {
    signals.push({ id: 'exclamation', category: 'sensationalism', points: Math.min(bangs * 2, 4) });
  }

  for (const w of EMOTIONAL_WORDS) {
    if (containsPhrase(norm, w)) {
      signals.push({ id: `emotional:${w}`, category: 'sensationalism', points: 1.5 });
    }
  }

  for (const s of SUPERLATIVES) {
    if (containsPhrase(norm, s)) {
      signals.push({ id: `superlative:${s}`, category: 'sensationalism', points: 1 });
    }
  }

  if (EMOJI.test(title)) {
    signals.push({ id: 'emoji', category: 'sensationalism', points: 1 });
  }

  // --- Clickbait ---------------------------------------------------------
  for (const p of CLICKBAIT_PHRASES) {
    if (containsPhrase(norm, normalize(p))) {
      signals.push({ id: `phrase:${p}`, category: 'clickbait', points: 3 });
    }
  }

  if (LISTICLE.test(norm)) {
    signals.push({ id: 'listicle', category: 'clickbait', points: 2 });
  }

  // Una pregunta puede ser legítima ("¿Por qué el cielo es azul?"), por eso pesa poco.
  if (/[?¿]/.test(title)) {
    signals.push({ id: 'question', category: 'clickbait', points: 1.5 });
  }

  // "Esto", "este truco"… sin decir qué es: gancho de curiosidad.
  if (/^(esto|este|esta|asi|this|these)\b/.test(norm)) {
    signals.push({ id: 'vague-opener', category: 'clickbait', points: 1.5 });
  }

  return signals;
}

/** Score base que se guarda con la tarjeta al ingerirla. */
export function scoreCard(card: Pick<RawCard, 'title'>, sourceKind: SourceKind): QualityScore {
  const signals = detectSignals(card.title);
  const trust = SOURCE_TRUST[sourceKind];
  const sum = (cat: Signal['category']) =>
    signals.filter((s) => s.category === cat).reduce((acc, s) => acc + s.points, 0);

  return {
    sensationalism: round(sum('sensationalism') * trust),
    clickbait: round(sum('clickbait') * trust),
    signals,
    scorerVersion: SCORER_VERSION,
  };
}

export function withQuality(raw: RawCard, sourceKind: SourceKind, now = new Date()): Card {
  return { ...raw, ingestedAt: now.toISOString(), quality: scoreCard(raw, sourceKind) };
}

export type Verdict =
  | { show: true }
  | { show: false; reason: 'topic' | 'unverified' | 'sensational' | 'clickbait' | 'blocked-word'; detail?: string };

/**
 * Decide si una tarjeta se muestra con las preferencias del usuario.
 * El feed SQL ya aplica tema, fuente y umbrales; esto se usa en memoria
 * (tests, caché, previsualizar el efecto del filtro) y para las palabras bloqueadas.
 */
export function evaluate(card: Card, sourceKind: SourceKind, prefs: FilterPrefs): Verdict {
  if (!prefs.topics.includes(card.topic)) return { show: false, reason: 'topic' };
  if (prefs.onlyVerified && sourceKind === 'news') return { show: false, reason: 'unverified' };

  const max = THRESHOLDS[prefs.level];
  if (prefs.hideSensational && card.quality.sensationalism > max) {
    return { show: false, reason: 'sensational', detail: String(card.quality.sensationalism) };
  }
  if (prefs.hideClickbait && card.quality.clickbait > max) {
    return { show: false, reason: 'clickbait', detail: String(card.quality.clickbait) };
  }

  const hit = findBlockedWord(`${card.title} ${card.summary ?? ''}`, prefs.blockedWords);
  if (hit) return { show: false, reason: 'blocked-word', detail: hit };

  return { show: true };
}

export function findBlockedWord(text: string, blocked: string[]): string | undefined {
  const norm = normalize(text);
  return blocked.find((w) => {
    const b = normalize(w);
    return b.length > 0 && containsPhrase(norm, b);
  });
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
