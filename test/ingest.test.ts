import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { getLastIngestAt, runIngest } from '../src/ingest/ingest.ts';
import { MET_BASE, MET_SEARCH } from '../src/ingest/met.ts';
import { actionApi, featuredFeedBase } from '../src/ingest/wikipedia.ts';
import { CONVERSATION_BASE } from '../src/ingest/conversation.ts';
import { WIKIDATA_SPARQL } from '../src/ingest/wikidata.ts';
import { NASA_SEARCH } from '../src/ingest/nasa.ts';
import { countCards, getFeedPage } from '../src/db/cards.ts';
import { DEFAULT_PREFS, getKv, setPrefs } from '../src/db/prefs.ts';
import { fileTitleToText } from '../src/core/normalizers/wikipedia.ts';
import { freshDb } from './helpers/node-db.ts';
import { fakeFetch, seededRng } from './helpers/fixtures.ts';

const NOW = new Date('2026-11-17T18:00:00Z');
const fixtureText = (name: string) => readFileSync(join(import.meta.dirname, 'fixtures', name), 'utf8');
const fixture = (name: string) => JSON.parse(fixtureText(name));

const metObject = (id: number, publicDomain = true) => ({
  objectID: id,
  isPublicDomain: publicDomain,
  title: `Obra ${id}`,
  artistDisplayName: 'Artista',
  objectDate: '1830',
  primaryImageSmall: `https://images.metmuseum.org/${id}.jpg`,
  objectURL: `https://www.metmuseum.org/art/collection/search/${id}`,
});

const featuredArticles = {
  query: {
    pages: [
      { pageid: 7165, title: 'Tardigrada', extract: 'Los tardígrados​ son animales microscópicos.', fullurl: 'https://es.wikipedia.org/wiki/Tardigrada' },
      { pageid: 12974, title: 'Machu Picchu', fullurl: 'https://es.wikipedia.org/wiki/Machu_Picchu' },
    ],
  },
};

const featured = {
  tfa: {
    pageid: 1, title: 'Tardígrado', titles: { normalized: 'Tardígrado' }, extract: 'Los tardígrados son…',
    content_urls: { desktop: { page: 'https://es.wikipedia.org/wiki/Tard%C3%ADgrado' } },
  },
  image: {
    title: 'File:Gran_Cañón_al_atardecer.jpg',
    thumbnail: { source: 'https://upload.wikimedia.org/x.jpg' },
    description: { text: 'Vista del cañón', lang: 'es' },
    artist: { text: 'Fotógrafa' },
    license: { type: 'CC BY-SA 4.0' },
    file_page: 'https://commons.wikimedia.org/wiki/File:Gran_Ca%C3%B1%C3%B3n_al_atardecer.jpg',
  },
  onthisday: [
    { year: 1869, text: 'Se inaugura el Canal de Suez.', pages: [{ pageid: 9, title: 'Canal de Suez', content_urls: { desktop: { page: 'https://es.wikipedia.org/wiki/Canal_de_Suez' } } }] },
    { year: 2000, text: 'Evento sin página', pages: [] },
  ],
  mostread: { articles: [{ title: 'Algo viral' }] },
};

/** Rutas por prefijo. Las de inglés responden vacío salvo Met y NASA. */
function routes() {
  return {
    [`${featuredFeedBase('es')}/`]: featured,
    [actionApi('es')]: featuredArticles,
    [`${CONVERSATION_BASE}/es/ciencia/articles.atom`]: fixtureText('conversation-es-ciencia.atom'),
    [WIKIDATA_SPARQL]: fixture('wikidata-art-es.json'),
    [`${featuredFeedBase('en')}/`]: {},
    [actionApi('en')]: { query: { pages: [] } },
    [`${CONVERSATION_BASE}/us/technology/articles.atom`]: '<feed></feed>',
    [MET_SEARCH]: { total: 4, objectIDs: [1, 2, 3, 4] },
    [`${MET_BASE}/objects/`]: (url: string) => {
      const id = Number(url.split('/').pop());
      return id === 3 ? metObject(id, false) : metObject(id);
    },
    [NASA_SEARCH]: fixture('nasa-search.json'),
  };
}

test('con solo español no se piden fuentes en inglés (Met, NASA)', async () => {
  const db = await freshDb(); // preferencias por defecto: languages ['es']
  const fetch = fakeFetch(routes());
  const r = await runIngest(db, fetch, { now: NOW, rng: seededRng() });

  assert.deepEqual(Object.keys(r.sources).sort(), ['art:es', 'articles:es', 'conversation:es', 'featured:es']);
  assert.ok(!fetch.calls.some((u) => u.startsWith(MET_SEARCH) || u.startsWith(NASA_SEARCH)));
  assert.deepEqual(r.sources['featured:es'], { fetched: 3 }); // tfa + imagen + 1 efeméride válida
  assert.deepEqual(r.sources['articles:es'], { fetched: 2 });
  assert.deepEqual(r.sources['conversation:es'], { fetched: 2 });
  assert.ok(r.sources['art:es'].fetched > 0);

  const langs = await db.getAllAsync<{ lang: string }>('select distinct lang from cards', []);
  assert.deepEqual(langs.map((l) => l.lang), ['es']);
  assert.ok(!(await db.getAllAsync<{ title: string }>('select title from cards', [])).some((c) => c.title.includes('viral')));
});

