// Imágenes nítidas: Wikipedia entrega miniaturas de 320–640 px que se ven pixeladas a todo
// el ancho del teléfono. Wikimedia genera otros tamaños con solo cambiar el número en la URL;
// se pide 960 (uno de sus tamaños estándar, que ya suelen estar en caché).

/** Ancho que se pide por defecto: nítido en teléfonos sin descargar el original. */
export const IMAGE_WIDTH = 960;

const WIKIMEDIA_THUMB = /^(https:\/\/(?:upload|thumb)\.wikimedia\.org\/.+\/thumb\/.+\/)((?:lossy-|lossless-)?(?:page\d+-)?)(\d+)px-([^/?#]+)(.*)$/;

/**
 * Versión de mayor resolución de una imagen, si la fuente lo permite. Si ya es grande o la
 * URL no es de una miniatura conocida, devuelve la misma. La UI debe volver a la original
 * si la grande falla (Wikimedia no agranda imágenes más chicas que el tamaño pedido).
 */
export function sharperImageUrl(url: string, width = IMAGE_WIDTH): string {
  const m = WIKIMEDIA_THUMB.exec(url);
  if (m) {
    const current = Number(m[3]);
    return current >= width ? url : `${m[1]}${m[2]}${width}px-${m[4]}${m[5]}`;
  }
  // Commons con Special:FilePath acepta ?width=.
  const fp = /^(https:\/\/commons\.wikimedia\.org\/wiki\/Special:FilePath\/[^?#]+)(?:\?width=(\d+))?$/.exec(url);
  if (fp) return Number(fp[2] ?? 0) >= width ? url : `${fp[1]}?width=${width}`;
  // NASA: ~thumb y ~small son diminutas; ~medium (≈ 640–1280) existe para casi todas.
  if (/^https:\/\/images-assets\.nasa\.gov\/.+~(thumb|small)\.(jpg|png)$/i.test(url)) {
    return url.replace(/~(thumb|small)\.(jpg|png)$/i, '~medium.$2');
  }
  return url;
}
