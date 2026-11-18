// NASA Image and Video Library: imágenes del espacio, dominio público, sin key.

import type { RawCard } from '../core/types.ts';
import { normalizeNasa, type NasaItem } from '../core/normalizers/nasa.ts';
import { getJson, shuffle, type FetchLike } from './http.ts';

export const NASA_SEARCH = 'https://images-api.nasa.gov/search';

export const NASA_QUERIES = [
  'nebula', 'galaxy', 'hubble', 'webb telescope', 'mars surface', 'jupiter', 'saturn rings',
  'earth from space', 'aurora', 'solar flare', 'apollo', 'international space station', 'moon surface',
];

export async function fetchNasaCards(
  fetch: FetchLike,
  opts: { existing: Set<string>; count?: number; rng?: () => number },
): Promise<RawCard[]> {
  const rng = opts.rng ?? Math.random;
  const q = NASA_QUERIES[Math.floor(rng() * NASA_QUERIES.length)];
  const page = 1 + Math.floor(rng() * 3); // las primeras páginas tienen las imágenes mejor descritas
  const res = await getJson<{ collection?: { items?: NasaItem[] } }>(
    fetch,
    `${NASA_SEARCH}?media_type=image&page_size=40&page=${page}&q=${encodeURIComponent(q)}`,
  );
  return shuffle(res.collection?.items ?? [], rng)
    .map(normalizeNasa)
    .filter((c): c is RawCard => c !== null && !opts.existing.has(c.externalId) && (c.summary?.length ?? 0) > 40)
    .slice(0, opts.count ?? 4);
}
