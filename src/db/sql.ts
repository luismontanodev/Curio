// Contrato mínimo de base de datos.
// Es el mismo subconjunto de métodos que expone `SQLiteDatabase` de expo-sqlite,
// así que en la app se pasa la conexión de Expo tal cual, y en los tests un
// adaptador sobre node:sqlite. El resto del código no sabe en qué plataforma corre.

export type SqlValue = string | number | null;

export interface SqlDb {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, params: SqlValue[]): Promise<{ changes: number }>;
  getFirstAsync<T>(sql: string, params: SqlValue[]): Promise<T | null>;
  getAllAsync<T>(sql: string, params: SqlValue[]): Promise<T[]>;
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
}

export const bool = (b: boolean): number => (b ? 1 : 0);
