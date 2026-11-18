import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  cardKicker, cardMeta, cardVariant, eventMonthDay, formatDateTime, importSummary, withPauses,
} from '../src/ui/format.ts';
import { makeCard } from './helpers/fixtures.ts';

const nov17 = new Date(2026, 10, 17, 9, 0);

test('cardVariant: obras con imagen arriba, efemérides aparte, el resto texto', () => {
  assert.equal(cardVariant(makeCard({ type: 'artwork', imageUrl: 'https://x/y.jpg' })), 'image');
  assert.equal(cardVariant(makeCard({ type: 'artwork' })), 'text'); // sin imagen no hay placeholder eterno
  assert.equal(cardVariant(makeCard({ type: 'article', imageUrl: 'https://x/y.jpg' })), 'text');
  assert.equal(cardVariant(makeCard({ type: 'event', imageUrl: 'https://x/y.jpg' })), 'event');
});

test('cardKicker: tema y tipo, o "Hoy en la historia" con la fecha de la efeméride', () => {
  assert.equal(cardKicker(makeCard({ topic: 'arte', type: 'artwork', sourceId: 'met' })), 'Arte · Obra de museo');
  assert.equal(cardKicker(makeCard({ topic: 'arte', type: 'artwork', sourceId: 'wikidata-arte' })), 'Arte · Obra de arte');
  assert.equal(cardKicker(makeCard({ topic: 'tecnologia', type: 'article', sourceId: 'theconversation' })), 'Tecnología · Divulgación');
  assert.equal(cardKicker(makeCard({ topic: 'cultura', type: 'article' })), 'Cultura · Artículo destacado');
  assert.equal(cardKicker(makeCard({ topic: 'espacio', type: 'image', sourceId: 'nasa' })), 'Espacio · Imagen de la NASA');
  const ev = makeCard({ type: 'event', topic: 'historia', externalId: 'otd:1117:1869:123' });
  assert.equal(cardKicker(ev, nov17), 'Hoy en la historia · 17 nov');
  assert.equal(cardKicker(ev, new Date(2026, 10, 18)), 'En la historia · 17 nov');
});

test('eventMonthDay cae a la fecha de ingesta si el id no trae fecha', () => {
  const ev = makeCard({ type: 'event', externalId: 'raro', ingestedAt: new Date(2026, 2, 5, 12).toISOString() });
  assert.deepEqual(eventMonthDay(ev), { month: 3, day: 5 });
});

test('cardMeta muestra fuente, licencia, idioma (solo si se leen varios) y lectura', () => {
  const met = makeCard({ sourceId: 'met', lang: 'en', license: 'CC0 · Dominio público' });
  assert.equal(cardMeta(met, { showLang: true }), 'The Met · CC0 · Dominio público · En inglés');
  assert.equal(cardMeta(met), 'The Met · CC0 · Dominio público');
  const wiki = makeCard({ license: 'CC BY-SA 4.0', readMinutes: 4 });
  assert.equal(cardMeta(wiki), 'Wikipedia · CC BY-SA 4.0 · Lectura de 4 min');
});

test('formatDateTime usa la hora local y tolera fechas inválidas', () => {
  assert.equal(formatDateTime(new Date(2026, 10, 17, 8, 5).toISOString()), '17 nov 2026, 08:05');
  assert.equal(formatDateTime('no es fecha'), '—');
});

test('importSummary arma un resumen con singular y plural', () => {
  assert.equal(
    importSummary({ savedAdded: 12, savedKept: 2, savedRemoved: 0 }, 1),
    'Se agregaron 12 guardados · 2 ya estaban · 1 se descartó por venir incompleto',
  );
  assert.equal(
    importSummary({ savedAdded: 1, savedKept: 0, savedRemoved: 3 }, 0),
    'Se quitaron 3 guardados anteriores · Se agregó 1 guardado',
  );
});

test('withPauses intercala una pausa cada N tarjetas y respeta las descartadas', () => {
  const cards = Array.from({ length: 7 }, () => makeCard());
  const kinds = (rows: ReturnType<typeof withPauses>) => rows.map((r) => (r.kind === 'pause' ? r.key : 'c'));
  assert.deepEqual(kinds(withPauses(cards, 3)), ['c', 'c', 'c', 'pause-1', 'c', 'c', 'c', 'pause-2', 'c']);
  assert.deepEqual(kinds(withPauses(cards, 3, new Set(['pause-1']))), ['c', 'c', 'c', 'c', 'c', 'c', 'pause-2', 'c']);
  assert.equal(withPauses(cards, null).length, 7);
});
