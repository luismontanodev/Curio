// Arte en el idioma del usuario vía el servicio SPARQL de Wikidata (sin key).
// Contar resultados tarda más de un minuto; una página con OFFSET al azar tarda 2–5 s
// mientras el OFFSET sea menor a ~2000 (medido el 2026-11-17).

import type { Lang, RawCard } from '../core/types.ts';
import { normalizeArtBinding, type ArtBinding } from '../core/normalizers/wikidata.ts';
import { getJson, shuffle, type FetchLike } from './http.ts';

export const WIKIDATA_SPARQL = 'https://query.wikidata.org/sparql';

/** OFFSET máximo por idioma: hay menos pinturas con artículo en pt que en en. */
const MAX_OFFSET: Record<Lang, number> = { es: 1500, en: 2000, fr: 1500, pt: 600 };
const PAGE = 30;

export function artQuery(lang: Lang, offset: number, limit = PAGE): string {
  return `SELECT ?item ?label ?image ?article ?creatorLabel ?inception ?description WHERE {
  ?item wdt:P31 wd:Q3305213; wdt:P18 ?image.
  ?article schema:about ?item; schema:isPartOf <https://${lang}.wikipedia.org/>.
  ?item rdfs:label ?label FILTER(LANG(?label) = "${lang}")
  OPTIONAL { ?item wdt:P170 ?creator. ?creator rdfs:label ?creatorLabel FILTER(LANG(?creatorLabel) = "${lang}") }
  OPTIONAL { ?item wdt:P571 ?inception }
  OPTIONAL { ?item schema:description ?description FILTER(LANG(?description) = "${lang}") }
} OFFSET ${Math.max(0, Math.floor(offset))} LIMIT ${limit}`;
}

export const artQueryUrl = (lang: Lang, offset: number) =>
  `${WIKIDATA_SPARQL}?format=json&query=${encodeURIComponent(artQuery(lang, offset))}`;

export async function fetchArtCards(
  fetch: FetchLike,
  opts: { lang: Lang; existing: Set<string>; count?: number; rng?: () => number },
): Promise<RawCard[]> {
  const rng = opts.rng ?? Math.random;
  const offset = Math.floor(rng() * MAX_OFFSET[opts.lang]);
  const res = await getJson<{ results?: { bindings?: ArtBinding[] } }>(fetch, artQueryUrl(opts.lang, offset), 25_000);

  // Una obra puede salir repetida (varios autores o fechas): se queda la primera.
  const seen = new Set<string>();
  const cards: RawCard[] = [];
  for (const b of shuffle(res.results?.bindings ?? [], rng)) {
    const card = normalizeArtBinding(b, opts.lang);
    if (!card || seen.has(card.id) || opts.existing.has(card.externalId)) continue;
    seen.add(card.id);
    cards.push(card);
    if (cards.length >= (opts.count ?? 6)) break;
  }
  return cards;
}
