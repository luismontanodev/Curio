// Fetchers de video corto (2026-11-18). Todas sin key, verificadas con respuestas reales en
// test/fixtures/. Para ahorrar datos y peticiones: primero se filtra por duración con los
// metadatos más baratos y solo entonces se piden los archivos del candidato.

import type { RawCard } from '../core/types.ts';
import {
  assetUrl, nasaDuration, normalizeNasaVideo, type NasaVideoItem, type NasaVideoMetadata,
} from '../core/normalizers/nasa-video.ts';
import { isMomentLength, parseDuration } from '../core/video.ts';
import { archiveLicense, normalizeArchive, type ArchiveDoc, type ArchiveMetadata } from '../core/normalizers/archive.ts';
import { normalizeCommonsVideo, type CommonsVideoPage } from '../core/normalizers/commons-video.ts';
import { getJson, mapLimit, shuffle, type FetchLike } from './http.ts';

type Opts = { existing: Set<string>; count?: number; rng?: () => number };

const pick = <T,>(items: readonly T[], rng: () => number): T => items[Math.floor(rng() * items.length)];

// --- A) NASA Image and Video Library --------------------------------------------

/**
 * Temas de espacio y ciencia. Medido el 2026-11-20 con la página 1 (clips de 15–60 s de 40):
 * exoplanet 14, solar flare 12, hubble 11, earth animation 10, sun 8, eclipse 7, webb 6,
 * artemis 6, timelapse 6, moon 4, mars 4. Fuera por rendir 0–1: saturn, jupiter, comet, aurora,
 * iss timelapse y "… visualization" (casi sin resultados).
 */
export const NASA_VIDEO_QUERIES = [
  'exoplanet', 'solar flare', 'hubble', 'earth animation', 'sun', 'eclipse', 'webb', 'artemis', 'timelapse',
  'moon', 'mars',
];
export const NASA_SEARCH_URL = 'https://images-api.nasa.gov/search';
export const nasaMetadataUrl = (id: string) => `https://images-assets.nasa.gov/video/${encodeURIComponent(id)}/metadata.json`;
export const nasaAssetUrl = (id: string) => `https://images-api.nasa.gov/asset/${encodeURIComponent(id)}`;

/** Cuántos candidatos se revisan por ingesta (cada uno cuesta ~10 KB de metadatos). */
const NASA_CANDIDATES = 30;
/** Temas por ingesta: con uno solo, una ronda podía no dar ningún clip corto. */
const NASA_QUERIES_PER_RUN = 2;

