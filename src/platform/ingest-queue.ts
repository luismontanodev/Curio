// Una sola ingesta a la vez. expo-sqlite comparte una conexión: dos transacciones
// intercaladas (la de al abrir y la de "traer más") fallarían o se mezclarían.

import type { SQLiteDatabase } from 'expo-sqlite';

import { runIngest, type IngestOptions, type IngestReport } from '../ingest/ingest.ts';

let tail: Promise<unknown> = Promise.resolve();

export function queueIngest(db: SQLiteDatabase, opts: IngestOptions = {}): Promise<IngestReport> {
  const run = tail.then(
    () => runIngest(db, fetch, opts),
    () => runIngest(db, fetch, opts),
  );
  tail = run.catch(() => undefined);
  return run;
}
