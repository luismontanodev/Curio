import { test } from 'node:test';
import assert from 'node:assert/strict';

import { MIGRATIONS, migrate } from '../src/db/migrations.ts';
import {
  countCards, getFeedPage, insertCards, isSaved, listSaved, markSeen, pruneCards, rescoreOutdated,
  saveCard, unsaveCard,
} from '../src/db/cards.ts';
import { DEFAULT_PREFS, getPrefs, sanitizePrefs, setPrefs } from '../src/db/prefs.ts';
import { SCORER_VERSION } from '../src/core/scorer.ts';
import { freshDb, openNodeDb } from './helpers/node-db.ts';
import { makeCard } from './helpers/fixtures.ts';

const prefs = { ...DEFAULT_PREFS, onlyVerified: false };

test('migrate deja la base en la última versión y es idempotente', async () => {
  const db = openNodeDb();
  assert.equal(await migrate(db), MIGRATIONS.at(-1)!.version);
  assert.equal(await migrate(db), MIGRATIONS.at(-1)!.version);
  const tables = await db.getAllAsync<{ name: string }>("select name from sqlite_master where type = 'table' order by name", []);
  assert.deepEqual(tables.map((t) => t.name), ['card_views', 'cards', 'chapters', 'kv', 'saved_cards']);
});

test('migrate rechaza una base de una versión más nueva', async () => {
  const db = openNodeDb();
  await db.execAsync('PRAGMA user_version = 999');
  await assert.rejects(migrate(db), /Actualiza la app/);
});

test('insertCards ignora duplicados', async () => {
  const db = await freshDb();
  const c = makeCard();
  assert.equal(await insertCards(db, [c, makeCard()]), 2);
  assert.equal(await insertCards(db, [c]), 0);
  assert.equal(await countCards(db), 2);
});

test('el feed pagina por cursor sin repetir ni saltar tarjetas', async () => {
  const db = await freshDb();
  const cards = Array.from({ length: 25 }, () => makeCard());
  await insertCards(db, cards);

  const seen: string[] = [];
  let cursor = null;
  let pages = 0;
  do {
    const page = await getFeedPage(db, prefs, { cursor, limit: 10, hideSeen: false });
    seen.push(...page.cards.map((c) => c.id));
    cursor = page.nextCursor;
    pages++;
  } while (cursor && pages < 10);

  assert.equal(seen.length, 25);
  assert.equal(new Set(seen).size, 25);
  // del más nuevo al más viejo
  assert.deepEqual(seen, [...cards].reverse().map((c) => c.id));
});

test('el feed aplica temas, umbrales, fuentes y palabras bloqueadas', async () => {
  const db = await freshDb();
  await insertCards(db, [
    makeCard({ id: 'a', title: 'Hokusai y el monte Fuji', topic: 'arte' }),
    makeCard({ id: 'b', title: '¡NO CREERÁS lo que encontraron!', topic: 'ciencia', sourceId: 'otro-medio' }),
    makeCard({ id: 'c', title: 'Tardígrados y criptobiosis', topic: 'ciencia' }),
    makeCard({ id: 'd', title: 'Historia de la ópera', topic: 'musica' }),
    makeCard({ id: 'e', title: 'La polémica bienal de Venecia', topic: 'cultura' }),
  ]);

  const page = await getFeedPage(db, { ...prefs, blockedWords: ['venecia'] }, { limit: 10 });
  assert.deepEqual(page.cards.map((c) => c.id).sort(), ['a', 'c']);
  assert.equal(page.nextCursor, null);

  const lax = await getFeedPage(db, { ...prefs, level: 'suave', hideSensational: false, hideClickbait: false, topics: ['ciencia'] }, { limit: 10 });
  assert.deepEqual(lax.cards.map((c) => c.id).sort(), ['b', 'c']);
});

