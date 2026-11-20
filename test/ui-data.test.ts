// Datos que necesitan las pantallas: tema y guardados.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { insertCards, listSavedIds, saveCard } from '../src/db/cards.ts';
import { DEFAULT_PREFS, getPrefs, sanitizePrefs, setPrefs } from '../src/db/prefs.ts';
import { exportBackup, importBackup, parseBackup, serializeBackup } from '../src/backup/backup.ts';
import { freshDb } from './helpers/node-db.ts';
import { makeCard } from './helpers/fixtures.ts';

const prefs = { ...DEFAULT_PREFS, onlyVerified: false };

test('la preferencia de tema se sanea y por defecto es oscura (quien eligió "sistema" lo conserva)', async () => {
  assert.equal(DEFAULT_PREFS.theme, 'dark');
  assert.equal(sanitizePrefs({ theme: 'system' }).theme, 'system');
  assert.equal(sanitizePrefs({ theme: 'neón' }).theme, 'dark');
  assert.equal(sanitizePrefs({}).theme, 'dark');

  const db = await freshDb();
  await setPrefs(db, { ...DEFAULT_PREFS, theme: 'light' });
  assert.equal((await getPrefs(db)).theme, 'light');
});

test('el tema viaja en el respaldo', async () => {
  const source = await freshDb();
  await setPrefs(source, { ...DEFAULT_PREFS, theme: 'dark' });
  const text = serializeBackup(await exportBackup(source));

  const target = await freshDb();
  await importBackup(target, parseBackup(text).backup, 'replace');
  assert.equal((await getPrefs(target)).theme, 'dark');
});

test('listSavedIds devuelve los ids guardados', async () => {
  const db = await freshDb();
  const [a, b] = [makeCard(), makeCard()];
  await insertCards(db, [a, b]);
  await saveCard(db, a);
  assert.deepEqual([...(await listSavedIds(db))], [a.id]);
});
