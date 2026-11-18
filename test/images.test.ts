import { test } from 'node:test';
import assert from 'node:assert/strict';

import { sharperImageUrl } from '../src/core/images.ts';

test('sharperImageUrl pide 960 px a las miniaturas de Wikimedia', () => {
  assert.equal(
    sharperImageUrl('https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Suez.jpg/320px-Suez.jpg'),
    'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Suez.jpg/960px-Suez.jpg',
  );
  // Variante real del feed (host thumb, parámetros de seguimiento) y TIFF convertido.
  assert.equal(
    sharperImageUrl('https://thumb.wikimedia.org/wikipedia/commons/thumb/1/1b/I.tiff/lossy-page1-330px-I.tiff.jpg?utm_source=x'),
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/1b/I.tiff/lossy-page1-960px-I.tiff.jpg?utm_source=x',
  );
});

test('sharperImageUrl no toca lo que ya es grande ni URLs desconocidas', () => {
  const big = 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/X.jpg/1280px-X.jpg';
  assert.equal(sharperImageUrl(big), big);
  assert.equal(sharperImageUrl('https://images.metmuseum.org/CRDImages/as/web-large/DP130155.jpg'), 'https://images.metmuseum.org/CRDImages/as/web-large/DP130155.jpg');
  assert.equal(sharperImageUrl('https://commons.wikimedia.org/wiki/Special:FilePath/X.jpg?width=960'), 'https://commons.wikimedia.org/wiki/Special:FilePath/X.jpg?width=960');
  assert.equal(sharperImageUrl('https://commons.wikimedia.org/wiki/Special:FilePath/X.jpg'), 'https://commons.wikimedia.org/wiki/Special:FilePath/X.jpg?width=960');
  assert.equal(sharperImageUrl('https://images-assets.nasa.gov/image/A/A~thumb.jpg'), 'https://images-assets.nasa.gov/image/A/A~medium.jpg');
});
