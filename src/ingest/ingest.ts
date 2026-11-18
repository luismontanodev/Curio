// Orquestador de la ingesta: corre en el teléfono al abrir la app y cuando el feed se acaba.
// Trae de cada fuente en los idiomas del usuario, puntúa, mezcla, guarda, recalcula y poda.
// Sin servidor.

import type { Card, Lang, RawCard } from '../core/types.ts';
import { withQuality } from '../core/scorer.ts';
import { sourceKindOf } from '../core/sources.ts';
import { MET_SOURCE } from '../core/normalizers/met.ts';
import { wikipediaSource } from '../core/normalizers/wikipedia.ts';
import { CONVERSATION_SOURCE } from '../core/normalizers/conversation.ts';
import { WIKIDATA_ART_SOURCE } from '../core/normalizers/wikidata.ts';
import { NASA_SOURCE } from '../core/normalizers/nasa.ts';
import { SINC_SOURCE } from '../core/normalizers/sinc.ts';
import { CLEVELAND_SOURCE, VAM_SOURCE } from '../core/normalizers/museums.ts';
import { INATURALIST_SOURCE } from '../core/normalizers/inaturalist.ts';
import { EPIC_SOURCE } from '../core/normalizers/epic.ts';
import { EUROPEPMC_SOURCE } from '../core/normalizers/europepmc.ts';
import { existingExternalIds, insertCards, pruneCards, rescoreOutdated } from '../db/cards.ts';
import { getKv, getPrefs, setKv } from '../db/prefs.ts';
import type { SqlDb } from '../db/sql.ts';
import { shuffle, type FetchLike } from './http.ts';
import { fetchMetCards } from './met.ts';
import { fetchFeaturedArticles, fetchWikipediaCards } from './wikipedia.ts';
import { CONVERSATION_FEEDS, fetchConversationCards } from './conversation.ts';
import { fetchArtCards } from './wikidata.ts';
import { fetchNasaCards } from './nasa.ts';
import {
  fetchClevelandCards, fetchEpicCards, fetchInaturalistCards, fetchPmcCards, fetchSincCards, fetchVamCards,
} from './more-sources.ts';

const LAST_INGEST_KEY = 'lastIngestAt';
const conversationPageKey = (lang: Lang) => `conversationPage:${lang}`;
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** Clases de trabajo. Cada una corre una vez por idioma que la soporte. */
export type JobKind =
  | 'featured' | 'articles' | 'conversation' | 'art' | 'met' | 'nasa'
  | 'sinc' | 'cleveland' | 'vam' | 'inaturalist' | 'epic' | 'pmc';

export interface IngestOptions {
  now?: Date;
  /** Ignora el intervalo mínimo (p. ej. "jalar para actualizar"). */
  force?: boolean;
  /**
   * Scroll infinito: el feed se acabó y hay que traer más. Implica `force`, pide la página
   * siguiente de las fuentes paginadas y efemérides de otro día, y no cuenta como ingesta
   * periódica.
   */
  more?: boolean;
  /** Solo estas clases de trabajo (p. ej. la sección Destacados pide solo `articles`). */
  only?: JobKind[];
  /** Idiomas a pedir; por defecto, los de las preferencias del usuario. */
  languages?: Lang[];
  minIntervalMs?: number;
  /** Días que una tarjeta no guardada permanece en el feed. */
  keepDays?: number;
  metCount?: number;
  /** Artículos destacados de Wikipedia por idioma e ingesta. */
  articleCount?: number;
  artCount?: number;
  nasaCount?: number;
  rng?: () => number;
}

export interface SourceReport {
  fetched: number;
  error?: string;
}

export interface IngestReport {
  skipped: boolean;
  inserted: number;
  rescored: number;
  pruned: number;
  /** Por trabajo: `featured:es`, `conversation:en`, `met:en`… */
  sources: Record<string, SourceReport>;
}

/** Un día al azar del último año, para efemérides distintas al traer más. */
function randomPastDay(now: Date, rng: () => number): Date {
  return new Date(now.getTime() - (1 + Math.floor(rng() * 364)) * DAY);
}

