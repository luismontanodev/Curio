// Video corto: duraciones de las fuentes reales, validación, momento de 15–60 s, proporción
// posts/videos en las listas, columnas nuevas y respaldo (video + "Ahorro de datos").

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { capVideos, formatDuration, interleaveVideos, isMomentLength, parseDuration, parseVideo, savingData } from '../src/core/video.ts';
import { momentFromCard, mixMoments, VIDEO_FORMATS } from '../src/core/moments.ts';
import { getCard, getFeedPage, insertCards, listSaved, saveCard } from '../src/db/cards.ts';
import { DEFAULT_PREFS, getPrefs, sanitizePrefs, setPrefs } from '../src/db/prefs.ts';
import { exportBackup, importBackup, parseBackup, serializeBackup } from '../src/backup/backup.ts';
import { freshDb } from './helpers/node-db.ts';
import { makeCard } from './helpers/fixtures.ts';

const video = (durationSec: number, over = {}) =>
  makeCard({
    type: 'video',
    sourceId: 'nasa-video',
    title: 'Así despliega el Hubble sus paneles',
    summary: 'El telescopio abre sus paneles solares en órbita. La NASA lo filmó en 1990.',
    imageUrl: 'https://images-assets.nasa.gov/video/x/x~medium.jpg',
    video: { url: 'https://images-assets.nasa.gov/video/x/x~mobile.mp4', mime: 'video/mp4', durationSec },
    credit: 'NASA Goddard',
    ...over,
  });

test('parseDuration entiende los formatos reales de NASA e Internet Archive', () => {
  assert.equal(parseDuration('0:01:35'), 95); // NASA QuickTime:Duration
  assert.equal(parseDuration('27.73 s'), 27.73); // NASA, clips cortos
  assert.equal(parseDuration('0:52'), 52); // Internet Archive runtime
  assert.equal(parseDuration('00:01:00'), 60);
  assert.equal(parseDuration('15:00'), 900);
  assert.equal(parseDuration('178.02'), 178.02); // Internet Archive length por archivo
  assert.equal(parseDuration(47.648), 47.648); // Commons imageinfo.duration
  assert.equal(parseDuration('?'), null);
  assert.equal(parseDuration(undefined), null);
  assert.equal(formatDuration(47.6), '0:48');
});

test('solo clips de 15 a 60 s son momento principal', () => {
  assert.ok(isMomentLength(15) && isMomentLength(60) && isMomentLength(27.73));
  assert.ok(!isMomentLength(14.9) && !isMomentLength(61) && !isMomentLength(null));
  const m = momentFromCard(video(27.73))!;
  assert.equal(m.format, 'video');
  assert.equal(m.media?.videoUrl, 'https://images-assets.nasa.gov/video/x/x~mobile.mp4');
  assert.equal(m.media?.imageUrl, 'https://images-assets.nasa.gov/video/x/x~medium.jpg', 'póster');
  assert.equal(m.media?.durationSec, 27.73);
  assert.equal(m.media?.mimeType, 'video/mp4');
  assert.equal(m.credit, 'NASA Goddard');
  assert.ok(m.payoff.length > 0, 'el gancho se cierra en la misma pantalla');
  assert.equal(momentFromCard(video(95)), null, 'largo: no entra');
  assert.equal(momentFromCard({ ...video(30), video: undefined }), null, 'sin datos de video: no entra');
});

test('los videos van en su propio flujo; los posts no los mezclan', () => {
  const moments = [momentFromCard(video(30))!, momentFromCard(makeCard({ type: 'article', summary: 'Una oración completa aquí.' }))!];
  assert.deepEqual(mixMoments(moments).map((m) => m.format), ['text-fact']);
  assert.deepEqual(mixMoments(moments, { formats: VIDEO_FORMATS }).map((m) => m.format), ['video']);
});

test('Videos: todos son del mismo formato y casi todos de NASA, y aun así salen todos (no solo 2 por lote)', () => {
  const nasa = Array.from({ length: 10 }, (_, i) => momentFromCard(video(30, { externalId: `v${i}`, title: `Video ${i}` }))!);
  const first = mixMoments(nasa, { formats: VIDEO_FORMATS, strict: false, size: 12 });
  assert.equal(first.length, 10);
  // Con los ya mostrados de NASA al final, el siguiente lote no sale vacío.
  const more = Array.from({ length: 4 }, (_, i) => momentFromCard(video(30, { externalId: `w${i}`, title: `Otro ${i}` }))!);
  assert.equal(mixMoments(more, { formats: VIDEO_FORMATS, strict: false, after: first }).length, 4);
  // Si hay otra fuente, se prefiere alternar.
  const ia = momentFromCard(video(30, { externalId: 'ia', sourceId: 'internet-archive', title: 'Noticiero' }))!;
  const mixed = mixMoments([...more, ia], { formats: VIDEO_FORMATS, strict: false, after: first });
  assert.equal(mixed[0].cardId, ia.cardId);
});

