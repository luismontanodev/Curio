// Adaptador de node:sqlite con la misma forma que SQLiteDatabase de expo-sqlite.
// Permite probar el SQL real (el mismo motor SQLite) sin un teléfono.

import { DatabaseSync } from 'node:sqlite';
import type { SqlDb, SqlValue } from '../../src/db/sql.ts';
import { migrate } from '../../src/db/migrations.ts';

export function openNodeDb(path = ':memory:'): SqlDb & { close(): void } {
  const d = new DatabaseSync(path);
  let depth = 0;
  return {
    async execAsync(sql: string) {
      d.exec(sql);
    },
    async runAsync(sql: string, params: SqlValue[]) {
      const r = d.prepare(sql).run(...params);
      return { changes: Number(r.changes) };
    },
    async getFirstAsync<T>(sql: string, params: SqlValue[]) {
      return ((d.prepare(sql).get(...params) as T | undefined) ?? null);
    },
    async getAllAsync<T>(sql: string, params: SqlValue[]) {
      return d.prepare(sql).all(...params) as T[];
    },
    async withTransactionAsync(task: () => Promise<void>) {
      // Como en expo-sqlite, una transacción anidada se ejecuta dentro de la externa.
      if (depth > 0) return task();
      depth++;
      d.exec('BEGIN');
      try {
        await task();
        d.exec('COMMIT');
      } catch (e) {
        d.exec('ROLLBACK');
        throw e;
      } finally {
        depth--;
      }
    },
    close() {
      d.close();
    },
  };
}

export async function freshDb() {
  const db = openNodeDb();
  await migrate(db);
  return db;
}