export async function runIngest(db: SqlDb, fetch: FetchLike, opts: IngestOptions = {}): Promise<IngestReport> {
  const now = opts.now ?? new Date();
  const rng = opts.rng ?? Math.random;
  const report: IngestReport = { skipped: false, inserted: 0, rescored: 0, pruned: 0, sources: {} };

  const last = await getKv(db, LAST_INGEST_KEY);
  const minInterval = opts.minIntervalMs ?? 3 * HOUR;
  if (!opts.force && !opts.more && last && now.getTime() - Date.parse(last) < minInterval) {
    return { ...report, skipped: true };
  }

  report.rescored = await rescoreOutdated(db);

  const languages = opts.languages ?? (await getPrefs(db)).languages;
  const wants = (k: JobKind) => !opts.only || opts.only.includes(k);
  const existing = async (sourceId: string) => existingExternalIds(db, sourceId);

  const jobs: Record<string, () => Promise<RawCard[]>> = {};
  for (const lang of languages) {
    const wikiId = wikipediaSource(lang).id;
    if (wants('featured')) {
      const day = opts.more ? randomPastDay(now, rng) : now;
      jobs[`featured:${lang}`] = () => fetchWikipediaCards(fetch, day, lang);
    }
    if (wants('articles')) {
      jobs[`articles:${lang}`] = async () =>
        fetchFeaturedArticles(fetch, { lang, existing: await existing(wikiId), count: opts.articleCount ?? 4, rng });
    }
    if (wants('conversation') && CONVERSATION_FEEDS[lang].length > 0) {
      jobs[`conversation:${lang}`] = async () => {
        const key = conversationPageKey(lang);
        const page = opts.more ? Number((await getKv(db, key)) ?? '1') + 1 : 1;
        try {
          const { cards, entries } = await fetchConversationCards(fetch, {
            lang,
            page,
            existing: await existing(CONVERSATION_SOURCE.id),
          });
          // Tras ~40 páginas (1 000 artículos) o una página vacía, vuelve al inicio.
          if (opts.more) await setKv(db, key, String(page > 40 || entries === 0 ? 1 : page));
          return cards;
        } catch (e) {
          if (opts.more) await setKv(db, key, '1'); // página inexistente: la próxima vez empieza de nuevo
          throw e;
        }
      };
    }
    if (wants('art')) {
      jobs[`art:${lang}`] = async () => {
        const ids = await existing(WIKIDATA_ART_SOURCE.id);
        return fetchArtCards(fetch, { lang, existing: ids, count: opts.artCount ?? 6, rng });
      };
    }
    // Fuentes que solo publican en inglés: entran si el usuario lee inglés.
    if (lang === 'en' && wants('met')) {
      jobs['met:en'] = async () =>
        fetchMetCards(fetch, { existing: await existing(MET_SOURCE.id), count: opts.metCount ?? 10, rng });
    }
    if (lang === 'en' && wants('nasa')) {
      jobs['nasa:en'] = async () =>
        fetchNasaCards(fetch, { existing: await existing(NASA_SOURCE.id), count: opts.nasaCount ?? 4, rng });
    }
    // Museos con API abierta (inglés).
    // Art Institute of Chicago: APAGADO. Su API responde, pero su servidor de imágenes (IIIF)
    // da 403 a clientes que no son navegador (verificado el 2026-11-18): sus obras saldrían
    // sin imagen. No se disfraza el User-Agent. Para activarlo: `fetchAicCards` (ya probado)
    // con `AIC_SOURCE`, cuando el AIC permita la descarga de imágenes desde apps.
    if (lang === 'en' && wants('cleveland')) {
      jobs['cleveland:en'] = async () => fetchClevelandCards(fetch, { existing: await existing(CLEVELAND_SOURCE.id), rng });
    }
    if (lang === 'en' && wants('vam')) {
      jobs['vam:en'] = async () => fetchVamCards(fetch, { existing: await existing(VAM_SOURCE.id), rng });
    }
    if (lang === 'en' && wants('pmc')) {
      jobs['pmc:en'] = async () => fetchPmcCards(fetch, { existing: await existing(EUROPEPMC_SOURCE.id), rng });
    }
    // Agencia SINC: divulgación en español.
    if (lang === 'es' && wants('sinc')) {
      jobs['sinc:es'] = async () => fetchSincCards(fetch, { existing: await existing(SINC_SOURCE.id), rng });
    }
    // Naturaleza: nombres comunes en el idioma pedido, así que corre en todos.
    if (wants('inaturalist')) {
      jobs[`inaturalist:${lang}`] = async () =>
        fetchInaturalistCards(fetch, { lang, existing: await existing(INATURALIST_SOURCE.id), rng });
    }
    // La Tierra desde el espacio: texto calculado, en español o inglés.
    if ((lang === 'es' || lang === 'en') && wants('epic')) {
      jobs[`epic:${lang}`] = async () => fetchEpicCards(fetch, { lang, existing: await existing(EPIC_SOURCE.id) });
    }
  }

  const names = Object.keys(jobs);
  const results = await Promise.allSettled(names.map((n) => jobs[n]()));

  const raw: RawCard[] = [];
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      raw.push(...r.value);
      report.sources[names[i]] = { fetched: r.value.length };
    } else {
      report.sources[names[i]] = { fetched: 0, error: errorMessage(r.reason) };
    }
  });

  // Mezcla las fuentes y escalona ingested_at (1 ms) para que el feed alterne
  // arte, historia, etc. en lugar de mostrar bloques de una sola fuente.
  const cards: Card[] = shuffle(raw, rng).map((rc, i) => ({
    ...withQuality(rc, sourceKindOf(rc.sourceId), now),
    ingestedAt: new Date(now.getTime() - i).toISOString(),
  }));

  report.inserted = await insertCards(db, cards);
  report.pruned = await pruneCards(db, new Date(now.getTime() - (opts.keepDays ?? 30) * DAY));

  // Solo cuenta como ingesta periódica si alguna fuente respondió: sin red se reintenta al volver a abrir.
  if (!opts.more && !opts.only && Object.values(report.sources).some((s) => !s.error)) {
    await setKv(db, LAST_INGEST_KEY, now.toISOString());
  }
  return report;
}

/** Fecha (ISO) de la última ingesta en la que respondió al menos una fuente; null si nunca. */
export async function getLastIngestAt(db: SqlDb): Promise<string | null> {
  return getKv(db, LAST_INGEST_KEY);
}

function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.name === 'AbortError' ? 'Tiempo de espera agotado' : e.message;
  return String(e);
}
