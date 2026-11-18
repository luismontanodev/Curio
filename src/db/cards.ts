// Tarjetas: inserción, feed paginado, vistos, guardados, poda y recálculo de puntajes.

import { LANGS, type Card, type CardType, type ContentBlock, type FilterPrefs, type Lang, type Signal, type Topic } from '../core/types.ts';
import { SCORER_VERSION, THRESHOLDS, findBlockedWord, scoreCard } from '../core/scorer.ts';
import { sourceKindOf } from '../core/sources.ts';
import { parseBlocks } from '../core/blocks.ts';
import { bool, type SqlDb, type SqlValue } from './sql.ts';

interface CardRow {
  id: string;
  source_id: string;
  source_kind: string;
  external_id: string;
  type: string;
  topic: string;
  lang: string;
  title: string;
  summary: string | null;
  image_url: string | null;
  url: string;
  license: string | null;
  read_minutes: number | null;
  published_at: string | null;
  ingested_at: string;
  score_sensational: number;
  score_clickbait: number;
  score_signals: string;
  scorer_version: number;
  body?: string | null; // solo se lee al abrir una tarjeta, no en el feed
}

/** Columnas del feed: todo menos `body`, que puede pesar decenas de KB por tarjeta. */
const LIST_COLUMNS = [
  'id', 'source_id', 'source_kind', 'external_id', 'type', 'topic', 'lang', 'title', 'summary',
  'image_url', 'url', 'license', 'read_minutes', 'published_at', 'ingested_at',
  'score_sensational', 'score_clickbait', 'score_signals', 'scorer_version',
] as const;
const COLUMNS = [...LIST_COLUMNS, 'body'] as const;
const LIST_SELECT = LIST_COLUMNS.map((c) => `c.${c}`).join(', ');

function cardToParams(c: Card): SqlValue[] {
  return [
    c.id, c.sourceId, sourceKindOf(c.sourceId), c.externalId, c.type, c.topic, c.lang, c.title,
    c.summary ?? null, c.imageUrl ?? null, c.url, c.license ?? null, c.readMinutes ?? null,
    c.publishedAt ?? null, c.ingestedAt, c.quality.sensationalism, c.quality.clickbait,
    JSON.stringify(c.quality.signals), c.quality.scorerVersion,
    c.body?.length ? JSON.stringify(c.body) : null,
  ];
}

const toLang = (v: string): Lang => (LANGS.includes(v as Lang) ? (v as Lang) : 'es');

function rowToCard(r: CardRow): Card {
  let signals: Signal[] = [];
  try {
    signals = JSON.parse(r.score_signals);
  } catch {
    /* columna dañada: se trata como sin señales */
  }
  let body: ContentBlock[] | undefined;
  if (r.body) {
    try {
      body = parseBlocks(JSON.parse(r.body));
    } catch {
      /* columna dañada: sin texto completo */
    }
  }
  return {
    id: r.id,
    sourceId: r.source_id,
    externalId: r.external_id,
    type: r.type as CardType,
    topic: r.topic as Topic,
    lang: toLang(r.lang),
    ...(body?.length ? { body } : {}),
    title: r.title,
    summary: r.summary ?? undefined,
    imageUrl: r.image_url ?? undefined,
    url: r.url,
    license: r.license ?? undefined,
    readMinutes: r.read_minutes ?? undefined,
    publishedAt: r.published_at ?? undefined,
    ingestedAt: r.ingested_at,
    quality: {
      sensationalism: r.score_sensational,
      clickbait: r.score_clickbait,
      signals,
      scorerVersion: r.scorer_version,
    },
  };
}

/** Inserta tarjetas nuevas; las que ya existen se dejan como están. Devuelve cuántas entraron. */
export async function insertCards(db: SqlDb, cards: Card[]): Promise<number> {
  if (cards.length === 0) return 0;
  const sql = `insert into cards (${COLUMNS.join(', ')}) values (${COLUMNS.map(() => '?').join(', ')})
               on conflict do nothing`;
  let inserted = 0;
  await db.withTransactionAsync(async () => {
    for (const c of cards) {
      const r = await db.runAsync(sql, cardToParams(c));
      inserted += r.changes;
    }
  });
  return inserted;
}

