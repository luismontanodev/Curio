// Fuentes agregadas el 2026-11-18, contra respuestas reales grabadas en test/fixtures/.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { normalizeSinc, parseRss } from '../src/core/normalizers/sinc.ts';
import { normalizeAic, normalizeCleveland, normalizeVam } from '../src/core/normalizers/museums.ts';
import { inatPhotoUrl, normalizeObservation } from '../src/core/normalizers/inaturalist.ts';
import { normalizeEpic } from '../src/core/normalizers/epic.ts';
import { normalizePmc } from '../src/core/normalizers/europepmc.ts';
import { fetchAicCards, fetchInaturalistCards, fetchSincCards } from '../src/ingest/more-sources.ts';
import { sourceNameOf } from '../src/core/sources.ts';
import { fakeFetch, seededRng } from './helpers/fixtures.ts';

const text = (name: string) => readFileSync(join(import.meta.dirname, 'fixtures', name), 'utf8');
const json = (name: string) => JSON.parse(text(name));
const https = (u?: string) => !!u && u.startsWith('https://');

test('SINC (RSS real): artículos en español con texto completo, autor e imagen', () => {
  const items = parseRss(text('sinc-ciencia.rss'));
  assert.equal(items.length, 2);
  const card = normalizeSinc(items[0])!;
  assert.equal(card.sourceId, 'sinc');
  assert.equal(card.lang, 'es');
  assert.equal(card.license, 'CC BY 4.0');
  assert.ok(card.url.startsWith('https://www.agenciasinc.es/'), 'http → https');
  assert.ok(https(card.imageUrl));
  assert.ok(card.body && card.body.length > 3);
  assert.equal(card.body[0].kind, 'quote');
  assert.match(card.body[0].kind === 'quote' ? card.body[0].text : '', /Agencia SINC$/);
  assert.ok(card.summary && card.summary.length > 50);
  assert.equal(sourceNameOf('sinc'), 'Agencia SINC');
});

test('SINC: fetchSincCards pide una sola sección por vez', async () => {
  const fetch = fakeFetch({ 'https://www.agenciasinc.es/feed/': text('sinc-ciencia.rss') });
  const cards = await fetchSincCards(fetch, { existing: new Set(), rng: seededRng() });
  assert.equal(fetch.calls.length, 1);
  assert.equal(cards.length, 2);
});

test('Art Institute of Chicago (real): obras de dominio público con imagen IIIF y textos', async () => {
  const res = json('aic-search.json');
  const cards = res.data.map((a: never) => normalizeAic(a, res.config.iiif_url)).filter(Boolean);
  assert.ok(cards.length > 0);
  for (const c of cards) {
    assert.match(c.imageUrl, /^https:\/\/www\.artic\.edu\/iiif\/2\/[\w-]+\/full\/843,\/0\/default\.jpg$/);
    assert.match(c.url, /^https:\/\/www\.artic\.edu\/artworks\/\d+$/);
    assert.equal(c.topic, 'arte');
  }
  // Manda la cabecera que el AIC exige (sin ella responde 403).
  let sent: Record<string, string> | undefined;
  await fetchAicCards(async (_u, init) => {
    sent = init?.headers;
    return { ok: true, status: 200, json: async () => res, text: async () => '' };
  }, { existing: new Set(), rng: seededRng() });
  assert.ok(sent?.['AIC-User-Agent']);
});

test('Cleveland (real): solo CC0, con imagen web y textos de sala', () => {
  const cards = json('cleveland-search.json').data.map(normalizeCleveland).filter(Boolean);
  assert.ok(cards.length > 0);
  for (const c of cards) {
    assert.ok(https(c.imageUrl) && https(c.url));
    assert.equal(c.license, 'CC0 · Dominio público');
  }
  assert.equal(normalizeCleveland({ id: 1, title: 'X', share_license_status: 'Copyrighted', images: { web: { url: 'https://x/y.jpg' } } }), null);
});

test('V&A (real): imagen IIIF de 800 px y enlace a la colección', () => {
  const cards = json('vam-search.json').records.map(normalizeVam).filter(Boolean);
  assert.ok(cards.length > 0);
  for (const c of cards) {
    assert.match(c.imageUrl, /^https:\/\/framemark\.vam\.ac\.uk\/collections\/\w+\/full\/!800,800\/0\/default\.jpg$/);
    assert.match(c.url, /^https:\/\/collections\.vam\.ac\.uk\/item\/O\d+\/$/);
  }
});

test('iNaturalist (real): nombre común en español, foto grande y atribución a quien la tomó', () => {
  const [o] = json('inaturalist-observations.json').results;
  const card = normalizeObservation(o, 'es')!;
  assert.equal(card.topic, 'naturaleza');
  assert.equal(card.lang, 'es');
  assert.equal(card.title, 'Quitón verde azul');
  assert.match(card.summary ?? '', /^Chiton glaucus · Fotografiada en Hawera en octubre de 2014 por Emily Roberts\.$/);
  assert.match(card.imageUrl ?? '', /\/large\.JPG$/);
  assert.equal(card.url, `https://www.inaturalist.org/observations/${o.id}`);
  assert.match(card.license ?? '', /^CC BY 4\.0 · \(c\) Emily Roberts$/);
  assert.equal(inatPhotoUrl('https://x/photos/1/square.jpeg'), 'https://x/photos/1/large.jpeg');
});

test('iNaturalist: una sola foto por especie y sin licencias restrictivas', async () => {
  const base = json('inaturalist-observations.json').results[0];
  const results = [base, { ...base, id: base.id + 1 }, { ...base, id: 9, taxon: { ...base.taxon, id: 2 }, photos: [{ ...base.photos[0], license_code: 'cc-by-nc' }] }];
  const fetch = fakeFetch({ 'https://api.inaturalist.org/': { results } });
  const cards = await fetchInaturalistCards(fetch, { lang: 'es', existing: new Set(), rng: seededRng() });
  assert.equal(cards.length, 1);
  assert.equal(new URL(fetch.calls[0]).searchParams.get('locale'), 'es');
});

test('NASA EPIC (real): la Tierra del día con distancia y centro calculados, en español', () => {
  const [img] = json('nasa-epic.json');
  const card = normalizeEpic(img, 'es')!;
  assert.match(card.title, /^La Tierra completa, vista desde el espacio el \d{1,2} de \w+ de \d{4}$/);
  assert.match(card.summary ?? '', /a unos 1[.,]\d{3}[.,]000 km/);
  assert.match(card.imageUrl ?? '', /^https:\/\/epic\.gsfc\.nasa\.gov\/archive\/natural\/\d{4}\/\d{2}\/\d{2}\/jpg\/epic_\w+\.jpg$/);
  assert.equal(normalizeEpic(img, 'fr'), null);
});

test('Europe PMC (real): artículo científico con resumen y licencia CC', () => {
  const [r] = json('europepmc-search.json').resultList.result;
  const card = normalizePmc(r)!;
  assert.equal(card.type, 'paper');
  assert.equal(card.lang, 'en');
  assert.ok(!card.title.startsWith('['), 'sin corchetes de título traducido');
  assert.match(card.license ?? '', /^CC /);
  assert.ok(card.body?.some((b) => b.kind === 'p' && b.text.length > 100));
  assert.equal(normalizePmc({ ...r, license: undefined }), null, 'sin licencia abierta no entra');
});