test('parseVideo valida entrada no confiable', () => {
  assert.deepEqual(parseVideo({ url: 'http://x/v.mp4', mime: 'video/mp4', durationSec: '0:30', width: 640 }), {
    url: 'https://x/v.mp4',
    mime: 'video/mp4',
    durationSec: 30,
    width: 640,
  });
  assert.equal(parseVideo({ url: 'javascript:x', mime: 'video/mp4', durationSec: 30 }), null);
  assert.equal(parseVideo({ url: 'https://x/v.webm', mime: 'video/webm', durationSec: 30 }), null, 'WebM no se reproduce en iOS');
  assert.equal(parseVideo({ url: 'https://x/v.mp4', mime: 'video/mp4' }), null, 'sin duración no entra');
});

test('listas: más posts que videos (1 video cada 4 posts como máximo)', () => {
  const p = () => makeCard({ type: 'article' });
  const v = () => video(30);
  const seq = [v(), p(), p(), v(), p(), p(), p(), p(), v(), v(), p()];
  const kinds = capVideos(seq).map((c) => (c.type === 'video' ? 'V' : 'p')).join('');
  assert.equal(kinds, 'ppppppVp');
  assert.equal(
    interleaveVideos([p(), p(), p(), p(), p(), p(), p(), p()], [v(), v(), v()]).map((c) => (c.type === 'video' ? 'V' : 'p')).join(''),
    'ppppVppppV',
  );
});

test('la tarjeta de video se guarda y se lee con su video y su crédito (también en el feed)', async () => {
  const db = await freshDb();
  const c = video(30);
  await insertCards(db, [c]);
  const [listed] = (await getFeedPage(db, { ...DEFAULT_PREFS, onlyVerified: false })).cards;
  assert.deepEqual(listed.video, c.video);
  assert.equal(listed.credit, 'NASA Goddard');
  assert.deepEqual((await getCard(db, c.id))?.video, c.video);
  const cols = await db.getAllAsync<{ name: string }>("select name from pragma_table_info('cards')", []);
  assert.ok(cols.some((x) => x.name === 'video_json') && cols.some((x) => x.name === 'credit'));
});

test('"Ahorro de datos": solo con datos móviles por defecto, se sanea y viaja en el respaldo junto con los videos guardados', async () => {
  assert.equal(DEFAULT_PREFS.dataSaver, 'cellular');
  assert.equal(sanitizePrefs({ dataSaver: 'sí' }).dataSaver, 'cellular');
  assert.equal(sanitizePrefs({ dataSaver: 'always' }).dataSaver, 'always');
  assert.equal(sanitizePrefs({ dataSaver: 'off' }).dataSaver, 'off');
  // El booleano de la primera versión se entiende.
  assert.equal(sanitizePrefs({ dataSaver: true }).dataSaver, 'always');
  assert.equal(sanitizePrefs({ dataSaver: false }).dataSaver, 'off');

  const source = await freshDb();
  await setPrefs(source, { ...DEFAULT_PREFS, dataSaver: 'always' });
  const c = video(30);
  await insertCards(source, [c]);
  await saveCard(source, c);
  const text = serializeBackup(await exportBackup(source));

  const target = await freshDb();
  const { backup, rejected } = parseBackup(text);
  assert.equal(rejected, 0);
  await importBackup(target, backup, 'replace');
  assert.equal((await getPrefs(target)).dataSaver, 'always');
  const [saved] = await listSaved(target);
  assert.deepEqual(saved.card.video, c.video);
  assert.equal(saved.card.credit, 'NASA Goddard');
});

test('Momentos › Videos: solo videos de 15–60 s, en tus idiomas más inglés; Posts no trae videos', async () => {
  const { momentCandidates } = await import('../src/db/moments.ts');
  const db = await freshDb();
  const v = video(30, { lang: 'en', topic: 'espacio' }); // Espacio no está en los filtros del usuario
  const long = video(120, { lang: 'en' });
  const post = makeCard({ type: 'article', summary: 'Una oración completa aquí.' });
  await insertCards(db, [v, long, post]);
  const prefs = { ...DEFAULT_PREFS, onlyVerified: false, languages: ['es' as const], topics: ['arte' as const, 'ciencia' as const] }; // sin 'espacio': los videos igual entran
  const vids = await momentCandidates(db, prefs, { mode: 'videos' });
  assert.deepEqual(vids.map((m) => m.cardId), [v.id]);
  const posts = await momentCandidates(db, prefs, { mode: 'posts' });
  assert.ok(posts.every((m) => m.format !== 'video') && posts.some((m) => m.cardId === post.id));
});

test('"Ahorro de datos" según la conexión: con datos móviles (o red desconocida) ahorra; con Wi-Fi no', () => {
  assert.equal(savingData('cellular', 'cellular'), true);
  assert.equal(savingData('cellular', 'unknown'), true);
  assert.equal(savingData('cellular', 'wifi'), false);
  assert.equal(savingData('cellular', 'offline'), false);
  assert.equal(savingData('always', 'wifi'), true);
  assert.equal(savingData('off', 'cellular'), false);
});