test('palabras bloqueadas no dejan la página corta si hay más tarjetas', async () => {
  const db = await freshDb();
  // 5 permitidas (más viejas) debajo de 30 bloqueadas (más nuevas): la consulta
  // debe recorrer varios lotes de 10 hasta encontrarlas.
  const cards = [
    ...Array.from({ length: 5 }, () => makeCard()),
    ...Array.from({ length: 30 }, () => makeCard({ title: 'Tema bloqueado aquí' })),
  ];
  await insertCards(db, cards);
  const page = await getFeedPage(db, { ...prefs, blockedWords: ['bloqueado'] }, { limit: 5 });
  assert.equal(page.cards.length, 5);
  assert.ok(page.cards.every((c) => c.title.startsWith('Artículo de prueba')));

  const next = await getFeedPage(db, { ...prefs, blockedWords: ['bloqueado'] }, { limit: 5, cursor: page.nextCursor });
  assert.equal(next.cards.length, 0);
  assert.equal(next.nextCursor, null);
});

test('las tarjetas vistas salen del feed', async () => {
  const db = await freshDb();
  const [a, b] = [makeCard(), makeCard()];
  await insertCards(db, [a, b]);
  await markSeen(db, [b.id, 'no-existe']);
  const page = await getFeedPage(db, prefs, { limit: 10 });
  assert.deepEqual(page.cards.map((c) => c.id), [a.id]);
});

test('guardados sobreviven a la poda; los vistos se borran en cascada', async () => {
  const db = await freshDb();
  const old = makeCard({ ingestedAt: '2026-01-01T00:00:00.000Z' });
  const kept = makeCard({ ingestedAt: '2026-01-02T00:00:00.000Z' });
  await insertCards(db, [old, kept]);
  await markSeen(db, [old.id]);
  await saveCard(db, kept);

  assert.equal(await pruneCards(db, new Date('2026-06-01T00:00:00Z')), 2);
  assert.equal(await countCards(db), 0);
  const views = await db.getFirstAsync<{ n: number }>('select count(*) as n from card_views', []);
  assert.equal(views?.n, 0);

  const saved = await listSaved(db);
  assert.equal(saved.length, 1);
  assert.equal(saved[0].card.title, kept.title);
  assert.equal(await isSaved(db, kept.id), true);
  await unsaveCard(db, kept.id);
  assert.equal(await isSaved(db, kept.id), false);
});

test('rescoreOutdated recalcula tarjetas de un scorer anterior', async () => {
  const db = await freshDb();
  const c = makeCard({ title: '¡Escándalo IMPACTANTE!' });
  await insertCards(db, [c]);
  await db.runAsync('update cards set scorer_version = 0, score_sensational = 0', []);
  assert.equal(await rescoreOutdated(db), 1);
  const row = await db.getFirstAsync<{ s: number; v: number }>('select score_sensational s, scorer_version v from cards', []);
  assert.ok(row!.s > 2.5);
  assert.equal(row!.v, SCORER_VERSION);
  assert.equal(await rescoreOutdated(db), 0);
});

test('preferencias: defaults, guardado y saneado', async () => {
  const db = await freshDb();
  assert.deepEqual(await getPrefs(db), DEFAULT_PREFS);
  await setPrefs(db, { ...DEFAULT_PREFS, level: 'suave', blockedWords: [' Viral ', 'viral', '', 'urgente'] });
  const p = await getPrefs(db);
  assert.equal(p.level, 'suave');
  assert.deepEqual(p.blockedWords, ['Viral', 'urgente']);

  const s = sanitizePrefs({ topics: ['arte', 'chismes'], level: 'extremo', pauseEvery: 1, onlyVerified: 'sí' });
  assert.deepEqual(s.topics, ['arte']);
  assert.equal(s.level, DEFAULT_PREFS.level);
  assert.equal(s.pauseEvery, 5);
  assert.equal(s.onlyVerified, DEFAULT_PREFS.onlyVerified);
  assert.deepEqual(sanitizePrefs({ topics: [] }).topics, DEFAULT_PREFS.topics);
  assert.equal(sanitizePrefs({ pauseEvery: null }).pauseEvery, null);
});
