// Feed por idioma, sección Destacados, "traer más" sin repetir y texto completo para leer en la app.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { getCard, getFeedPage, insertCards, listSaved, pruneCards, saveCard } from '../src/db/cards.ts';
import { DEFAULT_PREFS, getPrefs, sanitizePrefs, setKv, upgradeStoredPrefs } from '../src/db/prefs.ts';
import { MIGRATIONS } from '../src/db/migrations.ts';
import { freshDb } from './helpers/node-db.ts';
import { makeCard } from './helpers/fixtures.ts';

const prefs = { ...DEFAULT_PREFS, onlyVerified: false };

test('el feed solo muestra los idiomas elegidos', async () => {
  const db = await freshDb();
  const es = makeCard({ lang: 'es' });
  const en = makeCard({ lang: 'en' });
  const fr = makeCard({ lang: 'fr' });
  await insertCards(db, [es, en, fr]);

  const ids = async (languages: typeof prefs.languages) =>
    (await getFeedPage(db, { ...prefs, languages })).cards.map((c) => c.id).sort();
  assert.deepEqual(await ids(['es']), [es.id]);
  assert.deepEqual(await ids(['es', 'fr']), [es.id, fr.id].sort());
  assert.equal((await getFeedPage(db, { ...prefs, languages: ['en'] })).cards[0].lang, 'en');
});

test('`types` filtra por tipo y `excludeIds` no repite lo que ya está en pantalla', async () => {
  const db = await freshDb();
  const a = makeCard({ type: 'article' });
  const b = makeCard({ type: 'article' });
  const ev = makeCard({ type: 'event' });
  await insertCards(db, [a, b, ev]);

  const onlyArticles = await getFeedPage(db, prefs, { types: ['article'], hideSeen: false });
  assert.deepEqual(onlyArticles.cards.map((c) => c.id).sort(), [a.id, b.id].sort());

  const rest = await getFeedPage(db, prefs, { excludeIds: [a.id, ev.id] });
  assert.deepEqual(rest.cards.map((c) => c.id), [b.id]);

  const conv = makeCard({ type: 'article', sourceId: 'theconversation' });
  await insertCards(db, [conv]);
  const wikiOnly = await getFeedPage(db, prefs, { types: ['article'], sources: ['wikipedia-es'], hideSeen: false });
  assert.ok(!wikiOnly.cards.some((c) => c.id === conv.id));
  assert.equal(wikiOnly.cards.length, 2);
});

test('el feed no carga el texto completo; getCard sí, y también desde guardados tras la poda', async () => {
  const db = await freshDb();
  const body = [{ kind: 'p' as const, text: 'Texto completo del artículo.' }];
  const c = makeCard({ body, ingestedAt: '2026-01-01T00:00:00.000Z' });
  await insertCards(db, [c]);

  const [listed] = (await getFeedPage(db, prefs)).cards;
  assert.equal(listed.body, undefined);
  assert.deepEqual((await getCard(db, c.id))?.body, body);

  // Guardar desde el feed (sin body) completa la copia con el texto de la base.
  await saveCard(db, listed);
  assert.deepEqual((await listSaved(db))[0].card.body, body);

  await pruneCards(db, new Date('2026-06-01T00:00:00Z'));
  assert.deepEqual((await getCard(db, c.id))?.body, body);
  assert.equal(await getCard(db, 'no:existe'), null);
});

test('migración 2 agrega `body` sin perder tarjetas', async () => {
  assert.ok(MIGRATIONS.some((m) => m.version === 2));
  const db = await freshDb();
  const cols = await db.getAllAsync<{ name: string }>("select name from pragma_table_info('cards')", []);
  assert.ok(cols.some((c) => c.name === 'body'));
});

test('idiomas en preferencias: por defecto español, al menos uno, solo conocidos', () => {
  assert.deepEqual(DEFAULT_PREFS.languages, ['es']);
  assert.deepEqual(sanitizePrefs({ languages: ['fr', 'xx', 'es', 'fr'] }).languages, ['es', 'fr']);
  assert.deepEqual(sanitizePrefs({ languages: [] }).languages, ['es']);
  assert.ok(DEFAULT_PREFS.topics.includes('tecnologia'));
});

test('preferencias guardadas por una versión anterior ganan Tecnología; las nuevas no se tocan', async () => {
  assert.ok(upgradeStoredPrefs({ topics: ['arte'] }).topics.includes('tecnologia'));
  assert.deepEqual(upgradeStoredPrefs({ topics: ['arte'], languages: ['es'] }).topics, ['arte']);
  // Un respaldo importado no pasa por aquí: sanitizePrefs respeta lo que eligió el usuario.
  assert.deepEqual(sanitizePrefs({ topics: ['arte'] }).topics, ['arte']);

  const db = await freshDb();
  await setKv(db, 'prefs', JSON.stringify({ topics: ['ciencia'], level: 'suave' }));
  const p = await getPrefs(db);
  assert.deepEqual(p.topics, ['ciencia', 'tecnologia']);
  assert.equal(p.level, 'suave');
});
