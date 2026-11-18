// Preferencias del usuario, guardadas como JSON en la tabla kv.

import {
  FILTER_LEVELS, LANGS, THEME_PREFS, TOPICS,
  type AppPrefs, type FilterLevel, type ThemePref, type Topic,
} from '../core/types.ts';
import type { SqlDb } from './sql.ts';

export const DEFAULT_PREFS: AppPrefs = {
  topics: ['ciencia', 'tecnologia', 'arte', 'cultura', 'historia', 'naturaleza'],
  level: 'estricto',
  hideSensational: true,
  hideClickbait: true,
  onlyVerified: true,
  blockedWords: [],
  languages: ['es'],
  pauseEvery: 20,
  theme: 'system',
};

/** Valor de "Pausa sugerida" cuando el usuario la enciende. */
export const DEFAULT_PAUSE_EVERY = 20;

export const MAX_BLOCKED_WORDS = 200;
export const MAX_BLOCKED_WORD_LENGTH = 60;

const PREFS_KEY = 'prefs';

/**
 * Convierte cualquier valor (JSON guardado, archivo importado) en preferencias válidas.
 * Lo que no se entiende cae al valor por defecto en lugar de romper la app.
 */
export function sanitizePrefs(input: unknown): AppPrefs {
  const o = (typeof input === 'object' && input !== null ? input : {}) as Record<string, unknown>;
  const d = DEFAULT_PREFS;

  const topics = Array.isArray(o.topics)
    ? [...new Set(o.topics.filter((t): t is Topic => TOPICS.includes(t as Topic)))]
    : d.topics;

  const languages = Array.isArray(o.languages)
    ? LANGS.filter((l) => (o.languages as unknown[]).includes(l))
    : d.languages;

  const level = FILTER_LEVELS.includes(o.level as FilterLevel) ? (o.level as FilterLevel) : d.level;

  const blockedWords = Array.isArray(o.blockedWords)
    ? dedupeWords(o.blockedWords.filter((w): w is string => typeof w === 'string'))
    : d.blockedWords;

  let pauseEvery: number | null = d.pauseEvery;
  if (o.pauseEvery === null) pauseEvery = null;
  else if (typeof o.pauseEvery === 'number' && Number.isInteger(o.pauseEvery)) {
    pauseEvery = Math.min(Math.max(o.pauseEvery, 5), 200);
  }

  const flag = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback);

  return {
    topics: topics.length > 0 ? topics : d.topics, // un feed sin temas no tiene sentido
    level,
    hideSensational: flag(o.hideSensational, d.hideSensational),
    hideClickbait: flag(o.hideClickbait, d.hideClickbait),
    onlyVerified: flag(o.onlyVerified, d.onlyVerified),
    blockedWords,
    languages: languages.length > 0 ? languages : d.languages, // al menos un idioma
    pauseEvery,
    theme: THEME_PREFS.includes(o.theme as ThemePref) ? (o.theme as ThemePref) : d.theme,
  };
}

/** Recorta, quita vacías y repetidas (sin importar mayúsculas), y aplica límites. */
export function dedupeWords(words: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of words) {
    const w = raw.trim().slice(0, MAX_BLOCKED_WORD_LENGTH);
    const key = w.toLocaleLowerCase('es');
    if (!w || seen.has(key)) continue;
    seen.add(key);
    out.push(w);
    if (out.length >= MAX_BLOCKED_WORDS) break;
  }
  return out;
}

/**
 * Preferencias guardadas en este teléfono por una versión anterior (sin `languages`):
 * Tecnología no existía, así que entra encendida, igual que para quien instala hoy.
 * No se aplica a respaldos importados: ahí manda lo que el usuario eligió.
 */
export function upgradeStoredPrefs(stored: unknown): AppPrefs {
  const prefs = sanitizePrefs(stored);
  const old = typeof stored === 'object' && stored !== null && !('languages' in stored);
  if (old && !prefs.topics.includes('tecnologia')) prefs.topics = [...prefs.topics, 'tecnologia'];
  return prefs;
}

export async function getPrefs(db: SqlDb): Promise<AppPrefs> {
  const row = await db.getFirstAsync<{ value: string }>('select value from kv where key = ?', [PREFS_KEY]);
  if (!row) return { ...DEFAULT_PREFS };
  try {
    return upgradeStoredPrefs(JSON.parse(row.value));
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export async function setPrefs(db: SqlDb, prefs: AppPrefs): Promise<AppPrefs> {
  const clean = sanitizePrefs(prefs);
  await setKv(db, PREFS_KEY, JSON.stringify(clean));
  return clean;
}

export async function getKv(db: SqlDb, key: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string }>('select value from kv where key = ?', [key]);
  return row?.value ?? null;
}

export async function setKv(db: SqlDb, key: string, value: string): Promise<void> {
  await db.runAsync(
    'insert into kv (key, value) values (?, ?) on conflict (key) do update set value = excluded.value',
    [key, value],
  );
}
