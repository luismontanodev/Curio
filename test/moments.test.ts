// v2: momentos, ganchos honestos y capítulos (docs/PRODUCTO.md).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { scoreCard, scoreHook } from '../src/core/scorer.ts';
import {
  clipWords, eventLabel, firstSentence, formatYear, mixMoments, momentFromCard, timelineMoment, whichFirstMoment,
  yearsBetween,
} from '../src/core/moments.ts';
import type { Moment } from '../src/core/types.ts';
import { insertCards, markSeen } from '../src/db/cards.ts';
import { momentAllowed, momentCandidates } from '../src/db/moments.ts';
import { DEFAULT_PREFS } from '../src/db/prefs.ts';
import { freshDb } from './helpers/node-db.ts';
import { makeCard, seededRng } from './helpers/fixtures.ts';

const NOW = new Date(2026, 10, 17, 12, 0);
const prefs = { ...DEFAULT_PREFS, onlyVerified: false, topics: [...DEFAULT_PREFS.topics, 'naturaleza', 'espacio', 'musica'] as typeof DEFAULT_PREFS.topics };

const event = (year: number, text: string, over = {}) =>
  makeCard({ type: 'event', topic: 'historia', title: `${year}: ${text}`, externalId: `otd:1117:${year}:${text.length}`, ...over });

// --- scoreHook --------------------------------------------------------------

test('scoreHook permite la pregunta y el inicio vago solo si hay payoff', () => {
  const q = '¿Por qué el cielo es azul?';
  assert.ok(scoreCard({ title: q }, 'magazine').clickbait > 0);
  assert.equal(scoreHook(q, 'La luz azul se dispersa más en el aire.', 'magazine').clickbait, 0);
  assert.ok(scoreHook(q, '   ', 'magazine').clickbait > 0, 'sin payoff sigue contando');
  assert.equal(scoreHook('Esto pasa cuando un tardígrado se seca', 'Entra en criptobiosis.', 'magazine').clickbait, 0);
});

test('scoreHook castiga siempre sensacionalismo y frases gancho', () => {
  const s = scoreHook('No creerás lo que hace este animal', 'Se seca y revive.', 'magazine');
  assert.ok(s.clickbait >= 3);
  assert.ok(scoreHook('¡IMPACTANTE! El animal más resistente', 'Es el tardígrado.', 'magazine').sensationalism > 2.5);
});

// --- Texto ------------------------------------------------------------------

test('clipWords y firstSentence recortan sin cortar palabras ni fechas abreviadas', () => {
  assert.equal(clipWords('Una frase corta', 90), 'Una frase corta');
  assert.equal(clipWords('uno dos tres cuatro cinco seis siete', 20), 'uno dos tres cuatro…');
  assert.equal(firstSentence('Katsushika Hokusai, c. 1830–32. Xilografía de la serie.'), 'Katsushika Hokusai, c. 1830–32.');
  assert.equal(firstSentence(undefined), '');
});

test('eventLabel usa el hecho mismo, no el título de la página', () => {
  const c = event(1869, 'Se inaugura oficialmente el canal de Suez, permitiendo la navegación entre Europa y Asia.');
  assert.equal(eventLabel(c), 'Se inaugura oficialmente el canal de Suez');
  assert.equal(formatYear(-43), '44 a. C.');
  assert.equal(yearsBetween(-30, 2007), 2036); // sin año 0
});

// --- Tarjeta → momento -------------------------------------------------------

test('momentFromCard: obra con imagen → image-fact con payoff de su resumen', () => {
  const card = makeCard({ type: 'artwork', topic: 'arte', sourceId: 'met', title: 'La gran ola de Kanagawa', summary: 'Katsushika Hokusai · ca. 1830–32 · Xilografía', imageUrl: 'https://x/ola.jpg' });
  const m = momentFromCard(card, NOW)!;
  assert.equal(m.format, 'image-fact');
  assert.equal(m.hook, 'La gran ola de Kanagawa');
  assert.equal(m.payoff, 'Katsushika Hokusai · ca. 1830–32 · Xilografía');
  assert.equal(m.cardId, card.id);
  assert.equal(m.media?.imageUrl, 'https://x/ola.jpg');
  assert.deepEqual(m.sources, [{ sourceId: 'met', url: card.url }]);
});

test('momentFromCard: efeméride en español → payoff calculado con la fecha', () => {
  const m = momentFromCard(event(1869, 'Se inaugura oficialmente el canal de Suez.'), NOW)!;
  assert.equal(m.format, 'event');
  assert.equal(m.hook, 'Se inaugura oficialmente el canal de Suez.');
  assert.equal(m.payoff, 'Pasó un 17 de noviembre de 1869: hace 157 años.');
});

