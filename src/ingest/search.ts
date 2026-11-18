// Búsqueda en Wikipedia (sin key) para Explorar: artículos relacionados con lo que se busca,
// en cada idioma del usuario. Los resultados se guardan como tarjetas para leerlos en la app.

import type { Lang, RawCard } from '../core/types.ts';
import { normalizeSearchPage, type FeaturedArticlePage } from '../core/normalizers/wikipedia.ts';
import { getJson, type FetchLike } from './http.ts';
import { actionApi } from './wikipedia.ts';

export function wikipediaSearchUrl(lang: Lang, query: string, limit = 10): string {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    generator: 'search',
    gsrsearch: query,
    gsrnamespace: '0',
    gsrlimit: String(limit),
    prop: 'extracts|pageimages|info',
    exintro: '1',
    explaintext: '1',
    exsentences: '3',
    exlimit: String(limit),
    piprop: 'thumbnail',
    pithumbsize: '960', // tamaño estándar de Wikimedia (los no estándar se limitan más)
    inprop: 'url',
  });
  return `${actionApi(lang)}?${params}`;
}

/** Artículos de Wikipedia para `query`, en el orden de relevancia que da la API. */
export async function searchWikipedia(fetch: FetchLike, lang: Lang, query: string, limit = 10): Promise<RawCard[]> {
  const q = query.trim();
  if (!q) return [];
  const res = await getJson<{ query?: { pages?: (FeaturedArticlePage & { index?: number })[] } }>(
    fetch,
    wikipediaSearchUrl(lang, q, limit),
  );
  // Con `generator` las páginas llegan sin orden; `index` es la posición en la búsqueda.
  return (res.query?.pages ?? [])
    .slice()
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    .map((p) => normalizeSearchPage(p, lang))
    .filter((c): c is RawCard => c !== null);
}
