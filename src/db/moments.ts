// Candidatos para Momentos (scroll infinito): tarjetas del teléfono que pasan los filtros
// del usuario y aún no se han visto, convertidas en momentos.

import type { FilterPrefs, Moment } from '../core/types.ts';
import { THRESHOLDS, findBlockedWord } from '../core/scorer.ts';
import { momentFromCard, timelineMoment, whichFirstMoment } from '../core/moments.ts';
import { getFeedPage } from './cards.ts';
import type { SqlDb } from './sql.ts';

/** ¿Pasa el momento los filtros del usuario? (mismos umbrales que el feed, con `scoreHook`). */
export function momentAllowed(m: Moment, prefs: FilterPrefs): boolean {
  const max = THRESHOLDS[prefs.level];
  if (!prefs.topics.includes(m.topic) || !prefs.languages.includes(m.lang)) return false;
  if (prefs.hideSensational && m.quality.sensationalism > max) return false;
  if (prefs.hideClickbait && m.quality.clickbait > max) return false;
  return !findBlockedWord(`${m.hook} ${m.payoff}`, prefs.blockedWords);
}

/**
 * Momentos candidatos: tarjetas no vistas (las vistas no se repiten) que no estén ya en
 * pantalla, más ganchos calculados con pares de efemérides.
 */
export async function momentCandidates(
  db: SqlDb,
  prefs: FilterPrefs,
  opts: { excludeCardIds?: string[]; now?: Date; limit?: number } = {},
): Promise<Moment[]> {
  const now = opts.now ?? new Date();
  const page = await getFeedPage(db, prefs, {
    limit: opts.limit ?? 60,
    hideSeen: true,
    excludeIds: opts.excludeCardIds,
  });
  const cards = page.cards;
  const moments = cards.map((c) => momentFromCard(c, now)).filter((m): m is Moment => m !== null);

  const events = cards.filter((c) => c.type === 'event' && c.lang === 'es');
  for (let i = 0; i + 1 < events.length; i += 2) {
    const pair = whichFirstMoment(events[i], events[i + 1]) ?? timelineMoment(events[i], events[i + 1], now);
    if (pair) moments.push(pair);
  }
  return moments.filter((m) => momentAllowed(m, prefs));
}
