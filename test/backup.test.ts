import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  BackupError, backupFileName, exportBackup, importBackup, parseBackup, serializeBackup,
} from '../src/backup/backup.ts';
import { insertCards, listSaved, saveCard } from '../src/db/cards.ts';
import { DEFAULT_PREFS, getPrefs, setPrefs } from '../src/db/prefs.ts';
import { freshDb } from './helpers/node-db.ts';
import { makeCard } from './helpers/fixtures.ts';

const NOW = new Date('2026-11-17T18:00:00Z');

async function phoneWithData() {
  const db = await freshDb();
  const [a, b] = [makeCard({ title: 'Hokusai' }), makeCard({ title: 'Tardígrados' })];
  await insertCards(db, [a, b]);
  await saveCard(db, a, new Date('2026-11-10T00:00:00Z'));
  await saveCard(db, b, new Date('2026-11-12T00:00:00Z'));
  await setPrefs(db, { ...DEFAULT_PREFS, level: 'moderado', blockedWords: ['urgente'] });
  return { db, a, b };
}

test('exportar → importar en un teléfono nuevo deja todo igual', async () => {
  const { db } = await phoneWithData();
  const json = serializeBackup(await exportBackup(db, NOW));

  const exported = JSON.parse(json);
  assert.equal(exported.format, 'curio-backup');
  assert.equal(exported.saved.length, 2);

  const other = await freshDb();
  const { backup, rejected } = parseBackup(json);
  assert.equal(rejected, 0);
  const r = await importBackup(other, backup, 'replace');
  assert.deepEqual(r, { savedAdded: 2, savedKept: 0, savedRemoved: 0 });
  assert.deepEqual(await getPrefs(other), await getPrefs(db));
  assert.deepEqual(
    (await listSaved(other)).map((s) => [s.savedAt, s.card.title]),
    (await listSaved(db)).map((s) => [s.savedAt, s.card.title]),
  );
});

test('merge conserva lo local y suma palabras bloqueadas; replace lo sustituye', async () => {
  const { db } = await phoneWithData();
  const backup = parseBackup(serializeBackup(await exportBackup(db, NOW))).backup;

  const target = await freshDb();
  const local = makeCard({ title: 'Solo en este teléfono' });
  await saveCard(target, local);
  await setPrefs(target, { ...DEFAULT_PREFS, blockedWords: ['viral', 'URGENTE'] });

  const merged = await importBackup(target, backup, 'merge');
  assert.equal(merged.savedAdded, 2);
  assert.equal((await listSaved(target)).length, 3);
  const p = await getPrefs(target);
  assert.equal(p.level, 'moderado');
  assert.deepEqual(p.blockedWords, ['viral', 'URGENTE']); // "urgente" ya estaba, sin importar mayúsculas

  const again = await importBackup(target, backup, 'merge');
  assert.deepEqual(again, { savedAdded: 0, savedKept: 2, savedRemoved: 0 });

  const replaced = await importBackup(target, backup, 'replace');
  assert.equal(replaced.savedRemoved, 3);
  assert.deepEqual((await listSaved(target)).map((s) => s.card.title).sort(), ['Hokusai', 'Tardígrados']);
  assert.deepEqual((await getPrefs(target)).blockedWords, ['urgente']);
});

test('archivos inválidos dan errores claros', () => {
  assert.throws(() => parseBackup('no es json'), (e) => e instanceof BackupError && /JSON/.test(e.message));
  assert.throws(() => parseBackup('{"format":"otra-app"}'), /no es un respaldo de Curio/);
  assert.throws(() => parseBackup('{"format":"curio-backup","version":99}'), /versión más nueva/);
});

test('un respaldo editado a mano no puede colar URLs peligrosas ni puntajes falsos', () => {
  const card = makeCard({ title: '¡NO CREERÁS esto!' });
  const evil = {
    format: 'curio-backup',
    version: 1,
    prefs: { topics: ['arte', 'hackeo'], level: 'nivel-raro' },
    saved: [
      { savedAt: '2026-11-01T00:00:00Z', card: { ...card, quality: { sensationalism: 0, clickbait: 0, signals: [] } } },
      { savedAt: '2026-11-01T00:00:00Z', card: { ...makeCard(), url: 'javascript:alert(1)' } },
      { savedAt: '2026-11-01T00:00:00Z', card: { ...makeCard(), imageUrl: 'file:///etc/passwd' } },
      { savedAt: '2026-11-01T00:00:00Z', card: { ...makeCard(), topic: 'chismes' } },
      { nada: true },
    ],
  };
  const { backup, rejected } = parseBackup(JSON.stringify(evil));
  assert.equal(rejected, 3);
  assert.equal(backup.saved.length, 2);
  assert.ok(backup.saved[0].card.quality.sensationalism > 0, 'el puntaje se recalcula');
  assert.equal(backup.saved[1].card.imageUrl, undefined, 'imagen con esquema no http se descarta');
  assert.deepEqual(backup.prefs.topics, ['arte']);
  assert.equal(backup.prefs.level, DEFAULT_PREFS.level);
});

test('nombre del archivo con fecha', () => {
  assert.equal(backupFileName(NOW), 'curio-respaldo-2026-11-17.json');
});

test('el respaldo conserva idioma y texto completo, y valida los bloques', () => {
  const card = makeCard({ lang: 'fr', body: [{ kind: 'p', text: 'Texte complet.' }] });
  const text = JSON.stringify({
    format: 'curio-backup',
    version: 1,
    prefs: { languages: ['fr', 'es'] },
    saved: [
      { savedAt: '2026-11-01T00:00:00Z', card },
      {
        savedAt: '2026-11-01T00:00:00Z',
        card: { ...makeCard(), lang: 'klingon', body: [{ kind: 'img', src: 'javascript:x' }, { kind: 'p', text: 'ok' }] },
      },
    ],
  });
  const { backup } = parseBackup(text);
  assert.deepEqual(backup.prefs.languages, ['es', 'fr']);
  assert.equal(backup.saved[0].card.lang, 'fr');
  assert.deepEqual(backup.saved[0].card.body, [{ kind: 'p', text: 'Texte complet.' }]);
  assert.equal(backup.saved[1].card.lang, 'es');
  assert.deepEqual(backup.saved[1].card.body, [{ kind: 'p', text: 'ok' }]);
});