export async function existingExternalIds(db: SqlDb, sourceId: string): Promise<Set<string>> {
  const rows = await db.getAllAsync<{ external_id: string }>(
    'select external_id from cards where source_id = ?',
    [sourceId],
  );
  return new Set(rows.map((r) => r.external_id));
}

export async function countCards(db: SqlDb): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>('select count(*) as n from cards', []);
  return row?.n ?? 0;
}

// --- Feed ------------------------------------------------------------------

export interface FeedCursor {
  ingestedAt: string;
  id: string;
}

export interface FeedPage {
  cards: Card[];
  /** null = no hay más tarjetas con estos filtros. */
  nextCursor: FeedCursor | null;
}

export interface FeedOptions {
  cursor?: FeedCursor | null;
  limit?: number;
  /** Oculta lo ya visto (por defecto sí: el feed no se repite). */
  hideSeen?: boolean;
  /** Solo estos tipos (p. ej. la sección Destacados pide solo `article`). */
  types?: CardType[];
  /** Tarjetas que ya están en pantalla: al traer más de la red, no se repiten. */
  excludeIds?: string[];
  /** Solo estas fuentes (p. ej. Destacados: `wikipedia-es`, `wikipedia-en`…). */
  sources?: string[];
}

const FEED_SQL = `
  select ${LIST_SELECT} from cards c
  where c.topic in (select value from json_each(?))
    and c.lang in (select value from json_each(?))
    and (? is null or c.type in (select value from json_each(?)))
    and (? is null or c.id not in (select value from json_each(?)))
    and (? is null or c.source_id in (select value from json_each(?)))
    and (? = 0 or c.score_sensational <= ?)
    and (? = 0 or c.score_clickbait   <= ?)
    and (? = 0 or c.source_kind <> 'news')
    and (? = 0 or not exists (select 1 from card_views v where v.card_id = c.id))
    and (? is null or (c.ingested_at, c.id) < (?, ?))
  order by c.ingested_at desc, c.id desc
  limit ?
`;

/**
 * Una página del scroll infinito. Las palabras bloqueadas se aplican aquí en JS
 * (sin acentos ni mayúsculas, igual que el scorer), así que pide de más y sigue
 * leyendo hasta llenar la página o agotar la base.
 */
export async function getFeedPage(db: SqlDb, prefs: FilterPrefs, opts: FeedOptions = {}): Promise<FeedPage> {
  const limit = Math.max(1, Math.min(opts.limit ?? 20, 100));
  const batch = limit * 2;
  const max = THRESHOLDS[prefs.level];
  const hideSeen = opts.hideSeen ?? true;

  let cursor = opts.cursor ?? null;
  const out: Card[] = [];
  const types = opts.types?.length ? JSON.stringify(opts.types) : null;
  const exclude = opts.excludeIds?.length ? JSON.stringify(opts.excludeIds) : null;
  const sources = opts.sources?.length ? JSON.stringify(opts.sources) : null;

  while (out.length < limit) {
    const rows = await db.getAllAsync<CardRow>(FEED_SQL, [
      JSON.stringify(prefs.topics),
      JSON.stringify(prefs.languages),
      types, types,
      exclude, exclude,
      sources, sources,
      bool(prefs.hideSensational), max,
      bool(prefs.hideClickbait), max,
      bool(prefs.onlyVerified),
      bool(hideSeen),
      cursor?.ingestedAt ?? null, cursor?.ingestedAt ?? null, cursor?.id ?? null,
      batch,
    ]);

    for (const row of rows) {
      cursor = { ingestedAt: row.ingested_at, id: row.id };
      const card = rowToCard(row);
      if (findBlockedWord(`${card.title} ${card.summary ?? ''}`, prefs.blockedWords)) continue;
      out.push(card);
      if (out.length === limit) return { cards: out, nextCursor: cursor };
    }

    if (rows.length < batch) return { cards: out, nextCursor: null };
  }
  return { cards: out, nextCursor: cursor };
}

