// Fetchers de las fuentes agregadas el 2026-11-18 (todas sin key, verificadas con respuestas
// reales en test/fixtures/): Agencia SINC, Art Institute of Chicago, Cleveland Museum of Art,
// V&A, iNaturalist, NASA EPIC y Europe PMC.

import type { Lang, RawCard, Topic } from '../core/types.ts';
import { normalizeSinc, parseRss } from '../core/normalizers/sinc.ts';
import {
  normalizeAic, normalizeCleveland, normalizeVam, type AicArtwork, type ClevelandArtwork, type VamRecord,
} from '../core/normalizers/museums.ts';
import { normalizeObservation, type InatObservation } from '../core/normalizers/inaturalist.ts';
import { normalizeEpic, type EpicImage } from '../core/normalizers/epic.ts';
import { normalizePmc, type PmcResult } from '../core/normalizers/europepmc.ts';
import { USER_AGENT, getJson, getText, shuffle, type FetchLike } from './http.ts';

type Opts = { existing: Set<string>; count?: number; rng?: () => number };

const pick = <T,>(items: readonly T[], rng: () => number): T => items[Math.floor(rng() * items.length)];

function fresh(cards: (RawCard | null)[], existing: Set<string>, count: number, rng: () => number): RawCard[] {
  const ok = cards.filter((c): c is RawCard => c !== null && !existing.has(c.externalId));
  return shuffle(ok, rng).slice(0, count);
}

/** Temas de búsqueda en los museos: variedad sin depender de lo más visto. */
export const MUSEUM_QUERIES = [
  'landscape', 'flowers', 'birds', 'portrait', 'ocean', 'city', 'night', 'animals', 'garden', 'music',
  'astronomy', 'map', 'textile', 'ceramic', 'winter', 'river', 'dance', 'book',
];

// --- Agencia SINC ------------------------------------------------------------

/** Secciones y su tema por defecto. Cada feed pesa ~3 MB (150 artículos completos): se pide una por vez. */
export const SINC_FEEDS: readonly { path: string; topic: Topic }[] = [
  { path: 'Ciencia', topic: 'ciencia' },
  { path: 'Innova', topic: 'tecnologia' },
  { path: 'Salud', topic: 'ciencia' },
  { path: 'Reportajes', topic: 'ciencia' },
];

export const sincFeedUrl = (path: string) => `https://www.agenciasinc.es/feed/${path}`;

export async function fetchSincCards(fetch: FetchLike, opts: Opts): Promise<RawCard[]> {
  const rng = opts.rng ?? Math.random;
  const feed = pick(SINC_FEEDS, rng);
  const xml = await getText(fetch, sincFeedUrl(feed.path), 25_000);
  // Lo más reciente primero: de los 40 últimos de la sección, los que aún no están.
  const cards = parseRss(xml)
    .slice(0, 40)
    .map((item) => normalizeSinc(item, feed.topic));
  return cards.filter((c): c is RawCard => c !== null && !opts.existing.has(c.externalId)).slice(0, opts.count ?? 8);
}

// --- Museos ------------------------------------------------------------------

const AIC_FIELDS = 'id,title,artist_display,date_display,medium_display,image_id,is_public_domain,short_description,description';

export async function fetchAicCards(fetch: FetchLike, opts: Opts): Promise<RawCard[]> {
  const rng = opts.rng ?? Math.random;
  const q = pick(MUSEUM_QUERIES, rng);
  const page = 1 + Math.floor(rng() * 5);
  // El AIC pide identificarse con esta cabecera; sin ella responde 403.
  const withAicHeader: FetchLike = (url, init) =>
    fetch(url, { ...init, headers: { ...init?.headers, 'AIC-User-Agent': USER_AGENT } });
  const res = await getJson<{ data?: AicArtwork[]; config?: { iiif_url?: string } }>(
    withAicHeader,
    `https://api.artic.edu/api/v1/artworks/search?q=${encodeURIComponent(q)}&query[term][is_public_domain]=true&limit=30&page=${page}&fields=${AIC_FIELDS}`,
  );
  const iiif = res.config?.iiif_url ?? 'https://www.artic.edu/iiif/2';
  return fresh((res.data ?? []).map((a) => normalizeAic(a, iiif)), opts.existing, opts.count ?? 5, rng);
}

export async function fetchClevelandCards(fetch: FetchLike, opts: Opts): Promise<RawCard[]> {
  const rng = opts.rng ?? Math.random;
  const q = pick(MUSEUM_QUERIES, rng);
  const skip = Math.floor(rng() * 4) * 30;
  const res = await getJson<{ data?: ClevelandArtwork[] }>(
    fetch,
    `https://openaccess-api.clevelandart.org/api/artworks/?q=${encodeURIComponent(q)}&has_image=1&cc0=1&limit=30&skip=${skip}`,
  );
  return fresh((res.data ?? []).map(normalizeCleveland), opts.existing, opts.count ?? 5, rng);
}