test('momentFromCard: sin payoff no hay momento (curiosidad sí, clickbait no)', () => {
  assert.equal(momentFromCard(makeCard({ type: 'article', title: '¿Por qué?' }), NOW), null);
  const ok = momentFromCard(makeCard({ type: 'article', title: '¿Por qué el cielo es azul?', summary: 'La luz azul se dispersa más. Es el efecto Rayleigh.' }), NOW)!;
  assert.equal(ok.format, 'text-fact');
  assert.equal(ok.payoff, 'La luz azul se dispersa más. Es el efecto Rayleigh.', 'si cabe, el resumen completo');
  const long = momentFromCard(makeCard({ type: 'article', title: 'Algo', summary: `Primera oración del resumen. Después ${'x '.repeat(150)}` }), NOW)!;
  assert.equal(long.payoff, 'Primera oración del resumen.', 'si no cabe, la primera oración');
  assert.equal(ok.quality.clickbait, 0);
});

// --- Ganchos calculados ------------------------------------------------------

test('whichFirst: opciones honestas, la correcta es la más antigua', () => {
  const a = event(1989, 'Comienza la Revolución de Terciopelo en Checoslovaquia, tras la represión.');
  const b = event(1869, 'Se inaugura oficialmente el canal de Suez, permitiendo la navegación.');
  const m = whichFirstMoment(a, b)!;
  assert.equal(m.format, 'which-first');
  assert.equal(m.hookOrigin, 'computed');
  assert.deepEqual(m.choices, [
    { label: 'Comienza la Revolución de Terciopelo en Checoslovaquia', detail: '1989', correct: false },
    { label: 'Se inaugura oficialmente el canal de Suez', detail: '1869', correct: true },
  ]);
  assert.match(m.payoff, /fue en 1869, 120 años antes/);
  const ancient = whichFirstMoment(event(9, 'Nacimiento de Vespasiano, fundador de la dinastía Flavia.'), b)!;
  assert.match(ancient.payoff, /fue en el año 9, 1860 años antes/);
  assert.equal(m.sources.length, 2);
  assert.equal(whichFirstMoment(a, event(1985, 'Otro hecho cercano en el tiempo, apenas.')), null, 'menos de 10 años: no hay pregunta clara');
  assert.equal(whichFirstMoment(a, makeCard({ type: 'article' })), null);
});

test('timeline: solo se publica si es cierto y con margen claro', () => {
  const old = event(1558, 'Muere María I y la sucede Isabel I como reina de Inglaterra.');
  const mid = event(1869, 'Se inaugura oficialmente el canal de Suez, permitiendo la navegación.');
  const m = timelineMoment(old, mid, NOW)!;
  assert.equal(m.format, 'timeline');
  assert.deepEqual(m.timeline?.map((t) => t.year), [1558, 1869, 2026]);
  assert.equal(m.payoff, 'De uno a otro: 311 años. Del segundo a hoy: 157 años.');
  // 1869 → 1989 (120) no es mayor que 1989 → hoy (37) × 1.5? Sí lo es; 1989 → 2000 (11) vs 26: no.
  assert.equal(timelineMoment(event(1989, 'Cae el muro de Berlín, en Alemania.'), event(2000, 'Comienza un nuevo siglo, según muchos.'), NOW), null);
});

// --- Mezcla para el scroll infinito ---------------------------------------

const fake = (i: number, format: Moment['format'], sourceId: string, topic: Moment['topic'] = 'ciencia'): Moment => ({
  id: `m${i}`, format, topic, lang: 'es', hook: `Gancho ${i}`, payoff: 'Payoff.', hookOrigin: 'source',
  sources: [{ sourceId, url: `https://x/${i}` }], quality: scoreHook(`Gancho ${i}`, 'Payoff.', 'encyclopedia'),
});

const assertMixed = (seq: Moment[]) => {
  for (let i = 2; i < seq.length; i++) {
    const [a, b, c] = [seq[i - 2], seq[i - 1], seq[i]];
    assert.ok(!(a.format === b.format && b.format === c.format), 'tres seguidos del mismo formato');
    assert.ok(!(a.sources[0].sourceId === b.sources[0].sourceId && b.sources[0].sourceId === c.sources[0].sourceId), 'tres seguidos de la misma fuente');
  }
};

test('mixMoments: lotes sin más de 2 seguidos del mismo formato o fuente, también entre lotes', () => {
  const pool: Moment[] = [];
  for (let i = 0; i < 40; i++) {
    pool.push(fake(i, (['image-fact', 'text-fact', 'event'] as const)[i % 3], ['met', 'wikipedia-es', 'theconversation', 'nasa'][i % 4]));
  }
  for (let seed = 1; seed < 15; seed++) {
    const first = mixMoments(pool, { size: 12, rng: seededRng(seed) });
    assert.equal(first.length, 12);
    const rest = pool.filter((m) => !first.includes(m));
    const second = mixMoments(rest, { size: 12, rng: seededRng(seed + 100), after: first });
    assert.equal(new Set([...first, ...second].map((m) => m.id)).size, 24);
    assertMixed([...first, ...second]);
  }
});