test('con inglés también entran el Met y la NASA, y respeta el intervalo', async () => {
  const db = await freshDb();
  await setPrefs(db, { ...DEFAULT_PREFS, languages: ['es', 'en'] });
  const fetch = fakeFetch(routes());

  const r = await runIngest(db, fetch, { now: NOW, rng: seededRng(), metCount: 10 });
  assert.deepEqual(r.sources['met:en'], { fetched: 3 }); // la 3 no es de dominio público
  assert.ok(r.sources['nasa:en'].fetched > 0);
  assert.equal(await countCards(db), r.inserted);

  // Antes de 3 h no vuelve a pedir nada.
  const calls = fetch.calls.length;
  const again = await runIngest(db, fetch, { now: new Date(NOW.getTime() + 60 * 60 * 1000) });
  assert.equal(again.skipped, true);
  assert.equal(fetch.calls.length, calls);

  // Con force sí, y no pide al Met objetos que ya tiene.
  await runIngest(db, fetch, { now: new Date(NOW.getTime() + 60_000), force: true, rng: seededRng(7) });
  const objectCalls = fetch.calls.slice(calls).filter((u) => u.includes('/objects/'));
  assert.deepEqual(objectCalls.map((u) => u.split('/').pop()).sort(), ['3']);
});

test('si una fuente falla, las demás igual entran', async () => {
  const db = await freshDb();
  const fetch = fakeFetch({ ...routes(), [WIKIDATA_SPARQL]: new Error('sin red') });
  const r = await runIngest(db, fetch, { now: NOW, rng: seededRng() });
  assert.equal(r.sources['art:es'].error, 'sin red');
  assert.ok(r.inserted >= 7);
});

test('sin red en ninguna fuente no marca la ingesta como hecha', async () => {
  const db = await freshDb();
  const fetch = fakeFetch({});
  const r = await runIngest(db, fetch, { now: NOW });
  assert.ok(Object.values(r.sources).every((s) => s.error));
  const again = await runIngest(db, fetch, { now: new Date(NOW.getTime() + 1000) });
  assert.equal(again.skipped, false);
});

test('"traer más": página siguiente de The Conversation, efemérides de otro día y sin marcar ingesta', async () => {
  const db = await freshDb();
  const fetch = fakeFetch(routes());
  await runIngest(db, fetch, { now: NOW, rng: seededRng() });
  const last = await getLastIngestAt(db);

  const before = fetch.calls.length;
  await runIngest(db, fetch, { now: new Date(NOW.getTime() + 1000), more: true, rng: seededRng(5) });
  const calls = fetch.calls.slice(before);
  assert.ok(calls.some((u) => u.endsWith('/es/ciencia/articles.atom?page=2')));
  assert.ok(!calls.some((u) => u.endsWith('/2026/11/17')), 'efemérides de un día distinto a hoy');
  assert.equal(await getKv(db, 'conversationPage:es'), '2');
  assert.equal(await getLastIngestAt(db), last);

  await runIngest(db, fetch, { now: new Date(NOW.getTime() + 2000), more: true, rng: seededRng(6) });
  assert.equal(await getKv(db, 'conversationPage:es'), '3');
});

test('"traer más" vuelve a la primera página si la siguiente no existe', async () => {
  const db = await freshDb();
  const fetch = fakeFetch({ ...routes(), [`${CONVERSATION_BASE}/es/ciencia/articles.atom?page=`]: new Error('404') });
  const r = await runIngest(db, fetch, { now: NOW, more: true, rng: seededRng() });
  assert.equal(r.sources['conversation:es'].error, '404');
  assert.equal(await getKv(db, 'conversationPage:es'), '1');
});

test('`only` limita las clases de trabajo (la sección Destacados pide solo artículos)', async () => {
  const db = await freshDb();
  const fetch = fakeFetch(routes());
  const r = await runIngest(db, fetch, { now: NOW, more: true, only: ['articles'], rng: seededRng() });
  assert.deepEqual(Object.keys(r.sources), ['articles:es']);
  assert.ok(fetch.calls.every((u) => u.startsWith(actionApi('es'))));
});

test('las fuentes quedan mezcladas en el feed', async () => {
  const db = await freshDb();
  await runIngest(db, fakeFetch(routes()), { now: NOW, rng: seededRng(3) });
  const page = await getFeedPage(db, { ...DEFAULT_PREFS, topics: [...DEFAULT_PREFS.topics, 'naturaleza', 'espacio', 'musica'] }, { limit: 50 });
  const sources = page.cards.map((c) => c.sourceId);
  assert.ok(page.cards.length >= 8);
  const switches = sources.slice(1).filter((s, i) => s !== sources[i]).length;
  assert.ok(switches > 3, sources.join(','));
});

test('fileTitleToText limpia títulos de Commons', () => {
  assert.equal(fileTitleToText('File:Gran_Cañón_al_atardecer.jpg'), 'Gran Cañón al atardecer');
  assert.equal(fileTitleToText('Archivo:Foto.JPEG'), 'Foto');
});
