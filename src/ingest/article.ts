// Texto completo de un artículo de Wikipedia para leerlo dentro de la app (se pide al abrirlo).

import type { ContentBlock, Lang } from '../core/types.ts';
import { LANGS } from '../core/types.ts';
import { wikiTextToBlocks } from '../core/blocks.ts';
import { getJson, type FetchLike } from './http.ts';
import { actionApi } from './wikipedia.ts';

/** "https://es.wikipedia.org/wiki/Canal_de_Suez" → { lang: 'es', title: 'Canal de Suez' }. */
export function parseWikipediaUrl(url: string): { lang: Lang; title: string } | null {
  const m = /^https:\/\/([a-z]{2})\.(?:m\.)?wikipedia\.org\/wiki\/([^?#]+)/.exec(url);
  if (!m || !LANGS.includes(m[1] as Lang)) return null;
  let title: string;
  try {
    title = decodeURIComponent(m[2]);
  } catch {
    return null;
  }
  return { lang: m[1] as Lang, title: title.replace(/_/g, ' ') };
}

export function articleTextUrl(lang: Lang, title: string): string {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    prop: 'extracts',
    explaintext: '1',
    exsectionformat: 'wiki',
    redirects: '1',
    titles: title,
  });
  return `${actionApi(lang)}?${params}`;
}

/** Bloques del artículo, o null si la URL no es de Wikipedia o el artículo no existe. */
export async function fetchWikipediaArticle(fetch: FetchLike, url: string): Promise<ContentBlock[] | null> {
  const parsed = parseWikipediaUrl(url);
  if (!parsed) return null;
  const res = await getJson<{ query?: { pages?: { missing?: boolean; extract?: string }[] } }>(
    fetch,
    articleTextUrl(parsed.lang, parsed.title),
    15_000,
  );
  const page = res.query?.pages?.[0];
  if (!page || page.missing || !page.extract) return null;
  const blocks = wikiTextToBlocks(page.extract);
  return blocks.length > 0 ? blocks : null;
}