test('mixMoments no rellena rompiendo la regla, y deja fuera formatos que la app aún no pinta', () => {
  const same = Array.from({ length: 10 }, (_, i) => fake(i, 'image-fact', 'met'));
  assert.equal(mixMoments(same, { rng: seededRng() }).length, 2);
  const withComputed = [fake(1, 'which-first', 'x'), fake(2, 'timeline', 'y'), fake(3, 'text-fact', 'z')];
  assert.deepEqual(mixMoments(withComputed, { rng: seededRng() }).map((m) => m.format), ['text-fact']);
});

// --- Base de datos -----------------------------------------------------------

async function dbWithCards() {
  const db = await freshDb();
  const cards = [
    ...Array.from({ length: 8 }, (_, i) => makeCard({ type: 'artwork', topic: 'arte', sourceId: i % 2 ? 'met' : 'wikidata-arte', title: `Obra ${i}`, summary: `Autor ${i} · 1800`, imageUrl: `https://x/${i}.jpg` })),
    ...Array.from({ length: 8 }, (_, i) => makeCard({ type: 'article', topic: 'ciencia', sourceId: i % 2 ? 'theconversation' : 'wikipedia-es', title: `Artículo ${i}`, summary: `Resumen del artículo número ${i}. Segunda oración.` })),
    ...[1558, 1869, 1989, 1492, 1969, 1810].map((y, i) => event(y, `Hecho histórico número ${i} con texto suficiente.`)),
  ];
  await insertCards(db, cards);
  return { db, cards };
}

test('momentCandidates: el texto sigue tus filtros; las imágenes no (salvo palabras bloqueadas y clickbait evidente)', async () => {
  const { db, cards } = await dbWithCards();
  const englishText = makeCard({ type: 'article', lang: 'en', title: 'English only', summary: 'An English sentence here.' });
  const englishImage = makeCard({ type: 'image', lang: 'en', topic: 'espacio', sourceId: 'nasa', title: 'Saturn rings', summary: 'Seen by Cassini.', imageUrl: 'https://x/s.jpg' });
  const frenchImage = makeCard({ type: 'artwork', lang: 'fr', topic: 'arte', title: 'Oeuvre', summary: 'Une phrase.', imageUrl: 'https://x/f.jpg' });
  const bait = makeCard({ type: 'image', topic: 'arte', sourceId: 'theconversation', title: '¡¡¡NO CREERÁS ESTA FOTO INCREÍBLE!!! 😱', summary: 'Una oración.', imageUrl: 'https://x/b.jpg' });
  await insertCards(db, [englishText, englishImage, frenchImage, bait]);

  // Solo Historia: los artículos de ciencia no entran, pero las obras de arte sí.
  const got = await momentCandidates(db, { ...prefs, topics: ['historia'], blockedWords: ['Obra 3'] }, { now: NOW });
  assert.ok(!got.some((m) => m.format === 'text-fact'), 'el texto respeta tus temas');
  assert.ok(got.some((m) => m.format === 'image-fact' && m.topic === 'arte'), 'las imágenes no dependen de tus temas');
  assert.ok(got.some((m) => m.cardId === englishImage.id), 'imágenes en inglés aunque solo leas español');
  assert.ok(!got.some((m) => m.cardId === frenchImage.id), 'pero no en idiomas que no lees');
  assert.ok(!got.some((m) => m.cardId === englishText.id));
  assert.ok(!got.some((m) => m.hook === 'Obra 3'), 'las palabras bloqueadas valen siempre');
  assert.ok(!got.some((m) => m.cardId === bait.id), 'el clickbait evidente queda fuera siempre');

  await markSeen(db, [cards[0].id]);
  const onScreen = [cards[1].id];
  const all = await momentCandidates(db, prefs, { now: NOW, excludeCardIds: onScreen });
  assert.ok(!all.some((m) => m.cardId === cards[0].id), 'lo visto no se repite');
  assert.ok(!all.some((m) => m.cardId === cards[1].id), 'lo que está en pantalla no se repite');
  assert.ok(all.some((m) => m.format === 'which-first' || m.format === 'timeline'), 'calcula ganchos con las efemérides');
});

test('momentAllowed aplica umbrales con scoreHook', () => {
  const m = { ...fake(1, 'text-fact', 'x'), quality: scoreHook('¡¡IMPACTANTE!!', 'x', 'magazine') };
  assert.equal(momentAllowed(m, prefs), false);
  assert.equal(momentAllowed(m, { ...prefs, hideSensational: false }), true);
});
