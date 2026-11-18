// Recomendación para Explorar: local, transparente y por intención (docs/PRODUCTO.md).
// Solo usa lo que el usuario eligió a propósito (lo que guardó) y la frescura; nunca tiempo
// de visualización ni popularidad. Cada recomendación dice por qué aparece.

import type { Card, Topic } from './types.ts';

export interface Affinity {
  topics: Map<Topic, number>;
  sources: Map<string, number>;
  total: number;
}

export type Reason =
  | { kind: 'topic'; topic: Topic }
  | { kind: 'source'; sourceId: string }
  | { kind: 'new' };

export interface Recommendation {
  card: Card;
  score: number;
  reason: Reason;
}

/** Afinidad a partir de lo guardado: qué temas y fuentes eligió conservar. */
export function affinityFrom(saved: Pick<Card, 'topic' | 'sourceId'>[]): Affinity {
  const topics = new Map<Topic, number>();
  const sources = new Map<string, number>();
  for (const c of saved) {
    topics.set(c.topic, (topics.get(c.topic) ?? 0) + 1);
    sources.set(c.sourceId, (sources.get(c.sourceId) ?? 0) + 1);
  }
  return { topics, sources, total: saved.length };
}

const DAY = 24 * 60 * 60 * 1000;

/**
 * Puntaje de 0 a ~2: base + afinidad por tema (peso 1) + afinidad por fuente (0.4)
 * + frescura (0.3, se reduce a la mitad cada ~10 días) + imagen (0.1, Explorar es visual)
 * − calidad (puntos de sensacionalismo o clickbait restan un poco, aunque pasen el filtro).
 */
export function scoreFor(card: Card, aff: Affinity, now = new Date()): { score: number; reason: Reason } {
  const topicShare = aff.total ? (aff.topics.get(card.topic) ?? 0) / aff.total : 0;
  const sourceShare = aff.total ? (aff.sources.get(card.sourceId) ?? 0) / aff.total : 0;
  const ageDays = Math.max(0, (now.getTime() - Date.parse(card.ingestedAt)) / DAY);
  const fresh = Number.isFinite(ageDays) ? Math.exp(-ageDays / 14) : 0;
  const quality = Math.min(1, (card.quality.sensationalism + card.quality.clickbait) / 5);

  const score = 0.2 + topicShare + 0.4 * sourceShare + 0.3 * fresh + (card.imageUrl ? 0.1 : 0) - 0.2 * quality;

  const reason: Reason =
    topicShare >= 0.2
      ? { kind: 'topic', topic: card.topic }
      : sourceShare >= 0.3
        ? { kind: 'source', sourceId: card.sourceId }
        : { kind: 'new' };
  return { score: Math.round(score * 1000) / 1000, reason };
}

/**
 * Ordena por puntaje sin más de 2 seguidas del mismo tema: lo que te gusta primero, pero
 * siempre con algo distinto en medio para que Explorar no se vuelva una burbuja.
 * `after` son las últimas ya mostradas, para que la regla siga entre páginas.
 */
export function recommend(
  cards: Card[],
  saved: Pick<Card, 'topic' | 'sourceId'>[],
  opts: { now?: Date; limit?: number; after?: Card[] } = {},
): Recommendation[] {
  const aff = affinityFrom(saved);
  const ranked = cards
    .map((card) => ({ card, ...scoreFor(card, aff, opts.now) }))
    .sort((a, b) => b.score - a.score || a.card.id.localeCompare(b.card.id));

  const limit = opts.limit ?? ranked.length;
  const out: Recommendation[] = [];
  const tail = (opts.after ?? []).slice(-2).map((c) => c.topic);
  const recent = () => [...tail, ...out.map((r) => r.card.topic)].slice(-2);
  while (out.length < limit && ranked.length > 0) {
    const [p, q] = recent();
    let k = ranked.findIndex((r) => !(p === q && q === r.card.topic));
    if (k < 0) k = 0; // solo queda un tema: mejor mostrarlo que dejar la página vacía
    out.push(ranked.splice(k, 1)[0]);
  }
  return out;
}
