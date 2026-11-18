// Normalizadores y fetchers contra respuestas reales grabadas el 2026-11-17 (test/fixtures/).
// Si una API cambia de forma, regraba la fixture y ajusta aquí.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { normalizeMet, type MetObject } from '../src/core/normalizers/met.ts';
import {
  normalizeFeatured, normalizeFeaturedArticlePage, normalizePictureOfDay,
  type FeaturedArticlePage, type FeaturedFeed, type FeaturedImage,
} from '../src/core/normalizers/wikipedia.ts';
import { MET_BASE, MET_SEARCH, fetchMetCards } from '../src/ingest/met.ts';
import { WIKIPEDIA_ACTION_API, fetchFeaturedArticles } from '../src/ingest/wikipedia.ts';
import { USER_AGENT, getJson } from '../src/ingest/http.ts';
import { fakeFetch, seededRng } from './helpers/fixtures.ts';

const fixture = <T>(name: string): T =>
  JSON.parse(readFileSync(join(import.meta.dirname, 'fixtures', name), 'utf8')) as T;

const isHttps = (u?: string) => typeof u === 'string' && u.startsWith('https://');

test('Met: obra de dominio público real → tarjeta completa', () => {
  const card = normalizeMet(fixture<MetObject>('met-object-public-domain.json'));
  assert.ok(card);
  assert.equal(card.id, 'met:437372');
  assert.equal(card.type, 'artwork');
  assert.equal(card.topic, 'arte');
  assert.ok(card.title.length > 0);
  assert.ok(isHttps(card.imageUrl) && card.imageUrl!.includes('images.metmuseum.org'));
  assert.ok(isHttps(card.url));
  assert.match(card.summary ?? '', /Raphael/);
});

test('Met: obra real que no es de dominio público se descarta', () => {
  assert.equal(normalizeMet(fixture<MetObject>('met-object-not-public.json')), null);
});

test('Met: la ingesta usa /v1.1/search con limit=500 y los objetos de /v1', async () => {
  const search = fixture<{ objectIDs: number[] }>('met-search-v1.1.json');
  const obj = fixture<MetObject>('met-object-public-domain.json');
  const fetch = fakeFetch({
    [MET_SEARCH]: search,
    [`${MET_BASE}/objects/`]: (url: string) => ({ ...obj, objectID: Number(url.split('/').pop()) }),
  });
  const cards = await fetchMetCards(fetch, { existing: new Set(), count: 3, rng: seededRng() });
  assert.equal(cards.length, 3);
  assert.match(fetch.calls[0], /\/v1\.1\/search\?.*limit=500/);
  assert.ok(fetch.calls.slice(1).every((u) => u.startsWith(`${MET_BASE}/objects/`)));
});

test('Wikipedia featured real (es): sin tfa, imagen del día en español y efemérides', () => {
  const feed = fixture<FeaturedFeed>('wikipedia-featured-2026-11-17.json');
  assert.equal(feed.tfa, undefined); // la Wikipedia en español no lo publica

  const cards = normalizeFeatured(feed, 11, 17);
  const image = cards.find((c) => c.type === 'image');
  const events = cards.filter((c) => c.type === 'event');

  assert.ok(image);
  assert.equal(image.lang, 'es');
  assert.match(image.title, /boyas/); // la descripción, no el nombre del archivo
  assert.match(image.summary ?? '', /Dietmar Rabich/); // `artist` llegó como texto plano
  assert.equal(image.license, 'CC BY-SA 4.0');
  assert.ok(isHttps(image.imageUrl) && isHttps(image.url));

  assert.equal(events.length, feed.onthisday!.length);
  for (const e of events) {
    assert.match(e.title, /^\d{1,4}: /);
    assert.match(e.externalId, /^otd:1117:/);
    assert.ok(isHttps(e.url));
  }
});

test('Wikipedia: las efemérides no dicen "(en la imagen)" porque no muestran foto', () => {
  const [card] = normalizeFeatured(
    {
      onthisday: [
        {
          year: 1866,
          text: 'Nace Voltairine de Cleyre (en la imagen), escritora estadounidense.',
          pages: [{ pageid: 1, title: 'Voltairine de Cleyre', content_urls: { desktop: { page: 'https://es.wikipedia.org/wiki/V' } } }],
        },
      ],
    },
    11,
    17,
  );
  assert.equal(card.title, '1866: Nace Voltairine de Cleyre, escritora estadounidense.');
});

test('getJson se identifica con User-Agent (Wikimedia rechaza el de okhttp en Android)', async () => {
  let sent: Record<string, string> | undefined;
  await getJson(async (_url, init) => {
    sent = init?.headers;
    return { ok: true, status: 200, json: async () => ({}), text: async () => '' };
  }, 'https://es.wikipedia.org/x');
  assert.equal(sent?.['User-Agent'], USER_AGENT);
  assert.equal(sent?.['Api-User-Agent'], USER_AGENT);
});

test('Wikipedia: `artist` como objeto { html, text } también da el crédito', () => {
  const card = normalizePictureOfDay(fixture<FeaturedImage>('wikipedia-image-artist-object.json'));
  assert.ok(card);
  assert.match(card.summary ?? '', /Autor: Andreas F\. Borchert/);
});

test('Wikipedia: artículos destacados reales → tarjetas de artículo limpias', () => {
  const res = fixture<{ query: { pages: FeaturedArticlePage[] } }>('wikipedia-featured-articles.json');
  const cards = res.query.pages.map((p) => normalizeFeaturedArticlePage(p, 'es'));
  assert.equal(cards.length, 5);
  for (const c of cards) {
    assert.ok(c);
    assert.equal(c.type, 'article');
    assert.match(c.externalId, /^fa:\d+$/);
    assert.ok(isHttps(c.url));
    assert.ok(!/[​-‍]/.test(c.summary ?? ''), 'sin espacios de ancho cero');
  }
});

test('Wikipedia: fetchFeaturedArticles no repite artículos que ya están', async () => {
  const res = fixture<{ query: { pages: FeaturedArticlePage[] } }>('wikipedia-featured-articles.json');
  const fetch = fakeFetch({ [WIKIPEDIA_ACTION_API]: res });
  const existing = new Set(['fa:1791', 'fa:9496']);
  const cards = await fetchFeaturedArticles(fetch, { existing, count: 10, rng: seededRng() });
  assert.equal(cards.length, 3);
  assert.ok(cards.every((c) => !existing.has(c.externalId)));
  assert.match(fetch.calls[0], /generator=categorymembers/);
  assert.equal(new URL(fetch.calls[0]).searchParams.get('gcmtitle'), 'Categoría:Wikipedia:Artículos destacados');
});