export async function markSeen(db: SqlDb, cardIds: string[], now = new Date()): Promise<void> {
  if (cardIds.length === 0) return;
  const at = now.toISOString();
  await db.withTransactionAsync(async () => {
    for (const id of cardIds) {
      // Si la tarjeta ya se podó, la FK hace fallar el insert: se ignora.
      await db.runAsync(
        'insert or ignore into card_views (card_id, seen_at) select ?, ? where exists (select 1 from cards where id = ?)',
        [id, at, id],
      );
    }
  });
}

// --- Guardados -------------------------------------------------------------

export interface SavedCard {
  savedAt: string;
  card: Card;
}

/**
 * Guarda una copia completa. La tarjeta del feed llega sin `body` (no se carga en listas),
 * así que se completa desde la base: lo guardado se puede leer sin red y viaja en el respaldo.
 */
export async function saveCard(db: SqlDb, card: Card, now = new Date()): Promise<void> {
  const full = card.body ? card : ((await getStoredCard(db, card.id)) ?? card);
  await db.runAsync(
    'insert into saved_cards (card_id, saved_at, card_json) values (?, ?, ?) on conflict (card_id) do nothing',
    [card.id, now.toISOString(), JSON.stringify(full)],
  );
}

async function getStoredCard(db: SqlDb, id: string): Promise<Card | null> {
  const row = await db.getFirstAsync<CardRow>('select * from cards where id = ?', [id]);
  return row ? rowToCard(row) : null;
}

/** Una tarjeta completa (con `body`) para leerla: del feed o, si ya se podó, de los guardados. */
export async function getCard(db: SqlDb, id: string): Promise<Card | null> {
  const stored = await getStoredCard(db, id);
  if (stored) return stored;
  const saved = await db.getFirstAsync<{ card_json: string }>('select card_json from saved_cards where card_id = ?', [id]);
  if (!saved) return null;
  try {
    return JSON.parse(saved.card_json) as Card;
  } catch {
    return null;
  }
}

export async function unsaveCard(db: SqlDb, cardId: string): Promise<void> {
  await db.runAsync('delete from saved_cards where card_id = ?', [cardId]);
}

/** Ids de todo lo guardado: para pintar el ícono de guardar sin consultar tarjeta por tarjeta. */
export async function listSavedIds(db: SqlDb): Promise<Set<string>> {
  const rows = await db.getAllAsync<{ card_id: string }>('select card_id from saved_cards', []);
  return new Set(rows.map((r) => r.card_id));
}

export async function isSaved(db: SqlDb, cardId: string): Promise<boolean> {
  const row = await db.getFirstAsync<{ one: number }>('select 1 as one from saved_cards where card_id = ?', [cardId]);
  return row !== null;
}

export async function listSaved(db: SqlDb): Promise<SavedCard[]> {
  const rows = await db.getAllAsync<{ saved_at: string; card_json: string }>(
    'select saved_at, card_json from saved_cards order by saved_at desc, card_id',
    [],
  );
  const out: SavedCard[] = [];
  for (const r of rows) {
    try {
      out.push({ savedAt: r.saved_at, card: JSON.parse(r.card_json) as Card });
    } catch {
      /* fila dañada: se omite */
    }
  }
  return out;
}

// --- Mantenimiento ---------------------------------------------------------

/** Borra tarjetas del feed más viejas que `olderThan`. Los guardados no se tocan. */
export async function pruneCards(db: SqlDb, olderThan: Date): Promise<number> {
  const r = await db.runAsync('delete from cards where ingested_at < ?', [olderThan.toISOString()]);
  return r.changes;
}

/** Recalcula el puntaje de las tarjetas que se puntuaron con una versión anterior del scorer. */
export async function rescoreOutdated(db: SqlDb): Promise<number> {
  const rows = await db.getAllAsync<{ id: string; title: string; source_id: string }>(
    'select id, title, source_id from cards where scorer_version < ?',
    [SCORER_VERSION],
  );
  if (rows.length === 0) return 0;
  await db.withTransactionAsync(async () => {
    for (const r of rows) {
      const q = scoreCard({ title: r.title }, sourceKindOf(r.source_id));
      await db.runAsync(
        `update cards set score_sensational = ?, score_clickbait = ?, score_signals = ?, scorer_version = ?
         where id = ?`,
        [q.sensationalism, q.clickbait, JSON.stringify(q.signals), q.scorerVersion, r.id],
      );
    }
  });
  return rows.length;
}
