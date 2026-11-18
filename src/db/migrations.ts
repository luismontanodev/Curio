// Migraciones de la base local (SQLite en el teléfono).
// La versión aplicada vive en PRAGMA user_version. Nunca edites una migración
// publicada: agrega una nueva al final.

import type { SqlDb } from './sql.ts';

export interface Migration {
  version: number;
  name: string;
  sql: string;
}

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: 'esquema inicial',
    sql: `
      create table cards (
        id                text primary key,           -- '<source_id>:<external_id>'
        source_id         text not null,
        source_kind       text not null,              -- copia de la fuente: evita joins
        external_id       text not null,
        type              text not null,
        topic             text not null,
        lang              text not null,
        title             text not null,
        summary           text,
        image_url         text,
        url               text not null,
        license           text,
        read_minutes      integer,
        published_at      text,                       -- ISO 8601
        ingested_at       text not null,              -- ISO 8601, también es la clave del feed
        score_sensational real not null,
        score_clickbait   real not null,
        score_signals     text not null default '[]', -- JSON
        scorer_version    integer not null,
        unique (source_id, external_id)
      );
      create index cards_feed_idx on cards (ingested_at desc, id desc);
      create index cards_topic_idx on cards (topic, ingested_at desc);
      create index cards_scorer_idx on cards (scorer_version);

      -- Tarjetas vistas: para no repetirlas en el feed.
      create table card_views (
        card_id text primary key references cards (id) on delete cascade,
        seen_at text not null
      );

      -- Guardados: copia completa de la tarjeta, sobrevive a la poda del feed
      -- y es lo que viaja en el respaldo JSON.
      create table saved_cards (
        card_id   text primary key,
        saved_at  text not null,
        card_json text not null
      );
      create index saved_cards_saved_at_idx on saved_cards (saved_at desc);

      -- Clave-valor: preferencias y estado de la app (última ingesta, etc.).
      create table kv (
        key   text primary key,
        value text not null
      );
    `,
  },
  {
    version: 2,
    name: 'texto completo e índice por idioma',
    sql: `
      -- Bloques de texto (JSON) para leer dentro de la app cuando la fuente da el artículo completo.
      alter table cards add column body text;
      create index cards_lang_idx on cards (lang, ingested_at desc);
    `,
  },
  {
    version: 3,
    name: 'capítulos de momentos (v2, en desuso)',
    sql: `
      -- EN DESUSO: los capítulos de 10 se reemplazaron por el scroll infinito de Momentos.
      -- La migración se conserva porque ya se aplicó en dispositivos (nunca edites ni quites
      -- una publicada). La tabla queda vacía; una migración futura puede borrarla.
      create table chapters (
        id           text primary key,
        number       integer not null,
        title        text not null,
        created_at   text not null,
        completed_at text,
        position     integer not null default 0,
        seen         integer,
        rating       text check (rating in ('yes', 'no')),
        moments_json text not null
      );
      create index chapters_created_idx on chapters (created_at desc);
    `,
  },
];

/**
 * Lleva la base a la última versión. Úsalo como `onInit` de <SQLiteProvider>.
 * Cada migración corre en su propia transacción junto con el cambio de versión.
 */
export async function migrate(db: SqlDb): Promise<number> {
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version', []);
  let current = row?.user_version ?? 0;

  const latest = MIGRATIONS.at(-1)?.version ?? 0;
  if (current > latest) {
    throw new Error(
      `La base local está en la versión ${current} y esta app solo conoce hasta la ${latest}. ` +
        'Actualiza la app.',
    );
  }

  for (const m of MIGRATIONS) {
    if (m.version <= current) continue;
    await db.withTransactionAsync(async () => {
      await db.execAsync(m.sql);
      await db.execAsync(`PRAGMA user_version = ${m.version}`);
    });
    current = m.version;
  }
  return current;
}
