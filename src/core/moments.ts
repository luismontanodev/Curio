// Momentos (v2, docs/PRODUCTO.md). Puro y sin dependencias.
// - Convierte las tarjetas que ya trae la ingesta en momentos (image-fact, text-fact, event).
// - Calcula ganchos honestos por construcción (which-first, timeline) a partir de fechas.
// - Mezcla lotes para el scroll infinito sin más de 2 seguidos del mismo formato o fuente.

import type { Card, Moment, MomentFormat, MomentSource } from './types.ts';
import { scoreHook } from './scorer.ts';
import { sourceKindOf } from './sources.ts';
import { isMomentLength } from './video.ts';

/** Ganchos calculados o curados: una línea corta (~90). */
export const HOOK_MAX = 90;
/** Títulos de la fuente: se respetan enteros mientras quepan en la hoja (4 líneas). */
export const SOURCE_HOOK_MAX = 120;
export const PAYOFF_MAX = 220;
/** Momentos por lote del scroll infinito. */
export const BATCH_SIZE = 12;
/** Formatos que la app ya sabe pintar. El resto se calcula y prueba, pero no entra a Momentos. */
export const RENDERED_FORMATS: readonly MomentFormat[] = ['image-fact', 'text-fact', 'event'];
/** Momentos › Videos: solo clips de 15 a 60 s. */
export const VIDEO_FORMATS: readonly MomentFormat[] = ['video'];

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];


// --- Texto ------------------------------------------------------------------