export async function fetchNasaVideoCards(fetch: FetchLike, opts: Opts): Promise<RawCard[]> {
  const rng = opts.rng ?? Math.random;
  const queries = shuffle([...NASA_VIDEO_QUERIES], rng).slice(0, NASA_QUERIES_PER_RUN);
  const searches = await Promise.allSettled(
    queries.map((q) =>
      getJson<{ collection?: { items?: NasaVideoItem[] } }>(
        fetch,
        `${NASA_SEARCH_URL}?media_type=video&page_size=50&page=${1 + Math.floor(rng() * 3)}&q=${encodeURIComponent(q)}`,
      ),
    ),
  );
  if (searches.every((r) => r.status === 'rejected')) throw (searches[0] as PromiseRejectedResult).reason;
  const seen = new Set<string>();
  const candidates = shuffle(
    searches.flatMap((r) => (r.status === 'fulfilled' ? r.value.collection?.items ?? [] : [])),
    rng,
  )
    .filter((it) => {
      const id = it.data?.[0]?.nasa_id;
      if (!id || opts.existing.has(id) || seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .slice(0, NASA_CANDIDATES);

  // 1) Duración (metadata.json): solo siguen los clips de 15 a 60 s.
  // 6 a la vez: la mayor parte de la espera es la latencia de cada petición, no el ancho de banda.
  const metas = await mapLimit(candidates, 6, (it) => getJson<NasaVideoMetadata>(fetch, nasaMetadataUrl(it.data![0].nasa_id!)));
  const short = candidates
    .map((it, i) => ({ it, meta: metas[i].status === 'fulfilled' ? metas[i].value : null }))
    .filter((x): x is { it: NasaVideoItem; meta: NasaVideoMetadata } => !!x.meta && isMomentLength(nasaDuration(x.meta)))
    .slice(0, opts.count ?? 8);

  // 2) Archivos (asset): la variante MP4 ligera y el póster.
  const assets = await mapLimit(short, 6, ({ it }) =>
    getJson<{ collection?: { items?: { href: string }[] } }>(fetch, nasaAssetUrl(it.data![0].nasa_id!)),
  );
  const cards: RawCard[] = [];
  short.forEach(({ it, meta }, i) => {
    const a = assets[i];
    if (a.status !== 'fulfilled') return; // un candidato que falla no tumba la fuente
    const hrefs = (a.value.collection?.items ?? []).map((x) => x.href);
    const card = normalizeNasaVideo(it, meta, hrefs);
    if (card) cards.push(card);
  });
  return cards;
}

// --- B) Internet Archive (curaduría, no ingesta masiva) ----------------------------

/** Colecciones curadas de cine documental y efímero. */
export const ARCHIVE_COLLECTIONS = ['prelinger', 'ephemera'];

/** Licencias de valor exacto: su búsqueda falla con comodines en `licenseurl` (verificado). */
export const ARCHIVE_LICENSE_URLS = [
  'http://creativecommons.org/licenses/publicdomain/',
  'http://creativecommons.org/publicdomain/mark/1.0/',
  'http://creativecommons.org/publicdomain/zero/1.0/',
  'https://creativecommons.org/publicdomain/mark/1.0/',
  'https://creativecommons.org/publicdomain/zero/1.0/',
  'http://creativecommons.org/licenses/by/4.0/',
  'https://creativecommons.org/licenses/by/4.0/',
];

export function archiveSearchUrl(collection: string, page: number, rows = 100): string {
  const lic = ARCHIVE_LICENSE_URLS.map((u) => `"${u}"`).join(' OR ');
  const q = `collection:${collection} AND mediatype:movies AND licenseurl:(${lic})`;
  const fields = ['identifier', 'title', 'licenseurl', 'runtime'].map((f) => `fl[]=${f}`).join('&');
  return `https://archive.org/advancedsearch.php?q=${encodeURIComponent(q)}&${fields}&rows=${rows}&page=${page}&output=json`;
}
export const archiveMetadataUrl = (id: string) => `https://archive.org/metadata/${encodeURIComponent(id)}`;

/** Pocos por ingesta: los clips cortos con licencia abierta son ~3 % de estas colecciones. */
const ARCHIVE_CANDIDATES = 6;

export async function fetchArchiveVideoCards(fetch: FetchLike, opts: Opts): Promise<RawCard[]> {
  const rng = opts.rng ?? Math.random;
  const collection = pick(ARCHIVE_COLLECTIONS, rng);
  const page = 1 + Math.floor(rng() * 8);
  const res = await getJson<{ response?: { docs?: ArchiveDoc[] } }>(fetch, archiveSearchUrl(collection, page), 20_000);
  // Filtro barato con lo que trae la búsqueda: licencia abierta y duración de 15 a 60 s.
  const candidates = shuffle(res.response?.docs ?? [], rng)
    .filter((d) => !opts.existing.has(d.identifier) && archiveLicense(d.licenseurl) && isMomentLength(parseDuration(d.runtime)))
    .slice(0, ARCHIVE_CANDIDATES);
  // Verificación campo por campo con los metadatos del elemento (licencia y duración del archivo).
  const metas = await mapLimit(candidates, 3, (d) => getJson<ArchiveMetadata>(fetch, archiveMetadataUrl(d.identifier)));
  const cards: RawCard[] = [];
  for (const r of metas) {
    if (r.status !== 'fulfilled') continue;
    const card = normalizeArchive(r.value);
    if (card?.video && isMomentLength(card.video.durationSec)) cards.push(card);
  }
  return cards.slice(0, opts.count ?? 4);
}

// --- C) Wikimedia Commons (pendiente de verificar en iPhone) -------------------------

export const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';
export const COMMONS_VIDEO_QUERIES = ['aurora', 'timelapse', 'volcano', 'birds', 'ocean waves', 'insects', 'clouds', 'waterfall', 'jellyfish', 'lightning'];

export function commonsVideoSearchUrl(q: string, limit = 20): string {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    generator: 'search',
    gsrsearch: `filetype:video ${q}`,
    gsrnamespace: '6',
    gsrlimit: String(limit),
    prop: 'imageinfo|videoinfo',
    iiprop: 'url|mime|size|extmetadata',
    iiextmetadatafilter: 'LicenseShortName|LicenseUrl|Artist|ImageDescription',
    viprop: 'derivatives|size',
  });
  return `${COMMONS_API}?${params}`;
}

/** Volumen bajo: Wikimedia limita por IP (respondió 429 el 2026-11-18). Una búsqueda por ingesta. */
export async function fetchCommonsVideoCards(fetch: FetchLike, opts: Opts): Promise<RawCard[]> {
  const rng = opts.rng ?? Math.random;
  const res = await getJson<{ query?: { pages?: CommonsVideoPage[] } }>(fetch, commonsVideoSearchUrl(pick(COMMONS_VIDEO_QUERIES, rng)));
  const cards = (res.query?.pages ?? [])
    .map(normalizeCommonsVideo)
    .filter((c): c is RawCard => c !== null && !!c.video && isMomentLength(c.video.durationSec) && !opts.existing.has(c.externalId));
  return shuffle(cards, rng).slice(0, opts.count ?? 2);
}

export { assetUrl };
