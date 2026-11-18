// Respaldo del usuario como JSON legible: sus preferencias y sus guardados.
// El archivo es del usuario: lo puede leer, editar, guardar donde quiera o llevar a otro teléfono.
// Al importar se trata como entrada NO confiable: se valida campo por campo y los puntajes se recalculan.

import { CARD_TYPES, LANGS, TOPICS, type AppPrefs, type Card, type CardType, type Lang, type Topic } from '../core/types.ts';
import { parseBlocks } from '../core/blocks.ts';
import { SCORER_VERSION, scoreCard } from '../core/scorer.ts';
import { sourceKindOf } from '../core/sources.ts';
import { listSaved, type SavedCard } from '../db/cards.ts';
import { getPrefs, sanitizePrefs, setPrefs, dedupeWords } from '../db/prefs.ts';
import type { SqlDb } from '../db/sql.ts';

export const BACKUP_FORMAT = 'curio-backup';
export const BACKUP_VERSION = 1;
export const MAX_BACKUP_BYTES = 20 * 1024 * 1024;
const MAX_TEXT = 5_000;

export interface Backup {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  scorerVersion: number;
  prefs: AppPrefs;
  saved: SavedCard[];
}

export class BackupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackupError';
  }
}

// --- Exportar --------------------------------------------------------------

export async function exportBackup(db: SqlDb, now = new Date()): Promise<Backup> {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    scorerVersion: SCORER_VERSION,
    prefs: await getPrefs(db),
    saved: await listSaved(db),
  };
}

/** Con sangría: el usuario puede abrirlo y entenderlo. */
export function serializeBackup(b: Backup): string {
  return `${JSON.stringify(b, null, 2)}\n`;
}

export function backupFileName(now = new Date()): string {
  return `curio-respaldo-${now.toISOString().slice(0, 10)}.json`;
}

// --- Leer y validar --------------------------------------------------------

export interface ParsedBackup {
  backup: Backup;
  /** Guardados descartados por venir incompletos o con datos inválidos. */
  rejected: number;
}

export function parseBackup(text: string): ParsedBackup {
  if (text.length > MAX_BACKUP_BYTES) throw new BackupError('El archivo es demasiado grande para ser un respaldo de Curio.');

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new BackupError('El archivo no es JSON válido.');
  }
  if (!isObject(data) || data.format !== BACKUP_FORMAT) {
    throw new BackupError('Este archivo no es un respaldo de Curio.');
  }
  if (typeof data.version !== 'number' || data.version > BACKUP_VERSION) {
    throw new BackupError('El respaldo viene de una versión más nueva de Curio. Actualiza la app para importarlo.');
  }

  const savedIn = Array.isArray(data.saved) ? data.saved : [];
  const saved: SavedCard[] = [];
  let rejected = 0;
  for (const item of savedIn) {
    const parsed = parseSaved(item);
    if (parsed) saved.push(parsed);
    else rejected++;
  }

  return {
    backup: {
      format: BACKUP_FORMAT,
      version: data.version,
      exportedAt: typeof data.exportedAt === 'string' ? data.exportedAt : '',
      scorerVersion: SCORER_VERSION,
      prefs: sanitizePrefs(data.prefs),
      saved,
    },
    rejected,
  };
}

function parseSaved(item: unknown): SavedCard | null {
  if (!isObject(item) || !isObject(item.card)) return null;
  const c = item.card;

  const id = str(c.id, 300);
  const sourceId = str(c.sourceId, 100);
  const externalId = str(c.externalId, 300);
  const title = str(c.title, 500);
  const url = httpUrl(c.url);
  if (!id || !sourceId || !externalId || !title || !url) return null;
  if (!TOPICS.includes(c.topic as Topic) || !CARD_TYPES.includes(c.type as CardType)) return null;

  const savedAt = isoDate(item.savedAt) ?? new Date(0).toISOString();
  const readMinutes =
    typeof c.readMinutes === 'number' && Number.isInteger(c.readMinutes) && c.readMinutes > 0 && c.readMinutes < 600
      ? c.readMinutes
      : undefined;

  const card: Card = {
    id,
    sourceId,
    externalId,
    type: c.type as CardType,
    topic: c.topic as Topic,
    lang: LANGS.includes(c.lang as Lang) ? (c.lang as Lang) : 'es',
    title,
    summary: str(c.summary, MAX_TEXT),
    imageUrl: httpUrl(c.imageUrl),
    url,
    license: str(c.license, 200),
    readMinutes,
    publishedAt: isoDate(c.publishedAt),
    ingestedAt: isoDate(c.ingestedAt) ?? savedAt,
    // Texto completo: bloques simples validados uno por uno (solo imágenes https).
    ...(parseBlocks(c.body).length ? { body: parseBlocks(c.body) } : {}),
    // Nunca se confía en el puntaje del archivo: se recalcula con el scorer de esta app.
    quality: scoreCard({ title }, sourceKindOf(sourceId)),
  };
  return { savedAt, card };
}

// --- Importar --------------------------------------------------------------

export type ImportMode = 'merge' | 'replace';

export interface ImportReport {
  savedAdded: number;
  savedKept: number; // ya existían (merge)
  savedRemoved: number; // borrados antes de importar (replace)
}

/**
 * merge   — conserva lo que hay; agrega guardados nuevos, las preferencias del archivo
 *           mandan, pero las palabras bloqueadas se suman.
 * replace — el teléfono queda exactamente como el respaldo (preferencias y guardados).
 */
export async function importBackup(db: SqlDb, backup: Backup, mode: ImportMode): Promise<ImportReport> {
  const report: ImportReport = { savedAdded: 0, savedKept: 0, savedRemoved: 0 };

  await db.withTransactionAsync(async () => {
    if (mode === 'replace') {
      const r = await db.runAsync('delete from saved_cards', []);
      report.savedRemoved = r.changes;
      await setPrefs(db, backup.prefs);
    } else {
      const current = await getPrefs(db);
      await setPrefs(db, {
        ...backup.prefs,
        blockedWords: dedupeWords([...current.blockedWords, ...backup.prefs.blockedWords]),
      });
    }

    for (const s of backup.saved) {
      const r = await db.runAsync(
        'insert into saved_cards (card_id, saved_at, card_json) values (?, ?, ?) on conflict (card_id) do nothing',
        [s.card.id, s.savedAt, JSON.stringify(s.card)],
      );
      if (r.changes > 0) report.savedAdded++;
      else report.savedKept++;
    }
  });

  return report;
}

// --- utilidades ------------------------------------------------------------

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function str(v: unknown, max: number): string | undefined {
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t ? t.slice(0, max) : undefined;
}

/** Solo http(s): un respaldo editado no debe poder colar `javascript:` u otros esquemas. */
function httpUrl(v: unknown): string | undefined {
  if (typeof v !== 'string' || v.length > 2_000) return undefined;
  try {
    const u = new URL(v);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : undefined;
  } catch {
    return undefined;
  }
}

function isoDate(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const t = Date.parse(v);
  return Number.isNaN(t) ? undefined : new Date(t).toISOString();
}