/** Recorta en un límite de palabra y agrega "…" si hizo falta. */
export function clipWords(text: string, max: number): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[,;:.\s]+$/, '')}…`;
}

/** El resumen completo si cabe; si no, su primera oración (o lo que quepa). */
export function payoffFrom(text: string | undefined, max = PAYOFF_MAX): string {
  if (!text) return '';
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length <= max ? t : firstSentence(t, max);
}

/** Primera oración (o lo que quepa) de un resumen. */
export function firstSentence(text: string | undefined, max = PAYOFF_MAX): string {
  if (!text) return '';
  const t = text.replace(/\s+/g, ' ').trim();
  // Un punto seguido de espacio y mayúscula cierra la oración; "c. 1830" o "S. XIX" no.
  const m = /^(.{20,}?[.!?])\s+(?=[A-ZÁÉÍÓÚÑ¿¡«"])/.exec(t);
  return clipWords(m ? m[1] : t, max);
}

/** "1869: Se inaugura…" → 1869. Años negativos = a. C. */
export function eventYear(card: Pick<Card, 'title'>): number | null {
  const m = /^(-?\d{1,4}):\s/.exec(card.title);
  return m ? Number(m[1]) : null;
}

/** El hecho de una efeméride sin el año: "Se inaugura oficialmente el canal de Suez, …". */
export function eventText(card: Pick<Card, 'title'>): string {
  return card.title.replace(/^-?\d{1,4}:\s*/, '').trim();
}

/**
 * Etiqueta corta y honesta de una efeméride: la primera cláusula del propio hecho
 * ("Se inaugura oficialmente el canal de Suez"), no el título de la página enlazada,
 * que a veces es otra cosa (p. ej. "María I" para "muere María I y la sucede Isabel I").
 */
export function eventLabel(card: Pick<Card, 'title'>, max = 70): string {
  const text = eventText(card);
  const clause = /^(.{15,}?)[,;:(]/.exec(text)?.[1] ?? text;
  return clipWords(clause.replace(/\.$/, ''), max);
}

export function formatYear(year: number): string {
  return year <= 0 ? `${1 - year} a. C.` : String(year);
}

/** "en 1869", "en el año 9", "en el año 44 a. C.": años cortos piden "el año". */
export function inYear(year: number): string {
  return year > 0 && year >= 1000 ? `en ${year}` : `en el año ${formatYear(year)}`;
}

/** Años transcurridos entre dos años (sin año 0: de 1 a. C. a 1 d. C. pasa 1 año). */
export function yearsBetween(from: number, to: number): number {
  return to - from - (from <= 0 && to > 0 ? 1 : 0);
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

// --- Tarjeta → momento -----------------------------------------------------

function sourcesOf(card: Card): MomentSource[] {
  return [{ sourceId: card.sourceId, url: card.url, ...(card.license ? { license: card.license } : {}) }];
}

function finish(m: Omit<Moment, 'quality'>): Moment | null {
  if (!m.hook.trim() || !m.payoff.trim() || m.sources.length === 0) return null;
  const kind = m.hookOrigin === 'source' ? sourceKindOf(m.sources[0].sourceId) : 'encyclopedia';
  return { ...m, quality: scoreHook(m.hook, m.payoff, kind) };
}

/**
 * Convierte una tarjeta de la ingesta en momento. El gancho es el título de la fuente
 * (`hookOrigin: 'source'`) y el payoff, la primera oración de su resumen; en efemérides en
 * español el payoff se calcula de la fecha. Sin payoff no hay momento (filosofía 6).
 */
export function momentFromCard(card: Card, now = new Date()): Moment | null {
  const base = {
    id: `m:${card.id}`,
    topic: card.topic,
    lang: card.lang,
    sources: sourcesOf(card),
    cardId: card.id,
    // Sin claves `undefined`: el momento se guarda como JSON y debe volver idéntico.
    ...(card.summary ? { depth: { short: card.summary } } : {}),
    ...(card.imageUrl ? { media: { imageUrl: card.imageUrl } } : {}),
  };

  if (card.type === 'video') {
    // Solo clips de 15 a 60 s con duración conocida; lo demás no es momento principal.
    if (!card.video || !isMomentLength(card.video.durationSec)) return null;
    return finish({
      ...base,
      format: 'video',
      hook: clipWords(card.title, SOURCE_HOOK_MAX),
      payoff: payoffFrom(card.summary),
      hookOrigin: 'source',
      media: {
        ...(card.imageUrl ? { imageUrl: card.imageUrl } : {}),
        videoUrl: card.video.url,
        durationSec: card.video.durationSec,
        mimeType: card.video.mime,
      },
      ...(card.credit ? { credit: card.credit } : {}),
    });
  }

  if (card.type === 'event') {
    const year = eventYear(card);
    if (year === null) return null;
    const ago = yearsBetween(year, now.getFullYear());
    const day = /^otd:(\d{2})(\d{2}):/.exec(card.externalId);
    const when = day ? `un ${Number(day[2])} de ${MONTHS[Number(day[1]) - 1]} de ${formatYear(year)}` : `en ${formatYear(year)}`;
    const payoff =
      card.lang === 'es'
        ? `Pasó ${when}: hace ${plural(ago, 'año', 'años')}.`
        : payoffFrom(card.summary) || formatYear(year);
    return finish({
      ...base,
      format: 'event',
      hook: clipWords(eventText(card), SOURCE_HOOK_MAX),
      payoff,
      hookOrigin: 'source',
    });
  }

  if ((card.type === 'artwork' || card.type === 'image') && card.imageUrl) {
    return finish({
      ...base,
      format: 'image-fact',
      hook: clipWords(card.title, SOURCE_HOOK_MAX),
      payoff: payoffFrom(card.summary),
      hookOrigin: 'source',
    });
  }

  if (card.type === 'article' || card.type === 'paper') {
    return finish({
      ...base,
      format: 'text-fact',
      hook: clipWords(card.title, SOURCE_HOOK_MAX),
      payoff: payoffFrom(card.summary),
      hookOrigin: 'source',
    });
  }
  return null;
}

// --- Ganchos calculados (honestos por construcción) ------------------------

type Dated = { card: Card; year: number; label: string };

function dated(card: Card): Dated | null {
  if (card.type !== 'event' || card.lang !== 'es') return null; // las frases calculadas están en español
  const year = eventYear(card);
  return year === null ? null : { card, year, label: eventLabel(card) };
}

/**
 * "¿Qué ocurrió primero?" con dos efemérides. Exige al menos 10 años de diferencia para
 * que la pregunta tenga respuesta clara; las opciones se dan en el orden recibido.
 */
export function whichFirstMoment(a: Card, b: Card): Moment | null {
  const x = dated(a);
  const y = dated(b);
  if (!x || !y || x.label === y.label || Math.abs(x.year - y.year) < 10) return null;
  const [first, second] = x.year < y.year ? [x, y] : [y, x];
  const gap = yearsBetween(first.year, second.year);
  return finish({
    id: `wf:${a.id}|${b.id}`,
    format: 'which-first',
    topic: 'historia',
    lang: 'es',
    hook: '¿Qué ocurrió primero?',
    payoff: clipWords(`«${first.label}» fue ${inYear(first.year)}, ${plural(gap, 'año', 'años')} antes.`, PAYOFF_MAX),
    hookOrigin: 'computed',
    choices: [x, y].map((d) => ({ label: d.label, detail: formatYear(d.year), correct: d === first })),
    sources: [...sourcesOf(a), ...sourcesOf(b)],
  });
}

/**
 * Patrón "Cleopatra": entre dos hechos pasó más tiempo que del segundo a hoy.
 * Solo se publica si es cierto (y por un margen claro: al menos 1.5 veces).
 */
export function timelineMoment(a: Card, b: Card, now = new Date()): Moment | null {
  const x = dated(a);
  const y = dated(b);
  if (!x || !y || x.year === y.year || x.label === y.label) return null;
  const [older, newer] = x.year < y.year ? [x, y] : [y, x];
  const thisYear = now.getFullYear();
  const between = yearsBetween(older.year, newer.year);
  const toNow = yearsBetween(newer.year, thisYear);
  if (toNow <= 0 || between < toNow * 1.5) return null;
  return finish({
    id: `tl:${older.card.id}|${newer.card.id}`,
    format: 'timeline',
    topic: 'historia',
    lang: 'es',
    hook: 'Entre estos dos hechos pasó más tiempo que del segundo a hoy.',
    payoff: `De uno a otro: ${plural(between, 'año', 'años')}. Del segundo a hoy: ${plural(toNow, 'año', 'años')}.`,
    hookOrigin: 'computed',
    timeline: [
      { label: older.label, year: older.year },
      { label: newer.label, year: newer.year },
      { label: 'Hoy', year: thisYear },
    ],
    sources: [...sourcesOf(older.card), ...sourcesOf(newer.card)],
  });
}

// --- Mezcla con variedad --------------------------------------------------

const sourceKey = (m: Moment) => (m.hookOrigin === 'computed' ? 'computed' : m.sources[0]?.sourceId ?? '');

/**
 * ¿Agregar `next` haría 3 seguidos del mismo formato o de la misma fuente? El formato solo
 * cuenta si hay más de uno posible: en Momentos › Videos todos son `video`.
 */
function breaksMix(seq: Moment[], next: Moment, checkFormat: boolean): boolean {
  if (seq.length < 2) return false;
  const [p, q] = seq.slice(-2);
  const sameFormat = checkFormat && p.format === next.format && q.format === next.format;
  const sameSource = sourceKey(p) === sourceKey(next) && sourceKey(q) === sourceKey(next);
  return sameFormat || sameSource;
}

export interface MixOptions {
  size?: number;
  rng?: () => number;
  /** Formatos permitidos (por defecto, los que la app ya pinta). */
  formats?: readonly MomentFormat[];
  /** Últimos momentos ya mostrados: la regla de variedad sigue a través de los lotes. */
  after?: Moment[];
  /**
   * `true` (por defecto): si nada respeta la variedad, el lote queda más corto. `false`
   * (Videos, donde casi todo viene de NASA): la variedad se prefiere, pero no deja la pantalla vacía.
   */
  strict?: boolean;
}

/**
 * Elige hasta `size` momentos al azar, sin más de 2 seguidos del mismo formato ni de la
 * misma fuente. Si ya no hay candidatos que respeten la regla, el lote queda más corto:
 * la variedad no se sacrifica para llenar.
 */
export function mixMoments(pool: Moment[], opts: MixOptions = {}): Moment[] {
  const size = opts.size ?? BATCH_SIZE;
  const rng = opts.rng ?? Math.random;
  const formats = opts.formats ?? RENDERED_FORMATS;
  const rest = pool.filter((m) => formats.includes(m.format));
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  const tail = (opts.after ?? []).slice(-2);
  const out: Moment[] = [];
  const used = new Set<string>();
  const checkFormat = formats.length > 1;
  const strict = opts.strict ?? true;
  while (out.length < size) {
    let k = rest.findIndex((m) => !used.has(m.id) && !breaksMix([...tail, ...out], m, checkFormat));
    if (k < 0 && !strict) k = rest.findIndex((m) => !used.has(m.id));
    if (k < 0) break;
    used.add(rest[k].id);
    out.push(rest[k]);
  }
  return out;
}