export async function fetchVamCards(fetch: FetchLike, opts: Opts): Promise<RawCard[]> {
  const rng = opts.rng ?? Math.random;
  const q = pick(MUSEUM_QUERIES, rng);
  const page = 1 + Math.floor(rng() * 5);
  const res = await getJson<{ records?: VamRecord[] }>(
    fetch,
    `https://api.vam.ac.uk/v2/objects/search?q=${encodeURIComponent(q)}&images_exist=1&page_size=30&page=${page}`,
  );
  return fresh((res.records ?? []).map(normalizeVam), opts.existing, opts.count ?? 4, rng);
}

// --- Naturaleza: iNaturalist -------------------------------------------------

/** Grupos para variar: aves, plantas, insectos, hongos, mamíferos, anfibios, reptiles, moluscos… */
export const INAT_GROUPS = [
  'Aves', 'Plantae', 'Insecta', 'Fungi', 'Mammalia', 'Amphibia', 'Reptilia', 'Mollusca', 'Arachnida', 'Actinopterygii',
];

export const INAT_FIELDS = [
  'id', 'observed_on', 'place_guess', 'license_code', 'user.login', 'user.name',
  'taxon.id', 'taxon.name', 'taxon.rank', 'taxon.preferred_common_name', 'taxon.iconic_taxon_name',
  'photos.url', 'photos.license_code', 'photos.attribution',
].join(',');

export function inaturalistUrl(lang: Lang, group: string, page: number): string {
  const params = new URLSearchParams({
    quality_grade: 'research',
    photos: 'true',
    photo_license: 'cc-by,cc0',
    iconic_taxa: group,
    order_by: 'votes', // las mejor valoradas por la comunidad: suelen ser las mejores fotos
    per_page: '30',
    page: String(page),
    locale: lang,
    // Solo los campos que usa el normalizador: ~5 KB con gzip en vez de ~1.3 MB (v1 sin filtro).
    fields: INAT_FIELDS,
  });
  return `https://api.inaturalist.org/v2/observations?${params}`;
}

export async function fetchInaturalistCards(fetch: FetchLike, opts: Opts & { lang: Lang }): Promise<RawCard[]> {
  const rng = opts.rng ?? Math.random;
  const group = pick(INAT_GROUPS, rng);
  const page = 1 + Math.floor(rng() * 10);
  const res = await getJson<{ results?: InatObservation[] }>(fetch, inaturalistUrl(opts.lang, group, page));
  // Una sola observación por especie: si no, salen cinco fotos del mismo pájaro.
  const seen = new Set<number>();
  const unique: InatObservation[] = [];
  for (const o of res.results ?? []) {
    if (!o.taxon || seen.has(o.taxon.id)) continue;
    seen.add(o.taxon.id);
    unique.push(o);
  }
  return fresh(unique.map((o) => normalizeObservation(o, opts.lang)), opts.existing, opts.count ?? 6, rng);
}

// --- NASA EPIC ---------------------------------------------------------------

export async function fetchEpicCards(fetch: FetchLike, opts: Opts & { lang: Lang }): Promise<RawCard[]> {
  const res = await getJson<EpicImage[]>(fetch, 'https://epic.gsfc.nasa.gov/api/natural');
  // Una por día: la primera foto del último día disponible.
  const card = res[0] ? normalizeEpic(res[0], opts.lang) : null;
  return card && !opts.existing.has(card.externalId) ? [card] : [];
}

// --- Europe PMC --------------------------------------------------------------

export const PMC_QUERIES = [
  'ecology', 'astronomy', 'neuroscience', 'climate', 'evolution', 'nutrition', 'oceans', 'archaeology', 'genetics', 'sleep',
];

export async function fetchPmcCards(fetch: FetchLike, opts: Opts): Promise<RawCard[]> {
  const rng = opts.rng ?? Math.random;
  const q = pick(PMC_QUERIES, rng);
  const query = `${q} AND OPEN_ACCESS:y AND HAS_ABSTRACT:y AND (LICENSE:"cc by" OR LICENSE:"cc0" OR LICENSE:"cc by-sa")`;
  const res = await getJson<{ resultList?: { result?: PmcResult[] } }>(
    fetch,
    `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(query)}&format=json&pageSize=25&resultType=core&sort=P_PDATE_D%20desc`,
    20_000,
  );
  return fresh((res.resultList?.result ?? []).map(normalizePmc), opts.existing, opts.count ?? 3, rng);
}
