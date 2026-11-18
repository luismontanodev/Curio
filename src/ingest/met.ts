// Ingesta del Met: busca obras destacadas por un tema al azar y trae el detalle de
// las que aún no están en la base. Solo entran las de dominio público con imagen.

import type { RawCard } from '../core/types.ts';
import { normalizeMet, type MetObject } from '../core/normalizers/met.ts';
import { getJson, mapLimit, shuffle, type FetchLike } from './http.ts';

export const MET_BASE = 'https://collectionapi.metmuseum.org/public/collection/v1';
/**
 * Búsqueda paginada. `/v1/search` se retiró el 2026-10-01 (responde 410). La v1.1 da 100
 * resultados por defecto y 500 como máximo; con `isHighlight` cada tema trae menos de 500,
 * así que una sola página basta.
 */
export const MET_SEARCH = 'https://collectionapi.metmuseum.org/public/collection/v1.1/search';
export const MET_SEARCH_LIMIT = 500;

/** Temas de búsqueda: variedad sin depender de lo más visto. */
export const MET_QUERIES = [
  'landscape', 'flowers', 'birds', 'astronomy', 'ocean', 'portrait', 'ceramics', 'textiles',
  'maps', 'musical instruments', 'architecture', 'animals', 'mountains', 'calligraphy',
  'clocks', 'botany', 'masks', 'manuscripts',
];

export interface MetIngestOptions {
  existing: Set<string>; // external_id ya guardados
  count?: number; // tarjetas a traer
  rng?: () => number;
}

export async function fetchMetCards(fetch: FetchLike, opts: MetIngestOptions): Promise<RawCard[]> {
  const rng = opts.rng ?? Math.random;
  const count = opts.count ?? 10;
  const query = MET_QUERIES[Math.floor(rng() * MET_QUERIES.length)];

  const search = await getJson<{ total: number; objectIDs: number[] | null }>(
    fetch,
    `${MET_SEARCH}?isHighlight=true&hasImages=true&limit=${MET_SEARCH_LIMIT}&q=${encodeURIComponent(query)}`,
  );

  // Muchas obras no son de dominio público: se piden candidatos de más.
  const candidates = shuffle(search.objectIDs ?? [], rng)
    .filter((id) => !opts.existing.has(String(id)))
    .slice(0, count * 3);

  const cards: RawCard[] = [];
  for (let i = 0; i < candidates.length && cards.length < count; i += 6) {
    const chunk = candidates.slice(i, i + 6);
    const results = await mapLimit(chunk, 3, (id) => getJson<MetObject>(fetch, `${MET_BASE}/objects/${id}`));
    for (const r of results) {
      if (r.status !== 'fulfilled') continue; // un objeto que falla no tumba la ingesta
      const card = normalizeMet(r.value);
      if (card && cards.length < count) cards.push(card);
    }
  }
  return cards;
}
