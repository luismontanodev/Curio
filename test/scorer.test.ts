import { test } from 'node:test';
import assert from 'node:assert/strict';

import { detectSignals, evaluate, findBlockedWord, scoreCard, withQuality } from '../src/core/scorer.ts';
import { normalizeMet } from '../src/core/normalizers/met.ts';
import { normalizeOnThisDay } from '../src/core/normalizers/wikipedia.ts';
import type { FilterPrefs, RawCard } from '../src/core/types.ts';

const prefs: FilterPrefs = {
  topics: ['ciencia', 'arte', 'cultura', 'historia'],
  languages: ['es', 'en'],
  level: 'estricto',
  hideSensational: true,
  hideClickbait: true,
  onlyVerified: false,
  blockedWords: [],
};

const raw = (title: string, topic: RawCard['topic'] = 'ciencia'): RawCard => ({
  id: `t:${title}`, sourceId: 't', externalId: title, type: 'article', topic, lang: 'es', title, url: 'https://example.org',
});

const visible = (title: string, kind: Parameters<typeof scoreCard>[1] = 'magazine', p = prefs) =>
  evaluate(withQuality(raw(title), kind), kind, p).show;

test('títulos neutrales pasan en nivel estricto', () => {
  for (const t of [
    'La gran ola de Kanagawa',
    'Tardígrados: cómo sobreviven a la deshidratación casi total',
    '1869: se inaugura el Canal de Suez',
    'El telescopio JWST observa una galaxia temprana',
    'La NASA publica nuevas imágenes de Júpiter',
    'Nuevo estudio sobre fármacos antivirales en ratones',
  ]) {
    assert.equal(visible(t), true, t);
  }
});

test('clickbait y sensacionalismo se ocultan', () => {
  for (const t of [
    '¡NO CREERÁS lo que encontraron en Marte!',
    '10 cosas que no sabías del Renacimiento',
    'Esto es lo que pasa cuando miras al sol',
    'Escándalo IMPACTANTE en el museo',
    'You won’t believe what happened next',
  ]) {
    assert.equal(visible(t), false, t);
  }
});

test('las siglas no cuentan como gritos', () => {
  const ids = detectSignals('La UNESCO y la NASA firman acuerdo sobre ADN').map((s) => s.id);
  assert.ok(!ids.includes('caps-ratio') && !ids.includes('caps-words'));
});

test('una pregunta sola pasa en estricto desde una fuente curada', () => {
  assert.equal(visible('¿Por qué el cielo es azul?', 'encyclopedia'), true);
  assert.equal(visible('¿Por qué el cielo es azul?', 'news'), true); // 1.5 * 1.2 = 1.8 ≤ 2.5
});

test('el nivel suave deja pasar más', () => {
  const t = '¡Increíble descubrimiento en Egipto!'; // 2 + 1.5 = 3.5
  assert.equal(visible(t, 'magazine', { ...prefs, level: 'estricto' }), false);
  assert.equal(visible(t, 'magazine', { ...prefs, level: 'suave' }), true);
});

test('apagar un toggle ignora esa categoría', () => {
  const t = '7 razones para visitar Oaxaca';
  assert.equal(visible(t), true); // listicle = 2 ≤ 2.5
  assert.equal(visible('10 cosas que no sabías: no creerás la última'), false);
  assert.equal(visible('10 cosas que no sabías: no creerás la última', 'magazine', { ...prefs, hideClickbait: false }), true);
});

test('palabras bloqueadas ignoran mayúsculas y acentos, con límites de palabra', () => {
  assert.equal(findBlockedWord('Gran POLÉMICA en la bienal', ['polemica']), 'polemica');
  assert.equal(findBlockedWord('Estudio antiviral', ['viral']), undefined);
  const v = evaluate(withQuality(raw('Bienal de Venecia'), 'museum'), 'museum', { ...prefs, blockedWords: ['venecia'] });
  assert.deepEqual(v, { show: false, reason: 'blocked-word', detail: 'venecia' });
});

test('filtra por tema y fuentes verificadas', () => {
  const c = withQuality(raw('Nueva exposición', 'musica'), 'news');
  assert.deepEqual(evaluate(c, 'news', prefs), { show: false, reason: 'topic' });
  const d = withQuality(raw('Nueva exposición', 'arte'), 'news');
  assert.deepEqual(evaluate(d, 'news', { ...prefs, onlyVerified: true }), { show: false, reason: 'unverified' });
});

test('normalizeMet descarta obras sin dominio público o sin imagen', () => {
  assert.equal(normalizeMet({ objectID: 1, isPublicDomain: false, title: 'X', primaryImageSmall: 'a.jpg' }), null);
  assert.equal(normalizeMet({ objectID: 1, isPublicDomain: true, title: 'X' }), null);
  const card = normalizeMet({
    objectID: 45434, isPublicDomain: true, title: 'Under the Wave off Kanagawa',
    artistDisplayName: 'Katsushika Hokusai', objectDate: 'ca. 1830–32', primaryImageSmall: 'https://img/x.jpg',
  });
  assert.equal(card?.id, 'met:45434');
  assert.equal(card?.summary, 'Katsushika Hokusai · ca. 1830–32');
});

test('normalizeOnThisDay arma título con año y recorta', () => {
  const card = normalizeOnThisDay(
    { year: 1869, text: 'Se inaugura el Canal de Suez.', pages: [{ title: 'Canal de Suez', pageid: 9, content_urls: { desktop: { page: 'https://es.wikipedia.org/wiki/Canal_de_Suez' } } }] },
    11, 17,
  );
  assert.equal(card?.title, '1869: Se inaugura el Canal de Suez.');
  assert.equal(card?.id, 'wikipedia-es:otd:1117:1869:9');
});
