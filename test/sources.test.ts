// Fuentes nuevas contra respuestas reales (test/fixtures/), bloques de lectura y clasificador de temas.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { htmlToBlocks, parseBlocks, wikiTextToBlocks } from '../src/core/blocks.ts';
import { classifyTopic } from '../src/core/classify.ts';
import { normalizeConversation, parseAtom } from '../src/core/normalizers/conversation.ts';
import { commonsImageUrl, normalizeArtBinding, yearOf, type ArtBinding } from '../src/core/normalizers/wikidata.ts';
import { normalizeNasa, type NasaItem } from '../src/core/normalizers/nasa.ts';
import { fetchWikipediaArticle, parseWikipediaUrl } from '../src/ingest/article.ts';
import { actionApi } from '../src/ingest/wikipedia.ts';
import { fakeFetch } from './helpers/fixtures.ts';

const fixtureText = (name: string) => readFileSync(join(import.meta.dirname, 'fixtures', name), 'utf8');
const fixture = <T>(name: string): T => JSON.parse(fixtureText(name)) as T;

// --- The Conversation --------------------------------------------------------

test('The Conversation: Atom real → artículos con texto completo, autor y sin píxel de conteo', () => {
  const entries = parseAtom(fixtureText('conversation-es-ciencia.atom'));
  assert.equal(entries.length, 2);
  const card = normalizeConversation(entries[0], 'es');
  assert.ok(card);
  assert.equal(card.sourceId, 'theconversation');
  assert.equal(card.lang, 'es');
  assert.equal(card.license, 'CC BY-ND 4.0');
  assert.ok(card.url.startsWith('https://theconversation.com/'));
  assert.ok(card.imageUrl?.startsWith('https://images.theconversation.com/'));
  assert.ok(card.body && card.body.length > 5);
  assert.equal(card.body[0].kind, 'quote'); // autor y afiliación al inicio
  assert.ok(card.body.some((b) => b.kind === 'p' && b.text.length > 100));
  assert.ok(!card.body.some((b) => b.kind === 'img' && /counter\.theconversation/.test(b.src)));
  assert.ok(!card.body.some((b) => b.kind === 'img' && b.src === card.imageUrl), 'la imagen principal no se repite');
  assert.ok((card.readMinutes ?? 0) >= 2);
});

test('htmlToBlocks: párrafos, subtítulos, citas, imágenes con pie y sin rastreadores', () => {
  const html = `
    <figure><img src="https://img/x.jpg?a=1&amp;b=2" /><figcaption><span>Pie de foto</span></figcaption></figure>
    <p>Primer <a href="https://x">párrafo</a> &laquo;con&raquo; entidades&nbsp;y <em>énfasis</em>.</p>
    <h2>Un subtítulo</h2>
    <blockquote><p>Una cita</p></blockquote>
    <ul><li>Elemento</li></ul>
    <script>alert(1)</script>
    <img src="https://counter.theconversation.com/content/1/count.gif" width="1" height="1" />
    <img src="http://img/y.png">`;
  assert.deepEqual(htmlToBlocks(html), [
    { kind: 'img', src: 'https://img/x.jpg?a=1&b=2', caption: 'Pie de foto' },
    { kind: 'p', text: 'Primer párrafo «con» entidades y énfasis.' },
    { kind: 'h', text: 'Un subtítulo' },
    { kind: 'quote', text: 'Una cita' },
    { kind: 'p', text: '• Elemento' },
    { kind: 'img', src: 'https://img/y.png' }, // http → https (iOS bloquea http)
  ]);
});

// --- Wikipedia: artículo completo --------------------------------------------

test('wikiTextToBlocks: secciones como subtítulos, sin referencias ni enlaces externos', () => {
  const text = 'Intro.\n\n== Historia ==\nTexto de historia.\n=== Detalle ===\nMás.\n== Véase también ==\n* Algo\n== Referencias ==\nRef 1\n=== Bibliografía ===\nLibro\n== Enlaces externos ==\nX';
  assert.deepEqual(wikiTextToBlocks(text), [
    { kind: 'p', text: 'Intro.' },
    { kind: 'h', text: 'Historia' },
    { kind: 'p', text: 'Texto de historia.' },
    { kind: 'h', text: 'Detalle' },
    { kind: 'p', text: 'Más.' },
  ]);
});

test('artículo real de Wikipedia → bloques legibles sin la sección de referencias', async () => {
  const fetch = fakeFetch({ [actionApi('es')]: fixture('wikipedia-article-tardigrada.json') });
  const blocks = await fetchWikipediaArticle(fetch, 'https://es.wikipedia.org/wiki/Tardigrada');
  assert.ok(blocks && blocks.length > 10);
  assert.ok(blocks.some((b) => b.kind === 'h'));
  assert.ok(!blocks.some((b) => b.kind === 'h' && /Referencias|Enlaces externos/.test(b.text)));
  assert.match(new URL(fetch.calls[0]).searchParams.get('titles') ?? '', /^Tardigrada$/);
});

