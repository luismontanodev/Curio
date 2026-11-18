import type { Lang, RawCard } from '../core/types.ts';
import {
  normalizeFeatured, normalizeFeaturedArticlePage, type FeaturedArticlePage, type FeaturedFeed,
} from '../core/normalizers/wikipedia.ts';
import { getJson, shuffle, type FetchLike } from './http.ts';

export const wikiHost = (lang: Lang) => `https://${lang}.wikipedia.org`;
export const featuredFeedBase = (lang: Lang) => `${wikiHost(lang)}/api/rest_v1/feed/featured`;
export const actionApi = (lang: Lang) => `${wikiHost(lang)}/w/api.php`;

// Compatibilidad con código y tests que solo conocían el español.
export const WIKIPEDIA_FEATURED_BASE = featuredFeedBase('es');
export const WIKIPEDIA_ACTION_API = actionApi('es');

/** Categoría de artículos destacados (revisados por la comunidad) en cada Wikipedia. Verificadas el 2026-11-17. */
export const FEATURED_ARTICLES_CATEGORY: Record<Lang, string> = {
  es: 'Categoría:Wikipedia:Artículos destacados',
  en: 'Category:Featured articles',
  fr: 'Catégorie:Article de qualité',
  pt: 'Categoria:!Artigos destacados',
};

/** Imagen del día, efemérides y (si existe en ese idioma) artículo del día. */
export async function fetchWikipediaCards(fetch: FetchLike, date: Date, lang: Lang = 'es'): Promise<RawCard[]> {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const pad = (n: number) => String(n).padStart(2, '0');

  const feed = await getJson<FeaturedFeed>(fetch, `${featuredFeedBase(lang)}/${y}/${pad(m)}/${pad(d)}`);
  return normalizeFeatured(feed, m, d, lang);
}

/**
 * Las categorías están en orden alfabético: se empieza en una inicial al azar para que cada
 * ingesta traiga artículos distintos sin descargar la lista completa (más de 1 000).
 */
const SORT_KEY_PREFIXES = 'ABCDEFGHIJLMNOPRSTUV';
const BATCH = 20; // máximo de extractos por llamada en la API de acción

export interface FeaturedArticlesOptions {
  lang?: Lang;
  existing: Set<string>; // external_id ya guardados de wikipedia-<lang>
  count?: number;
  rng?: () => number;
}

export function featuredArticlesUrl(prefix: string, lang: Lang = 'es'): string {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    generator: 'categorymembers',
    gcmtitle: FEATURED_ARTICLES_CATEGORY[lang],
    gcmnamespace: '0',
    gcmlimit: String(BATCH),
    gcmstartsortkeyprefix: prefix,
    prop: 'extracts|pageimages|info',
    exintro: '1',
    explaintext: '1',
    exsentences: '3',
    exlimit: String(BATCH),
    piprop: 'thumbnail',
    pithumbsize: '640',
    inprop: 'url',
  });
  return `${actionApi(lang)}?${params}`;
}

/** Artículos destacados: calidad revisada por la comunidad, no popularidad. */
export async function fetchFeaturedArticles(fetch: FetchLike, opts: FeaturedArticlesOptions): Promise<RawCard[]> {
  const rng = opts.rng ?? Math.random;
  const lang = opts.lang ?? 'es';
  const prefix = SORT_KEY_PREFIXES[Math.floor(rng() * SORT_KEY_PREFIXES.length)];
  const res = await getJson<{ query?: { pages?: FeaturedArticlePage[] } }>(fetch, featuredArticlesUrl(prefix, lang));

  return shuffle(res.query?.pages ?? [], rng)
    .map((p) => normalizeFeaturedArticlePage(p, lang))
    .filter((c): c is RawCard => c !== null && !opts.existing.has(c.externalId))
    .slice(0, opts.count ?? 4);
}
