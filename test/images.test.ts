import { test } from 'node:test';
import assert from 'node:assert/strict';

import { sharperImageUrl, sizedImageUrl } from '../src/core/images.ts';

test('Wikimedia: tamaños estándar, hacia arriba (nitidez) y hacia abajo (menos datos)', () => {
  const t = (n: number) => `https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Suez.jpg/${n}px-Suez.jpg`;
  assert.equal(sharperImageUrl(t(320)), t(960));
  assert.equal(sizedImageUrl(t(1280), 960), t(960), 'más grande de lo necesario: se reduce');
  assert.equal(sizedImageUrl(t(960), 500), t(500));
  assert.equal(sizedImageUrl(t(960), 400), t(500), 'redondea al tamaño estándar siguiente');
  // Variante real del feed (host thumb, parámetros de seguimiento) y TIFF convertido.
  assert.equal(
    sharperImageUrl('https://thumb.wikimedia.org/wikipedia/commons/thumb/1/1b/I.tiff/lossy-page1-330px-I.tiff.jpg?utm_source=x'),
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/1b/I.tiff/lossy-page1-960px-I.tiff.jpg?utm_source=x',
  );
  // Fotograma de video de Commons.
  assert.equal(
    sizedImageUrl('https://upload.wikimedia.org/wikipedia/commons/thumb/2/28/A.webm/960px--A.webm.jpg', 500),
    'https://upload.wikimedia.org/wikipedia/commons/thumb/2/28/A.webm/500px--A.webm.jpg',
  );
});

test('otras fuentes: Special:FilePath, NASA, iNaturalist, IIIF y The Conversation', () => {
  assert.equal(sizedImageUrl('https://commons.wikimedia.org/wiki/Special:FilePath/X.jpg', 500), 'https://commons.wikimedia.org/wiki/Special:FilePath/X.jpg?width=500');
  assert.equal(sizedImageUrl('https://commons.wikimedia.org/wiki/Special:FilePath/X.jpg?width=960', 960), 'https://commons.wikimedia.org/wiki/Special:FilePath/X.jpg?width=960');
  assert.equal(sharperImageUrl('https://images-assets.nasa.gov/image/A/A~thumb.jpg'), 'https://images-assets.nasa.gov/image/A/A~medium.jpg');
  assert.equal(sizedImageUrl('https://images-assets.nasa.gov/video/A/A~medium.jpg', 300), 'https://images-assets.nasa.gov/video/A/A~small.jpg');
  assert.equal(sizedImageUrl('https://inaturalist-open-data.s3.amazonaws.com/photos/1/large.jpeg', 500), 'https://inaturalist-open-data.s3.amazonaws.com/photos/1/medium.jpeg');
  assert.equal(sizedImageUrl('https://framemark.vam.ac.uk/collections/X/full/!800,800/0/default.jpg', 500), 'https://framemark.vam.ac.uk/collections/X/full/!500,500/0/default.jpg');
  assert.equal(
    sizedImageUrl('https://images.theconversation.com/files/1/original/a.jpg?ixlib=rb-4.1.1&rect=0%2C0&q=45&auto=format&w=1050&h=700&fit=crop', 525),
    'https://images.theconversation.com/files/1/original/a.jpg?ixlib=rb-4.1.1&rect=0%2C0&q=45&auto=format&w=525&h=350&fit=crop',
    'el alto escala en proporción',
  );
  const met = 'https://images.metmuseum.org/CRDImages/as/web-large/DP130155.jpg';
  assert.equal(sizedImageUrl(met, 500), met, 'fuente sin tamaños: misma URL');
});