test('parseWikipediaUrl reconoce idioma y título; rechaza otros sitios', () => {
  assert.deepEqual(parseWikipediaUrl('https://es.wikipedia.org/wiki/Canal_de_Suez'), { lang: 'es', title: 'Canal de Suez' });
  assert.deepEqual(parseWikipediaUrl('https://fr.wikipedia.org/wiki/%C3%89toile'), { lang: 'fr', title: 'Étoile' });
  assert.equal(parseWikipediaUrl('https://de.wikipedia.org/wiki/Stern'), null);
  assert.equal(parseWikipediaUrl('https://theconversation.com/x'), null);
});

test('parseBlocks valida bloques de entrada no confiable', () => {
  assert.deepEqual(
    parseBlocks([
      { kind: 'p', text: 'ok' },
      { kind: 'img', src: 'javascript:alert(1)' },
      { kind: 'img', src: 'http://x/y.jpg', caption: 'pie' },
      { kind: 'script', text: 'no' },
      { kind: 'h', text: '   ' },
      null,
    ]),
    [
      { kind: 'p', text: 'ok' },
      { kind: 'img', src: 'https://x/y.jpg', caption: 'pie' },
    ],
  );
  assert.deepEqual(parseBlocks('no es lista'), []);
});

// --- Wikidata (arte en el idioma del usuario) --------------------------------

test('Wikidata real → obras con título y autor en español, imagen https de Commons y artículo', () => {
  const res = fixture<{ results: { bindings: ArtBinding[] } }>('wikidata-art-es.json');
  const cards = res.results.bindings.map((b) => normalizeArtBinding(b, 'es')).filter((c) => c !== null);
  assert.ok(cards.length >= 4);
  for (const c of cards) {
    assert.equal(c.lang, 'es');
    assert.equal(c.type, 'artwork');
    assert.match(c.imageUrl ?? '', /^https:\/\/commons\.wikimedia\.org\/wiki\/Special:FilePath\/.+\?width=960$/);
    assert.match(c.url, /^https:\/\/es\.wikipedia\.org\/wiki\//);
    assert.match(c.externalId, /^es:Q\d+$/);
  }
});

test('commonsImageUrl y yearOf', () => {
  assert.equal(
    commonsImageUrl('http://commons.wikimedia.org/wiki/Special:FilePath/Mona%20Lisa.jpg'),
    'https://commons.wikimedia.org/wiki/Special:FilePath/Mona%20Lisa.jpg?width=960',
  );
  assert.equal(commonsImageUrl('https://otro.sitio/x.jpg'), null);
  assert.equal(yearOf('1660-01-01T00:00:00Z'), '1660');
  assert.equal(yearOf('-0350-01-01T00:00:00Z'), '351 a. C.');
  assert.equal(yearOf(undefined), undefined);
});

// --- NASA --------------------------------------------------------------------

test('NASA real → imágenes de espacio en inglés, dominio público, imagen mediana', () => {
  const res = fixture<{ collection: { items: NasaItem[] } }>('nasa-search.json');
  const cards = res.collection.items.map(normalizeNasa).filter((c) => c !== null);
  assert.ok(cards.length > 0);
  for (const c of cards) {
    assert.equal(c.topic, 'espacio');
    assert.equal(c.lang, 'en');
    assert.match(c.imageUrl ?? '', /^https:\/\/images-assets\.nasa\.gov\/.+~medium\.(jpg|png)$/i);
    assert.match(c.url, /^https:\/\/images\.nasa\.gov\/details\//);
  }
});

// --- Clasificador de temas ---------------------------------------------------

test('classifyTopic separa tecnología, espacio y naturaleza; si no hay señal, usa el de la fuente', () => {
  assert.equal(classifyTopic('Miles de agentes de IA se unen para un ciberataque', '', 'ciencia'), 'tecnologia');
  assert.equal(classifyTopic('Haumea (planeta enano)', 'Haumea es un planeta enano del sistema solar.', 'cultura'), 'espacio');
  assert.equal(classifyTopic('Así hemos descubierto un cambio evolutivo en las algas del Algarve', 'especies desconocidas', 'ciencia'), 'naturaleza');
  assert.equal(classifyTopic('Madrid', 'Madrid es la capital de España.', 'cultura'), 'cultura');
  // "vía" no es "IA": límites de palabra y sin acentos.
  assert.equal(classifyTopic('La vía romana de Hispania', '', 'historia'), 'historia');
});
