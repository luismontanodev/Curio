// Imágenes del tamaño justo: ni pixeladas ni más pesadas de lo necesario.
// Cada fuente permite pedir otro tamaño cambiando la URL. Un mosaico de Explorar (≈ 170 dp)
// no necesita 960 px: con 500 se ve nítido y pesa ~4 veces menos.

/** Ancho por defecto (imagen a todo el ancho del teléfono). */
export const IMAGE_WIDTH = 960;
/** Ancho para mosaicos, miniaturas y "Ahorro de datos". */
export const IMAGE_WIDTH_SMALL = 500;

/** Tamaños estándar de Wikimedia: los no estándar se limitan más (429 por IP). */
export const WIKIMEDIA_WIDTHS = [120, 250, 330, 500, 960, 1280, 1920];
const wikimediaBucket = (w: number) => WIKIMEDIA_WIDTHS.find((b) => b >= w) ?? WIKIMEDIA_WIDTHS.at(-1)!;

const WIKIMEDIA_THUMB = /^(https:\/\/(?:upload|thumb)\.wikimedia\.org\/.+\/thumb\/.+\/)((?:lossy-|lossless-)?(?:page\d+-)?)(\d+)px-([^/?#]+)(.*)$/;

/**
 * Versión de la imagen al ancho pedido, si la fuente lo permite; si no, la misma URL.
 * La UI vuelve a la original si la pedida falla (Wikimedia no agranda más allá del original).
 */
export function sizedImageUrl(url: string, width = IMAGE_WIDTH): string {
  // Wikimedia: …/thumb/…/{N}px-Archivo.jpg (también fotogramas de video "{N}px--X.webm.jpg").
  const m = WIKIMEDIA_THUMB.exec(url);
  if (m) {
    const target = wikimediaBucket(width);
    return Number(m[3]) === target ? url : `${m[1]}${m[2]}${target}px-${m[4]}${m[5]}`;
  }
  // Commons con Special:FilePath acepta ?width=.
  const fp = /^(https:\/\/commons\.wikimedia\.org\/wiki\/Special:FilePath\/[^?#]+)(?:\?width=\d+)?$/.exec(url);
  if (fp) return `${fp[1]}?width=${wikimediaBucket(width)}`;
  // NASA: ~thumb (≈ 100), ~small (≈ 320), ~medium (≈ 640–1280).
  const nasa = /^(https:\/\/images-assets\.nasa\.gov\/.+)~(thumb|small|medium|large)\.(jpg|png)$/i.exec(url);
  if (nasa) return `${nasa[1]}~${width <= 360 ? 'small' : 'medium'}.${nasa[3]}`;
  // iNaturalist: small (240), medium (500), large (1024).
  const inat = /^(https:\/\/inaturalist-open-data\.s3\.amazonaws\.com\/photos\/\d+\/)(square|small|medium|large|original)(\.\w+)$/i.exec(url);
  if (inat) return `${inat[1]}${width <= 240 ? 'small' : width <= 500 ? 'medium' : 'large'}${inat[3]}`;
  // IIIF (V&A, Art Institute): …/full/!800,800/… o …/full/843,/…
  const iiif = /^(https:\/\/.+\/full\/)(!\d+,\d+|\d+,)(\/0\/default\.jpg)$/.exec(url);
  if (iiif) return `${iiif[1]}${iiif[2].startsWith('!') ? `!${width},${width}` : `${width},`}${iiif[3]}`;
  // The Conversation: parámetro w= del servicio de imágenes.
  // (el alto se escala en la misma proporción para conservar el recorte).
  const conv = /^https:\/\/images\.theconversation\.com\/.*[?&]w=(\d+)/.exec(url);
  if (conv) {
    const w = Number(conv[1]);
    const h = /[?&]h=(\d+)/.exec(url);
    let out = url.replace(/([?&])w=\d+/, `$1w=${width}`);
    if (h) out = out.replace(/([?&])h=\d+/, `$1h=${Math.round((Number(h[1]) * width) / w)}`);
    return out;
  }
  return url;
}

/** Compatibilidad: la versión nítida a todo el ancho. */
export const sharperImageUrl = (url: string, width = IMAGE_WIDTH) => sizedImageUrl(url, width);
