// Candidatos para Momentos (scroll infinito): tarjetas del teléfono que pasan los filtros
// del usuario y aún no se han visto, convertidas en momentos.

import type { Card, CardType, FilterPrefs, Moment } from '../core/types.ts';
import { CARD_TYPES, TOPICS } from '../core/types.ts';
import { THRESHOLDS, findBlockedWord } from '../core/scorer.ts';
import { momentFromCard, timelineMoment, whichFirstMoment } from '../core/moments.ts';
import { videoLanguages } from '../core/video.ts';
import { getFeedPage } from './cards.ts';
import type { SqlDb } from './sql.ts';

/** Momentos › Posts o Momentos › Videos. */
export type MomentMode = 'posts' | 'videos';

const POST_TYPES = CARD_TYPES.filter((t) => t !== 'video');

/** ¿Pasa el momento los filtros del usuario? (mismos umbrales que el feed, con `scoreHook`). */
export function momentAllowed(m: Moment, prefs: FilterPrefs): boolean {
  const max = THRESHOLDS[prefs.level];
  if (!prefs.topics.includes(m.topic) || !prefs.languages.includes(m.lang)) return false;
  if (prefs.hideSensational && m.quality.sensationalism > max) return false;
  if (prefs.hideClickbait && m.quality.clickbait > max) return false;
  return !findBlockedWord(`${m.hook} ${m.payoff}`, prefs.blockedWords);
}

/** Tipos de tarjeta que se vuelven momentos de imagen (`image-fact`). */
const IMAGE_TYPES: CardType[] = ['artwork', 'image'];

/**
 * Filtros de Momentos para videos e imágenes (decisión del 2026-11-19): no dependen de los
 * temas, del nivel ni de "Solo fuentes verificadas" del usuario, que los dejaban casi vacíos.
 * Quedan un piso fijo contra el clickbait evidente (nivel suave, filosofía 6) y las palabras
 * bloqueadas. Idiomas: los del usuario más inglés, donde publican casi todas estas fuentes.
 */
export function visualMomentPrefs(prefs: FilterPrefs): FilterPrefs {
  return {
    ...prefs,
    topics: [...TOPICS],
    languages: videoLanguages(prefs.languages),
    level: 'suave',
    hideSensational: true,
    hideClickbait: true,
    onlyVerified: false,
  };
}

/**
 * Momentos candidatos: tarjetas no vistas (las vistas no se repiten) que no estén ya en
 * pantalla. En "videos", solo clips de 15 a 60 s; en "posts", los de texto con los filtros
 * del usuario, los de imagen con `visualMomentPrefs`, más ganchos calculados con pares de
 * efemérides.
 */
export async function momentCandidates(
  db: SqlDb,
  prefs: FilterPrefs,
  opts: { excludeCardIds?: string[]; now?: Date; limit?: number; mode?: MomentMode } = {},
): Promise<Moment[]> {
  const now = opts.now ?? new Date();
  const limit = opts.limit ?? 60;
  const visual = visualMomentPrefs(prefs);
  const page = (p: FilterPrefs, types: CardType[], n = limit) =>
    getFeedPage(db, p, { limit: n, hideSeen: true, excludeIds: opts.excludeCardIds, types }).then((r) => r.cards);
  const toMoments = (cards: Card[]) => cards.map((c) => momentFromCard(c, now)).filter((m): m is Moment => m !== null);

  if (opts.mode === 'videos') {
    return toMoments(await page(visual, ['video'])).filter((m) => momentAllowed(m, visual));
  }

  const [texts, images] = await Promise.all([
    page(prefs, POST_TYPES.filter((t) => !IMAGE_TYPES.includes(t))),
    page(visual, IMAGE_TYPES, Math.ceil(limit / 2)),
  ]);
  const moments = [
    ...toMoments(texts).filter((m) => momentAllowed(m, prefs)),
    ...toMoments(images).filter((m) => momentAllowed(m, visual)),
  ];
  const events = texts.filter((c) => c.type === 'event' && c.lang === 'es');
  for (let i = 0; i + 1 < events.length; i += 2) {
    const pair = whichFirstMoment(events[i], events[i + 1]) ?? timelineMoment(events[i], events[i + 1], now);
    if (pair && momentAllowed(pair, prefs)) moments.push(pair);
  }
  return moments;
}
