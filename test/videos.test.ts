// Fuentes de video corto contra respuestas reales grabadas el 2026-11-18 (test/fixtures/).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { nasaDuration, normalizeNasaVideo } from '../src/core/normalizers/nasa-video.ts';
import { momentFromCard } from '../src/core/moments.ts';
import { fetchNasaVideoCards, nasaAssetUrl, nasaMetadataUrl, NASA_SEARCH_URL } from '../src/ingest/videos.ts';
import { withQuality } from '../src/core/scorer.ts';
import { fakeFetch, seededRng } from './helpers/fixtures.ts';

const json = (name: string) => JSON.parse(readFileSync(join(import.meta.dirname, 'fixtures', name), 'utf8'));
const hrefs = (name: string): string[] => json(name).collection.items.map((i: { href: string }) => i.href);

// --- A) NASA ---------------------------------------------------------------------

const search = json('nasa-video-search.json');
const shortItem = search.collection.items.find((i: any) => i.data[0].nasa_id.endsWith('Spot_Short'));
const longItem = search.collection.items.find((i: any) => i.data[0].nasa_id.endsWith('Hubble29'));

test('NASA (real): clip de 27.7 s → tarjeta de video con la variante ligera, póster y crédito', () => {
  const meta = json('nasa-video-metadata-short.json');
  assert.equal(nasaDuration(meta), 27.73);
  const card = normalizeNasaVideo(shortItem, meta, hrefs('nasa-video-asset-short.json'))!;
  assert.equal(card.type, 'video');
  assert.equal(card.sourceId, 'nasa-video');
  assert.match(card.video!.url, /^https:\/\/images-assets\.nasa\.gov\/video\/.+~mobile\.mp4$/, 'https y la variante ligera');
  assert.ok(!card.video!.url.includes(' '), 'URL codificada');
  assert.equal(card.video!.mime, 'video/mp4');
  assert.match(card.imageUrl ?? '', /~medium\.jpg$/);
  assert.equal(card.credit, 'NASA GSFC');
  assert.equal(card.license, 'Dominio público (NASA)');
  assert.match(card.url, /^https:\/\/images\.nasa\.gov\/details\//);

  const m = momentFromCard(withQuality(card, 'journal'))!;
  assert.equal(m.format, 'video');
});

test('NASA (real): clip de 3:02 no entra como momento principal', () => {
  const meta = json('nasa-video-metadata-long.json');
  assert.equal(nasaDuration(meta), 182);
  const card = normalizeNasaVideo(longItem, meta, hrefs('nasa-video-asset-long.json'))!;
  assert.equal(momentFromCard(withQuality(card, 'journal')), null);
});

test('NASA: se descarta lo que tiene señales de material de terceros', () => {
  const meta = json('nasa-video-metadata-short.json');
  const third = { ...shortItem, data: [{ ...shortItem.data[0], description: 'Footage courtesy of Example Studios. All rights reserved.' }] };
  assert.equal(normalizeNasaVideo(third, meta, hrefs('nasa-video-asset-short.json')), null);
  const nasaCourtesy = { ...shortItem, data: [{ ...shortItem.data[0], description: 'Animation courtesy of NASA Goddard.' }] };
  assert.ok(normalizeNasaVideo(nasaCourtesy, meta, hrefs('nasa-video-asset-short.json')), '"courtesy of NASA" sí vale');
});

test('NASA: sin duración o sin MP4 no hay video', () => {
  assert.equal(normalizeNasaVideo(shortItem, {}, hrefs('nasa-video-asset-short.json')), null);
  assert.equal(normalizeNasaVideo(shortItem, json('nasa-video-metadata-short.json'), ['https://x/a~thumb.jpg']), null);
});

test('NASA: el fetcher filtra por duración antes de pedir archivos y tolera fallos', async () => {
  const shortId = shortItem.data[0].nasa_id;
  const longId = longItem.data[0].nasa_id;
  const fetch = fakeFetch({
    [NASA_SEARCH_URL]: { collection: { items: [shortItem, longItem] } },
    [nasaMetadataUrl(shortId)]: json('nasa-video-metadata-short.json'),
    [nasaMetadataUrl(longId)]: json('nasa-video-metadata-long.json'),
    [nasaAssetUrl(shortId)]: json('nasa-video-asset-short.json'),
  });
  const cards = await fetchNasaVideoCards(fetch, { existing: new Set(), rng: seededRng() });
  assert.deepEqual(cards.map((c) => c.externalId), [shortId]);
  assert.ok(!fetch.calls.includes(nasaAssetUrl(longId)), 'no se piden los archivos del video largo');
  assert.deepEqual(await fetchNasaVideoCards(fetch, { existing: new Set([shortId]), rng: seededRng() }), []);
});

// --- B) Internet Archive -----------------------------------------------------------

import { archiveLicense, normalizeArchive } from '../src/core/normalizers/archive.ts';
import { archiveMetadataUrl, archiveSearchUrl, fetchArchiveVideoCards } from '../src/ingest/videos.ts';

test('Internet Archive (real): clip de 52 s con CC0 → video MP4 ligero, póster y crédito', () => {
  const card = normalizeArchive(json('archive-metadata-short.json'))!;
  assert.equal(card.type, 'video');
  assert.equal(card.sourceId, 'internet-archive');
  assert.equal(card.license, 'CC0');
  assert.equal(card.video!.url, 'https://archive.org/download/PowellStreetScenesC1920s/PowellStreetScenesC1920s_512kb.mp4');
  assert.equal(card.video!.durationSec, 51.65);
  assert.equal(card.video!.mime, 'video/mp4');
  assert.match(card.imageUrl ?? '', /^https:\/\/archive\.org\/download\/PowellStreetScenesC1920s\/.+\.jpg$/);
  assert.equal(card.credit, 'Shaping San Francisco');
  assert.equal(card.url, 'https://archive.org/details/PowellStreetScenesC1920s');
  assert.equal(momentFromCard(withQuality(card, 'museum'))?.format, 'video');
});

test('Internet Archive: sin licencia clara se descarta; la licencia se lee del elemento', () => {
  const real = json('archive-metadata-short.json');
  assert.equal(normalizeArchive({ ...real, metadata: { ...real.metadata, licenseurl: undefined } }), null);
  assert.equal(normalizeArchive({ ...real, metadata: { ...real.metadata, licenseurl: 'http://creativecommons.org/licenses/by-nc/4.0/' } }), null, 'NC no es abierta');
  assert.equal(archiveLicense('https://creativecommons.org/licenses/by/4.0'), 'CC BY 4.0');
  assert.equal(archiveLicense('http://creativecommons.org/licenses/publicdomain/'), 'Dominio público');
  assert.equal(archiveLicense('Public Domain'), null, 'texto libre: no se adivina');
});

test('Internet Archive: el fetcher filtra licencia y duración en la búsqueda y verifica con metadatos', async () => {
  const search = json('archive-search.json');
  const fetch = fakeFetch({
    'https://archive.org/advancedsearch.php': search,
    [archiveMetadataUrl('PowellStreetScenesC1920s')]: json('archive-metadata-short.json'),
    [archiveMetadataUrl('WalkIn-LetsFaceFacts')]: new Error('sin red'),
  });
  const cards = await fetchArchiveVideoCards(fetch, { existing: new Set(), rng: seededRng() });
  assert.deepEqual(cards.map((c) => c.externalId), ['PowellStreetScenesC1920s'], 'el que falla no tumba la fuente');
  const asked = fetch.calls.filter((u) => u.includes('/metadata/'));
  assert.ok(!asked.some((u) => /meet_your_federal_government|ejemplo_sin_licencia/.test(u)), 'ni el largo ni el sin licencia piden metadatos');
  assert.match(decodeURIComponent(archiveSearchUrl('prelinger', 1)), /licenseurl:\("http:\/\/creativecommons\.org/);
});

// --- C) Wikimedia Commons ------------------------------------------------------------

import { commonsVideoPoster, normalizeCommonsVideo } from '../src/core/normalizers/commons-video.ts';
import { COMMONS_API, commonsVideoSearchUrl, fetchCommonsVideoCards } from '../src/ingest/videos.ts';

const commons = json('commons-video-search.json').query.pages;

test('Commons (real): usa la transcodificación .mov (iOS y Android), con licencia, autor y póster', () => {
  const page = commons.find((p: any) => p.title.includes('Spruce Woods'));
  const card = normalizeCommonsVideo(page)!;
  assert.equal(card.type, 'video');
  assert.equal(card.sourceId, 'commons-video');
  assert.match(card.video!.url, /\.webm\.360p\.mpeg4\.mov$/, 'no el WebM original');
  assert.equal(card.video!.mime, 'video/quicktime');
  assert.equal(card.video!.durationSec, 19.8);
  assert.equal(card.license, 'CC BY 4.0');
  assert.ok(card.credit && !card.credit.includes('<'), 'autor sin HTML');
  assert.match(card.imageUrl ?? '', /^https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/thumb\/2\/28\/.+\/960px--.+\.webm\.jpg$/);
  assert.equal(card.url, 'https://commons.wikimedia.org/wiki/File:Aurora_Borealis_over_Spruce_Woods,_Manitoba.webm');
  assert.equal(momentFromCard(withQuality(card, 'encyclopedia'))?.format, 'video');
});

test('Commons: sin transcodificación compatible o sin licencia libre, no entra', () => {
  const page = commons.find((p: any) => p.title.includes('Spruce Woods'));
  assert.equal(normalizeCommonsVideo({ ...page, videoinfo: [{ ...page.videoinfo[0], derivatives: page.videoinfo[0].derivatives.filter((d: any) => !d.transcodekey?.includes('mov')) }] }), null);
  const nc = structuredClone(page);
  nc.imageinfo[0].extmetadata.LicenseShortName.value = 'CC BY-NC 4.0';
  assert.equal(normalizeCommonsVideo(nc), null);
  assert.equal(commonsVideoPoster('https://otro.sitio/x.webm'), undefined);
});

test('Commons: el fetcher solo deja clips de 15 a 60 s (los de 5 y 8 s quedan fuera)', async () => {
  const fetch = fakeFetch({ [COMMONS_API]: json('commons-video-search.json') });
  const cards = await fetchCommonsVideoCards(fetch, { existing: new Set(), count: 10, rng: seededRng() });
  assert.deepEqual(cards.map((c) => Math.round(c.video!.durationSec)).sort((a, b) => a - b), [20, 48]);
  assert.equal(new URL(commonsVideoSearchUrl('aurora')).searchParams.get('gsrsearch'), 'filetype:video aurora');
});
