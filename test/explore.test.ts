// Explorar: recomendación local por intención, búsqueda (teléfono + Wikipedia) y Destacados.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { affinityFrom, recommend, scoreFor } from '../src/core/recommend.ts';
import { getFeedPage, insertCards, searchCards } from '../src/db/cards.ts';
import { DEFAULT_PREFS } from '../src/db/prefs.ts';
import { searchWikipedia, wikipediaSearchUrl } from '../src/ingest/search.ts';
import { actionApi } from '../src/ingest/wikipedia.ts';
import { cardKicker } from '../src/ui/format.ts';
import { freshDb } from './helpers/node-db.ts';
import { fakeFetch, makeCard } from './helpers/fixtures.ts';

const NOW = new Date('2026-11-17T12:00:00Z');
const prefs = { ...DEFAULT_PREFS, onlyVerified: false };
const fixture = (name: string) => JSON.parse(readFileSync(join(import.meta.dirname, 'fixtures', name), 'utf8'));

// --- Recomendación -----------------------------------------------------------

test('sin guardados no hay afinidad: manda la frescura y todo es "nuevo para ti"', () => {
  const fresh = makeCard({ ingestedAt: '2026-11-17T00:00:00.000Z' });
  const old = makeCard({ ingestedAt: '2026-10-01T00:00:00.000Z' });
  const recs = recommend([old, fresh], [], { now: NOW });
  assert.deepEqual(recs.map((r) => r.card.id), [fresh.id, old.id]);
  assert.ok(recs.every((r) => r.reason.kind === 'new'));
});

test('lo guardado sube su tema y dice por qué', () => {
  const saved = [makeCard({ topic: 'arte' }), makeCard({ topic: 'arte' }), makeCard({ topic: 'ciencia' })];
  const art = makeCard({ topic: 'arte', ingestedAt: '2026-11-10T00:00:00.000Z' });
  const sci = makeCard({ topic: 'historia', ingestedAt: '2026-11-17T00:00:00.000Z' });
  const [first] = recommend([sci, art], saved, { now: NOW });
  assert.equal(first.card.id, art.id);
  assert.deepEqual(first.reason, { kind: 'topic', topic: 'arte' });
  assert.equal(affinityFrom(saved).total, 3);
});

test('el puntaje castiga un poco lo sensacionalista aunque pase el filtro, y premia la imagen', () => {
  const aff = affinityFrom([]);
  const calm = makeCard({ title: 'El canal de Suez', ingestedAt: NOW.toISOString() });
  const loud = makeCard({ title: '¡Increíble! El canal de Suez', ingestedAt: NOW.toISOString() });
  assert.ok(scoreFor(calm, aff, NOW).score > scoreFor(loud, aff, NOW).score);
  const withImage = makeCard({ title: 'El canal de Suez', imageUrl: 'https://x/y.jpg', ingestedAt: NOW.toISOString() });
  assert.ok(scoreFor(withImage, aff, NOW).score > scoreFor(calm, aff, NOW).score);
});

test('recommend no pone más de 2 seguidas del mismo tema (no es una burbuja), también entre páginas', () => {
  const saved = Array.from({ length: 5 }, () => makeCard({ topic: 'arte' }));
  const cards = [
    ...Array.from({ length: 6 }, () => makeCard({ topic: 'arte' })),
    ...Array.from({ length: 3 }, () => makeCard({ topic: 'ciencia' })),
  ];
  const page1 = recommend(cards, saved, { now: NOW, limit: 4 });
  const rest = cards.filter((c) => !page1.some((r) => r.card.id === c.id));
  const page2 = recommend(rest, saved, { now: NOW, after: page1.map((r) => r.card) });
  const topics = [...page1, ...page2].map((r) => r.card.topic);
  for (let i = 2; i < topics.length - 2; i++) {
    assert.ok(!(topics[i - 2] === topics[i - 1] && topics[i - 1] === topics[i]), topics.join(','));
  }
  assert.equal(topics.length, 9, 'al final, si solo queda un tema, igual se muestra');
});

// --- Búsqueda ----------------------------------------------------------------

test('searchCards ignora acentos y mayúsculas, exige todas las palabras e incluye lo ya visto', async () => {
  const db = await freshDb();
  const suez = makeCard({ title: 'Se inaugura el Canal de Suez', summary: 'Une el Mediterráneo con el mar Rojo.' });
  const panama = makeCard({ title: 'Canal de Panamá' });
  await insertCards(db, [suez, panama, makeCard({ title: 'Tardígrados' })]);
  assert.deepEqual((await searchCards(db, prefs, 'canal')).map((c) => c.id), [panama.id, suez.id]);
  assert.deepEqual((await searchCards(db, prefs, 'CANAL mediterraneo')).map((c) => c.id), [suez.id]);
  assert.deepEqual(await searchCards(db, prefs, '   '), []);
});

test('searchWikipedia (respuesta real): ordena por relevancia y usa ids pg: (no son destacados)', async () => {
  const fetch = fakeFetch({ [actionApi('es')]: fixture('wikipedia-search-tardigrados.json') });
  const cards = await searchWikipedia(fetch, 'es', 'tardígrados');
  assert.deepEqual(cards.map((c) => c.title), ['Tardigrada', 'Tardígrados en el espacio', 'Heterotardigrada', 'Hypsibius dujardini']);
  assert.ok(cards.every((c) => /^pg:\d+$/.test(c.externalId) && c.url.startsWith('https://es.wikipedia.org/')));
  assert.equal(new URL(fetch.calls[0]).searchParams.get('gsrsearch'), 'tardígrados');
  assert.deepEqual(await searchWikipedia(fetch, 'es', '  '), []);
  assert.match(wikipediaSearchUrl('fr', 'étoile'), /^https:\/\/fr\.wikipedia\.org\/w\/api\.php\?/);
});

test('Destacados solo muestra artículos destacados, no resultados de búsqueda', async () => {
  const db = await freshDb();
  const fa = makeCard({ type: 'article', externalId: 'fa:1' });
  const tfa = makeCard({ type: 'article', externalId: 'tfa:2' });
  const searched = makeCard({ type: 'article', externalId: 'pg:3' });
  await insertCards(db, [fa, tfa, searched]);
  const page = await getFeedPage(db, prefs, { types: ['article'], externalPrefixes: ['fa:', 'tfa:'], hideSeen: false });
  assert.deepEqual(page.cards.map((c) => c.id).sort(), [fa.id, tfa.id].sort());
  assert.equal(cardKicker(fa), 'Ciencia · Artículo destacado');
  assert.equal(cardKicker(searched), 'Ciencia · Artículo');
});
